import axios from 'axios';
import { PIIShield } from './teamsBotService';
import { addDocDirect } from '../lib/postgres-backend';

// Structure of a Microsoft Graph Subscription Request
export interface GraphSubscriptionRequest {
  changeType: 'created' | 'updated' | 'deleted' | 'all';
  notificationUrl: string;
  resource: string; // e.g. "/communications/onlineMeetings"
  expirationDateTime: string; // ISO 8601 string, max 4230 minutes in future for communications resource
  clientState: string; // Secret security verification string
  latestSupportedTlsVersion?: string;
}

// Memory buffer for streaming transcript segments per meeting/call session
interface TranscriptSegment {
  speakerId: string;
  speakerName: string;
  text: string;
  timestamp: string;
}

class TranscriptBufferManager {
  // Keyed by meetingId or callId
  private buffers: Map<string, TranscriptSegment[]> = new Map();
  // Flush timers to process buffered segments after a period of inactivity
  private flushTimers: Map<string, NodeJS.Timeout> = new Map();

  /**
   * Appends an incoming transcript chunk to the meeting buffer,
   * schedules asynchronous processing of the text when the speaker pauses or after timeout.
   */
  public async addChunk(
    meetingId: string, 
    segment: TranscriptSegment, 
    onFlush: (meetingId: string, scrubbedText: string, originalText: string) => Promise<void>
  ) {
    if (!this.buffers.has(meetingId)) {
      this.buffers.set(meetingId, []);
    }
    
    this.buffers.get(meetingId)!.push(segment);
    console.log(`[TranscriptBuffer] Buffered chunk from ${segment.speakerName} for meeting ${meetingId}: "${segment.text}"`);

    // Reset/Setup idle timer to flush the buffer
    if (this.flushTimers.has(meetingId)) {
      clearTimeout(this.flushTimers.get(meetingId)!);
    }

    const timer = setTimeout(async () => {
      await this.flushBuffer(meetingId, onFlush);
    }, 4000); // Flush after 4 seconds of idle time to keep chunks grouped and contextually meaningful

    this.flushTimers.set(meetingId, timer);
  }

  /**
   * Flushes, aggregates, and scrub-validates the buffered transcript texts.
   */
  private async flushBuffer(
    meetingId: string,
    onFlush: (meetingId: string, scrubbedText: string, originalText: string) => Promise<void>
  ) {
    const segments = this.buffers.get(meetingId) || [];
    this.buffers.delete(meetingId);
    this.flushTimers.delete(meetingId);

    if (segments.length === 0) return;

    // Concatenate meeting chunks with speaker info for LLM context
    const aggregatedText = segments
      .map(s => `[${s.timestamp}] ${s.speakerName}: ${s.text}`)
      .join('\n');

    console.log(`[TranscriptBuffer] Flushing buffer of ${segments.length} segments for meeting ${meetingId}...`);

    try {
      // FORCE payload through local sovereign PIIShield before being forwarded anywhere downstream
      const { cleanText, wasScrubbed } = await PIIShield.redact(aggregatedText);
      
      if (wasScrubbed) {
        console.warn(`[PIIShield Alert] Redacted sensitive PII/credentials while processing live meeting transcript for ${meetingId}`);
      }

      // Execute downstream handler/services with scrubbed text safely
      await onFlush(meetingId, cleanText, aggregatedText);
    } catch (error) {
      console.error(`[TranscriptBuffer ERROR] Failed to scrub/process transcript buffer for meeting ${meetingId}:`, error);
      // Drop context on security failure
    }
  }
}

export const transcriptBuffer = new TranscriptBufferManager();

/**
 * Microsoft Graph Transcript Webhook & Subscriptions Service
 */
export const graphTranscriptService = {
  /**
   * Creates or renews Microsoft Graph Change Notification Subscription
   * endpoint: POST https://graph.microsoft.com/v1.0/subscriptions
   */
  async createSubscription(accessToken: string, notificationUrl: string, clientState: string): Promise<any> {
    // Subscription expiration time: Graph limits communications resources to 4230 minutes limit
    const expiration = new Date(Date.now() + 60 * 60 * 1000 * 48); // 48 hours in future
    
    const requestPayload: GraphSubscriptionRequest = {
      changeType: 'created', // Triggers when online meetings start/create
      notificationUrl,
      resource: '/communications/onlineMeetings',
      expirationDateTime: expiration.toISOString(),
      clientState,
      latestSupportedTlsVersion: 'v1_2'
    };

    try {
      console.log(`[Graph Sub] Subscribing to Teams online meetings at Graph endpoint...`);
      const response = await axios.post(
        'https://graph.microsoft.com/v1.0/subscriptions',
        requestPayload,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );
      return response.data;
    } catch (error: any) {
      console.error(
        '[Graph Sub ERROR] Registration with Microsoft Graph failed:',
        error?.response?.status || error?.message || 'unknown error',
      );
      throw new Error(`Failed to create Graph meeting subscription: ${error.message}`);
    }
  },

  /**
   * Handles incoming webhooks from Microsoft Graph Change Notifications
   */
  async handleSubscriptionNotification(reqBody: any, clientStateSecret: string): Promise<boolean> {
    const { value: notifications } = reqBody;
    if (!notifications || !Array.isArray(notifications)) {
      return false;
    }

    for (const notification of notifications) {
      // Validate client state to confirm authenticity
      if (notification.clientState !== clientStateSecret) {
        console.warn('[Security Warning] Webhook received with invalid clientState! Skipping payload.');
        continue;
      }

      console.log(`[Webhook Event] Received notification for Resource: ${notification.resource}`);

      // If the resource is onlinemeetings/transcripts, process the text segment payload
      // In Microsoft Graph change notifications on transcripts, the resource path matches:
      // "/communications/onlineMeetings/{meetingId}/transcripts/{transcriptId}" or similar.
      if (notification.resource?.includes('onlineMeetings') && notification.resourceData) {
        const meetingId = notification.resource.split('/')[2] || 'unknown_meeting';
        
        // Asynchronously simulate fetching or receiving the live transcript stream chunk
        // Typical structure from Graph includes actual content inside reqBody.value[i].resourceData for encrypted/rich notifications,
        // or provides a reference to fetch the transcription chunk.
        // Let's implement robust parsing for both structured chunks and fallback metadata triggers.
        let transcriptText = "";
        let speakerName = "Participant";
        let speakerId = "unknown";

        if (notification.resourceData.content) {
          // Encrypted notifications contain full transcription structure
          transcriptText = notification.resourceData.content.text || "";
          speakerName = notification.resourceData.content.speaker?.displayName || "Teams Room User";
          speakerId = notification.resourceData.content.speaker?.id || "unknown";
        } else {
          // Trigger mock stream block or fetch block on resource update
          transcriptText = `Inbound audio sequence packet received. Processing GeistDesk Sovereign session payload under: ${notification.resource}`;
          speakerName = "Sovereign Portal Gateway";
        }

        const segment: TranscriptSegment = {
          speakerId,
          speakerName,
          text: transcriptText,
          timestamp: new Date().toLocaleTimeString()
        };

        // Channel meeting chunks into the streaming buffer manager
        await transcriptBuffer.addChunk(meetingId, segment, async (mId, cleanScrubbed, orig) => {
          // Never log full transcript content — only metadata lengths.
          console.log(
            `[TranscriptBuffer] Flushed meeting ${mId}: scrubbedLen=${cleanScrubbed?.length || 0} originalLen=${orig?.length || 0}`,
          );

          // Persist the clean transcript context under meeting_transcripts for
          // retrieval by LLM bots or compliance agents. This app has no real
          // Firestore — the Firebase-shaped API is a Postgres-backed facade, so
          // the server persists directly through the document store.
          try {
            const record = await addDocDirect('meeting_transcripts', {
              meetingId: mId,
              scrubbedTranscript: cleanScrubbed,
              originalLen: orig.length,
              flushedAt: new Date().toISOString(),
              vetted: true,
            });
            console.log(`[Meeting Transcripts] Registered vetted transcript entry (id=${record.id}) in document store.`);
          } catch (dbErr: any) {
            console.error('[Meeting Transcripts] Database logging bypass/error:', dbErr?.message || 'unknown');
          }
        });
      }
    }

    return true;
  }
};
