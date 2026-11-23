import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/authMiddleware.js';
import { attachClientOrganizationContext } from '../middleware/clientPortalMiddleware.js';
import { addDocDirect, getDocDirect, updateDocDirect } from '../lib/postgres-backend.js';
import { routeParam } from '../lib/route-params.js';
import { trySendTicketReplyEmail } from '../lib/outbound-mail.js';
import { findChannelForOutbound, listEmailChannels } from '../lib/email-ingestion/channel-store.js';
import { formatReplyRecipientLabel, resolveComposerFromAddress } from '../lib/ticket-reply-address.js';
import { safeLog } from '../lib/safe-log.js';
import { isClientPortalRole } from '../lib/client-portal/roles.js';
import {
  clientCanMutateTicket,
  resolveOrganizationIdFromUser,
} from '../lib/client-portal/ticket-visibility.js';

const router = Router();

/**
 * GET /api/tickets/:id/composer-addresses
 * Von:/An: for the reply composer. Uses the ticket mailbox's channel
 * forwardingAddress (or support email), then MAIL_FROM_ADDRESS.
 */
router.get('/:id/composer-addresses', authenticate, attachClientOrganizationContext, async (req: Request, res: Response): Promise<any> => {
  const ticketId = routeParam(req.params.id);
  try {
    const ticket = await getDocDirect('tickets', ticketId);
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found.' });
    }
    if (isClientPortalRole(req.user?.role)) {
      const canView = await clientCanMutateTicket(
        {
          id: String(req.user!.id),
          role: String(req.user!.role),
          organizationId: resolveOrganizationIdFromUser(req.user!),
        },
        { ...ticket, id: ticketId },
      );
      if (!canView) return res.status(404).json({ error: 'Ticket not found.' });
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
router.post('/:id/replies', authenticate, attachClientOrganizationContext, async (req: Request, res: Response): Promise<any> => {
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

    const isClient = isClientPortalRole(req.user?.role);
    if (isClient) {
      const canReply = await clientCanMutateTicket(
        {
          id: String(req.user!.id),
          role: String(req.user!.role),
          organizationId: resolveOrganizationIdFromUser(req.user!),
        },
        { ...ticket, id: ticketId },
      );
      if (!canReply) return res.status(404).json({ error: 'Ticket not found.' });
    }

    const now = new Date().toISOString();
    const data = parsed.data;
    const messageRecord = await addDocDirect(`tickets/${ticketId}/messages`, {
      ticketId,
      senderId: isClient ? req.user!.id : data.senderId || req.user!.id,
      senderType: isClient ? 'customer' : data.senderType,
      senderName: data.senderName || req.user!.email || 'Agent',
      content: data.content,
      originalContent: data.originalContent || null,
      deliveryStatus: 'pending',
      is_internal: false,
      isInternal: false,
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
      const ticketOrgId =
        (typeof ticket.organizationId === 'string' && ticket.organizationId) ||
        (typeof ticket.organization_id === 'string' && ticket.organization_id) ||
        null;
      const channel = await findChannelForOutbound({
        mailbox: ticket.mailbox || ticket.forwardingAddress || null,
        supportEmail: ticket.supportEmail || ticket.channelEmail || null,
        organizationId: ticketOrgId,
      });
      const mailResult = await trySendTicketReplyEmail({
        ticketId,
        to: ticket.customerEmail || ticket.contactEmail || null,
        subject: ticket.subject ? `Re: ${ticket.subject}` : `Re: Ticket ${ticketId}`,
        body: data.content,
        agentName: data.senderName || req.user!.email || 'Agent',
        channel,
        organizationId: ticketOrgId,
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
