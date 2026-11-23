/**
 * Ticket participants — allow CLIENT_USER (and colleagues) to be added to a ticket.
 */

import { queryDb } from '../postgres-backend.js';

export interface TicketParticipantRecord {
  ticket_id: string;
  user_id: string;
  added_by: string | null;
  created_at: string;
}

function mapRow(row: any): TicketParticipantRecord {
  return {
    ticket_id: String(row.ticket_id),
    user_id: String(row.user_id),
    added_by: row.added_by == null ? null : String(row.added_by),
    created_at: row.created_at ? new Date(row.created_at).toISOString() : '',
  };
}

export async function listTicketParticipants(
  ticketId: string,
): Promise<TicketParticipantRecord[]> {
  const res = await queryDb(
    `SELECT ticket_id, user_id, added_by, created_at
       FROM ticket_participants
      WHERE ticket_id = $1
      ORDER BY created_at ASC`,
    [ticketId],
  );
  return res.rows.map(mapRow);
}

export async function isTicketParticipant(
  ticketId: string,
  userId: string,
): Promise<boolean> {
  const res = await queryDb(
    `SELECT 1 FROM ticket_participants WHERE ticket_id = $1 AND user_id = $2 LIMIT 1`,
    [ticketId, userId],
  );
  return Boolean(res.rowCount && res.rowCount > 0);
}

export async function listTicketIdsForParticipant(userId: string): Promise<string[]> {
  const res = await queryDb(
    `SELECT ticket_id FROM ticket_participants WHERE user_id = $1`,
    [userId],
  );
  return res.rows.map((r) => String(r.ticket_id));
}

export async function addTicketParticipant(params: {
  ticketId: string;
  userId: string;
  addedBy: string;
}): Promise<TicketParticipantRecord> {
  const res = await queryDb(
    `INSERT INTO ticket_participants (ticket_id, user_id, added_by)
     VALUES ($1, $2, $3)
     ON CONFLICT (ticket_id, user_id) DO UPDATE
       SET added_by = EXCLUDED.added_by
     RETURNING ticket_id, user_id, added_by, created_at`,
    [params.ticketId, params.userId, params.addedBy],
  );
  return mapRow(res.rows[0]);
}

export async function removeTicketParticipant(
  ticketId: string,
  userId: string,
): Promise<boolean> {
  const res = await queryDb(
    `DELETE FROM ticket_participants WHERE ticket_id = $1 AND user_id = $2`,
    [ticketId, userId],
  );
  return Boolean(res.rowCount && res.rowCount > 0);
}
