import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  getModuleConfig,
  saveModuleConfig,
  syncModuleConfigFromServer,
  type ModuleConfig,
} from '../lib/module-config';
import { useAdmin } from '../lib/hooks';

interface UseWorkspaceModuleConfigOptions {
  /** When true, always hydrate the full admin config including secrets. */
  admin?: boolean;
}

/**
 * Workspace-scoped module configuration backed by PostgreSQL (`module_config/global`).
 * localStorage is a read-through cache only — DB is the source of truth on hydrate.
 */
export function useWorkspaceModuleConfig(options: UseWorkspaceModuleConfigOptions = {}) {
  const { isAdmin } = useAdmin();
  const hydrateAsAdmin = options.admin ?? isAdmin;
  const [config, setConfig] = useState<ModuleConfig>(() => getModuleConfig());
  const [syncing, setSyncing] = useState(true);

  useEffect(() => {
    let active = true;
    setSyncing(true);
    void syncModuleConfigFromServer(hydrateAsAdmin).then((next) => {
      if (!active) return;
      setConfig(next);
      setSyncing(false);
    });

    const onChange = () => setConfig(getModuleConfig());
    window.addEventListener('module-config-changed', onChange);
    return () => {
      active = false;
      window.removeEventListener('module-config-changed', onChange);
    };
  }, [hydrateAsAdmin]);

  const persist = useCallback(async (next: ModuleConfig): Promise<boolean> => {
    const previous = getModuleConfig();
    setConfig(next);
    try {
      await saveModuleConfig(next);
      return true;
    } catch (error) {
      console.error('[WorkspaceModuleConfig] Persist failed:', error);
      toast.error('Workspace settings could not be saved to the database. Please try again.');
      // Roll back the optimistic update so the UI does not silently diverge
      // from what is actually persisted.
      setConfig(previous);
      window.dispatchEvent(new Event('module-config-changed'));
      return false;
    }
  }, []);

  return { config, setConfig, persist, syncing, isAdmin: hydrateAsAdmin };
}
