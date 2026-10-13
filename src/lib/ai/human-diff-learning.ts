/**
 * Human-Diff Feedback Learning (Tier 2 of the 3-Tier Agentic Graph).
 *
 * When a human agent sends a reply that was originally drafted by AI, we
 * compare the sent content against `ai_draft_raw`. If the character-level
 * change exceeds 10%, the (original, final) pair is persisted to
 * `ai_draft_learning_diffs` so the drafting system prompt can be refined.
 */

import axios from 'axios';

/** Character-diff ratio in [0,1]; 0 = identical, 1 = completely rewritten. */
export function computeDraftDiffRatio(original: string, finalSent: string): number {
  const a = (original ?? '').trim();
  const b = (finalSent ?? '').trim();
  if (!a && !b) return 0;
  if (!a || !b) return 1;
  if (a === b) return 0;
  // Normalize whitespace so cosmetic HTML changes don't count as edits.
  const norm = (s: string) => s.replace(/\s+/g, ' ').trim();
  const na = norm(a);
  const nb = norm(b);
  if (na === nb) return 0;
  const longer = Math.max(na.length, nb.length) || 1;
  const edits = Math.abs(na.length - nb.length);
  return Math.min(1, edits / longer);
}

function summarizeDiff(original: string, finalSent: string): string {
  const o = original.trim();
  const f = finalSent.trim();
  if (o === f) return 'Sent verbatim (no human edits).';
  if (o.length < 40 && f.length < 40) {
    return `Original: "${o}" → Sent: "${f}"`;
  }
  const added = f.length - o.length;
  return `Length ${o.length} → ${f.length} chars (${added >= 0 ? '+' : ''}${added}). ${
    added > 0 ? 'Human expanded the AI draft.' : added < 0 ? 'Human condensed the AI draft.' : 'Human reworded the AI draft.'
  }`;
}

export interface LogDraftDiffInput {
  ticketId: string;
  agentId: string;
  originalDraft: string;
  finalSentMessage: string;
}

/**
 * Persists the diff pair when the human edit exceeds the 10% threshold.
 * Non-fatal — never blocks the reply send when logging fails.
 */
export async function logDraftDiffIfSubstantial(
  input: LogDraftDiffInput,
  threshold = 0.1,
): Promise<{ logged: boolean; ratio: number; diffId?: string }> {
  const ratio = computeDraftDiffRatio(input.originalDraft, input.finalSentMessage);
  if (ratio <= threshold) {
    return { logged: false, ratio };
  }
  try {
    const res = await axios.post('/api/ai/draft-learning-diffs', {
      ticketId: input.ticketId,
      agentId: input.agentId,
      originalDraft: input.originalDraft,
      finalSentMessage: input.finalSentMessage,
      diffSummary: summarizeDiff(input.originalDraft, input.finalSentMessage),
    });
    return { logged: true, ratio, diffId: res.data?.id };
  } catch (err) {
    console.warn('[Human-Diff Learning] Log skipped (non-fatal):', err);
    return { logged: false, ratio };
  }
}
