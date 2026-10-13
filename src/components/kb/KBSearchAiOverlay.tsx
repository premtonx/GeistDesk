import { Loader2, RefreshCw, Sparkles, X, BookOpen } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useTranslation } from '../../lib/context/I18nContext';
import { Button } from '../ui/button';
import type { RAGResult } from '../../services/ragService';

interface KBSearchAiOverlayProps {
  query: string;
  summary: string | null;
  sources: RAGResult[];
  isLoading: boolean;
  error: string | null;
  onDismiss: () => void;
  onRefresh?: () => void;
  className?: string;
}

export function KBSearchAiOverlay({
  query,
  summary,
  sources,
  isLoading,
  error,
  onDismiss,
  onRefresh,
  className,
}: KBSearchAiOverlayProps) {
  const { t } = useTranslation();

  if (!isLoading && !summary && !error) return null;

  return (
    <div
      className={cn(
        'rounded-xl border border-violet-200/80 bg-gradient-to-br from-violet-50/60 via-white to-blue-50/40 p-4 shadow-sm',
        className,
      )}
      role="region"
      aria-live="polite"
      aria-label={t('kb.aiAnswerRegion', 'Geist AI answer')}
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <Sparkles className="w-4 h-4 text-violet-600 shrink-0" />
          <p className="text-sm font-semibold text-slate-800 truncate">
            {t('kb.aiAnswerHeading', 'Geist AI')}
          </p>
          {query ? (
            <span className="text-[11px] text-slate-500 truncate hidden sm:inline">
              — {query}
            </span>
          ) : null}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {summary && onRefresh && !isLoading ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-slate-400 hover:text-violet-700"
              onClick={onRefresh}
              aria-label={t('kb.aiAnswerRefresh', 'Regenerate answer')}
            >
              <RefreshCw className="w-4 h-4" />
            </Button>
          ) : null}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0 text-slate-400 hover:text-slate-700"
            onClick={onDismiss}
            aria-label={t('actions.close', 'Close')}
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-slate-600 py-2">
          <Loader2 className="w-4 h-4 animate-spin text-violet-600" />
          {t('kb.aiAnswerLoading', 'Searching documentation and drafting an answer…')}
        </div>
      ) : null}

      {error ? (
        <p className="text-sm text-red-600">{error}</p>
      ) : null}

      {summary && !isLoading ? (
        <div className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{summary}</div>
      ) : null}

      {sources.length > 0 && !isLoading && !error ? (
        <div className="mt-3 pt-3 border-t border-violet-100/80">
          <p className="text-[11px] font-medium text-slate-500 mb-1.5">
            {t('kb.aiAnswerSources', 'Sources from this workspace')}
          </p>
          <ul className="space-y-1">
            {sources.map((src, idx) => (
              <li
                key={`${src.sourceTitle}-${idx}`}
                className="flex items-center gap-1.5 text-[11px] text-slate-600"
              >
                <BookOpen className="w-3 h-3 text-blue-500 shrink-0" />
                <span className="truncate">{src.sourceTitle}</span>
                <span className="text-slate-400 shrink-0">({src.source})</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
