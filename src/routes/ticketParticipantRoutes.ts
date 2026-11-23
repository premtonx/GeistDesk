/**
 * Ticket participant management for co-managed client portal tickets.
 */

import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/authMiddleware.js';
import { attachClientOrganizationContext } from '../middleware/clientPortalMiddleware.js';
import { getDocDirect, getDocsDirect } from '../lib/postgres-backend.js';
import { routeParam } from '../lib/route-params.js';
import { safeErrorMessage, safeLog } from '../lib/safe-log.js';
import {
  isClientOrgWideTicketRole,
  isClientPortalRole,
  isHubcomStaffRole,
} from '../lib/client-portal/roles.js';
import {
  addTicketParticipant,
  listTicketParticipants,
  removeTicketParticipant,
} from '../lib/client-portal/ticket-participants.js';
import {
  clientCanMutateTicket,
  resolveOrganizationIdFromUser,
  ticketOrganizationId,
} from '../lib/client-portal/ticket-visibility.js';

const router = Router({ mergeParams: true });

const participantSchema = z.object({
  userId: z.string().min(1).max(200),
});

async function loadTicketOr404(ticketId: string, res: Response) {
  const ticket = await getDocDirect('tickets', ticketId);
  if (!ticket) {
    res.status(404).json({ error: 'Ticket not found.' });
    return null;
  }
  return ticket as Record<string, unknown> & { id: string };
}

function sessionUser(req: Request) {
  return {
    id: String(req.user!.id),
    role: String(req.user!.role),
    organizationId: resolveOrganizationIdFromUser(req.user!),
  };
}

async function assertCanManageParticipants(
  req: Request,
  res: Response,
  ticket: Record<string, unknown> & { id: string },
): Promise<boolean> {
  const role = req.user!.role;
  if (isHubcomStaffRole(role) || role === 'SYSTEM_ADMIN') {
    return true;
  }
  if (!isClientPortalRole(role)) {
    res.status(403).json({ error: 'Forbidden.' });
    return false;
  }
  if (role === 'CLIENT_USER') {
    res.status(403).json({
      error: 'Forbidden: CLIENT_USER cannot manage ticket participants.',
    });
    return false;
  }
  if (!isClientOrgWideTicketRole(role)) {
    res.status(403).json({ error: 'Forbidden.' });
    return false;
  }
  const ok = await clientCanMutateTicket(sessionUser(req), ticket);
  if (!ok) {
    res.status(404).json({ error: 'Ticket not found.' });
    return false;
  }
  return true;
}

/** Ensure the target user belongs to the same organization as the ticket. */
async function assertSameOrganizationUser(
  ticket: Record<string, unknown>,
  userId: string,
  res: Response,
): Promise<boolean> {
  const orgId = ticketOrganizationId(ticket);
  const users = await getDocsDirect('users', []);
  const target = users.find((u) => u.id === userId);
  if (!target) {
    res.status(404).json({ error: 'User not found.' });
    return false;
  }
  const targetOrg =
    (typeof target.organizationId === 'string' && target.organizationId) ||
    (typeof target.organization_id === 'string' && target.organization_id) ||
    null;
  if (!orgId || !targetOrg || targetOrg !== orgId) {
    res.status(403).json({
      error: 'Forbidden: Participants must belong to the ticket organization.',
    });
    return false;
  }
  if (!isClientPortalRole(target.role) && target.role !== 'customer') {
    res.status(403).json({
      error: 'Forbidden: Only client organization members can be added as participants.',
    });
    return false;
  }
  return true;
}

/** GET /api/tickets/:id/participants */
router.get(
  '/:id/participants',
  authenticate,
  attachClientOrganizationContext,
  async (req: Request, res: Response): Promise<any> => {
    const ticketId = routeParam(req.params.id);
    try {
      const ticket = await loadTicketOr404(ticketId, res);
      if (!ticket) return;

      if (isClientPortalRole(req.user!.role)) {
        const ok = await clientCanMutateTicket(sessionUser(req), { ...ticket, id: ticketId });
        if (!ok) return res.status(404).json({ error: 'Ticket not found.' });
      }

      const participants = await listTicketParticipants(ticketId);
      return res.json({ participants });
    } catch (err: any) {
      safeLog('error', '[participants] list failed', err?.message || err);
      return res.status(500).json({ error: safeErrorMessage(err, 'Failed to list participants') });
    }
  },
);

/** POST /api/tickets/:id/participants */
router.post(
  '/:id/participants',
  authenticate,
  attachClientOrganizationContext,
  async (req: Request, res: Response): Promise<any> => {
    const ticketId = routeParam(req.params.id);
    const parsed = participantSchema.safeParse(req.body || {});
    if (!parsed.success) {
      return res.status(400).json({ error: 'userId is required.' });
    }

    try {
      const ticket = await loadTicketOr404(ticketId, res);
      if (!ticket) return;
      ticket.id = ticketId;

      if (!(await assertCanManageParticipants(req, res, ticket))) return;
      if (!(await assertSameOrganizationUser(ticket, parsed.data.userId, res))) return;

      const participant = await addTicketParticipant({
        ticketId,
        userId: parsed.data.userId,
        addedBy: String(req.user!.id),
      });
      return res.status(201).json({ participant });
    } catch (err: any) {
      safeLog('error', '[participants] add failed', err?.message || err);
      return res.status(500).json({ error: safeErrorMessage(err, 'Failed to add participant') });
    }
  },
);

/** DELETE /api/tickets/:id/participants/:userId */
router.delete(
  '/:id/participants/:userId',
  authenticate,
  attachClientOrganizationContext,
  async (req: Request, res: Response): Promise<any> => {
    const ticketId = routeParam(req.params.id);
    const userId = routeParam(req.params.userId);
    try {
      const ticket = await loadTicketOr404(ticketId, res);
      if (!ticket) return;
      ticket.id = ticketId;

      if (!(await assertCanManageParticipants(req, res, ticket))) return;

      const removed = await removeTicketParticipant(ticketId, userId);
      if (!removed) return res.status(404).json({ error: 'Participant not found.' });
      return res.json({ success: true });
    } catch (err: any) {
      safeLog('error', '[participants] remove failed', err?.message || err);
      return res
        .status(500)
        .json({ error: safeErrorMessage(err, 'Failed to remove participant') });
    }
  },
);

export default router;
