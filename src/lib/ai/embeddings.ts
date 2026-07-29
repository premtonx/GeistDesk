/**
 * Embedding provider — OpenAI text-embedding-3-small (1536) or Ollama-compatible /api/embeddings.
 */

import OpenAI from 'openai';
import { getOllamaEndpoint } from '../runtime-env.js';

export const EMBEDDING_DIMENSIONS = 1536;

export type EmbeddingProviderKind = 'openai' | 'ollama' | 'none';

export function resolveEmbeddingProvider(): {
  kind: EmbeddingProviderKind;
  model: string;
} {
  const openaiKey = (process.env.OPENAI_API_KEY || process.env.AZURE_OPENAI_API_KEY || '').trim();
  const force = (process.env.EMBEDDING_PROVIDER || '').trim().toLowerCase();
  const model =
    (process.env.EMBEDDING_MODEL || '').trim() ||
    (force === 'ollama' ? 'nomic-embed-text' : 'text-embedding-3-small');

  if (force === 'ollama' || (!openaiKey && getOllamaEndpoint())) {
    return { kind: getOllamaEndpoint() || process.env.OLLAMA_ENDPOINT ? 'ollama' : 'none', model };
  }
  if (openaiKey || force === 'openai') {
    return { kind: openaiKey ? 'openai' : 'none', model: model || 'text-embedding-3-small' };
  }
  return { kind: 'none', model };
}

function padOrTrim(vector: number[], dims = EMBEDDING_DIMENSIONS): number[] {
  if (vector.length === dims) return vector;
  if (vector.length > dims) return vector.slice(0, dims);
  return vector.concat(new Array(dims - vector.length).fill(0));
}

async function embedWithOpenAI(texts: string[], model: string): Promise<number[][]> {
  const apiKey = (process.env.OPENAI_API_KEY || '').trim();
  if (!apiKey) throw new Error('OPENAI_API_KEY is required for OpenAI embeddings');
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

async function embedWithOllama(texts: string[], model: string): Promise<number[][]> {
  const base =
    getOllamaEndpoint().replace(/\/v1\/?$/, '') ||
    (process.env.OLLAMA_ENDPOINT || '').replace(/\/v1\/?$/, '').replace(/\/$/, '') ||
    'http://127.0.0.1:11434';

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

/** Embed one or more texts; returns 1536-dim vectors. */
export async function embedTexts(texts: string[]): Promise<number[][]> {
  const filtered = texts.map((t) => t.trim()).filter(Boolean);
  if (filtered.length === 0) return [];

  const { kind, model } = resolveEmbeddingProvider();
  if (kind === 'none') {
    throw new Error(
      'No embedding provider configured. Set OPENAI_API_KEY or OLLAMA_ENDPOINT / EMBEDDING_PROVIDER=ollama.',
    );
  }
  if (kind === 'openai') return embedWithOpenAI(filtered, model);
  return embedWithOllama(filtered, model);
}

export function vectorToSqlLiteral(vector: number[]): string {
  return `[${vector.map((n) => Number(n).toFixed(8)).join(',')}]`;
}
