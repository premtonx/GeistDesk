/**
 * Removes leftover GeistKB placeholder categories that older API boots
 * auto-inserted (Getting Started, Billing, …) when the collection was empty.
 * Categories that already have articles are left untouched.
 */

export const PLACEHOLDER_KB_CATEGORY_IDS = [
  'getting-started',
  'billing',
  'api-documentation',
  'integrations',
  'troubleshooting',
  'internal-sops',
] as const;

const PLACEHOLDER_KB_CATEGORY_SQL = `
  DELETE FROM geistdesk_documents AS cats
   WHERE cats.collection = 'kb_categories'
     AND cats.id = ANY($1::text[])
     AND NOT EXISTS (
       SELECT 1
         FROM geistdesk_documents AS arts
        WHERE arts.collection = 'kb_articles'
          AND (
            arts.data->>'category' = cats.id
            OR arts.data->>'category' = cats.data->>'name'
          )
     )
`;

export async function purgePlaceholderKbCategories(
  exec: (sql: string, params?: unknown[]) => Promise<{ rowCount?: number | null }>,
): Promise<number> {
  const result = await exec(PLACEHOLDER_KB_CATEGORY_SQL, [PLACEHOLDER_KB_CATEGORY_IDS]);
  return result.rowCount || 0;
}

/** Frontend-only seed article ids that should never persist in production. */
export const FRONTEND_SEED_KB_ARTICLE_IDS = [
  'seed-1',
  'seed-2',
  'seed-3',
  'seed-4',
  'seed-5',
  'seed-6',
  'seed-7',
  'seed-8',
] as const;

const FRONTEND_SEED_KB_ARTICLE_SQL = `
  DELETE FROM geistdesk_documents
   WHERE collection = 'kb_articles'
     AND id = ANY($1::text[])
`;

export async function purgeFrontendSeedKbArticles(
  exec: (sql: string, params?: unknown[]) => Promise<{ rowCount?: number | null }>,
): Promise<number> {
  const result = await exec(FRONTEND_SEED_KB_ARTICLE_SQL, [FRONTEND_SEED_KB_ARTICLE_IDS]);
  return result.rowCount || 0;
}

const KB_COVERAGE_CACHE_SQL = `
  DELETE FROM geistdesk_documents
   WHERE collection = 'kb_coverage'
`;

export async function purgeKbCoverageCache(
  exec: (sql: string, params?: unknown[]) => Promise<{ rowCount?: number | null }>,
): Promise<number> {
  const result = await exec(KB_COVERAGE_CACHE_SQL);
  return result.rowCount || 0;
}

const DEMO_AUTOPILOT_SUGGESTION_TITLES = [
  'Disaster Recovery Guide & regional failovers',
  'SAML SSO Setup & AD Integration playbook',
  'API Gateway Rate Limits Policy',
] as const;

const DEMO_AUTOPILOT_SQL = `
  DELETE FROM geistdesk_documents
   WHERE collection = 'autopilot_suggestions'
     AND data->>'title' = ANY($1::text[])
`;

const DEMO_AUTOPILOT_METRICS_SQL = `
  DELETE FROM geistdesk_documents
   WHERE collection = 'autopilot_metrics'
     AND id = 'autopilot_global_metrics'
`;

export async function purgeDemoAutopilotFixtures(
  exec: (sql: string, params?: unknown[]) => Promise<{ rowCount?: number | null }>,
): Promise<number> {
  const suggestions = await exec(DEMO_AUTOPILOT_SQL, [DEMO_AUTOPILOT_SUGGESTION_TITLES]);
  const metrics = await exec(DEMO_AUTOPILOT_METRICS_SQL);
  return (suggestions.rowCount || 0) + (metrics.rowCount || 0);
}
