import type { AiFeatureId } from '../types/ai-orchestrator';

export interface ClientAiExecuteOptions {
  feature: AiFeatureId;
  prompt: string;
  workspaceId?: string;
  ticketId?: string;
  metadata?: Record<string, unknown>;
}

export interface ClientAiExecuteResult {
  output: string;
  status: string;
  error?: string;
}

/** Run AI prompts through the authenticated server lifecycle — never expose API keys client-side. */
export async function executeClientAiPrompt(options: ClientAiExecuteOptions): Promise<ClientAiExecuteResult> {
  const res = await fetch('/api/ai/execute', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({
      feature: options.feature,
      prompt: options.prompt,
      workspaceId: options.workspaceId ?? 'default',
      ticketId: options.ticketId,
      metadata: options.metadata,
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || data.details || `AI request failed (${res.status})`);
  }

  if (data.status === 'blocked' || data.status === 'failed') {
    throw new Error(data.error || `AI request ${data.status}`);
  }
  if (data.status === 'pending_approval') {
    throw new Error('AI generation requires approval before it can be delivered.');
  }
  if (!data.output?.trim()) {
    throw new Error('AI execution returned empty output.');
  }

  return {
    output: String(data.output),
    status: String(data.status || 'completed'),
    error: data.error,
  };
}
