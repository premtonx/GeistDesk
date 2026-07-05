import axios from 'axios';
import type { AiExecutionContext, AiExecutionResult } from '../types/aiOrchestrator';

export async function executeViaLifecycle(ctx: AiExecutionContext): Promise<AiExecutionResult> {
  const res = await axios.post<AiExecutionResult>('/api/ai/execute', {
    workspaceId: 'default',
    ...ctx,
  });
  return res.data;
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
