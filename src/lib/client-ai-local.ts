/**
 * Shared client-side helper for calling OpenAI-compatible local models (Ollama).
 *
 * Extracts the copy-pasted `/chat/completions` blocks that previously lived in
 * aiAccountService, neuralLinkService and legalService into one place. This
 * module is browser-safe: it uses `fetch` and reads `process.env` defensively
 * (guarded by `typeof process`), so it never crashes in the browser bundle.
 */

export interface LocalModelCallOptions {
  /** Pre-resolved OpenAI-compatible base URL (already normalized to end with `/v1`). */
  endpoint?: string;
  modelName?: string;
  /** Optional system prompt override; a sensible default is applied when omitted. */
  systemPrompt?: string;
  /** When true, request `response_format: { type: "json_object" }` from the model. */
  jsonMode?: boolean;
  /** Extra user-message suffix appended to `prompt`. */
  userPromptSuffix?: string;
  /** Bearer token; defaults to "ollama". */
  apiKey?: string;
}

/** Resolve the OpenAI-compatible base URL from module config or OLLAMA_ENDPOINT. */
export function resolveLocalEndpoint(localEndpoint?: string): string {
  const explicit = localEndpoint?.trim();
  if (explicit) return normalizeV1Endpoint(explicit);
  if (typeof process !== 'undefined' && process.env.OLLAMA_ENDPOINT) {
    return normalizeV1Endpoint(process.env.OLLAMA_ENDPOINT);
  }
  return '';
}

function normalizeV1Endpoint(raw: string): string {
  const trimmed = raw.replace(/\/$/, '');
  return trimmed.endsWith('/v1') ? trimmed : `${trimmed}/v1`;
}

/** Resolve the local model name from a legacy AI config. */
export function resolveLocalModelName(config: {
  sentimentModel?: string;
  customSentimentModelName?: string;
}): string {
  if (config.sentimentModel === 'custom-local') return config.customSentimentModelName || 'gemma';
  return config.sentimentModel === 'local-gemma' ? 'gemma' : 'llama3';
}

/**
 * Call an OpenAI-compatible local `/chat/completions` endpoint.
 * Throws if no endpoint is configured. Returns the trimmed assistant text.
 */
export async function callLocalModel(
  prompt: string,
  options: LocalModelCallOptions = {},
): Promise<string> {
  const endpoint = resolveLocalEndpoint(options.endpoint);
  if (!endpoint) {
    throw new Error('Local AI endpoint is not configured (set OLLAMA_ENDPOINT or module AI localEndpoint).');
  }

  const response = await fetch(`${endpoint}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${options.apiKey || 'ollama'}`,
    },
    body: JSON.stringify({
      model: options.modelName || 'llama3',
      messages: [
        {
          role: 'system',
          content: options.systemPrompt || 'You are a helpful professional assistant.',
        },
        { role: 'user', content: prompt + (options.userPromptSuffix ?? '') },
      ],
      ...(options.jsonMode ? { response_format: { type: 'json_object' } } : {}),
    }),
  });

  const rdata = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = rdata.choices?.[0]?.message?.content ?? '';
  return content.trim();
}
