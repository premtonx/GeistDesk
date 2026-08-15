import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import type { PlatformModules } from '../lib/module-config';

export interface OnboardingStatus {
  isInitialized: boolean;
  hasAdminUser?: boolean;
  initializedAt?: string;
  initializedBy?: string;
  requiresOnboarding: boolean;
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

  return { status, loading, error, refresh };
}
