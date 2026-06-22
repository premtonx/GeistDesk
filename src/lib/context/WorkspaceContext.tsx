import React, { createContext, useContext, useEffect, useState } from 'react';
import { AppWorkspace } from '../ticketWorkspace';

interface WorkspaceContextType {
  workspace: AppWorkspace;
  setWorkspace: (workspace: AppWorkspace) => void;
  isSupportWorkspace: boolean;
  isDeveloperWorkspace: boolean;
  isAiOpsWorkspace: boolean;
}

const STORAGE_KEY = 'geistdesk_active_workspace';

function parseStoredWorkspace(value: string | null): AppWorkspace {
  if (value === 'developer' || value === 'ai_ops' || value === 'support') {
    return value;
  }
  return 'support';
}

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined);

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const [workspace, setWorkspaceState] = useState<AppWorkspace>(() =>
    parseStoredWorkspace(localStorage.getItem(STORAGE_KEY)),
  );

  const setWorkspace = (next: AppWorkspace) => {
    setWorkspaceState(next);
    localStorage.setItem(STORAGE_KEY, next);
  };

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, workspace);
  }, [workspace]);

  return (
    <WorkspaceContext.Provider
      value={{
        workspace,
        setWorkspace,
        isSupportWorkspace: workspace === 'support',
        isDeveloperWorkspace: workspace === 'developer',
        isAiOpsWorkspace: workspace === 'ai_ops',
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const context = useContext(WorkspaceContext);
  if (!context) {
    throw new Error('useWorkspace must be used within a WorkspaceProvider');
  }
  return context;
}
