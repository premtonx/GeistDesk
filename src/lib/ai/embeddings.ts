/**
 * Multi-provider embeddings for GeistDesk RAG (KnowledgeEmbedding vector(1536)).
 *
 * Supported (aligned with KI orchestrator / Admin secrets):
 *   - openai          → OpenAI text-embedding-3-small (orchestrator secret `openai` or OPENAI_API_KEY)
 *   - azure_openai    → Azure OpenAI embeddings deployment (secret `azure_openai` or AZURE_OPENAI_*)
 *   - google          → Gemini text-embedding-004 (secret `google` or GEMINI_API_KEY)
 *   - ollama          → Ollama native /api/embeddings
 *   - openai_compat   → Local OpenAI-compatible gateways (LM Studio / vLLM / custom) /v1/embeddings
 *
 * Anthropic/Claude has no embedding API — skipped automatically; next provider is tried.
 */

import OpenAI from 'openai';
import { GoogleGenAI } from '@google/genai';
import { getOllamaEndpoint } from '../runtime-env.js';
import { getOrchestratorConfig, getProviderSecret } from '../ai-orchestrator-store.js';

export const EMBEDDING_DIMENSIONS = 1536;

export type EmbeddingProviderKind =
  | 'openai'
  | 'azure_openai'
  | 'google'
  | 'ollama'
  | 'openai_compat'
  | 'none';

export interface ResolvedEmbeddingProvider {
  kind: EmbeddingProviderKind;
  model: string;
  label: string;
}

type ProviderCandidate = {
  kind: Exclude<EmbeddingProviderKind, 'none'>;
  model: string;
  label: string;
  available: () => Promise<boolean>;
  embed: (texts: string[]) => Promise<number[][]>;
};

function padOrTrim(vector: number[], dims = EMBEDDING_DIMENSIONS): number[] {
  if (vector.length === dims) return vector;
  if (vector.length > dims) return vector.slice(0, dims);
  return vector.concat(new Array(dims - vector.length).fill(0));
}

function normalizeLocalBase(raw: string): string {
  const trimmed = raw.replace(/\/$/, '');
  if (!trimmed) return '';
  return trimmed.replace(/\/v1$/i, '');
}

async function readOpenAiKey(workspaceId: string): Promise<string> {
  return (
    (await getProviderSecret('openai', workspaceId)) ||
    (process.env.OPENAI_API_KEY || '').trim() ||
    ''
  );
}

async function readAzureKey(workspaceId: string): Promise<string> {
  return (
    (await getProviderSecret('azure_openai', workspaceId)) ||
    (process.env.AZURE_OPENAI_API_KEY || '').trim() ||
    ''
  );
}

async function readGoogleKey(workspaceId: string): Promise<string> {
  return (
    (await getProviderSecret('google', workspaceId)) ||
    (process.env.GEMINI_API_KEY || '').trim() ||
    ''
  );
}

async function readLocalKey(workspaceId: string): Promise<string> {
  return (
    (await getProviderSecret('local', workspaceId)) ||
    (process.env.OLLAMA_API_KEY || '').trim() ||
    ''
  );
}

async function resolveLocalEndpoint(workspaceId: string): Promise<string> {
  try {
    const cfg = await getOrchestratorConfig(workspaceId);
    if (cfg.endpointUrl?.trim()) return normalizeLocalBase(cfg.endpointUrl.trim());
  } catch {
    /* config table may be unavailable during early boot */
  }
  return normalizeLocalBase(getOllamaEndpoint() || process.env.OLLAMA_ENDPOINT || '');
}

function azureEndpoint(): string {
  return (process.env.AZURE_OPENAI_ENDPOINT || '').trim().replace(/\/$/, '');
}

function azureEmbeddingDeployment(model: string): string {
  return (
    (process.env.AZURE_OPENAI_EMBEDDING_DEPLOYMENT || '').trim() ||
    (process.env.AZURE_OPENAI_DEPLOYMENT_NAME || '').trim() ||
    (process.env.AZURE_OPENAI_DEPLOYMENT || '').trim() ||
    model ||
    'text-embedding-3-small'
  );
}

function azureApiVersion(): string {
  return (process.env.AZURE_OPENAI_API_VERSION || '2024-06-01').trim();
}

async function embedWithOpenAI(
  texts: string[],
  model: string,
  apiKey: string,
): Promise<number[][]> {
  const client = new OpenAI({ apiKey });
  const res = await client.embeddings.create({
    model,
    input: texts,
    dimensions: EMBEDDING_DIMENSIONS,
  });
  return res.data
    .sort((a, b) => a.index - b.index)
    .map((row) => padOrTrim(row.embedding));
}

async function embedWithAzureOpenAI(
  texts: string[],
  model: string,
  apiKey: string,
): Promise<number[][]> {
  const endpoint = azureEndpoint();
  if (!endpoint) throw new Error('AZURE_OPENAI_ENDPOINT is required for Azure embeddings');
  const deployment = azureEmbeddingDeployment(model);
  const url = `${endpoint}/openai/deployments/${encodeURIComponent(deployment)}/embeddings?api-version=${encodeURIComponent(azureApiVersion())}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-key': apiKey,
    },
    body: JSON.stringify({
      input: texts,
      // Azure text-embedding-3-* supports dimensions when the deployment allows it.
      dimensions: EMBEDDING_DIMENSIONS,
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`Azure OpenAI embeddings failed (${res.status}): ${detail.slice(0, 240)}`);
  }
  const data = (await res.json()) as {
    data?: Array<{ embedding?: number[]; index?: number }>;
  };
  const rows = [...(data.data || [])].sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
  if (rows.length === 0) throw new Error('Azure OpenAI embeddings returned no vectors');
  return rows.map((row) => padOrTrim(row.embedding || []));
}

async function embedWithGoogle(texts: string[], model: string, apiKey: string): Promise<number[][]> {
  const ai = new GoogleGenAI({ apiKey });
  const out: number[][] = [];
  for (const text of texts) {
    const result = await ai.models.embedContent({
      model,
      contents: text,
      config: {
        // Prefer 1536 when the model supports outputDimensionality; otherwise padOrTrim.
        outputDimensionality: EMBEDDING_DIMENSIONS,
        taskType: 'RETRIEVAL_DOCUMENT',
      },
    });
    const values =
      (result as any).embeddings?.[0]?.values ||
      (result as any).embedding?.values ||
      (result as any).embeddings?.[0]?.value ||
      null;
    if (!Array.isArray(values)) {
      throw new Error('Gemini embedContent response missing embedding values');
    }
    out.push(padOrTrim(values));
  }
  return out;
}

async function embedWithOllama(texts: string[], model: string, baseUrl: string): Promise<number[][]> {
  const base = normalizeLocalBase(baseUrl) || 'http://127.0.0.1:11434';
  const out: number[][] = [];
  for (const text of texts) {
    const res = await fetch(`${base}/api/embeddings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, prompt: text }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new Error(`Ollama embeddings failed (${res.status}): ${detail.slice(0, 200)}`);
    }
    const json = (await res.json()) as { embedding?: number[] };
    if (!Array.isArray(json.embedding)) {
      throw new Error('Ollama embeddings response missing embedding array');
    }
    out.push(padOrTrim(json.embedding));
  }
  return out;
}

async function embedWithOpenAICompat(
  texts: string[],
  model: string,
  baseUrl: string,
  apiKey?: string,
): Promise<number[][]> {
  const base = normalizeLocalBase(baseUrl);
  if (!base) throw new Error('Local OpenAI-compatible endpoint is not configured');
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

  const res = await fetch(`${base}/v1/embeddings`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ model, input: texts }),
  });
  if (!res.ok) {
    // Some gateways expose /embeddings without /v1
    if (res.status === 404) {
      const retry = await fetch(`${base}/embeddings`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ model, input: texts }),
      });
      if (!retry.ok) {
        const detail = await retry.text().catch(() => '');
        throw new Error(`OpenAI-compat embeddings failed (${retry.status}): ${detail.slice(0, 200)}`);
      }
      const data = (await retry.json()) as { data?: Array<{ embedding?: number[]; index?: number }> };
      return [...(data.data || [])]
        .sort((a, b) => (a.index ?? 0) - (b.index ?? 0))
        .map((row) => padOrTrim(row.embedding || []));
    }
    const detail = await res.text().catch(() => '');
    throw new Error(`OpenAI-compat embeddings failed (${res.status}): ${detail.slice(0, 200)}`);
  }
  const data = (await res.json()) as { data?: Array<{ embedding?: number[]; index?: number }> };
  const rows = [...(data.data || [])].sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
  if (rows.length === 0) throw new Error('OpenAI-compat embeddings returned no vectors');
  return rows.map((row) => padOrTrim(row.embedding || []));
}

/** Map chat model ids / force flags onto embedding backends. */
function mapChatModelToEmbeddingKind(modelId: string): EmbeddingProviderKind | 'skip' {
  const id = modelId.toLowerCase();
  if (id.includes('claude') || id === 'anthropic') return 'skip';
  if (id.includes('gemini') || id === 'google') return 'google';
  if (id.includes('azure')) return 'azure_openai';
  if (id.includes('gpt') || id === 'openai') return 'openai';
  if (id.includes('local') || id.includes('llama') || id.includes('ollama') || id.includes('qwen')) {
    return 'ollama';
  }
  return 'skip';
}

async function buildCandidates(workspaceId: string): Promise<ProviderCandidate[]> {
  const force = (process.env.EMBEDDING_PROVIDER || '').trim().toLowerCase();
  const explicitModel = (process.env.EMBEDDING_MODEL || '').trim();

  const openaiModel = explicitModel || 'text-embedding-3-small';
  const azureModel = explicitModel || 'text-embedding-3-small';
  const googleModel = explicitModel || 'text-embedding-004';
  const ollamaModel = explicitModel || 'nomic-embed-text';
  const compatModel = explicitModel || ollamaModel;

  const localEndpoint = await resolveLocalEndpoint(workspaceId);

  const all: ProviderCandidate[] = [
    {
      kind: 'openai',
      model: openaiModel,
      label: 'OpenAI',
      available: async () => Boolean(await readOpenAiKey(workspaceId)),
      embed: async (texts) => embedWithOpenAI(texts, openaiModel, await readOpenAiKey(workspaceId)),
    },
    {
      kind: 'azure_openai',
      model: azureModel,
      label: 'Azure OpenAI',
      available: async () => Boolean((await readAzureKey(workspaceId)) && azureEndpoint()),
      embed: async (texts) =>
        embedWithAzureOpenAI(texts, azureModel, await readAzureKey(workspaceId)),
    },
    {
      kind: 'google',
      model: googleModel,
      label: 'Google Gemini',
      available: async () => Boolean(await readGoogleKey(workspaceId)),
      embed: async (texts) => embedWithGoogle(texts, googleModel, await readGoogleKey(workspaceId)),
    },
    {
      kind: 'ollama',
      model: ollamaModel,
      label: 'Ollama',
      available: async () => Boolean(localEndpoint),
      embed: async (texts) => embedWithOllama(texts, ollamaModel, localEndpoint),
    },
    {
      kind: 'openai_compat',
      model: compatModel,
      label: 'OpenAI-compatible local gateway',
      available: async () => Boolean(localEndpoint),
      embed: async (texts) =>
        embedWithOpenAICompat(texts, compatModel, localEndpoint, (await readLocalKey(workspaceId)) || undefined),
    },
  ];

  if (force) {
    if (force === 'anthropic' || force === 'claude') {
      return [];
    }
    const mapped =
      force === 'gemini' || force === 'google'
        ? 'google'
        : force === 'azure' || force === 'azure_openai'
          ? 'azure_openai'
          : force === 'local' || force === 'lmstudio' || force === 'vllm'
            ? 'openai_compat'
            : (force as EmbeddingProviderKind);
    return all.filter((c) => c.kind === mapped);
  }

  // Prefer order derived from orchestrator providerPriority (skip Claude).
  const orderedKinds: EmbeddingProviderKind[] = [];
  try {
    const cfg = await getOrchestratorConfig(workspaceId);
    for (const modelId of cfg.providerPriority || []) {
      const kind = mapChatModelToEmbeddingKind(String(modelId));
      if (kind !== 'skip' && !orderedKinds.includes(kind)) orderedKinds.push(kind);
    }
  } catch {
    /* ignore */
  }

  // Sensible defaults if priority empty / unavailable
  for (const kind of [
    'openai',
    'azure_openai',
    'google',
    'ollama',
    'openai_compat',
  ] as const satisfies ReadonlyArray<Exclude<EmbeddingProviderKind, 'none'>>) {
    if (!orderedKinds.includes(kind)) orderedKinds.push(kind);
  }

  const byKind = new Map(all.map((c) => [c.kind, c] as const));
  const ordered: ProviderCandidate[] = [];
  for (const kind of orderedKinds) {
    if (kind === 'none') continue;
    const candidate = byKind.get(kind);
    if (candidate) ordered.push(candidate);
  }
  return ordered;
}

/** Resolve which embedding backend will be used (first available in priority order). */
export async function resolveEmbeddingProvider(
  workspaceId = 'default',
): Promise<ResolvedEmbeddingProvider> {
  const candidates = await buildCandidates(workspaceId);
  for (const candidate of candidates) {
    if (await candidate.available()) {
      return { kind: candidate.kind, model: candidate.model, label: candidate.label };
    }
  }
  return { kind: 'none', model: '', label: 'none' };
}

/** List embedding backends and whether credentials/endpoints are present. */
export async function listEmbeddingProviderStatus(workspaceId = 'default'): Promise<
  Array<{ kind: EmbeddingProviderKind; label: string; model: string; available: boolean }>
> {
  const candidates = await buildCandidates(workspaceId);
  const seen = new Set<string>();
  const out: Array<{ kind: EmbeddingProviderKind; label: string; model: string; available: boolean }> =
    [];
  for (const c of candidates) {
    if (seen.has(c.kind)) continue;
    seen.add(c.kind);
    out.push({
      kind: c.kind,
      label: c.label,
      model: c.model,
      available: await c.available(),
    });
  }
  return out;
}

/**
 * Embed one or more texts → 1536-dim vectors.
 * Tries providers in orchestrator priority order (or EMBEDDING_PROVIDER),
 * automatically falling through when a backend is unavailable.
 */
export async function embedTexts(
  texts: string[],
  opts?: { workspaceId?: string },
): Promise<number[][]> {
  const filtered = texts.map((t) => t.trim()).filter(Boolean);
  if (filtered.length === 0) return [];

  const workspaceId = opts?.workspaceId || 'default';
  const candidates = await buildCandidates(workspaceId);
  const errors: string[] = [];

  for (const candidate of candidates) {
    if (!(await candidate.available())) continue;
    try {
      return await candidate.embed(filtered);
    } catch (err: any) {
      const message = err instanceof Error ? err.message : String(err);
      errors.push(`${candidate.label}: ${message}`);
      console.warn(`[embeddings] ${candidate.label} failed — trying next provider:`, message);
    }
  }

  const force = (process.env.EMBEDDING_PROVIDER || '').trim().toLowerCase();
  if (force === 'anthropic' || force === 'claude') {
    throw new Error(
      'Anthropic/Claude does not provide an embeddings API. Configure OpenAI, Azure OpenAI, Gemini, or a local Ollama/OpenAI-compatible endpoint for RAG.',
    );
  }

  throw new Error(
    `No embedding provider succeeded. Configure one of: OpenAI, Azure OpenAI, Gemini (GEMINI_API_KEY), or local Ollama/OpenAI-compat endpoint. Details: ${errors.join(' | ') || 'no credentials found'}`,
  );
}

export function vectorToSqlLiteral(vector: number[]): string {
  return `[${vector.map((n) => Number(n).toFixed(8)).join(',')}]`;
}
