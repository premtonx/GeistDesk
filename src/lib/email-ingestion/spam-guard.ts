/**
 * Lightweight inbound spam classification.
 *
 * Runs BEFORE any LLM call so a spam flood never drains the AI budget. It is a
 * heuristic gate, not a full filter: suspicious mail is dropped outright in
 * production / when public registration is disabled, and otherwise marked for
 * agent review (never auto-dispatched).
 */

import { extractEmailAddress } from '../global-blacklist.js';

export interface SpamClassification {
  isSpam: boolean;
  score: number;
  reasons: string[];
}

const SPAM_KEYWORDS =
  /\b(?:viagra|casino|lottery|prize winner|you have won|free money|click here|limited time offer|get rich|cryptocurrency bonus|bitcoin giveaway|urgent investment|nigerian prince|inherit(?:ance)?)\b/gi;

const SPAM_KEYWORDS_DE =
  /\b(?:gewinnspiel|gewinner|lotterie|kostenlos(?:e|es)? geld|jetzt klicken|begrenzte zeit|reich werden|bitcoin geschenk|dringende investition)\b/gi;

const URL_PATTERN = /https?:\/\/[^\s]+/g;

function countKeywordMatches(re: RegExp, text: string): number {
  const matches = text.match(re);
  return matches ? matches.length : 0;
}

/**
 * Score an inbound email (subject + body) on spam signals: keyword density,
 * URL density, unusual "re:" nesting, and all-caps ratio.
 */
export function classifySpam(params: {
  from?: string;
  subject?: string;
  body?: string;
}): SpamClassification {
  const reasons: string[] = [];
  const subject = String(params.subject || '');
  const body = String(params.body || '');
  const text = `${subject}\n${body}`;

  let score = 0;

  const keywordHits = countKeywordMatches(SPAM_KEYWORDS, text);
  if (keywordHits > 0) {
    score += Math.min(keywordHits, 3);
    reasons.push('spam_keywords');
  }
  const keywordHitsDe = countKeywordMatches(SPAM_KEYWORDS_DE, text);
  if (keywordHitsDe > 0) {
    score += Math.min(keywordHitsDe, 3);
    reasons.push('spam_keywords_de');
  }

  const urls = text.match(URL_PATTERN) || [];
  if (urls.length >= 4) {
    score += 1;
    reasons.push('high_url_density');
  }
  if (body.length > 200 && urls.length >= 3) {
    score += 1;
    reasons.push('url_heavy_body');
  }

  const caps = body.replace(/[^A-Z]/g, '').length;
  const letters = body.replace(/[^A-Za-z]/g, '').length;
  if (body.length > 120 && letters > 0 && caps / letters > 0.6) {
    score += 1;
    reasons.push('all_caps_ratio');
  }

  const re = text.match(/re\s*:/gi) || [];
  if (re.length >= 4) {
    score += 1;
    reasons.push('re_nesting');
  }

  return { isSpam: score >= 3, score, reasons };
}

/** Whether suspicious mail should be dropped rather than queued for review. */
export function shouldDropSpam(): boolean {
  const isProd = process.env.NODE_ENV === 'production' || process.env.IS_PROD === 'true';
  const allowPublic = process.env.ALLOW_PUBLIC_REGISTRATION === 'true';
  return isProd && !allowPublic;
}

/** True when a sender looks like a disposable/freemail spam source. */
export function isDisposableSender(sender: string): boolean {
  const email = extractEmailAddress(sender || '').toLowerCase();
  if (!email.includes('@')) return false;
  const domain = email.split('@')[1] || '';
  return /(mailinator\.com|guerrillamail\.|tempmail\.|10minutemail\.|trashmail\.|yopmail\.|sharklasers\.com)/i.test(
    domain,
  );
}
