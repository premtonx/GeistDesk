/**
 * AI Provider Adapter - The "Detachable Engine"
 * Supports Google Gemini out of the box, with hooks for Local/Ollama.
 */

import { GoogleGenAI, Type } from "@google/genai";
import { getModuleConfig, AIConfig } from "../module-config";

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
  private genAI: GoogleGenAI | null = null;
  private config: AIConfig;

  constructor() {
    this.config = getModuleConfig().ai;
    this.initializeSDK();
  }

  get isConfigured(): boolean {
    const sentimentProfile = this.getProfileForType('sentiment');
    const thinkingProfile = this.getProfileForType('thinking');
    
    // Check key presence safely in browser or node
    const envKeyAvailable = typeof process !== 'undefined' && process.env?.GEMINI_API_KEY;
    const hasGoogleKey = !!(this.config.apiKey || envKeyAvailable);
    
    const sentimentOk = sentimentProfile.provider === 'google' 
      ? hasGoogleKey 
      : !!(sentimentProfile.endpoint && sentimentProfile.endpoint.trim());

    const thinkingOk = thinkingProfile.provider === 'google'
      ? hasGoogleKey
      : !!(thinkingProfile.endpoint && thinkingProfile.endpoint.trim());

    return sentimentOk || thinkingOk;
  }

  private initializeSDK() {
    const apiKey = this.config.apiKey || process.env.GEMINI_API_KEY || "";
    if (apiKey) {
      this.genAI = new GoogleGenAI({ apiKey });
    }
  }

  private getProfileForType(type: 'sentiment' | 'thinking'): ModelProfile {
    const { 
      sentimentModel, 
      deepThinkingModel, 
      localEndpoint, 
      apiKey,
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
    } else {
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
  }

  async generateDraft(context: TicketContext): Promise<{ text: string; sources: RAGSource[] }> {
    const profile = this.getProfileForType('thinking');

    if (profile.provider === "google") {
      return this.generateWithGemini(context, profile);
    }
    
    if (profile.provider === "openai-compat" || profile.provider === "local-ollama") {
      return this.generateWithOpenAI(context, profile);
    }
    
    return { text: "Unsupported provider.", sources: [] };
  }

  private async generateWithOpenAI(context: TicketContext, profile: ModelProfile): Promise<{ text: string; sources: RAGSource[] }> {
    const endpoint = profile.endpoint || "http://localhost:11434/v1";
    const apiKey = profile.apiKey || "ollama";
    
    const systemPrompt = `You are a professional support agent. Use the provided Knowledge Base context to draft a reply.
    TRANSPARENCY RULE: If you use information from the KB, you MUST return a JSON object with:
    "text": (your reply),
    "sources": [{"paragraph": "exact snippet from KB", "articleTitle": "title"}]`;

    const userPrompt = `KB CONTEXT: ${context.kbContent || "No context."}
    CUSTOMER PROFILE: ${context.customerMetadata ? JSON.stringify(context.customerMetadata) : "Standard Profile"}
    TICKET SUBJECT: ${context.subject}
    TICKET DESCRIPTION: ${context.description}
    Return JSON:`;

    try {
      const response = await fetch(`${endpoint}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: profile.model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt }
          ],
          response_format: { type: "json_object" }
        })
      });

      const data = await response.json();
      const body = JSON.parse(data.choices[0].message.content);
      return {
        text: body.text || "Failed to generate draft.",
        sources: (body.sources || []).map((s: any) => ({ ...s, articleId: "local-rag" }))
      };
    } catch (e) {
      console.error("Custom AI Error:", e);
      return { text: "Error connecting to custom AI model.", sources: [] };
    }
  }

  private async generateWithGemini(context: TicketContext, profile: ModelProfile): Promise<{ text: string; sources: RAGSource[] }> {
    if (!this.genAI) throw new Error("Gemini SDK not initialized");

    const systemInstruction = `
      You are a professional support agent. 
      Use the provided Knowledge Base context to draft a reply.
      
      TRANSPARENCY RULE: 
      If you use information from the KB, you MUST return a JSON object with:
      "text": (your reply),
      "sources": [{"paragraph": "exact snippet from KB", "articleTitle": "title"}]

      ADAPTATION RULE:
      Adjust the tone and level of technical detail based on the CUSTOMER PROFILE.
      For example, if the profile indicates a 'Senior Manager' or 'VP', be more concise and result-oriented.
      If it indicates a 'Junior Developer', you can be more technical and detailed.
    `;

    const prompt = `
      KB CONTEXT: ${context.kbContent || "No context."}
      CUSTOMER PROFILE: ${context.customerMetadata ? JSON.stringify(context.customerMetadata) : "Standard Profile"}
      TICKET SUBJECT: ${context.subject}
      TICKET DESCRIPTION: ${context.description}
      
      Return JSON:
    `;

    const response = await this.genAI.models.generateContent({
      model: profile.model,
      contents: prompt,
      config: { 
        systemInstruction,
        responseMimeType: "application/json"
      }
    });

    const body = response.text ? JSON.parse(response.text) : { text: "", sources: [] };
    return {
      text: body.text || "Failed to generate draft.",
      sources: (body.sources || []).map((s: any) => ({ ...s, articleId: "manual-check" }))
    };
  }

  async summarizeThread(history: string[], options?: { format?: 'bullets' | 'paragraph'; count?: number }): Promise<string> {
    const profile = this.getProfileForType(this.config.summaryModel === 'thinking' ? 'thinking' : 'sentiment');
    
    const format = options?.format === 'bullets' ? `into ${options.count || 3} bullet points` : "into a concise paragraph";
    const prompt = `Summarize the following support thread ${format}:\n\n${history.join("\n")}`;

    if (profile.provider === "google") {
      if (!this.genAI) throw new Error("Gemini SDK not initialized");
      const response = await this.genAI.models.generateContent({
        model: profile.model,
        contents: prompt
      });
      return response.text || "Failed to summarize.";
    }

    if (profile.provider === "openai-compat" || profile.provider === "local-ollama") {
      const endpoint = profile.endpoint || "http://localhost:11434/v1";
      try {
        const response = await fetch(`${endpoint}/chat/completions`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model: profile.model,
            messages: [{ role: "user", content: prompt }]
          })
        });
        const data = await response.json();
        return data.choices[0].message.content || "Failed to summarize.";
      } catch (e) {
        return "Local AI summarization failed.";
      }
    }

    return "Unsupported summarization provider.";
  }

  async generateKBArticle(context: TicketContext): Promise<{ title: string; content: string }> {
    const profile = this.getProfileForType('thinking');
    const defaultResponse = {
      title: `KB: ${context.subject || "Reference Document"}`,
      content: `### Summary\nThis article pertains to the issue: **${context.subject || "N/A"}**.\n\n### Description\n${context.description || "No description provided."}\n\n### Recommended Actions\n1. Review the reported issue details and correlate with recent logs.\n2. Ensure all environment parameters are verified.\n3. Assist Customer to reach a quick resolution.`
    };

    try {
      if (profile.provider === "google") {
        if (!this.genAI) {
          throw new Error("Gemini SDK not initialized. Please configure an API Key.");
        }

        const systemInstruction = `
          You are a technical writer. Convert the following support ticket into a structured Knowledge Base article.
          Follow this format:
          1. Title: A concise, searchable title.
          2. Problem: A brief description of the issue.
          3. Solution: Step-by-step instructions to resolve.
          
          IMPORTANT: DO NOT include any PII (names, emails, phone numbers, individual IDs). Use generic terms.
        `;

        const prompt = `
          TICKET SUBJECT: ${context.subject}
          TICKET DESCRIPTION: ${context.description}
          THREAD HISTORY: ${context.threadHistory?.join("\n") || "No history."}
          
          Generate a professional KB article from this interaction:
        `;

        const response = await this.genAI.models.generateContent({
          model: profile.model,
          contents: prompt,
          config: { 
            systemInstruction,
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                content: { type: Type.STRING }
              },
              required: ["title", "content"]
            }
          }
        });

        const body = response.text ? JSON.parse(response.text) : { title: "", content: "" };
        return {
          title: body.title || defaultResponse.title,
          content: body.content || defaultResponse.content
        };
      } else {
        // Local Ollama/compat
        const endpoint = profile.endpoint || "http://localhost:11434/v1";
        const apiKey = profile.apiKey || "ollama";

        const systemPrompt = `You are a technical writer. Convert the support ticket into a structured Knowledge Base article. Return ONLY a JSON object with "title" and "content" markdown properties without any surrounding notes or markdown code fences.`;
        const userPrompt = `
          TICKET SUBJECT: ${context.subject}
          TICKET DESCRIPTION: ${context.description}
          THREAD_HISTORY: ${context.threadHistory?.join("\n") || "No history"}
          Respond in JSON: {"title": "...", "content": "..."}
        `;

        const response = await fetch(`${endpoint}/chat/completions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            model: profile.model,
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userPrompt }
            ],
            response_format: { type: "json_object" }
          })
        });

        const data = await response.json();
        const rawContent = data.choices[0].message.content;
        const body = JSON.parse(rawContent);
        return {
          title: body.title || defaultResponse.title,
          content: body.content || defaultResponse.content
        };
      }
    } catch (error) {
      console.warn("KB Generation failed or local AI offline, using fallback:", error);
      return defaultResponse;
    }
  }

  async translate(text: string, targetLanguage: string, mood: string = "Professional"): Promise<string> {
    if (!text || !text.trim()) return "";
    const profile = this.getProfileForType('sentiment');

    try {
      if (profile.provider === "google") {
        if (!this.genAI) {
          throw new Error("Gemini SDK not initialized");
        }

        const systemInstruction = `
          You are a specialized bidirectional translator for a support platform.
          Rules:
          1. Preserve technical jargon, error codes, and formatting.
          2. Adapt the tone to explicitly match the requested mood: ${mood}.
          3. If target language is Japanese, use appropriate honorifics for the mood (${mood}).
          4. If target language is German, use appropriate formality for the mood (${mood}).
          5. Return ONLY the translated text, no meta-commentary.
          6. Context is a customer support interaction.
        `;

        const prompt = `Translate the following text to ${targetLanguage}:\n\n${text}`;

        const response = await this.genAI.models.generateContent({
          model: profile.model,
          contents: prompt,
          config: { 
            systemInstruction,
            temperature: 0.3
          }
        });

        return response.text?.trim() || text;
      } else {
        // Local Ollama/compat translation
        const endpoint = profile.endpoint || "http://localhost:11434/v1";
        const apiKey = profile.apiKey || "ollama";

        const systemPrompt = `You are a translator. Translate the text directly to target language: ${targetLanguage}. Keep tone to: ${mood}. Return ONLY the direct translation, no intro or other meta text.`;

        const response = await fetch(`${endpoint}/chat/completions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            model: profile.model,
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: text }
            ]
          })
        });

        const data = await response.json();
        return data.choices[0].message.content?.trim() || text;
      }
    } catch (error) {
      console.warn("Translation failed or AI offline, falling back to original text:", error);
      return text;
    }
  }

  async improveTone(text: string, tone: string = "Professional"): Promise<string> {
    if (!text || !text.trim()) return "";
    const profile = this.getProfileForType('sentiment');

    try {
      if (profile.provider === "google") {
        if (!this.genAI) {
          throw new Error("Gemini SDK not initialized");
        }

        const systemInstruction = `
          You are a professional editor. Tone and polish the following support email draft to sound more ${tone}.
          Maintain the core technical instructions and structure, but optimize for professional customer relations, empathy, and clarity.
          Return ONLY the polished draft, no other conversational meta-responses or markdown.
        `;

        const response = await this.genAI.models.generateContent({
          model: profile.model,
          contents: text,
          config: { 
            systemInstruction,
            temperature: 0.4
          }
        });

        return response.text?.trim() || text;
      } else {
        const endpoint = profile.endpoint || "http://localhost:11434/v1";
        const apiKey = profile.apiKey || "ollama";

        const systemPrompt = `You are an editor. Tone and polish the text to sound more ${tone}. Keep all key logic/facts. Return ONLY the polished text, no intro or other meta text.`;

        const response = await fetch(`${endpoint}/chat/completions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            model: profile.model,
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: text }
            ]
          })
        });

        const data = await response.json();
        return data.choices[0].message.content?.trim() || text;
      }
    } catch (error) {
      console.warn("Tone polish failed or AI offline, falling back to original:", error);
      return text;
    }
  }
}
