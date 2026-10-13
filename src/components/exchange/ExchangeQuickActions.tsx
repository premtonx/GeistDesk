import React from 'react';
import {
  Lock,
  FolderUp,
  Sparkles,
  AlertTriangle,
  PackageOpen,
  ArrowRight,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { useTranslation } from '../../lib/context/I18nContext';
import { Button } from '../ui/button';

interface ExchangeQuickActionsProps {
  onSendSecret: () => void;
  onCreateDropzone: () => void;
  onAnalyzeUpload: () => void;
  onEmergencyShare: () => void;
  onImportPackage: () => void;
  className?: string;
}

const actions = [
  {
    id: 'send',
    icon: Lock,
    titleKey: 'exchange.actions.sendSecret',
    titleDefault: 'Send Secret',
    descKey: 'exchange.actions.sendSecretDesc',
    descDefault: 'Share credentials, passwords and API keys with burn-after-read protection.',
    ctaKey: 'exchange.actions.sendSecretCta',
    ctaDefault: 'Configure Secret',
    bg: 'bg-gradient-to-br from-blue-50 to-white border-blue-100 hover:border-blue-200',
    iconBg: 'bg-blue-100 text-blue-600',
    text: 'text-blue-700',
  },
  {
    id: 'dropzone',
    icon: FolderUp,
    titleKey: 'exchange.actions.createDropzone',
    titleDefault: 'Create Dropzone',
    descKey: 'exchange.actions.createDropzoneDesc',
    descDefault: 'Request diagnostic files, database dumps, logs and screenshots securely.',
    ctaKey: 'exchange.actions.createDropzoneCta',
    ctaDefault: 'Build Dropzone',
    bg: 'bg-gradient-to-br from-violet-50 to-white border-violet-100 hover:border-violet-200',
    iconBg: 'bg-violet-100 text-violet-600',
    text: 'text-violet-700',
  },
  {
    id: 'analyze',
    icon: Sparkles,
    titleKey: 'exchange.actions.analyzeUpload',
    titleDefault: 'Analyze Upload',
    descKey: 'exchange.actions.analyzeUploadDesc',
    descDefault: 'Run AI analysis on SQL dumps, logs and diagnostic payloads instantly.',
    ctaKey: 'exchange.actions.analyzeUploadCta',
    ctaDefault: 'Start Analysis',
    bg: 'bg-gradient-to-br from-indigo-50 to-white border-indigo-100 hover:border-indigo-200',
    iconBg: 'bg-indigo-100 text-indigo-600',
    text: 'text-indigo-700',
  },
  {
    id: 'emergency',
    icon: AlertTriangle,
    titleKey: 'exchange.actions.emergencyShare',
    titleDefault: 'Emergency Share',
    descKey: 'exchange.actions.emergencyShareDesc',
    descDefault: 'Break-glass credential sharing with OTP verification protocol.',
    ctaKey: 'exchange.actions.emergencyShareCta',
    ctaDefault: 'Initiate Bypass',
    bg: 'bg-gradient-to-br from-orange-50 to-white border-orange-100 hover:border-orange-200',
    iconBg: 'bg-orange-100 text-orange-700',
    text: 'text-orange-800',
  },
  {
    id: 'import',
    icon: PackageOpen,
    titleKey: 'exchange.actions.importPackage',
    titleDefault: 'Import Package',
    descKey: 'exchange.actions.importPackageDesc',
    descDefault: 'Import encrypted exchange packages from partners or legacy systems.',
    ctaKey: 'exchange.actions.importPackageCta',
    ctaDefault: 'Import Now',
    bg: 'bg-gradient-to-br from-slate-50 to-white border-slate-200 hover:border-slate-300',
    iconBg: 'bg-slate-100 text-slate-600',
    text: 'text-slate-800',
  },
] as const;

export function ExchangeQuickActions({
  onSendSecret,
  onCreateDropzone,
  onAnalyzeUpload,
  onEmergencyShare,
  onImportPackage,
  className,
}: ExchangeQuickActionsProps) {
  const { t } = useTranslation();

  const handlers: Record<string, () => void> = {
    send: onSendSecret,
    dropzone: onCreateDropzone,
    analyze: onAnalyzeUpload,
    emergency: onEmergencyShare,
    import: onImportPackage,
  };

  return (
    <section className={className}>
      <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
        {t('exchange.quickActions.title', 'Quick Actions')}
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
        {actions.map((action) => {
          const Icon = action.icon;
          return (
            <div
              key={action.id}
              className={cn(
                'rounded-2xl border p-5 flex flex-col h-full shadow-sm hover:shadow-md transition-all',
                action.bg,
              )}
            >
              <div className={cn('h-10 w-10 rounded-xl flex items-center justify-center mb-4', action.iconBg)}>
                <Icon className="w-5 h-5" />
              </div>
              <h3 className={cn('text-sm font-bold', action.text)}>
                {t(action.titleKey, action.titleDefault)}
              </h3>
              <p className="text-[11px] text-slate-500 mt-1.5 leading-relaxed flex-1">
                {t(action.descKey, action.descDefault)}
              </p>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handlers[action.id]}
                className={cn('mt-4 h-8 px-0 justify-start text-xs font-semibold hover:bg-transparent', action.text)}
              >
                {t(action.ctaKey, action.ctaDefault)}
                <ArrowRight className="w-3.5 h-3.5 ml-1" />
              </Button>
            </div>
          );
        })}
      </div>
    </section>
  );
}
