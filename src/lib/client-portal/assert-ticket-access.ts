/**
 * Shared helpers for legacy ticket endpoints that predate the portal guards.
 */

import type { Response } from 'express';
import type { AuthenticatedRequest } from '../../middleware/authMiddleware.js';
import { isClientPortalRole, isHubcomStaffRole } from './roles.js';
import {
  clientCanMutateTicket,
  clientCanViewTicket,
  resolveOrganizationIdFromUser,
} from './ticket-visibility.js';
import { getDocDirect } from '../postgres-backend.js';

export async function loadTicketOr404(
  ticketId: string,
): Promise<Record<string, unknown> | null> {
  const ticket = await getDocDirect('tickets', ticketId);
  if (!ticket) return null;
  return { ...ticket, id: ticketId };
}

/**
 * Gate a ticket endpoint for mixed Hubcom/client callers.
 * - Client portal roles: require clientCanViewTicket / clientCanMutateTicket
 * - Hubcom staff: allowed
 * - Others: 403
 *
 * Returns the ticket document when access is granted, or null after writing the response.
 */
export async function requireTicketAccess(
  req: AuthenticatedRequest,
  res: Response,
  ticketId: string,
  mode: 'view' | 'mutate' = 'view',
): Promise<Record<string, unknown> | null> {
  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized.' });
    return null;
  }

  const ticket = await loadTicketOr404(ticketId);
  if (!ticket) {
    res.status(404).json({ error: 'Ticket not found.' });
    return null;
  }

  if (isClientPortalRole(req.user.role)) {
    const session = {
      id: String(req.user.id),
      role: String(req.user.role),
      organizationId: resolveOrganizationIdFromUser(req.user),
    };
    const allowed =
      mode === 'mutate'
        ? await clientCanMutateTicket(session, ticket)
        : await clientCanViewTicket(session, ticket);
    if (!allowed) {
      res.status(404).json({ error: 'Ticket not found.' });
      return null;
    }
    return ticket;
  }

  if (isHubcomStaffRole(req.user.role) || req.user.role === 'SYSTEM_ADMIN' || req.user.is_admin) {
    return ticket;
  }

  res.status(403).json({ error: 'Forbidden.' });
  return null;
}

/** Hubcom-only ticket tools (AI analysis, spam, handoff, golden notes). */
export function forbidClientOnHubcomTicketTool(
  req: AuthenticatedRequest,
  res: Response,
): boolean {
  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized.' });
    return true;
  }
  if (isClientPortalRole(req.user.role)) {
    res.status(403).json({
      error: 'Forbidden: This endpoint is Hubcom staff only.',
    });
    return true;
  }
  return false;
}
