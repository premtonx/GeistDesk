import { Suspense, lazy, useEffect, useState, type ReactNode } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Toaster } from './components/ui/sonner';
import { TooltipProvider } from './components/ui/tooltip';
import MainLayout from './components/layout/MainLayout';
import LoginPage from './components/pages/LoginPage';
import OnboardingWizardPage from './components/pages/OnboardingWizardPage';
import { useAuth, useAdmin } from './lib/hooks';
import { usePermissions } from './hooks/usePermissions';
import { isSystemAdminSession } from './lib/beta-admin-bypass';
import { ErrorBoundary, ModuleCrashFallback } from './components/ErrorBoundary';
import { useOnboardingStatus } from './hooks/useOnboardingStatus';
import { getModuleConfig, type PlatformModules } from './lib/module-config';
import { toast } from 'sonner';
import { AuthProvider } from './lib/context/AuthContext';
import { SidebarProvider } from './lib/context/SidebarContext';
import { WorkspaceProvider } from './lib/context/WorkspaceContext';
import { ThemeProvider } from './lib/context/ThemeContext';
import { I18nProvider } from './lib/context/I18nContext';

const DashboardPage = lazy(() => import('./components/pages/DashboardPage'));
const TicketsPage = lazy(() => import('./components/pages/TicketsPage'));
const KBPage = lazy(() => import('./components/pages/KBPage'));
const CustomersPage = lazy(() => import('./components/pages/CustomersPage'));
const SettingsPage = lazy(() => import('./components/pages/SettingsPage'));
const VaultPage = lazy(() => import('./components/pages/VaultPage'));
const CredentialVaultPage = lazy(() => import('./components/pages/CredentialVaultPage'));
const InsightsPage = lazy(() => import('./components/pages/InsightsPage'));
const AuditLogPage = lazy(() => import('./components/pages/AuditLogPage'));
const GeistDeskMigratorPage = lazy(() => import('./components/pages/GeistDeskMigratorPage'));
const EmailChannelsPage = lazy(() => import('./components/pages/EmailChannelsPage'));
const LegalSettingsPage = lazy(() => import('./components/pages/LegalSettingsPage'));
const AdminHubPage = lazy(() => import('./components/pages/AdminHubPage'));
const PolyglotBridgeAdminPage = lazy(() => import('./components/pages/PolyglotBridgeAdminPage'));
const NotificationEnginePage = lazy(() => import('./components/pages/NotificationEnginePage'));
const CompanySchemaPage = lazy(() => import('./components/pages/CompanySchemaPage'));
const ContactSchemaPage = lazy(() => import('./components/pages/ContactSchemaPage'));
const PIIShieldPage = lazy(() => import('./components/pages/PIIShieldPage'));
const SovereigntyCenterPage = lazy(() => import('./components/pages/SovereigntyCenterPage'));
const IntegrationsPage = lazy(() => import('./components/pages/IntegrationsPage'));
const GroupsPage = lazy(() => import('./components/pages/GroupsPage'));
const WorkforcePage = lazy(() => import('./components/pages/WorkforcePage'));
const RolesPage = lazy(() => import('./components/pages/RolesPage'));
const VaultPortfolioManagementPage = lazy(() => import('./components/pages/VaultPortfolioManagementPage'));
const AdminImportPage = lazy(() => import('./components/pages/AdminImportPage'));
const HelpCenterPage = lazy(() => import('./components/pages/HelpCenterPage'));
const SecretViewerPage = lazy(() => import('./components/pages/SecretViewerPage'));

function RouteFallback() {
  return (
    <div className="h-full w-full flex items-center justify-center p-20 bg-background">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
    </div>
  );
}

function LazyPage({ children }: { children: ReactNode }) {
  return <Suspense fallback={<RouteFallback />}>{children}</Suspense>;
}

function AdminRoute({ children }: { children: ReactNode }) {
  const { loading: authLoading } = useAuth();
  const { isAdmin, checking } = useAdmin();

  if (authLoading || checking) {
    return (
      <div className="h-full w-full flex items-center justify-center p-20 bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!isAdmin) {
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
  const needsResume = status?.needsResume === true && status?.hasAdminUser === true;

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
            <ErrorBoundary fallback={<ModuleCrashFallback module="Application" />}>
            <Routes>
                <Route path="/help" element={<LazyPage><HelpCenterPage /></LazyPage>} />
                <Route path="/v/:id" element={<LazyPage><SecretViewerPage /></LazyPage>} />
                {firstRun || needsResume ? (
                  <>
                    <Route path="/onboarding" element={<OnboardingWizardPage />} />
                    <Route path="/login" element={<LoginPage />} />
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
                    <Route path="dashboard" element={<ErrorBoundary fallback={<ModuleCrashFallback module="Dashboard" />}><LazyPage><DashboardPage /></LazyPage></ErrorBoundary>} />
                    <Route path="tickets" element={<ErrorBoundary fallback={<ModuleCrashFallback module="Tickets" />}><LazyPage><TicketsPage /></LazyPage></ErrorBoundary>} />
                    <Route path="tickets/:ticketId" element={<ErrorBoundary fallback={<ModuleCrashFallback module="Tickets" />}><LazyPage><TicketsPage /></LazyPage></ErrorBoundary>} />
                    <Route path="customers" element={<ErrorBoundary fallback={<ModuleCrashFallback module="Customers" />}><LazyPage><CustomersPage /></LazyPage></ErrorBoundary>} />
                    <Route path="kb" element={<ModuleRoute module="geistKB"><ErrorBoundary fallback={<ModuleCrashFallback module="GeistKB" />}><LazyPage><KBPage /></LazyPage></ErrorBoundary></ModuleRoute>} />
                    <Route path="migrator" element={<ErrorBoundary fallback={<ModuleCrashFallback module="Migrator" />}><LazyPage><GeistDeskMigratorPage /></LazyPage></ErrorBoundary>} />
                    <Route path="vault" element={<ModuleRoute module="geistExchange"><ErrorBoundary fallback={<ModuleCrashFallback module="Geist Exchange" />}><LazyPage><VaultPage /></LazyPage></ErrorBoundary></ModuleRoute>} />
                    <Route path="credentials" element={<ModuleRoute module="geistVault"><ErrorBoundary fallback={<ModuleCrashFallback module="GeistVault" />}><LazyPage><CredentialVaultPage /></LazyPage></ErrorBoundary></ModuleRoute>} />
                    <Route path="insights" element={<ErrorBoundary fallback={<ModuleCrashFallback module="Insights" />}><LazyPage><InsightsPage /></LazyPage></ErrorBoundary>} />
                    <Route path="audit" element={<AdminRoute><ErrorBoundary fallback={<ModuleCrashFallback module="Audit Log" />}><LazyPage><AuditLogPage /></LazyPage></ErrorBoundary></AdminRoute>} />
                    <Route path="settings" element={<ErrorBoundary fallback={<ModuleCrashFallback module="Settings" />}><LazyPage><SettingsPage /></LazyPage></ErrorBoundary>} />
                    <Route path="admin" element={<AdminRoute><ErrorBoundary fallback={<ModuleCrashFallback module="Admin Hub" />}><LazyPage><AdminHubPage /></LazyPage></ErrorBoundary></AdminRoute>} />
                    <Route path="admin/mcp" element={<Navigate to="/admin?tab=integrations" replace />} />
                    <Route path="admin/ai" element={<Navigate to="/admin?tab=ai-engine" replace />} />
                    <Route path="ai-orchestrator" element={<Navigate to="/admin?tab=ai-engine" replace />} />
                    <Route path="admin/legal" element={<AdminRoute><ErrorBoundary fallback={<ModuleCrashFallback module="Legal Settings" />}><LazyPage><LegalSettingsPage /></LazyPage></ErrorBoundary></AdminRoute>} />
                    <Route path="admin/notifications" element={<AdminRoute><ErrorBoundary fallback={<ModuleCrashFallback module="Notification Engine" />}><LazyPage><NotificationEnginePage /></LazyPage></ErrorBoundary></AdminRoute>} />
                    <Route path="admin/schema" element={<AdminRoute><ErrorBoundary fallback={<ModuleCrashFallback module="Company Schema" />}><LazyPage><CompanySchemaPage /></LazyPage></ErrorBoundary></AdminRoute>} />
                    <Route path="admin/contact-schema" element={<AdminRoute><ErrorBoundary fallback={<ModuleCrashFallback module="Contact Schema" />}><LazyPage><ContactSchemaPage /></LazyPage></ErrorBoundary></AdminRoute>} />
                    <Route path="admin/pii" element={<AdminRoute><ErrorBoundary fallback={<ModuleCrashFallback module="PII Shield" />}><LazyPage><PIIShieldPage /></LazyPage></ErrorBoundary></AdminRoute>} />
                    <Route path="admin/sovereignty" element={<AdminRoute><ErrorBoundary fallback={<ModuleCrashFallback module="Sovereignty Center" />}><LazyPage><SovereigntyCenterPage /></LazyPage></ErrorBoundary></AdminRoute>} />
                    <Route path="admin/integrations" element={<AdminRoute><ErrorBoundary fallback={<ModuleCrashFallback module="Integrations" />}><LazyPage><IntegrationsPage /></LazyPage></ErrorBoundary></AdminRoute>} />
                    <Route path="admin/polyglot" element={<AdminRoute><ErrorBoundary fallback={<ModuleCrashFallback module="Polyglot Bridge" />}><LazyPage><PolyglotBridgeAdminPage /></LazyPage></ErrorBoundary></AdminRoute>} />
                    <Route path="admin/groups" element={<AdminRoute><ErrorBoundary fallback={<ModuleCrashFallback module="Groups" />}><LazyPage><GroupsPage /></LazyPage></ErrorBoundary></AdminRoute>} />
                    <Route path="admin/workforce" element={<AdminRoute><ErrorBoundary fallback={<ModuleCrashFallback module="Workforce" />}><LazyPage><WorkforcePage /></LazyPage></ErrorBoundary></AdminRoute>} />
                    <Route path="admin/roles" element={<AdminRoute><ErrorBoundary fallback={<ModuleCrashFallback module="Roles" />}><LazyPage><RolesPage /></LazyPage></ErrorBoundary></AdminRoute>} />
                    <Route path="admin/vault-portfolio" element={<AdminRoute><ErrorBoundary fallback={<ModuleCrashFallback module="Vault Portfolio" />}><LazyPage><VaultPortfolioManagementPage /></LazyPage></ErrorBoundary></AdminRoute>} />
                    <Route path="admin/import" element={<AdminRoute><ErrorBoundary fallback={<ModuleCrashFallback module="Import" />}><LazyPage><AdminImportPage /></LazyPage></ErrorBoundary></AdminRoute>} />
                    <Route path="email-channels" element={<ErrorBoundary fallback={<ModuleCrashFallback module="Email Channels" />}><LazyPage><EmailChannelsPage /></LazyPage></ErrorBoundary>} />
                    <Route path="*" element={<Navigate to="/tickets" replace />} />
                    </Route>
                  </>
                )}
              </Routes>
            </ErrorBoundary>
            <Toaster />
          </div>
          </TooltipProvider>
          </WorkspaceProvider>
        </SidebarProvider>
  );
}
