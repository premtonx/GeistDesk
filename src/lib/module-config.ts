import { languageToFlagCode, type FlagCode } from '../components/ui/FlagIcon';

export interface PolyglotLanguage {
  lang: string;
  flagCode: FlagCode;
  enabled: boolean;
}

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
  languages: [
    { lang: 'English', flagCode: 'en', enabled: true },
    { lang: 'Spanish', flagCode: 'es', enabled: true },
    { lang: 'Japanese', flagCode: 'jp', enabled: true },
    { lang: 'Korean', flagCode: 'kr', enabled: true },
    { lang: 'German', flagCode: 'de', enabled: true }
  ],
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

export const getModuleConfig = (): ModuleConfig => {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return DEFAULT_CONFIG;
  }
  const saved = localStorage.getItem('geistdesk_module_config');
  if (!saved) return DEFAULT_CONFIG;
  try {
    const parsed = JSON.parse(saved);
    // Deep merge or at least ensure AI and Email config exists
    return {
      ...DEFAULT_CONFIG,
      ...parsed,
      ai: {
        ...DEFAULT_CONFIG.ai,
         ...(parsed.ai || {})
      },
      email: {
        ...DEFAULT_CONFIG.email,
        ...(parsed.email || {})
      },
      languages: (parsed.languages || DEFAULT_CONFIG.languages).map((lang: any) => ({
        lang: lang.lang,
        enabled: lang.enabled ?? true,
        flagCode: lang.flagCode || languageToFlagCode(lang.lang),
      })),
    };
  } catch {
    return DEFAULT_CONFIG;
  }
};

export const saveModuleConfig = (config: ModuleConfig) => {
  if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
    localStorage.setItem('geistdesk_module_config', JSON.stringify(config));
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
