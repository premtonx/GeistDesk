export interface PolyglotLanguage {
  lang: string;
  isoCode: string;
  flagCode: string;
  enabled: boolean;
}

/** Admin-provisioned translation credentials and custom phrase dictionaries. */
export interface PolyglotBridgeSettings {
  translationProviderKey: string;
  /** Source phrase → target language display name → translated text */
  customDictionary: Record<string, Record<string, string>>;
  /** When true, unresolved phrases may escalate to the LLM orchestrator (consumes tokens). */
  allowAiFallback: boolean;
}

export const DEFAULT_POLYGLOT_BRIDGE_SETTINGS: PolyglotBridgeSettings = {
  translationProviderKey: '',
  customDictionary: {},
  allowAiFallback: false,
};

/** Workspace-wide default polyglot languages (US, ES, JP, FR, DE). */
export const DEFAULT_SUPPORTED_LANGUAGES: PolyglotLanguage[] = [
  { lang: 'English', isoCode: 'en', flagCode: 'en', enabled: true },
  { lang: 'Spanish', isoCode: 'es', flagCode: 'es', enabled: true },
  { lang: 'Japanese', isoCode: 'ja', flagCode: 'jp', enabled: true },
  { lang: 'French', isoCode: 'fr', flagCode: 'fr', enabled: true },
  { lang: 'German', isoCode: 'de', flagCode: 'de', enabled: true },
];

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

export interface ModuleConfig {
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
}

const DEFAULT_CONFIG: ModuleConfig = {
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
    localEndpoint: 'http://localhost:11434/v1',
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
    forwardAddress: '', // This will be calculated or set
    threadingEnabled: true,
    autoTriageEnabled: true,
    signature: '<p>Best regards,<br><strong>GeistDesk Support Team</strong></p>'
  },
  legalPolicy: '1. Never offer specific financial advice or tax implications.\n2. Do not promise fixed refund amounts without supervisor approval.\n3. Avoid definitively stating legal outcomes of disputes.\n4. Always include "Subject to terms and conditions" for complex issues.',
  forbiddenText: '',
  ssoEnabled: false,
  ssoClientId: '',
  ssoTenantId: 'common'
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

export const getModuleConfig = (): ModuleConfig => {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return DEFAULT_CONFIG;
  }
  const saved = localStorage.getItem('geistdesk_module_config');
  if (!saved) return DEFAULT_CONFIG;
  try {
    const parsed = JSON.parse(saved);
    // AI config is workspace-scoped in PostgreSQL — never hydrate from browser storage.
    const { ai: _stripAi, ...rest } = parsed;
    return {
      ...DEFAULT_CONFIG,
      ...rest,
      ai: DEFAULT_CONFIG.ai,
      email: {
        ...DEFAULT_CONFIG.email,
        ...(parsed.email || {})
      },
      languages: (parsed.languages || DEFAULT_CONFIG.languages).map((lang: PolyglotLanguage & { isoCode?: string }) => ({
        lang: lang.lang,
        isoCode: lang.isoCode || inferIsoCodeFromLanguage(lang.lang),
        enabled: lang.enabled ?? true,
        flagCode: lang.flagCode || inferIsoCodeFromLanguage(lang.lang),
      })),
      polyglot: {
        translationProviderKey: parsed.polyglot?.translationProviderKey ?? '',
        customDictionary: parsed.polyglot?.customDictionary ?? {},
        allowAiFallback: parsed.polyglot?.allowAiFallback ?? false,
      },
    };
  } catch {
    return DEFAULT_CONFIG;
  }
};

export const saveModuleConfig = (config: ModuleConfig) => {
  if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
    const { ai: _stripAi, ...persistable } = config;
    localStorage.setItem('geistdesk_module_config', JSON.stringify({ ...persistable, ai: undefined }));
    window.dispatchEvent(new Event('module-config-changed'));

    let token: string | null = null;
    try {
      token = localStorage.getItem('geistdesk_token');
    } catch {}

    // background persist to pg database for server alignment
    fetch('/api/db', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: JSON.stringify({
        action: 'set_doc',
        collection: 'module_config',
        id: 'global',
        data: config
      })
    }).catch(err => console.error("Database alignment failed", err));
  }
};
