import axios from 'axios';
import { KBArticle, Ticket } from '../types';

export interface RAGResult {
  text: string;
  source: string;
  sourceTitle: string;
  sourceId?: string;
  sourceType?: 'KB_ARTICLE' | 'RESOLVED_TICKET';
  score?: number;
}

export interface GroundedRagClientResult {
  results: RAGResult[];
  linkedKb: Array<{ id: string; title: string }>;
  linkedTickets: Array<{ id: string; title: string }>;
  promptBlock?: string;
}

function keywordFallback(
  query: string,
  kbArticles: KBArticle[],
  resolvedTickets: Ticket[],
): RAGResult[] {
  const keywords = query.toLowerCase().split(/\s+/).filter((w) => w.length > 3);
  const results: RAGResult[] = [];

  kbArticles.forEach((article) => {
    const content = (article.content || '').toLowerCase();
    const title = (article.title || '').toLowerCase();
    let score = 0;
    keywords.forEach((k) => {
      if (content.includes(k)) score += 1;
      if (title.includes(k)) score += 2;
    });
    if (score > 0) {
      results.push({
        text: article.content,
        source: 'Knowledge Base',
        sourceTitle: article.title,
        sourceId: article.id,
        sourceType: 'KB_ARTICLE',
        score,
      });
    }
  });

  resolvedTickets
    .filter((t) => t.status === 'resolved' || t.status === 'closed')
    .forEach((ticket) => {
      const desc = (ticket.description || '').toLowerCase();
      const subj = (ticket.subject || '').toLowerCase();
      let score = 0;
      keywords.forEach((k) => {
        if (desc.includes(k)) score += 1;
        if (subj.includes(k)) score += 2;
      });
      if (score > 0) {
        results.push({
          text: ticket.description,
          source: 'Past Resolution',
          sourceTitle: ticket.subject,
          sourceId: ticket.id,
          sourceType: 'RESOLVED_TICKET',
          score,
        });
      }
    });

  return results.sort((a, b) => (b.score || 0) - (a.score || 0)).slice(0, 5);
}

export const ragService = {
  /**
   * Sync keyword fallback (demo / offline). Prefer findRelevantContextHybrid.
   */
  findRelevantContext: (
    query: string,
    kbArticles: KBArticle[],
    resolvedTickets: Ticket[],
  ): RAGResult[] => keywordFallback(query, kbArticles, resolvedTickets),

  /**
   * Hybrid RAG via server (pgvector cosine + PostgreSQL FTS), tenant-scoped.
   * Falls back to keyword scoring when the API is unavailable.
   */
  findRelevantContextHybrid: async (
    query: string,
    kbArticles: KBArticle[] = [],
    resolvedTickets: Ticket[] = [],
    opts?: { tenantId?: string; limit?: number },
  ): Promise<GroundedRagClientResult> => {
    try {
      const res = await axios.post(
        '/api/vectors/search',
        {
          query,
          // tenantId is derived from the authenticated session on the server
          limit: opts?.limit ?? 5,
        },
        { withCredentials: true },
      );
      const snippets = res.data?.snippets || res.data?.hits || [];
      const results: RAGResult[] = snippets.map((hit: any) => ({
        text: hit.chunkContent || hit.text || '',
        source: hit.sourceType === 'RESOLVED_TICKET' ? 'Past Resolution' : 'Knowledge Base',
        sourceTitle: hit.title || hit.metadata?.title || hit.sourceId,
        sourceId: hit.sourceId,
        sourceType: hit.sourceType,
        score: hit.hybridScore,
      }));
      if (results.length > 0) {
        return {
          results,
          linkedKb: res.data?.linkedKb || [],
          linkedTickets: res.data?.linkedTickets || [],
          promptBlock: res.data?.promptBlock,
        };
      }
    } catch {
      /* fall through */
    }

    const results = keywordFallback(query, kbArticles, resolvedTickets);
    return {
      results,
      linkedKb: results
        .filter((r) => r.sourceType === 'KB_ARTICLE' && r.sourceId)
        .map((r) => ({ id: r.sourceId!, title: r.sourceTitle })),
      linkedTickets: results
        .filter((r) => r.sourceType === 'RESOLVED_TICKET' && r.sourceId)
        .map((r) => ({ id: r.sourceId!, title: r.sourceTitle })),
    };
  },
};
