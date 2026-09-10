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

  return (
    <Tooltip>
      <TooltipTrigger
        type="button"
        className={cn(
          'inline-flex items-center justify-center shrink-0 rounded-md p-0.5 text-muted-foreground hover:bg-muted/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          className,
        )}
        aria-label={tooltip}
      >
        {mood === 'angry' ? (
          <Angry className="w-4 h-4 text-red-500" />
        ) : mood === 'positive' ? (
          <Smile className="w-4 h-4 text-emerald-500" />
        ) : (
          <Meh className="w-4 h-4 text-amber-500" />
        )}
      </TooltipTrigger>
      <TooltipContent>{tooltip}</TooltipContent>
    </Tooltip>
  );
}
