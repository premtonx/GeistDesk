import { GoogleGenAI, Type } from "@google/genai";
import { db } from "../lib/firebase";
import { collection, query, where, getDocs, limit, orderBy } from "firebase/firestore";
import { Ticket } from "../types";
import { getModuleConfig } from "../lib/module-config";

export interface SuggestedLink {
  ticketId: string;
  subject: string;
  confidence: number;
  reason: string;
}

/**
 * Uses Gemini or Ollama to find semantically related tickets for a given ticket.
 */
export async function suggestNeuralLinks(currentTicket: Ticket): Promise<SuggestedLink[]> {
  const config = getModuleConfig();
  const isGoogle = config.ai.sentimentModel === 'gemini-flash';

  try {
    // 1. Fetch potential candidates (e.g., recent tickets in the last 30 days)
    // For now, let's just get the 20 most recent tickets
    const ticketsRef = collection(db, 'tickets');
    const q = query(ticketsRef, orderBy('createdAt', 'desc'), limit(20));
    const snapshot = await getDocs(q);
    
    const candidates = snapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() } as Ticket))
      .filter(t => t.id !== currentTicket.id);

    if (candidates.length === 0) return [];

    // 2. Perform "Semantic Similarity" comparison
    const candidatesList = candidates.map(t => `- ID: ${t.id}, Subject: ${t.subject}, Content preview: ${t.description.slice(0, 200)}`).join('\n');

    const prompt = `System: You are an expert AI Support Auditor. Your task is to identify semantically related support tickets.
Related tickets often share the same root cause (e.g., "server down," "payment failed," "login loop").

Current Ticket Details:
Subject: ${currentTicket.subject}
Description: ${currentTicket.description}

Candidate Tickets:
${candidatesList}

Compare the Current Ticket against the Candidate Tickets. 
Identify up to 3 tickets that are highly related.
Return a JSON array of objects with:
- ticketId: string
- subject: string
- confidence: number (0 to 1)
- reason: string (1 sentence explaining why they are related)`;

    let suggestions: SuggestedLink[] = [];

    if (isGoogle) {
      const apiKey = config.ai.apiKey || process.env.GEMINI_API_KEY || "";
      if (!apiKey) {
        console.warn("Neural Link suggestion skipped: Gemini API key not set");
        return [];
      }
      const ai = new GoogleGenAI({ apiKey });
      const result = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                ticketId: { type: Type.STRING },
                subject: { type: Type.STRING },
                confidence: { type: Type.NUMBER },
                reason: { type: Type.STRING }
              },
              required: ["ticketId", "subject", "confidence", "reason"]
            }
          }
        }
      });

      suggestions = JSON.parse(result.text || '[]') as SuggestedLink[];
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
            { role: "system", content: "You are a professional support ticketing auditor. Respond only with JSON." },
            { role: "user", content: prompt + "\nProvide formatted JSON list as array of objects containing ticketId, subject, confidence, reason." }
          ],
          response_format: { type: "json_object" }
        })
      });
      const rdata = await response.json();
      suggestions = JSON.parse(rdata.choices[0].message.content || '[]') as SuggestedLink[];
    }

    return suggestions.filter(s => s.confidence > 0.6);
  } catch (error) {
    console.error("Neural Link suggestion failed:", error);
    return [];
  }
}
