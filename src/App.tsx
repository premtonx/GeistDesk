import { useEffect, useState, type ReactNode } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Toaster } from './components/ui/sonner';
import { TooltipProvider } from './components/ui/tooltip';
import MainLayout from './components/layout/MainLayout';
import DashboardPage from './components/pages/DashboardPage';
import TicketsPage from './components/pages/TicketsPage';
import KBPage from './components/pages/KBPage';
import CustomersPage from './components/pages/CustomersPage';
import SettingsPage from './components/pages/SettingsPage';
import VaultPage from './components/pages/VaultPage';
import CredentialVaultPage from './components/pages/CredentialVaultPage';
import InsightsPage from './components/pages/InsightsPage';
import AuditLogPage from './components/pages/AuditLogPage';
import GeistDeskMigratorPage from './components/pages/GeistDeskMigratorPage';
import EmailChannelsPage from './components/pages/EmailChannelsPage';
import AiOrchestratorPage from './pages/AiOrchestrator';
import LegalSettingsPage from './components/pages/LegalSettingsPage';
import AdminHubPage from './components/pages/AdminHubPage';
import PolyglotBridgeAdminPage from './components/pages/PolyglotBridgeAdminPage';
import NotificationEnginePage from './components/pages/NotificationEnginePage';
import CompanySchemaPage from './components/pages/CompanySchemaPage';
import ContactSchemaPage from './components/pages/ContactSchemaPage';
import MCPHubPage from './components/pages/MCPHubPage';
import PIIShieldPage from './components/pages/PIIShieldPage';
import SovereigntyCenterPage from './components/pages/SovereigntyCenterPage';
import IntegrationsPage from './components/pages/IntegrationsPage';
import GroupsPage from './components/pages/GroupsPage';
import WorkforcePage from './components/pages/WorkforcePage';
import RolesPage from './components/pages/RolesPage';
import VaultPortfolioManagementPage from './components/pages/VaultPortfolioManagementPage';
import AdminImportPage from './components/pages/AdminImportPage';
import OnboardingWizardPage from './components/pages/OnboardingWizardPage';
import LoginPage from './components/pages/LoginPage';
import HelpCenterPage from './components/pages/HelpCenterPage';
import SecretViewerPage from './components/pages/SecretViewerPage';
import { useAuth, useAdmin } from './lib/hooks';
import { usePermissions } from './hooks/usePermissions';
import { isSystemAdminSession } from './lib/beta-admin-bypass';
import { useOnboardingStatus } from './hooks/useOnboardingStatus';
import { getModuleConfig, type PlatformModules } from './lib/module-config';
import { toast } from 'sonner';
import { AuthProvider } from './lib/context/AuthContext';
import { SidebarProvider } from './lib/context/SidebarContext';
import { WorkspaceProvider } from './lib/context/WorkspaceContext';
import { ThemeProvider } from './lib/context/ThemeContext';
import { I18nProvider } from './lib/context/I18nContext';

function AdminRoute({ children }: { children: ReactNode }) {
  const { loading: authLoading } = useAuth();
  const { isAdmin, checking } = useAdmin();
  const { role, userProfile, loading } = usePermissions();

  if (authLoading || checking || loading) {
    return (
      <div className="h-full w-full flex items-center justify-center p-20 bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!isSystemAdminSession(isAdmin, userProfile, role)) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}

function OnboardingGate({ children }: { children: ReactNode }) {
  const { isAdmin, checking } = useAdmin();
  const { role, userProfile, loading } = usePermissions();
  const { status, loading: onboardingLoading } = useOnboardingStatus();
  const isSystemAdmin = isSystemAdminSession(isAdmin, userProfile, role);

  if (checking || loading || onboardingLoading) {
    return (
      <div className="h-full w-full flex items-center justify-center p-20 bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (isSystemAdmin && !status?.isInitialized && status?.hasAdminUser !== true) {
    return <Navigate to="/onboarding" replace />;
  }

  return <>{children}</>;
}

function ModuleRoute({
  module,
  children,
}: {
  module: keyof Omit<PlatformModules, 'tickets'>;
  children: ReactNode;
}) {
  const location = useLocation();
  const [flags, setFlags] = useState(() => getModuleConfig().platformModules);

  useEffect(() => {
    const sync = () => setFlags(getModuleConfig().platformModules);
    window.addEventListener('module-config-changed', sync);
    return () => window.removeEventListener('module-config-changed', sync);
  }, []);

  if (!flags[module]) {
    toast.info('This module is disabled for this workspace.', { id: `module-disabled-${module}` });
    return <Navigate to="/dashboard" replace state={{ from: location.pathname, moduleDisabled: module }} />;
  }
  return <>{children}</>;
}

export default function App() {
  return (
    <I18nProvider>
      <ThemeProvider>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </ThemeProvider>
    </I18nProvider>
  );
}

function AppRoutes() {
  const { user, loading } = useAuth();
  const { status, loading: onboardingLoading } = useOnboardingStatus();
  const firstRun = status?.hasAdminUser !== true && status?.isInitialized !== true;

  if (loading || onboardingLoading) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center gap-4 bg-muted">
        <div className="flex -space-x-2 animate-pulse">
           <div className="w-4 h-10 bg-[#4285F4] rounded-full"></div>
           <div className="w-4 h-10 bg-[#EA4335] rounded-full"></div>
           <div className="w-4 h-10 bg-[#FBBC05] rounded-full"></div>
           <div className="w-4 h-10 bg-[#34A853] rounded-full"></div>
        </div>
        <p className="text-xs font-bold text-[#5F6368] uppercase tracking-widest">Warming Engines...</p>
      </div>
    );
  }

  return (
        <SidebarProvider>
          <WorkspaceProvider>
          <TooltipProvider>
            <div className="min-h-screen bg-background font-sans antialiased text-foreground">
            <Routes>
                <Route path="/help" element={<HelpCenterPage />} />
                <Route path="/v/:id" element={<SecretViewerPage />} />
                {firstRun ? (
                  <>
                    <Route path="/onboarding" element={<OnboardingWizardPage />} />
                    <Route path="*" element={<Navigate to="/onboarding" replace />} />
                  </>
                ) : !user ? (
                  <>
                    <Route path="/onboarding" element={<Navigate to="/login" replace />} />
                    <Route path="/login" element={<LoginPage />} />
                    <Route path="*" element={<LoginPage />} />
                  </>
                ) : (
                  <>
                    <Route path="/onboarding" element={<Navigate to="/dashboard" replace />} />
                    <Route
                      path="/"
                      element={
                        <OnboardingGate>
                          <MainLayout />
                        </OnboardingGate>
                      }
                    >
                    <Route index element={<Navigate to="/dashboard" replace />} />
                    <Route path="dashboard" element={<DashboardPage />} />
                    <Route path="tickets" element={<TicketsPage />} />
                    <Route path="tickets/:ticketId" element={<TicketsPage />} />
                    <Route path="customers" element={<CustomersPage />} />
                    <Route path="kb" element={<ModuleRoute module="geistKB"><KBPage /></ModuleRoute>} />
                    <Route path="migrator" element={<GeistDeskMigratorPage />} />
                    <Route path="vault" element={<ModuleRoute module="geistExchange"><VaultPage /></ModuleRoute>} />
                    <Route path="credentials" element={<ModuleRoute module="geistVault"><CredentialVaultPage /></ModuleRoute>} />
                    <Route path="insights" element={<InsightsPage />} />
                    <Route path="audit" element={<AdminRoute><AuditLogPage /></AdminRoute>} />
                    <Route path="settings" element={<SettingsPage />} />
                    <Route path="admin" element={<AdminRoute><AdminHubPage /></AdminRoute>} />
                    <Route path="admin/mcp" element={<AdminRoute><MCPHubPage /></AdminRoute>} />
                    <Route path="admin/ai" element={<AdminRoute><AiOrchestratorPage /></AdminRoute>} />
                    <Route path="admin/legal" element={<AdminRoute><LegalSettingsPage /></AdminRoute>} />
                    <Route path="admin/notifications" element={<AdminRoute><NotificationEnginePage /></AdminRoute>} />
                    <Route path="admin/schema" element={<AdminRoute><CompanySchemaPage /></AdminRoute>} />
                    <Route path="admin/contact-schema" element={<AdminRoute><ContactSchemaPage /></AdminRoute>} />
                    <Route path="admin/pii" element={<AdminRoute><PIIShieldPage /></AdminRoute>} />
                    <Route path="admin/sovereignty" element={<AdminRoute><SovereigntyCenterPage /></AdminRoute>} />
                    <Route path="admin/integrations" element={<AdminRoute><IntegrationsPage /></AdminRoute>} />
                    <Route path="admin/polyglot" element={<AdminRoute><PolyglotBridgeAdminPage /></AdminRoute>} />
                    <Route path="admin/groups" element={<AdminRoute><GroupsPage /></AdminRoute>} />
                    <Route path="admin/workforce" element={<AdminRoute><WorkforcePage /></AdminRoute>} />
                    <Route path="admin/roles" element={<AdminRoute><RolesPage /></AdminRoute>} />
                    <Route path="admin/vault-portfolio" element={<AdminRoute><VaultPortfolioManagementPage /></AdminRoute>} />
                    <Route path="admin/import" element={<AdminRoute><AdminImportPage /></AdminRoute>} />
                    <Route path="email-channels" element={<EmailChannelsPage />} />
                    <Route path="*" element={<Navigate to="/tickets" replace />} />
                    </Route>
                  </>
                )}
              </Routes>
            <Toaster />
          </div>
          </TooltipProvider>
          </WorkspaceProvider>
        </SidebarProvider>
  );
}
