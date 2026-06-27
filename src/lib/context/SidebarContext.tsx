import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
interface SidebarContextType {
  isMainCollapsed: boolean;
  isPipelineCollapsed: boolean;
  setIsMainCollapsed: (collapsed: boolean) => void;
  setIsPipelineCollapsed: (collapsed: boolean) => void;
  toggleMainSidebar: () => void;
  togglePipelineSidebar: () => void;
}

const SidebarContext = createContext<SidebarContextType | undefined>(undefined);

export function SidebarProvider({ children }: { children: ReactNode }) {
  const [isMainCollapsed, setIsMainCollapsed] = useState(() => {
    const saved = localStorage.getItem('mainSidebarCollapsed');
    return saved ? JSON.parse(saved) : false;
  });

  const [isPipelineCollapsed, setIsPipelineCollapsed] = useState(() => {
    const saved = localStorage.getItem('pipelineSidebarCollapsed');
    return saved ? JSON.parse(saved) : false;
  });

  useEffect(() => {
    localStorage.setItem('mainSidebarCollapsed', JSON.stringify(isMainCollapsed));
  }, [isMainCollapsed]);

  useEffect(() => {
    localStorage.setItem('pipelineSidebarCollapsed', JSON.stringify(isPipelineCollapsed));
  }, [isPipelineCollapsed]);

  const toggleMainSidebar = () => setIsMainCollapsed((prev) => !prev);
  const togglePipelineSidebar = () => setIsPipelineCollapsed((prev) => !prev);

  return (
    <SidebarContext.Provider value={{ 
      isMainCollapsed, 
      isPipelineCollapsed, 
      setIsMainCollapsed, 
      setIsPipelineCollapsed,
      toggleMainSidebar,
      togglePipelineSidebar
    }}>
      {children}
    </SidebarContext.Provider>
  );
}

export function useSidebar() {
  const context = useContext(SidebarContext);
  if (context === undefined) {
    throw new Error('useSidebar must be used within a SidebarProvider');
  }
  return context;
}
