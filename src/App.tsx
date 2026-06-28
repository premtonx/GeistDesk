import { type ReactNode } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
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
import LoginPage from './components/pages/LoginPage';
import HelpCenterPage from './components/pages/HelpCenterPage';
import SecretViewerPage from './components/pages/SecretViewerPage';
import { useAuth, useAdmin } from './lib/hooks';
import { usePermissions } from './hooks/usePermissions';
import { SidebarProvider } from './lib/context/SidebarContext';
import { WorkspaceProvider } from './lib/context/WorkspaceContext';
import { ThemeProvider } from './lib/context/ThemeContext';
import { I18nProvider } from './lib/context/I18nContext';

function AdminRoute({ children }: { children: ReactNode }) {
  const { isAdmin, checking } = useAdmin();
  const { role, userProfile, loading } = usePermissions();

  if (checking || loading) {
    return (
      <div className="h-full w-full flex items-center justify-center p-20 bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const isAuthorized = isAdmin || 
                       userProfile?.role === 'admin' || 
                       userProfile?.is_admin === true || 
                       role?.name === 'admin';

  if (!isAuthorized) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}

export default function App() {
  const { user, loading } = useAuth();

  if (loading) {
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
    <I18nProvider>
      <ThemeProvider>
        <SidebarProvider>
          <WorkspaceProvider>
          <TooltipProvider>
            <div className="min-h-screen bg-background font-sans antialiased text-foreground">
            <Routes>
                <Route path="/help" element={<HelpCenterPage />} />
                <Route path="/v/:id" element={<SecretViewerPage />} />
                {!user ? (
                  <Route path="*" element={<LoginPage />} />
                ) : (
                  <Route path="/" element={<MainLayout />}>
                    <Route index element={<Navigate to="/dashboard" replace />} />
                    <Route path="dashboard" element={<DashboardPage />} />
                    <Route path="tickets" element={<TicketsPage />} />
                    <Route path="tickets/:ticketId" element={<TicketsPage />} />
                    <Route path="customers" element={<CustomersPage />} />
                    <Route path="kb" element={<KBPage />} />
                    <Route path="migrator" element={<GeistDeskMigratorPage />} />
                    <Route path="vault" element={<VaultPage />} />
                    <Route path="credentials" element={<CredentialVaultPage />} />
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
                    <Route path="admin/groups" element={<AdminRoute><GroupsPage /></AdminRoute>} />
                    <Route path="admin/workforce" element={<AdminRoute><WorkforcePage /></AdminRoute>} />
                    <Route path="admin/roles" element={<AdminRoute><RolesPage /></AdminRoute>} />
                    <Route path="email-channels" element={<EmailChannelsPage />} />
                    <Route path="*" element={<Navigate to="/tickets" replace />} />
                  </Route>
                )}
              </Routes>
            <Toaster />
          </div>
          </TooltipProvider>
          </WorkspaceProvider>
        </SidebarProvider>
      </ThemeProvider>
    </I18nProvider>
  );
}
