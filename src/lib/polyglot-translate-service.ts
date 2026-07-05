/**
 * Server-side Polyglot Bridge translation service.
 *
 * POLYGLOT BRIDGE POLICY: Premium AI / LLM orchestration tokens must NEVER be fired
 * for standard UI conversions or routine support-surface translations. This module
 * uses static phrase dictionaries and optional DeepL HTTP API only.
 */

const PHRASE_DICTIONARY: Record<string, Record<string, string>> = {
  Professional: {
    German: 'Professionell',
    Deutsch: 'Professionell',
    French: 'Professionnel',
    Spanish: 'Profesional',
    Italian: 'Professionale',
    Japanese: 'プロフェッショナル',
  },
  Neutral: {
    German: 'Neutral',
    Deutsch: 'Neutral',
    French: 'Neutre',
    Spanish: 'Neutral',
  },
};

const DEEPL_TARGET_MAP: Record<string, string> = {
  english: 'EN',
  en: 'EN',
  german: 'DE',
  deutsch: 'DE',
  de: 'DE',
  french: 'FR',
  fr: 'FR',
  spanish: 'ES',
  es: 'ES',
  italian: 'IT',
  it: 'IT',
  japanese: 'JA',
  ja: 'JA',
  korean: 'KO',
  ko: 'KO',
  portuguese: 'PT',
  pt: 'PT',
  dutch: 'NL',
  nl: 'NL',
};

export interface PolyglotTranslateOptions {
  customDictionary?: Record<string, Record<string, string>>;
  translationProviderKey?: string;
}

function lookupStaticDictionary(
  text: string,
  targetLanguage: string,
  customDictionary?: Record<string, Record<string, string>>,
): string | null {
  const trimmed = text.trim();
  const buckets = [customDictionary, PHRASE_DICTIONARY];
  for (const bucket of buckets) {
    if (!bucket) continue;
    const entry = bucket[trimmed];
    if (entry?.[targetLanguage]) return entry[targetLanguage];
  }
  return null;
}

function toDeepLTargetLang(targetLanguage: string): string | null {
  const key = targetLanguage.toLowerCase().trim();
  return DEEPL_TARGET_MAP[key] ?? null;
}

async function translateViaDeepL(
  text: string,
  targetLanguage: string,
  authKeyOverride?: string,
): Promise<string | null> {
  const authKey = authKeyOverride || process.env.DEEPL_AUTH_KEY || process.env.DEEPL_API_KEY;
  if (!authKey) return null;

  const targetLang = toDeepLTargetLang(targetLanguage);
  if (!targetLang) return null;

  const endpoint = authKey.endsWith(':fx')
    ? 'https://api-free.deepl.com/v2/translate'
    : 'https://api.deepl.com/v2/translate';

  const body = new URLSearchParams({
    auth_key: authKey,
    text,
    target_lang: targetLang,
  });

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
    signal: AbortSignal.timeout(12_000),
  });

  if (!res.ok) return null;

  const payload = (await res.json()) as { translations?: Array<{ text?: string }> };
  return payload.translations?.[0]?.text?.trim() ?? null;
}

export async function translatePolyglotContent(
  text: string,
  targetLanguage: string,
  options: PolyglotTranslateOptions = {},
): Promise<string> {
  if (!text.trim()) return '';

  const dictionaryHit = lookupStaticDictionary(text, targetLanguage, options.customDictionary);
  if (dictionaryHit) return dictionaryHit;

  try {
    const deepl = await translateViaDeepL(text, targetLanguage, options.translationProviderKey);
    if (deepl) return deepl;
  } catch (error) {
    console.warn('[Polyglot Bridge] DeepL translation skipped:', error);
  }

  return text;
}
