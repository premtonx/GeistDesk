import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { Loader2, Sparkles, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../../ui/button';
import { useTranslation } from '../../../lib/context/I18nContext';

interface DemoStatus {
  seeded: boolean;
  tickets: number;
  kbArticles: number;
  vaultSecrets: number;
  exchangeSessions: number;
}

interface AdminHubDemoDataCardProps {
  onChanged?: () => void;
}

export function AdminHubDemoDataCard({ onChanged }: AdminHubDemoDataCardProps) {
  const { t } = useTranslation();
  const [status, setStatus] = useState<DemoStatus | null>(null);
  const [busy, setBusy] = useState<'seed' | 'reset' | null>(null);

  const refreshStatus = useCallback(async () => {
    try {
      const res = await axios.get('/api/admin/demo-data/status');
      setStatus({
        seeded: Boolean(res.data?.seeded),
        tickets: Number(res.data?.tickets || 0),
        kbArticles: Number(res.data?.kbArticles || 0),
        vaultSecrets: Number(res.data?.vaultSecrets || 0),
        exchangeSessions: Number(res.data?.exchangeSessions || 0),
      });
    } catch {
      setStatus(null);
    }
  }, []);

  useEffect(() => {
    void refreshStatus();
  }, [refreshStatus]);

  const handleSeed = async () => {
    setBusy('seed');
    try {
      const res = await axios.post('/api/admin/demo-data/seed', { replaceLegacySamples: true });
      const data = res.data || {};
      if (data.skipped) {
        toast.message(t('admin.demoData.alreadyPresent', 'Demo-Daten sind bereits vorhanden.'));
      } else {
        toast.success(
          t(
            'admin.demoData.seedSuccess',
            'Demo-Daten importiert: {{tickets}} Tickets, {{kb}} KB, {{vault}} Vault, {{xchg}} Exchange',
          )
            .replace('{{tickets}}', String(data.tickets ?? 0))
            .replace('{{kb}}', String(data.kbArticles ?? 0))
            .replace('{{vault}}', String(data.vaultSecrets ?? 0))
            .replace('{{xchg}}', String(data.exchangeSessions ?? 0)),
        );
      }
      await refreshStatus();
      onChanged?.();
    } catch (error) {
      const message =
        axios.isAxiosError(error) && error.response?.data?.error
          ? String(error.response.data.error)
          : t('admin.demoData.seedFailed', 'Demo-Daten konnten nicht importiert werden.');
      toast.error(message);
    } finally {
      setBusy(null);
    }
  };

  const handleReset = async () => {
    if (
      !window.confirm(
        t(
          'admin.demoData.resetConfirm',
          'Alle Demo-Daten unwiderruflich entfernen? Echte Mandantendaten bleiben erhalten.',
        ),
      )
    ) {
      return;
    }
    setBusy('reset');
    try {
      const res = await axios.delete('/api/admin/demo-data/reset');
      toast.success(
        t('admin.demoData.resetSuccess', 'Demo-Daten bereinigt ({{count}} Einträge entfernt).').replace(
          '{{count}}',
          String(res.data?.purged ?? 0),
        ),
      );
      await refreshStatus();
      onChanged?.();
    } catch (error) {
      const message =
        axios.isAxiosError(error) && error.response?.data?.error
          ? String(error.response.data.error)
          : t('admin.demoData.resetFailed', 'Demo-Daten konnten nicht bereinigt werden.');
      toast.error(message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="bg-white border border-slate-200/80 rounded-[2rem] p-6 shadow-sm">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2 text-slate-500">
          <Sparkles className="w-4 h-4 text-amber-500" />
          <h3 className="text-sm font-black text-slate-900">
            {t('admin.demoData.title', 'Demo-Daten (IT Operations)')}
          </h3>
        </div>
        {status?.seeded ? (
          <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-700 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-full">
            {t('admin.demoData.active', 'Aktiv')}
          </span>
        ) : (
          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded-full">
            {t('admin.demoData.empty', 'Leer')}
          </span>
        )}
      </div>

      <p className="text-sm text-slate-500 mb-4">
        {t(
          'admin.demoData.body',
          'Importiert realistische Tickets, GeistKB-Artikel, Vault-Secrets und Exchange-Transfers für Demos und Screenshots. Alle Einträge sind als Demo markiert und lassen sich sauber entfernen.',
        )}
      </p>

      {status?.seeded ? (
        <p className="text-[11px] font-mono text-slate-400 mb-4">
          {status.tickets} tickets · {status.kbArticles} kb · {status.vaultSecrets} vault ·{' '}
          {status.exchangeSessions} exchange
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button
          className="rounded-xl font-bold"
          disabled={busy !== null}
          onClick={() => void handleSeed()}
        >
          {busy === 'seed' ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <span className="mr-1.5" aria-hidden>
              ⚡
            </span>
          )}
          {t('admin.demoData.seed', 'Demo-Daten importieren')}
        </Button>
        <Button
          variant="outline"
          className="rounded-xl font-bold"
          disabled={busy !== null || !status?.seeded}
          onClick={() => void handleReset()}
        >
          {busy === 'reset' ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Trash2 className="w-4 h-4 mr-2" />
          )}
          {t('admin.demoData.reset', 'Demo-Daten bereinigen')}
        </Button>
      </div>
    </div>
  );
}
