import { useEffect, useState, type FormEvent } from 'react';
import { auth } from '../../lib/firebase';
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  OAuthProvider, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword 
} from 'firebase/auth';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { toast } from 'sonner';
import { 
  Headphones, 
  Database, 
  KeyRound, 
  Brain, 
  Check, 
  Shield, 
  Fingerprint, 
  Globe, 
  Lock, 
  Eye, 
  EyeOff, 
  Mail, 
  ArrowRight,
  Server,
  Settings2,
  LockKeyhole,
  CheckCircle2,
  FileText,
  AlertCircle,
  Clock,
  ExternalLink,
  ShieldCheck,
  UserCheck,
  LogIn,
  Network,
  Cpu,
  Layers,
  Sparkles
} from 'lucide-react';
import { getModuleConfig } from '../../lib/module-config';
import { GeistDeskLogo } from '../ui/GeistDeskLogo';
import { useTranslation } from '../../lib/context/I18nContext';
import { cn } from '../../lib/utils';
import { FlagIcon, languageToFlagCode } from '../ui/FlagIcon';

const LOCAL_TEXTS = {
  de: {
    platformSub: "Souveräne IT-Betriebsplattform",
    headline: "Der Open-Source-Standard für sichere IT-Operationen",
    subheadlineBefore: "Vereinen Sie Helpdesk, Assets, Anmeldedaten, Wissen und KI-Orchestrierung in einer souveränen, selbstgehosteten Plattform. Behalten Sie ",
    yourData: "Ihre Daten",
    and: ", ",
    yourRules: "Ihre Regeln",
    selfHostedTitle: "Selbstgehostet",
    selfHostedSub: "100% Datensouveränität",
    agplTitle: "AGPLv3",
    agplSub: "Souverän & Open-Source",
    postQuantumTitle: "Post-Quanten",
    postQuantumSub: "ML-KEM Level 3",
    piiShieldTitle: "KI-PII-Schutz",
    piiShieldSub: "Privacy by Design",
    sovereigntyTitle: "Souveränität durch Design",
    sovereigntyDesc: "GeistDesk hält Ihre Operationen innerhalb Ihrer Infrastruktur mit lokaler Verarbeitung, verschlüsselter Speicherung und null externem Datenabfluss.",
    architectureCert: "Sicherheitsarchitektur zertifiziert",
    regulatedIndustries: "Für regulierte Branchen entwickelt",
    autofillDemo: "Demo-Zugang ausfüllen",
    demoLoginBtn: "Als Demo-Benutzer anmelden",
    demoLoginSub: "Voller Admin-Zugang · Keine Registrierung nötig",
    demoLoginHint: "Ideal zum Erkunden der Showcase-Umgebung",
    orSignInWithAccount: "oder mit eigenem Konto anmelden",
    welcomeTitle: "Willkommen zurück",
    welcomeSub: "Sicherer Zugriff auf Ihre GeistDesk-Arbeitsumgebung",
    registerTitle: "Souveräne Zugangsdaten erstellen",
    registerSub: "Registrieren Sie einen sicheren Systemadministrator",
    emailLabel: "E-Mail-Adresse",
    passwordLabel: "Passwort",
    passwordPlaceholder: "Sicheres Passwort eingeben",
    forgotPassword: "Passwort vergessen?",
    rememberMe: "Für 30 Tage angemeldet bleiben",
    signInBtn: "In GeistDesk einloggen",
    signUpBtn: "Registrieren & Einloggen",
    authenticating: "Operator wird authentifiziert...",
    registerSwitchIn: "Bereits registriert? Einloggen",
    registerSwitchUp: "Zugangsdaten benötigt? Personal registrieren",
    orContinueWith: "oder fortfahren mit",
    googleSso: "Mit Google Workspace anmelden",
    entraSso: "Mit Microsoft Entra ID anmelden",
    samlSso: "Mit SAML SSO anmelden",
    needAccess: "Zugang benötigt? Wenden Sie sich an Ihren Administrator",
    systemSecurity: "Systemsicherheit",
    systemStatusDesc: "Alle lokalen Knoten online & kryptografisch isoliert",
    piiShieldActive: "PII-Schutz aktiv",
    phantomVaultReady: "Phantom Vault Bereit",
    mlKemActive: "ML-KEM PQC Aktiv",
    auditLogging: "Audit-Protokollierung",
    footerCopy: "© 2026 GeistDesk • Open Source (AGPLv3)",
    privacyPolicy: "Datenschutzrichtlinie",
    termsOfService: "Nutzungsbedingungen",
    helpdesk: "Helpdesk",
    helpdeskDesc: "Ticketing & Workflows",
    assets: "Assets",
    assetsDesc: "Hardware & Software",
    phantomVault: "Phantom Vault",
    phantomVaultDesc: "Sicherer Secret-Austausch",
    aiOrchestration: "KI-Orchestrierung",
    aiOrchestrationDesc: "Lokale KI mit PII-Schutz",
    toasts: {
      fillFields: "Bitte füllen Sie alle Sicherheitsfelder aus.",
      accountCreated: "Mitarbeiterkonto erfolgreich erstellt. Willkommen bei GeistDesk.",
      credentialsVerified: "Operator-Anmeldaten verifiziert. Zugriff gewährt.",
      authFailed: "Authentifizierungsversuch fehlgeschlagen. Bitte erneut versuchen.",
      workspaceAuth: "Workspace autorisiert. Willkommen zurück bei GeistDesk.",
      entraSession: "Enterprise SSO-Sitzung über Microsoft Entra ID validiert",
      corporateSsoFailed: "Corporate SSO-Authentifizierung fehlgeschlagen",
      prefilled: "Mitarbeiter-Anmeldedaten vorbefüllt!",
      adService: "Die Passwort-Selbstbedienung wird über das Active Directory / Entra ID verwaltet. Bitte wenden Sie sich an Ihren Administrator.",
    }
  },
  en: {
    platformSub: "Sovereign IT Operations Platform",
    headline: "The Open-Source Standard for Secure IT Operations",
    subheadlineBefore: "Unify helpdesk, assets, credentials, knowledge, and AI orchestration in a sovereign self-hosted platform. Keep ",
    yourData: "your data",
    and: ", ",
    yourRules: "your rules",
    selfHostedTitle: "Self-Hosted",
    selfHostedSub: "100% Data Sovereignty",
    agplTitle: "AGPLv3",
    agplSub: "Sovereign & Open Source",
    postQuantumTitle: "Post-Quantum",
    postQuantumSub: "ML-KEM Level 3",
    piiShieldTitle: "AI PII Shield",
    piiShieldSub: "Privacy by Design",
    sovereigntyTitle: "Sovereignty by Design",
    sovereigntyDesc: "GeistDesk keeps your operations inside your infrastructure with local processing, encrypted storage and zero external data leakage.",
    architectureCert: "Security Architecture Certified",
    regulatedIndustries: "Built for Regulated Industries",
    autofillDemo: "Autofill Auth Demo",
    demoLoginBtn: "Login as Demo User",
    demoLoginSub: "Full admin access · No signup required",
    demoLoginHint: "Perfect for exploring the showcase environment",
    orSignInWithAccount: "or sign in with your account",
    welcomeTitle: "Welcome Back",
    welcomeSub: "Secure access to your GeistDesk workspace",
    registerTitle: "Create Sovereign Credentials",
    registerSub: "Register a secure system operator",
    emailLabel: "Email Address",
    passwordLabel: "Password",
    passwordPlaceholder: "Enter secure password",
    forgotPassword: "Forgot password?",
    rememberMe: "Remember me for 30 days",
    signInBtn: "Sign In to GeistDesk",
    signUpBtn: "Register & Sign In",
    authenticating: "Authenticating operator...",
    registerSwitchIn: "Already matching security criteria? Sign In",
    registerSwitchUp: "Need operator credentials? Register staff",
    orContinueWith: "or continue with",
    googleSso: "Sign In with Google Workspace",
    entraSso: "Sign In with Microsoft Entra ID",
    samlSso: "Sign In with SAML SSO",
    needAccess: "Need access? Contact your administrator",
    systemSecurity: "System Security",
    systemStatusDesc: "All local nodes online & cryptographically isolated",
    piiShieldActive: "PII Shield Active",
    phantomVaultReady: "Phantom Vault Ready",
    mlKemActive: "ML-KEM PQC Active",
    auditLogging: "Audit Logging",
    footerCopy: "© 2026 GeistDesk • Open Source (AGPLv3)",
    privacyPolicy: "Privacy Policy",
    termsOfService: "Terms of Service",
    helpdesk: "Helpdesk",
    helpdeskDesc: "Ticketing & Workflows",
    assets: "Assets",
    assetsDesc: "Hardware & Software",
    phantomVault: "Phantom Vault",
    phantomVaultDesc: "Secure Secret Exchange",
    aiOrchestration: "AI Orchestration",
    aiOrchestrationDesc: "Local AI with PII Shield",
    toasts: {
      fillFields: "Please fill in all security fields.",
      accountCreated: "Staff account created successfully. Welcome to GeistDesk.",
      credentialsVerified: "Staff credentials verified. Access granted.",
      authFailed: "Authentication attempt failed. Please try again.",
      workspaceAuth: "Workspace authorized. Welcome back to GeistDesk.",
      entraSession: "Enterprise SSO session validated via Microsoft Entra ID",
      corporateSsoFailed: "Corporate SSO authentication failed",
      prefilled: "Staff operator credentials pre-filled!",
      adService: "Password self-service is managed via Active Directory / Entra ID. Please contact your administrator.",
    }
  }
};

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  
  // Mouse interaction state for creative interactive layout background
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  
  const config = getModuleConfig();
  const { language, i18n } = useTranslation();
  
  // Safeguard language selection to 'de' or 'en'
  const activeLang = (language === 'de' || language === 'en') ? language : 'de';
  const texts = LOCAL_TEXTS[activeLang];

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePos({
        x: (e.clientX / window.innerWidth - 0.5) * 20,
        y: (e.clientY / window.innerHeight - 0.5) * 20
      });
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  const handleEmailAuth = async (e: FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error(texts.toasts.fillFields);
      return;
    }
    setLoading(true);
    try {
      if (isRegister) {
        await createUserWithEmailAndPassword(auth, email, password);
        toast.success(texts.toasts.accountCreated);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
        toast.success(texts.toasts.credentialsVerified);
      }
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || texts.toasts.authFailed);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
      toast.success(texts.toasts.workspaceAuth);
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || "OAuth login failed");
    } finally {
      setLoading(false);
    }
  };

  const handleMicrosoftLogin = async () => {
    setLoading(true);
    const provider = new OAuthProvider('microsoft.com');
    if (config.ssoTenantId) {
      provider.setCustomParameters({
        tenant: config.ssoTenantId,
      });
    }
    try {
      await signInWithPopup(auth, provider);
      toast.success(texts.toasts.entraSession);
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || texts.toasts.corporateSsoFailed);
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = () => {
    toast.info(texts.toasts.adService, {
      duration: 5000,
    });
  };

  // One-click demo access — only available in development or when VITE_DEMO_MODE=true.
  const isDemoMode = import.meta.env.DEV || import.meta.env.VITE_DEMO_MODE === 'true';
  const DEMO_EMAIL = 'demo@geistdesk.com';
  const DEMO_PASSWORD = 'GeistDeskDemo2026';

  const handleDemoLogin = async () => {
    setEmail(DEMO_EMAIL);
    setPassword(DEMO_PASSWORD);
    setIsRegister(false);
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, DEMO_EMAIL, DEMO_PASSWORD);
      toast.success(texts.toasts.workspaceAuth);
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || texts.toasts.authFailed);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen lg:h-screen lg:overflow-hidden grid grid-cols-1 lg:grid-cols-10 bg-[#FAFCFF] text-slate-800 font-sans selection:bg-blue-500/20 antialiased overflow-x-hidden relative">
      
      {/* Dynamic flowing accent particles in background to make entire page feel responsive and alive */}
      <div 
        className="absolute top-10 left-10 w-[450px] h-[450px] bg-blue-400/5 rounded-full blur-[110px] pointer-events-none transition-transform duration-300 ease-out"
        style={{ transform: `translate(${mousePos.x}px, ${mousePos.y}px)` }}
      />
      <div 
        className="absolute bottom-10 right-10 w-[350px] h-[350px] bg-red-400/5 rounded-full blur-[100px] pointer-events-none transition-transform duration-300 ease-out"
        style={{ transform: `translate(${-mousePos.x * 1.5}px, ${-mousePos.y * 1.5}px)` }}
      />
      
      {/* LEFT PANEL: 60% with Premium Light Enterprise Security Blueprint theme */}
      <div className="hidden lg:flex lg:col-span-6 flex-col justify-between p-8 xl:p-12 relative overflow-hidden bg-gradient-to-b from-[#F8FAFC] via-[#F4F7FB] to-[#EEF2F6] border-r border-[#E2E8F0] shadow-sm lg:h-screen">
        
        {/* Subtle dot-pattern structural grid */}
        <div className="absolute inset-0 bg-[radial-gradient(#CBD5E1_1px,transparent_1px)] bg-[size:24px_24px] opacity-75 pointer-events-none" />
        
        {/* Schematic Architectural Grid overlays */}
        <div className="absolute top-1/3 right-0 w-80 h-96 opacity-[0.06] text-blue-800 pointer-events-none">
          <svg viewBox="0 0 100 100" className="w-full h-full" fill="none" stroke="currentColor" strokeWidth="0.5">
            <line x1="0" y1="20" x2="100" y2="20" />
            <line x1="0" y1="50" x2="100" y2="50" />
            <line x1="0" y1="80" x2="100" y2="80" />
            <line x1="30" y1="0" x2="30" y2="100" />
            <line x1="70" y1="0" x2="70" y2="100" />
            <circle cx="30" cy="50" r="15" />
            <circle cx="70" cy="20" r="8" />
          </svg>
        </div>

        {/* Floating Glowing network nodes */}
        <div className="absolute top-40 left-[15%] w-2.5 h-2.5 rounded-full bg-blue-500/50 animate-ping" />
        <div className="absolute top-40 left-[15%] w-2 h-2 rounded-full bg-blue-600 shadow-sm" />
        
        <div className="absolute bottom-52 left-[55%] w-2.5 h-2.5 rounded-full bg-emerald-500/40 animate-ping" style={{ animationDelay: '1.2s' }} />
        <div className="absolute bottom-52 left-[55%] w-2 h-2 rounded-full bg-emerald-600 shadow-sm" />

        {/* Header Logo */}
        <div className="relative z-10 flex items-center justify-between">
          <div className="flex flex-col gap-1">
            <GeistDeskLogo size="sm" showText={true} />
            <span className="text-[10px] text-slate-400 font-extrabold tracking-widest uppercase pl-1.5">
              {texts.platformSub}
            </span>
          </div>
        </div>

        {/* Left Panel Body: Standard-aligned Enterprise visual messaging */}
        <div className="relative z-10 my-auto py-4 xl:py-8 space-y-5 xl:space-y-9 max-w-[620px]">
          
          {/* Main Typography content */}
          <div className="space-y-3.5">
            <h1 className="text-3.5xl md:text-[40px] font-black tracking-tight leading-[1.12] text-slate-900">
              {activeLang === 'de' ? (
                <>
                  Der Open-Source-Standard <br />
                  für <span className="text-blue-600 font-[900]">sichere</span> IT-Operationen
                </>
              ) : (
                <>
                  The Open-Source Standard <br />
                  for <span className="text-blue-600 font-[900]">Secure</span> IT Operations
                </>
              )}
            </h1>
            <p className="text-slate-500 text-sm md:text-base leading-relaxed font-medium">
              {texts.subheadlineBefore}
              <span className="text-blue-600 font-bold">{texts.yourData}</span>
              {texts.and}
              <span className="text-red-600 font-bold">{texts.yourRules}</span>.
            </p>
          </div>

          {/* Interactive Feature Cards (4 Cards Grid) with Light Theme Aesthetics */}
          <div className="grid grid-cols-2 gap-3 xl:gap-4">
            {/* Card 1: Helpdesk */}
            <div className="group p-3 xl:p-4 rounded-xl xl:rounded-2xl bg-white border border-slate-200/70 shadow-[0_2px_8px_rgba(148,163,184,0.06)] hover:border-blue-500/40 hover:shadow-[0_8px_24px_rgba(37,99,235,0.08)] transition-all duration-300 backdrop-blur-sm cursor-pointer">
              <div className="p-2 w-9 h-9 rounded-xl bg-blue-50 border border-blue-100 text-blue-600 flex items-center justify-center mb-2 xl:mb-3 group-hover:scale-110 transition-transform">
                <Headphones className="w-5 h-5" />
              </div>
              <h3 className="text-[11px] font-extrabold text-slate-800 uppercase tracking-widest leading-none">{texts.helpdesk}</h3>
              <p className="text-[11px] text-slate-400 mt-1 font-bold leading-none">{texts.helpdeskDesc}</p>
            </div>

            {/* Card 2: Assets */}
            <div className="group p-3 xl:p-4 rounded-xl xl:rounded-2xl bg-white border border-slate-200/70 shadow-[0_2px_8px_rgba(148,163,184,0.06)] hover:border-emerald-500/40 hover:shadow-[0_8px_24px_rgba(16,185,129,0.08)] transition-all duration-300 backdrop-blur-sm cursor-pointer">
              <div className="p-2 w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-600 flex items-center justify-center mb-2 xl:mb-3 group-hover:scale-110 transition-transform">
                <Database className="w-5 h-5" />
              </div>
              <h3 className="text-[11px] font-extrabold text-slate-800 uppercase tracking-widest leading-none">{texts.assets}</h3>
              <p className="text-[11px] text-slate-400 mt-1 font-bold leading-none">{texts.assetsDesc}</p>
            </div>

            {/* Card 3: Phantom Vault */}
            <div className="group p-3 xl:p-4 rounded-xl xl:rounded-2xl bg-white border border-slate-200/70 shadow-[0_2px_8px_rgba(148,163,184,0.06)] hover:border-purple-500/40 hover:shadow-[0_8px_24px_rgba(147,51,234,0.08)] transition-all duration-300 backdrop-blur-sm cursor-pointer">
              <div className="p-2 w-9 h-9 rounded-xl bg-purple-50 border border-purple-100 text-purple-600 flex items-center justify-center mb-2 xl:mb-3 group-hover:scale-110 transition-transform">
                <KeyRound className="w-5 h-5" />
              </div>
              <h3 className="text-[11px] font-extrabold text-slate-800 uppercase tracking-widest leading-none">{texts.phantomVault}</h3>
              <p className="text-[11px] text-slate-400 mt-1 font-bold leading-none">{texts.phantomVaultDesc}</p>
            </div>

            {/* Card 4: AI Orchestration */}
            <div className="group p-3 xl:p-4 rounded-xl xl:rounded-2xl bg-white border border-slate-200/70 shadow-[0_2px_8px_rgba(148,163,184,0.06)] hover:border-orange-500/40 hover:shadow-[0_8px_24px_rgba(249,115,22,0.08)] transition-all duration-300 backdrop-blur-sm cursor-pointer">
              <div className="p-2 w-9 h-9 rounded-xl bg-orange-50 border border-orange-100 text-orange-600 flex items-center justify-center mb-2 xl:mb-3 group-hover:scale-110 transition-transform">
                <Brain className="w-5 h-5" />
              </div>
              <h3 className="text-[11px] font-extrabold text-slate-800 uppercase tracking-widest leading-none">{texts.aiOrchestration}</h3>
              <p className="text-[11px] text-slate-400 mt-1 font-bold leading-none">{texts.aiOrchestrationDesc}</p>
            </div>
          </div>

          {/* Trust Attributes horizontal bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 xl:gap-4 border-t border-slate-200/80 pt-4 xl:pt-5">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-blue-50 border border-blue-100 text-blue-600 font-extrabold text-xs flex items-center justify-center">✓</div>
              <div className="leading-tight">
                <span className="text-[10px] md:text-[11px] font-black tracking-tight text-slate-800 block">{texts.selfHostedTitle}</span>
                <span className="text-[9px] text-slate-400 font-semibold">{texts.selfHostedSub}</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-blue-50 border border-blue-100 text-blue-600 font-extrabold text-xs flex items-center justify-center">✓</div>
              <div className="leading-tight">
                <span className="text-[10px] md:text-[11px] font-black tracking-tight text-slate-800 block">{texts.agplTitle}</span>
                <span className="text-[9px] text-slate-400 font-semibold">{texts.agplSub}</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-blue-50 border border-blue-100 text-blue-600 font-extrabold text-xs flex items-center justify-center">✓</div>
              <div className="leading-tight">
                <span className="text-[10px] md:text-[11px] font-black tracking-tight text-slate-800 block">{texts.postQuantumTitle}</span>
                <span className="text-[9px] text-slate-400 font-semibold">{texts.postQuantumSub}</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-blue-50 border border-blue-100 text-blue-600 font-extrabold text-xs flex items-center justify-center">✓</div>
              <div className="leading-tight">
                <span className="text-[10px] md:text-[11px] font-black tracking-tight text-slate-800 block">{texts.piiShieldTitle}</span>
                <span className="text-[9px] text-slate-400 font-semibold">{texts.piiShieldSub}</span>
              </div>
            </div>
          </div>

          {/* Sovereignty diagram box with interactive schematic preview */}
          <div className="p-3.5 xl:p-5 rounded-xl xl:rounded-2xl bg-white/70 border border-slate-200/80 shadow-[0_4px_16px_rgba(148,163,184,0.04)] flex flex-col sm:flex-row gap-4 xl:gap-5 items-center backdrop-blur-sm group hover:border-slate-300 transition-all">
            <div className="w-full sm:w-1/4 shrink-0 flex items-center justify-center">
              {/* Premium Light Schematic Diagram */}
              <svg viewBox="0 0 140 140" className="w-28 h-28 drop-shadow-sm">
                {/* Central server node */}
                <rect x="35" y="80" width="70" height="40" rx="8" fill="#F1F5F9" stroke="#94A3B8" strokeWidth="1.5" />
                <rect x="43" y="90" width="10" height="6" rx="2" fill="#3B82F6" />
                <rect x="58" y="90" width="20" height="4" rx="1" fill="#CBD5E1" />
                <circle cx="95" cy="93" r="3" fill="#10B981" className="animate-pulse" />
                
                {/* Outer Secure Shield perimeter */}
                <path d="M 70 10 L 115 25 L 115 65 C 115 95 70 115 70 115 C 70 115 25 95 25 65 L 25 25 Z" fill="rgba(37, 99, 235, 0.04)" stroke="#3B82F6" strokeWidth="1.5" strokeDasharray="4 2" />
                
                {/* Micro controller nodes connection lines */}
                <line x1="70" y1="40" x2="45" y2="70" stroke="#94A3B8" strokeWidth="1" />
                <line x1="70" y1="40" x2="95" y2="70" stroke="#94A3B8" strokeWidth="1" />
                <line x1="70" y1="40" x2="70" y2="80" stroke="#3B82F6" strokeWidth="1.5" />
                
                <circle cx="70" cy="40" r="5" fill="#3B82F6" className="animate-bounce" style={{ animationDuration: '2.5s' }} />
                <circle cx="45" cy="70" r="3" fill="#64748B" />
                <circle cx="95" cy="70" r="3" fill="#64748B" />
              </svg>
            </div>

            <div className="space-y-1.5 text-left">
              <h4 className="text-[11px] font-black uppercase tracking-widest text-slate-800">{texts.sovereigntyTitle}</h4>
              <p className="text-[11px] text-slate-500 font-bold leading-normal">
                {texts.sovereigntyDesc}
              </p>
              <span className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase text-blue-600 hover:text-blue-700 cursor-pointer transition-colors mt-1 hover:underline">
                Explore Sovereign Blueprint <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
              </span>
            </div>
          </div>

        </div>

        {/* Footer info badge */}
        <div className="relative z-10 flex items-center gap-3 border-t border-slate-200/80 pt-3 xl:pt-4 text-slate-400 text-[10px]">
          <div className="p-1 h-7 w-7 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center">
            <Shield className="w-4 h-4 text-blue-600" />
          </div>
          <div className="leading-tight font-bold">
            <span className="text-slate-700 block text-[10px] uppercase font-black tracking-wider leading-none">{texts.regulatedIndustries}</span>
            <span className="text-[9px] text-slate-400 mt-0.5 block">GDPR • HIPAA • ITAR • ISO 27001 Certified System</span>
          </div>
        </div>

      </div>

      {/* RIGHT PANEL: 40% Bright Clean Authentication panel with interactive light accent particles */}
      <div className="lg:col-span-4 flex flex-col justify-between bg-white text-slate-900 p-6 sm:p-12 lg:py-6 lg:px-8 xl:p-12 relative shadow-2xl lg:h-screen lg:overflow-y-auto">
        
        {/* Subtle glowing animated matrix layout grid to make Right background alive */}
        <div className="absolute inset-0 bg-[radial-gradient(#E2E8F0_0.8px,transparent_0.8px)] bg-[size:20px_20px] opacity-40 pointer-events-none" />
        
        {/* Dynamic Interactive Blob follow light effect inside right console panel */}
        <div 
          className="absolute top-2/3 right-10 w-44 h-44 bg-blue-500/5 rounded-full blur-3xl pointer-events-none transition-all duration-500"
          style={{ transform: `translate(${mousePos.x * -0.5}px, ${mousePos.y * -0.5}px)` }}
        />

        {/* Mobile Header branding block */}
        <div className="lg:hidden flex items-center justify-between border-b border-slate-100 pb-4 mb-6">
          <GeistDeskLogo size="xs" showText={true} />
          <span className="text-[9px] bg-slate-100 px-2 py-1 rounded text-slate-600 font-bold tracking-wider uppercase">{activeLang === 'de' ? 'Souveränes Portal' : 'Sovereign Portal'}</span>
        </div>

        {/* Header Action Control: Dual Language Switching bar */}
        <div className="relative z-10 flex justify-between items-center text-xs pb-3.5 border-b border-slate-100">
          
          {/* Active Dual flag selection */}
          <div className="flex items-center gap-1.5 bg-slate-100/80 p-1.5 rounded-full select-none border border-slate-200/50 shadow-inner">
            <button
              type="button"
              onClick={() => i18n.changeLanguage('de')}
              className={cn(
                "w-7 h-7 rounded-full flex items-center justify-center text-sm transition-all duration-200 cursor-pointer",
                activeLang === 'de' 
                  ? "bg-white shadow-sm border border-slate-200 scale-110" 
                  : "opacity-45 hover:opacity-100"
              )}
              title="Deutsch (DE)"
            >
              <FlagIcon code="de" className="w-5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => i18n.changeLanguage('en')}
              className={cn(
                "w-7 h-7 rounded-full flex items-center justify-center text-sm transition-all duration-200 cursor-pointer",
                activeLang === 'en' 
                  ? "bg-white shadow-sm border border-slate-200 scale-110" 
                  : "opacity-45 hover:opacity-100"
              )}
              title="English (EN)"
            >
              <FlagIcon code="en" className="w-5 h-3.5" />
            </button>
          </div>

          <div className="flex gap-2 items-center">
            <div className="h-4 w-px bg-slate-200" />
            <span className="text-slate-400 font-black uppercase text-[9px] tracking-widest pl-0.5">Console v2.6 Ready</span>
          </div>
        </div>

        {/* Auth Box Center Container */}
        <div className="relative z-10 lg:my-auto my-4 py-2 lg:py-4 xl:py-8 max-w-sm w-full mx-auto space-y-5 xl:space-y-7">
          
          <div className="space-y-1.5 text-left">
            {/* Visual Lock Accent component */}
            <div className="w-11 h-11 bg-blue-50 border border-blue-100 text-blue-600 rounded-2xl flex items-center justify-center mb-3.5 shadow-sm shadow-blue-500/5 animate-pulse" style={{ animationDuration: '4s' }}>
              <LockKeyhole className="w-5 h-5" />
            </div>
            
            <h2 className="text-2xl font-extrabold tracking-tight text-slate-900 font-sans">
              {isRegister ? texts.registerTitle : texts.welcomeTitle}
            </h2>
            <p className="text-slate-500 text-xs font-semibold leading-none">
              {isRegister ? texts.registerSub : texts.welcomeSub}
            </p>
          </div>

          {/* Showcase demo entry — one-click explore without credentials */}
          {!isRegister && isDemoMode ? (
            <div className="space-y-3">
              <button
                type="button"
                onClick={handleDemoLogin}
                disabled={loading}
                className="w-full rounded-2xl border border-emerald-200/80 bg-gradient-to-br from-emerald-50 via-white to-teal-50/80 p-4 text-left shadow-sm shadow-emerald-500/5 transition-all hover:border-emerald-300 hover:shadow-md hover:shadow-emerald-500/10 disabled:opacity-60 disabled:pointer-events-none group"
              >
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-emerald-200 bg-white text-emerald-600 shadow-sm group-hover:scale-105 transition-transform">
                    <Sparkles className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-extrabold text-slate-900">{texts.demoLoginBtn}</p>
                    <p className="mt-0.5 text-[11px] font-semibold text-emerald-700">{texts.demoLoginSub}</p>
                    <p className="mt-1 text-[10px] font-medium text-slate-500">{texts.demoLoginHint}</p>
                  </div>
                  <ArrowRight className="mt-2 h-4 w-4 shrink-0 text-emerald-500 transition-transform group-hover:translate-x-0.5" />
                </div>
              </button>

              <div className="relative flex items-center justify-center py-1">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-100" />
                </div>
                <span className="relative bg-white px-3 text-[9px] font-extrabold uppercase tracking-widest text-slate-400">
                  {texts.orSignInWithAccount}
                </span>
              </div>
            </div>
          ) : null}

          {/* Login Action Form */}
          <form onSubmit={handleEmailAuth} className="space-y-3.5">
            
            {/* Email Address field */}
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-[10px] font-black text-slate-500 uppercase tracking-widest block pl-0.5">
                {texts.emailLabel}
              </Label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Mail className="w-4 h-4" />
                </div>
                <Input
                  id="email"
                  type="email"
                  placeholder={texts.emailLabel === 'Email Address' ? "name@company.com" : "name@unternehmen.com"}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
                  className="pl-10 h-11 rounded-xl bg-slate-50 border-slate-200/80 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 shadow-inner text-xs font-semibold"
                  required
                />
              </div>
            </div>

            {/* Password field */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center px-0.5">
                <Label htmlFor="password" className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">
                  {texts.passwordLabel}
                </Label>
                <button
                  type="button"
                  onClick={handleForgotPassword}
                  className="text-[10px] text-blue-600 hover:text-blue-700 font-bold hover:underline"
                >
                  {texts.forgotPassword}
                </button>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder={texts.passwordPlaceholder}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                  className="pl-10 pr-10 h-11 rounded-xl bg-slate-50 border-slate-200/80 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 shadow-inner text-xs font-semibold"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Remember Me */}
            <div className="flex items-center justify-between py-1 px-0.5">
              <label className="flex items-center gap-2 select-none cursor-pointer group">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500 cursor-pointer transition-colors"
                />
                <span className="text-[11px] text-slate-500 font-bold group-hover:text-slate-700 transition-colors">{texts.rememberMe}</span>
              </label>
            </div>

            {/* Primary Action Button */}
            <Button
              type="submit"
              disabled={loading}
              className="w-full h-11 rounded-full bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs gap-2 flex items-center justify-center transition-all shadow-md shadow-blue-500/10 cursor-pointer group"
            >
              {loading ? (
                <span>{texts.authenticating}</span>
              ) : (
                <>
                  {isRegister ? <UserCheck className="w-4.5 h-4.5" /> : <LogIn className="w-4.5 h-4.5" />}
                  <span>{isRegister ? texts.signUpBtn : texts.signInBtn}</span>
                </>
              )}
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
            </Button>

          </form>

          {/* Toggle credentials state link */}
          <div className="text-center text-xs">
            <button 
              type="button" 
              onClick={() => setIsRegister(!isRegister)} 
              className="text-blue-600 hover:text-blue-700 hover:underline font-bold"
              disabled={loading}
            >
              {isRegister ? texts.registerSwitchIn : texts.registerSwitchUp}
            </button>
          </div>

          {/* Divider */}
          <div className="relative my-4 xl:my-6 flex items-center justify-center">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-100"></div>
            </div>
            <span className="relative bg-white px-3 text-[9px] uppercase tracking-widest text-slate-400 font-extrabold">{texts.orContinueWith}</span>
          </div>

          {/* Federated Sign In Options */}
          <div className="space-y-2 xl:space-y-2.5">
            {/* Google Identity */}
            <button 
              onClick={handleGoogleLogin} 
              disabled={loading}
              type="button"
              className="w-full h-10.5 rounded-xl bg-white border border-slate-200/80 text-slate-700 hover:bg-slate-50 hover:border-slate-300 shadow-sm font-bold text-[11px] gap-3 flex items-center justify-center transition-all cursor-pointer"
            >
              <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-4.5 h-4.5" alt="Google" />
              {texts.googleSso}
            </button>

            {/* Entra ID Microsoft Enterprise */}
            {config.ssoEnabled && (
              <button 
                onClick={handleMicrosoftLogin} 
                disabled={loading}
                type="button"
                className="w-full h-10.5 rounded-xl bg-white border border-slate-200/80 text-slate-700 hover:bg-slate-50 hover:border-slate-300 shadow-sm font-bold text-[11px] gap-3 flex items-center justify-center transition-all cursor-pointer"
              >
                <svg className="w-4 h-4" viewBox="0 0 23 23">
                  <path fill="#f35325" d="M1 1h10v10H1z"/>
                  <path fill="#81bc06" d="M12 1h10v10H12z"/>
                  <path fill="#05a6f0" d="M1 12h10v10H1z"/>
                  <path fill="#ffba08" d="M12 12h10v10H12z"/>
                </svg>
                {texts.entraSso}
              </button>
            )}

            {/* Federated SAML Enterprise Solution */}
            <button 
              onClick={() => toast.info(activeLang === 'de' ? "Föderiertes SAML Single Sign-On wurde an den Identitätsanbieter weitergeleitet." : "Federated SAML Single Sign-On redirected to Identity Provider.")}
              disabled={loading}
              type="button"
              className="w-full h-10.5 rounded-xl bg-white border border-slate-200/80 text-slate-700 hover:bg-slate-50 hover:border-slate-300 shadow-sm font-bold text-[11px] gap-2.5 flex items-center justify-center transition-all cursor-pointer"
            >
              <ShieldCheck className="w-4.5 h-4.5 text-blue-600" />
              {texts.samlSso}
            </button>
          </div>

          {/* System Access Request Banner info */}
          <p className="text-center text-[10px] text-slate-500 font-semibold leading-relaxed">
            {texts.needAccess.split('?')[0]}? <span className="text-blue-600 hover:underline cursor-pointer font-bold select-all">{texts.needAccess.split('?')[1]?.trim() || texts.needAccess}</span>
          </p>

        </div>

        {/* Live Operational Security Indicators console box at the bottom */}
        <div className="relative z-10 space-y-3 xl:space-y-4 pt-4 xl:pt-5 border-t border-slate-100">
          <div className="p-3 bg-slate-50/80 rounded-2xl border border-slate-100/80 text-slate-600 flex flex-col sm:flex-row gap-3 items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-5.5 h-5.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500">
                <CheckCircle2 className="w-4 h-4" />
              </div>
              <div className="text-left font-sans text-slate-800">
                <p className="text-[10px] font-black uppercase tracking-wider leading-none">{texts.systemSecurity}</p>
                <p className="text-[9px] text-slate-400 font-semibold mt-0.5 leading-none">{texts.systemStatusDesc}</p>
              </div>
            </div>

            {/* Embedded Live Status signals */}
            <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[8px] font-black text-slate-400">
              <span className="flex items-center gap-1 leading-none text-slate-500"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span> {texts.piiShieldActive}</span>
              <span className="flex items-center gap-1 leading-none text-slate-500"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> {texts.phantomVaultReady}</span>
              <span className="flex items-center gap-1 leading-none text-slate-500"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> {texts.mlKemActive}</span>
              <span className="flex items-center gap-1 leading-none text-slate-500"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> {texts.auditLogging}</span>
            </div>
          </div>

          {/* Console footer links */}
          <div className="flex flex-col sm:flex-row items-center justify-between text-[9px] text-slate-400 gap-2 px-1">
            <span className="font-bold text-slate-400">{texts.footerCopy}</span>
            <div className="flex gap-3 text-slate-400 font-extrabold uppercase tracking-widest text-[8px]">
              <span className="hover:text-slate-600 cursor-pointer">{texts.privacyPolicy}</span>
              <span className="text-slate-200">|</span>
              <span className="hover:text-slate-600 cursor-pointer">{texts.termsOfService}</span>
            </div>
          </div>
        </div>

      </div>

    </div>
  );
}
