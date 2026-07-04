import crypto from 'crypto';
import {
  MODULE_FOR_FEATURE,
  type AiExecutionContext,
  type AiFeatureId,
  type AiModuleId,
} from '../types/aiOrchestrator.js';

export interface AiEntityRef {
  collection: string;
  entityId: string;
  module: AiModuleId;
}

export interface AiCachedResponse {
  output: string;
  confidence: number;
  assignedModel: string;
  cachedAt: string;
  promptFingerprint: string;
}

const MODULE_COLLECTION: Record<AiModuleId, string> = {
  tickets: 'tickets',
  kb: 'kb_articles',
  vault: 'vault_credentials',
  exchange: 'exchange_items',
};

/** Legacy top-level JSONB fields mirrored for backward-compatible reads. */
const LEGACY_FIELD_BY_FEATURE: Partial<Record<AiFeatureId, string>> = {
  ticket_summarization: 'aiSummary',
  smart_reply: 'aiSuggestedDraft',
  sentiment_analysis: 'aiSentiment',
  kb_generation: 'aiGeneratedContent',
  vault_insights: 'aiInsights',
};

const inMemoryCache = new Map<string, AiCachedResponse>();

export function shouldBypassAiCache(ctx: AiExecutionContext): boolean {
  return ctx.forceRefresh === true || ctx.skipCache === true;
}

export function fingerprintPrompt(prompt: string): string {
  return crypto.createHash('sha256').update(prompt.trim()).digest('hex').slice(0, 24);
}

export function resolveAiEntityRef(ctx: AiExecutionContext): AiEntityRef | null {
  const module = MODULE_FOR_FEATURE[ctx.feature];
  const meta = ctx.metadata ?? {};
  const collection = MODULE_COLLECTION[module];

  let entityId: string | undefined;
  if (module === 'tickets') {
    entityId = ctx.ticketId ?? (meta.ticketId as string | undefined);
  } else if (module === 'kb') {
    entityId = (meta.kbArticleId ?? meta.articleId ?? meta.entityId) as string | undefined;
  } else if (module === 'vault') {
    entityId = (meta.credentialId ?? meta.vaultAssetId ?? meta.entityId) as string | undefined;
  } else if (module === 'exchange') {
    entityId = (meta.exchangeId ?? meta.secretId ?? meta.entityId) as string | undefined;
  }

  if (!entityId?.trim()) return null;
  return { collection, entityId: String(entityId).trim(), module };
}

function cacheKey(ref: AiEntityRef, feature: AiFeatureId): string {
  return `${ref.collection}:${ref.entityId}:${feature}`;
}

function extractCachedFromDoc(doc: Record<string, unknown>, feature: AiFeatureId): AiCachedResponse | null {
  const bucket = doc.aiPayloadCache as Record<string, AiCachedResponse> | undefined;
  const entry = bucket?.[feature];
  if (entry?.output?.trim()) {
    return entry;
  }

  const legacyField = LEGACY_FIELD_BY_FEATURE[feature];
  const legacyValue = legacyField ? doc[legacyField] : undefined;
  if (typeof legacyValue === 'string' && legacyValue.trim()) {
    return {
      output: legacyValue,
      confidence: 0.9,
      assignedModel: 'legacy-field-cache',
      cachedAt:
        typeof doc.aiCacheUpdatedAt === 'string'
          ? doc.aiCacheUpdatedAt
          : new Date(0).toISOString(),
      promptFingerprint: '',
    };
  }

  return null;
}

function isFingerprintCompatible(cached: AiCachedResponse, promptFingerprint: string): boolean {
  if (!cached.promptFingerprint || !promptFingerprint) return true;
  return cached.promptFingerprint === promptFingerprint;
}

export async function lookupAiResponseCache(
  ctx: AiExecutionContext,
  promptFingerprint: string,
  skipPersistence?: boolean,
): Promise<AiCachedResponse | null> {
  const ref = resolveAiEntityRef(ctx);
  if (!ref) return null;

  const memKey = cacheKey(ref, ctx.feature);
  const memoryHit = inMemoryCache.get(memKey);
  if (memoryHit && isFingerprintCompatible(memoryHit, promptFingerprint)) {
    return memoryHit;
  }

  if (skipPersistence) return null;

  try {
    const { getDocDirect } = await import('./postgres-backend.js');
    const doc = await getDocDirect(ref.collection, ref.entityId);
    if (!doc) return null;

    const cached = extractCachedFromDoc(doc as Record<string, unknown>, ctx.feature);
    if (!cached || !isFingerprintCompatible(cached, promptFingerprint)) {
      return null;
    }

    inMemoryCache.set(memKey, cached);
    return cached;
  } catch {
    return null;
  }
}

export async function persistAiResponseCache(
  ctx: AiExecutionContext,
  payload: {
    output: string;
    confidence: number;
    assignedModel: string;
    promptFingerprint: string;
  },
  options: { skipPersistence?: boolean; skipWriteForVip?: boolean } = {},
): Promise<void> {
  if (options.skipWriteForVip) return;

  const ref = resolveAiEntityRef(ctx);
  if (!ref) return;

  const entry: AiCachedResponse = {
    ...payload,
    cachedAt: new Date().toISOString(),
  };

  const memKey = cacheKey(ref, ctx.feature);
  inMemoryCache.set(memKey, entry);

  if (options.skipPersistence) return;

  try {
    const { getDocDirect, updateDocDirect } = await import('./postgres-backend.js');
    const existing = ((await getDocDirect(ref.collection, ref.entityId)) ?? {}) as Record<string, unknown>;
    const priorBucket =
      typeof existing.aiPayloadCache === 'object' && existing.aiPayloadCache !== null
        ? (existing.aiPayloadCache as Record<string, AiCachedResponse>)
        : {};

    const patch: Record<string, unknown> = {
      aiPayloadCache: {
        ...priorBucket,
        [ctx.feature]: entry,
      },
      aiCacheUpdatedAt: entry.cachedAt,
    };

    const legacyField = LEGACY_FIELD_BY_FEATURE[ctx.feature];
    if (
      legacyField &&
      ctx.feature !== 'ticket_summarization' &&
      ctx.feature !== 'vault_insights' &&
      ctx.feature !== 'kb_generation'
    ) {
      patch[legacyField] = entry.output;
    }

    await updateDocDirect(ref.collection, ref.entityId, patch);
  } catch (err) {
    console.warn('[AI Cache] JSONB persist failed — in-memory cache retained:', err);
  }
}

/** Test helper — clears ephemeral in-process cache entries. */
export function resetInMemoryAiCache(): void {
  inMemoryCache.clear();
}
