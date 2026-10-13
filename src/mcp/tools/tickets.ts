import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { addDocDirect, getDocDirect, getDocsDirect, updateDocDirect } from '../../lib/postgres-backend.js';
import { documentBelongsToTenant } from '../../lib/tenant-context.js';
import { getMcpActor, requireMcpScope } from '../context.js';
import { toolError, toolJson } from '../types.js';

const STATUS_VALUES = [
  'open',
  'pending',
  'in_progress',
  'resolved',
  'closed',
  'deleted',
  'spam',
  'merged',
  'trash',
  'qs',
  'paused',
  'on-hold',
  'on_hold',
  'waiting_customer',
  'waiting_dev',
  'waiting_vendor',
] as const;

const PRIORITY_VALUES = ['low', 'medium', 'high', 'urgent'] as const;

function summarizeTicket(ticket: Record<string, unknown>) {
  return {
    id: ticket.id,
    subject: ticket.subject ?? ticket.title ?? null,
    status: ticket.status ?? null,
    priority: ticket.priority ?? null,
    agentId: ticket.agentId ?? ticket.assignedTo ?? null,
    agentName: ticket.agentName ?? null,
    customerEmail: ticket.customerEmail ?? ticket.requesterEmail ?? null,
    updatedAt: ticket.updatedAt ?? null,
    createdAt: ticket.createdAt ?? null,
  };
}

export function registerTicketTools(server: McpServer): void {
  server.registerTool(
    'tickets_list',
    {
      title: 'List tickets',
      description: 'Fetch tickets filtered by status, priority, and optional assignment to the authenticated agent.',
      inputSchema: {
        status: z.enum(STATUS_VALUES).optional().describe('Ticket status filter'),
        priority: z.enum(PRIORITY_VALUES).optional().describe('Ticket priority filter'),
        assignedToMe: z.boolean().optional().describe('When true, only tickets assigned to the token owner'),
      },
    },
    async ({ status, priority, assignedToMe }) => {
      const denied = requireMcpScope('tickets:read');
      if (denied) return denied;
      const actor = getMcpActor();
      try {
        const constraints: Array<{ type: string; field: string; op: string; value: unknown }> = [];
        if (status) constraints.push({ type: 'where', field: 'status', op: '==', value: status });
        if (priority) constraints.push({ type: 'where', field: 'priority', op: '==', value: priority });
        if (assignedToMe) {
          constraints.push({ type: 'where', field: 'agentId', op: '==', value: actor.userId });
        }

        const rows = await getDocsDirect('tickets', constraints, { tenantId: actor.tenantId });
        const tickets = rows
          .filter((row) => documentBelongsToTenant(row, actor.tenantId))
          .map((row) => summarizeTicket(row as Record<string, unknown>))
          .sort((a, b) => {
            const aTime = a.updatedAt ? new Date(String(a.updatedAt)).getTime() : 0;
            const bTime = b.updatedAt ? new Date(String(b.updatedAt)).getTime() : 0;
            return bTime - aTime;
          })
          .slice(0, 50);

        return toolJson({ count: tickets.length, tickets });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        return toolError(`tickets_list failed: ${message}`);
      }
    },
  );

  server.registerTool(
    'tickets_get',
    {
      title: 'Get ticket',
      description: 'Retrieve ticket details including customer messages and internal notes.',
      inputSchema: {
        id: z.string().min(1).max(200).describe('Ticket id'),
      },
    },
    async ({ id }) => {
      const denied = requireMcpScope('tickets:read');
      if (denied) return denied;
      const actor = getMcpActor();
      try {
        const ticket = await getDocDirect('tickets', id, { tenantId: actor.tenantId });
        if (!ticket || !documentBelongsToTenant(ticket, actor.tenantId)) {
          return toolError(`Ticket not found: ${id}`);
        }

        let comments: unknown[] = [];
        try {
          comments = await getDocsDirect('ticket_replies', [
            { type: 'where', field: 'ticketId', op: '==', value: id },
          ]);
        } catch {
          comments = [];
        }

        const messages = Array.isArray(ticket.messages) ? ticket.messages : [];
        const sortedComments = [...comments].sort((a: any, b: any) => {
          const aTime = a?.createdAt ? new Date(a.createdAt).getTime() : 0;
          const bTime = b?.createdAt ? new Date(b.createdAt).getTime() : 0;
          return aTime - bTime;
        });

        return toolJson({
          ...summarizeTicket(ticket),
          description: ticket.description ?? ticket.body ?? null,
          internalNotes: ticket.internalNotes ?? null,
          tags: ticket.tags ?? [],
          messages,
          replies: sortedComments.slice(-40),
          aiSummary: ticket.aiSummary ?? null,
        });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        return toolError(`tickets_get failed: ${message}`);
      }
    },
  );

  server.registerTool(
    'tickets_update_status',
    {
      title: 'Update ticket status',
      description: 'Resolve or update a ticket status and optionally append an audit comment.',
      inputSchema: {
        id: z.string().min(1).max(200).describe('Ticket id'),
        status: z.enum(STATUS_VALUES).describe('New ticket status'),
        comment: z.string().max(10_000).optional().describe('Optional internal note / audit comment'),
      },
    },
    async ({ id, status, comment }) => {
      const denied = requireMcpScope('tickets:write');
      if (denied) return denied;
      const actor = getMcpActor();
      try {
        const existing = await getDocDirect('tickets', id, { tenantId: actor.tenantId });
        if (!existing || !documentBelongsToTenant(existing, actor.tenantId)) {
          return toolError(`Ticket not found: ${id}`);
        }

        const now = new Date().toISOString();
        const patch: Record<string, unknown> = {
          status,
          updatedAt: now,
        };
        if (status === 'resolved' || status === 'closed') {
          patch.resolvedAt = now;
        }
        if (comment && comment.trim()) {
          const stamped = `[MCP ${now}] ${actor.userEmail || actor.userId}: ${comment.trim()}`;
          const prev = typeof existing.internalNotes === 'string' ? existing.internalNotes : '';
          patch.internalNotes = prev ? `${prev}\n\n${stamped}` : stamped;
        }

        await updateDocDirect('tickets', id, patch, { tenantId: actor.tenantId });

        await addDocDirect('audit_logs', {
          actorId: actor.userId,
          actorEmail: actor.userEmail,
          module: 'tickets',
          action: 'TICKET_STATUS_UPDATED_MCP',
          severity: 'medium',
          details: {
            ticketId: id,
            from: existing.status ?? null,
            to: status,
            comment: comment?.trim() || null,
            via: 'mcp',
            tokenId: actor.tokenId ?? null,
          },
          timestamp: now,
          createdAt: now,
        });

        const updated = await getDocDirect('tickets', id, { tenantId: actor.tenantId });
        return toolJson({
          success: true,
          ticket: summarizeTicket((updated || { id, ...patch }) as Record<string, unknown>),
        });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        return toolError(`tickets_update_status failed: ${message}`);
      }
    },
  );
}
