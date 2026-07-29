/**
 * Server-side KB article helpers with vector index hooks.
 * Browser CRUD remains in src/services/kbService.ts (Firebase shim → /api/db),
 * which also triggers indexing via the /api/db mutation hook.
 */

import {
  addDocDirect,
  deleteDocDirect,
  getDocDirect,
  updateDocDirect,
} from './postgres-backend.js';
import {
  enqueueDeleteEmbeddings,
  enqueueKbArticleIndex,
} from './ai/vector-queue.js';

const KB_COLLECTION = 'kb_articles';

export async function createKbArticle(
  article: Record<string, unknown>,
  tenantId = 'default',
): Promise<string> {
  const created = await addDocDirect(KB_COLLECTION, {
    ...article,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  enqueueKbArticleIndex(created.id, tenantId);
  return created.id as string;
}

export async function updateKbArticle(
  id: string,
  updates: Record<string, unknown>,
  tenantId = 'default',
): Promise<void> {
  await updateDocDirect(KB_COLLECTION, id, {
    ...updates,
    updatedAt: new Date().toISOString(),
  });
  enqueueKbArticleIndex(id, tenantId);
}

export async function deleteKbArticle(id: string, tenantId = 'default'): Promise<void> {
  await deleteDocDirect(KB_COLLECTION, id);
  enqueueDeleteEmbeddings(id, 'KB_ARTICLE', tenantId);
}

export async function getKbArticle(id: string) {
  return getDocDirect(KB_COLLECTION, id);
}
