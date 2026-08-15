/**
 * Workspace platform defaults — German-localized baselines seeded into PostgreSQL
 * on install. Frontend components must load these from the API, not hardcode them.
 */

import type { PolyglotLanguage } from '../lib/module-config';
import type { AiPersonaId, AiPersonaSkillsMap, AiPromptLibraryFeature } from '../types/aiOrchestrator';
import { DEFAULT_PROMPT_BODIES, PROMPT_LIBRARY_FEATURES } from '../types/aiOrchestrator';
import { AGENT_SKILL_BLUEPRINT_MANIFESTS } from './agent-skill-manifests';

/** Polyglot Bridge roster — Deutsch first, then EN/ES/JP/FR. */
export const PLATFORM_DEFAULT_LANGUAGES: PolyglotLanguage[] = [
  { lang: 'Deutsch', isoCode: 'de', flagCode: 'de', enabled: true },
  { lang: 'English', isoCode: 'en', flagCode: 'en', enabled: true },
  { lang: 'Spanish', isoCode: 'es', flagCode: 'es', enabled: true },
  { lang: 'Japanese', isoCode: 'ja', flagCode: 'jp', enabled: true },
  { lang: 'French', isoCode: 'fr', flagCode: 'fr', enabled: true },
];

export interface PlatformVaultFolderSeed {
  id: string;
  name: string;
  icon: 'folder' | 'lock' | 'server' | 'key' | 'database' | 'cloud';
  parentId: string | null;
  vaultId: string;
  sortOrder?: number;
}

/** Default credential vault folder tree for the personal (`local`) vault. */
export const PLATFORM_DEFAULT_VAULT_FOLDERS: PlatformVaultFolderSeed[] = [
  {
    id: 'folder-seed-prod',
    name: 'Produktion',
    icon: 'folder',
    parentId: null,
    vaultId: 'local',
    sortOrder: 0,
  },
  {
    id: 'folder-seed-vpn',
    name: 'VPN & Netzwerk',
    icon: 'lock',
    parentId: null,
    vaultId: 'local',
    sortOrder: 1,
  },
  {
    id: 'folder-seed-eu',
    name: 'EU-West',
    icon: 'server',
    parentId: 'folder-seed-prod',
    vaultId: 'local',
    sortOrder: 0,
  },
];

const PERSONA_BLUEPRINT_MAP: Record<AiPersonaId, { blueprintId: string; fileName: string }> = {
  support_agent: { blueprintId: 'support_empathy_translation', fileName: 'support_empathy_translation.sample.json' },
  security_analyst: { blueprintId: 'security_audit_pii', fileName: 'security_audit_pii.sample.json' },
  knowledge_writer: { blueprintId: 'knowledge_formal_docs', fileName: 'knowledge_formal_docs.sample.json' },
};

/** German persona skill manifests for orchestrator seeding. */
export function buildDefaultPersonaSkills(): AiPersonaSkillsMap {
  const skills: AiPersonaSkillsMap = {};
  for (const [personaId, meta] of Object.entries(PERSONA_BLUEPRINT_MAP) as [AiPersonaId, typeof PERSONA_BLUEPRINT_MAP[AiPersonaId]][]) {
    const manifest = AGENT_SKILL_BLUEPRINT_MANIFESTS[meta.blueprintId];
    if (!manifest) continue;
    skills[personaId] = {
      skillsContent: manifest,
      skillsFileName: meta.fileName,
    };
  }
  return skills;
}

export interface PromptTemplateSeedRow {
  feature: AiPromptLibraryFeature;
  name: string;
  body: string;
}

export function buildDefaultPromptTemplates(): PromptTemplateSeedRow[] {
  return PROMPT_LIBRARY_FEATURES.map((feature) => ({
    feature,
    name: feature.replace(/_/g, ' '),
    body: DEFAULT_PROMPT_BODIES[feature],
  }));
}

/** Partial module_config/global document for seeding (admin merges on first save). */
export function buildDefaultModuleConfigSeed(): Record<string, unknown> {
  return {
    is_initialized: false,
    platformModules: {
      tickets: true,
      geistKB: true,
      geistVault: true,
      geistExchange: true,
    },
    polyglotEnabled: true,
    languages: PLATFORM_DEFAULT_LANGUAGES.map((entry) => ({ ...entry })),
    polyglot: {
      translationProviderMode: 'dictionary_only',
      translationProviderKey: '',
      customDictionary: {},
      allowAiFallback: false,
    },
    debugAdminMode: false,
    personioEnabled: false,
    personioClientId: '',
    personioClientSecret: '',
    personioEmployeeId: '',
    legalPolicy:
      '1. Bieten Sie keine konkrete Finanz- oder Steuerberatung an.\n2. Versprechen Sie keine festen Erstattungsbeträge ohne Freigabe.\n3. Vermeiden Sie definitive rechtliche Aussagen.\n4. Verweisen Sie bei komplexen Fällen auf die AGB.',
    forbiddenText: '',
    ssoEnabled: false,
    ssoClientId: '',
    ssoTenantId: 'common',
    ssoDomains: [],
    exchangeCustomTemplates: [],
  };
}
