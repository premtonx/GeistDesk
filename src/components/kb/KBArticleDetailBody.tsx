import { lazy, Suspense } from 'react';
import { AlertTriangle, Info, CheckCircle2, ShieldAlert, Loader2 } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useTranslation } from '../../lib/context/I18nContext';
import { KB_ARTICLE_CONTENT_WRAP_CLASS } from './kb-article-detail-utils';
import { RichTextPreview } from '../RichTextPreview';

const RichTextEditor = lazy(() =>
  import('../RichTextEditor').then((module) => ({ default: module.RichTextEditor })),
);

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
  isEditing?: boolean;
  editedContent?: string;
  onContentChange?: (value: string) => void;
}

export function KBArticleDetailBody({
  htmlContent,
  showCalloutSamples = true,
  isEditing = false,
  editedContent = '',
  onContentChange,
}: KBArticleDetailBodyProps) {
  const { t } = useTranslation();

  return (
    <div className={cn('flex-1 min-w-0 flex flex-col gap-6', KB_ARTICLE_CONTENT_WRAP_CLASS)}>
      {isEditing ? (
        <div
          key="kb-article-editor-shell"
          className="rounded-xl border-2 border-blue-200 bg-white p-4 shadow-sm min-w-0"
        >
          <p className="text-[10px] font-semibold uppercase tracking-wider text-blue-600 mb-3">
            {t('kb.editor.bodyLabel', 'Article documentation body')}
          </p>
          <Suspense
            fallback={
              <div className="min-h-[320px] flex items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-400 gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                {t('dialog.loadingEditor', 'Loading editor...')}
              </div>
            }
          >
            <RichTextEditor
              key="kb-article-editor"
              value={editedContent}
              onChange={(content) => onContentChange?.(content)}
              placeholder={t(
                'dialog.descriptionPlaceholder',
                'Add details, context, steps tried, expected outcome, etc.',
              )}
              className={cn(
                'rounded-xl border-slate-200/80 shadow-none min-h-[320px] w-full',
                '[&_.ql-container]:min-h-[280px] [&_.ql-editor]:min-h-[280px]',
                '[&_.ql-editor]:break-words [&_.ql-editor]:[overflow-wrap:anywhere] [&_.ql-editor]:leading-relaxed',
              )}
            />
          </Suspense>
        </div>
      ) : (
        <RichTextPreview
          key="kb-article-preview"
          html={htmlContent}
          className={cn(
            'rounded-xl border-slate-200/80 shadow-none min-w-0',
            'print:shadow-none print:border-none',
            '[&_.ql-container]:min-h-0 [&_.ql-editor]:min-h-0',
          )}
        />
      )}

      {!isEditing && showCalloutSamples ? (
        <div className="space-y-3 print:hidden">
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
