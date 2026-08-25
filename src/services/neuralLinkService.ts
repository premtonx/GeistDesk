import { db } from "../lib/firebase";
import { collection, query, getDocs, limit, orderBy } from "firebase/firestore";
import { Ticket } from "../types";
import { getCachedLegacyAiConfig } from "../lib/aiOrchestratorClient";
import { executeClientAiPrompt } from "../lib/client-ai-proxy";
import { callLocalModel, resolveLocalEndpoint, resolveLocalModelName } from "../lib/client-ai-local";

export interface SuggestedLink {
  ticketId: string;
  subject: string;
  confidence: number;
  reason: string;
}

/**
 * Uses the server AI lifecycle to find semantically related tickets for a given ticket.
 */
export async function suggestNeuralLinks(currentTicket: Ticket): Promise<SuggestedLink[]> {
  const config = { ai: getCachedLegacyAiConfig() };
  const isGoogle = config.ai.sentimentModel === 'gemini-flash';

  try {
    const ticketsRef = collection(db, 'tickets');
    const q = query(ticketsRef, orderBy('createdAt', 'desc'), limit(20));
    const snapshot = await getDocs(q);

    const candidates = snapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() } as Ticket))
      .filter(t => t.id !== currentTicket.id);

    if (candidates.length === 0) return [];

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
      const result = await executeClientAiPrompt({
        feature: 'escalation_analysis',
        prompt: `${prompt}\nRespond with raw JSON array only.`,
        ticketId: currentTicket.id,
      });
      suggestions = JSON.parse(result.output || '[]') as SuggestedLink[];
    } else {
      const output = await callLocalModel(prompt, {
        endpoint: resolveLocalEndpoint(config.ai.localEndpoint),
        modelName: resolveLocalModelName(config.ai),
        apiKey: config.ai.customApiKey,
        systemPrompt: 'You are a professional support ticketing auditor. Respond only with JSON.',
        userPromptSuffix: '\nProvide formatted JSON list as array of objects containing ticketId, subject, confidence, reason.',
        jsonMode: true,
      });
      suggestions = JSON.parse(output || '[]') as SuggestedLink[];
    }

    return suggestions.filter(s => s.confidence > 0.6);
  } catch (error) {
    console.error("Neural Link suggestion failed:", error);
    return [];
  }
}
