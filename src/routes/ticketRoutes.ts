import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/authMiddleware.js';
import { getDocDirect, updateDocDirect } from '../lib/postgres-backend.js';
import { routeParam } from '../lib/route-params.js';
import { safeLog } from '../lib/safe-log.js';
import { resolveTenantFromRequest, documentBelongsToTenant } from '../lib/tenant-context.js';

const router = Router();

const ASSIGNEE_FIELDS = ['agentId', 'agentName', 'assignedTo', 'assigneeId', 'assignedToEmail'] as const;

const ticketStatusSchema = z.enum([
  'open', 'pending', 'resolved', 'closed', 'deleted', 'spam', 'merged', 'trash',
  'qs', 'paused', 'on-hold', 'on_hold', 'waiting_customer', 'waiting_dev', 'waiting_vendor',
]);

const ticketPrioritySchema = z.enum(['low', 'medium', 'high', 'urgent']);

/** Fields that may be set even when not previously present on the ticket. */
const ALLOWED_NEW_FIELDS = new Set([
  'agentId', 'agentName', 'assignedTo', 'assigneeId', 'assignedToEmail',
  'status', 'priority', 'type', 'tags', 'groupId', 'groupName',
  'internalNotes', 'include_in_rag', 'resolvedAt', 'mergedIntoId',
  'linkedTicketIds', 'isMasterTicket', 'masterTicketId',
  'aiSummary', 'aiInsights', 'aiRootCause', 'aiChecklist', 'aiSentiment',
  'accountHealth', 'slaTier', 'isHelpRequested',
  'aiSuggestedDraft', 'aiDraftRaw', 'aiConfidenceScore', 'aiCritiqueLog',
  'aiExecutionStatus', 'updatedAt',
]);

/**
 * PATCH /api/tickets/:id
 * Update a ticket (assignee, status, priority, …) directly on the PostgreSQL
 * backend. Persists agentId/agentName plus the alias fields (assignedTo,
 * assigneeId, assignedToEmail) so every consumer sees the same assignee.
 * Returns the updated ticket: { success: true, ticket }.
 */
router.patch('/:id', authenticate, async (req: Request, res: Response): Promise<any> => {
  const ticketId = routeParam(req.params.id);
  if (!ticketId) return res.status(400).json({ error: 'Ticket id is required.' });

  const body = (req.body || {}) as Record<string, unknown>;

  // Coerce assignee fields into the canonical set. `??` would mask an explicit
  // `null` (unassignment), so detect presence field by field.
  const hasAgentId = body.agentId !== undefined || body.assignedTo !== undefined || body.assigneeId !== undefined;
  const rawAgentId = hasAgentId ? (body.agentId ?? body.assignedTo ?? body.assigneeId) : undefined;
  const rawAgentName = body.agentName;
  const rawAssignedToEmail = body.assignedToEmail;

  const data: Record<string, unknown> = {};

  const assigneeChange = hasAgentId || rawAgentName !== undefined || rawAssignedToEmail !== undefined;
  if (assigneeChange) {
    const agentId =
      rawAgentId === null
        ? null
        : typeof rawAgentId === 'string' && rawAgentId.trim()
          ? rawAgentId
          : undefined;
    const agentName =
      rawAgentName === null
        ? null
        : typeof rawAgentName === 'string' && rawAgentName.trim()
          ? rawAgentName
          : undefined;
    const assignedToEmail =
      rawAssignedToEmail === null
        ? null
        : typeof rawAssignedToEmail === 'string' && rawAssignedToEmail.trim()
          ? rawAssignedToEmail
          : undefined;
    // Only write fields that were explicitly provided — `undefined` must stay
    // out of the patch or the JSONB writer would corrupt the stored value.
    for (const field of ASSIGNEE_FIELDS) {
      if (field === 'agentId' || field === 'assignedTo' || field === 'assigneeId') {
        if (agentId !== undefined) data[field] = agentId;
      } else if (field === 'agentName') {
        if (agentName !== undefined) data[field] = agentName;
      } else if (assignedToEmail !== undefined) {
        data[field] = assignedToEmail;
      }
    }
  }

  // Accept status/priority with validation.
  if (body.status !== undefined) {
    const parsedStatus = ticketStatusSchema.safeParse(body.status);
    if (!parsedStatus.success) {
      return res.status(400).json({ error: `Invalid status: ${String(body.status)}` });
    }
    data.status = parsedStatus.data;
  }

  if (body.priority !== undefined) {
    const parsedPriority = ticketPrioritySchema.safeParse(body.priority);
    if (!parsedPriority.success) {
      return res.status(400).json({ error: `Invalid priority: ${String(body.priority)}` });
    }
    data.priority = parsedPriority.data;
  }

  // Remaining fields: allow any key that is already present on the stored
  // ticket, plus the curated ALLOWED_NEW_FIELDS set. This keeps arbitrary
  // key injection out while letting every existing UI update path work.
  const existing = await getDocDirect('tickets', ticketId);
  if (!existing) {
    return res.status(404).json({ error: 'Ticket not found.' });
  }

  for (const [key, value] of Object.entries(body)) {
    if (data[key] !== undefined) continue; // already handled above
    if (value === undefined) continue;
    if (key in existing || ALLOWED_NEW_FIELDS.has(key)) {
      data[key] = value;
    }
  }

  if (Object.keys(data).length === 0) {
    return res.status(400).json({ error: 'No updatable fields provided.' });
  }

  try {
    // Tenant isolation: the caller may only mutate tickets in their own tenant.
    const tenantId = resolveTenantFromRequest(req);
    if (!documentBelongsToTenant(existing, tenantId)) {
      return res.status(404).json({ error: 'Ticket not found.' });
    }

    const now = new Date().toISOString();
    data.updatedAt = now;

    await updateDocDirect('tickets', ticketId, data, { tenantId });

    const updated = await getDocDirect('tickets', ticketId);
    return res.status(200).json({ success: true, ticket: { id: ticketId, ...updated } });
  } catch (e: any) {
    safeLog('error', '[tickets] PATCH /api/tickets/:id failed', e?.message || e);
    return res.status(500).json({ error: 'Failed to update ticket.' });
  }
});

const bulkUpdateSchema = z.object({
  ids: z.array(z.string().min(1).max(200)).min(1).max(500),
  updates: z.object({
    agentId: z.string().max(200).nullable().optional(),
    agentName: z.string().max(200).nullable().optional(),
    assignedTo: z.string().max(200).nullable().optional(),
    assigneeId: z.string().max(200).nullable().optional(),
    assignedToEmail: z.string().max(320).nullable().optional(),
    status: ticketStatusSchema.optional(),
    priority: ticketPrioritySchema.optional(),
    type: z.string().max(80).optional(),
    tags: z.array(z.string().max(120)).max(50).optional(),
    groupId: z.string().max(200).optional(),
    groupName: z.string().max(200).optional(),
    internalNotes: z.string().max(100_000).optional(),
    include_in_rag: z.boolean().optional(),
    resolvedAt: z.union([z.string(), z.null()]).optional(),
    mergedIntoId: z.string().max(200).nullable().optional(),
    linkedTicketIds: z.array(z.string().max(200)).max(100).optional(),
    isMasterTicket: z.boolean().optional(),
    masterTicketId: z.string().max(200).nullable().optional(),
    aiSummary: z.string().max(50_000).optional(),
    aiInsights: z.array(z.string().max(5_000)).max(50).optional(),
    aiRootCause: z.string().max(20_000).optional(),
    aiChecklist: z.array(z.unknown()).max(200).optional(),
    aiSentiment: z.string().max(50).optional(),
    accountHealth: z.string().max(80).nullable().optional(),
    slaTier: z.string().max(80).nullable().optional(),
    isHelpRequested: z.boolean().optional(),
  }),
});

/**
 * POST /api/tickets/bulk-update
 * Apply the same update to many tickets. Each update is tenant-scoped and
 * persisted via updateDocDirect; returns per-ticket results.
 */
router.post('/bulk-update', authenticate, async (req: Request, res: Response): Promise<any> => {
  const parsed = bulkUpdateSchema.safeParse(req.body || {});
  if (!parsed.success) {
    return res.status(400).json({
      error: 'Invalid bulk update payload',
      details: parsed.error.flatten().fieldErrors,
    });
  }

  const { ids, updates } = parsed.data;

  // Normalize assignee aliases into the canonical set. `??` would mask an
  // explicit `null` (unassignment), so detect presence field by field.
  const data: Record<string, unknown> = {};
  const hasAgentId = updates.agentId !== undefined || updates.assignedTo !== undefined || updates.assigneeId !== undefined;
  const agentId = hasAgentId ? (updates.agentId ?? updates.assignedTo ?? updates.assigneeId) : undefined;
  const agentName = updates.agentName;
  const assignedToEmail = updates.assignedToEmail;
  if (hasAgentId || agentName !== undefined || assignedToEmail !== undefined) {
    // Only write fields that were explicitly provided.
    for (const field of ASSIGNEE_FIELDS) {
      if (field === 'agentId' || field === 'assignedTo' || field === 'assigneeId') {
        if (hasAgentId) data[field] = agentId;
      } else if (field === 'agentName') {
        if (agentName !== undefined) data[field] = agentName;
      } else if (assignedToEmail !== undefined) {
        data[field] = assignedToEmail;
      }
    }
  }

  // Copy every remaining validated update field.
  const restFields: (keyof typeof updates)[] = [
    'status', 'priority', 'type', 'tags', 'groupId', 'groupName', 'internalNotes',
    'include_in_rag', 'resolvedAt', 'mergedIntoId', 'linkedTicketIds',
    'isMasterTicket', 'masterTicketId', 'aiSummary', 'aiInsights', 'aiRootCause',
    'aiChecklist', 'aiSentiment', 'accountHealth', 'slaTier', 'isHelpRequested',
  ];
  for (const field of restFields) {
    const value = updates[field];
    if (value !== undefined) data[field] = value;
  }
  const results: { id: string; success: boolean; error?: string }[] = [];
  let updatedCount = 0;
  const tenantId = resolveTenantFromRequest(req);

  try {
    for (const ticketId of ids) {
      try {
        const existing = await getDocDirect('tickets', ticketId);
        if (!existing || !documentBelongsToTenant(existing, tenantId)) {
          results.push({ id: ticketId, success: false, error: 'Ticket not found.' });
          continue;
        }
        await updateDocDirect('tickets', ticketId, data, { tenantId });
        results.push({ id: ticketId, success: true });
        updatedCount += 1;
      } catch (innerErr: any) {
        safeLog('error', `[tickets] bulk-update failed for ${ticketId}`, innerErr?.message || innerErr);
        results.push({ id: ticketId, success: false, error: innerErr?.message || 'Update failed.' });
      }
    }

    const failures = results.filter((r) => !r.success);
    const status = failures.length === ids.length ? 500 : 200;
    return res.status(status).json({
      success: failures.length === 0,
      updated: updatedCount,
      failed: failures.length,
      results,
      tickets: await Promise.all(
        ids
          .filter((ticketId) => results.find((r) => r.id === ticketId)?.success)
          .map(async (ticketId) => {
            const ticket = await getDocDirect('tickets', ticketId, { tenantId });
            return { id: ticketId, ...ticket };
          }),
      ),
    });
  } catch (e: any) {
    safeLog('error', '[tickets] POST /api/tickets/bulk-update failed', e?.message || e);
    return res.status(500).json({ error: 'Failed to perform bulk update.' });
  }
});

export default router;
