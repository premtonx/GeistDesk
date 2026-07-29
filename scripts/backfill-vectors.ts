/**
 * Idempotent backfill: embed all published KB articles + resolved/closed tickets.
 *
 *   DATABASE_URL=... npm run vectors:backfill
 */

import 'dotenv/config';
import { initDb, getDocsDirect, queryDb } from '../src/lib/postgres-backend.js';
import {
  drainVectorQueue,
  enqueueKbArticleIndex,
  enqueueResolvedTicketIndex,
} from '../src/lib/ai/vector-queue.js';

const BATCH = Number(process.env.VECTOR_BACKFILL_BATCH || 25);

async function alreadyIndexed(sourceType: string, sourceId: string): Promise<boolean> {
  const res = await queryDb(
    `SELECT 1 FROM "KnowledgeEmbedding"
     WHERE tenant_id = 'default'
       AND source_type = $1::"KnowledgeSourceType"
       AND source_id = $2
     LIMIT 1`,
    [sourceType, sourceId],
  );
  return (res.rowCount || 0) > 0;
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL || process.env.PG_DATABASE_URL;
  if (!databaseUrl) {
    console.error('[vectors:backfill] DATABASE_URL is required');
    process.exit(1);
  }

  console.log('[vectors:backfill] Initializing DB…');
  await initDb();

  const force = process.argv.includes('--force');
  const articles = await getDocsDirect('kb_articles', []);
  const tickets = await getDocsDirect('tickets', []);

  const published = articles.filter((a: any) => {
    const status = String(a.status || '').toLowerCase();
    return (
      status === 'published' ||
      status === 'public' ||
      a.visibility === 'Public' ||
      !status
    );
  });

  const resolved = tickets.filter((t: any) => {
    const status = String(t.status || '').toLowerCase();
    return status === 'resolved' || status === 'closed';
  });

  console.log(
    `[vectors:backfill] candidates: ${published.length} KB articles, ${resolved.length} resolved tickets (force=${force})`,
  );

  let enqueued = 0;
  let skipped = 0;

  for (let i = 0; i < published.length; i += BATCH) {
    const batch = published.slice(i, i + BATCH);
    for (const article of batch) {
      if (!force && (await alreadyIndexed('KB_ARTICLE', article.id))) {
        skipped += 1;
        continue;
      }
      enqueueKbArticleIndex(article.id);
      enqueued += 1;
    }
    await drainVectorQueue();
    console.log(`[vectors:backfill] KB progress ${Math.min(i + BATCH, published.length)}/${published.length}`);
  }

  for (let i = 0; i < resolved.length; i += BATCH) {
    const batch = resolved.slice(i, i + BATCH);
    for (const ticket of batch) {
      if (!force && (await alreadyIndexed('RESOLVED_TICKET', ticket.id))) {
        skipped += 1;
        continue;
      }
      enqueueResolvedTicketIndex(ticket.id);
      enqueued += 1;
    }
    await drainVectorQueue();
    console.log(
      `[vectors:backfill] ticket progress ${Math.min(i + BATCH, resolved.length)}/${resolved.length}`,
    );
  }

  await drainVectorQueue();
  console.log(`[vectors:backfill] done. enqueued=${enqueued} skipped=${skipped}`);
  process.exit(0);
}

main().catch((err: unknown) => {
  console.error('[vectors:backfill] failed:', err instanceof Error ? err.message : err);
  process.exit(1);
});
