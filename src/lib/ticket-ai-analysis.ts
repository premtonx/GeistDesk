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

/** Demo sentences previously injected when the model was offline. Never show or persist these. */
const PLACEHOLDER_DIAGNOSIS = [
  'conditional access blocked oidc callback',
  'conditional access hat den oidc-callback blockiert',
  'configuration parameter mismatch inside client database profile or stripe status.',
  'konfigurationsparameter stimmen nicht mit dem kunden-datenbankprofil oder stripe-status überein.',
  'microsoft entra oauth identity provider response timed out during handshake.',
  'microsoft entra handshake delay identified.',
  'billing records in offline mode fallback verify license pending.',
  'operator queue prioritizes validation of communication tokens.',
];

export function isPlaceholderAiDiagnosis(value: unknown): boolean {
  const text = String(value || '').trim().replace(/^["']|["']$/g, '').toLowerCase();
  if (!text) return true;
  if (text.startsWith('summary of the incident regarding:')) return true;
  if (text.includes('identity providers are awaiting handshake')) return true;
  return PLACEHOLDER_DIAGNOSIS.includes(text);
}

function accountHealthFromSentimentLabel(
  aiSentiment?: string,
): TicketAnalysisPayload['accountHealth'] {
  const label = (aiSentiment || '').toLowerCase();
  if (label === 'angry' || label === 'negative') return 'bad';
  if (label === 'positive' || label === 'happy') return 'good';
  return 'at_risk';
}

export function emptyTicketAnalysis(ticket?: {
  sentiment?: string;
}): TicketAnalysisPayload {
  return {
    aiSummary: '',
    aiInsights: [],
    aiRootCause: '',
    aiChecklist: [],
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
      const rootCause = String(parsed.aiRootCause || '').trim();

      return {
        aiSummary: parsed.aiSummary,
        aiInsights: Array.isArray(parsed.aiInsights)
          ? parsed.aiInsights.filter((line) => !isPlaceholderAiDiagnosis(line))
          : [],
        aiRootCause: isPlaceholderAiDiagnosis(rootCause) ? '' : rootCause,
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

  return emptyTicketAnalysis(fallback);
}

export function ticketAnalysisPatch(payload: TicketAnalysisPayload): Record<string, unknown> {
  const rootCause = String(payload.aiRootCause || '').trim();
  return {
    aiSummary: payload.aiSummary,
    aiInsights: payload.aiInsights,
    aiRootCause: rootCause && !isPlaceholderAiDiagnosis(rootCause) ? rootCause : null,
    aiChecklist: withChecklistTaskIdsFromAi(payload.aiChecklist),
    aiSentiment: payload.aiSentiment,
    accountHealth: payload.accountHealth,
  };
}
