/**
 * Plain-text cleanup + token-approximate chunking for RAG embeddings.
 * Target: ~500 tokens per chunk with ~50-token overlap (≈4 chars/token heuristic).
 */

const CHARS_PER_TOKEN = 4;
export const CHUNK_TOKENS = 500;
export const CHUNK_OVERLAP_TOKENS = 50;

export function stripHtmlToPlainText(input: string): string {
  if (!input) return '';
  let text = String(input);
  // Remove scripts/styles first
  text = text.replace(/<script[\s\S]*?<\/script>/gi, ' ');
  text = text.replace(/<style[\s\S]*?<\/style>/gi, ' ');
  text = text.replace(/<\/(p|div|h[1-6]|li|br|tr)>/gi, '\n');
  text = text.replace(/<[^>]+>/g, ' ');
  // Markdown-ish cleanup
  text = text.replace(/```[\s\S]*?```/g, ' ');
  text = text.replace(/`[^`]+`/g, ' ');
  text = text.replace(/!\[[^\]]*\]\([^)]+\)/g, ' ');
  text = text.replace(/\[[^\]]*\]\([^)]+\)/g, ' ');
  text = text.replace(/[#>*_~]+/g, ' ');
  text = text
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#39;/gi, "'")
    .replace(/&quot;/gi, '"');
  text = text.replace(/\s+/g, ' ').trim();
  return text;
}

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

/** Split plain text into overlapping chunks (~500 tokens, 50 overlap). */
export function chunkText(
  text: string,
  opts?: { chunkTokens?: number; overlapTokens?: number },
): string[] {
  const cleaned = stripHtmlToPlainText(text);
  if (!cleaned) return [];

  const chunkTokens = opts?.chunkTokens ?? CHUNK_TOKENS;
  const overlapTokens = opts?.overlapTokens ?? CHUNK_OVERLAP_TOKENS;
  const chunkChars = chunkTokens * CHARS_PER_TOKEN;
  const overlapChars = overlapTokens * CHARS_PER_TOKEN;
  const step = Math.max(chunkChars - overlapChars, 1);

  if (cleaned.length <= chunkChars) return [cleaned];

  const chunks: string[] = [];
  for (let start = 0; start < cleaned.length; start += step) {
    let end = Math.min(start + chunkChars, cleaned.length);
    // Prefer breaking on sentence/word boundaries
    if (end < cleaned.length) {
      const window = cleaned.slice(start, end);
      const sentenceBreak = Math.max(window.lastIndexOf('. '), window.lastIndexOf('\n'));
      const wordBreak = window.lastIndexOf(' ');
      const breakAt = sentenceBreak > chunkChars * 0.5 ? sentenceBreak + 1 : wordBreak;
      if (breakAt > chunkChars * 0.4) {
        end = start + breakAt;
      }
    }
    const slice = cleaned.slice(start, end).trim();
    if (slice) chunks.push(slice);
    if (end >= cleaned.length) break;
  }
  return chunks;
}
