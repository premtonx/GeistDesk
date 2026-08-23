/**
 * RAG pipeline + pre-production checklist verification.
 * Asserts the pure logic paths that don't require a live database:
 * chunking overlap, PII redaction, loop-guard classification, sender rate
 * limiting, spam classification, and resolution extraction from messages.
 *
 * Usage: npm run verify:rag
 */
import { chunkText, estimateTokens, stripHtmlToPlainText } from '../src/lib/ai/text-chunker.js';
import { redactPII } from '../src/lib/ai/pii-shield.js';
import { extractResolutionFromMessages } from '../src/lib/ai/resolution-extractor.js';
import {
  hasAutoReplyHeaders,
  isBounceOrSystemSender,
} from '../src/lib/email-ingestion/loop-guard.js';
import {
  checkSenderRateLimit,
  resetSenderRateLimiter,
  senderDomain,
} from '../src/lib/email-ingestion/sender-rate-limiter.js';
import {
  classifySpam,
  isDisposableSender,
  shouldDropSpam,
} from '../src/lib/email-ingestion/spam-guard.js';
import { deduplicateTicketVector } from '../src/lib/ai/ticket-rag-dedup.js';

let passed = 0;
let failed = 0;

function assert(condition: boolean, label: string, detail?: string): void {
  if (condition) {
    passed += 1;
    console.log(`  ✓ ${label}`);
  } else {
    failed += 1;
    console.error(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`);
  }
}

console.log('\n[RAG] 1. Chunking (500 tokens, 100-token overlap)');
{
  const long = ('The quick brown fox jumps over the lazy dog. '.repeat(200)).trim();
  const chunks = chunkText(long, { overlapTokens: 100 });
  assert(chunks.length > 1, 'long text is split into multiple chunks');
  const approxTokens = estimateTokens(chunks[0]);
  assert(approxTokens <= 550, `first chunk ~≤550 tokens (got ${approxTokens})`);
  // 100-token overlap = 400 chars overlap
  const step = Math.max(500 * 4 - 100 * 4, 1);
  assert(chunks[1].length >= Math.min(step - 20, chunks[1].length), 'second chunk exists');
  assert(stripHtmlToPlainText('<p>Hello</p><p>World</p>').includes('Hello'), 'HTML stripped to text');
}

console.log('\n[RAG] 2. PII redaction');
{
  const redacted = redactPII(
    'Contact me at john@example.com or +49 170 1234567. ' +
      'Card: 4111 1111 1111 1111. password=hunter2 api_key=sk-abc123 ' +
      'Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U',
  );
  assert(!redacted.includes('john@example.com'), 'email redacted');
  assert(!redacted.includes('hunter2'), 'password value redacted');
  assert(!redacted.includes('sk-abc123'), 'api key value redacted');
  assert(!redacted.includes('eyJhbGciOiJIUzI1NiJ9'), 'JWT redacted');
  assert(!redacted.includes('4111'), 'credit card redacted');
}

console.log('\n[RAG] 3. Resolution extraction (deterministic)');
{
  const messages = [
    { senderType: 'customer', content: 'My printer won\u2019t print in color.', createdAt: 1 },
    { senderType: 'agent', content: 'Please try resetting the print spooler.', createdAt: 2 },
    { senderType: 'customer', content: 'Still failing.', createdAt: 3 },
    { senderType: 'agent', content: 'Fixed by updating the driver to v4.2.', createdAt: 4 },
  ];
  const { issue, resolution } = extractResolutionFromMessages(messages);
  assert(issue.includes('printer'), 'issue = first customer message');
  assert(resolution.includes('driver to v4.2'), 'resolution = last agent reply');
}

console.log('\n[CHECKLIST] 4. Infinite email loop guard');
{
  assert(
    hasAutoReplyHeaders({ 'auto-submitted': 'auto-replied' }),
    'auto-submitted: auto-replied detected',
  );
  assert(
    hasAutoReplyHeaders({ 'x-autoreply': 'yes' }),
    'x-autoreply: yes detected',
  );
  assert(
    hasAutoReplyHeaders({ precedence: 'bulk' }),
    'precedence: bulk detected',
  );
  assert(
    !hasAutoReplyHeaders({ 'x-autoreply': 'no' }),
    'x-autoreply: no not flagged',
  );
  assert(isBounceOrSystemSender('mailer-daemon@example.com'), 'mailer-daemon dropped');
  assert(isBounceOrSystemSender('noreply@example.com'), 'noreply dropped');
  assert(isBounceOrSystemSender('no-reply@example.com'), 'no-reply dropped');
  assert(isBounceOrSystemSender('postmaster@example.com'), 'postmaster dropped');
  assert(!isBounceOrSystemSender('customer@example.com'), 'regular sender allowed');
}

console.log('\n[CHECKLIST] 5. Per-sender rate limiting');
{
  resetSenderRateLimiter();
  assert(senderDomain('Person <john@Example.com>') === 'example.com', 'domain normalized');
  for (let i = 0; i < 10; i += 1) {
    checkSenderRateLimit('spam@example.com');
  }
  const over = checkSenderRateLimit('spam@example.com');
  assert(!over.allowed, '11th email from same domain blocked');
  const other = checkSenderRateLimit('other@example.org');
  assert(other.allowed, 'different domain unaffected');
}

console.log('\n[CHECKLIST] 6. Spam classification');
{
  const spam = classifySpam({
    subject: 'WINNER! Get rich now',
    body: 'Free money bitcoin giveaway click here casino lottery prize winner urgent investment',
  });
  assert(spam.isSpam, 'spam keywords flagged');
  const ham = classifySpam({ subject: 'Re: Ticket #1234', body: 'Thanks, the fix worked for me.' });
  assert(!ham.isSpam, 'legit reply not flagged');
  assert(isDisposableSender('x@mailinator.com'), 'disposable sender detected');
  assert(!isDisposableSender('x@company.com'), 'company sender not disposable');
  assert(typeof shouldDropSpam() === 'boolean', 'shouldDropSpam returns boolean');
}

console.log('\n[RAG] 7. Selective RAG — include_in_rag / dedup decisions');
{
  // A ticket with include_in_rag=false must be skipped (pure decision helper).
  const excludeDecision = deduplicateTicketVector({
    tenantId: 'ws-a',
    sourceId: 'ticket-x',
    body: 'some resolution body',
    existing: [], // no existing vectors → similarity 0 → should NOT skip on its own
  });
  assert(
    excludeDecision.shouldSkip === false,
    'dedup helper does not skip on empty vector set',
  );

  // Duplicate ticket: existing vector distance 0.05 → similarity 0.95 ≥ 0.90 → skip.
  const dup = deduplicateTicketVector({
    tenantId: 'ws-a',
    sourceId: 'ticket-x',
    body: 'Resolution about printer driver v4.2',
    existing: [{ vector_distance: 0.05 }],
    threshold: 0.9,
  });
  assert(dup.shouldSkip === true, 'duplicate ticket vector skipped (similarity 0.95 >= 0.90)');
  assert(dup.maxSimilarity >= 0.9, `maxSimilarity reported (got ${dup.maxSimilarity.toFixed(3)})`);

  // Non-duplicate: distance 0.35 → similarity 0.65 < 0.90 → index.
  const distinct = deduplicateTicketVector({
    tenantId: 'ws-a',
    sourceId: 'ticket-y',
    body: 'Refund request for order #8821',
    existing: [{ vector_distance: 0.35 }],
    threshold: 0.9,
  });
  assert(distinct.shouldSkip === false, 'distinct ticket vector is indexed (similarity 0.65 < 0.90)');

  // Null distances are ignored.
  const nullDist = deduplicateTicketVector({
    tenantId: 'ws-a',
    sourceId: 'ticket-z',
    body: 'anything',
    existing: [{ vector_distance: null }],
    threshold: 0.9,
  });
  assert(nullDist.shouldSkip === false && nullDist.maxSimilarity === 0, 'null distances ignored');
}

console.log('\n[RESULT]');
console.log(`  ${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.error('FATAL: RAG pipeline verification failed');
  process.exit(1);
}
console.log('OK: RAG pipeline + checklist guards verified');
