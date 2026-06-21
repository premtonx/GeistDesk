import { GoogleGenAI } from "@google/genai";
import { Company, Ticket } from "../types";
import { getModuleConfig } from "../lib/module-config";

export const aiAccountService = {
  generateAccountHealthSummary: async (company: Company, tickets: Ticket[]): Promise<string> => {
    const config = getModuleConfig();
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
      
      Example Output Format:
      'Account is healthy, but 3 employees have reported the same login bug this week. Premium contract expires in 30 days.'
      
      Rules:
      - Exactly 2 sentences.
      - Be specific about trends in the tickets.
      - Reference the Wartungsvertrag status if relevant.
    `;

    try {
      if (isGoogle) {
        const apiKey = config.ai.apiKey || process.env.GEMINI_API_KEY || "";
        if (!apiKey) {
          console.warn("AI Account Summary skipped: Gemini API key not set");
          return "AI summary requires Gemini API key or configured local model.";
        }
        const ai = new GoogleGenAI({ apiKey });
        const response = await ai.models.generateContent({
          model: "gemini-3-flash-preview",
          contents: prompt,
        });
        return response.text.trim();
      } else {
        const endpoint = config.ai.localEndpoint || "http://localhost:11434/v1";
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
      }
    } catch (error) {
      console.error("AI Account Summary Error:", error);
      return "AI was unable to generate a summary at this time.";
    }
  }
};
