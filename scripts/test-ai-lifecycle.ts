/**
 * Dry-run tests for the AI request lifecycle middleware.
 * Runs without database persistence or external API calls.
 *
 * Usage: npm run test:lifecycle
 */
import {
  DEFAULT_ORCHESTRATOR_CONFIG,
  DEFAULT_CONFIDENCE_THRESHOLDS,
} from '../src/types/aiOrchestrator.js';
import {
  runAiRequestLifecycle,
  resumeApprovedAiRequest,
  stubAiModelExecutor,
} from '../src/lib/ai-request-lifecycle.js';

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

async function testSmartReplyAutomatic(): Promise<void> {
  console.log('\n[1] Smart Reply — automatic gate, high confidence');
  const result = await runAiRequestLifecycle(
    { feature: 'smart_reply', prompt: 'Draft a reply for ticket #1234' },
    { config: DEFAULT_ORCHESTRATOR_CONFIG, skipPersistence: true, executor: stubAiModelExecutor },
  );
  assert(result.status === 'completed', 'completes without approval hold');
  assert(result.steps.some((s) => s.step === 'approval_gate' && s.status === 'passed'), 'approval gate passed (automatic)');
  assert(result.explainability?.logLine.includes('model='), 'explainability log written');
  assert((result.confidence ?? 0) >= DEFAULT_CONFIDENCE_THRESHOLDS.smart_reply, 'meets confidence threshold');
}

async function testKbGenerationManagerApproval(): Promise<void> {
  console.log('\n[2] KB Generation — manager approval gate');
  const result = await runAiRequestLifecycle(
    { feature: 'kb_generation', prompt: 'Generate KB article from ticket context' },
    { config: DEFAULT_ORCHESTRATOR_CONFIG, skipPersistence: true, skipApprovalGate: false },
  );
  assert(result.status === 'pending_approval', 'pauses for manager approval');
  assert(result.steps.some((s) => s.step === 'approval_gate' && s.status === 'pending'), 'approval gate pending');
  assert(!result.output, 'no output before approval');
}

async function testRootCauseEngineerApproval(): Promise<void> {
  console.log('\n[3] Root Cause Analysis — engineer approval gate');
  const result = await runAiRequestLifecycle(
    { feature: 'root_cause_analysis', prompt: 'Analyze root cause for outage' },
    { config: DEFAULT_ORCHESTRATOR_CONFIG, skipPersistence: true },
  );
  assert(result.status === 'pending_approval', 'pauses for engineer approval');
}

async function testLowConfidenceHumanReview(): Promise<void> {
  console.log('\n[4] Confidence threshold — routes to human review pool');
  const lowConfidenceExecutor = async () => ({
    output: 'uncertain draft',
    confidence: 0.72,
    costUsd: 0.002,
  });

  const result = await runAiRequestLifecycle(
    { feature: 'smart_reply', prompt: 'Ambiguous customer issue' },
    {
      config: DEFAULT_ORCHESTRATOR_CONFIG,
      skipPersistence: true,
      skipApprovalGate: true,
      executor: lowConfidenceExecutor,
    },
  );
  assert(result.status === 'pending_review', 'routes to human review pool');
  assert(result.steps.some((s) => s.step === 'confidence_threshold_check' && s.status === 'pending'), 'confidence check pending');
  assert((result.confidence ?? 1) < DEFAULT_CONFIDENCE_THRESHOLDS.smart_reply, 'below smart_reply threshold');
}

async function testMemoryPolicyVip(): Promise<void> {
  console.log('\n[5] Memory policy — VIP data not remembered');
  const result = await runAiRequestLifecycle(
    {
      feature: 'ticket_summarization',
      prompt: 'Summarize VIP customer thread',
      customerScope: 'vip',
    },
    { config: DEFAULT_ORCHESTRATOR_CONFIG, skipPersistence: true, skipApprovalGate: true, executor: stubAiModelExecutor },
  );
  assert(result.status === 'completed', 'execution completes');
  assert(
    result.steps.some((s) => s.step === 'memory_policy' && s.detail?.includes('VIP')),
    'VIP memory binding applied',
  );
}

async function testPiiShieldRedaction(): Promise<void> {
  console.log('\n[6] PII shield — redacts email in prompt');
  const result = await runAiRequestLifecycle(
    { feature: 'smart_reply', prompt: 'Contact user at secret@example.com for details' },
    { config: DEFAULT_ORCHESTRATOR_CONFIG, skipPersistence: true, skipApprovalGate: true, executor: stubAiModelExecutor },
  );
  assert(result.redactedPrompt?.includes('[REDACTED_EMAIL]'), 'email redacted locally');
  assert(result.steps.some((s) => s.step === 'check_pii_shields' && s.status === 'passed'), 'PII step passed');
}

async function testDecisionEngineFlow(): Promise<void> {
  console.log('\n[7] Decision engine — full step pipeline recorded');
  const result = await runAiRequestLifecycle(
    { feature: 'translation', prompt: 'Translate to German: Hello' },
    { config: DEFAULT_ORCHESTRATOR_CONFIG, skipPersistence: true, skipApprovalGate: true, executor: stubAiModelExecutor },
  );
  const stepNames = result.steps.map((s) => s.step);
  assert(stepNames.includes('request_received'), 'starts with request_received');
  assert(stepNames.includes('detect_feature_context'), 'detects feature context');
  assert(stepNames.includes('assign_compliant_model'), 'assigns compliant model');
  assert(stepNames.includes('file_audit_log'), 'files audit log');
  assert(result.steps.length >= 10, `records ${result.steps.length} pipeline steps`);
}

async function testResumeAfterApproval(): Promise<void> {
  console.log('\n[8] Resume — approved request executes');
  const result = await resumeApprovedAiRequest(
    { feature: 'kb_generation', prompt: 'Approved KB draft content' },
    { config: DEFAULT_ORCHESTRATOR_CONFIG, skipPersistence: true, executor: stubAiModelExecutor },
  );
  assert(result.status === 'pending_review' || result.status === 'completed', 'executes after approval bypass');
  assert(result.steps.some((s) => s.step === 'approval_gate' && s.detail?.includes('Pre-approved')), 'skips approval hold');
}

async function testKillSwitchBlocks(): Promise<void> {
  console.log('\n[9] Kill switch — blocks disabled feature');
  const result = await runAiRequestLifecycle(
    { feature: 'smart_reply', prompt: 'Should be blocked' },
    {
      config: {
        ...DEFAULT_ORCHESTRATOR_CONFIG,
        killSwitch: { ...DEFAULT_ORCHESTRATOR_CONFIG.killSwitch, smartReply: true },
      },
      skipPersistence: true,
    },
  );
  assert(result.status === 'blocked', 'blocked by kill switch');
}

async function main(): Promise<void> {
  console.log('AI Request Lifecycle — dry-run test suite');
  console.log('='.repeat(50));

  await testSmartReplyAutomatic();
  await testKbGenerationManagerApproval();
  await testRootCauseEngineerApproval();
  await testLowConfidenceHumanReview();
  await testMemoryPolicyVip();
  await testPiiShieldRedaction();
  await testDecisionEngineFlow();
  await testResumeAfterApproval();
  await testKillSwitchBlocks();

  console.log('\n' + '='.repeat(50));
  console.log(`Results: ${passed} passed, ${failed} failed`);

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Test suite crashed:', err);
  process.exit(1);
});
