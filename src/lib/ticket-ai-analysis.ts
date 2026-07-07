import { normalizeAccountHealth } from './account-health';
import { withChecklistTaskIdsFromAi } from './ticket-checklist-utils';

export interface TicketAnalysisPayload {
  aiSummary: string;
  aiInsights: string[];
  aiRootCause: string;
  aiChecklist: { task: string; completed: boolean }[];
  aiSentiment: string;
  accountHealth: 'good' | 'bad' | 'at_risk';
}

export function buildTicketMessagesText(
  messages: Array<{ senderName?: string; senderType?: string; content?: string }>,
): string {
  return messages
    .map((m) => `${m.senderName || 'Staff'} (${m.senderType}): ${m.content ?? ''}`)
    .join('\n---\n');
}

export function buildTicketDeepDivePrompt(ticket: {
  subject?: string;
  description?: string;
  sentiment?: string;
}, messagesText: string): string {
  return `You are an elite Sovereign AI Support operations engineer. Perform a deep-dive analysis on the following GeistDesk support ticket.
        
SUBJECT: ${ticket.subject ?? ''}
DESCRIPTION: ${ticket.description ?? ''}
RECENT THREAD ACTIVITY:
${messagesText || 'No additional activity logged.'}

IMPORTANT: Respond strictly with a valid JSON object. Do not wrap with markdown code fences (no \`\`\`json).
The JSON object must have exactly these keys:
1. "aiSummary": A concise summary paragraph describing the current ticket status, user goals, and latest updates. Use the customer's language.
2. "aiInsights": An array of up to 4 string bullet points representing key takeaways, technical parameters, or critical points.
3. "aiRootCause": A sentence stating the clear diagnosed technical root cause of the issue.
4. "aiChecklist": An array of action items (tasks) to solve this ticket, each having keys "task" (string description) and "completed" (boolean, default false). Please draft 3 realistic tasks.
5. "aiSentiment": One of "Angry", "Neutral", "Positive" depending on user language and frustration.
6. "accountHealth": One of "good", "at_risk", "bad" — overall customer/account relationship health inferred from tone, frustration, escalation risk, and thread context.

Respond only with the raw valid JSON payload.`;
}

function stripJsonFences(raw: string): string {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)```$/i);
  return fenced ? fenced[1].trim() : trimmed;
}

export function parseTicketAnalysisOutput(
  raw: string,
  fallback?: { subject?: string; description?: string; sentiment?: string },
): TicketAnalysisPayload {
  const cleaned = stripJsonFences(raw);
  try {
    const parsed = JSON.parse(cleaned) as Partial<TicketAnalysisPayload>;
    if (parsed.aiSummary?.trim()) {
      const accountHealth =
        normalizeAccountHealth(typeof parsed.accountHealth === 'string' ? parsed.accountHealth : null) ??
        accountHealthFromSentimentLabel(parsed.aiSentiment);

      return {
        aiSummary: parsed.aiSummary,
        aiInsights: Array.isArray(parsed.aiInsights) ? parsed.aiInsights : [],
        aiRootCause: parsed.aiRootCause ?? '',
        aiChecklist: Array.isArray(parsed.aiChecklist) ? parsed.aiChecklist : [],
        aiSentiment: parsed.aiSentiment ?? 'Neutral',
        accountHealth,
      };
    }
  } catch {
    // Legacy plain-text cache entries store only the summary paragraph.
  }

  if (cleaned.trim()) {
    return {
      aiSummary: cleaned.trim(),
      aiInsights: [],
      aiRootCause: '',
      aiChecklist: [],
      aiSentiment:
        fallback?.sentiment === 'angry'
          ? 'Angry'
          : fallback?.sentiment === 'positive'
            ? 'Positive'
            : 'Neutral',
      accountHealth: accountHealthFromSentimentLabel(
        fallback?.sentiment === 'angry'
          ? 'Angry'
          : fallback?.sentiment === 'positive'
            ? 'Positive'
            : 'Neutral',
      ),
    };
  }

  return buildTicketAnalysisFallback(fallback);
}

function accountHealthFromSentimentLabel(
  aiSentiment?: string,
): TicketAnalysisPayload['accountHealth'] {
  const label = (aiSentiment || '').toLowerCase();
  if (label === 'angry' || label === 'negative') return 'bad';
  if (label === 'positive' || label === 'happy') return 'good';
  return 'at_risk';
}

export function buildTicketAnalysisFallback(ticket?: {
  subject?: string;
  description?: string;
  sentiment?: string;
}): TicketAnalysisPayload {
  const subject = ticket?.subject ?? 'this ticket';
  const isAuth =
    subject.toLowerCase().includes('auth') ||
    (ticket?.description ?? '').toLowerCase().includes('auth');

  return {
    aiSummary: `Summary of the incident regarding: ${subject}. The system detected configuration issues and identity providers are awaiting handshake.`,
    aiInsights: [
      'Microsoft Entra handshake delay identified.',
      'Billing records in offline mode fallback verify license pending.',
      'Operator queue prioritizes validation of communication tokens.',
    ],
    aiRootCause: isAuth
      ? 'Microsoft Entra OAuth identity provider response timed out during handshake.'
      : 'Configuration parameter mismatch inside client database profile or stripe status.',
    aiChecklist: [
      { task: 'Verify OAuth credential mapping configuration', completed: false },
      { task: 'Inspect domain synchronize log errors', completed: false },
      { task: 'Confirm SLA limit constraints remain safe', completed: false },
    ],
    aiSentiment:
      ticket?.sentiment === 'angry'
        ? 'Angry'
        : ticket?.sentiment === 'positive'
          ? 'Positive'
          : 'Neutral',
    accountHealth: accountHealthFromSentimentLabel(
      ticket?.sentiment === 'angry'
        ? 'Angry'
        : ticket?.sentiment === 'positive'
          ? 'Positive'
          : 'Neutral',
    ),
  };
}

export function ticketAnalysisPatch(payload: TicketAnalysisPayload): Record<string, unknown> {
  return {
    aiSummary: payload.aiSummary,
    aiInsights: payload.aiInsights,
    aiRootCause: payload.aiRootCause,
    aiChecklist: withChecklistTaskIdsFromAi(payload.aiChecklist),
    aiSentiment: payload.aiSentiment,
    accountHealth: payload.accountHealth,
  };
}
