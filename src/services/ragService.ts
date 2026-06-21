import { KBArticle, Ticket } from '../types';

export interface RAGResult {
  text: string;
  source: string;
  sourceTitle: string;
}

export const ragService = {
  /**
   * Simple keyword-based RAG for demonstration.
   * In production, this would use vector embeddings.
   */
  findRelevantContext: (
    query: string, 
    kbArticles: KBArticle[], 
    resolvedTickets: Ticket[]
  ): RAGResult[] => {
    const keywords = query.toLowerCase().split(/\s+/).filter(w => w.length > 3);
    const results: RAGResult[] = [];

    // Search KB Articles
    kbArticles.forEach(article => {
      const content = article.content.toLowerCase();
      const title = article.title.toLowerCase();
      
      let score = 0;
      keywords.forEach(k => {
        if (content.includes(k)) score += 1;
        if (title.includes(k)) score += 2;
      });

      if (score > 0) {
        results.push({
          text: article.content,
          source: 'Knowledge Base',
          sourceTitle: article.title
        });
      }
    });

    // Search Resolved Tickets
    resolvedTickets
      .filter(t => t.status === 'resolved' || t.status === 'closed')
      .forEach(ticket => {
        const desc = ticket.description.toLowerCase();
        const subj = ticket.subject.toLowerCase();
        
        let score = 0;
        keywords.forEach(k => {
          if (desc.includes(k)) score += 1;
          if (subj.includes(k)) score += 2;
        });

        if (score > 0) {
          results.push({
            text: ticket.description,
            source: 'Past Resolution',
            sourceTitle: ticket.subject
          });
        }
      });

    // Return the top 3 most relevant context snippets
    return results.slice(0, 3);
  }
};
