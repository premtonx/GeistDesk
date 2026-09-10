import { Angry, Meh, Smile } from 'lucide-react';
import { useTranslation } from '../../lib/context/I18nContext';
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip';
import { cn } from '../../lib/utils';

export function DynamicSentimentGlyph({
  sentiment,
  className,
}: {
  sentiment?: string;
  className?: string;
}) {
  const { t } = useTranslation();
  const mood = sentiment || 'neutral';
  const moodLabel =
    mood === 'angry'
      ? t('tickets.context.sentimentAngry', 'Angry')
      : mood === 'positive'
        ? t('tickets.context.sentimentPositive', 'Positive')
        : t('tickets.context.sentimentNeutral', 'Neutral');
  const tooltip = `${t('tickets.sidebar.dynamicSentiment', 'Dynamische Stimmung')}: ${moodLabel}`;

  const Icon = mood === 'angry' ? Angry : mood === 'positive' ? Smile : Meh;
  const tone =
    mood === 'angry'
      ? 'bg-rose-50 border-rose-200 text-rose-800'
      : mood === 'positive'
        ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
        : 'bg-amber-50 border-amber-200 text-amber-800';

  return (
    <Tooltip>
      <TooltipTrigger
        type="button"
        className={cn(
          'inline-flex items-center gap-1 shrink-0 border text-[10px] px-1.5 py-0.5 rounded font-semibold normal-case tracking-normal',
          tone,
          className,
        )}
        aria-label={tooltip}
      >
        <Icon className="w-3 h-3" />
        <span>{moodLabel}</span>
      </TooltipTrigger>
      <TooltipContent>{tooltip}</TooltipContent>
    </Tooltip>
  );
}
