import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Company, Contact, Ticket as TicketType } from '../types';
import { CustomField, schemaService } from '../services/schemaService';
import { ticketService } from '../services/ticketService';
import { customerService } from '../services/customerService';
import {
  buildTicketDeepDivePrompt,
  buildTicketMessagesText,
  parseTicketAnalysisOutput,
  ticketAnalysisPatch,
} from '../lib/ticket-ai-analysis';
import {
  executeTicketDeepDiveAnalysis,
  resolveLifecycleOutput,
} from '../lib/aiLifecycleClient';
import type { Message } from '../types';

/**
 * Owns the per-ticket data lifecycle for the Tickets detail view:
 *  - contact schema (loaded once)
 *  - company/contact lookups for the selected ticket
 *  - AI deep-dive summary generation (with the ref-based trigger pattern so the
 *    trigger effect never re-subscribes to a fresh closure)
 *  - presence heartbeat cleanup when the selected ticket changes
 */
export function useTicketDetailData(options: {
  selectedTicketId: string | null;
  selectedTicket: TicketType | null;
  messages: Message[];
  setAiSummary: (summary: string) => void;
  setIsAiDrafting: (drafting: boolean) => void;
  setTicketCompany: (company: Company | null) => void;
  setTicketContact: (contact: Contact | null) => void;
  setAllTickets: React.Dispatch<React.SetStateAction<TicketType[]>>;
}) {
  const {
    selectedTicketId,
    selectedTicket,
    messages,
    setAiSummary,
    setIsAiDrafting,
    setTicketCompany,
    setTicketContact,
    setAllTickets,
  } = options;

  const [contactSchema, setContactSchema] = useState<CustomField[]>([]);

  useEffect(() => {
    schemaService.getContactSchema().then(setContactSchema);
  }, []);

  useEffect(() => {
    if (selectedTicket?.companyId) {
      customerService.getCompany(selectedTicket.companyId).then(setTicketCompany);
    } else {
      setTicketCompany(null);
    }
    if (selectedTicket?.contactId) {
      customerService.getContact(selectedTicket.contactId).then(setTicketContact);
    } else {
      setTicketContact(null);
    }
  }, [selectedTicket?.companyId, selectedTicket?.contactId, setTicketCompany, setTicketContact]);

  const updateSummary = useCallback(
    async (forceRefresh = false) => {
      if (!selectedTicketId || !selectedTicket) return;

      if (!forceRefresh && selectedTicket.aiSummary) {
        setAiSummary(selectedTicket.aiSummary);
        return;
      }

      try {
        setIsAiDrafting(true);
        const messagesText = buildTicketMessagesText(messages);
        const prompt = buildTicketDeepDivePrompt(selectedTicket, messagesText);
        const lifecycleResult = await executeTicketDeepDiveAnalysis(selectedTicketId, prompt, {
          forceRefresh,
        });

        if (lifecycleResult.status === 'pending_approval') {
          toast.info('AI analysis requires approval before it can be delivered.');
          return;
        }
        if (lifecycleResult.status === 'pending_review') {
          toast.info('AI analysis is queued for human review.');
        }

        const rawOutput = resolveLifecycleOutput(lifecycleResult);
        const analysis = parseTicketAnalysisOutput(rawOutput, selectedTicket);
        if (!analysis.aiSummary.trim()) {
          setAiSummary('Unable to generate summary. Check AI configuration.');
          return;
        }
        setAiSummary(analysis.aiSummary);

        const patch = ticketAnalysisPatch(analysis);
        await ticketService.updateTicket(selectedTicketId, patch);
        setAllTickets((prev) =>
          prev.map((t) => (t.id === selectedTicketId ? { ...t, ...patch } : t)),
        );
      } catch (e) {
        console.error('Failed to load/generate AI summary via lifecycle cache pipeline:', e);
        setAiSummary('Unable to generate summary. Check AI configuration.');
      } finally {
        setIsAiDrafting(false);
      }
    },
    [selectedTicketId, selectedTicket, messages, setAiSummary, setIsAiDrafting, setAllTickets],
  );

  // Kept in a ref so the summary trigger never re-subscribes to a fresh closure;
  // it always calls the latest render's updateSummary.
  const updateSummaryRef = useRef(updateSummary);
  useEffect(() => {
    updateSummaryRef.current = updateSummary;
  }, [updateSummary]);

  useEffect(() => {
    if (!selectedTicketId) return;
    // New conversation content (a fresh inbound mail or a new reply) is the
    // only user-intent signal that warrants re-running the deep-dive summary.
    void updateSummaryRef.current();
  }, [selectedTicketId, messages.length]);

  useEffect(() => {
    return () => {
      if (selectedTicketId) {
        ticketService.setPresence(selectedTicketId, false);
      }
    };
  }, [selectedTicketId]);

  return { contactSchema, updateSummary };
}
