/**
 * Day-0 first-run onboarding: initialization flag, AI ping, atomic complete.
 */

import { z } from 'zod';
import {
  getDocDirect,
  queryDb,
  setDocDirect,
  updateDocDirect,
  withPgTransaction,
} from './postgres-backend.js';
import { hashPassword } from './crypto.js';
import {
  DEFAULT_MODULE_CONFIG,
  DEFAULT_PLATFORM_MODULES,
  normalizeModuleConfig,
  normalizePlatformModules,
  type AIConfig,
  type ModuleConfig,
  type PlatformModules,
} from './module-config.js';
import {
  upsertOrchestratorConfig,
  setProviderSecret,
  getOrchestratorConfig,
} from './ai-orchestrator-store.js';
import { detectLocalModels } from './ai-orchestrator-service.js';
import { createEmailChannel, listEmailChannels } from './email-ingestion/channel-store.js';
import { setPersonalVaultInitialized } from './personal-vault-store.js';
import { purgeSeededVaultFolders } from './vault-demo-purge.js';
import { seedDemoSimulation } from './demo-simulation-seed.js';
import {
  purgeDemoAutopilotFixtures,
  purgeFrontendSeedKbArticles,
  purgeKbCoverageCache,
  purgePlaceholderKbCategories,
} from './kb-demo-purge.js';
import { getOllamaEndpoint } from './runtime-env.js';
import { resolveTenantFromRequest, DEFAULT_TENANT_ID } from './tenant-context.js';
import { safeErrorMessage } from './safe-log.js';
import type { EmailConnectionType } from './email-ingestion/types.js';
import type { Request } from 'express';
import {
  ORCHESTRATOR_MODEL_OPTIONS,
  featureRoutingForModel,
  type AiFeatureRouting,
} from '../types/aiOrchestrator.js';

const MODULE_COLLECTION = 'module_config';
const MODULE_DOC_ID = 'global';
const WORKSPACE_ID = 'default';

export const AI_MODES = ['sovereign', 'cloud', 'disabled'] as const;
export type OnboardingAiMode = (typeof AI_MODES)[number];

export const CLOUD_PROVIDERS = ['openai', 'azure', 'anthropic', 'groq'] as const;
export type OnboardingCloudProvider = (typeof CLOUD_PROVIDERS)[number];

export const INGEST_CHANNELS = ['webhook', 'microsoft_graph', 'imap'] as const;
export type OnboardingIngestChannel = (typeof INGEST_CHANNELS)[number];

const passwordSchema = z
  .string()
  .min(12, 'Password must be at least 12 characters')
  .max(128)
  .regex(/[A-Z]/, 'Password must include an uppercase letter')
  .regex(/[a-z]/, 'Password must include a lowercase letter')
  .regex(/[0-9]/, 'Password must include a number');

export const testAiSchema = z.object({
  mode: z.enum(AI_MODES),
  endpointUrl: z.string().max(500).optional().default(''),
  apiKey: z.string().max(500).optional().default(''),
  provider: z.enum(CLOUD_PROVIDERS).optional(),
  chatModel: z.string().max(200).optional().default(''),
  embeddingModel: z.string().max(200).optional().default(''),
});

export const completeOnboardingSchema = z.object({
  // Optional on resume: when an admin already exists the values are derived
  // from the authenticated session (req.user) instead of a re-filled form.
  adminEmail: z.string().email().max(320).optional(),
  adminName: z.string().trim().max(200).optional(),
  newPassword: passwordSchema.optional(),
  vaultPassphraseSet: z.boolean().optional().default(false),
  ai: testAiSchema,
  modules: z
    .object({
      geistKB: z.boolean(),
      geistVault: z.boolean(),
      geistExchange: z.boolean(),
    })
    .default({ geistKB: true, geistVault: true, geistExchange: true }),
  ingestion: z
    .object({
      skip: z.boolean().optional().default(false),
      channel: z.enum(INGEST_CHANNELS).optional().default('webhook'),
      supportEmail: z.string().email().max(320).optional(),
      imapHost: z.string().max(255).optional(),
      imapUser: z.string().max(320).optional(),
      imapPassword: z.string().max(500).optional(),
      graphTenantId: z.string().max(255).optional(),
      graphClientId: z.string().max(255).optional(),
      graphClientSecret: z.string().max(500).optional(),
    })
    .optional()
    .default({ skip: true, channel: 'webhook' }),
  importSampleData: z.boolean().optional().default(false),
});

export const registerAdminSchema = z.object({
  adminEmail: z.string().email().max(320),
  adminName: z.string().trim().min(1, 'Administrator name is required').max(200),
  newPassword: passwordSchema,
  vaultPassphraseSet: z.boolean().optional().default(false),
});

export type CompleteOnboardingInput = z.infer<typeof completeOnboardingSchema>;
export type RegisterAdminInput = z.infer<typeof registerAdminSchema>;
export type TestAiInput = z.infer<typeof testAiSchema>;

export interface OnboardingStatus {
  isInitialized: boolean;
  hasAdminUser: boolean;
  initializedAt?: string;
  initializedBy?: string;
  requiresOnboarding: boolean;
  /** True when the workspace is partially set up — the wizard should resume. Covers both
   *  `is_initialized=true` with interrupted side effects, and the stuck state where an admin
   *  exists but `/complete` never ran (is_initialized still false). */
  needsResume: boolean;
  modules: PlatformModules;
  defaults: {
    ollamaEndpoint: string;
    chatModel: string;
    embeddingModel: string;
  };
  health: {
    database: 'ok' | 'error';
    pgvector: boolean;
  };
}

/** Post-transaction side-effect progress for the Day-0 wizard. */
export interface OnboardingStepState {
  secretsStored: boolean;
  emailChannelCreated: boolean;
  vaultInitialized: boolean;
  demoPurged: boolean;
  sampleImported: boolean;
}

export const EMPTY_ONBOARDING_STEPS: OnboardingStepState = {
  secretsStored: false,
  emailChannelCreated: false,
  vaultInitialized: false,
  demoPurged: false,
  sampleImported: false,
};

function readOnboardingSteps(config: ModuleConfig | null): OnboardingStepState {
  const stored = (config as { onboardingSteps?: Partial<OnboardingStepState> } | null)?.onboardingSteps;
  return { ...EMPTY_ONBOARDING_STEPS, ...(stored || {}) };
}

async function persistOnboardingSteps(steps: OnboardingStepState): Promise<void> {
  await updateDocDirect(MODULE_COLLECTION, MODULE_DOC_ID, {
    onboardingSteps: steps,
    updatedAt: new Date().toISOString(),
  });
}

/** True when every post-transaction side effect has finished (or was skipped). */
export function isOnboardingComplete(config: ModuleConfig | null): boolean {
  if (config?.is_initialized !== true) return false;
  const steps = readOnboardingSteps(config);
  return (
    steps.secretsStored &&
    steps.emailChannelCreated &&
    steps.vaultInitialized &&
    steps.demoPurged &&
    steps.sampleImported
  );
}

function emptyModuleConfig(): ModuleConfig {
  return normalizeModuleConfig({
    ...DEFAULT_MODULE_CONFIG,
    is_initialized: false,
    platformModules: { ...DEFAULT_PLATFORM_MODULES },
  });
}

export async function loadModuleConfigDoc(): Promise<ModuleConfig | null> {
  const doc = await getDocDirect(MODULE_COLLECTION, MODULE_DOC_ID);
  if (!doc) return null;
  return normalizeModuleConfig(doc);
}

/**
 * Boot-time initialization state.
 * Never writes is_initialized=true — that happens only in completeOnboarding().
 * Missing documents (or a missing flag) stay uninitialized so the wizard runs.
 */
export async function ensureOnboardingState(): Promise<OnboardingStatus> {
  const existing = await getDocDirect(MODULE_COLLECTION, MODULE_DOC_ID);

  if (!existing) {
    const fresh = emptyModuleConfig();
    await setDocDirect(MODULE_COLLECTION, MODULE_DOC_ID, {
      ...fresh,
      is_initialized: false,
      updatedAt: new Date().toISOString(),
    });
    console.log('[Onboarding] Fresh install detected — is_initialized=false');
    return toStatus(fresh, false, false);
  }

  // Undo the former boot heuristic that stamped true with initializedBy=legacy-migration
  // without the wizard ever completing.
  const autoMigrated =
    existing.is_initialized === true && existing.initializedBy === 'legacy-migration';

  if (existing.is_initialized !== true || autoMigrated) {
    if (existing.is_initialized !== false || autoMigrated) {
      await updateDocDirect(MODULE_COLLECTION, MODULE_DOC_ID, {
        is_initialized: false,
        initializedAt: null,
        initializedBy: null,
        updatedAt: new Date().toISOString(),
      });
      console.log(
        autoMigrated
          ? '[Onboarding] Reverted legacy-migration auto-init — is_initialized=false'
          : '[Onboarding] module_config.is_initialized missing — defaulted to false',
      );
    }
    return toStatus(normalizeModuleConfig({ ...existing, is_initialized: false }), await hasPrimaryAdmin(), false);
  }

  return toStatus(normalizeModuleConfig(existing), await hasPrimaryAdmin(), false);
}

async function probePgvector(): Promise<boolean> {
  try {
    await queryDb('SELECT 1 FROM "KnowledgeEmbedding" LIMIT 1');
    return true;
  } catch {
    return false;
  }
}

export async function hasPrimaryAdmin(): Promise<boolean> {
  const found = await queryDb(
    `SELECT 1 FROM geistdesk_documents
      WHERE collection = 'users'
        AND COALESCE(data->>'isDeactivated', 'false') NOT IN ('true', '1')
        AND (
          data->>'is_admin' IN ('true', '1')
          OR lower(coalesce(data->>'role', '')) IN ('admin', 'system_admin')
        )
      LIMIT 1`,
  );
  return (found.rowCount || 0) > 0;
}

/** True first-run only: no admin yet and the wizard has not completed. */
export async function needsFirstRun(): Promise<boolean> {
  if (await hasPrimaryAdmin()) return false;
  const config = await loadModuleConfigDoc();
  return config?.is_initialized !== true;
}

function toStatus(config: ModuleConfig, hasAdmin: boolean, isAuthenticatedAdmin: boolean): OnboardingStatus {
  const ollama = getOllamaEndpoint() || 'http://ollama:11434';
  const complete = isOnboardingComplete(config);
  const status: OnboardingStatus = {
    isInitialized: config.is_initialized === true,
    hasAdminUser: hasAdmin,
    initializedAt: config.initializedAt,
    initializedBy: config.initializedBy,
    requiresOnboarding: config.is_initialized !== true && !hasAdmin,
    // Resume whenever an admin exists but the workspace is not fully set up —
    // this also covers the stuck state where register-admin succeeded but the
    // wizard never reached /complete (is_initialized still false). Previously
    // that state dead-ended: no path to finish AI/Modules/Ingestion config.
    needsResume: hasAdmin && !complete,
    modules: config.platformModules || DEFAULT_PLATFORM_MODULES,
    defaults: {
      ollamaEndpoint: '',
      chatModel: '',
      embeddingModel: '',
    },
    health: {
      database: 'ok',
      pgvector: false,
    },
  };
  // Endpoint/model defaults are internal configuration. Only expose them to an
  // authenticated admin session (wizard resume); unauthenticated callers must
  // not learn the server-side Ollama endpoint from the public status probe.
  if (isAuthenticatedAdmin) {
    status.defaults = {
      ollamaEndpoint: ollama.replace(/\/v1\/?$/, ''),
      chatModel: 'llama3.1',
      embeddingModel: 'nomic-embed-text',
    };
  }
  return status;
}

export async function getOnboardingStatus(req?: Request): Promise<OnboardingStatus> {
  const config = (await loadModuleConfigDoc()) || emptyModuleConfig();
  const user = (req as { user?: { role?: string; is_admin?: boolean } | null } | undefined)?.user;
  const isAuthenticatedAdmin = user?.role === 'SYSTEM_ADMIN' || user?.is_admin === true;
  const status = toStatus(config, await hasPrimaryAdmin(), isAuthenticatedAdmin);
  status.health.pgvector = await probePgvector();
  return status;
}

function normalizeEndpoint(raw: string): string {
  const trimmed = String(raw || '').trim().replace(/\/$/, '');
  return trimmed;
}

export async function testAiConnection(input: TestAiInput): Promise<{
  success: boolean;
  message: string;
  latencyMs?: number;
  models?: string[];
}> {
  if (input.mode === 'disabled') {
    return { success: true, message: 'AI disabled — rules-only mode. No live ping required.' };
  }

  const started = Date.now();

  if (input.mode === 'sovereign') {
    const endpoint = normalizeEndpoint(input.endpointUrl || getOllamaEndpoint() || 'http://ollama:11434');
    if (!endpoint) {
      return { success: false, message: 'Ollama host endpoint is required.' };
    }
    try {
      const models = await detectLocalModels(endpoint, input.apiKey || undefined);
      const latencyMs = Date.now() - started;
      if (!models.length) {
        return {
          success: false,
          message: `Reached ${endpoint} but no models were listed. Pull a chat model (e.g. llama3.1) and an embedding model (nomic-embed-text).`,
          latencyMs,
        };
      }
      return {
        success: true,
        message: `Connected to Ollama — ${models.length} model(s) available.`,
        latencyMs,
        models: models.slice(0, 12).map((m) => m.id),
      };
    } catch (err) {
      return {
        success: false,
        message: `Ollama unreachable at ${endpoint}: ${safeErrorMessage(err, 'connection failed')}`,
        latencyMs: Date.now() - started,
      };
    }
  }

  const provider = input.provider || 'openai';
  const apiKey = String(input.apiKey || '').trim();
  if (!apiKey) {
    return { success: false, message: `API key is required for ${provider}.` };
  }

  try {
    const result = await pingCloudProvider(provider, apiKey, input.endpointUrl, input.chatModel);
    return { ...result, latencyMs: Date.now() - started };
  } catch (err) {
    return {
      success: false,
      message: safeErrorMessage(err, `${provider} connection failed`),
      latencyMs: Date.now() - started,
    };
  }
}

async function pingCloudProvider(
  provider: OnboardingCloudProvider,
  apiKey: string,
  endpointUrl?: string,
  chatModel?: string,
): Promise<{ success: boolean; message: string; models?: string[] }> {
  const controller = AbortSignal.timeout(8000);

  if (provider === 'openai') {
    const res = await fetch('https://api.openai.com/v1/models', {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: controller,
    });
    if (!res.ok) {
      return { success: false, message: `OpenAI rejected the key (HTTP ${res.status}).` };
    }
    const data = (await res.json()) as { data?: Array<{ id: string }> };
    const ids = (data.data || []).map((m) => m.id).slice(0, 8);
    const wanted = chatModel || 'gpt-4o-mini';
    const hasModel = !chatModel || ids.some((id) => id.includes(wanted.replace(/^gpt-/, 'gpt-')));
    return {
      success: true,
      message: hasModel
        ? `OpenAI connected${chatModel ? ` — ${chatModel} reachable` : ''}.`
        : `OpenAI connected. Model "${wanted}" was not in the first page of /v1/models (it may still be available).`,
      models: ids,
    };
  }

  if (provider === 'anthropic') {
    const res = await fetch('https://api.anthropic.com/v1/models', {
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      signal: controller,
    });
    if (!res.ok) {
      return { success: false, message: `Anthropic rejected the key (HTTP ${res.status}).` };
    }
    return { success: true, message: 'Anthropic connected.' };
  }

  if (provider === 'groq') {
    const res = await fetch('https://api.groq.com/openai/v1/models', {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: controller,
    });
    if (!res.ok) {
      return { success: false, message: `Groq rejected the key (HTTP ${res.status}).` };
    }
    return { success: true, message: 'Groq connected.' };
  }

  // Azure OpenAI — resource endpoint required
  const azureBase = normalizeEndpoint(endpointUrl || '');
  if (!azureBase) {
    return { success: false, message: 'Azure OpenAI resource endpoint is required (e.g. https://YOUR-RESOURCE.openai.azure.com).' };
  }
  const url = `${azureBase.replace(/\/$/, '')}/openai/models?api-version=2024-02-15-preview`;
  const res = await fetch(url, {
    headers: { 'api-key': apiKey },
    signal: controller,
  });
  if (!res.ok) {
    return { success: false, message: `Azure OpenAI rejected the configuration (HTTP ${res.status}).` };
  }
  return { success: true, message: 'Azure OpenAI connected.' };
}

const ROUTING_MODEL_IDS = new Set<string>(ORCHESTRATOR_MODEL_OPTIONS.map((option) => option.value));

/** Map the Day-0 engine pick onto a Feature-Routing catalog id. */
export function resolveOnboardingRoutingModel(ai: TestAiInput): string {
  const chat = String(ai.chatModel || '').trim();
  const chatLower = chat.toLowerCase();

  if (ROUTING_MODEL_IDS.has(chat)) return chat;

  if (chatLower.includes('qwen')) return 'qwen-36b';
  if (chatLower.includes('gemini-pro') || chatLower.includes('gemini-2.5-pro')) return 'gemini-pro';
  if (chatLower.includes('gemini') || chatLower.includes('flash')) return 'gemini-flash';
  if (
    chatLower.includes('claude') ||
    chatLower.includes('sonnet') ||
    chatLower.includes('opus') ||
    chatLower.includes('haiku')
  ) {
    return 'claude';
  }
  if (chatLower.includes('gpt') || chatLower.includes('o1') || chatLower.includes('o3') || /\bo4\b/.test(chatLower)) {
    return 'gpt-5';
  }

  if (ai.mode === 'sovereign' || ai.mode === 'disabled') return 'local-llama';
  if (ai.provider === 'anthropic') return 'claude';
  if (ai.provider === 'groq') return 'local-llama';
  if (ai.provider === 'azure' || ai.provider === 'openai') return 'gpt-5';
  return 'local-llama';
}

function moduleAiFromOnboarding(ai: TestAiInput, routingModel: string, endpointUrl: string): AIConfig {
  const chat = ai.chatModel?.trim();
  if (ai.mode === 'sovereign' || ai.mode === 'disabled') {
    return {
      sentimentModel: routingModel === 'gemini-flash' ? 'gemini-flash' : 'local-llama',
      deepThinkingModel: routingModel === 'qwen-36b' ? 'qwen-36b' : 'llama-3-70b',
      summaryModel: 'sentiment',
      localEndpoint: endpointUrl,
      apiKey: '',
      customSentimentModelName: chat || 'llama3.1',
      customThinkingModelName: chat || 'llama3.1',
    };
  }
  if (routingModel === 'gemini-flash' || routingModel === 'gemini-pro') {
    return {
      sentimentModel: 'gemini-flash',
      deepThinkingModel: 'gemini-pro',
      summaryModel: 'sentiment',
      localEndpoint: endpointUrl,
      apiKey: '',
    };
  }
  return {
    sentimentModel: 'custom-local',
    deepThinkingModel: 'custom-local',
    summaryModel: 'sentiment',
    localEndpoint: endpointUrl,
    apiKey: '',
    customSentimentModelName: chat || routingModel,
    customThinkingModelName: chat || routingModel,
  };
}

function mapAiToOrchestrator(ai: TestAiInput): {
  endpointUrl: string;
  primaryModel: string;
  reasoningModel: string;
  triageModel: string;
  providerPriority: string[];
  featureRouting: AiFeatureRouting;
  killSwitchMaster: boolean;
  secretProvider?: string;
  secretValue?: string;
} {
  const routingModel = resolveOnboardingRoutingModel(ai);
  const routing = featureRoutingForModel(routingModel);

  if (ai.mode === 'disabled') {
    return {
      endpointUrl: '',
      primaryModel: routingModel,
      reasoningModel: routingModel,
      triageModel: routingModel,
      providerPriority: [routingModel],
      featureRouting: routing,
      killSwitchMaster: true,
    };
  }

  if (ai.mode === 'sovereign') {
    const endpoint = normalizeEndpoint(ai.endpointUrl || getOllamaEndpoint() || 'http://ollama:11434');
    const withV1 = endpoint.endsWith('/v1') ? endpoint : `${endpoint}/v1`;
    return {
      endpointUrl: withV1,
      primaryModel: routingModel,
      reasoningModel: routingModel,
      triageModel: routingModel,
      providerPriority: [routingModel],
      featureRouting: routing,
      killSwitchMaster: false,
      secretProvider: ai.apiKey ? 'local' : undefined,
      secretValue: ai.apiKey || undefined,
    };
  }

  const provider = ai.provider || 'openai';
  if (provider === 'anthropic') {
    return {
      endpointUrl: '',
      primaryModel: routingModel,
      reasoningModel: routingModel,
      triageModel: routingModel,
      providerPriority: [routingModel],
      featureRouting: routing,
      killSwitchMaster: false,
      secretProvider: 'anthropic',
      secretValue: ai.apiKey,
    };
  }
  if (provider === 'groq') {
    return {
      endpointUrl: 'https://api.groq.com/openai/v1',
      primaryModel: routingModel,
      reasoningModel: routingModel,
      triageModel: routingModel,
      providerPriority: [routingModel],
      featureRouting: routing,
      killSwitchMaster: false,
      secretProvider: 'local',
      secretValue: ai.apiKey,
    };
  }
  if (provider === 'azure') {
    const endpoint = normalizeEndpoint(ai.endpointUrl || '');
    return {
      endpointUrl: endpoint,
      primaryModel: routingModel,
      reasoningModel: routingModel,
      triageModel: routingModel,
      providerPriority: [routingModel],
      featureRouting: routing,
      killSwitchMaster: false,
      secretProvider: 'azure_openai',
      secretValue: ai.apiKey,
    };
  }
  return {
    endpointUrl: '',
    primaryModel: routingModel,
    reasoningModel: routingModel,
    triageModel: routingModel,
    providerPriority: [routingModel, 'claude', 'gemini-flash', 'local-llama'].filter(
      (id, index, all) => all.indexOf(id) === index,
    ),
    featureRouting: routing,
    killSwitchMaster: false,
    secretProvider: 'openai',
    secretValue: ai.apiKey,
  };
}

function mapIngestChannel(channel: OnboardingIngestChannel): EmailConnectionType {
  if (channel === 'microsoft_graph') return 'microsoft_graph';
  if (channel === 'imap') return 'imap_basic';
  return 'webhook';
}

export class OnboardingAlreadyCompleteError extends Error {
  constructor() {
    super('GeistDesk is already initialized. Sign in at /login.');
    this.name = 'OnboardingAlreadyCompleteError';
  }
}

export class OnboardingAdminExistsError extends Error {
  constructor() {
    super('An administrator already exists. Sign in at /login.');
    this.name = 'OnboardingAdminExistsError';
  }
}

export interface OnboardingAdminUser {
  id: string;
  email: string;
  name: string;
  role: string;
  is_admin: boolean;
  tenantId: string;
}

/** Reject as soon as any admin row exists — blocks mid-wizard takeovers. */
async function assertNoAdminExists(): Promise<void> {
  if (await hasPrimaryAdmin()) {
    throw new OnboardingAdminExistsError();
  }
}

async function assertNotInitialized(): Promise<void> {
  const config = await loadModuleConfigDoc();
  if (config?.is_initialized === true) {
    throw new OnboardingAlreadyCompleteError();
  }
}

async function upsertPrimaryAdminUser(input: {
  adminEmail: string;
  adminName: string;
  newPassword: string;
  req: Request;
}): Promise<{ adminUser: OnboardingAdminUser; userId: string }> {
  const cleanEmail = input.adminEmail.toLowerCase().trim();
  const adminName = input.adminName.trim();
  const { id: userId, existing: existingUser } = await resolvePrimaryAdminId(cleanEmail);
  const tenantId =
    (typeof existingUser.tenantId === 'string' && existingUser.tenantId.trim()) ||
    resolveTenantFromRequest(input.req) ||
    DEFAULT_TENANT_ID;
  const passwordHash = await hashPassword(input.newPassword);
  const now = new Date().toISOString();

  const userDoc = {
    ...existingUser,
    name: adminName,
    email: cleanEmail,
    passwordHash,
    authMethod: 'password',
    role: 'admin',
    is_admin: true,
    isDeactivated: false,
    can_create_tickets: true,
    can_view_knowledgebase: true,
    tenantId,
    createdAt: existingUser.createdAt || now,
    updatedAt: now,
  };
  delete (userDoc as { password?: unknown }).password;

  await setDocDirect('users', userId, userDoc);

  const adminUser: OnboardingAdminUser = {
    id: userId,
    email: cleanEmail,
    name: adminName,
    role: 'admin',
    is_admin: true,
    tenantId,
  };

  input.req.user = {
    id: userId,
    email: cleanEmail,
    name: adminName,
    role: 'SYSTEM_ADMIN',
    is_admin: true,
    tenantId,
  };

  return { adminUser, userId };
}

export async function registerPrimaryAdmin(
  req: Request,
  input: RegisterAdminInput,
): Promise<{ success: true; user: OnboardingAdminUser; isInitialized: false }> {
  await assertNotInitialized();
  await assertNoAdminExists();
  const { adminUser, userId } = await upsertPrimaryAdminUser({
    adminEmail: input.adminEmail,
    adminName: input.adminName,
    newPassword: input.newPassword,
    req,
  });
  if (input.vaultPassphraseSet) {
    await setPersonalVaultInitialized(userId, true);
  }
  return { success: true, user: adminUser, isInitialized: false };
}

async function resolvePrimaryAdminId(email: string): Promise<{ id: string; existing: Record<string, unknown> }> {
  const found = await queryDb(
    `SELECT id, data FROM geistdesk_documents
      WHERE collection = 'users' AND lower(trim(data->>'email')) = $1
      LIMIT 1`,
    [email],
  );
  if (found.rows[0]?.id) {
    const raw = found.rows[0].data;
    const parsed =
      raw == null
        ? {}
        : typeof raw === 'string'
          ? (JSON.parse(raw) as Record<string, unknown>)
          : (raw as Record<string, unknown>);
    return { id: String(found.rows[0].id), existing: parsed };
  }

  const reserved = await getDocDirect('users', 'user-primary-admin');
  if (!reserved) {
    return { id: 'user-primary-admin', existing: {} };
  }
  return { id: `user-admin-${Date.now()}`, existing: {} };
}

async function importOnboardingSampleData(opts: {
  tenantId: string;
  userId: string;
  includeKb: boolean;
}): Promise<{ tickets: number; articles: number; tags: number }> {
  const now = new Date().toISOString();
  const simulation = await seedDemoSimulation({
    actorUserId: opts.userId,
    tenantId: opts.tenantId,
    replaceLegacySamples: true,
  });

  const tags = [
    { id: 'tag-sample-network', name: 'network', color: '#2563eb', tenantId: opts.tenantId, createdAt: now },
    { id: 'tag-sample-email', name: 'email', color: '#059669', tenantId: opts.tenantId, createdAt: now },
    { id: 'tag-sample-auth', name: 'auth', color: '#d97706', tenantId: opts.tenantId, createdAt: now },
  ];

  const articles = opts.includeKb
    ? [
        {
          id: 'kb-sample-welcome',
          title: 'Willkommen bei GeistDesk',
          category: 'Onboarding',
          subCategory: 'Erste Schritte',
          content:
            '<h2>Willkommen</h2><p>Dieser Einführungsartikel erklärt die wichtigsten Bereiche: Tickets, Wissen und Vault.</p><p>Sie können ihn jederzeit bearbeiten oder löschen.</p>',
          tags: ['onboarding', 'intro'],
          authorId: opts.userId,
          status: 'Published',
          visibility: 'Internal',
          tenantId: opts.tenantId,
          createdAt: now,
          updatedAt: now,
        },
        {
          id: 'kb-sample-ticket-triage',
          title: 'Tickets priorisieren',
          category: 'Support',
          subCategory: 'Workflow',
          content:
            '<h2>Triage</h2><p>Beispielartikel: Priorisieren Sie eingehende Tickets nach Dringlichkeit und Kundenwirkung.</p>',
          tags: ['tickets', 'triage'],
          authorId: opts.userId,
          status: 'Published',
          visibility: 'Internal',
          tenantId: opts.tenantId,
          createdAt: now,
          updatedAt: now,
        },
      ]
    : [];

  for (const tag of tags) {
    await setDocDirect('tags', tag.id, tag);
  }
  for (const article of articles) {
    await setDocDirect('kb_articles', article.id, article);
  }

  return { tickets: simulation.tickets, articles: articles.length, tags: tags.length };
}

export async function completeOnboarding(
  req: Request,
  input: CompleteOnboardingInput,
): Promise<{
  success: true;
  isInitialized: true;
  channelId?: string;
  tenantId: string;
  user: OnboardingAdminUser;
  modules: PlatformModules;
  importSampleData: boolean;
}> {
  const existing = (await loadModuleConfigDoc()) || emptyModuleConfig();

  // Resume path: the transactional core already committed (is_initialized=true)
  // but some post-transaction side effect was interrupted. Idempotently finish
  // the remaining steps instead of failing forever.
  if (existing.is_initialized === true) {
    if (isOnboardingComplete(existing)) {
      throw new OnboardingAlreadyCompleteError();
    }
    return resumeOnboardingSteps(req, input, existing);
  }

  await assertNotInitialized();
  const userId = String(req.user?.id || '');
  if (!userId) {
    throw new Error('Authenticated administrator is required.');
  }

  const existingUser = ((await getDocDirect('users', userId)) || {}) as Record<string, unknown>;
  const cleanEmail = (input.adminEmail || String(req.user?.email || '')).toLowerCase().trim();
  const adminName = input.adminName?.trim() || String(req.user?.name || existingUser.name || 'Administrator').trim();

  const tenantId =
    (typeof existingUser.tenantId === 'string' && existingUser.tenantId.trim()) ||
    resolveTenantFromRequest(req) ||
    DEFAULT_TENANT_ID;

  // Resume of the stuck mid-wizard state: the admin row already exists with a
  // working passwordHash, so never overwrite it with an empty/weak value.
  // Only the fresh path (no admin row) may set a new password.
  const passwordHash = input.newPassword ? await hashPassword(input.newPassword) : String(existingUser.passwordHash || '');
  const now = new Date().toISOString();
  const platformModules = normalizePlatformModules({
    tickets: true,
    geistKB: input.modules.geistKB,
    geistVault: input.modules.geistVault,
    geistExchange: input.modules.geistExchange,
  });

  const adminUser: OnboardingAdminUser = {
    id: userId,
    email: cleanEmail,
    name: adminName,
    role: 'admin',
    is_admin: true,
    tenantId,
  };

  req.user = {
    id: userId,
    email: cleanEmail,
    name: adminName,
    role: 'SYSTEM_ADMIN',
    is_admin: true,
    tenantId,
  };

  const aiMapped = mapAiToOrchestrator(input.ai);
  const nextConfig: ModuleConfig = normalizeModuleConfig({
    ...existing,
    is_initialized: true,
    initializedAt: now,
    initializedBy: cleanEmail,
    onboardingSteps: EMPTY_ONBOARDING_STEPS,
    platformModules,
    modules: platformModules,
    ai: {
      ...existing.ai,
      ...moduleAiFromOnboarding(input.ai, aiMapped.primaryModel, aiMapped.endpointUrl),
    },
    email: {
      ...existing.email,
      supportEmail: input.ingestion?.supportEmail || existing.email.supportEmail,
      senderName: existing.email.senderName || 'GeistDesk Support',
      imapHost: input.ingestion?.imapHost || existing.email.imapHost,
      autoTriageEnabled: true,
      threadingEnabled: true,
    },
  });

  const existingCfg = await getOrchestratorConfig(WORKSPACE_ID);
  await upsertOrchestratorConfig(
    {
      workspaceId: WORKSPACE_ID,
      endpointUrl: aiMapped.endpointUrl,
      primaryModel: aiMapped.primaryModel,
      reasoningModel: aiMapped.reasoningModel,
      triageModel: aiMapped.triageModel,
      providerPriority: aiMapped.providerPriority,
      featureRouting: aiMapped.featureRouting,
      killSwitch: {
        ...existingCfg.killSwitch,
        master: aiMapped.killSwitchMaster,
      },
    },
    userId,
  );

  const userDoc = {
    ...existingUser,
    name: adminName,
    email: cleanEmail,
    ...(passwordHash ? { passwordHash } : {}),
    authMethod: existingUser.authMethod || 'password',
    role: 'admin',
    is_admin: true,
    isDeactivated: false,
    can_create_tickets: true,
    can_view_knowledgebase: true,
    tenantId,
    createdAt: existingUser.createdAt || now,
    updatedAt: now,
  };
  delete (userDoc as { password?: unknown }).password;

  await withPgTransaction(async (client) => {
    await client.query(
      `INSERT INTO geistdesk_documents (collection, id, data)
       VALUES ('users', $1, $2::jsonb)
       ON CONFLICT (collection, id) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()`,
      [userId, JSON.stringify(userDoc)],
    );

    await client.query(
      `INSERT INTO geistdesk_documents (collection, id, data)
       VALUES ('module_config', 'global', $1::jsonb)
       ON CONFLICT (collection, id) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()`,
      [
        JSON.stringify({
          ...nextConfig,
          tenantId,
          modules: platformModules,
          platformModules,
          onboardingSteps: EMPTY_ONBOARDING_STEPS,
          updatedAt: now,
        }),
      ],
    );
  });

  return resumeOnboardingSteps(req, input, normalizeModuleConfig(nextConfig));
}

/**
 * Runs the post-transaction side effects idempotently. Each step is guarded by
 * persisted step-state in module_config; interrupted runs resume from the next
 * incomplete step instead of duplicating work or failing permanently.
 */
async function resumeOnboardingSteps(
  req: Request,
  input: CompleteOnboardingInput,
  config: ModuleConfig,
): Promise<{
  success: true;
  isInitialized: true;
  channelId?: string;
  tenantId: string;
  user: OnboardingAdminUser;
  modules: PlatformModules;
  importSampleData: boolean;
}> {
  const userId = String(req.user?.id || '');
  if (!userId) {
    throw new Error('Authenticated administrator is required.');
  }
  const cleanEmail = String(req.user?.email || input.adminEmail || '').toLowerCase().trim();
  const adminName = (input.adminName || '').trim() || String(req.user?.name || 'Administrator').trim();
  const existingUser = ((await getDocDirect('users', userId)) || {}) as Record<string, unknown>;
  const tenantId =
    (typeof existingUser.tenantId === 'string' && existingUser.tenantId.trim()) ||
    resolveTenantFromRequest(req) ||
    DEFAULT_TENANT_ID;
  const platformModules = normalizePlatformModules({
    tickets: true,
    geistKB: input.modules.geistKB,
    geistVault: input.modules.geistVault,
    geistExchange: input.modules.geistExchange,
  });

  const adminUser: OnboardingAdminUser = {
    id: userId,
    email: cleanEmail,
    name: adminName,
    role: 'admin',
    is_admin: true,
    tenantId,
  };

  const steps = readOnboardingSteps(config);
  let channelId: string | undefined;

  // 1. Orchestrator secrets (upsert — safe to re-run).
  if (!steps.secretsStored) {
    const aiMapped = mapAiToOrchestrator(input.ai);
    if (aiMapped.secretProvider && aiMapped.secretValue) {
      await setProviderSecret(aiMapped.secretProvider, aiMapped.secretValue, userId, WORKSPACE_ID);
    }
    await persistOnboardingSteps({ ...steps, secretsStored: true });
    steps.secretsStored = true;
  }

  // 2. Primary inbound email channel (guarded — never duplicates).
  if (!steps.emailChannelCreated) {
    const ingest = input.ingestion;
    const shouldCreateChannel = ingest && ingest.skip !== true;
    if (shouldCreateChannel && ingest) {
      const existingChannels = await listEmailChannels();
      const intendedEmail = (ingest.supportEmail || config.email.supportEmail || '').toLowerCase();
      const alreadyCreated = existingChannels.some(
        (ch) =>
          ch.isPrimary === true ||
          (intendedEmail && String(ch.email || '').toLowerCase() === intendedEmail),
      );
      if (!alreadyCreated) {
        const connectionType = mapIngestChannel(ingest.channel || 'webhook');
        const created = await createEmailChannel({
          name: 'Primary inbound',
          email: intendedEmail,
          connectionType,
          isPrimary: true,
          enabled: true,
          status: 'pending',
          provider: connectionType === 'microsoft_graph' ? 'microsoft' : 'custom',
          imapHost: ingest.imapHost,
          imapUser: ingest.imapUser,
          imapPassword: ingest.imapPassword,
          tenantId: ingest.graphTenantId,
          clientId: ingest.graphClientId,
          clientSecret: ingest.graphClientSecret,
          mailbox: intendedEmail,
        });
        channelId = created.id;
      }
    }
    await persistOnboardingSteps({ ...steps, emailChannelCreated: true });
    steps.emailChannelCreated = true;
  }

  // 3. Personal vault initialization flag (idempotent set).
  if (!steps.vaultInitialized) {
    if (input.vaultPassphraseSet && platformModules.geistVault) {
      await setPersonalVaultInitialized(userId, true);
    }
    await persistOnboardingSteps({ ...steps, vaultInitialized: true });
    steps.vaultInitialized = true;
  }

  // 4. Demo fixture purging (idempotent deletes).
  if (!steps.demoPurged) {
    await purgeSeededVaultFolders((sql, params) => queryDb(sql, params ?? []));
    if (input.importSampleData !== true) {
      const exec = (sql: string, params?: unknown[]) => queryDb(sql, params ?? []);
      await purgePlaceholderKbCategories(exec);
      await purgeFrontendSeedKbArticles(exec);
      await purgeKbCoverageCache(exec);
      await purgeDemoAutopilotFixtures(exec);
    }
    await persistOnboardingSteps({ ...steps, demoPurged: true });
    steps.demoPurged = true;
  }

  // 5. Optional sample import (deterministic IDs — re-runs replace cleanly).
  if (!steps.sampleImported) {
    if (input.importSampleData === true) {
      await importOnboardingSampleData({
        tenantId,
        userId,
        includeKb: platformModules.geistKB,
      });
    }
    await persistOnboardingSteps({ ...steps, sampleImported: true });
    steps.sampleImported = true;
  }

  return {
    success: true,
    isInitialized: true,
    channelId,
    tenantId,
    user: adminUser,
    modules: platformModules,
    importSampleData: input.importSampleData === true,
  };
}
