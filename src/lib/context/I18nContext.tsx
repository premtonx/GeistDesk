import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import deCommon from '../../locales/de/common.json';
import enCommon from '../../locales/en/common.json';

// Define standard registry type based on German structure
type TranslationSchema = typeof deCommon & Record<string, any>;

const defaultTranslations: Record<string, TranslationSchema> = {
  de: deCommon as unknown as TranslationSchema,
  en: enCommon as unknown as TranslationSchema,
};

interface I18nContextProps {
  language: string;
  languages: string[];
  t: (keyPath: string, defaultValue?: string) => string;
  i18n: {
    language: string;
    changeLanguage: (lang: string) => void;
  };
  addTranslations: (lang: string, translations: any) => void;
}

const I18nContext = createContext<I18nContextProps | undefined>(undefined);

// Helper function to resolve dot notation nested keys
function getNestedValue(obj: any, path: string): string | undefined {
  if (!obj) return undefined;
  const parts = path.split('.');
  let current = obj;
  for (const part of parts) {
    if (current && typeof current === 'object' && part in current) {
      current = current[part];
    } else {
      return undefined;
    }
  }
  return typeof current === 'string' ? current : undefined;
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [translations, setTranslations] = useState<Record<string, any>>(defaultTranslations);
  const [language, setLanguageState] = useState<string>(() => {
    const saved = localStorage.getItem('lang');
    return saved || 'de'; // German ('de') is the absolute default fallback language
  });

  useEffect(() => {
    localStorage.setItem('lang', language);
  }, [language]);

  const changeLanguage = (lang: string) => {
    setLanguageState(lang);
  };

  const addTranslations = (lang: string, extraTranslations: any) => {
    setTranslations(prev => ({
      ...prev,
      [lang]: {
        ...(prev[lang] || {}),
        ...extraTranslations,
      },
    }));
  };

  // Translate function — strict locale: never cross-fallback to the other language,
  // which caused mixed EN/DE UI when keys were missing or mis-nested in locale files.
  const t = (keyPath: string, defaultValue?: string): string => {
    const activeText = getNestedValue(translations[language], keyPath);
    if (activeText !== undefined) return activeText;

    if (defaultValue !== undefined) return defaultValue;
    return keyPath;
  };

  const languages = Object.keys(translations);

  const i18n = {
    language,
    changeLanguage,
  };

  return (
    <I18nContext.Provider value={{ language, languages, t, i18n, addTranslations }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useTranslation() {
  const context = useContext(I18nContext);
  if (context === undefined) {
    throw new Error('useTranslation must be used within an I18nProvider');
  }
  return context;
}
