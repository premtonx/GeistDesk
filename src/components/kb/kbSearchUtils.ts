const QUESTION_WORD_PATTERN =
  /\b(how|what|why|when|where|who|which|can|could|would|should|is|are|do|does|did|wird|wie|was|warum|wann|wo|wer|welche|kann|können|müssen|gibt|help|hilfe)\b/i;

/** True when the query is long enough and reads like a natural-language question. */
export function isQuestionLikeQuery(query: string): boolean {
  const trimmed = query.trim();
  if (trimmed.length <= 15) return false;
  if (trimmed.endsWith('?')) return true;
  return QUESTION_WORD_PATTERN.test(trimmed);
}

/** Truncate RAG snippets before sending to cloud models (data minimization). */
export function truncateRagSnippet(text: string, maxLen = 600): string {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (normalized.length <= maxLen) return normalized;
  return `${normalized.slice(0, maxLen)}…`;
}
