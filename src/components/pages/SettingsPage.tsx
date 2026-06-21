import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Label } from '../../components/ui/label';
import { Input } from '../../components/ui/input';
import { Button } from '../../components/ui/button';
import { Separator } from '../../components/ui/separator';
import { Switch } from '../../components/ui/switch';
import { cn } from '../../lib/utils';
import { 
  Shield, 
  Cpu, 
  Globe, 
  Webhook,
  Database,
  Languages,
  ToggleLeft,
  Mail,
  Clock,
  Sparkles,
  ShieldAlert,
  Users,
  Bell,
  Briefcase,
  LayoutGrid,
  ShieldCheck
} from 'lucide-react';
import { getModuleConfig, saveModuleConfig, ModuleConfig } from '../../lib/module-config';
import { logout, useAdmin, useAuth } from '../../lib/hooks';
import { toast } from 'sonner';
import { LogOut, User as UserIcon, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import firebaseConfig from '../../../firebase-applet-config.json';

import { AdminBreadcrumbs } from '../../components/AdminBreadcrumbs';
import { userService } from '../../services/userService';
import { useTranslation } from '../../lib/context/I18nContext';
import { FlagIcon, languageToFlagCode } from '../ui/FlagIcon';

export default function SettingsPage() {
  const { isAdmin } = useAdmin();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [config, setConfig] = useState<ModuleConfig>(getModuleConfig());
  const { t, i18n, language } = useTranslation();

  // Personal Profile state hooks
  const [displayNameInput, setDisplayNameInput] = useState('');
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');

  useEffect(() => {
    if (user) {
      setDisplayNameInput(user.displayName || '');
      setEmailInput(user.email || '');
    }
  }, [user]);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    try {
      const { updateProfile } = await import('firebase/auth');
      await updateProfile(user as any, { displayName: displayNameInput });
      await userService.updateUser(user.uid, { name: displayNameInput });
      toast.success("Profile display name updated successfully.");
    } catch (err: any) {
      toast.error(err.message || "Failed to update profile name.");
    }
  };

  const handleUpdateEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!emailInput) return;
    try {
      const { updateEmail } = await import('firebase/auth');
      await updateEmail(user as any, emailInput);
      await userService.updateUser(user.uid, { email: emailInput });
      toast.success("Account contact email updated.");
    } catch (err: any) {
      toast.error(err.message || "Failed to update email.");
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!passwordInput) {
      toast.error("Please enter a new password.");
      return;
    }
    try {
      const { updatePassword } = await import('firebase/auth');
      await updatePassword(user as any, passwordInput);
      setPasswordInput('');
      toast.success("Security credentials password updated.");
    } catch (err: any) {
      toast.error(err.message || "Failed to update password.");
    }
  };

  const togglePolyglot = () => {
    const newConfig = { ...config, polyglotEnabled: !config.polyglotEnabled };
    setConfig(newConfig);
    saveModuleConfig(newConfig);
    toast.success(`Polyglot Bridge ${newConfig.polyglotEnabled ? 'enabled' : 'disabled'}`);
  };

  const toggleDebugAdmin = () => {
    const newConfig = { ...config, debugAdminMode: !config.debugAdminMode };
    setConfig(newConfig);
    saveModuleConfig(newConfig);
    toast.info(`Simulated Admin Mode ${newConfig.debugAdminMode ? 'activated' : 'deactivated'}`);
    // Force a reload to refresh admin hooks
    setTimeout(() => window.location.reload(), 1000);
  };

  const handleLogout = async () => {
    try {
      await logout();
      window.location.href = "/";
    } catch (err) {
      toast.error("Logout failed.");
    }
  };

  const toggleLanguage = (langName: string) => {
    const newLanguages = config.languages.map(l => 
      l.lang === langName ? { ...l, enabled: !l.enabled } : l
    );
    // Don't allow disabling all languages if polyglot is on
    if (newLanguages.every(l => !l.enabled) && config.polyglotEnabled) {
      toast.error("At least one language must remain active.");
      return;
    }
    const newConfig = { ...config, languages: newLanguages };
    setConfig(newConfig);
    saveModuleConfig(newConfig);
  };

  return (
    <div className="flex-1 overflow-y-auto min-h-0 bg-[#fafafa] custom-scrollbar">
      <div className="p-8 max-w-4xl mx-auto space-y-8 pb-20">
        <AdminBreadcrumbs />
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">{t('settings.title', 'General Settings')}</h1>
        <p className="text-slate-500">{t('settings.subtitle', 'Manage session identity and experimental feature modules.')}</p>
      </div>

      <div className="space-y-6">
        <Card className="shadow-sm border-blue-100 bg-blue-50/20">
          <CardHeader>
            <div className="flex items-center gap-2 text-blue-700">
               <UserIcon className="w-5 h-5" />
               <CardTitle>{t('settings.sessionIdentityTitle', 'Session Identity & Personal Configs')}</CardTitle>
            </div>
            <CardDescription>{t('settings.sessionIdentityDesc', 'Manage your current account details, authentication email, password, and session privileges.')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
             <div className="flex flex-col md:flex-row items-start md:items-center justify-between p-4 bg-white rounded-2xl border border-blue-100 shadow-sm gap-4">
                <div className="flex items-center gap-3">
                   <div className="h-12 w-12 bg-blue-100 rounded-full flex items-center justify-center text-blue-700 font-bold border border-blue-200 uppercase text-lg shrink-0">
                      {user?.displayName ? user.displayName.charAt(0).toUpperCase() : (user?.email?.charAt(0).toUpperCase() || 'P')}
                   </div>
                   <div className="flex flex-col min-w-0">
                      <span className="text-base font-bold text-[#202124] truncate">{user?.displayName || t('settings.sovereignOperator', 'Sovereign Operator')}</span>
                      <span className="text-xs text-slate-500 font-medium truncate">{user?.email || 'Not Signed In'}</span>
                      <span className="text-[9px] mt-1 text-muted-foreground uppercase font-black tracking-widest leading-none">
                         {isAdmin ? t('settings.privilegedAdmin', 'Privileged System Admin') : t('settings.agentAccessOnly', 'Agent Access Only')}
                      </span>
                   </div>
                </div>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="rounded-full text-red-600 hover:bg-red-50 border-red-100 font-bold text-xs gap-2 cursor-pointer shrink-0"
                  onClick={handleLogout}
                >
                   <LogOut className="w-3.5 h-3.5" />
                   {t('settings.switchUserLogout', 'Switch User / Logout')}
                </Button>
             </div>

             {/* Personal Details inputs */}
             <div className="grid grid-cols-1 md:grid-cols-3 gap-5 pt-2 mb-2">
                {/* 1. Name Form */}
                <form onSubmit={handleUpdateProfile} className="p-4 bg-white rounded-2xl border border-slate-100 shadow-xs space-y-3.5 flex flex-col justify-between">
                  <div className="space-y-2">
                    <Label className="text-[10px] uppercase font-black text-slate-500 tracking-wider">{t('settings.displayName', 'Display Name')}</Label>
                    <Input 
                      value={displayNameInput}
                      onChange={(e) => setDisplayNameInput(e.target.value)}
                      placeholder="e.g. Premton"
                      className="rounded-xl border-slate-200 text-xs h-10 bg-white"
                    />
                  </div>
                  <Button type="submit" size="sm" className="rounded-xl w-full bg-[#1A73E8] hover:bg-[#1557b0] text-xs font-bold h-9 cursor-pointer mt-2">
                    {t('settings.updateName', 'Update Name')}
                  </Button>
                </form>

                {/* 2. Email Form */}
                <form onSubmit={handleUpdateEmail} className="p-4 bg-white rounded-2xl border border-slate-100 shadow-xs space-y-3.5 flex flex-col justify-between">
                  <div className="space-y-2">
                    <Label className="text-[10px] uppercase font-black text-slate-500 tracking-wider">{t('settings.authEmail', 'Authentication Email')}</Label>
                    <Input 
                      type="email"
                      value={emailInput}
                      onChange={(e) => setEmailInput(e.target.value)}
                      placeholder="e.g. premtonxh@gmail.com"
                      className="rounded-xl border-slate-200 text-xs h-10 bg-white"
                    />
                  </div>
                  <Button type="submit" size="sm" className="rounded-xl w-full bg-[#1A73E8] hover:bg-[#1557b0] text-xs font-bold h-9 cursor-pointer mt-2">
                    {t('settings.updateEmail', 'Update Email')}
                  </Button>
                </form>

                {/* 3. Password Form */}
                <form onSubmit={handleUpdatePassword} className="p-4 bg-white rounded-2xl border border-slate-100 shadow-xs space-y-3.5 flex flex-col justify-between">
                  <div className="space-y-2">
                    <Label className="text-[10px] uppercase font-black text-slate-500 tracking-wider">{t('settings.sovereignPassword', 'Sovereign Password')}</Label>
                    <Input 
                      type="password"
                      value={passwordInput}
                      onChange={(e) => setPasswordInput(e.target.value)}
                      placeholder="••••••••••••"
                      className="rounded-xl border-slate-200 text-xs h-10 bg-white"
                    />
                  </div>
                  <Button type="submit" size="sm" className="rounded-xl w-full bg-[#1A73E8] hover:bg-[#1557b0] text-xs font-bold h-9 cursor-pointer mt-2">
                    {t('settings.updatePassword', 'Update Password')}
                  </Button>
                </form>
             </div>

            <div className="flex items-center justify-between p-4 bg-amber-50/50 rounded-2xl border border-amber-200">
                <div className="flex flex-col gap-0.5">
                   <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-amber-900">{t('settings.forceAdminOverride', 'Force Admin Override')}</span>
                      <Badge className="bg-amber-100 text-amber-700 border-none text-[8px] h-4 uppercase px-1.5 font-bold">{t('settings.debugTool', 'Debug Tool')}</Badge>
                   </div>
                   <span className="text-xs text-amber-700/70">{t('settings.forceAdminOverrideDesc', 'Enable this to simulate full admin access on any account.')}</span>
                </div>
                <Switch 
                  checked={config.debugAdminMode}
                  onCheckedChange={toggleDebugAdmin}
                  className="data-[state=checked]:bg-amber-600"
                />
             </div>

             {isAdmin && (
               <div className="flex items-center justify-between p-4 bg-emerald-50/50 rounded-2xl border border-emerald-200">
                  <div className="flex flex-col gap-0.5">
                     <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-emerald-900">{t('settings.workTimerEngine', 'Work Timer Engine')}</span>
                        <Badge className="bg-emerald-100 text-emerald-700 border-none text-[8px] h-4 uppercase px-1.5 font-bold">{t('settings.global', 'Global')}</Badge>
                     </div>
                     <span className="text-xs text-emerald-700/70">{t('settings.workTimerEngineDesc', 'Toggle the Personio time-tracking module across the organization.')}</span>
                  </div>
                  <Switch 
                    checked={config.personioEnabled}
                    onCheckedChange={(val) => {
                      const newConfig = { ...config, personioEnabled: val };
                      setConfig(newConfig);
                      saveModuleConfig(newConfig);
                      toast.success(`Personio Sync ${val ? 'enabled' : 'disabled'}`);
                    }}
                    className="data-[state=checked]:bg-emerald-600"
                  />
               </div>
             )}
          </CardContent>
        </Card>

         {/* Interface Language Card */}
         <Card className="shadow-sm border-slate-200">
           <CardHeader>
             <div className="flex items-center gap-2 text-[#1A73E8]">
                <Languages className="w-5 h-5" />
                <CardTitle>{t('settings.interfaceLanguage', 'Interface Language')}</CardTitle>
             </div>
             <CardDescription>{t('settings.interfaceLanguageDesc', 'Choose your preferred display language for the GeistDesk interface.')}</CardDescription>
           </CardHeader>
           <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                 <button
                   onClick={() => {
                     i18n.changeLanguage('de');
                     toast.success(t('settings.languageChangedDe', 'Language changed to German!'));
                   }}
                   className={cn(
                     "flex items-center justify-between p-4 rounded-2xl border transition-all text-left",
                     language === 'de' ? "bg-slate-900 text-white border-slate-900 shadow-md" : "bg-white text-slate-900 border-slate-200 hover:bg-slate-50"
                   )}
                 >
                   <div className="flex items-center gap-3">
                     <FlagIcon code="de" className="w-8 h-5" />
                     <div className="flex flex-col">
                       <span className="text-sm font-black">{t('languages.de', 'Deutsch')}</span>
                       <span className={cn("text-[9px] uppercase font-black tracking-wider leading-none mt-1", language === 'de' ? "text-slate-300" : "text-slate-400")}>{t('settings.activeLanguage', 'Active')}</span>
                     </div>
                   </div>
                   {language === 'de' && <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />}
                 </button>

                 <button
                   onClick={() => {
                     i18n.changeLanguage('en');
                     toast.success(t('settings.languageChangedEn', 'Language changed to English!'));
                   }}
                   className={cn(
                     "flex items-center justify-between p-4 rounded-2xl border transition-all text-left",
                     language === 'en' ? "bg-slate-900 text-white border-slate-900 shadow-md" : "bg-white text-slate-900 border-slate-200 hover:bg-slate-50"
                   )}
                 >
                   <div className="flex items-center gap-3">
                     <FlagIcon code="en" className="w-8 h-5" />
                     <div className="flex flex-col">
                       <span className="text-sm font-black">{t('languages.en', 'English')}</span>
                       <span className={cn("text-[9px] uppercase font-black tracking-wider leading-none mt-1", language === 'en' ? "text-slate-300" : "text-slate-400")}>{t('settings.activeLanguage', 'Active')}</span>
                     </div>
                   </div>
                   {language === 'en' && <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />}
                 </button>
              </div>
           </CardContent>
         </Card>

        <Card className="shadow-sm">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Mail className="w-5 h-5 text-primary" />
              <CardTitle>{t('settings.commChannelsTitle', 'Communication Channels')}</CardTitle>
            </div>
            <CardDescription>{t('settings.commChannelsDesc', 'Manage your helpdesk email addresses and SMTP/IMAP settings.')}</CardDescription>
          </CardHeader>
          <CardContent>
             <div 
               onClick={() => navigate('/email-channels')}
               className="group flex items-center justify-between p-4 bg-[#F8F9FA] rounded-2xl border border-[#DADCE0] cursor-pointer hover:border-primary hover:bg-primary/5 transition-all"
             >
                <div className="flex items-center gap-4">
                   <div className="h-10 w-10 bg-white rounded-xl flex items-center justify-center border border-[#DADCE0] text-primary group-hover:scale-110 transition-transform shadow-sm">
                      <Mail className="w-5 h-5" />
                   </div>
                   <div className="flex flex-col">
                      <span className="text-sm font-bold">{t('settings.emailChannels', 'Email Channels')}</span>
                      <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">{t('settings.emailChannelsDesc', 'Configure SMTP, OAuth, & Signatures')}</span>
                   </div>
                </div>
                <Button variant="ghost" size="icon" className="rounded-full">
                   <ArrowRight className="w-4 h-4" />
                </Button>
             </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-blue-100 bg-blue-50/10">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Cpu className="w-5 h-5 text-blue-600" />
                <CardTitle className="text-blue-900">{t('settings.modelOrchestrator', 'Model Orchestrator')}</CardTitle>
              </div>
              <Badge variant="outline" className="text-[9px] font-black uppercase text-blue-600 border-blue-200">{t('settings.centralizedAi', 'Centralized AI')}</Badge>
            </div>
            <CardDescription>{t('settings.modelOrchestratorDesc', 'Manage routing for sentiment analysis and deep reasoning engines.')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
             <div 
               onClick={() => navigate('/admin/ai')}
               className="group flex items-center justify-between p-4 bg-white rounded-2xl border border-blue-100 cursor-pointer hover:border-blue-300 hover:bg-blue-50/50 transition-all shadow-sm"
             >
                <div className="flex items-center gap-4">
                   <div className="h-10 w-10 bg-blue-50 rounded-xl flex items-center justify-center border border-blue-100 text-blue-600 group-hover:scale-110 transition-transform">
                      <Sparkles className="w-5 h-5 shadow-sm" />
                   </div>
                   <div className="flex flex-col">
                      <span className="text-sm font-bold text-blue-900">{t('settings.intelligenceRouting', 'Intelligence Routing')}</span>
                      <span className="text-[10px] text-blue-700/60 uppercase font-black tracking-widest leading-none">{t('settings.intelligenceRoutingDesc', 'Configure Local & Cloud LLMs')}</span>
                   </div>
                </div>
                <div className="flex items-center gap-3">
                   <Button variant="ghost" size="icon" className="rounded-full text-blue-400 group-hover:text-blue-600">
                      <ArrowRight className="w-4 h-4" />
                   </Button>
                </div>
             </div>

             <div 
               onClick={() => navigate('/admin/legal')}
               className="group flex items-center justify-between p-4 bg-amber-50/30 rounded-2xl border border-amber-100 cursor-pointer hover:border-amber-300 hover:bg-amber-50/50 transition-all shadow-sm"
             >
                <div className="flex items-center gap-4">
                   <div className="h-10 w-10 bg-amber-50 rounded-xl flex items-center justify-center border border-amber-100 text-amber-600 group-hover:scale-110 transition-transform">
                      <ShieldAlert className="w-5 h-5 shadow-sm" />
                   </div>
                   <div className="flex flex-col">
                      <span className="text-sm font-bold text-amber-900">{t('settings.legalGuardrails', 'Legal Guardrails')}</span>
                      <span className="text-[10px] text-amber-700/60 uppercase font-black tracking-widest leading-none">{t('settings.legalGuardrailsDesc', 'AI Compliance & Forbidden Text')}</span>
                   </div>
                </div>
                <Button variant="ghost" size="icon" className="rounded-full text-amber-400 group-hover:text-amber-600">
                   <ArrowRight className="w-4 h-4" />
                </Button>
             </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-emerald-100 bg-emerald-50/10">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-emerald-600" />
                <CardTitle className="text-emerald-900">{t('settings.personioConnect', 'Personio Connect')}</CardTitle>
              </div>
              <Badge variant="outline" className="text-[9px] font-black uppercase text-emerald-600 border-emerald-200">{t('settings.hrSync', 'HR Synchronization')}</Badge>
            </div>
            <CardDescription>{t('settings.personioConnectDesc', 'Integrate time-tracking with Personio Attendance API.')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-[10px] uppercase font-black text-slate-500">{t('settings.personioClientId', 'Personio Client ID')}</Label>
                <Input 
                  value={config.personioClientId}
                  onChange={(e) => setConfig({ ...config, personioClientId: e.target.value })}
                  placeholder="Enter Client ID" 
                  className="rounded-xl border-emerald-100 focus:ring-emerald-500" 
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] uppercase font-black text-slate-500">{t('settings.clientSecret', 'Client Secret')}</Label>
                <Input 
                  type="password" 
                  value={config.personioClientSecret}
                  onChange={(e) => setConfig({ ...config, personioClientSecret: e.target.value })}
                  placeholder="••••••••••••" 
                  className="rounded-xl border-emerald-100" 
                />
              </div>
            </div>
              <div className="space-y-2">
                <Label className="text-[10px] uppercase font-black text-slate-500">{t('settings.employeeIdMapping', 'Employee ID Mapping')}</Label>
                <div className="flex items-center gap-2">
                  <Input 
                    value={config.personioEmployeeId || user?.email || ''} 
                    onChange={(e) => setConfig({ ...config, personioEmployeeId: e.target.value })}
                    placeholder="employee@company.com" 
                    className="rounded-xl border-emerald-100" 
                  />
                  <Button 
                    variant="outline" 
                    onClick={() => {
                      toast.promise(axios.post('/api/personio/test-connection', { employeeId: config.personioEmployeeId || user?.email }), {
                        loading: 'Validating Personio Handshake...',
                        success: (res) => `Connection Healthy: Employee Found (${res.data.employeeName})`,
                        error: 'OAuth Failure: Invalid Credentials'
                      });
                    }}
                    className="rounded-xl border-emerald-200 text-emerald-700 bg-white hover:bg-emerald-50 font-bold text-xs shrink-0"
                  >
                    {t('settings.testConnection', 'Test Connection')}
                  </Button>
                </div>
                <p className="text-[10px] text-slate-400 italic">{t('settings.employeeIdMappingDesc', 'This identifies which Personio employee to clock in/out.')}</p>
              </div>
          </CardContent>
        </Card>

        {/* Single Sign-On (Microsoft Entra ID) */}
        <Card className="shadow-sm border-indigo-100 bg-indigo-50/10">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-indigo-600" />
                <CardTitle className="text-indigo-900">{t('settings.entraIdTitle', 'Microsoft Entra ID SSO')}</CardTitle>
              </div>
              <Badge variant="outline" className="text-[9px] font-black uppercase text-indigo-600 border-indigo-200">{t('settings.identityIntegration', 'Identity Integration')}</Badge>
            </div>
            <CardDescription>{t('settings.entraIdDesc', 'Configure Single Sign-On using Microsoft Entra ID (formerly Azure AD) for your enterprise email domain logon.')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between p-4 bg-white rounded-2xl border border-indigo-100 shadow-sm">
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-bold text-indigo-950">{t('settings.enableEntraId', 'Enable Entra ID Single Sign-On')}</span>
                <span className="text-xs text-[#5f6368]">{t('settings.enableEntraIdDesc', 'When active, a "Sign In with Work Account" button will appear on the logon page.')}</span>
              </div>
              <Switch 
                checked={config.ssoEnabled || false}
                onCheckedChange={(val) => {
                  const newConfig = { ...config, ssoEnabled: val };
                  setConfig(newConfig);
                  saveModuleConfig(newConfig);
                  toast.success(`Entra ID SSO ${val ? 'enabled' : 'disabled'}`);
                }}
                className="data-[state=checked]:bg-indigo-600"
              />
            </div>

            {(config.ssoEnabled) && (
              <div className="space-y-4 animate-in fade-in duration-200">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-[10px] uppercase font-black text-slate-500">{t('settings.appClientId', 'Application (Client) ID')}</Label>
                    <Input 
                      value={config.ssoClientId || ''}
                      onChange={(e) => setConfig({ ...config, ssoClientId: e.target.value })}
                      placeholder="e.g. 00000000-0000-0000-0000-000000000000" 
                      className="rounded-xl border-indigo-100 focus:ring-indigo-500 font-mono text-xs" 
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] uppercase font-black text-slate-500">{t('settings.dirTenantId', 'Directory (Tenant) ID')}</Label>
                    <Input 
                      value={config.ssoTenantId || ''}
                      onChange={(e) => setConfig({ ...config, ssoTenantId: e.target.value })}
                      placeholder="e.g. common, organizations, or Tenant ID" 
                      className="rounded-xl border-indigo-100 focus:ring-indigo-500 font-mono text-xs" 
                    />
                  </div>
                </div>

                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2 text-xs text-slate-600">
                   <p className="font-bold text-slate-800">{t('settings.regInstructions', 'Registration Instructions:')}</p>
                   <p>{t('settings.regStep1', '1. Open the Azure Portal > **Microsoft Entra ID** > **App registrations** > **New registration**.')}</p>
                   <p>{t('settings.regStep2', '2. Set the redirect URI as a **Web** platform type with your Firebase Auth redirection handler:')}</p>
                   <div className="bg-white p-2.5 rounded-xl font-mono text-[10px] text-slate-800 break-all border border-slate-200 select-all shadow-inner">
                     https://{firebaseConfig?.projectId || 'your-firebase-project'}.firebaseapp.com/__/auth/handler
                   </div>
                   <p>{t('settings.regStep3', "3. Under Client Credentials, you don't need a client secret for Popup auth, but ensure local domain authentication is enabled.")}</p>
                   <p className="text-[10px] text-indigo-600/80 italic font-semibold">{t('settings.firebaseNote', 'Note: Firebase handles the underlying Microsoft OAuth Provider flow seamlessly once registered.')}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Languages className="w-5 h-5 text-primary" />
              <CardTitle>{t('settings.advancedModules', 'Advanced Modules')}</CardTitle>
            </div>
            <CardDescription>{t('settings.advancedModulesDesc', 'Enable or disable specialized AI sub-systems.')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between p-4 bg-primary/5 rounded-2xl border border-primary/10">
              <div className="flex flex-col gap-0.5">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold">{t('settings.polyglotBridge', 'Polyglot Bridge')}</span>
                  <Badge variant="secondary" className="bg-[#E8F0FE] text-[#1A73E8] border-none text-[9px] font-bold">{t('settings.contextAwareLlm', 'Context-Aware LLM')}</Badge>
                </div>
                <span className="text-xs text-muted-foreground">{t('settings.polyglotBridgeDesc', 'Bidirectional translation for real-time support.')}</span>
              </div>
              <Switch 
                checked={config.polyglotEnabled}
                onCheckedChange={togglePolyglot}
              />
            </div>

            {config.polyglotEnabled && (
              <div className="space-y-4 pt-2">
                <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{t('settings.activeAgentLanguages', 'Active Agent Languages')}</Label>
                <div className="grid grid-cols-2 gap-3">
                  {config.languages.map((lang: any) => (
                    <div 
                      key={lang.lang}
                      className={cn(
                        "flex items-center justify-between p-3 rounded-xl border transition-all",
                        lang.enabled ? "bg-white border-[#DADCE0] shadow-sm" : "bg-muted/10 opacity-50"
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <FlagIcon code={languageToFlagCode(lang.lang)} className="w-6 h-4" />
                        <span className="text-xs font-medium">{lang.lang}</span>
                      </div>
                      <Switch 
                        checked={lang.enabled}
                        onCheckedChange={() => toggleLanguage(lang.lang)}
                        className="scale-75"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card 
          onClick={() => navigate('/admin/pii')}
          className="shadow-sm group cursor-pointer border-[#DADCE0] hover:border-emerald-300 hover:bg-emerald-50/10 transition-all rounded-3xl overflow-hidden"
        >
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-emerald-600 group-hover:scale-110 transition-transform" />
                <CardTitle className="text-slate-900">{t('settings.piiShieldTitle', 'PII Shield Guardrails')}</CardTitle>
              </div>
              <Button variant="ghost" size="icon" className="rounded-full text-emerald-400 group-hover:text-emerald-600">
                 <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
            <CardDescription>{t('settings.piiShieldDesc', 'Configure which sensitive patterns are automatically redacted in prompt middleware.')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between p-3.5 bg-[#F8F9FA] rounded-2xl border border-[#DADCE0] hover:border-emerald-200 transition-colors">
              <div className="flex flex-col">
                <span className="text-xs font-bold text-slate-800">{t('settings.autoEmailRedaction', 'Automatic Email Redaction')}</span>
                <span className="text-[10px] text-muted-foreground">{t('settings.autoEmailRedactionDesc', 'Scrub emails from outgoing LLM requests.')}</span>
              </div>
              <Badge className="bg-emerald-100 text-emerald-700 border-none font-bold text-[9px] px-2 py-0.5">{t('settings.enabled', 'Enabled')}</Badge>
            </div>
            <div className="flex items-center justify-between p-3.5 bg-[#F8F9FA] rounded-2xl border border-[#DADCE0] hover:border-emerald-200 transition-colors">
              <div className="flex flex-col">
                <span className="text-xs font-bold text-slate-800">{t('settings.ccMasking', 'Credit Card Masking')}</span>
                <span className="text-[10px] text-muted-foreground">{t('settings.ccMaskingDesc', 'Detect and mask 16-digit card patterns.')}</span>
              </div>
              <Badge className="bg-emerald-100 text-emerald-700 border-none font-bold text-[9px] px-2 py-0.5">{t('settings.enabled', 'Enabled')}</Badge>
            </div>
          </CardContent>
        </Card>

        {/* Administration & System Governance panel containing any missing configs */}
        <div className="pt-4 border-t border-[#F1F3F4]">
          <h2 className="text-lg font-black tracking-tight text-slate-800 mb-1 flex items-center gap-2">
            <LayoutGrid className="w-5 h-5 text-primary" />
            {t('settings.governanceTitle', 'Governance & Advanced Administration')}
          </h2>
          <p className="text-xs text-slate-500 mb-6 font-medium">{t('settings.governanceDesc', 'Configure deep routing rules, custom meta architectures, role-based safety permissions, and notification endpoints.')}</p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* RBAC Command */}
            <div 
              onClick={() => navigate('/admin/roles')}
              className="group flex flex-col justify-between p-5 bg-white rounded-2xl border border-[#DADCE0] cursor-pointer hover:border-amber-300 hover:bg-amber-50/5 transition-all shadow-xs"
            >
              <div className="flex items-start justify-between">
                <div className="h-10 w-10 bg-amber-50 rounded-xl flex items-center justify-center border border-amber-100 text-amber-600 group-hover:scale-115 transition-transform">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <Badge variant="outline" className="text-[8px] font-black uppercase text-amber-600 border-amber-200">{t('settings.governanceLabel', 'Governance')}</Badge>
              </div>
              <div className="mt-4">
                <h3 className="text-sm font-bold text-slate-900 group-hover:text-amber-800 flex items-center gap-1.5">
                  {t('settings.rbacTitle', 'RBAC Roles & Scopes')}
                  <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:translate-x-1 transition-transform" />
                </h3>
                <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">{t('settings.rbacDesc', 'Configure granular model permissions, user-role bindings, and security access maps.')}</p>
              </div>
            </div>

            {/* Notification triggers */}
            <div 
              onClick={() => navigate('/admin/notifications')}
              className="group flex flex-col justify-between p-5 bg-white rounded-2xl border border-[#DADCE0] cursor-pointer hover:border-orange-300 hover:bg-orange-50/5 transition-all shadow-xs"
            >
              <div className="flex items-start justify-between">
                <div className="h-10 w-10 bg-orange-50 rounded-xl flex items-center justify-center border border-orange-100 text-orange-500 group-hover:scale-115 transition-transform">
                  <Bell className="w-5 h-5" />
                </div>
                <Badge variant="outline" className="text-[8px] font-black uppercase text-orange-600 border-orange-200">{t('settings.automationLabel', 'Automation')}</Badge>
              </div>
              <div className="mt-4">
                <h3 className="text-sm font-bold text-slate-900 group-hover:text-orange-800 flex items-center gap-1.5">
                  {t('settings.notificationsLabel', 'Notifications Engine')}
                  <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:translate-x-1 transition-transform" />
                </h3>
                <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">{t('settings.notificationsDesc', 'Manage system automatic alerts, active dispatch mechanisms, and master layouts.')}</p>
              </div>
            </div>

            {/* Schema architecture */}
            <div 
              onClick={() => navigate('/admin/schema')}
              className="group flex flex-col justify-between p-5 bg-white rounded-2xl border border-[#DADCE0] cursor-pointer hover:border-indigo-300 hover:bg-indigo-50/5 transition-all shadow-xs"
            >
              <div className="flex items-start justify-between">
                <div className="h-10 w-10 bg-indigo-50 rounded-xl flex items-center justify-center border border-indigo-100 text-indigo-600 group-hover:scale-115 transition-transform">
                  <Database className="w-5 h-5" />
                </div>
                <Badge variant="outline" className="text-[8px] font-black uppercase text-indigo-600 border-indigo-200">{t('settings.structureLabel', 'Structure')}</Badge>
              </div>
              <div className="mt-4">
                <h3 className="text-sm font-bold text-slate-900 group-hover:text-indigo-800 flex items-center gap-1.5">
                  {t('settings.metadataLabel', 'Metadata Schemas')}
                  <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:translate-x-1 transition-transform" />
                </h3>
                <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">{t('settings.metadataDesc', 'Design dynamic fields for Custom Accounts and Profiles fed into AI agent context.')}</p>
              </div>
            </div>

            {/* Workforce profile */}
            <div 
              onClick={() => navigate('/admin/workforce')}
              className="group flex flex-col justify-between p-5 bg-white rounded-2xl border border-[#DADCE0] cursor-pointer hover:border-violet-300 hover:bg-violet-50/5 transition-all shadow-xs"
            >
              <div className="flex items-start justify-between">
                <div className="h-10 w-10 bg-violet-50 rounded-xl flex items-center justify-center border border-violet-100 text-violet-600 group-hover:scale-115 transition-transform">
                  <Briefcase className="w-5 h-5" />
                </div>
                <Badge variant="outline" className="text-[8px] font-black uppercase text-violet-600 border-violet-200">{t('settings.managementLabel', 'Management')}</Badge>
              </div>
              <div className="mt-4">
                <h3 className="text-sm font-bold text-slate-900 group-hover:text-violet-800 flex items-center gap-1.5">
                  {t('settings.workforceLabel', 'Workforce Directory')}
                  <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:translate-x-1 transition-transform" />
                </h3>
                <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">{t('settings.workforceDesc', 'Administer agents, onboarding lifecycles, and direct profile credentials.')}</p>
              </div>
            </div>

            {/* Team groups */}
            <div 
              onClick={() => navigate('/admin/groups')}
              className="group flex flex-col justify-between p-5 bg-white rounded-2xl border border-[#DADCE0] cursor-pointer hover:border-teal-300 hover:bg-teal-50/5 transition-all shadow-xs"
            >
              <div className="flex items-start justify-between">
                <div className="h-10 w-10 bg-teal-50 rounded-xl flex items-center justify-center border border-teal-100 text-teal-600 group-hover:scale-115 transition-transform">
                  <Users className="w-5 h-5" />
                </div>
                <Badge variant="outline" className="text-[8px] font-black uppercase text-teal-600 border-teal-200">{t('settings.routingLabel', 'Routing')}</Badge>
              </div>
              <div className="mt-4">
                <h3 className="text-sm font-bold text-slate-900 group-hover:text-teal-800 flex items-center gap-1.5">
                  {t('settings.functionalTeamsLabel', 'Functional Teams')}
                  <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:translate-x-1 transition-transform" />
                </h3>
                <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">{t('settings.functionalTeamsDesc', 'Establish ticket team schedules, weight levels, and direct fallback queues.')}</p>
              </div>
            </div>

            {/* MCP hub */}
            <div 
              onClick={() => navigate('/admin/mcp')}
              className="group flex flex-col justify-between p-5 bg-white rounded-2xl border border-[#DADCE0] cursor-pointer hover:border-rose-300 hover:bg-rose-50/5 transition-all shadow-xs"
            >
              <div className="flex items-start justify-between">
                <div className="h-10 w-10 bg-rose-50 rounded-xl flex items-center justify-center border border-rose-100 text-rose-600 group-hover:scale-115 transition-transform">
                  <Cpu className="w-5 h-5" />
                </div>
                <Badge variant="outline" className="text-[8px] font-black uppercase text-rose-600 border-rose-200">{t('settings.protocolHubLabel', 'Protocol Hub')}</Badge>
              </div>
              <div className="mt-4">
                <h3 className="text-sm font-bold text-slate-900 group-hover:text-rose-800 flex items-center gap-1.5">
                  {t('settings.mcpLabel', 'MCP Protocol Gateway')}
                  <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:translate-x-1 transition-transform" />
                </h3>
                <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">{t('settings.mcpDesc', 'Configure local LLM data providers and register Model Context Protocol servers.')}</p>
              </div>
            </div>

            {/* Integrations hub */}
            <div 
              onClick={() => navigate('/admin/integrations')}
              className="group flex flex-col justify-between p-5 bg-white rounded-2xl border border-[#DADCE0] cursor-pointer hover:border-indigo-300 hover:bg-indigo-50/5 transition-all shadow-xs col-span-1 md:col-span-2"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-11 w-11 bg-indigo-50 rounded-xl flex items-center justify-center border border-indigo-100 text-indigo-600 group-hover:scale-110 transition-transform">
                    <Webhook className="w-5.5 h-5.5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 group-hover:text-indigo-800">{t('settings.apiConnectionLabel', 'API Connection & Webhook Integrations')}</h3>
                    <p className="text-[11px] text-slate-500 mt-0.5">{t('settings.apiConnectionDesc', 'Automate data streams across Personio, Slack, or any customer systems.')}</p>
                  </div>
                </div>
                <Button variant="ghost" size="icon" className="rounded-full text-indigo-400 group-hover:text-indigo-600">
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>

        <Card className="shadow-sm">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Database className="w-5 h-5 text-primary" />
              <CardTitle>{t('settings.vectorDatabase', 'Vector Database (RAG)')}</CardTitle>
            </div>
            <CardDescription>{t('settings.vectorDatabaseDesc', 'Status and health of the knowledge base embeddings.')}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4 text-xs">
              <div className="flex-1 p-3 rounded-lg border bg-green-50/50 flex flex-col gap-1">
                <span className="font-bold text-green-700">{t('settings.healthy', 'Healthy')}</span>
                <span className="text-muted-foreground">{t('settings.index', 'Index:')} geistdesk_kb_v1</span>
              </div>
              <div className="flex-1 p-3 rounded-lg border bg-muted/50 flex flex-col gap-1">
                <span className="font-bold">128</span>
                <span className="text-muted-foreground">{t('settings.totalVectors', 'Total Vectors')}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
    </div>
  );
}
