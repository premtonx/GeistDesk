import { Company, Ticket } from "../types";
import { getCachedLegacyAiConfig } from "../lib/aiOrchestratorClient";
import { executeClientAiPrompt } from "../lib/client-ai-proxy";

export const aiAccountService = {
  generateAccountHealthSummary: async (company: Company, tickets: Ticket[]): Promise<string> => {
    const config = { ai: getCachedLegacyAiConfig() };
    const isGoogle = config.ai.sentimentModel === 'gemini-flash';

    const ticketContext = tickets.map(t => ({
      subject: t.subject,
      status: t.status,
      priority: t.priority,
      created: t.createdAt?.toDate ? t.createdAt.toDate().toLocaleDateString() : 'Unknown'
    }));

    const prompt = `
      Analyze the following B2B company and its recent support ticket history.
      Generate a concise 2-sentence 'Account Health' summary.

      Company: ${company.name}
      Website: ${company.website || 'N/A'}
      Branche: ${company.branche}
      Wartungsvertrag Status: ${company.wartungsvertragStatus}

      Recent Tickets:
      ${JSON.stringify(ticketContext, null, 2)}

      Rules:
      - Exactly 2 sentences.
      - Be specific about trends in the tickets.
      - Reference the Wartungsvertrag status if relevant.
    `;

    try {
      if (isGoogle) {
        const result = await executeClientAiPrompt({
          feature: 'ticket_summarization',
          prompt,
        });
        return result.output.trim();
      }

      const endpoint =
        config.ai.localEndpoint ||
        (typeof process !== 'undefined' && process.env.OLLAMA_ENDPOINT
          ? process.env.OLLAMA_ENDPOINT.replace(/\/$/, '').endsWith('/v1')
            ? process.env.OLLAMA_ENDPOINT.replace(/\/$/, '')
            : `${process.env.OLLAMA_ENDPOINT.replace(/\/$/, '')}/v1`
          : '');
      if (!endpoint) {
        throw new Error('Local AI endpoint is not configured (set OLLAMA_ENDPOINT or module AI localEndpoint).');
      }
      const modelName = config.ai.sentimentModel === 'custom-local'
        ? (config.ai.customSentimentModelName || "gemma")
        : (config.ai.sentimentModel === 'local-gemma' ? "gemma" : "llama3");

      const response = await fetch(`${endpoint}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${config.ai.customApiKey || "ollama"}`
        },
        body: JSON.stringify({
          model: modelName,
          messages: [
            { role: "system", content: "You are a professional business health auditor." },
            { role: "user", content: prompt }
          ]
        })
      });
      const rdata = await response.json();
      return rdata.choices[0].message.content.trim();
    } catch (error) {
      console.error("AI Account Summary Error:", error);
      return "AI was unable to generate a summary at this time.";
    }
  }
};
