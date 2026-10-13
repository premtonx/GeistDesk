import { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, Copy, KeyRound, Radio, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../../ui/button';
import { Label } from '../../ui/label';
import { Switch } from '../../ui/switch';
import { Textarea } from '../../ui/textarea';
import { Input } from '../../ui/input';
import { useWorkspaceModuleConfig } from '../../../hooks/useWorkspaceModuleConfig';
import { useTranslation } from '../../../lib/context/I18nContext';
import { DEFAULT_MCP_SETTINGS } from '../../../lib/mcp-config';

interface ApiTokenRow {
  id: string;
  name: string;
  tokenPrefix: string;
  scopes: string[];
  createdAt: string;
  lastUsedAt?: string | null;
  revokedAt?: string | null;
}

function resolvePublicOrigin(): string {
  if (typeof window === 'undefined') return 'https://your-geistdesk-host';
  return window.location.origin.replace(/\/$/, '');
}

export function AdminHubMcpPanel() {
  const { t } = useTranslation();
  const { config, persist, syncing } = useWorkspaceModuleConfig({ admin: true });
  const mcp = config.mcp ?? DEFAULT_MCP_SETTINGS;
  const [instructions, setInstructions] = useState(mcp.systemInstructions);
  const [saving, setSaving] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [tokens, setTokens] = useState<ApiTokenRow[]>([]);
  const [tokenName, setTokenName] = useState('Cursor MCP');
  const [createdToken, setCreatedToken] = useState<string | null>(null);
  const [loadingTokens, setLoadingTokens] = useState(false);

  const endpoint = useMemo(() => `${resolvePublicOrigin()}/api/mcp`, []);

  useEffect(() => {
    setInstructions(mcp.systemInstructions);
  }, [mcp.systemInstructions]);

  const copyText = useCallback(async (key: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedKey(key);
      toast.success(t('admin.hubMcp.copied', 'Copied to clipboard'));
      window.setTimeout(() => setCopiedKey((prev) => (prev === key ? null : prev)), 1800);
    } catch {
      toast.error(t('admin.hubMcp.copyFailed', 'Could not copy to clipboard'));
    }
  }, [t]);

  const cursorConfig = useMemo(
    () =>
      JSON.stringify(
        {
          mcpServers: {
            geistdesk: {
              url: endpoint,
              headers: {
                Authorization: 'Bearer gdk_YOUR_API_TOKEN',
              },
            },
          },
        },
        null,
        2,
      ),
    [endpoint],
  );

  const claudeDesktopConfig = useMemo(
    () =>
      JSON.stringify(
        {
          mcpServers: {
            geistdesk: {
              url: endpoint,
              headers: {
                Authorization: 'Bearer gdk_YOUR_API_TOKEN',
              },
            },
          },
        },
        null,
        2,
      ),
    [endpoint],
  );

  const persistMcp = useCallback(
    async (patch: Partial<typeof mcp>) => {
      setSaving(true);
      const next = {
        ...config,
        mcp: {
          enabled: patch.enabled ?? mcp.enabled,
          systemInstructions: patch.systemInstructions ?? mcp.systemInstructions,
        },
      };
      const ok = await persist(next);
      setSaving(false);
      if (ok) {
        toast.success(t('admin.hubMcp.saved', 'MCP settings saved'));
      }
      return ok;
    },
    [config, mcp.enabled, mcp.systemInstructions, persist, t],
  );

  const loadTokens = useCallback(async () => {
    setLoadingTokens(true);
    try {
      const res = await fetch('/api/api-tokens', { credentials: 'include' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setTokens(Array.isArray(data.tokens) ? data.tokens : []);
    } catch {
      toast.error(t('admin.hubMcp.tokenLoadError', 'Could not load API tokens'));
    } finally {
      setLoadingTokens(false);
    }
  }, [t]);

  useEffect(() => {
    void loadTokens();
  }, [loadTokens]);

  const createToken = async () => {
    try {
      const res = await fetch('/api/api-tokens', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: tokenName.trim() || 'MCP token' }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || `HTTP ${res.status}`);
      }
      setCreatedToken(data.token?.token || null);
      toast.success(t('admin.hubMcp.tokenCreated', 'API token created — copy it now'));
      await loadTokens();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      toast.error(message);
    }
  };

  const revokeToken = async (id: string) => {
    try {
      const res = await fetch(`/api/api-tokens/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || `HTTP ${res.status}`);
      }
      toast.success(t('admin.hubMcp.tokenRevoked', 'Token revoked'));
      if (createdToken) setCreatedToken(null);
      await loadTokens();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      toast.error(message);
    }
  };

  return (
    <section className="bg-white border border-slate-200/80 rounded-[2rem] p-6 shadow-sm space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-xl bg-rose-50 border border-rose-100 text-rose-600 flex items-center justify-center">
            <Radio className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-black text-slate-900">
              {t('admin.hubMcp.title', 'API & MCP')}
            </h2>
            <p className="text-sm text-slate-500 mt-1 max-w-2xl">
              {t(
                'admin.hubMcp.subtitle',
                'Expose GeistKB, Ticketing, and GeistVault tools to Cursor, Claude Desktop, and Windsurf over Streamable HTTP.',
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className="text-xs font-bold text-slate-600">
            {mcp.enabled
              ? t('admin.hubMcp.enabled', 'Enabled')
              : t('admin.hubMcp.disabled', 'Disabled')}
          </span>
          <Switch
            checked={mcp.enabled}
            disabled={syncing || saving}
            onCheckedChange={(checked) => {
              void persistMcp({ enabled: checked });
            }}
            aria-label={t('admin.hubMcp.toggle', 'Enable MCP server')}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>{t('admin.hubMcp.endpoint', 'MCP endpoint')}</Label>
        <div className="flex gap-2">
          <Input readOnly value={endpoint} className="font-mono text-xs" />
          <Button
            type="button"
            variant="outline"
            className="rounded-xl shrink-0"
            onClick={() => void copyText('endpoint', endpoint)}
          >
            {copiedKey === 'endpoint' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        <Label>{t('admin.hubMcp.instructions', 'Additional guidance / Custom instructions')}</Label>
        <Textarea
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
          rows={4}
          placeholder={DEFAULT_MCP_SETTINGS.systemInstructions}
          className="text-sm"
        />
        <div className="flex justify-end">
          <Button
            type="button"
            className="rounded-xl font-bold"
            disabled={saving || instructions === mcp.systemInstructions}
            onClick={() => void persistMcp({ systemInstructions: instructions })}
          >
            {t('admin.hubMcp.saveInstructions', 'Save instructions')}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ConfigSnippet
          title={t('admin.hubMcp.cursorTitle', 'Cursor mcp.json')}
          value={cursorConfig}
          copied={copiedKey === 'cursor'}
          onCopy={() => void copyText('cursor', cursorConfig)}
        />
        <ConfigSnippet
          title={t('admin.hubMcp.claudeTitle', 'Claude Desktop config')}
          value={claudeDesktopConfig}
          copied={copiedKey === 'claude'}
          onCopy={() => void copyText('claude', claudeDesktopConfig)}
        />
      </div>

      <div className="border-t border-slate-100 pt-5 space-y-4">
        <div className="flex items-center gap-2 text-slate-700">
          <KeyRound className="w-4 h-4" />
          <h3 className="text-sm font-black">
            {t('admin.hubMcp.tokensTitle', 'API tokens')}
          </h3>
        </div>
        <p className="text-xs text-slate-500">
          {t(
            'admin.hubMcp.tokensHint',
            'Create a scoped Bearer token (gdk_…) for MCP clients. Scopes follow your role; vault reveal requires SYSTEM_ADMIN.',
          )}
        </p>
        <div className="flex flex-col sm:flex-row gap-2">
          <Input
            value={tokenName}
            onChange={(e) => setTokenName(e.target.value)}
            placeholder={t('admin.hubMcp.tokenNamePlaceholder', 'Token name')}
            className="sm:max-w-xs"
          />
          <Button type="button" className="rounded-xl font-bold" onClick={() => void createToken()}>
            {t('admin.hubMcp.createToken', 'Create token')}
          </Button>
        </div>

        {createdToken ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 space-y-2">
            <p className="text-xs font-bold text-amber-800">
              {t('admin.hubMcp.tokenOnce', 'Copy this token now — it will not be shown again.')}
            </p>
            <div className="flex gap-2">
              <Input readOnly value={createdToken} className="font-mono text-xs bg-white" />
              <Button
                type="button"
                variant="outline"
                className="rounded-xl shrink-0"
                onClick={() => void copyText('newtoken', createdToken)}
              >
                {copiedKey === 'newtoken' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              </Button>
            </div>
          </div>
        ) : null}

        <div className="space-y-2">
          {loadingTokens ? (
            <p className="text-xs text-slate-400">{t('admin.hubMcp.loadingTokens', 'Loading tokens…')}</p>
          ) : tokens.length === 0 ? (
            <p className="text-xs text-slate-400">{t('admin.hubMcp.noTokens', 'No API tokens yet.')}</p>
          ) : (
            tokens.map((token) => (
              <div
                key={token.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2"
              >
                <div className="min-w-0">
                  <div className="text-sm font-bold text-slate-800 truncate">{token.name}</div>
                  <div className="text-[11px] text-slate-500 font-mono truncate">
                    {token.tokenPrefix}… · {token.scopes?.length || 0} scopes
                    {token.revokedAt ? ' · revoked' : ''}
                  </div>
                </div>
                {!token.revokedAt ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="text-rose-600"
                    onClick={() => void revokeToken(token.id)}
                    aria-label={t('admin.hubMcp.revoke', 'Revoke')}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                ) : null}
              </div>
            ))
          )}
        </div>
      </div>
    </section>
  );
}

function ConfigSnippet({
  title,
  value,
  copied,
  onCopy,
}: {
  title: string;
  value: string;
  copied: boolean;
  onCopy: () => void;
}) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50 p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-xs font-black text-slate-700">{title}</h4>
        <Button type="button" variant="outline" size="sm" className="rounded-lg h-8" onClick={onCopy}>
          {copied ? <Check className="w-3.5 h-3.5 mr-1" /> : <Copy className="w-3.5 h-3.5 mr-1" />}
          Copy
        </Button>
      </div>
      <pre className="text-[10px] leading-relaxed font-mono text-slate-600 overflow-x-auto whitespace-pre-wrap break-all max-h-48">
        {value}
      </pre>
    </div>
  );
}
