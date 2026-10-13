import { useEffect, useMemo, useRef, useState } from 'react';
import { AIAdapter } from '../lib/ai/provider-adapter';
import { getActiveSupportedLanguages } from '../lib/polyglot-bridge';
import { logAudit } from '../services/auditService';
import { useWorkspaceModuleConfig } from './useWorkspaceModuleConfig';

export type TranslationMood = 'Professional' | 'Casual' | 'Empathetic';

/**
 * Consolidated Polyglot Bridge state + effects for the Tickets module:
 *  - Native UI translation of the selected ticket subject/description
 *  - Ghostwriting in reverse (live translation of the draft reply)
 *  - Incoming-message translation with a ref-based cache (no stale closures)
 *
 * The translated-content cache lives in a ref so the effects never read a
 * stale closure and never trigger re-renders while translating.
 */
export function usePolyglot(options: {
  selectedTicket: { subject: string; description: string; id?: string; originalLanguage?: string } | null;
  messages: Array<{ id: string; content: string }>;
  replyText: string;
  ai: AIAdapter;
}) {
  const { selectedTicket, messages, replyText, ai } = options;

  const [agentLanguage, setAgentLanguage] = useState<string>(() => {
    return localStorage.getItem('agentLanguage') || 'English';
  });
  useEffect(() => {
    localStorage.setItem('agentLanguage', agentLanguage);
  }, [agentLanguage]);

  const [translationMood, setTranslationMood] = useState<TranslationMood>('Professional');
  const [translatedTicket, setTranslatedTicket] = useState<{ subject: string; description: string } | null>(null);
  const [translatedMessages, setTranslatedMessages] = useState<Record<string, string>>({});
  const [isTranslating, setIsTranslating] = useState(false);
  const [liveTranslation, setLiveTranslation] = useState('');

  // Native UI Translation
  useEffect(() => {
    const translateTicket = async () => {
      if (!selectedTicket || agentLanguage === 'English') {
        setTranslatedTicket(null);
        return;
      }

      setIsTranslating(true);
      try {
        const [subject, description] = await Promise.all([
          ai.translate(selectedTicket.subject, agentLanguage, 'Professional'),
          ai.translate(selectedTicket.description, agentLanguage, 'Professional'),
        ]);
        setTranslatedTicket({ subject, description });
        logAudit({
          module: 'tickets',
          action: 'polyglot_ui_translate',
          details: { ticketId: selectedTicket.id, language: agentLanguage },
        });
      } catch (e) {
        console.error('Polyglot UI Error:', e);
      } finally {
        setIsTranslating(false);
      }
    };

    translateTicket();
  }, [selectedTicket?.id, agentLanguage, selectedTicket, ai]);

  // Ghostwriting in Reverse (Live Translation)
  useEffect(() => {
    if (!replyText.trim() || agentLanguage === 'English' || !selectedTicket) {
      setLiveTranslation('');
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const targetLang = selectedTicket.originalLanguage || 'English';
        const translation = await ai.translate(replyText, targetLang, translationMood);
        setLiveTranslation(translation);
      } catch (e) {
        console.error('Ghostwriting Error:', e);
      }
    }, 800);

    return () => clearTimeout(timer);
  }, [replyText, agentLanguage, translationMood, selectedTicket, ai]);

  // Incoming Message Translation (ref-based cache)
  const translatedMessagesRef = useRef<Record<string, string>>({});
  useEffect(() => {
    const translateMessages = async () => {
      if (agentLanguage === 'English' || messages.length === 0) {
        translatedMessagesRef.current = {};
        setTranslatedMessages({});
        return;
      }

      const cache = translatedMessagesRef.current;
      const untranslated = messages.filter((m) => !cache[m.id]);
      if (untranslated.length === 0) return;

      try {
        const translations = await Promise.all(
          untranslated.map((m) => ai.translate(m.content, agentLanguage, 'Professional')),
        );

        untranslated.forEach((m, i) => {
          cache[m.id] = translations[i];
        });
        setTranslatedMessages((prev) => ({ ...prev, ...cache }));
      } catch (e) {
        console.error('Polyglot Message Error:', e);
      }
    };

    translateMessages();
  }, [messages, agentLanguage, ai]);

  const { config: moduleConfig } = useWorkspaceModuleConfig();

  const activePolyglotLanguages = useMemo(
    () => getActiveSupportedLanguages(moduleConfig.languages),
    [moduleConfig.languages],
  );

  return {
    agentLanguage,
    setAgentLanguage,
    translationMood,
    setTranslationMood,
    translatedTicket,
    translatedMessages,
    isTranslating,
    liveTranslation,
    setLiveTranslation,
    activePolyglotLanguages,
  };
}
