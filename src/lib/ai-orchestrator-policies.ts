import {
  AI_CORPORATE_POLICY_RULES,
  AI_TRUST_LEVEL_DEFINITIONS,
  DEFAULT_CORPORATE_POLICIES,
  DEFAULT_DATA_RESIDENCY_POLICY,
  LOCAL_PROVIDER_IDS,
  PROVIDER_RESIDENCY_MAP,
  type AiCorporatePolicies,
  type AiOrchestratorConfig,
  type AiPolicyCompilationResult,
  type AiPolicyValidationResult,
  type AiRiskScoreAssessment,
  type AiTrustLevel,
  type AiTrustLevelDefinition,
} from '../types/aiOrchestrator.js';

const CLOUD_PROVIDER_IDS = new Set(['gpt-5', 'claude', 'gemini-flash', 'gemini-pro', 'openai', 'anthropic', 'google']);

function isCloudProvider(providerId: string): boolean {
  if (LOCAL_PROVIDER_IDS.has(providerId)) return false;
  return CLOUD_PROVIDER_IDS.has(providerId) || !LOCAL_PROVIDER_IDS.has(providerId);
}

function isLocalProvider(providerId: string): boolean {
  return LOCAL_PROVIDER_IDS.has(providerId);
}

function vaultUsesCloud(config: AiOrchestratorConfig): boolean {
  const vaultModel = config.featureRouting.vault_insights;
  return !isLocalProvider(vaultModel);
}

export function resolveTrustLevelDefinition(trustLevel: AiTrustLevel): AiTrustLevelDefinition {
  return AI_TRUST_LEVEL_DEFINITIONS[trustLevel];
}

export function mergeCorporatePolicies(partial?: Partial<AiCorporatePolicies>): AiCorporatePolicies {
  return { ...DEFAULT_CORPORATE_POLICIES, ...partial };
}

export function mergeDataResidencyPolicy(
  partial?: Partial<AiOrchestratorConfig['dataResidencyPolicy']>,
): AiOrchestratorConfig['dataResidencyPolicy'] {
  return { ...DEFAULT_DATA_RESIDENCY_POLICY, ...partial };
}

/** Validates corporate boolean rules against the active orchestrator configuration. */
export function validateCorporatePolicyRules(config: AiOrchestratorConfig): AiPolicyValidationResult {
  const policies = config.corporatePolicies ?? DEFAULT_CORPORATE_POLICIES;
  const violations: AiPolicyValidationResult['violations'] = [];

  if (policies.customerPiiNeverLeavesWorkspace && !config.piiEnabled) {
    violations.push({
      rule: 'customerPiiNeverLeavesWorkspace',
      message: AI_CORPORATE_POLICY_RULES.customerPiiNeverLeavesWorkspace.description,
    });
  }

  if (policies.vaultAnalysisMustStayLocal && vaultUsesCloud(config)) {
    violations.push({
      rule: 'vaultAnalysisMustStayLocal',
      message: `Vault insights is routed to "${config.featureRouting.vault_insights}" — must use a local provider.`,
    });
  }

  if (policies.rootCauseAnalysisRequiresAuditLogging && !config.auditEnabled) {
    violations.push({
      rule: 'rootCauseAnalysisRequiresAuditLogging',
      message: AI_CORPORATE_POLICY_RULES.rootCauseAnalysisRequiresAuditLogging.description,
    });
  }

  if (policies.promptLoggingRequiresExplicitConsent && config.promptLoggingEnabled) {
    violations.push({
      rule: 'promptLoggingRequiresExplicitConsent',
      message: 'Prompt logging is enabled without explicit corporate consent.',
    });
  }

  const trust = resolveTrustLevelDefinition(config.trustLevel ?? 3);
  if (
    policies.cloudFallbackRequiresApproval &&
    trust.requiresHumanApproval === false &&
    config.providerPriority.some((p) => isCloudProvider(p))
  ) {
    violations.push({
      rule: 'cloudFallbackRequiresApproval',
      message: 'Cloud providers are in the failover chain without required human approval.',
    });
  }

  return { valid: violations.length === 0, violations };
}

function providerAllowedInRegions(
  providerId: string,
  policy: AiOrchestratorConfig['dataResidencyPolicy'],
): boolean {
  if (isLocalProvider(providerId)) return true;

  const regions = PROVIDER_RESIDENCY_MAP[providerId] ?? ['USA'];
  const allowed = policy.allowedRegions ?? DEFAULT_DATA_RESIDENCY_POLICY.allowedRegions;

  if (policy.customerDataNeverLeavesEU) {
    const euCompliant = regions.some((r) => r === 'EU' || r === 'Germany');
    if (!euCompliant) return false;
  }

  return regions.some((r) => allowed.includes(r));
}

/** Filters provider IDs by data residency policy during compilation runs. */
export function filterProvidersByDataResidency(
  providers: string[],
  policy: AiOrchestratorConfig['dataResidencyPolicy'],
): { allowed: string[]; excluded: string[] } {
  const allowed: string[] = [];
  const excluded: string[] = [];

  for (const providerId of providers) {
    if (providerAllowedInRegions(providerId, policy)) {
      allowed.push(providerId);
    } else {
      excluded.push(providerId);
    }
  }

  return { allowed, excluded };
}

/**
 * Compiles the effective provider priority chain by applying trust level,
 * data residency router, and corporate policy constraints.
 */
export function compileOrchestratorPolicy(config: AiOrchestratorConfig): AiPolicyCompilationResult {
  const trust = resolveTrustLevelDefinition(config.trustLevel ?? 3);
  const residency = config.dataResidencyPolicy ?? DEFAULT_DATA_RESIDENCY_POLICY;
  const policies = config.corporatePolicies ?? DEFAULT_CORPORATE_POLICIES;
  const violations: string[] = [];

  let candidates = [...(config.providerPriority?.length ? config.providerPriority : [config.primaryModel])];

  if (trust.localOnly) {
    candidates = candidates.filter((p) => isLocalProvider(p));
    if (candidates.length === 0) candidates = ['local-llama'];
  } else if (trust.allowedCloudProviders.length > 0) {
    candidates = candidates.filter(
      (p) => isLocalProvider(p) || trust.allowedCloudProviders.includes(p),
    );
  }

  const { allowed, excluded } = filterProvidersByDataResidency(candidates, residency);

  if (policies.vaultAnalysisMustStayLocal && vaultUsesCloud(config)) {
    violations.push('Vault Analysis must stay 100% Local — re-route vault_insights to local-llama.');
  }

  if (policies.customerPiiNeverLeavesWorkspace && !config.piiEnabled) {
    violations.push('Customer PII policy requires PII redaction to remain enabled.');
  }

  const corporateValidation = validateCorporatePolicyRules(config);
  for (const v of corporateValidation.violations) {
    violations.push(v.message);
  }

  let providerPriority = allowed.length > 0 ? allowed : ['local-llama'];

  if (excluded.length > 0 && residency.customerDataNeverLeavesEU) {
    violations.push(
      `Customer Data Never Leaves EU — excluded non-compliant endpoints: ${excluded.join(', ')}`,
    );
  }

  return {
    providerPriority,
    excludedProviders: excluded,
    enforcedAuditLogging: trust.mandatoryAuditLogging || config.auditEnabled,
    requiresHumanApproval: trust.requiresHumanApproval,
    violations,
  };
}

export function evaluateEnterpriseAiRiskScore(config: AiOrchestratorConfig): AiRiskScoreAssessment {
  const factors: AiRiskScoreAssessment['factors'] = [];
  let score = 18;

  if (config.promptLoggingEnabled) {
    factors.push({ id: 'prompt_logging', label: 'Prompt logging enabled', impact: 14 });
    score += 14;
  }

  if (vaultUsesCloud(config)) {
    factors.push({ id: 'vault_cloud', label: 'Vault analysis routed to cloud', impact: 12 });
    score += 12;
  }

  if (!config.piiEnabled) {
    factors.push({ id: 'pii_disabled', label: 'PII redaction disabled', impact: 16 });
    score += 16;
  }

  if (!config.auditEnabled) {
    factors.push({ id: 'audit_disabled', label: 'Audit logging disabled', impact: 10 });
    score += 10;
  }

  const trust = config.trustLevel ?? 3;
  if (trust <= 2) {
    factors.push({ id: 'low_trust', label: 'Low trust tier (documentation/experimental)', impact: 8 });
    score += 8;
  }

  const residency = config.dataResidencyPolicy ?? DEFAULT_DATA_RESIDENCY_POLICY;
  if (!residency.customerDataNeverLeavesEU) {
    factors.push({ id: 'eu_egress', label: 'Customer data may leave EU', impact: 11 });
    score += 11;
  }

  const cloudInPriority = config.providerPriority.filter((p) => isCloudProvider(p)).length;
  if (cloudInPriority >= 2 && trust >= 4) {
    factors.push({ id: 'cloud_failover', label: 'Multiple cloud providers in failover chain', impact: 6 });
    score += 6;
  }

  if (config.corporatePolicies?.vaultAnalysisMustStayLocal && vaultUsesCloud(config)) {
    factors.push({ id: 'vault_policy_violation', label: 'Vault local policy violated', impact: 9 });
    score += 9;
  }

  score = Math.max(0, Math.min(100, score));

  const recommendations: string[] = [];

  if (vaultUsesCloud(config)) {
    recommendations.push('Move Vault Analysis Local to reduce risk by -12%.');
  }
  if (config.promptLoggingEnabled) {
    recommendations.push('Disable prompt logging to reduce risk by -14%.');
  }
  if (!config.auditEnabled) {
    recommendations.push('Enable audit logging to reduce risk by -10%.');
  }
  if (!residency.customerDataNeverLeavesEU) {
    recommendations.push('Enable "Customer Data Never Leaves EU" to reduce risk by -11%.');
  }
  if (trust <= 2) {
    recommendations.push('Raise trust level to 4 Stars (Business Operations) to reduce risk by -8%.');
  }
  if (!config.piiEnabled) {
    recommendations.push('Enable PII redaction to reduce risk by -16%.');
  }

  if (recommendations.length === 0) {
    recommendations.push('Configuration aligns with enterprise baseline — maintain current policy posture.');
  }

  let level: AiRiskScoreAssessment['level'] = 'low';
  if (score >= 75) level = 'critical';
  else if (score >= 50) level = 'elevated';
  else if (score >= 30) level = 'moderate';

  return { score, level, factors, recommendations };
}
