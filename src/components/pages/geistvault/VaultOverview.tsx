import React from 'react';
import { 
  Plus, 
  FolderPlus, 
  Share2, 
  ShieldCheck, 
  CheckCircle2, 
  AlertTriangle,
  Lock
} from 'lucide-react';
import { Card } from '../../ui/card';
import { Button } from '../../ui/button';
import { useTranslation } from '../../../lib/context/I18nContext';

interface VaultOverviewProps {
  totalEntries: number;
  weakCount: number;
  expiringCount: number;
  sharedCount: number;
  onNewEntry: () => void;
  onNewFolder: () => void;
  onShareVault: () => void;
  onImportDummyData: () => void;
}

export function VaultOverview({
  totalEntries,
  weakCount,
  expiringCount,
  sharedCount,
  onNewEntry,
  onNewFolder,
  onShareVault,
  onImportDummyData
}: VaultOverviewProps) {
  const { t } = useTranslation();
  
  // Dynamic security score calculation
  const getSecurityScore = () => {
    let base = 100;
    // Deduct 12 for every weak password (max 40)
    base -= Math.min(40, weakCount * 12);
    // Deduct 8 for every expiring password (max 20)
    base -= Math.min(20, expiringCount * 8);
    // Boundary checks
    return Math.max(0, base);
  };

  const score = getSecurityScore();
  
  const getScoreClassification = (scoreVal: number) => {
    if (scoreVal >= 90) return { text: t('vault.excellent', 'Excellent'), color: 'text-green-600', ring: 'border-green-500' };
    if (scoreVal >= 75) return { text: t('vault.good', 'Good'), color: 'text-blue-500', ring: 'border-blue-500' };
    if (scoreVal >= 55) return { text: t('vault.needsAttention', 'Needs Attention'), color: 'text-amber-500', ring: 'border-amber-500' };
    return { text: t('vault.criticalRisk', 'Critical Risk'), color: 'text-red-500', ring: 'border-red-500' };
  };

  const status = getScoreClassification(score);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 select-none">
      
      {/* CARD 1: GeistVault Overview */}
      <Card className="lg:col-span-5 border border-[#DADCE0] rounded-2.5xl bg-white p-5 shadow-sm flex flex-col justify-between">
        <div>
          <h3 className="text-sm font-bold text-slate-800 tracking-tight">{t('vault.overview', 'GeistVault Overview')}</h3>
          <p className="text-[11px] text-slate-400 mt-0.5 font-medium">{t('vault.tagline', 'Secure. Sync. Simplify.')}</p>
        </div>

        <div className="grid grid-cols-4 gap-2.5 mt-4">
          {/* Total entries */}
          <div className="bg-[#F8F9FA] rounded-xl border border-[#DADCE0]/60 p-2.5 text-center flex flex-col items-center justify-center">
            <div className="h-7 w-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center mb-1">
              <Lock className="w-4 h-4" />
            </div>
            <span className="text-xs font-bold text-slate-800">{totalEntries}</span>
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter mt-0.5">{t('vault.total', 'Total')}</span>
          </div>

          {/* Shared with me */}
          <div className="bg-[#F8F9FA] rounded-xl border border-[#DADCE0]/60 p-2.5 text-center flex flex-col items-center justify-center">
            <div className="h-7 w-7 rounded-lg bg-green-50 text-green-600 flex items-center justify-center mb-1">
              <Share2 className="w-4 h-4" />
            </div>
            <span className="text-xs font-bold text-slate-800">{sharedCount}</span>
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter mt-0.5">{t('vault.shared', 'Shared')}</span>
          </div>

          {/* Weak Passwords */}
          <div className="bg-[#F8F9FA] rounded-xl border border-[#DADCE0]/60 p-2.5 text-center flex flex-col items-center justify-center">
            <div className="h-7 w-7 rounded-lg bg-red-50 text-red-500 flex items-center justify-center mb-1">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <span className="text-xs font-bold text-slate-800">{weakCount}</span>
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter mt-0.5">{t('vault.weak', 'Weak')}</span>
          </div>

          {/* Expiring Soon */}
          <div className="bg-[#F8F9FA] rounded-xl border border-[#DADCE0]/60 p-2.5 text-center flex flex-col items-center justify-center">
            <div className="h-7 w-7 rounded-lg bg-amber-50 text-amber-500 flex items-center justify-center mb-1">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <span className="text-xs font-bold text-slate-800">{expiringCount}</span>
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter mt-0.5">{t('vault.expiring', 'Expiring')}</span>
          </div>
        </div>
      </Card>

      {/* CARD 2: Vault Security Score */}
      <Card className="lg:col-span-4 border border-[#DADCE0] rounded-2.5xl bg-white p-5 shadow-sm grid grid-cols-12 gap-4 items-center">
        {/* Progress Circle visualizer */}
        <div className="col-span-5 flex flex-col items-center justify-center border-r border-[#F1F3F4] pr-2">
          <div className={`h-16 w-16 rounded-full border-4 ${status.ring} flex flex-col items-center justify-center bg-[#F8F9FA] shadow-inner`}>
            <span className="text-base font-black text-slate-800">{score}</span>
          </div>
          <span className={`text-[11px] font-extrabold mt-1.5 ${status.color}`}>{status.text}</span>
          <span className="text-[8px] text-slate-400 uppercase font-bold">{t('vault.healthIndex', 'Health Index')}</span>
        </div>

        {/* Security Checklist */}
        <div className="col-span-7 space-y-1.5 pl-1">
          <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-wider mb-2 select-none">{t('vault.complianceChecks', 'Compliance Checks')}</h4>
          <div className="flex items-center gap-1.5 text-[10px] text-slate-600 font-semibold select-none">
            <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
            <span>{t('vault.mfaActive', 'MFA Authentication Active')}</span>
          </div>
          <div className="flex items-center gap-1.5 text-[10px] text-slate-600 font-semibold select-none">
            <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
            <span>{t('vault.aesKeys', 'Sovereign AES-GCM local keys')}</span>
          </div>
          <div className="flex items-center gap-1.5 text-[10px] text-slate-600 font-semibold select-none">
            <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
            <span>{t('vault.noBreached', 'No Breached Credentials')}</span>
          </div>
        </div>
      </Card>

      {/* CARD 3: Quick Actions */}
      <Card className="lg:col-span-3 border border-[#DADCE0] rounded-2.5xl bg-white p-5 shadow-sm flex flex-col justify-between">
        <div>
          <h3 className="text-sm font-bold text-slate-800 tracking-tight">{t('vault.quickActions', 'Quick Actions')}</h3>
          <p className="text-[11px] text-slate-400 mt-0.5 font-medium">{t('vault.sovereignWorkspace', 'Sovereign workspace operations')}</p>
        </div>

        <div className="space-y-2 mt-4">
          <Button 
            onClick={onNewEntry}
            className="w-full bg-[#1A73E8] hover:bg-[#155fc0] text-white text-xs font-semibold h-8 rounded-lg shadow-xs flex items-center justify-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            {t('vault.createNewEntry', 'Create New Entry')}
          </Button>

          <div className="grid grid-cols-2 gap-2">
            <Button 
              onClick={onNewFolder}
              variant="outline"
              className="border-[#DADCE0] hover:bg-[#F8F9FA] text-slate-700 text-[10px] h-8 rounded-lg font-semibold flex items-center justify-center gap-1"
            >
              <FolderPlus className="w-3 h-3 text-slate-400" />
              {t('vault.newFolder', 'New Folder')}
            </Button>
            <Button 
              onClick={onShareVault}
              variant="outline"
              className="border-[#DADCE0] hover:bg-[#F8F9FA] text-slate-700 text-[10px] h-8 rounded-lg font-semibold flex items-center justify-center gap-1"
            >
              <Share2 className="w-3 h-3 text-slate-400" />
              {t('vault.shareVault', 'Share Vault')}
            </Button>
          </div>

          <Button 
            onClick={onImportDummyData}
            variant="ghost"
            type="button"
            className="w-full border border-dashed border-[#DADCE0] hover:bg-green-50/50 hover:text-[#137333] hover:border-green-300 text-slate-500 text-[10px] h-7 rounded-lg font-semibold flex items-center justify-center gap-1 mt-1 shrink-0"
          >
            <CheckCircle2 className="w-3 h-3 text-green-500 shrink-0" />
            {t('vault.importSample', 'Import Sample Dataset')}
          </Button>
        </div>
      </Card>

    </div>
  );
}
