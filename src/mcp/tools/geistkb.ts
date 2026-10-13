import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { hybridSearchKnowledge } from '../../lib/ai/ki-orchestrator.js';
import { createKbArticle, getKbArticle } from '../../lib/kb-service.js';
import { documentBelongsToTenant } from '../../lib/tenant-context.js';
import { getMcpActor, requireMcpScope } from '../context.js';
import { toolError, toolJson } from '../types.js';

export function registerGeistKbTools(server: McpServer): void {
  server.registerTool(
    'geistkb_search',
    {
      title: 'Search GeistKB',
      description:
        'Semantic hybrid search (pgvector + FTS) across GeistKB articles, documents, and resolved tickets.',
      inputSchema: {
        query: z.string().min(1).max(4000).describe('Natural-language search query'),
        limit: z.number().int().min(1).max(20).optional().describe('Max hits (default 5)'),
      },
    },
    async ({ query, limit }) => {
      const denied = requireMcpScope('geistkb:read');
      if (denied) return denied;
      const actor = getMcpActor();
      try {
        const hits = await hybridSearchKnowledge({
          query,
          tenantId: actor.tenantId,
          limit: limit ?? 5,
          sourceTypes: ['KB_ARTICLE', 'KB_DOCUMENT', 'RESOLVED_TICKET'],
        });
        return toolJson({
          query,
          count: hits.length,
          results: hits.map((hit) => ({
            id: hit.sourceId,
            embeddingId: hit.id,
            title: hit.title,
            sourceType: hit.sourceType,
            chunkIndex: hit.chunkIndex,
            snippet: hit.chunkContent.slice(0, 1200),
            hybridScore: hit.hybridScore,
            metadata: hit.metadata,
          })),
        });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        return toolError(`geistkb_search failed: ${message}`);
      }
    },
  );

  server.registerTool(
    'geistkb_get_article',
    {
      title: 'Get GeistKB article',
      description: 'Retrieve the markdown/HTML content of a GeistKB article by id.',
      inputSchema: {
        id: z.string().min(1).max(200).describe('KB article document id'),
      },
    },
    async ({ id }) => {
      const denied = requireMcpScope('geistkb:read');
      if (denied) return denied;
      const actor = getMcpActor();
      try {
        const article = await getKbArticle(id);
        if (!article || !documentBelongsToTenant(article, actor.tenantId)) {
          return toolError(`Article not found: ${id}`);
        }
        return toolJson({
          id: article.id,
          title: article.title ?? '',
          content: article.content ?? '',
          category: article.category ?? null,
          status: article.status ?? null,
          index_in_rag: article.index_in_rag !== false,
          updatedAt: article.updatedAt ?? null,
          createdAt: article.createdAt ?? null,
        });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        return toolError(`geistkb_get_article failed: ${message}`);
      }
    },
  );

  server.registerTool(
    'geistkb_create_article',
    {
      title: 'Create GeistKB article',
      description: 'Create a new SOP/doc in GeistKB and optionally enqueue it for RAG indexing.',
      inputSchema: {
        title: z.string().min(1).max(500).describe('Article title'),
        content: z.string().min(1).max(200_000).describe('Markdown or HTML body'),
        inRag: z.boolean().optional().describe('Index in RAG pipeline (default true)'),
      },
    },
    async ({ title, content, inRag }) => {
      const denied = requireMcpScope('geistkb:write');
      if (denied) return denied;
      const actor = getMcpActor();
      try {
        const indexInRag = inRag !== false;
        const id = await createKbArticle(
          {
            title: title.trim(),
            content,
            category: 'General',
            status: 'Published',
            visibility: 'Private',
            owner: actor.userEmail || actor.userName,
            index_in_rag: indexInRag,
            tenantId: actor.tenantId,
            createdBy: actor.userId,
            source: 'mcp',
          },
          actor.tenantId,
        );
        return toolJson({
          id,
          title: title.trim(),
          index_in_rag: indexInRag,
          message: indexInRag
            ? 'Article created and queued for RAG indexing.'
            : 'Article created without RAG indexing.',
        });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        return toolError(`geistkb_create_article failed: ${message}`);
      }
    },
  );
}
