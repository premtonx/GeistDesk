import axios from 'axios';
import type { AiExecutionContext, AiExecutionResult, AiOperatorLanguage } from '../types/ai-orchestrator';

export function resolveOperatorLanguage(): AiOperatorLanguage {
  if (typeof localStorage !== 'undefined') {
    const lang = localStorage.getItem('lang');
    if (lang === 'de' || lang === 'en') return lang;
  }
  return 'de';
}

export async function executeViaLifecycle(ctx: AiExecutionContext): Promise<AiExecutionResult> {
  const res = await axios.post<AiExecutionResult>('/api/ai/execute', {
    workspaceId: 'default',
    operatorLanguage: ctx.operatorLanguage ?? resolveOperatorLanguage(),
    ...ctx,
  });
  return res.data;
}

/** Ticket deep-dive analysis via unified lifecycle cache (entity JSONB + aiPayloadCache). */
export async function executeTicketDeepDiveAnalysis(
  ticketId: string,
  prompt: string,
  options: { forceRefresh?: boolean } = {},
): Promise<AiExecutionResult> {
  return executeViaLifecycle({
    feature: 'ticket_summarization',
    prompt,
    ticketId,
    forceRefresh: options.forceRefresh,
    skipCache: options.forceRefresh,
  });
}

/** Returns model output or throws when lifecycle blocks the request. */
export function resolveLifecycleOutput(result: AiExecutionResult): string {
  if (result.status === 'blocked') {
    throw new Error(result.error ?? 'AI request blocked by enterprise policy.');
  }
  if (result.status === 'pending_approval') {
    throw new Error('AI generation requires manager/engineer approval before it can be delivered.');
  }
  if (result.status === 'failed') {
    throw new Error(result.error ?? 'AI execution failed.');
  }
  if (!result.output?.trim()) {
    throw new Error('AI execution returned empty output.');
  }
  return result.output;
}
