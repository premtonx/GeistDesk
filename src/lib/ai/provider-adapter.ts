/**
 * AI Provider Adapter - routes all live feature requests through the lifecycle pipeline.
 */

import { getCachedLegacyAiConfig, getCachedOrchestratorConfig } from "../aiOrchestratorClient";
import { executeViaLifecycle, resolveLifecycleOutput, resolveOperatorLanguage } from "../aiLifecycleClient";
import type { AiExecutionContext, AiFeatureId } from "../../types/aiOrchestrator";
import type { AIConfig } from "../module-config";
import { translateSupportContent } from "../polyglot-bridge";

export type AIProvider = "google" | "local-ollama" | "openai-compat";

export interface ModelProfile {
  name: string;
  provider: AIProvider;
  model: string;
  apiKey?: string;
  endpoint?: string;
}

export interface TicketContext {
  subject: string;
  description: string;
  ticketId?: string;
  kbContent?: string;
  threadHistory?: string[];
  customerMetadata?: Record<string, any>;
}

export interface RAGSource {
  paragraph: string;
  articleTitle: string;
  articleId: string;
}

export class AIAdapter {
  private config: AIConfig;

  constructor() {
    this.config = getCachedLegacyAiConfig();
  }

  /** Refresh in-memory config from workspace orchestrator cache. */
  reloadConfig() {
    this.config = getCachedLegacyAiConfig();
  }

  get isConfigured(): boolean {
    const orchestrator = getCachedOrchestratorConfig();
    if (orchestrator.killSwitch?.master) return false;

    const sentimentProfile = this.getProfileForType('sentiment');
    const thinkingProfile = this.getProfileForType('thinking');

    const sentimentOk = sentimentProfile.provider === 'google'
      ? true
      : !!(sentimentProfile.endpoint && sentimentProfile.endpoint.trim());

    const thinkingOk = thinkingProfile.provider === 'google'
      ? true
      : !!(thinkingProfile.endpoint && thinkingProfile.endpoint.trim());

    return sentimentOk || thinkingOk;
  }

  private getProfileForType(type: 'sentiment' | 'thinking'): ModelProfile {
    const {
      sentimentModel,
      deepThinkingModel,
      localEndpoint,
      customSentimentModelName,
      customThinkingModelName,
      customApiKey
    } = this.config;

    if (type === 'sentiment') {
      if (sentimentModel === 'gemini-flash') {
        return { name: "Gemini Flash", provider: "google", model: "gemini-3-flash-preview" };
      }
      return {
        name: sentimentModel === 'custom-local' ? (customSentimentModelName || "Custom Local Model") : (sentimentModel === 'local-gemma' ? "Gemma" : "Llama"),
        provider: "local-ollama",
        model: sentimentModel === 'custom-local' ? (customSentimentModelName || "gemma") : (sentimentModel === 'local-gemma' ? "gemma" : "llama3"),
        endpoint: localEndpoint,
        apiKey: customApiKey || "ollama"
      };
    }

    if (deepThinkingModel === 'gemini-pro') {
      return { name: "Gemini Pro", provider: "google", model: "gemini-3.1-pro-preview" };
    }
    return {
      name: deepThinkingModel === 'custom-local' ? (customThinkingModelName || "Custom Local Model") : (deepThinkingModel === 'qwen-36b' ? "Qwen 36B" : "Llama 70B"),
      provider: "local-ollama",
      model: deepThinkingModel === 'custom-local' ? (customThinkingModelName || "qwen:36b") : (deepThinkingModel === 'qwen-36b' ? "qwen:36b" : "llama3:70b"),
      endpoint: localEndpoint,
      apiKey: customApiKey || "ollama"
    };
  }

  private async runLifecycleFeature(
    feature: AiFeatureId,
    prompt: string,
    ctx: Partial<AiExecutionContext> = {},
  ): Promise<string> {
    const result = await executeViaLifecycle({
      feature,
      prompt,
      operatorLanguage: resolveOperatorLanguage(),
      ...ctx,
    });
    return resolveLifecycleOutput(result);
  }

  async generateDraft(context: TicketContext): Promise<{ text: string; sources: RAGSource[] }> {
    const systemPrompt = `You are a professional support agent. Use the provided Knowledge Base context to draft a reply.
TRANSPARENCY RULE: If you use information from the KB, you MUST return a JSON object with:
"text": (your reply),
"sources": [{"paragraph": "exact snippet from KB", "articleTitle": "title"}]

ADAPTATION RULE:
Adjust the tone and level of technical detail based on the CUSTOMER PROFILE.`;

    const userPrompt = `KB CONTEXT: ${context.kbContent || "No context."}
CUSTOMER PROFILE: ${context.customerMetadata ? JSON.stringify(context.customerMetadata) : "Standard Profile"}
TICKET SUBJECT: ${context.subject}
TICKET DESCRIPTION: ${context.description}
Return JSON:`;

    try {
      const output = await this.runLifecycleFeature('smart_reply', `${systemPrompt}\n\n${userPrompt}`, {
        ticketId: context.ticketId,
        customerScope: context.customerMetadata?.vip ? 'vip' : undefined,
      });
      const body = JSON.parse(output);
      return {
        text: body.text || "Failed to generate draft.",
        sources: (body.sources || []).map((s: any) => ({ ...s, articleId: "lifecycle-rag" }))
      };
    } catch (e) {
      console.error("Lifecycle draft error:", e);
      return { text: "Error connecting to AI model.", sources: [] };
    }
  }

  async summarizeThread(
    history: string[],
    options?: { format?: 'bullets' | 'paragraph'; count?: number; ticketId?: string },
  ): Promise<string> {
    const format = options?.format === 'bullets' ? `into ${options.count || 3} bullet points` : "into a concise paragraph";
    const prompt = `Summarize the following support thread ${format}:\n\n${history.join("\n")}`;

    try {
      return await this.runLifecycleFeature('ticket_summarization', prompt, {
        ticketId: options?.ticketId,
      });
    } catch (e) {
      console.error("Lifecycle summarization error:", e);
      return "AI summarization failed.";
    }
  }

  async generateKBArticle(context: TicketContext): Promise<{ title: string; content: string }> {
    const defaultResponse = {
      title: `KB: ${context.subject || "Reference Document"}`,
      content: `### Summary\nThis article pertains to the issue: **${context.subject || "N/A"}**.\n\n### Description\n${context.description || "No description provided."}\n\n### Recommended Actions\n1. Review the reported issue details and correlate with recent logs.\n2. Ensure all environment parameters are verified.\n3. Assist Customer to reach a quick resolution.`
    };

    const prompt = `You are a technical writer. Convert the following support ticket into a structured Knowledge Base article.
Follow this format:
1. Title: A concise, searchable title.
2. Problem: A brief description of the issue.
3. Solution: Step-by-step instructions to resolve.

IMPORTANT: DO NOT include any PII (names, emails, phone numbers, individual IDs). Use generic terms.
Return ONLY a JSON object with "title" and "content" markdown properties.

TICKET SUBJECT: ${context.subject}
TICKET DESCRIPTION: ${context.description}
THREAD HISTORY: ${context.threadHistory?.join("\n") || "No history."}`;

    try {
      const output = await this.runLifecycleFeature('kb_generation', prompt);
      const body = JSON.parse(output);
      return {
        title: body.title || defaultResponse.title,
        content: body.content || defaultResponse.content
      };
    } catch (error) {
      console.warn("KB Generation blocked or failed, using fallback:", error);
      return defaultResponse;
    }
  }

  async translate(text: string, targetLanguage: string, mood: string = "Professional"): Promise<string> {
    if (!text || !text.trim()) return "";

    // POLYGLOT BRIDGE POLICY: Dictionary + low-cost MT first; LLM only when admin enables allowAiFallback.
    return translateSupportContent(text, targetLanguage, { mood });
  }

  /**
   * Simplified layout analysis for KB article detail "AI Explain" toolbar action.
   */
  async explainArticleLayout(title: string, content: string, articleId: string): Promise<string> {
    const plain = content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    const prompt = `You are a documentation analyst. Produce a simplified layout analysis of this knowledge base article for support operators.

Structure your response with these sections:
1. Document Purpose (1-2 sentences)
2. Section Overview (bullet list of main topics)
3. Key Dependencies & Permissions
4. Recommended Reader Actions

Use clear, accessible language. Do not invent facts not present in the article.

Article Title: ${title}
Article Content:
${plain.slice(0, 14000)}`;

    return await this.runLifecycleFeature('ticket_summarization', prompt, {
      metadata: { entityId: `kb-explain-${articleId}`, kbArticleId: articleId },
    });
  }

  /**
   * Answers a KB search question using workspace-scoped RAG snippets only.
   * Uses ticket_summarization (automatic) to avoid manager-approval gates on kb_generation.
   */
  async answerKnowledgeQuery(
    query: string,
    ragSnippets: { sourceTitle: string; source: string; text: string }[],
    options?: { forceRefresh?: boolean; entityId?: string },
  ): Promise<string> {
    const contextBlock =
      ragSnippets.length > 0
        ? ragSnippets
            .map((s) => `[${s.source}: ${s.sourceTitle}]\n${s.text}`)
            .join("\n\n")
        : "No matching documentation found in this workspace.";

    const prompt = `You are Geist AI, a knowledge base assistant. Answer the user's question using ONLY the provided workspace documentation excerpts.
If the excerpts do not contain enough information, say so clearly and suggest what to search for.
Do not invent facts or reference data outside the provided context.

USER QUESTION: ${query}

WORKSPACE DOCUMENTATION:
${contextBlock}

Provide a concise, helpful answer in 2-4 short paragraphs or bullet points.`;

    const cacheEntityId =
      options?.entityId ??
      `kb-search-${query.trim().toLowerCase().replace(/\s+/g, '-').slice(0, 96)}`;

    try {
      return await this.runLifecycleFeature("ticket_summarization", prompt, {
        metadata: { entityId: cacheEntityId, kbArticleId: cacheEntityId },
        forceRefresh: options?.forceRefresh,
      });
    } catch (error) {
      console.error("KB semantic search AI error:", error);
      throw error;
    }
  }

  async improveTone(text: string, tone: string = "Professional"): Promise<string> {
    if (!text || !text.trim()) return "";

    const prompt = `You are a professional editor. Tone and polish the following support email draft to sound more ${tone}.
Maintain the core technical instructions and structure, but optimize for professional customer relations, empathy, and clarity.
Return ONLY the polished draft, no other conversational meta-responses or markdown.

DRAFT:
${text}`;

    try {
      return await this.runLifecycleFeature('smart_reply', prompt);
    } catch (error) {
      console.warn("Tone polish failed, falling back to original:", error);
      return text;
    }
  }
}
