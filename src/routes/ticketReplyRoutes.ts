import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/authMiddleware.js';
import { addDocDirect, getDocDirect, updateDocDirect } from '../lib/postgres-backend.js';
import { routeParam } from '../lib/route-params.js';
import { trySendTicketReplyEmail } from '../lib/outbound-mail.js';
import { findChannelForOutbound, listEmailChannels } from '../lib/email-ingestion/channel-store.js';
import { formatReplyRecipientLabel, resolveComposerFromAddress } from '../lib/ticket-reply-address.js';
import { safeLog } from '../lib/safe-log.js';

const router = Router();

/**
 * GET /api/tickets/:id/composer-addresses
 * Von:/An: for the reply composer. Uses the ticket mailbox's channel
 * forwardingAddress (or support email), then MAIL_FROM_ADDRESS.
 */
router.get('/:id/composer-addresses', authenticate, async (req: Request, res: Response): Promise<any> => {
  const ticketId = routeParam(req.params.id);
  try {
    const ticket = await getDocDirect('tickets', ticketId);
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found.' });
    }

    const channels = await listEmailChannels();
    const from = resolveComposerFromAddress({
      ticketMailbox: ticket.mailbox || ticket.forwardingAddress || null,
      channels,
      moduleSupportEmail: ticket.supportEmail || ticket.channelEmail || null,
      mailFromAddress: process.env.MAIL_FROM_ADDRESS || process.env.SMTP_FROM || null,
    });
    const to = formatReplyRecipientLabel(ticket);

    return res.status(200).json({ from, to });
  } catch (e: any) {
    safeLog('error', '[ticket-replies] failed to resolve composer addresses', e?.message || e);
    return res.status(500).json({ error: 'Failed to resolve composer addresses.' });
  }
});

const replySchema = z.object({
  content: z.string().min(1).max(100_000),
  originalContent: z.string().max(100_000).optional(),
  senderId: z.string().min(1).max(128),
  senderName: z.string().min(1).max(200).optional(),
  senderType: z.enum(['agent', 'customer', 'ai']).default('agent'),
});

/**
 * POST /api/tickets/:id/replies
 * Database-first agent reply:
 *   1. Persist message under tickets/{id}/messages
 *   2. Attempt outbound email (non-fatal)
 *   3. Always 200 when DB write succeeds — even if SMTP is unavailable
 */
router.post('/:id/replies', authenticate, async (req: Request, res: Response): Promise<any> => {
  const ticketId = routeParam(req.params.id);
  const parsed = replySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: 'Invalid reply payload',
      details: parsed.error.flatten().fieldErrors,
    });
  }

  try {
    const ticket = await getDocDirect('tickets', ticketId);
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found.' });
    }

    const now = new Date().toISOString();
    const data = parsed.data;
    const messageRecord = await addDocDirect(`tickets/${ticketId}/messages`, {
      ticketId,
      senderId: data.senderId || req.user!.id,
      senderType: data.senderType,
      senderName: data.senderName || req.user!.email || 'Agent',
      content: data.content,
      originalContent: data.originalContent || null,
      deliveryStatus: 'pending',
      createdAt: now,
      updatedAt: now,
    });

    await updateDocDirect('tickets', ticketId, {
      updatedAt: now,
      lastReplyAt: now,
      lastReplyBy: data.senderType,
    });

    let delivered = false;
    let deliveryReason: string | undefined;
    let mailFrom: string | undefined;
    let domainVerified: boolean | undefined;
    try {
      const channel = await findChannelForOutbound({
        mailbox: ticket.mailbox || ticket.forwardingAddress || null,
        supportEmail: ticket.supportEmail || ticket.channelEmail || null,
      });
      const mailResult = await trySendTicketReplyEmail({
        ticketId,
        to: ticket.customerEmail || ticket.contactEmail || null,
        subject: ticket.subject ? `Re: ${ticket.subject}` : `Re: Ticket ${ticketId}`,
        body: data.content,
        agentName: data.senderName || req.user!.email || 'Agent',
        channel,
      });
      delivered = mailResult.delivered;
      deliveryReason = mailResult.reason;
      mailFrom = mailResult.from;
      domainVerified = mailResult.domainVerified;
    } catch (mailErr: any) {
      delivered = false;
      deliveryReason = mailErr?.message || 'Outbound mail threw unexpectedly';
      safeLog('warn', '[ticket-replies] outbound mail failed non-fatally', deliveryReason);
    }

    const deliveryStatus = delivered ? 'delivered' : 'saved_locally';
    await updateDocDirect(`tickets/${ticketId}/messages`, messageRecord.id, {
      deliveryStatus,
      deliveryReason: deliveryReason || null,
      mailFrom: mailFrom || null,
      domainVerified: typeof domainVerified === 'boolean' ? domainVerified : null,
      deliveredAt: delivered ? new Date().toISOString() : null,
    });

    return res.status(200).json({
      success: true,
      savedToDb: true,
      delivered,
      deliveryStatus,
      deliveryReason: deliveryReason || null,
      mailFrom: mailFrom || null,
      domainVerified: typeof domainVerified === 'boolean' ? domainVerified : null,
      message: {
        id: messageRecord.id,
        ticketId,
        senderId: data.senderId || req.user!.id,
        senderType: data.senderType,
        senderName: data.senderName || req.user!.email || 'Agent',
        content: data.content,
        originalContent: data.originalContent || null,
        deliveryStatus,
        createdAt: now,
      },
    });
  } catch (e: any) {
    safeLog('error', '[ticket-replies] failed to persist reply', e?.message || e);
    return res.status(500).json({ error: 'Failed to save reply to the database.' });
  }
});

export default router;
