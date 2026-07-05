import type { PolyglotLanguage, PolyglotBridgeSettings } from './module-config';
import { getModuleConfig } from './module-config';

export { DEFAULT_SUPPORTED_LANGUAGES } from './module-config';
export type { PolyglotBridgeSettings } from './module-config';

/** ISO 639-1 presets for admin provisioning dropdowns. */
export const ISO_LANGUAGE_PRESETS: Record<string, { lang: string; flagCode: string }> = {
  en: { lang: 'English', flagCode: 'en' },
  de: { lang: 'German', flagCode: 'de' },
  es: { lang: 'Spanish', flagCode: 'es' },
  fr: { lang: 'French', flagCode: 'fr' },
  it: { lang: 'Italian', flagCode: 'it' },
  ja: { lang: 'Japanese', flagCode: 'jp' },
  ko: { lang: 'Korean', flagCode: 'kr' },
  pt: { lang: 'Portuguese', flagCode: 'pt' },
  nl: { lang: 'Dutch', flagCode: 'nl' },
};

export function normalizeIsoCode(code: string): string {
  return code.trim().toLowerCase().slice(0, 5);
}

export function resolveLanguagePreset(isoCode: string): { lang: string; flagCode: string } {
  const iso = normalizeIsoCode(isoCode);
  return (
    ISO_LANGUAGE_PRESETS[iso] ?? {
      lang: iso.toUpperCase(),
      flagCode: iso.length === 2 ? iso : 'en',
    }
  );
}

export function getActiveSupportedLanguages(languages: PolyglotLanguage[]): PolyglotLanguage[] {
  return languages.filter((entry) => entry.enabled);
}

function isNestedPhraseDictionary(value: unknown): value is Record<string, Record<string, string>> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  return Object.values(value).some((entry) => entry && typeof entry === 'object' && !Array.isArray(entry));
}

/** Merge imported JSON (flat locale file or nested phrase map) into the custom dictionary store. */
export function mergeImportedDictionaryJson(
  existing: PolyglotBridgeSettings['customDictionary'],
  parsed: unknown,
  localeHint?: string,
): PolyglotBridgeSettings['customDictionary'] {
  const merged: PolyglotBridgeSettings['customDictionary'] = { ...existing };

  if (isNestedPhraseDictionary(parsed)) {
    for (const [phrase, targets] of Object.entries(parsed)) {
      merged[phrase] = { ...(merged[phrase] ?? {}), ...targets };
    }
    return merged;
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return merged;
  }

  const iso = normalizeIsoCode(localeHint || 'en');
  const preset = resolveLanguagePreset(iso);
  const targetLabel = preset.lang;

  for (const [sourceKey, rawValue] of Object.entries(parsed as Record<string, unknown>)) {
    if (typeof rawValue !== 'string' || !rawValue.trim()) continue;
    merged[sourceKey] = { ...(merged[sourceKey] ?? {}), [targetLabel]: rawValue.trim() };
  }

  return merged;
}

export function inferLocaleFromFilename(filename: string): string {
  const base = filename.replace(/\.json$/i, '').split(/[/\\]/).pop() || '';
  return normalizeIsoCode(base);
}

/**
 * POLYGLOT BRIDGE POLICY — Standard UI translations use dictionary + low-cost MT first.
 * LLM orchestrator tokens are only consumed when the admin enables allowAiFallback.
 */
export async function translateSupportContent(
  text: string,
  targetLanguage: string,
  options?: { mood?: string },
): Promise<string> {
  if (!text.trim()) return '';

  const moduleConfig = getModuleConfig();

  try {
    const axios = (await import('axios')).default;
    const res = await axios.post<{ translation: string; engine?: string }>('/api/ai/polyglot/translate', {
      text,
      targetLanguage,
      mood: options?.mood,
      allowAiFallback: moduleConfig.polyglot.allowAiFallback,
    });
    return res.data.translation?.trim() || text;
  } catch (error) {
    console.warn('[Polyglot Bridge] Translation fallback to source text:', error);
    return text;
  }
}
