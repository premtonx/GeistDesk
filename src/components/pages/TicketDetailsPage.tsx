/**
 * Ticket Details spam / block controls.
 *
 * The full ticket detail chrome currently lives inside TicketsPage (route
 * `/tickets/:ticketId`). This module owns the "Als Spam markieren" action
 * surface used by that detail header.
 */

import { useMemo, useState } from 'react';
import { Ban } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from '../../lib/context/I18nContext';
import { Button } from '../ui/button';
import { MarkAsSpamDialog } from '../ticket-details/MarkAsSpamDialog';
import { ticketService } from '../../services/ticketService';
import type { Ticket } from '../../types';

export function resolveTicketSenderEmail(
  ticket: Ticket | (Ticket & Record<string, unknown>) | null | undefined,
  contactEmail?: string | null,
): string {
  if (!ticket) return '';
  const raw = ticket as Ticket & {
    from_email?: string;
    customerEmail?: string;
    requesterEmail?: string;
  };
  const candidates = [
    contactEmail,
    raw.from_email,
    raw.customerEmail,
    raw.requesterEmail,
    typeof raw.customerId === 'string' && raw.customerId.includes('@') ? raw.customerId : '',
  ];
  for (const value of candidates) {
    if (!value || typeof value !== 'string') continue;
    const trimmed = value.trim();
    const angle = trimmed.match(/<([^>]+)>/);
    const email = (angle?.[1] || trimmed).trim().toLowerCase();
    if (email.includes('@')) return email;
  }
  return '';
}

interface TicketDetailsSpamActionProps {
  ticket: Ticket;
  contactEmail?: string | null;
  /** Called after a successful spam mark so the parent can update local state / navigate. */
  onMarked?: (result: { status: 'spam'; blocked_value: string }) => void;
  /** Layout-only: keep the dialog mounted while hiding the full-width header button. */
  hideTrigger?: boolean;
}

/**
 * High-visibility "Als Spam markieren" control for the ticket details header.
 */
export function TicketDetailsSpamAction({
  ticket,
  contactEmail,
  onMarked,
  hideTrigger,
}: TicketDetailsSpamActionProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const senderEmail = useMemo(
    () => resolveTicketSenderEmail(ticket, contactEmail),
    [ticket, contactEmail],
  );

  if (ticket.status === 'spam') {
    if (hideTrigger) return null;
    return (
      <span className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg bg-rose-50 text-rose-700 border border-rose-200 text-[11px] font-extrabold select-none">
        <Ban className="w-3.5 h-3.5" />
        {t('tickets.spam.alreadyMarked', 'Spam')}
      </span>
    );
  }

  const handleConfirm = async () => {
    if (!senderEmail) {
      toast.error(
        t(
          'tickets.spam.noEmail',
          'Kein Absender gefunden — Ticket kann nicht blockiert werden.',
        ),
      );
      return;
    }
    setIsSubmitting(true);
    try {
      const result = await ticketService.markAsSpam(ticket.id);
      toast.success(
        t(
          'tickets.spam.success',
          'Ticket als Spam markiert. Absender {{email}} wurde blockiert.',
        ).replace('{{email}}', result.blocked_value),
      );
      setOpen(false);
      onMarked?.({ status: 'spam', blocked_value: result.blocked_value });
    } catch (err: any) {
      toast.error(
        err?.message ||
          t('tickets.spam.failed', 'Spam-Markierung fehlgeschlagen.'),
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <Button
        id="ticket-header-spam-trigger"
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className={
          hideTrigger
            ? 'hidden'
            : 'h-9 px-3 rounded-lg border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold transition-all gap-1.5 shadow-xs'
        }
        aria-label={t('tickets.spam.button', 'Als Spam markieren')}
      >
        <span aria-hidden>🚫</span>
        <span>{t('tickets.spam.button', 'Als Spam markieren')}</span>
      </Button>

      <MarkAsSpamDialog
        open={open}
        onOpenChange={setOpen}
        senderEmail={senderEmail}
        isSubmitting={isSubmitting}
        onConfirm={handleConfirm}
      />
    </>
  );
}

/** Default export: spam action used by the ticket details header. */
export default TicketDetailsSpamAction;
