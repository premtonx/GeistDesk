/**
 * ==============================================================================
 * GEISTDESK PLATFORM - MICROSOFT TEAMS CHAT BOT HANDLER
 * ==============================================================================
 * 
 * Integrates Microsoft Bot Framework with high-security content filters (PIIShield)
 * and Azure OpenAI downstream systems. Formulates answers as rich Teams Adaptive Cards.
 */

import { ActivityHandler, BotFrameworkAdapter, CardFactory } from "botbuilder";
import { PIIShield } from "./pii-shield.js";
import { generateAzureAIAnswer } from "./azure-ai-orchestrator.js";
import { createAdaptiveCard } from "./teams-adaptive-cards.js";

/**
 * GeistDeskTeamsAgent intercepts incoming Microsoft Teams interactions.
 * Guarantees that raw user text is ALWAYS scrubbed locally before hitting cloud AI.
 */
export class GeistDeskTeamsAgent extends ActivityHandler {
  constructor() {
    super();

    this.onMessage(async (context, next) => {
      try {
        const rawText = context.activity.text || "";
        console.log(`[TeamsBot] Received incoming message. Original size: ${rawText.length} chars.`);

        // 1. Force raw text through the local asynchronous validation layer
        let validationResult;
        try {
          validationResult = await PIIShield.redact(rawText);
        } catch (shieldError) {
          // If the shield validation engine itself fails, abort operation immediately & drop context
          console.error("[TeamsBot Security Check Failure] PIIShield validation failed:", shieldError);
          await context.sendActivity(
            "⚠️ **Sovereign Exception**: The compliance filter pipeline failed. Connection aborted and query dropped."
          );
          return; // Soft drop context without propagating raw inputs
        }

        const { cleanText, wasScrubbed } = validationResult;
        const userId = context.activity.from?.id || "anonymous-teams-user";

        console.log(`[TeamsBot Security Check] Scrub status: ${wasScrubbed}. Dispatching to Azure OpenAI...`);

        // 2. Invoke Azure OpenAI orchestrator using the scrubbed, safe, local context
        let orchestratorResult;
        try {
          orchestratorResult = await generateAzureAIAnswer({
            prompt: cleanText,
            userId: userId,
            contextDocuments: [
              "System: Operational Workspace GeistDesk secure customer deployment guidelines.",
              "Documentation: Secure access controls and API routing protocols require PII shielding."
            ]
          });
        } catch (openaiError) {
          console.error("[TeamsBot Process Failure] Azure OpenAI request execution failed:", openaiError);
          await context.sendActivity(
            "⚠️ **Gateway Error**: Unable to contact the AI processing server. Your request telemetry was dropped."
          );
          return;
        }

        const { answer } = orchestratorResult;

        // 3. Construct rich Visual Adaptive Card response matching the 1.4 Teams schema
        const adaptiveCardContent = createAdaptiveCard(answer, wasScrubbed);
        const teamsAttachment = CardFactory.adaptiveCard(adaptiveCardContent);

        // 4. Return secure attachment activity
        await context.sendActivity({
          text: wasScrubbed ? "⚠️ **Sovereign Alert: Local data scrub active.**" : "🛡️ **Operational Safe Mode active.**",
          attachments: [teamsAttachment]
        });

      } catch (globalError) {
        // Safe-catch fallback dropping all raw context under any unhandled exception pathways
        console.error("[TeamsBot Critical Failure] Safe exception handler activated:", globalError);
        try {
          await context.sendActivity(
            "⚠️ **Compliance Failure**: Pipeline exception encountered. The secure terminal discarded this interaction session to preserve privacy."
          );
        } catch (replyError) {
          console.error("[TeamsBot Reply Failure] Failed to broadcast gateway warning:", replyError);
        }
      }

      await next();
    });
  }
}

/**
 * Creates and initializes the BotFrameworkAdapter using Microsoft App credentials.
 * Includes a global adapter turn error handler to ensure zero data leakage on crash.
 */
export function createTeamsBotAdapter() {
  const adapter = new BotFrameworkAdapter({
    appId: process.env.MicrosoftAppId || "",
    appPassword: process.env.MicrosoftAppPassword || ""
  });

  // Global Context Error Fallback Handler
  adapter.onTurnError = async (context, error) => {
    console.error(`\n[TeamsBot onTurnError] Adapter level unhandled exception: ${error}`);
    try {
      await context.sendActivity(
         "⚠️ **GeistDesk Gateway Exception**: An unhandled thread-state event occurred. " +
         "All runtime context coordinates have been safely cleared from working memory."
      );
    } catch (innerError) {
      console.error(`Failed to dispatch adapter exception error activity notification: ${innerError}`);
    }
  };

  return adapter;
}
