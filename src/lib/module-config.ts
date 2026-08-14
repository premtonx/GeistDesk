export interface PolyglotLanguage {
  lang: string;
  isoCode: string;
  flagCode: string;
  enabled: boolean;
}

/** How unresolved Polyglot Bridge phrases are translated after the static dictionary. */
export type PolyglotTranslationProviderMode = 'dictionary_only' | 'deepl' | 'orchestrator';

export const POLYGLOT_TRANSLATION_PROVIDER_MODES: PolyglotTranslationProviderMode[] = [
  'dictionary_only',
  'deepl',
  'orchestrator',
];

/** Admin-provisioned translation credentials and custom phrase dictionaries. */
export interface PolyglotBridgeSettings {
  /** Primary translation backend after dictionary lookup. */
  translationProviderMode: PolyglotTranslationProviderMode;
  /** DeepL auth key when translationProviderMode is `deepl`. */
  translationProviderKey: string;
  /** Source phrase → target language display name → translated text */
  customDictionary: Record<string, Record<string, string>>;
  /**
   * @deprecated Use translationProviderMode === 'orchestrator'. Kept in sync for legacy readers.
   */
  allowAiFallback: boolean;
}

export const DEFAULT_POLYGLOT_BRIDGE_SETTINGS: PolyglotBridgeSettings = {
  translationProviderMode: 'dictionary_only',
  translationProviderKey: '',
  customDictionary: {},
  allowAiFallback: false,
};

export function resolvePolyglotTranslationProviderMode(
  polyglot: Partial<PolyglotBridgeSettings> | Record<string, unknown> | undefined,
): PolyglotTranslationProviderMode {
  const raw = polyglot as Partial<PolyglotBridgeSettings> | undefined;
  const mode = raw?.translationProviderMode;
  if (mode === 'dictionary_only' || mode === 'deepl' || mode === 'orchestrator') {
    return mode;
  }
  if (raw?.allowAiFallback === true) return 'orchestrator';
  if (String(raw?.translationProviderKey || '').trim()) return 'deepl';
  return 'dictionary_only';
}

export function normalizePolyglotBridgeSettings(
  polyglotRaw: Partial<PolyglotBridgeSettings> | Record<string, unknown> | undefined,
): PolyglotBridgeSettings {
  const mode = resolvePolyglotTranslationProviderMode(polyglotRaw);
  const raw = (polyglotRaw ?? {}) as Partial<PolyglotBridgeSettings>;
  return {
    translationProviderMode: mode,
    translationProviderKey: raw.translationProviderKey ?? '',
    customDictionary: raw.customDictionary ?? {},
    allowAiFallback: mode === 'orchestrator',
  };
}

import { PLATFORM_DEFAULT_LANGUAGES } from '../data/platform-defaults';

/** @deprecated Use PLATFORM_DEFAULT_LANGUAGES from src/data/platform-defaults.ts */
export const DEFAULT_SUPPORTED_LANGUAGES: PolyglotLanguage[] = PLATFORM_DEFAULT_LANGUAGES.map((entry) => ({
  ...entry,
}));

export interface AIConfig {
  sentimentModel: 'local-gemma' | 'local-llama' | 'gemini-flash' | 'custom-local';
  deepThinkingModel: 'qwen-36b' | 'llama-3-70b' | 'gemini-pro' | 'custom-local';
  summaryModel: 'sentiment' | 'thinking';
  localEndpoint: string;
  apiKey: string;
  customSentimentModelName?: string;
  customThinkingModelName?: string;
  customApiKey?: string;
}

export interface EmailChannelConfig {
  senderName: string;
  supportEmail: string;
  smtpHost: string;
  smtpPort: string;
  useOAuth: boolean;
  imapHost: string;
  imapPort: string;
  forwardAddress: string;
  threadingEnabled: boolean;
  autoTriageEnabled: boolean;
  signature: string;
}

/** GeistExchange custom workflow templates (workspace-wide). */
export interface ExchangeCustomTemplate {
  id: string;
  title: string;
  tags: string[];
  description: string;
  acceptedTypes: string[];
  uploadLimit: string;
  variables: string[];
  createdAt: string;
}

export interface ExchangeWorkspaceSettings {
  defaultExpirationHours: number;
  globalDownloadLimit: number;
  storageWarningThresholdPercent: number;
  storageQuotaGb: number;
}

/** First-run / Day-0 platform module feature flags (sidebar + route guards). */
export interface PlatformModules {
  /** Core helpdesk — always on. */
  tickets: true;
  geistKB: boolean;
  geistVault: boolean;
  geistExchange: boolean;
}

export const DEFAULT_PLATFORM_MODULES: PlatformModules = {
  tickets: true,
  geistKB: true,
  geistVault: true,
  geistExchange: true,
};

export function normalizePlatformModules(
  raw: Partial<PlatformModules> | Record<string, unknown> | undefined,
): PlatformModules {
  const source = (raw ?? {}) as Partial<PlatformModules>;
  return {
    tickets: true,
    geistKB: source.geistKB !== false,
    geistVault: source.geistVault !== false,
    geistExchange: source.geistExchange !== false,
  };
}

export interface ModuleConfig {
  /** Day-0 wizard completed. Missing on legacy deploys is treated as true at boot. */
  is_initialized: boolean;
  initializedAt?: string;
  initializedBy?: string;
  platformModules: PlatformModules;
  polyglotEnabled: boolean;
  languages: PolyglotLanguage[];
  polyglot: PolyglotBridgeSettings;
  debugAdminMode: boolean;
  personioEnabled: boolean;
  personioClientId: string;
  personioClientSecret: string;
  personioEmployeeId: string;
  ai: AIConfig;
  email: EmailChannelConfig;
  legalPolicy: string;
  forbiddenText?: string;
  ssoEnabled: boolean;
  ssoClientId: string;
  ssoTenantId: string;
  /** Workforce Hub — allowed SSO email domains (workspace-wide). */
  ssoDomains: string[];
  /** GeistExchange — admin-defined custom upload templates. */
  exchangeCustomTemplates: ExchangeCustomTemplate[];
  /** GeistExchange — workspace-wide defaults for expiration, downloads, and storage warnings. */
  exchangeSettings: ExchangeWorkspaceSettings;
}

export const DEFAULT_MODULE_CONFIG: ModuleConfig = {
  is_initialized: false,
  platformModules: { ...DEFAULT_PLATFORM_MODULES },
  polyglotEnabled: true,
  languages: DEFAULT_SUPPORTED_LANGUAGES.map((entry) => ({ ...entry })),
  polyglot: { ...DEFAULT_POLYGLOT_BRIDGE_SETTINGS, customDictionary: {} },
  debugAdminMode: false,
  personioEnabled: true,
  personioClientId: '',
  personioClientSecret: '',
  personioEmployeeId: '',
  ai: {
    sentimentModel: 'gemini-flash',
    deepThinkingModel: 'gemini-pro',
    summaryModel: 'sentiment',
    // Prefer OLLAMA_ENDPOINT / VITE_OLLAMA_ENDPOINT — empty means "not configured".
    localEndpoint: '',
    apiKey: '',
    customSentimentModelName: 'gemma',
    customThinkingModelName: 'qwen:36b',
    customApiKey: ''
  },
  email: {
    senderName: 'GeistDesk Support',
    supportEmail: 'support@geistdesk.ai',
    smtpHost: 'smtp.gmail.com',
    smtpPort: '587',
    useOAuth: true,
    imapHost: 'imap.gmail.com',
    imapPort: '993',
    forwardAddress: '',
    threadingEnabled: true,
    autoTriageEnabled: true,
    signature: '<p>Best regards,<br><strong>GeistDesk Support Team</strong></p>'
  },
  legalPolicy: '1. Never offer specific financial advice or tax implications.\n2. Do not promise fixed refund amounts without supervisor approval.\n3. Avoid definitively stating legal outcomes of disputes.\n4. Always include "Subject to terms and conditions" for complex issues.',
  forbiddenText: '',
  ssoEnabled: false,
  ssoClientId: '',
  ssoTenantId: 'common',
  ssoDomains: ['premtonxh.gmail.com', 'microsoft.onmicrosoft.com', 'entra-sso.com'],
  exchangeCustomTemplates: [],
  exchangeSettings: {
    defaultExpirationHours: 48,
    globalDownloadLimit: 10,
    storageWarningThresholdPercent: 80,
    storageQuotaGb: 2048,
  },
};

function inferIsoCodeFromLanguage(lang: string): string {
  const normalized = lang.toLowerCase().trim();
  if (normalized.includes('german') || normalized === 'deutsch') return 'de';
  if (normalized.includes('english')) return 'en';
  if (normalized.includes('spanish')) return 'es';
  if (normalized.includes('french')) return 'fr';
  if (normalized.includes('italian')) return 'it';
  if (normalized.includes('japanese')) return 'ja';
  if (normalized.includes('korean')) return 'ko';
  return 'en';
}

export function normalizeModuleConfig(parsed: Partial<ModuleConfig> | Record<string, unknown>): ModuleConfig {
  const source = parsed as Partial<ModuleConfig>;
  const polyglotRaw = (source.polyglot ?? {}) as Partial<PolyglotBridgeSettings>;
  const initializedRaw = (source as { is_initialized?: unknown }).is_initialized;

  return {
    ...DEFAULT_MODULE_CONFIG,
    ...source,
    is_initialized: initializedRaw === true,
    platformModules: normalizePlatformModules(
      source.platformModules ?? (source as { modules?: PlatformModules }).modules,
    ),
    ai: DEFAULT_MODULE_CONFIG.ai,
    email: {
      ...DEFAULT_MODULE_CONFIG.email,
      ...(source.email || {})
    },
    languages: (source.languages || DEFAULT_MODULE_CONFIG.languages).map((lang: PolyglotLanguage & { isoCode?: string }) => ({
      lang: lang.lang,
      isoCode: lang.isoCode || inferIsoCodeFromLanguage(lang.lang),
      enabled: lang.enabled ?? true,
      flagCode: lang.flagCode || inferIsoCodeFromLanguage(lang.lang),
    })),
    polyglot: normalizePolyglotBridgeSettings(polyglotRaw),
    ssoDomains: Array.isArray(source.ssoDomains) ? source.ssoDomains : DEFAULT_MODULE_CONFIG.ssoDomains,
    exchangeCustomTemplates: Array.isArray(source.exchangeCustomTemplates)
      ? source.exchangeCustomTemplates
      : DEFAULT_MODULE_CONFIG.exchangeCustomTemplates,
    exchangeSettings: {
      ...DEFAULT_MODULE_CONFIG.exchangeSettings,
      ...(source.exchangeSettings ?? {}),
    },
  };
}


function migrateLegacyBrowserOnlySettings(config: ModuleConfig): { config: ModuleConfig; migrated: boolean } {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return { config, migrated: false };
  }

  let next = config;
  let migrated = false;

  try {
    const legacySso = localStorage.getItem('geistdesk_sso_domains');
    if (legacySso) {
      const parsed = JSON.parse(legacySso) as string[];
      if (Array.isArray(parsed) && parsed.length > 0) {
        next = { ...next, ssoDomains: parsed };
        migrated = true;
      }
      localStorage.removeItem('geistdesk_sso_domains');
    }
  } catch {
    /* ignore corrupt legacy payload */
  }

  try {
    const legacyTemplates = localStorage.getItem('geistexchange-custom-templates');
    if (legacyTemplates) {
      const parsed = JSON.parse(legacyTemplates) as ExchangeCustomTemplate[];
      if (Array.isArray(parsed) && parsed.length > 0) {
        next = { ...next, exchangeCustomTemplates: parsed };
        migrated = true;
      }
      localStorage.removeItem('geistexchange-custom-templates');
    }
  } catch {
    /* ignore corrupt legacy payload */
  }

  return { config: normalizeModuleConfig(next), migrated };
}

/** Writes module config to browser storage and notifies listeners. */
export function applyModuleConfigToStorage(config: ModuleConfig): void {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') return;
  const { ai: _stripAi, ...persistable } = config;
  localStorage.setItem('geistdesk_module_config', JSON.stringify({ ...persistable, ai: undefined }));
  window.dispatchEvent(new Event('module-config-changed'));
}

export const getModuleConfig = (): ModuleConfig => {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return DEFAULT_MODULE_CONFIG;
  }
  const saved = localStorage.getItem('geistdesk_module_config');
  if (!saved) return DEFAULT_MODULE_CONFIG;
  try {
    const parsed = JSON.parse(saved);
    return normalizeModuleConfig(parsed);
  } catch {
    return DEFAULT_MODULE_CONFIG;
  }
};

/**
 * Hydrates workspace module config from PostgreSQL (source of truth) into local storage.
 * Called on login so every admin/operator session receives the latest workspace settings.
 */
export async function syncModuleConfigFromServer(isAdmin = false): Promise<ModuleConfig> {
  if (typeof window === 'undefined') return DEFAULT_MODULE_CONFIG;

  try {
    const res = await fetch('/api/module-config', {
      credentials: 'include',
    });

    if (!res.ok) {
      return getModuleConfig();
    }

    const remote = await res.json();
    if (!remote) {
      return getModuleConfig();
    }

    const local = getModuleConfig();
    const { config: migratedLocal, migrated } = migrateLegacyBrowserOnlySettings(local);

    const merged = normalizeModuleConfig(
      isAdmin
        ? { ...DEFAULT_MODULE_CONFIG, ...remote, ...migratedLocal }
        : {
            ...migratedLocal,
            ...remote,
            polyglot: {
              ...migratedLocal.polyglot,
              ...(remote.polyglot || {}),
            },
          },
    );

    applyModuleConfigToStorage(merged);

    if (migrated && isAdmin) {
      try {
        await saveModuleConfig(merged);
      } catch (error) {
        console.warn('[ModuleConfig] Legacy migration persist skipped:', error);
      }
    }

    return merged;
  } catch (error) {
    console.warn('[ModuleConfig] Server sync failed:', error);
    return getModuleConfig();
  }
}

/** Persists workspace module config to PostgreSQL and local storage. */
export async function saveModuleConfig(config: ModuleConfig): Promise<void> {
  const normalized = normalizeModuleConfig(config);
  applyModuleConfigToStorage(normalized);

  if (typeof window === 'undefined') return;

  const res = await fetch('/api/module-config', {
    method: 'PUT',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(normalized),
  });

  if (!res.ok) {
    const payload = await res.json().catch(() => ({}));
    const message = payload?.error || `HTTP ${res.status}`;
    throw new Error(message);
  }
}
