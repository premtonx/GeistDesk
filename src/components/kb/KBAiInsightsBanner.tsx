import React, { useState } from 'react';
import { Sparkles, ChevronDown, AlertCircle, Tag, FileWarning } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useTranslation } from '../../lib/context/I18nContext';
import { KB_RADIUS } from './kb-utils';
import { MODULE_PAGE_PX } from '../ui/module-page/styles';

interface KBAiInsightsBannerProps {
  engagementGrowth?: number;
  reviewCount?: number;
  missingTagsCount?: number;
  outdatedCount?: number;
  className?: string;
}

export function KBAiInsightsBanner({
  engagementGrowth = 0,
  reviewCount = 0,
  missingTagsCount = 0,
  outdatedCount = 0,
  className,
}: KBAiInsightsBannerProps) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);

  const summaryLine = t(
    'kb.insights.inlineSummary',
    'AI Insights: Documentation engagement increased by {{percent}}% this month | {{outdated}} outdated SOPs detected',
  )
    .replace('{{percent}}', String(engagementGrowth))
    .replace('{{outdated}}', String(outdatedCount));

  const insights = [
    {
      icon: AlertCircle,
      text: t('kb.insights.reviewNeeded', '{{count}} articles need review').replace('{{count}}', String(reviewCount)),
      color: 'text-violet-700 bg-violet-50 border-violet-100',
    },
    {
      icon: Tag,
      text: t('kb.insights.missingTags', '{{count}} articles missing tags').replace('{{count}}', String(missingTagsCount)),
      color: 'text-orange-700 bg-orange-50 border-orange-100',
    },
    {
      icon: FileWarning,
      text: t('kb.insights.outdatedSops', '{{count}} outdated SOPs').replace('{{count}}', String(outdatedCount)),
      color: 'text-slate-700 bg-slate-50 border-slate-200',
    },
  ];

  return (
    <div className={cn(MODULE_PAGE_PX, 'py-2 shrink-0', className)}>
      <div
        className={cn(
          'h-10 min-h-10 max-h-10 flex items-center gap-2 border border-blue-100/80 bg-blue-50/50 px-3',
          KB_RADIUS,
        )}
      >
        <Sparkles className="w-3.5 h-3.5 text-blue-600 shrink-0" aria-hidden />
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="flex-1 min-w-0 text-left text-xs font-medium text-slate-700 truncate hover:text-slate-900"
          aria-expanded={expanded}
          aria-label={t('kb.insights.toggleDetails', 'Toggle AI insights details')}
        >
          {summaryLine}
        </button>
        <ChevronDown
          className={cn('w-4 h-4 text-slate-400 shrink-0 transition-transform', expanded && 'rotate-180')}
          aria-hidden
        />
      </div>
      {expanded ? (
        <div className={cn('mt-2 p-3 border border-slate-200/80 bg-white', KB_RADIUS)}>
          <p className="text-xs text-slate-600 mb-2">
            {t('kb.aiSummary.engagement', 'Your knowledge base gained {{percent}}% more engagement this month.').replace(
              '{{percent}}',
              String(engagementGrowth),
            )}
          </p>
          <div className="flex flex-wrap gap-2">
            {insights.map((item) => (
              <span
                key={item.text}
                className={cn(
                  'inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-lg border',
                  item.color,
                )}
              >
                <item.icon className="w-3 h-3 shrink-0" />
                {item.text}
              </span>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
