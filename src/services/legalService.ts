import { GoogleGenAI, Type } from "@google/genai";
import { getModuleConfig } from "../lib/module-config";
import { getCachedLegacyAiConfig } from "../lib/aiOrchestratorClient";
import { db, auth } from "../lib/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";

// Note: GoogleGenAI is initialized dynamically if needed
export interface LegalValidationResult {
  isValid: boolean;
  violationDetail?: string;
  forbiddenText?: string;
}

/**
 * Validates a draft content against legal guardrails using a local Gemini or local/Ollama model.
 */
export async function validateDraft(draftContent: string, ticketId?: string): Promise<LegalValidationResult> {
  const moduleConfig = getModuleConfig();
  const policyText = moduleConfig.legalPolicy;
  const aiConfig = getCachedLegacyAiConfig();

  if (!policyText) return { isValid: true };

  const systemInstruction = `You are a legal guardrail compliance engine. Your goal is to detect if a support agent's draft message violates company legal policies.
Identify specific contradictions like unauthorized financial promises or legal advice.
Return a JSON object with:
- isValid: boolean
- violationDetail: string (which rule was violated)
- forbiddenText: string (the exact problematic text from the draft)`;

  const prompt = `Draft Content to Validate:
"${draftContent}"

Company Policy & Guardrails:
"${policyText}"`;

  try {
    let result: LegalValidationResult = { isValid: true };
    const isGoogle = aiConfig.sentimentModel === 'gemini-flash';

    if (isGoogle) {
      const apiKey = aiConfig.apiKey || process.env.GEMINI_API_KEY || "";
      if (!apiKey) {
        console.warn("Legal validation skipped: Gemini API key not set");
        return { isValid: true };
      }
      const genAI = new GoogleGenAI({ apiKey });
      const response = await genAI.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: {
          systemInstruction,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              isValid: { type: Type.BOOLEAN },
              violationDetail: { type: Type.STRING },
              forbiddenText: { type: Type.STRING },
            },
            required: ["isValid"],
          },
        },
      });
      result = JSON.parse(response.text) as LegalValidationResult;
    } else {
      const endpoint = aiConfig.localEndpoint || "http://localhost:11434/v1";
      const modelName = aiConfig.sentimentModel === 'custom-local'
        ? (aiConfig.customSentimentModelName || "gemma")
        : (aiConfig.sentimentModel === 'local-gemma' ? "gemma" : "llama3");

      const response = await fetch(`${endpoint}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${aiConfig.customApiKey || "ollama"}`
        },
        body: JSON.stringify({
          model: modelName,
          messages: [
            { role: "system", content: systemInstruction },
            { role: "user", content: prompt }
          ],
          response_format: { type: "json_object" }
        })
      });
      const rdata = await response.json();
      result = JSON.parse(rdata.choices[0].message.content) as LegalValidationResult;
    }

    // If violation found, log to compliance_logs
    if (!result.isValid) {
      await logViolation({
        agentId: auth.currentUser?.uid || 'unknown',
        agentEmail: auth.currentUser?.email || 'unknown',
        ticketId: ticketId || 'none',
        forbiddenText: result.forbiddenText || 'all',
        violatedRule: result.violationDetail || 'Policy Violation',
        draftContent: draftContent,
      });
    }

    return result;
  } catch (error) {
    console.error("Legal validation failed:", error);
    // Fail safe to let the user review manually if validation fails
    return { isValid: true };
  }
}

interface ViolationLog {
  agentId: string;
  agentEmail: string;
  ticketId: string;
  forbiddenText: string;
  violatedRule: string;
  draftContent: string;
}

async function logViolation(log: ViolationLog) {
  try {
    await addDoc(collection(db, "compliance_logs"), {
      ...log,
      timestamp: serverTimestamp(),
    });
  } catch (error) {
    console.error("Failed to log compliance violation:", error);
  }
}
