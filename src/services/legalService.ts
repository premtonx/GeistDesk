import { getModuleConfig } from "../lib/module-config";
import { getCachedLegacyAiConfig } from "../lib/aiOrchestratorClient";
import { db, auth } from "../lib/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { executeClientAiPrompt } from "../lib/client-ai-proxy";
import { callLocalModel, resolveLocalEndpoint, resolveLocalModelName } from "../lib/client-ai-local";

export interface LegalValidationResult {
  isValid: boolean;
  violationDetail?: string;
  forbiddenText?: string;
}

/**
 * Validates a draft content against legal guardrails using the server AI lifecycle.
 */
export async function validateDraft(draftContent: string, ticketId?: string): Promise<LegalValidationResult> {
  const moduleConfig = getModuleConfig();
  const policyText = moduleConfig.legalPolicy;
  const aiConfig = getCachedLegacyAiConfig();

  if (!policyText) return { isValid: true };

  const prompt = `Draft Content to Validate:
"${draftContent}"

Company Policy & Guardrails:
"${policyText}"

Return JSON with keys isValid (boolean), violationDetail (string), forbiddenText (string).`;

  try {
    let result: LegalValidationResult = { isValid: true };
    const isGoogle = aiConfig.sentimentModel === 'gemini-flash';

    if (isGoogle) {
      const lifecycle = await executeClientAiPrompt({
        feature: 'smart_reply',
        prompt,
        ticketId,
      });
      result = JSON.parse(lifecycle.output) as LegalValidationResult;
    } else {
      const output = await callLocalModel(prompt, {
        endpoint: resolveLocalEndpoint(aiConfig.localEndpoint),
        modelName: resolveLocalModelName(aiConfig),
        apiKey: aiConfig.customApiKey,
        systemPrompt: 'You are a legal guardrail compliance engine. Respond only with JSON.',
        jsonMode: true,
      });
      result = JSON.parse(output) as LegalValidationResult;
    }

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
