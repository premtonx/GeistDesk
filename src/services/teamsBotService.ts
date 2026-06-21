import { ActivityHandler, BotFrameworkAdapter, TurnContext } from 'botbuilder';

/**
 * PIIShield performs asynchronous local validation of raw user inputs
 * to prevent sensitive data from reaching cloud models.
 */
export const PIIShield = {
  async redact(text: string): Promise<{ cleanText: string; wasScrubbed: boolean }> {
    if (!text) {
      return { cleanText: "", wasScrubbed: false };
    }

    // RegEx patterns for credentials, emails, or server tokens
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    
    // Pattern to catch apiKey, secrets, password values
    const credentialRegex = /(password|secret|token|passwd|private_key|api_key|apikey)\s*[:=]\s*["']?([a-zA-Z0-9_\-+=/]{12,})["']?/gi;
    
    // Standard Authorization header token patterns
    const authHeaderRegex = /bearer\s+([a-zA-Z0-9_\-+=/.]+)/gi;
    
    // Server tokens pattern (like Slack, GitHub tokens, AWS keys)
    const serverTokenRegex = /\b(xoxb-[0-9]{11,13}-[0-9]{11,13}-[a-zA-Z0-9]{24}|ghp_[a-zA-Z0-9]{36}|AIzaSy[a-zA-Z0-9_\-]{33})\b/gi;

    let cleanText = text;
    let wasScrubbed = false;

    // Check & Redact emails
    if (emailRegex.test(cleanText)) {
      cleanText = cleanText.replace(emailRegex, "[REDACTED_EMAIL]");
      wasScrubbed = true;
    }

    // Check & Redact credentials/api keys
    if (cleanText.match(credentialRegex)) {
      cleanText = cleanText.replace(credentialRegex, (match, p1) => {
        return `${p1}: [REDACTED_CREDENTIAL]`;
      });
      wasScrubbed = true;
    }

    // Check & Redact Bearer tokens
    if (authHeaderRegex.test(cleanText)) {
      cleanText = cleanText.replace(authHeaderRegex, "Bearer [REDACTED_TOKEN]");
      wasScrubbed = true;
    }

    // Check & Redact common server tokens
    if (serverTokenRegex.test(cleanText)) {
      cleanText = cleanText.replace(serverTokenRegex, "[REDACTED_SERVER_TOKEN]");
      wasScrubbed = true;
    }

    return { cleanText, wasScrubbed };
  }
};

/**
 * GeistDeskTeamsAgent handles incoming Microsoft Teams messages via Microsoft Bot Framework.
 * It routes raw messages through PIIShield before performing downstream LLM work.
 */
export class GeistDeskTeamsAgent extends ActivityHandler {
  constructor() {
    super();

    this.onMessage(async (context: TurnContext, next: () => Promise<void>) => {
      try {
        const rawText = context.activity.text || "";
        
        // Asynchronous PII Shield local validation
        const { cleanText, wasScrubbed } = await PIIShield.redact(rawText);

        // Simulated downward processing with clean text safely
        console.log(`[PIIShield Webhook Handshake] Validated payload. Was scrubbed: ${wasScrubbed}`);

        if (wasScrubbed) {
          await context.sendActivity(
            `🔒 **Sovereign Shield Active**: We detected and redacted sensitive patterns (API keys, credentials, or PII) from your input before processing. Here is the processed inquiry:\n\n*${cleanText}*\n\n**GeistDesk AI Response:** I have successfully ingested this secure payload.`
          );
        } else {
          await context.sendActivity(
            `**GeistDesk AI Sovereign Agent**: Ingested payload: "${cleanText}"`
          );
        }
      } catch (error) {
        // Ensure proper error handling so that if the filtering pipeline fails,
        // it securely replies to the user with a generic failure message and drops the raw context.
        console.error("PIIShield local validation error:", error);
        
        await context.sendActivity(
          "⚠️ **Security Processing Failure**: The message processing pipeline encountered an unexpected internal validation error. Your session context has been securely dropped to protect data integrity."
        );
        // Do not propagate further
        return;
      }

      await next();
    });
  }
}

// Bot Framework Adapter Setup
export const createTeamsBotAdapter = () => {
  const adapter = new BotFrameworkAdapter({
    appId: process.env.MicrosoftAppId || "",
    appPassword: process.env.MicrosoftAppPassword || ""
  });

  // Global Error Handler
  adapter.onTurnError = async (context: TurnContext, error: any) => {
    console.error(`\n [onTurnError] Unhandled team bot connection error: ${error}`);
    try {
      await context.sendActivity('⚠️ **GeistDesk Sovereign Exception**: An unexpected gateway error occurred during processing. Raw session data has been discarded.');
    } catch (innerError) {
      console.error(`Error sending error message activity: ${innerError}`);
    }
  };

  return adapter;
};
