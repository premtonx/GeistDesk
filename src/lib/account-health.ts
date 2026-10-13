import { Ticket } from '../types';

export type AccountHealthStatus = 'good' | 'bad' | 'at_risk';

const GOOD_VALUES = new Set(['good', 'healthy', 'positive', 'ok', 'gut', 'gesund']);
const BAD_VALUES = new Set(['bad', 'poor', 'critical', 'unhealthy', 'schlecht', 'kritisch', 'angry']);
const AT_RISK_VALUES = new Set([
  'at_risk',
  'at risk',
  'risk',
  'gefährdet',
  'gefaehrdet',
  'neutral',
  'warning',
  'caution',
]);

export function normalizeAccountHealth(value?: string | null): AccountHealthStatus | null {
  if (!value) return null;
  const normalized = value.toLowerCase().trim();
  if (GOOD_VALUES.has(normalized)) return 'good';
  if (BAD_VALUES.has(normalized)) return 'bad';
  if (AT_RISK_VALUES.has(normalized)) return 'at_risk';
  return null;
}

export function accountHealthFromAiSentiment(aiSentiment?: string | null): AccountHealthStatus | null {
  const sentiment = (aiSentiment || '').toLowerCase().trim();
  if (sentiment === 'angry' || sentiment === 'negative') return 'bad';
  if (sentiment === 'positive' || sentiment === 'happy') return 'good';
  if (sentiment === 'neutral') return 'at_risk';
  return null;
}

export interface AccountHealthContext {
  openTicketsCount?: number;
  companyHealthScore?: number;
}

export function deriveAccountHealth(
  ticket: Pick<
    Ticket,
    'accountHealth' | 'sentiment' | 'aiSentiment' | 'priority' | 'isHelpRequested'
  >,
  context: AccountHealthContext = {},
): AccountHealthStatus {
  const stored = normalizeAccountHealth(ticket.accountHealth);
  if (stored) return stored;

  const fromAi = accountHealthFromAiSentiment(ticket.aiSentiment);
  if (fromAi) return fromAi;

  if (ticket.isHelpRequested || ticket.priority === 'urgent') return 'bad';
  if (ticket.sentiment === 'angry') return 'bad';
  if (ticket.sentiment === 'positive') return 'good';

  const openCount = context.openTicketsCount ?? 0;
  if (openCount > 3) return 'at_risk';

  if (typeof context.companyHealthScore === 'number') {
    if (context.companyHealthScore < 50) return 'bad';
    if (context.companyHealthScore < 80) return 'at_risk';
    return 'good';
  }

  return 'good';
}

export function accountHealthIsPositive(status: AccountHealthStatus): boolean {
  return status === 'good';
}
