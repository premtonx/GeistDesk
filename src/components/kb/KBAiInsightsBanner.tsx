import React from 'react';
import { Sparkles, AlertCircle, Tag, FileWarning } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useTranslation } from '../../lib/context/I18nContext';

interface KBAiInsightsBannerProps {
  engagementGrowth?: number;
  reviewCount?: number;
  missingTagsCount?: number;
  outdatedCount?: number;
  className?: string;
}

export function KBAiInsightsBanner({
  engagementGrowth = 18,
  reviewCount = 3,
  missingTagsCount = 5,
  outdatedCount = 2,
  className,
}: KBAiInsightsBannerProps) {
  const { t } = useTranslation();

  const insights = [
    {
      icon: AlertCircle,
      text: t('kb.insights.reviewNeeded', '{{count}} articles need review').replace('{{count}}', String(reviewCount)),
      color: 'text-violet-600 bg-violet-50 border-violet-100',
    },
    {
      icon: Tag,
      text: t('kb.insights.missingTags', '{{count}} articles missing tags').replace('{{count}}', String(missingTagsCount)),
      color: 'text-amber-600 bg-amber-50 border-amber-100',
    },
    {
      icon: FileWarning,
      text: t('kb.insights.outdatedSops', '{{count}} outdated SOPs').replace('{{count}}', String(outdatedCount)),
      color: 'text-orange-600 bg-orange-50 border-orange-100',
    },
  ];

  return (
    <div
      className={cn(
        'rounded-2xl border border-blue-100/80 bg-gradient-to-r from-blue-50/80 via-white to-indigo-50/50 p-4 shadow-sm',
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <div className="h-9 w-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-sm">
          <Sparkles className="w-4 h-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-900">
            {t('kb.aiSummary.engagement', 'Your knowledge base gained {{percent}}% more engagement this month.').replace(
              '{{percent}}',
              String(engagementGrowth),
            )}
          </p>
          <div className="flex flex-wrap gap-2 mt-3">
            {insights.map((item) => (
              <span
                key={item.text}
                className={cn(
                  'inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-full border',
                  item.color,
                )}
              >
                <item.icon className="w-3 h-3 shrink-0" />
                {item.text}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
