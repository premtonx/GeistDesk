import React, { useState } from 'react';
import { Sparkles, ChevronDown } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { cn } from '../../lib/utils';
import { Button } from '../ui/button';
import { useTranslation } from '../../lib/context/I18nContext';

interface TicketsQueueAiChipProps {
  id?: string;
  ticketCount: number;
  criticalCount: number;
  sentimentLabel?: string;
  className?: string;
}

export function TicketsQueueAiChip({
  id,
  ticketCount,
  criticalCount,
  sentimentLabel,
  className,
}: TicketsQueueAiChipProps) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const sentiment = sentimentLabel ?? t('tickets.aiChip.sentimentPositive', 'Positive');

  return (
    <div id={id} className={cn('relative shrink-0', className)}>
      <div
        className={cn(
          'mx-6 flex items-center gap-2 h-10 min-h-10 max-h-10 px-3',
          'bg-indigo-50/60 border border-indigo-100/80 rounded-lg',
          'text-xs text-slate-700',
        )}
      >
        <Sparkles className="w-3.5 h-3.5 text-indigo-500 shrink-0" aria-hidden />
        <span className="truncate font-medium">
          {t('tickets.aiChip.label', 'AI Summary')}:{' '}
          <span className="text-amber-600 font-semibold">
            {criticalCount} {t('tickets.aiChip.critical', 'Critical')}
          </span>
          {' | '}
          {t('tickets.aiChip.sentiment', 'Sentiment')}:{' '}
          <span className="text-emerald-600 font-semibold">{sentiment}</span>
        </span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setExpanded((v) => !v)}
          className="ml-auto h-7 px-2 text-[11px] font-semibold text-indigo-700 hover:bg-indigo-100/60 shrink-0"
        >
          {expanded ? t('tickets.aiChip.collapse', 'Collapse') : t('tickets.aiChip.expand', 'Expand')}
          <ChevronDown className={cn('w-3.5 h-3.5 ml-0.5 transition-transform', expanded && 'rotate-180')} />
        </Button>
      </div>

      <AnimatePresence>
        {expanded ? (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden mx-6"
          >
            <div className="mt-1 p-3 bg-white border border-slate-200/80 rounded-lg shadow-sm text-xs text-slate-600 leading-relaxed">
              {t('tickets.aiChip.expandedBody', 'Queue analysis based on {{count}} tickets. Prioritize critical items; review SLA-risk tickets next.')
                .replace('{{count}}', String(ticketCount))}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
