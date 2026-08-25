/**
 * Server-side ticket helpers with vector index hooks for resolved/closed tickets.
 * Browser CRUD remains in src/services/ticketService.ts.
 */

import {
  deleteDocDirect,
  getDocDirect,
  updateDocDirect,
} from './postgres-backend.js';
import {
  enqueueDeleteEmbeddings,
  enqueueResolvedTicketIndex,
} from './ai/vector-queue.js';

const TICKETS_COLLECTION = 'tickets';

export async function updateTicketStatus(
  id: string,
  updates: Record<string, unknown>,
  tenantId = 'default',
): Promise<void> {
  await updateDocDirect(TICKETS_COLLECTION, id, {
    ...updates,
    updatedAt: new Date().toISOString(),
  });

  const status = String(updates.status || '').toLowerCase();
  if (status === 'resolved' || status === 'closed') {
    await enqueueResolvedTicketIndex(id, tenantId);
  } else if (status === 'trash' || status === 'deleted') {
    await enqueueDeleteEmbeddings(id, 'RESOLVED_TICKET', tenantId);
  }
}

export async function deleteTicket(id: string, tenantId = 'default'): Promise<void> {
  await deleteDocDirect(TICKETS_COLLECTION, id);
  await enqueueDeleteEmbeddings(id, 'RESOLVED_TICKET', tenantId);
}

export async function getTicket(id: string) {
  return getDocDirect(TICKETS_COLLECTION, id);
}
