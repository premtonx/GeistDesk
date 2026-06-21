/**
 * ==============================================================================
 * NEXUS SOVEREIGN PLATFORM - MICROSOFT GRAPH LIVE TRANSCRIPT ROUTER
 * ==============================================================================
 * 
 * Subscribes to Online Meetings webhooks in Microsoft Graph, handles change notifications,
 * buffers speaker text streams, and routes them securely through the PII Shield
 * before performing any Azure OpenAI analysis operations.
 */

import axios from "axios";
import { PIIShield } from "./pii-shield.js";
import { generateAzureAIAnswer } from "./azure-ai-orchestrator.js";

class TranscriptBufferManager {
  constructor() {
    // Stores buffered speaker transcript sections keyed by meetingId/callId
    this.buffers = new Map();
    // Flush timers to bundle streaming outputs after participant pauses speaking
    this.flushTimers = new Map();
  }

  /**
   * Appends an incoming transcript segment to the specified meeting's workspace buffer,
   * scheduling a security processing pipeline execution upon pause.
   */
  async appendChunk(meetingId, segment, onFlushAndAnalyze) {
    if (!this.buffers.has(meetingId)) {
      this.buffers.set(meetingId, []);
    }

    const segments = this.buffers.get(meetingId);
    segments.push(segment);

    console.log(`[TranscriptBuffer] Buffered participant "${segment.speakerName}" text fragment for meeting: "${meetingId}".`);

    // Reset quiet-time buffer timer (triggers flush after 4 seconds of inactive conversation stream)
    if (this.flushTimers.has(meetingId)) {
      clearTimeout(this.flushTimers.get(meetingId));
    }

    const timer = setTimeout(async () => {
      await this.flushAndAnalyze(meetingId, onFlushAndAnalyze);
    }, 4000);

    this.flushTimers.set(meetingId, timer);
  }

  /**
   * Aggregates buffered fragments, executes PII shielding, and forwards sanitized block
   * to Azure OpenAI downstream for contextual summarization or evaluation.
   */
  async flushAndAnalyze(meetingId, onFlushAndAnalyze) {
    const segments = this.buffers.get(meetingId) || [];
    this.buffers.delete(meetingId);
    this.flushTimers.delete(meetingId);

    if (segments.length === 0) return;

    // Concat speaker items
    const rawConversationContext = segments
      .map(s => `[${s.timestamp}] ${s.speakerName}: ${s.text}`)
      .join("\n");

    console.log(`[TranscriptBuffer] Compiling context block for meeting "${meetingId}". Total fragments grouped: ${segments.length}.`);

    try {
      // SECURITY MANDATE: Raw text from Teams transcripts MUST be scrubbed locally prior to any Cloud AI interactions.
      const scrubResult = await PIIShield.redact(rawConversationContext);
      const { cleanText, wasScrubbed } = scrubResult;

      if (wasScrubbed) {
        console.warn(`[TranscriptBuffer Security Alert] Local redaction active. Blocked credentials/emails in meeting "${meetingId}".`);
      }

      // Execute external processing handlers safely using validated cleanText parameters
      await onFlushAndAnalyze(meetingId, cleanText, wasScrubbed);

    } catch (scrubError) {
      console.error(`[TranscriptBuffer Failure] Compliance routing error in meeting ID ${meetingId}:`, scrubError);
      // Fail-secure: Drop raw buffer data on processing failures
    }
  }
}

export const transcriptBuffer = new TranscriptBufferManager();

export const graphTranscriptService = {
  /**
   * Subscribes to Microsoft Graph Change Notifications for communications
   * Target endpoint: POST https://graph.microsoft.com/v1.0/subscriptions
   */
  async subscribeMeetings(accessToken, webhookUrl, clientStateSecret) {
    // communications/onlineMeetings resource subscriptions expire in 4230 minutes max
    const subscriptionExpiry = new Date(Date.now() + 1000 * 60 * 60 * 24); // Expire in 24 hours

    const payload = {
      changeType: "created,updated",
      notificationUrl: webhookUrl,
      resource: "/communications/onlineMeetings",
      expirationDateTime: subscriptionExpiry.toISOString(),
      clientState: clientStateSecret,
      latestSupportedTlsVersion: "v1_2"
    };

    try {
      console.log(`[GraphTranscriptService] Generating subscription on Graph API for: "${payload.resource}"`);
      const response = await axios.post(
        "https://graph.microsoft.com/v1.0/subscriptions",
        payload,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json"
          }
        }
      );

      return response.data;
    } catch (err) {
      console.error("[GraphTranscriptService Subscription ERROR]:", err.response?.data || err.message);
      throw new Error(`Graph API change subscription failed: ${err.message}`);
    }
  },

  /**
   * Processes Graph inbound subscription notification chunks.
   */
  async processNotification(reqBody, secretState) {
    const { value: events } = reqBody;
    if (!events || !Array.isArray(events)) {
      return false;
    }

    for (const event of events) {
      // Step-level Security: ClientState check
      if (event.clientState !== secretState) {
        console.warn("[GraphSubscription Webhook Alert] clientState mismatch! Discarding unauthorized notification request.");
        continue;
      }

      console.log(`[GraphSubscription Webhook] Ingested state validation success for action on: "${event.resource}"`);

      // Mock processing sequence or parse real encrypted payloads
      if (event.resource?.includes("onlineMeetings")) {
        const meetingId = event.resource.split("/")[2] || "session_meeting_alpha";
        
        let speakerName = "Enterprise Participant";
        let textFragment = "Checking API token keys = secret_oauth_token_12345."; // Built-in credential pattern to trigger scrubbing logs

        if (event.resourceData && event.resourceData.content) {
          textFragment = event.resourceData.content.text || "";
          speakerName = event.resourceData.content.speaker?.displayName || "Teams Speaker";
        }

        const segment = {
          speakerName,
          text: textFragment,
          timestamp: new Date().toLocaleTimeString()
        };

        // Channel meeting updates into transcript buffer
        await transcriptBuffer.appendChunk(meetingId, segment, async (mId, cleanConversationBlock, wasScrubbed) => {
          console.log(`[TranscriptBuffer] Safe-flush complete. Querying Azure OpenAI helper for Meeting ID: "${mId}"`);

          try {
            const result = await generateAzureAIAnswer({
              prompt: `Review the following streaming meeting transcript and provide a brief actionable summary list of items:\n\n${cleanConversationBlock}`,
              userId: "SYSTEM_MEETING_ORCHESTRATOR",
              contextDocuments: [
                "Corporate governance requirements require that summaries highlight action owners and due dates."
              ]
            });

            console.log(`\n=================== COMPLIANT MEETING TRANSCRIPT SUMMARY ===================`);
            console.log(`[Meeting Session] : ${mId}`);
            console.log(`[Local Redacted]  : ${wasScrubbed}`);
            console.log(`[Azure Summary]   :\n${result.answer}`);
            console.log(`============================================================================\n`);

          } catch (modelError) {
            console.error(`[TranscriptBuffer downstream AI task failed]: ${modelError.message}`);
          }
        });
      }
    }

    return true;
  }
};
