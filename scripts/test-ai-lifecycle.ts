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
import {
  rehydrateResponseData,
  resetEphemeralTokenStores,
  scrubSensitiveData,
} from '../src/lib/ai-data-anonymization.js';
import {
  persistAiResponseCache,
  resetInMemoryAiCache,
} from '../src/lib/ai-response-cache.js';

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

async function testScrubRehydrateUtilities(): Promise<void> {
  console.log('\n[10] Anonymization utilities — scrub and rehydrate roundtrip');
  resetEphemeralTokenStores();
  const source =
    'Acme Corp VPN uses db-primary.internal.corp at 10.20.1.44 postgres://admin:SecretPass99@db-primary.internal.corp/prod';
  const scrub = scrubSensitiveData(source, { workspaceName: 'Acme Corp' });
  assert(scrub.wasScrubbed, 'scrub detects sensitive fingerprints');
  assert(scrub.scrubbedText.includes('{{GD_TOKEN_'), 'placeholder tokens injected');
  assert(!scrub.scrubbedText.includes('SecretPass99'), 'password removed from outbound text');

  const modelEcho = `Please use ${Object.keys(scrub.tokenMap)[0]} for the database connection.`;
  const restored = rehydrateResponseData(modelEcho, scrub.tokenMap);
  assert(restored.replacements > 0, 'rehydration replaces placeholders');
  assert(!restored.rehydratedText.includes('{{GD_TOKEN_'), 'placeholders removed from client output');
}

async function testCloudLifecycleScrubAndRehydrate(): Promise<void> {
  console.log('\n[11] Cloud route — lifecycle scrub + response rehydration');
  resetEphemeralTokenStores();
  const echoExecutor = async ({ prompt }: { prompt: string }) => {
    const hostToken = prompt.match(/\{\{GD_TOKEN_HOST_\d+\}\}/)?.[0] ?? '{{GD_TOKEN_HOST_1}}';
    return {
      output: `Connect using host ${hostToken} and report status.`,
      confidence: 0.95,
      costUsd: 0.001,
    };
  };

  const cloudConfig = {
    ...DEFAULT_ORCHESTRATOR_CONFIG,
    featureRouting: {
      ...DEFAULT_ORCHESTRATOR_CONFIG.featureRouting,
      smart_reply: 'gemini-flash',
    },
    providerPriority: ['gemini-flash', 'local-llama'],
    primaryModel: 'gemini-flash',
    trustLevel: 4 as const,
  };

  const result = await runAiRequestLifecycle(
    {
      feature: 'smart_reply',
      prompt: 'Troubleshoot db-primary.internal.corp latency for Acme Corp operators.',
      metadata: { workspaceName: 'Acme Corp' },
    },
    {
      config: cloudConfig,
      skipPersistence: true,
      skipApprovalGate: true,
      executor: echoExecutor,
    },
  );

  assert(result.status === 'completed', 'cloud lifecycle completes');
  assert(result.redactedPrompt?.includes('{{GD_TOKEN_'), 'outbound prompt tokenized');
  assert(result.output?.includes('db-primary.internal.corp'), 'hostname rehydrated in response');
  assert(result.steps.some((s) => s.step === 'check_pii_shields' && s.detail?.includes('token map')), 'PII step records token map');
}

async function testLocalRouteSkipsReversibleScrub(): Promise<void> {
  console.log('\n[12] Local Llama route — skips reversible cloud token map');
  resetEphemeralTokenStores();
  const localConfig = {
    ...DEFAULT_ORCHESTRATOR_CONFIG,
    featureRouting: {
      ...DEFAULT_ORCHESTRATOR_CONFIG.featureRouting,
      smart_reply: 'local-llama',
    },
    providerPriority: ['local-llama'],
    primaryModel: 'local-llama',
    trustLevel: 5 as const,
  };

  const result = await runAiRequestLifecycle(
    { feature: 'smart_reply', prompt: 'password: LocalOnlySecret99 on db.internal.corp' },
    {
      config: localConfig,
      skipPersistence: true,
      skipApprovalGate: true,
      executor: stubAiModelExecutor,
    },
  );

  assert(result.status === 'completed', 'local lifecycle completes');
  assert(
    result.steps.some((s) => s.step === 'check_pii_shields' && s.detail?.includes('token map skipped')),
    'local route skips reversible scrub',
  );
}

async function testEntityCacheHitBypassesExecutor(): Promise<void> {
  console.log('\n[13] Entity cache — CACHE_HIT bypasses LLM executor');
  resetInMemoryAiCache();

  let execCalls = 0;
  const countingExecutor = async () => {
    execCalls += 1;
    return { output: 'should-not-run', confidence: 0.99, costUsd: 0.01 };
  };

  const ctx = {
    feature: 'smart_reply' as const,
    prompt: 'Draft a reply for ticket cache validation',
    ticketId: 'ticket-cache-hit-1',
  };

  await persistAiResponseCache(
    ctx,
    {
      output: '[cached] Prior smart reply payload for reload',
      confidence: 0.93,
      assignedModel: 'cached-model',
      promptFingerprint: '',
    },
    { skipPersistence: true },
  );

  const result = await runAiRequestLifecycle(ctx, {
    config: DEFAULT_ORCHESTRATOR_CONFIG,
    skipPersistence: true,
    skipApprovalGate: true,
    executor: countingExecutor,
  });

  assert(result.status === 'completed', 'cache hit completes');
  assert(result.fromCache === true, 'result flagged fromCache');
  assert(execCalls === 0, 'executor not invoked on CACHE_HIT');
  assert(
    result.steps.some((s) => s.step === 'cache_lookup' && s.detail?.includes('CACHE_HIT')),
    'cache_lookup records CACHE_HIT',
  );
  assert(result.explainability?.policiesChecked.includes('cache_hit'), 'explainability logs cache_hit');
}

async function testForceRefreshBypassesCache(): Promise<void> {
  console.log('\n[14] Entity cache — forceRefresh bypasses CACHE_HIT');
  resetInMemoryAiCache();

  let execCalls = 0;
  const countingExecutor = async ({ prompt }: { prompt: string }) => {
    execCalls += 1;
    return { output: `[fresh] ${prompt.slice(0, 40)}`, confidence: 0.95, costUsd: 0.002 };
  };

  const ctx = {
    feature: 'smart_reply' as const,
    prompt: 'Regenerate smart reply after ticket update',
    ticketId: 'ticket-force-refresh-1',
  };

  await persistAiResponseCache(
    ctx,
    {
      output: '[cached] stale payload',
      confidence: 0.9,
      assignedModel: 'cached-model',
      promptFingerprint: '',
    },
    { skipPersistence: true },
  );

  const result = await runAiRequestLifecycle(
    { ...ctx, forceRefresh: true },
    {
      config: DEFAULT_ORCHESTRATOR_CONFIG,
      skipPersistence: true,
      skipApprovalGate: true,
      executor: countingExecutor,
    },
  );

  assert(result.status === 'completed', 'fresh execution completes');
  assert(result.fromCache !== true, 'forceRefresh does not serve cache');
  assert(execCalls === 1, 'executor invoked when forceRefresh=true');
  assert(
    result.steps.some((s) => s.step === 'cache_lookup' && s.detail?.includes('forceRefresh')),
    'cache_lookup skipped due to forceRefresh',
  );
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
  await testScrubRehydrateUtilities();
  await testCloudLifecycleScrubAndRehydrate();
  await testLocalRouteSkipsReversibleScrub();
  await testEntityCacheHitBypassesExecutor();
  await testForceRefreshBypassesCache();

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
