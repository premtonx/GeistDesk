/**
 * First-run configuration wizard — Day-0 setup at /onboarding.
 */

import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Building2,
  CheckCircle2,
  ChevronDown,
  Cloud,
  Copy,
  KeyRound,
  Loader2,
  Lock,
  Mail,
  Radio,
  Server,
  ShieldCheck,
  Sparkles,
  Ticket,
  UploadCloud,
  XCircle,
  Zap,
} from 'lucide-react';
import { toast } from 'sonner';
import { GeistDeskLogo } from '../ui/GeistDeskLogo';
import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Checkbox } from '../ui/checkbox';
import { Badge } from '../ui/badge';
import { Progress } from '../ui/progress';
import { cn } from '../../lib/utils';
import { useAuth } from '../../lib/hooks';
import { useOnboardingStatus } from '../../hooks/useOnboardingStatus';
import { applyModuleConfigToStorage, getModuleConfig } from '../../lib/module-config';
import { deriveMasterKey, buildVaultKeySalt } from '../../lib/credential-vault-crypto';
import { applyAuthenticatedSession } from '../../lib/firebase-custom-client';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';

type AiMode = 'sovereign' | 'cloud' | 'disabled';
type CloudProvider = 'openai' | 'azure' | 'anthropic' | 'groq';
type IngestChannel = 'webhook' | 'imap_basic' | 'imap_oauth2' | 'microsoft_graph';

const STEPS = [
  { id: 1, title: 'Administrator-Konto', subtitle: 'Name, E-Mail, Passwort' },
  { id: 2, title: 'KI-Engine', subtitle: 'LLM & Embeddings' },
  { id: 3, title: 'Module', subtitle: 'Feature-Aktivierung' },
  { id: 4, title: 'E-Mail-Kanal', subtitle: 'Eingehende Mails' },
];

const DEFAULT_INBOUND_DOMAIN = 'inbound.geistai.eu';

function passwordIssues(value: string): string[] {
  const issues: string[] = [];
  if (value.length < 12) issues.push('mindestens 12 Zeichen');
  if (!/[A-Z]/.test(value)) issues.push('einen Großbuchstaben');
  if (!/[a-z]/.test(value)) issues.push('einen Kleinbuchstaben');
  if (!/[0-9]/.test(value)) issues.push('eine Zahl');
  return issues;
}

export default function OnboardingWizardPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { status, loading, refresh } = useOnboardingStatus();

  const [step, setStep] = useState(1);
  const [adminRegistered, setAdminRegistered] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
    latencyMs?: number;
    models?: string[];
  } | null>(null);

  const [adminEmail, setAdminEmail] = useState('');
  const [adminName, setAdminName] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [vaultPassphrase, setVaultPassphrase] = useState('');
  const [confirmVault, setConfirmVault] = useState('');
  const [useVaultForAdmin, setUseVaultForAdmin] = useState(true);

  const [aiMode, setAiMode] = useState<AiMode>('sovereign');
  const [cloudProvider, setCloudProvider] = useState<CloudProvider>('openai');
  const [endpointUrl, setEndpointUrl] = useState('http://ollama:11434');
  const [apiKey, setApiKey] = useState('');
  const [chatModel, setChatModel] = useState('llama3.1');
  const [embeddingModel, setEmbeddingModel] = useState('nomic-embed-text');

  const [geistKB, setGeistKB] = useState(true);
  const [geistVault, setGeistVault] = useState(true);
  const [geistExchange, setGeistExchange] = useState(true);
  const [importSampleData, setImportSampleData] = useState(false);

  // RAG pipeline defaults (Step 3) — index resolved tickets / new KB articles
  // and enable semantic duplicate detection.
  const [ragIndexResolvedTickets, setRagIndexResolvedTickets] = useState(true);
  const [ragIndexNewKbArticles, setRagIndexNewKbArticles] = useState(true);
  const [ragDetectDuplicates, setRagDetectDuplicates] = useState(true);

  const [ingestChannel, setIngestChannel] = useState<IngestChannel>('webhook');
  const [supportEmail, setSupportEmail] = useState('');
  const [imapHost, setImapHost] = useState('');
  const [imapPort, setImapPort] = useState('993');
  const [imapTls, setImapTls] = useState(true);
  const [imapUser, setImapUser] = useState('');
  const [imapPassword, setImapPassword] = useState('');
  const [imapOauthClientId, setImapOauthClientId] = useState('');
  const [imapOauthClientSecret, setImapOauthClientSecret] = useState('');
  const [imapOauthTokenUrl, setImapOauthTokenUrl] = useState('');
  const [graphTenantId, setGraphTenantId] = useState('');
  const [graphClientId, setGraphClientId] = useState('');
  const [graphClientSecret, setGraphClientSecret] = useState('');

  useEffect(() => {
    if (!status) return;
    // A fully initialized workspace redirects away — except when side effects
    // were interrupted mid-way (needsResume), where we stay to finish setup.
    if (status.isInitialized && !status.needsResume) {
      navigate(user ? '/dashboard' : '/login', { replace: true });
      return;
    }
    if (status.hasAdminUser && status.isInitialized) {
      // Partial completion — resume: admin already exists, jump to the AI step.
      setAdminRegistered(true);
      setStep(2);
    } else if (status.hasAdminUser) {
      // Stuck mid-wizard resume: an admin row exists but /complete never ran.
      // The admin password is already set server-side, so the user must be
      // signed in before finishing setup — otherwise /complete would 401.
      setAdminRegistered(true);
      if (!user) {
        navigate('/login', { replace: true });
        return;
      }
      if (!adminEmail && user.email) setAdminEmail(user.email);
      if (!adminName && user.displayName) setAdminName(user.displayName);
      setStep(2);
      return;
    }
    if (status.defaults?.ollamaEndpoint) setEndpointUrl(status.defaults.ollamaEndpoint);
    if (status.defaults?.chatModel) setChatModel(status.defaults.chatModel);
    if (status.defaults?.embeddingModel) setEmbeddingModel(status.defaults.embeddingModel);
    if (status.ragDefaults) {
      setRagIndexResolvedTickets(status.ragDefaults.indexResolvedTickets !== false);
      setRagIndexNewKbArticles(status.ragDefaults.indexNewKbArticles !== false);
      setRagDetectDuplicates(status.ragDefaults.detectDuplicates !== false);
    }
  }, [status, navigate, user]);

  // Vault Master Key sync: when the admin password is reused for GeistVault,
  // mirror the password fields so the vault can be derived from the same
  // passphrase without requiring a second input.
  useEffect(() => {
    if (!useVaultForAdmin) return;
    setVaultPassphrase(newPassword);
    setConfirmVault(confirmPassword);
  }, [useVaultForAdmin, newPassword, confirmPassword]);

  const pwdIssues = useMemo(() => passwordIssues(newPassword), [newPassword]);
  const vaultIssues = useMemo(() => passwordIssues(vaultPassphrase), [vaultPassphrase]);

  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adminEmail.trim());
  const vaultSatisfied = useVaultForAdmin
    ? newPassword === confirmPassword && pwdIssues.length === 0
    : vaultIssues.length === 0 && vaultPassphrase === confirmVault;
  const canStep1 =
    emailOk &&
    adminName.trim().length > 0 &&
    pwdIssues.length === 0 &&
    newPassword === confirmPassword &&
    vaultSatisfied;

  const vaultPassphraseSet = vaultPassphrase.length >= 12;

  const canStep2 =
    aiMode === 'disabled' ||
    (aiMode === 'sovereign' && endpointUrl.trim().length > 0) ||
    (aiMode === 'cloud' && apiKey.trim().length > 0 && (cloudProvider !== 'azure' || endpointUrl.trim().length > 0));

  const progress = (step / STEPS.length) * 100;

  const forwardingDomain = status?.forwardingDomain?.trim() || DEFAULT_INBOUND_DOMAIN;
  // Derive a deterministic slug from the admin email local-part, matching the
  // channel-id slug format used by buildForwardingAddress (alphanumeric only).
  const forwardingSlug =
    (adminEmail.split('@')[0] || '')
      .replace(/[^a-zA-Z0-9]/g, '')
      .slice(0, 16)
      .toLowerCase() || 'support';
  const forwardingAddress = `help-${forwardingSlug}@${forwardingDomain}`;

  // Distinct German test-connection banners for the AI step.
  const isDistinctAiError = useMemo(() => {
    if (!testResult) return false;
    if (aiMode === 'sovereign') return true;
    return testResult.success && typeof testResult.latencyMs === 'number';
  }, [testResult, aiMode]);

  const distinctAiMessage = useMemo(() => {
    if (!testResult) return '';
    if (aiMode === 'sovereign') {
      if (testResult.success) {
        return `Verbindung erfolgreich (Antwortzeit: ${testResult.latencyMs ?? 0}ms)`;
      }
      const raw = String(testResult.message || '');
      const looksUnreachable =
        /unreachable/i.test(raw) ||
        /ECONNREFUSED/i.test(raw) ||
        /fetch failed/i.test(raw) ||
        /network/i.test(raw) ||
        /Failed to fetch/i.test(raw);
      if (looksUnreachable) {
        return 'Verbindung zu Ollama fehlgeschlagen (Host nicht erreichbar).';
      }
      const missingModel = !testResult.models || testResult.models.length === 0;
      if (missingModel || /no models/i.test(raw) || /nicht gefunden/i.test(raw)) {
        return `Modell '${chatModel}' nicht gefunden. Bitte führen Sie 'ollama pull ${chatModel}' auf dem Server aus.`;
      }
      return raw;
    }
    return `Verbindung erfolgreich (Antwortzeit: ${testResult.latencyMs ?? 0}ms)`;
  }, [testResult, aiMode, chatModel]);

  const registerAdminAndContinue = async () => {
    if (adminRegistered) {
      setStep(2);
      return;
    }
    if (!canStep1) {
      toast.error('Bitte Admin-Name, E-Mail und Passwort ausfüllen.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await axios.post(
        '/api/admin/onboarding/register-admin',
        {
          adminEmail: adminEmail.trim(),
          adminName: adminName.trim(),
          newPassword,
          vaultPassphraseSet,
        },
        { withCredentials: true },
      );
      if (res.data?.user) {
        applyAuthenticatedSession(res.data.user);
      }
      setAdminRegistered(true);
      setStep(2);
    } catch (err: any) {
      const message =
        err?.response?.data?.error ||
        err?.message ||
        'Administrator-Konto konnte nicht erstellt werden.';
      toast.error(String(message));
    } finally {
      setSubmitting(false);
    }
  };

  const handleTestAi = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await axios.post(
        '/api/admin/onboarding/test-ai',
        {
          mode: aiMode,
          endpointUrl,
          apiKey,
          provider: cloudProvider,
          chatModel,
          embeddingModel,
        },
        { withCredentials: true, validateStatus: () => true },
      );
      const payload = res.data as { success?: boolean; message?: string; latencyMs?: number; models?: string[] };
      setTestResult({
        success: Boolean(payload.success),
        message: payload.message || (payload.success ? 'Verbunden' : 'Verbindung fehlgeschlagen'),
        latencyMs: payload.latencyMs,
        models: payload.models,
      });
    } catch (err) {
      setTestResult({
        success: false,
        message: err instanceof Error ? err.message : 'Verbindung fehlgeschlagen',
      });
    } finally {
      setTesting(false);
    }
  };

  const finish = async (skipIngest: boolean) => {
    // Resume mode: an admin already exists and the wizard jumped past step 1,
    // so the admin form (password/vault) is not required to finish setup.
    if (!adminRegistered && !canStep1) {
      toast.error('Bitte zuerst das Administratorkonto und den Vault Master Key vervollständigen.');
      setStep(1);
      return;
    }
    setSubmitting(true);
    try {
      const res = await axios.post(
        '/api/admin/onboarding/complete',
        {
          adminEmail: adminEmail.trim() || undefined,
          adminName: adminName.trim() || undefined,
          newPassword: adminRegistered ? undefined : newPassword,
          vaultPassphraseSet: geistVault && vaultPassphraseSet,
          ai: {
            mode: aiMode,
            endpointUrl,
            apiKey,
            provider: cloudProvider,
            chatModel,
            embeddingModel,
          },
          modules: { geistKB, geistVault, geistExchange },
          importSampleData,
          ragDefaults: {
            indexResolvedTickets: ragIndexResolvedTickets,
            indexNewKbArticles: ragIndexNewKbArticles,
            detectDuplicates: ragDetectDuplicates,
          },
          ingestion: skipIngest
            ? { skip: true, channel: ingestChannel }
            : {
                skip: false,
                channel: ingestChannel,
                supportEmail: supportEmail.trim() || adminEmail.trim(),
                imapHost,
                imapPort: imapPort.trim() || '993',
                imapTls,
                imapUser,
                imapPassword,
                imapOauthClientId,
                imapOauthClientSecret,
                imapOauthTokenUrl,
                graphTenantId,
                graphClientId,
                graphClientSecret,
              },
        },
        { withCredentials: true },
      );

      const createdUser = res.data?.user;
      if (createdUser) {
        applyAuthenticatedSession(createdUser);
      }
      const uid = createdUser?.id || user?.uid;
      if (geistVault && (vaultPassphrase || useVaultForAdmin) && uid) {
        try {
          await deriveMasterKey(vaultPassphrase, buildVaultKeySalt(uid));
          await axios.post('/api/credential-vault/initialize', {}, { withCredentials: true });
        } catch (vaultErr) {
          console.warn('[Onboarding] Vault client init skipped:', vaultErr);
        }
      }

      const enabledModules = res.data?.modules || {
        tickets: true,
        geistKB,
        geistVault,
        geistExchange,
      };
      const next = getModuleConfig();
      applyModuleConfigToStorage({
        ...next,
        is_initialized: true,
        platformModules: enabledModules,
      });

      window.dispatchEvent(
        new CustomEvent('onboarding-status-changed', {
          detail: {
            isInitialized: true,
            requiresOnboarding: false,
            needsResume: false,
            hasAdminUser: true,
            modules: enabledModules,
          },
        }),
      );

      toast.success(
        res.data?.channelId
          ? 'GeistDesk ist eingerichtet. Der primäre E-Mail-Kanal wurde erstellt.'
          : 'GeistDesk ist eingerichtet. Willkommen!',
      );
      await refresh();
      navigate('/dashboard', { replace: true });
    } catch (err: any) {
      const message =
        err?.response?.data?.error ||
        err?.response?.data?.details?.formErrors?.[0] ||
        err?.message ||
        'Einrichtung konnte nicht abgeschlossen werden.';
      toast.error(String(message));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-50 via-background to-muted">
      <div className="mx-auto max-w-3xl px-4 py-10">
        <div className="mb-8 flex items-center gap-3">
            <GeistDeskLogo size="xs" showText={true} />
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">ERSTEINRICHTUNG</p>
            <h1 className="text-2xl font-semibold tracking-tight">GeistDesk Konfiguration</h1>
          </div>
        </div>

        <div className="mb-6 space-y-2">
          <div className="flex justify-between text-xs font-medium text-muted-foreground">
            {STEPS.map((s) => (
              <span key={s.id} className={cn(step === s.id && 'text-foreground')}>
                {s.id}. {s.title}
              </span>
            ))}
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        {step === 1 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-emerald-600" />
                Administrator-Konto erstellen
              </CardTitle>
              <CardDescription>
                Legen Sie das erste Administratorkonto für diese Instanz an und setzen Sie den zero-knowledge
                Vault Master Key. Der Schlüssel verlässt diesen Browser nicht.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="admin-name">Admin-Name</Label>
                <Input
                  id="admin-name"
                  type="text"
                  autoComplete="name"
                  value={adminName}
                  onChange={(e) => setAdminName(e.target.value)}
                  placeholder="Ada Lovelace"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="admin-email">Admin-E-Mail</Label>
                <Input
                  id="admin-email"
                  type="email"
                  autoComplete="username"
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                  placeholder="admin@ihre-domain.eu"
                />
                {adminEmail && !emailOk && (
                  <p className="text-xs text-destructive">Bitte eine gültige E-Mail-Adresse eingeben.</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-password">Passwort</Label>
                <Input
                  id="new-password"
                  type="password"
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
                {newPassword && pwdIssues.length > 0 && (
                  <p className="text-xs text-destructive">Erfordert {pwdIssues.join(', ')}.</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password">Passwort bestätigen</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
                {confirmPassword && confirmPassword !== newPassword && (
                  <p className="text-xs text-destructive">Passwörter stimmen nicht überein.</p>
                )}
              </div>
              <label
                htmlFor="use-vault-for-admin"
                className="flex items-start gap-3 rounded-xl border p-4 cursor-pointer hover:border-primary/40"
              >
                <Checkbox
                  id="use-vault-for-admin"
                  checked={useVaultForAdmin}
                  onCheckedChange={(checked) => setUseVaultForAdmin(checked === true)}
                  className="mt-0.5"
                />
                <span className="space-y-1">
                  <span className="block text-sm font-medium">Master-Passwort auch für GeistVault verwenden (Empfohlen)</span>
                  <span className="block text-xs text-muted-foreground">
                    Das Admin-Passwort dient zugleich als Master Key für den zero-knowledge Vault. Keine separate
                    Passphrase nötig.
                  </span>
                </span>
              </label>
              {useVaultForAdmin ? (
                <details className="group rounded-lg border bg-muted/40 p-4">
                  <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-medium">
                    <KeyRound className="h-4 w-4" />
                    Vault Master Key ändern
                    <ChevronDown className="ml-auto h-4 w-4 transition-transform group-open:rotate-180" />
                  </summary>
                  <div className="mt-3 space-y-3">
                    <p className="text-xs text-muted-foreground">
                      Bei Verwendung des Admin-Passworts entfällt dieser Schritt. Falls Sie für den Vault eine eigene
                      Passphrase wünschen, deaktivieren Sie die Checkbox oben.
                    </p>
                  </div>
                </details>
              ) : (
                <div className="rounded-lg border bg-muted/40 p-4 space-y-3">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <KeyRound className="h-4 w-4" />
                    Vault Master Key
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Wird nur im Browser verwendet (Argon2id → AES-256-GCM). Bei Verlust ist Vault-Ciphertext nicht wiederherstellbar.
                  </p>
                  <div className="space-y-2">
                    <Label htmlFor="vault-pass">Vault Master Key</Label>
                    <Input
                      id="vault-pass"
                      type="password"
                      value={vaultPassphrase}
                      onChange={(e) => setVaultPassphrase(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="vault-pass-2">Vault Master Key bestätigen</Label>
                    <Input
                      id="vault-pass-2"
                      type="password"
                      value={confirmVault}
                      onChange={(e) => setConfirmVault(e.target.value)}
                    />
                  </div>
                  {vaultPassphrase && vaultIssues.length > 0 && (
                    <p className="text-xs text-destructive">Passphrase erfordert {vaultIssues.join(', ')}.</p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {step === 2 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-blue-600" />
                KI & LLM Engine
              </CardTitle>
              <CardDescription>
                Wählen Sie eine lokale Sovereign-Engine, eine Cloud-API oder den Regeln-Modus ganz ohne LLM.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-3">
                {(
                  [
                    { id: 'sovereign' as const, icon: Server, title: '100 % Sovereign', body: 'Lokales Ollama' },
                    { id: 'cloud' as const, icon: Cloud, title: 'Cloud API', body: 'OpenAI / Anthropic / Groq / Azure' },
                    { id: 'disabled' as const, icon: Radio, title: 'KI deaktivieren', body: 'Nur Regeln' },
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => {
                      setAiMode(opt.id);
                      setTestResult(null);
                    }}
                    className={cn(
                      'rounded-xl border p-4 text-left transition hover:border-primary/50',
                      aiMode === opt.id && 'border-primary bg-primary/5 ring-1 ring-primary/30',
                    )}
                  >
                    <opt.icon className="mb-2 h-5 w-5" />
                    <div className="font-medium">{opt.title}</div>
                    <div className="text-xs text-muted-foreground">{opt.body}</div>
                  </button>
                ))}
              </div>

              {aiMode === 'sovereign' && (
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2 sm:col-span-2">
                    <Label>Ollama-Host</Label>
                    <Input
                      value={endpointUrl}
                      onChange={(e) => setEndpointUrl(e.target.value)}
                      placeholder="http://ollama:11434"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Chat-Modell</Label>
                    <Input value={chatModel} onChange={(e) => setChatModel(e.target.value)} placeholder="llama3.1" />
                  </div>
                  <div className="space-y-2">
                    <Label>Embedding-Modell (pgvector RAG)</Label>
                    <Input
                      value={embeddingModel}
                      onChange={(e) => setEmbeddingModel(e.target.value)}
                      placeholder="nomic-embed-text"
                    />
                  </div>
                </div>
              )}

              {aiMode === 'cloud' && (
                <div className="space-y-3">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Anbieter</Label>
                      <Select
                        value={cloudProvider}
                        onValueChange={(value) => {
                          setCloudProvider(value as CloudProvider);
                          setTestResult(null);
                        }}
                      >
                        <SelectTrigger className="w-full bg-white">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="openai">OpenAI</SelectItem>
                          <SelectItem value="anthropic">Anthropic</SelectItem>
                          <SelectItem value="groq">Groq</SelectItem>
                          <SelectItem value="azure">Azure OpenAI</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>API-Key</Label>
                      <Input
                        type="password"
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                        placeholder="sk-…"
                        autoComplete="off"
                      />
                    </div>
                  </div>
                  {cloudProvider === 'azure' && (
                    <div className="space-y-2">
                      <Label>Azure-Ressourcen-Endpunkt</Label>
                      <Input
                        value={endpointUrl}
                        onChange={(e) => setEndpointUrl(e.target.value)}
                        placeholder="https://YOUR-RESOURCE.openai.azure.com"
                      />
                    </div>
                  )}
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Chat-Modell</Label>
                      <Input
                        value={chatModel}
                        onChange={(e) => setChatModel(e.target.value)}
                        placeholder={cloudProvider === 'anthropic' ? 'claude-sonnet-4-5' : 'gpt-4o-mini'}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Embedding-Modell</Label>
                      <Input
                        value={embeddingModel}
                        onChange={(e) => setEmbeddingModel(e.target.value)}
                        placeholder="text-embedding-3-small"
                      />
                    </div>
                  </div>
                </div>
              )}

              {aiMode !== 'disabled' && (
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <Button type="button" variant="outline" onClick={() => void handleTestAi()} disabled={testing}>
                      {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Verbindung testen'}
                    </Button>
                    {testResult && !isDistinctAiError && (
                      <Badge
                        variant={testResult.success ? 'default' : 'destructive'}
                        className={cn(testResult.success && 'bg-emerald-600 text-white')}
                      >
                        {testResult.success ? (
                          <CheckCircle2 className="h-3.5 w-3.5" />
                        ) : (
                          <XCircle className="h-3.5 w-3.5" />
                        )}
                        {aiMode === 'sovereign' && testResult.success
                          ? `Verbindung erfolgreich (Antwortzeit: ${testResult.latencyMs ?? 0}ms)`
                          : testResult.message}
                      </Badge>
                    )}
                  </div>
                  {testResult && isDistinctAiError && (
                    <div
                      className={cn(
                        'flex items-start gap-2 rounded-xl border p-3 text-sm',
                        testResult.success
                          ? 'border-emerald-100 bg-emerald-50/40 text-emerald-800'
                          : 'border-red-100 bg-red-50/40 text-red-800',
                      )}
                    >
                      {testResult.success ? (
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                      ) : (
                        <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
                      )}
                      <span>{distinctAiMessage}</span>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {step === 3 && (
          <Card>
            <CardHeader>
              <CardTitle>Modul-Aktivierung</CardTitle>
              <CardDescription>
                GeistDesk Tickets bleibt aktiv. Deaktivieren Sie andere Produkte, um sie für Operatoren in der
                Seitenleiste auszublenden.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              <ModuleToggle
                locked
                active
                icon={Ticket}
                title="GeistDesk Tickets"
                body="Zentraler Helpdesk für Kundenanfragen via E-Mail, SLA-Tracking und Support-Workflows."
              />
              <ModuleToggle
                active={geistKB}
                onToggle={() => setGeistKB((v) => !v)}
                icon={BookOpen}
                title="GeistKB"
                body="Wissensdatenbank für Kunden-Hilfeartikel, interne SOPs und KI-Antworten (RAG)."
              />
              <ModuleToggle
                active={geistVault}
                onToggle={() => setGeistVault((v) => !v)}
                icon={Lock}
                title="GeistVault"
                body="Zero-Knowledge Tresor zur sicheren Speicherung von Server-Logins, Passwörtern und API-Keys."
              />
              <ModuleToggle
                active={geistExchange}
                onToggle={() => setGeistExchange((v) => !v)}
                icon={UploadCloud}
                title="GeistExchange"
                body="Sichere Einmal-Geheimnisse (One-Time-Links), Kunden-Dropzones für Logs & KI-Dateianalyse."
              />
              <label
                htmlFor="import-sample-data"
                className="sm:col-span-2 flex items-start gap-3 rounded-xl border p-4 cursor-pointer hover:border-primary/40"
              >
                <Checkbox
                  id="import-sample-data"
                  checked={importSampleData}
                  onCheckedChange={(checked) => setImportSampleData(checked === true)}
                  className="mt-0.5"
                />
                <span className="space-y-1">
                  <span className="block text-sm font-medium">Beispieldaten importieren</span>
                  <span className="block text-xs text-muted-foreground">
                    Erstellt Beispieltickets und Einführungsartikel, um die Plattform kennenzulernen.
                  </span>
                </span>
              </label>

              <div className="sm:col-span-2 rounded-xl border border-indigo-100/80 bg-indigo-50/40 p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-indigo-600" />
                  <div>
                    <h3 className="text-sm font-bold text-slate-800">KI-Wissensspeicher (RAG) — Standardeinstellungen</h3>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Steuert, welche Inhalte standardmäßig in die Vektor-Wissensbasis aufgenommen werden.
                      Sie können dies später im Admin Hub → RAG &amp; Wissensbasis anpassen.
                    </p>
                  </div>
                </div>
                <div className="grid gap-2 sm:grid-cols-1">
                  <label
                    htmlFor="rag-index-resolved-tickets"
                    className="flex items-start gap-3 rounded-lg border border-white bg-white/70 p-3 cursor-pointer hover:border-primary/40"
                  >
                    <Checkbox
                      id="rag-index-resolved-tickets"
                      checked={ragIndexResolvedTickets}
                      onCheckedChange={(checked) => setRagIndexResolvedTickets(checked === true)}
                      className="mt-0.5"
                    />
                    <span className="space-y-0.5">
                      <span className="block text-sm font-medium">Gelöste Tickets automatisch indexieren</span>
                      <span className="block text-xs text-muted-foreground">
                        Lösungen gelöster Tickets werden als Wissen für den KI-Copiloten verfügbar.
                      </span>
                    </span>
                  </label>
                  <label
                    htmlFor="rag-index-new-kb-articles"
                    className="flex items-start gap-3 rounded-lg border border-white bg-white/70 p-3 cursor-pointer hover:border-primary/40"
                  >
                    <Checkbox
                      id="rag-index-new-kb-articles"
                      checked={ragIndexNewKbArticles}
                      onCheckedChange={(checked) => setRagIndexNewKbArticles(checked === true)}
                      className="mt-0.5"
                    />
                    <span className="space-y-0.5">
                      <span className="block text-sm font-medium">Neue Artikel automatisch indexieren</span>
                      <span className="block text-xs text-muted-foreground">
                        Neue Wissensdatenbank-Artikel werden ohne manuellen Schritt in den RAG-Speicher aufgenommen.
                      </span>
                    </span>
                  </label>
                  <label
                    htmlFor="rag-detect-duplicates"
                    className="flex items-start gap-3 rounded-lg border border-white bg-white/70 p-3 cursor-pointer hover:border-primary/40"
                  >
                    <Checkbox
                      id="rag-detect-duplicates"
                      checked={ragDetectDuplicates}
                      onCheckedChange={(checked) => setRagDetectDuplicates(checked === true)}
                      className="mt-0.5"
                    />
                    <span className="space-y-0.5">
                      <span className="block text-sm font-medium">Semantische Duplikaterkennung</span>
                      <span className="block text-xs text-muted-foreground">
                        Warnt beim Erstellen vor inhaltlich ähnlichen Artikeln oder Lösungen, um Redundanz zu vermeiden.
                      </span>
                    </span>
                  </label>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {step === 4 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5" />
                E-Mail-Kanal einrichten
              </CardTitle>
              <CardDescription>
                Wählen Sie einen Standard-Eingangskanal oder überspringen Sie die Einrichtung und konfigurieren Sie
                später im Admin Hub → E-Mail-Kanäle.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2 sm:grid-cols-2">
                {(
                  [
                    {
                      id: 'webhook' as const,
                      icon: Zap,
                      title: 'E-Mail-Weiterleitung',
                      body: 'Empfohlen — Weiterleitung an eine eindeutige help-@ Adresse.',
                      recommended: true,
                    },
                    {
                      id: 'imap_basic' as const,
                      icon: Mail,
                      title: 'IMAP (Standard)',
                      body: 'Benutzername + Passwort über SSL/TLS.',
                      recommended: false,
                    },
                    {
                      id: 'imap_oauth2' as const,
                      icon: KeyRound,
                      title: 'IMAP (OAuth2)',
                      body: 'XOAUTH2 für Microsoft / Google Postfächer.',
                      recommended: false,
                    },
                    {
                      id: 'microsoft_graph' as const,
                      icon: Building2,
                      title: 'Microsoft Graph API',
                      body: 'Microsoft 365 Postfach über Graph.',
                      recommended: false,
                    },
                  ] as const
                ).map((opt) => {
                  const Icon = opt.icon;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setIngestChannel(opt.id)}
                      className={cn(
                        'rounded-xl border p-4 text-left transition hover:border-primary/50',
                        ingestChannel === opt.id &&
                          'border-primary bg-primary/5 ring-1 ring-primary/30',
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4" />
                        <span className="font-medium text-sm">{opt.title}</span>
                        {opt.recommended ? (
                          <Badge className="ml-auto text-[8px] font-black uppercase bg-emerald-50 text-emerald-700 border-emerald-100">
                            Empfohlen
                          </Badge>
                        ) : null}
                      </div>
                      <div className="text-xs text-muted-foreground">{opt.body}</div>
                    </button>
                  );
                })}
              </div>
              <div className="space-y-2">
                <Label>Support-E-Mail</Label>
                <Input value={supportEmail} onChange={(e) => setSupportEmail(e.target.value)} placeholder="support@domain.com" />
              </div>
              {ingestChannel === 'webhook' ? (
                <div className="rounded-xl border border-emerald-100 bg-emerald-50/40 p-3 text-xs text-emerald-800">
                  <p className="mb-1 font-medium text-emerald-900">Ihre Weiterleitungsadresse</p>
                  <p className="font-mono">{forwardingAddress}</p>
                  <p className="mt-2">
                    Richten Sie dort eine Weiterleitung ein — der Kanal wird nach der ersten eingehenden Mail
                    automatisch als verbunden markiert.
                  </p>
                </div>
              ) : null}
              {(ingestChannel === 'imap_basic' || ingestChannel === 'imap_oauth2' || ingestChannel === 'microsoft_graph') && (
                <div className="rounded-xl border border-blue-100 bg-blue-50/40 p-3 text-xs text-blue-800">
                  Vollständige Server-Zugangsdaten können Sie nach dem Login im Admin Hub unter
                  E-Mail-Kanäle testen und konfigurieren. Optional können Sie die Daten hier bereits hinterlegen.
                </div>
              )}
              {(ingestChannel === 'imap_basic' || ingestChannel === 'imap_oauth2') && (
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2 sm:col-span-2">
                    <Label>IMAP-Host</Label>
                    <Input value={imapHost} onChange={(e) => setImapHost(e.target.value)} placeholder="imap.example.com" />
                  </div>
                  <div className="space-y-2">
                    <Label>IMAP-Benutzer</Label>
                    <Input value={imapUser} onChange={(e) => setImapUser(e.target.value)} />
                  </div>
                  {ingestChannel === 'imap_basic' ? (
                    <div className="space-y-2">
                      <Label>IMAP-Passwort</Label>
                      <Input type="password" value={imapPassword} onChange={(e) => setImapPassword(e.target.value)} />
                    </div>
                  ) : (
                    <>
                      <div className="space-y-2 sm:col-span-2">
                        <Label>OAuth-Client-ID</Label>
                        <Input value={imapOauthClientId} onChange={(e) => setImapOauthClientId(e.target.value)} />
                      </div>
                      <div className="space-y-2 sm:col-span-2">
                        <Label>Client-Secret</Label>
                        <Input
                          type="password"
                          value={imapOauthClientSecret}
                          onChange={(e) => setImapOauthClientSecret(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2 sm:col-span-2">
                        <Label>Token-Endpunkt-URL</Label>
                        <Input
                          value={imapOauthTokenUrl}
                          onChange={(e) => setImapOauthTokenUrl(e.target.value)}
                          placeholder="https://login.microsoftonline.com/{tenant}/oauth2/v2.0/token"
                        />
                      </div>
                    </>
                  )}
                  <div className="flex items-center justify-between sm:col-span-2">
                    <Label className="text-xs">Port</Label>
                    <Input
                      className="w-24"
                      value={imapPort}
                      onChange={(e) => setImapPort(e.target.value)}
                      placeholder="993"
                    />
                  </div>
                  <label className="flex items-center gap-2 sm:col-span-2">
                    <Checkbox
                      checked={imapTls}
                      onCheckedChange={(c) => setImapTls(c === true)}
                    />
                    <span className="text-xs">SSL/TLS</span>
                  </label>
                </div>
              )}
              {ingestChannel === 'microsoft_graph' && (
                <div className="grid gap-3">
                  <div className="space-y-2">
                    <Label>Directory (Tenant)-ID</Label>
                    <Input value={graphTenantId} onChange={(e) => setGraphTenantId(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Application (Client)-ID</Label>
                    <Input value={graphClientId} onChange={(e) => setGraphClientId(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Client-Secret</Label>
                    <Input
                      type="password"
                      value={graphClientSecret}
                      onChange={(e) => setGraphClientSecret(e.target.value)}
                    />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <div className="mt-6 flex items-center justify-between">
          <Button type="button" variant="ghost" disabled={step === 1 || submitting} onClick={() => setStep((s) => s - 1)}>
            <ArrowLeft className="h-4 w-4" />
            ← Zurück
          </Button>
          {step < 4 ? (
            <Button
              type="button"
              disabled={submitting || (step === 1 && !canStep1) || (step === 2 && !canStep2)}
              onClick={() => {
                if (step === 1) {
                  void registerAdminAndContinue();
                  return;
                }
                setStep((s) => s + 1);
              }}
            >
              {submitting && step === 1 ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : step === 1 ? (
                adminRegistered ? 'Weiter' : 'Weiter →'
              ) : (
                'Weiter →'
              )}
              <ArrowRight className="h-4 w-4" />
            </Button>
          ) : (
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" disabled={submitting} onClick={() => void finish(true)}>
                Später im Admin-Hub einrichten
              </Button>
              <Button type="button" disabled={submitting} onClick={() => void finish(false)}>
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Einrichtung abschließen'}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ModuleToggle(props: {
  active: boolean;
  locked?: boolean;
  icon: typeof Ticket;
  title: string;
  body: string;
  onToggle?: () => void;
}) {
  const Icon = props.icon;
  return (
    <button
      type="button"
      disabled={props.locked}
      onClick={props.onToggle}
      className={cn(
        'rounded-xl border p-4 text-left transition',
        props.active ? 'border-primary bg-primary/5 ring-1 ring-primary/20' : 'opacity-70',
        props.locked && 'cursor-default',
      )}
    >
      <div className="mb-2 flex items-center justify-between">
        <Icon className="h-5 w-5" />
        {props.locked ? (
          <Badge variant="secondary">Core</Badge>
        ) : (
          <Badge variant={props.active ? 'default' : 'outline'}>{props.active ? 'On' : 'Off'}</Badge>
        )}
      </div>
      <div className="font-medium">{props.title}</div>
      <p className="text-xs text-muted-foreground">{props.body}</p>
    </button>
  );
}
