/**
 * Resolved-ticket resolution capture for RAG ingestion.
 *
 * Modes (per-workspace, see rag_pipeline_config):
 *  - 'extract': deterministic extraction of the first customer message + last
 *    agent reply from the ticket message subcollection.
 *  - 'ai_generated': LLM-generated concise Q&A summary via the AI lifecycle.
 *  - 'hybrid' (default): deterministic extraction, falling back to an AI
 *    summary only when no useful agent reply exists.
 */

import { getDocsDirect, updateDocDirect } from '../postgres-backend.js';
import { stripHtmlToPlainText } from './text-chunker.js';
import { redactPII } from './pii-shield.js';
import { getRagPipelineConfig, type RagResolutionMode } from '../rag-pipeline-config.js';

interface ResolutionMessage {
  senderType?: string;
  content?: string;
  text_content?: string;
  html_content?: string;
  createdAt?: unknown;
}

interface ResolutionSource {
  issue: string;
  resolution: string;
}

const strip = (value: unknown): string =>
  stripHtmlToPlainText(String(value || '')).trim();

/** Fetch the ticket's messages (subcollection `tickets/{id}/messages`). */
export async function fetchTicketMessages(ticketId: string): Promise<ResolutionMessage[]> {
  try {
    return (await getDocsDirect(`tickets/${ticketId}/messages`, [])) as unknown as ResolutionMessage[];
  } catch (err: unknown) {
    console.warn('[resolution-extractor] message fetch failed:', (err as Error)?.message || err);
    return [];
  }
}

/**
 * Deterministic extraction: first customer message (the issue) + the last
 * agent/AI reply (the accepted resolution). Returns empty strings when absent.
 */
export function extractResolutionFromMessages(
  messages: ResolutionMessage[],
): ResolutionSource {
  const customers = messages.filter((m) => String(m.senderType || '').toLowerCase() === 'customer');
  const agents = messages.filter((m) => {
    const type = String(m.senderType || '').toLowerCase();
    return type === 'agent' || type === 'ai';
  });

  const issue = strip(customers[0]?.content ?? customers[0]?.text_content ?? '');
  const resolution = strip(agents[agents.length - 1]?.content ?? agents[agents.length - 1]?.text_content ?? '');
  return { issue, resolution };
}

/**
 * Generate a concise Q&A summary through the AI lifecycle. Failures fall back
 * to an empty result so indexing can proceed with the extracted text.
 */
export async function generateResolutionSummary(
  ticketId: string,
  issue: string,
  resolution: string,
  workspaceId: string,
): Promise<string> {
  try {
    const { runAiRequestLifecycle } = await import('../ai-request-lifecycle.js');
    const subject = resolution.trim();
    const prompt = [
      'Erstelle eine kompakte Q&A-Zusammenfassung einer abgeschlossenen Support-Anfrage für die Wissensbasis.',
      'Antworte NUR mit dem Zusammenfassungstext, ohne Einleitung.',
      '',
      'Problem (Kunde):',
      issue.slice(0, 4000) || '(keine Angabe)',
      '',
      'Lösung (Agent):',
      subject.slice(0, 4000) || '(keine Angabe)',
    ].join('\n');

    const result = await runAiRequestLifecycle(
      {
        workspaceId,
        feature: 'ticket_summarization',
        prompt,
        ticketId,
        metadata: { purpose: 'rag_resolution_summary', auto: true },
      },
      { skipPersistence: false },
    );

    const output = String(result.output || '').trim();
    return output.length >= 20 ? output : '';
  } catch (err: unknown) {
    console.warn('[resolution-extractor] AI summary failed:', (err as Error)?.message || err);
    return '';
  }
}

/**
 * Build the resolution body for RAG indexing according to the configured mode.
 * The result is cached on the ticket doc as `resolution` so the vector indexer
 * (and status endpoints) can reuse it.
 */
export async function buildTicketResolution(
  ticketDoc: Record<string, unknown>,
  messages: ResolutionMessage[],
  workspaceId: string,
): Promise<{ issue: string; resolution: string; mode: RagResolutionMode }> {
  const config = await getRagPipelineConfig(workspaceId);
  const mode = config.resolutionMode;

  const stored = String(ticketDoc.resolution || ticketDoc.resolutionNotes || '').trim();
  if (stored) {
    return { issue: strip(ticketDoc.description), resolution: stored, mode };
  }

  const extracted = extractResolutionFromMessages(messages);
  let resolution = extracted.resolution;

  if (mode === 'ai_generated' || (mode === 'hybrid' && !resolution)) {
    resolution =
      (await generateResolutionSummary(
        String(ticketDoc.id || ''),
        extracted.issue || strip(ticketDoc.description),
        resolution || extracted.issue || strip(ticketDoc.description),
        workspaceId,
      )) || resolution;
  }

  const issue = extracted.issue || strip(ticketDoc.description);
  const finalResolution = resolution || extracted.issue || issue;

  // Cache on the ticket doc so the RAG indexer and status endpoint reuse it.
  if (finalResolution && String(ticketDoc.id)) {
    await updateDocDirect('tickets', String(ticketDoc.id), {
      resolution: finalResolution,
      resolutionCapturedAt: new Date().toISOString(),
      resolutionMode: mode,
      updatedAt: new Date().toISOString(),
    }).catch((err: unknown) => {
      console.warn('[resolution-extractor] resolution cache write failed:', (err as Error)?.message || err);
    });
  }

  return { issue, resolution: finalResolution, mode };
}

/**
 * Redact obvious PII before embedding: emails, credit cards, phone numbers,
 * names plus secrets/tokens/passwords. Honors the workspace redact_pii flag.
 */
export async function redactForRag(text: string, workspaceId: string): Promise<string> {
  const config = await getRagPipelineConfig(workspaceId);
  if (!config.redactPii) return text;
  return redactPII(text);
}
