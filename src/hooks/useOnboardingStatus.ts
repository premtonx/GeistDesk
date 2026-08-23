import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import type { PlatformModules } from '../lib/module-config';

export interface OnboardingStatus {
  isInitialized: boolean;
  hasAdminUser?: boolean;
  initializedAt?: string;
  initializedBy?: string;
  requiresOnboarding: boolean;
  needsResume?: boolean;
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

export function useOnboardingStatus() {
  const [status, setStatus] = useState<OnboardingStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get<OnboardingStatus>('/api/admin/onboarding/status', {
        withCredentials: true,
      });
      setStatus(res.data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load onboarding status');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const onChanged = (event: Event) => {
      const detail = (event as CustomEvent<Partial<OnboardingStatus>>).detail;
      if (detail && typeof detail === 'object') {
        setStatus((prev) => ({
          isInitialized: detail.isInitialized ?? prev?.isInitialized ?? false,
          hasAdminUser: detail.hasAdminUser ?? prev?.hasAdminUser,
          initializedAt: detail.initializedAt ?? prev?.initializedAt,
          initializedBy: detail.initializedBy ?? prev?.initializedBy,
          requiresOnboarding: detail.requiresOnboarding ?? false,
          needsResume: detail.needsResume ?? prev?.needsResume ?? false,
          modules: detail.modules ?? prev?.modules ?? {
            tickets: true,
            geistKB: true,
            geistVault: true,
            geistExchange: true,
          },
          defaults: detail.defaults ?? prev?.defaults ?? {
            ollamaEndpoint: '',
            chatModel: 'llama3.1',
            embeddingModel: 'nomic-embed-text',
          },
          health: detail.health ?? prev?.health ?? { database: 'ok', pgvector: false },
        }));
        setLoading(false);
        setError(null);
        return;
      }
      void refresh();
    };
    window.addEventListener('onboarding-status-changed', onChanged);
    return () => window.removeEventListener('onboarding-status-changed', onChanged);
  }, [refresh]);

  return { status, loading, error, refresh };
}
