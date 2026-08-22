import { GoogleGenAI } from '@google/genai';
import { LOCAL_PROVIDER_IDS, type AiFeatureId } from '../types/aiOrchestrator.js';
import type { AiModelExecutor } from './ai-request-lifecycle.js';
import { getOrchestratorConfig, getProviderSecret } from './ai-orchestrator-store.js';

const RUNTIME_MODELS: Record<string, { kind: 'google' | 'openai' | 'anthropic' | 'local'; model: string }> = {
  'gemini-flash': { kind: 'google', model: 'gemini-2.5-flash' },
  'gemini-pro': { kind: 'google', model: 'gemini-2.5-pro' },
  'gpt-5': { kind: 'openai', model: 'gpt-4o' },
  claude: { kind: 'anthropic', model: 'claude-3-5-sonnet-20241022' },
  'local-llama': { kind: 'local', model: 'llama3' },
  local: { kind: 'local', model: 'llama3' },
  'qwen-36b': { kind: 'local', model: 'qwen:36b' },
};

function estimateConfidence(output: string, feature: AiFeatureId): number {
  if (!output.trim()) return 0.42;
  try {
    JSON.parse(output);
    return feature === 'root_cause_analysis' ? 0.9 : 0.88;
  } catch {
    /* plain text */
  }
  const len = output.trim().length;
  if (len > 600) return 0.86;
  if (len > 120) return 0.9;
  return 0.78;
}

function estimateCost(promptTokens: number, completionTokens: number, model: string): number {
  const isLocal = LOCAL_PROVIDER_IDS.has(model);
  if (isLocal) return 0.0001;
  return promptTokens * 0.0000015 + completionTokens * 0.000006;
}

async function callGoogle(apiKey: string, model: string, prompt: string): Promise<{ output: string; promptTokens: number; completionTokens: number }> {
  const ai = new GoogleGenAI({ apiKey });
  const result = await ai.models.generateContent({
    model,
    contents: prompt,
    config: { responseMimeType: prompt.includes('JSON') || prompt.includes('json') ? 'application/json' : undefined },
  });
  const output = result.text ?? '';
  const promptTokens = Math.ceil(prompt.length / 4);
  const completionTokens = Math.ceil(output.length / 4);
  return { output, promptTokens, completionTokens };
}

async function callOpenAI(apiKey: string, model: string, prompt: string): Promise<{ output: string; promptTokens: number; completionTokens: number }> {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: prompt }],
      response_format: prompt.toLowerCase().includes('json') ? { type: 'json_object' } : undefined,
    }),
  });
  if (!res.ok) throw new Error(`OpenAI HTTP ${res.status}`);
  const data = await res.json();
  const output = String(data.choices?.[0]?.message?.content ?? '');
  return {
    output,
    promptTokens: Number(data.usage?.prompt_tokens ?? Math.ceil(prompt.length / 4)),
    completionTokens: Number(data.usage?.completion_tokens ?? Math.ceil(output.length / 4)),
  };
}

async function callAnthropic(apiKey: string, model: string, prompt: string): Promise<{ output: string; promptTokens: number; completionTokens: number }> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model,
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  if (!res.ok) throw new Error(`Anthropic HTTP ${res.status}`);
  const data = await res.json();
  const output = String(data.content?.[0]?.text ?? '');
  return {
    output,
    promptTokens: Number(data.usage?.input_tokens ?? Math.ceil(prompt.length / 4)),
    completionTokens: Number(data.usage?.output_tokens ?? Math.ceil(output.length / 4)),
  };
}

async function callLocal(endpointUrl: string, apiKey: string | null, model: string, prompt: string): Promise<{ output: string; promptTokens: number; completionTokens: number }> {
  const base = endpointUrl.endsWith('/v1') ? endpointUrl : `${endpointUrl.replace(/\/$/, '')}/v1`;
  const res = await fetch(`${base}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: prompt }],
      response_format: prompt.toLowerCase().includes('json') ? { type: 'json_object' } : undefined,
    }),
  });
  if (!res.ok) throw new Error(`Local LLM HTTP ${res.status}`);
  const data = await res.json();
  const output = String(data.choices?.[0]?.message?.content ?? '');
  return {
    output,
    promptTokens: Math.ceil(prompt.length / 4),
    completionTokens: Math.ceil(output.length / 4),
  };
}

/** Production model executor — routes to live Google/OpenAI/Anthropic/local endpoints. */
export function createProductionModelExecutor(workspaceId = 'default'): AiModelExecutor {
  return async ({ model, prompt, feature }) => {
    const config = await getOrchestratorConfig(workspaceId);
    const resolved = RUNTIME_MODELS[model] ?? (LOCAL_PROVIDER_IDS.has(model)
      ? { kind: 'local' as const, model: 'llama3' }
      : { kind: 'google' as const, model: 'gemini-2.5-flash' });

    let result: { output: string; promptTokens: number; completionTokens: number };

    if (resolved.kind === 'google') {
      const apiKey = (await getProviderSecret('google', workspaceId)) || process.env.GEMINI_API_KEY || '';
      if (!apiKey) throw new Error('Google Gemini API key not configured');
      result = await callGoogle(apiKey, resolved.model, prompt);
    } else if (resolved.kind === 'openai') {
      const apiKey = await getProviderSecret('openai', workspaceId);
      if (!apiKey) throw new Error('OpenAI API key not configured');
      result = await callOpenAI(apiKey, resolved.model, prompt);
    } else if (resolved.kind === 'anthropic') {
      const apiKey = await getProviderSecret('anthropic', workspaceId);
      if (!apiKey) throw new Error('Anthropic API key not configured');
      result = await callAnthropic(apiKey, resolved.model, prompt);
    } else {
      const localKey = await getProviderSecret('local', workspaceId);
      result = await callLocal(config.endpointUrl, localKey, resolved.model, prompt);
    }

    return {
      output: result.output,
      confidence: estimateConfidence(result.output, feature),
      costUsd: estimateCost(result.promptTokens, result.completionTokens, model),
      promptTokens: result.promptTokens,
      completionTokens: result.completionTokens,
    };
  };
}
