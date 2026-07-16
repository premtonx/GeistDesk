import { Router, type Request, type Response } from 'express';
import { authenticate } from '../middleware/authMiddleware.js';
import { getDocDirect, updateDocDirect } from '../lib/postgres-backend.js';
import { routeParam } from '../lib/route-params.js';
import {
  addToGlobalBlacklist,
  extractEmailAddress,
} from '../lib/global-blacklist.js';

const router = Router();

/**
 * Resolve the raw sender email from a ticket document.
 * Prefer from_email / customerEmail (inbound mail), then contact-like customerId.
 */
export function resolveTicketFromEmail(ticket: Record<string, unknown>): string {
  const candidates = [
    ticket.from_email,
    ticket.customerEmail,
    ticket.requesterEmail,
    ticket.customerId,
  ];
  for (const raw of candidates) {
    if (typeof raw !== 'string' || !raw.trim()) continue;
    const email = extractEmailAddress(raw);
    if (email.includes('@')) return email;
  }
  return '';
}

/**
 * POST /api/tickets/:id/spam
 * Mark ticket as spam and permanently blacklist the sender email.
 */
router.post('/:id/spam', authenticate, async (req: Request, res: Response): Promise<any> => {
  const ticketId = routeParam(req.params.id);
  if (!ticketId) {
    return res.status(400).json({ error: 'Ticket id is required.' });
  }

  try {
    const ticket = await getDocDirect('tickets', ticketId);
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found.' });
    }

    const senderEmail = resolveTicketFromEmail(ticket as Record<string, unknown>);
    if (!senderEmail) {
      return res.status(400).json({
        error:
          'No sender email found on this ticket (from_email / customerEmail). Cannot blacklist.',
      });
    }

    const blockedBy = req.user?.id || req.user?.email || 'unknown';
    const now = new Date().toISOString();

    // Step A — mark ticket as spam (excluded from Offen / In Bearbeitung queues).
    await updateDocDirect('tickets', ticketId, {
      status: 'spam',
      from_email: senderEmail,
      customerEmail: (ticket as any).customerEmail || senderEmail,
      spamMarkedAt: now,
      spamMarkedBy: blockedBy,
      updatedAt: now,
    });

    // Step B — persist sender on global blacklist.
    const blacklistEntry = await addToGlobalBlacklist({
      blockedValue: senderEmail,
      blockedBy,
    });

    console.info(
      `[Spam] ticket=${ticketId} marked spam; blacklisted=${senderEmail} by=${blockedBy}`,
    );

    return res.json({
      success: true,
      ticketId,
      status: 'spam',
      blocked_value: blacklistEntry.blocked_value,
      blacklistId: blacklistEntry.id,
    });
  } catch (error: any) {
    console.error('[Spam] mark-as-spam failed:', error);
    return res.status(500).json({
      error: error?.message || 'Failed to mark ticket as spam.',
    });
  }
});

export default router;
