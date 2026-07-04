import { AlertTriangle, Info, CheckCircle2, ShieldAlert } from 'lucide-react';
import { cn } from '../../lib/utils';
import { KB_DETAIL_PROSE_CLASS } from './kb-article-detail-utils';

const CALLOUT_EXAMPLES = [
  {
    type: 'warning' as const,
    title: 'Warning',
    body: 'Rotating Azure AD client secrets requires a maintenance window and coordinated SSO re-authentication across all integrated nodes.',
  },
  {
    type: 'info' as const,
    title: 'Information',
    body: 'Enterprise tenants should map GeistDesk roles to Azure AD security groups before enabling automated provisioning.',
  },
  {
    type: 'success' as const,
    title: 'Success',
    body: 'SSO validation passed for all production identity providers in the last compliance sweep.',
  },
  {
    type: 'critical' as const,
    title: 'Critical',
    body: 'Disabling MFA enforcement on federated accounts will immediately downgrade the article trust score and trigger a security review.',
  },
];

const CALLOUT_STYLES = {
  warning: {
    icon: AlertTriangle,
    container: 'border-amber-200 bg-amber-50/50',
    iconColor: 'text-amber-600',
    titleColor: 'text-amber-900',
    bodyColor: 'text-amber-800/90',
  },
  info: {
    icon: Info,
    container: 'border-blue-200 bg-blue-50/50',
    iconColor: 'text-blue-600',
    titleColor: 'text-blue-900',
    bodyColor: 'text-blue-800/90',
  },
  success: {
    icon: CheckCircle2,
    container: 'border-emerald-200 bg-emerald-50/50',
    iconColor: 'text-emerald-600',
    titleColor: 'text-emerald-900',
    bodyColor: 'text-emerald-800/90',
  },
  critical: {
    icon: ShieldAlert,
    container: 'border-rose-200 bg-rose-50/50',
    iconColor: 'text-rose-600',
    titleColor: 'text-rose-900',
    bodyColor: 'text-rose-800/90',
  },
};

interface KBArticleDetailBodyProps {
  htmlContent: string;
  showCalloutSamples?: boolean;
}

export function KBArticleDetailBody({ htmlContent, showCalloutSamples = true }: KBArticleDetailBodyProps) {
  return (
    <div className="flex-1 min-w-0 space-y-6">
      <article
        className={cn(KB_DETAIL_PROSE_CLASS, 'rounded-xl border border-slate-200/80 bg-white p-6')}
      >
        <div dangerouslySetInnerHTML={{ __html: htmlContent }} />
      </article>

      {showCalloutSamples ? (
        <div className="space-y-3">
          {CALLOUT_EXAMPLES.map((callout) => {
            const style = CALLOUT_STYLES[callout.type];
            const Icon = style.icon;
            return (
              <div
                key={callout.type}
                className={cn('flex gap-3 rounded-xl border px-4 py-3', style.container)}
              >
                <Icon className={cn('w-4 h-4 shrink-0 mt-0.5', style.iconColor)} />
                <div className="min-w-0">
                  <p className={cn('text-xs font-semibold', style.titleColor)}>{callout.title}</p>
                  <p className={cn('text-[11px] mt-0.5 leading-relaxed', style.bodyColor)}>{callout.body}</p>
                </div>
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
