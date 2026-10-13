import type { KBArticleAlert, KBArticleInfrastructureTrust } from '../types';

export const DEFAULT_KB_ALERTS: KBArticleAlert[] = [
  {
    type: 'warning',
    title: 'Warning',
    body: 'Rotating Azure AD client secrets requires a maintenance window and coordinated SSO re-authentication across integrated nodes.',
  },
  {
    type: 'info',
    title: 'Information',
    body: 'Enterprise tenants should map GeistDesk roles to Azure AD security groups before enabling automated provisioning.',
  },
  {
    type: 'success',
    title: 'Success',
    body: 'SSO validation passed for all production identity providers in the last compliance sweep.',
  },
  {
    type: 'critical',
    title: 'Critical',
    body: 'Disabling MFA enforcement on federated accounts will immediately downgrade the article trust score and trigger a security review.',
  },
];

export function resolveArticleAlerts(alerts?: KBArticleAlert[]): KBArticleAlert[] {
  if (Array.isArray(alerts) && alerts.length > 0) {
    return alerts;
  }
  return [];
}

export function resolveInfrastructureTrust(
  article: {
    infrastructureTrust?: KBArticleInfrastructureTrust;
    trustScore?: number;
  },
  trustScoreFallback?: number,
): KBArticleInfrastructureTrust {
  const score = article.infrastructureTrust?.trustScore ?? article.trustScore ?? trustScoreFallback ?? 0;
  return {
    reviewed: article.infrastructureTrust?.reviewed ?? score >= 75,
    technicallyVerified: article.infrastructureTrust?.technicallyVerified ?? score >= 80,
    trustScore: score,
    hallucinationRisk: article.infrastructureTrust?.hallucinationRisk ?? (score >= 85 ? 'Low' : 'Medium'),
    coverage: article.infrastructureTrust?.coverage ?? `${Math.min(99, Math.max(60, score))}%`,
    freshness: article.infrastructureTrust?.freshness ?? `${Math.min(99, Math.max(50, score - 2))}%`,
  };
}

export function parseSummaryBullets(aiSummary?: string | null): string[] {
  if (!aiSummary?.trim()) return [];
  return aiSummary
    .split('\n')
    .map((line) => line.replace(/^[\s•\-*]+/, '').trim())
    .filter(Boolean);
}

export function formatArticleDate(value: unknown): string {
  if (!value) return '—';
  try {
    if (typeof value === 'string') {
      return new Date(value).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
    }
    if (typeof value === 'object' && value !== null && 'toDate' in value) {
      const date = (value as { toDate?: () => Date }).toDate?.();
      return date
        ? date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
        : '—';
    }
    if (value instanceof Date) {
      return value.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
    }
  } catch {
    return '—';
  }
  return '—';
}
