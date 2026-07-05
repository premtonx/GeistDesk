import type { PolyglotLanguage } from './module-config';

export { DEFAULT_SUPPORTED_LANGUAGES } from './module-config';

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

/**
 * POLYGLOT BRIDGE POLICY — Standard UI and support-surface translations MUST use static
 * dictionary lookups or low-cost machine translation (e.g. DeepL). Premium LLM /
 * orchestrator tokens must NEVER be consumed for routine UI string conversion.
 */
export async function translateSupportContent(
  text: string,
  targetLanguage: string,
  _options?: { mood?: string },
): Promise<string> {
  if (!text.trim()) return '';

  try {
    const axios = (await import('axios')).default;
    const res = await axios.post<{ translation: string }>('/api/ai/polyglot/translate', {
      text,
      targetLanguage,
    });
    return res.data.translation?.trim() || text;
  } catch (error) {
    console.warn('[Polyglot Bridge] Translation fallback to source text:', error);
    return text;
  }
}
