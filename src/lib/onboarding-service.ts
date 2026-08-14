/**
 * Day-0 first-run onboarding: initialization flag, AI ping, atomic complete.
 */

import { z } from 'zod';
import {
  getDocDirect,
  getDocsDirect,
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
import { getOllamaEndpoint } from './runtime-env.js';
import { resolveTenantFromRequest, DEFAULT_TENANT_ID } from './tenant-context.js';
import { safeErrorMessage } from './safe-log.js';
import type { EmailConnectionType } from './email-ingestion/types.js';
import type { Request } from 'express';

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
  newPassword: passwordSchema,
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
});

export type CompleteOnboardingInput = z.infer<typeof completeOnboardingSchema>;
export type TestAiInput = z.infer<typeof testAiSchema>;

export interface OnboardingStatus {
  isInitialized: boolean;
  initializedAt?: string;
  initializedBy?: string;
  requiresOnboarding: boolean;
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
 * Boot-time initialization state:
 *  - Missing document → create with is_initialized=false (fresh install).
 *  - Existing document without the flag → treat as already initialized (legacy deploys).
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
    return toStatus(fresh, false);
  }

  if (typeof existing.is_initialized === 'boolean') {
    const normalized = normalizeModuleConfig(existing);
    return toStatus(normalized, false);
  }

  // Legacy production: module_config exists but predates the wizard.
  const migrated = normalizeModuleConfig({
    ...existing,
    is_initialized: true,
    initializedAt: existing.initializedAt || new Date().toISOString(),
    initializedBy: existing.initializedBy || 'legacy-migration',
    platformModules: existing.platformModules || DEFAULT_PLATFORM_MODULES,
  });
  await updateDocDirect(MODULE_COLLECTION, MODULE_DOC_ID, {
    is_initialized: true,
    initializedAt: migrated.initializedAt,
    initializedBy: migrated.initializedBy,
    platformModules: migrated.platformModules,
    updatedAt: new Date().toISOString(),
  });
  console.log('[Onboarding] Legacy module_config migrated — is_initialized=true');
  return toStatus(migrated, false);
}

async function probePgvector(): Promise<boolean> {
  try {
    await queryDb('SELECT 1 FROM "KnowledgeEmbedding" LIMIT 1');
    return true;
  } catch {
    return false;
  }
}

function toStatus(config: ModuleConfig, isAdmin: boolean): OnboardingStatus {
  const ollama = getOllamaEndpoint() || 'http://ollama:11434';
  return {
    isInitialized: config.is_initialized === true,
    initializedAt: config.initializedAt,
    initializedBy: config.initializedBy,
    requiresOnboarding: isAdmin && config.is_initialized !== true,
    modules: config.platformModules || DEFAULT_PLATFORM_MODULES,
    defaults: {
      ollamaEndpoint: ollama.replace(/\/v1\/?$/, ''),
      chatModel: 'llama3.1',
      embeddingModel: 'nomic-embed-text',
    },
    health: {
      database: 'ok',
      pgvector: false,
    },
  };
}

export async function getOnboardingStatus(req: Request): Promise<OnboardingStatus> {
  const isAdmin = req.user?.role === 'SYSTEM_ADMIN';
  const config = (await loadModuleConfigDoc()) || emptyModuleConfig();
  const status = toStatus(config, isAdmin);
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

function mapAiToOrchestrator(ai: TestAiInput): {
  endpointUrl: string;
  primaryModel: string;
  reasoningModel: string;
  triageModel: string;
  providerPriority: string[];
  killSwitchMaster: boolean;
  secretProvider?: string;
  secretValue?: string;
} {
  if (ai.mode === 'disabled') {
    return {
      endpointUrl: '',
      primaryModel: 'local-llama',
      reasoningModel: 'local-llama',
      triageModel: 'local-llama',
      providerPriority: ['local-llama'],
      killSwitchMaster: true,
    };
  }

  if (ai.mode === 'sovereign') {
    const endpoint = normalizeEndpoint(ai.endpointUrl || getOllamaEndpoint() || 'http://ollama:11434');
    const withV1 = endpoint.endsWith('/v1') ? endpoint : `${endpoint}/v1`;
    const chat = ai.chatModel?.trim() || 'llama3.1';
    return {
      endpointUrl: withV1,
      primaryModel: chat,
      reasoningModel: chat,
      triageModel: chat,
      providerPriority: ['local-llama'],
      killSwitchMaster: false,
      secretProvider: ai.apiKey ? 'local' : undefined,
      secretValue: ai.apiKey || undefined,
    };
  }

  const provider = ai.provider || 'openai';
  const chat = ai.chatModel?.trim();
  if (provider === 'anthropic') {
    return {
      endpointUrl: '',
      primaryModel: chat || 'claude',
      reasoningModel: chat || 'claude',
      triageModel: chat || 'claude',
      providerPriority: ['claude'],
      killSwitchMaster: false,
      secretProvider: 'anthropic',
      secretValue: ai.apiKey,
    };
  }
  if (provider === 'groq') {
    return {
      endpointUrl: 'https://api.groq.com/openai/v1',
      primaryModel: chat || 'llama-3.3-70b-versatile',
      reasoningModel: chat || 'llama-3.3-70b-versatile',
      triageModel: chat || 'llama-3.3-70b-versatile',
      providerPriority: ['local-llama'],
      killSwitchMaster: false,
      secretProvider: 'local',
      secretValue: ai.apiKey,
    };
  }
  if (provider === 'azure') {
    const endpoint = normalizeEndpoint(ai.endpointUrl || '');
    return {
      endpointUrl: endpoint,
      primaryModel: chat || 'gpt-5',
      reasoningModel: chat || 'gpt-5',
      triageModel: chat || 'gpt-4o-mini',
      providerPriority: ['gpt-5'],
      killSwitchMaster: false,
      secretProvider: 'azure_openai',
      secretValue: ai.apiKey,
    };
  }
  return {
    endpointUrl: '',
    primaryModel: chat || 'gpt-5',
    reasoningModel: chat || 'gpt-5',
    triageModel: chat || 'gpt-4o-mini',
    providerPriority: ['gpt-5', 'claude', 'gemini-flash', 'local-llama'],
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

export async function completeOnboarding(
  req: Request,
  input: CompleteOnboardingInput,
): Promise<{ success: true; isInitialized: true; channelId?: string; tenantId: string }> {
  const userId = String(req.user?.id || '');
  if (!userId) {
    throw new Error('Authenticated administrator is required.');
  }

  const existing = (await loadModuleConfigDoc()) || emptyModuleConfig();
  if (existing.is_initialized) {
    return {
      success: true,
      isInitialized: true,
      tenantId: resolveTenantFromRequest(req),
    };
  }

  const tenantId = resolveTenantFromRequest(req) || DEFAULT_TENANT_ID;
  const passwordHash = await hashPassword(input.newPassword);
  const now = new Date().toISOString();
  const platformModules = normalizePlatformModules({
    tickets: true,
    geistKB: input.modules.geistKB,
    geistVault: input.modules.geistVault,
    geistExchange: input.modules.geistExchange,
  });

  const nextConfig: ModuleConfig = normalizeModuleConfig({
    ...existing,
    is_initialized: true,
    initializedAt: now,
    initializedBy: req.user?.email || userId,
    platformModules,
    email: {
      ...existing.email,
      supportEmail: input.ingestion?.supportEmail || existing.email.supportEmail,
      senderName: existing.email.senderName || 'GeistDesk Support',
      imapHost: input.ingestion?.imapHost || existing.email.imapHost,
      autoTriageEnabled: true,
      threadingEnabled: true,
    },
  });

  const aiMapped = mapAiToOrchestrator(input.ai);
  const existingCfg = await getOrchestratorConfig(WORKSPACE_ID);
  await upsertOrchestratorConfig(
    {
      workspaceId: WORKSPACE_ID,
      endpointUrl: aiMapped.endpointUrl,
      primaryModel: aiMapped.primaryModel,
      reasoningModel: aiMapped.reasoningModel,
      triageModel: aiMapped.triageModel,
      providerPriority: aiMapped.providerPriority,
      killSwitch: {
        ...existingCfg.killSwitch,
        master: aiMapped.killSwitchMaster,
      },
    },
    userId,
  );

  if (aiMapped.secretProvider && aiMapped.secretValue) {
    await setProviderSecret(aiMapped.secretProvider, aiMapped.secretValue, userId, WORKSPACE_ID);
  }

  const ingest = input.ingestion;
  const shouldCreateChannel = ingest && ingest.skip !== true;
  let channelId: string | undefined;

  await withPgTransaction(async (client) => {
    await client.query(
      `UPDATE geistdesk_documents
       SET data = jsonb_set(
             jsonb_set(
               jsonb_set(COALESCE(data, '{}'::jsonb), '{passwordHash}', to_jsonb($2::text), true),
               '{authMethod}', to_jsonb('password'::text), true
             ),
             '{updatedAt}', to_jsonb($3::text), true
           ),
           updated_at = NOW()
       WHERE collection = 'users' AND id = $1`,
      [userId, passwordHash, now],
    );

    await client.query(
      `INSERT INTO geistdesk_documents (collection, id, data)
       VALUES ('module_config', 'global', $1::jsonb)
       ON CONFLICT (collection, id) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()`,
      [JSON.stringify({ ...nextConfig, tenantId, updatedAt: now })],
    );
  });

  if (input.ai.mode !== 'disabled' && input.ai.embeddingModel) {
    await updateDocDirect(MODULE_COLLECTION, MODULE_DOC_ID, {
      embeddingModel: input.ai.embeddingModel,
      updatedAt: now,
    });
  }

  if (shouldCreateChannel && ingest) {
    const existingChannels = await listEmailChannels();
    if (existingChannels.length === 0) {
      const connectionType = mapIngestChannel(ingest.channel || 'webhook');
      const created = await createEmailChannel({
        name: 'Primary inbound',
        email: ingest.supportEmail || nextConfig.email.supportEmail,
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
        mailbox: ingest.supportEmail,
      });
      channelId = created.id;
    }
  }

  if (input.vaultPassphraseSet && platformModules.geistVault) {
    await setPersonalVaultInitialized(userId, true);
  }

  return { success: true, isInitialized: true, channelId, tenantId };
}
