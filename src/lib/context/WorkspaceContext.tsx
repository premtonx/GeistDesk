import React, { createContext, useContext, useEffect, useState } from 'react';
import { AppWorkspace } from '../ticketWorkspace';

interface WorkspaceContextType {
  workspace: AppWorkspace;
  setWorkspace: (workspace: AppWorkspace) => void;
  isSupportWorkspace: boolean;
  isDeveloperWorkspace: boolean;
}

const STORAGE_KEY = 'geistdesk_active_workspace';

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined);

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const [workspace, setWorkspaceState] = useState<AppWorkspace>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved === 'developer' ? 'developer' : 'support';
  });

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
