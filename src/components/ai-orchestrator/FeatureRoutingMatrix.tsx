import { Info } from 'lucide-react';
import { Button } from '../ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip';
import { useTranslation } from '../../lib/context/I18nContext';
import {
  FEATURE_ROUTING_KEYS,
  ORCHESTRATOR_MODEL_OPTIONS,
  type AiFeatureRouting,
} from '../../types/aiOrchestrator';

interface FeatureRoutingMatrixProps {
  routing: AiFeatureRouting;
  disabled?: boolean;
  bulkModel: string;
  onBulkModelChange: (model: string) => void;
  onRoutingChange: (next: AiFeatureRouting) => void;
  onApplyAll: () => void;
}

function FeatureInfoTooltip({ text }: { text: string }) {
  return (
    <Tooltip>
      <TooltipTrigger
        type="button"
        className="inline-flex shrink-0 items-center text-slate-400 hover:text-slate-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 rounded-sm"
        aria-label={text}
      >
        <Info className="w-3.5 h-3.5" />
      </TooltipTrigger>
      <TooltipContent
        side="top"
        className="max-w-[280px] text-left leading-snug font-normal normal-case tracking-normal"
      >
        {text}
      </TooltipContent>
    </Tooltip>
  );
}

export function FeatureRoutingMatrix({
  routing,
  disabled,
  bulkModel,
  onBulkModelChange,
  onRoutingChange,
  onApplyAll,
}: FeatureRoutingMatrixProps) {
  const { t } = useTranslation();

  return (
    <div className="rounded-xl border overflow-hidden bg-white">
      <div className="flex flex-wrap items-center gap-2.5 px-3 py-2.5 border-b border-slate-100 bg-slate-50/80">
        <span className="text-xs font-semibold text-slate-700 whitespace-nowrap shrink-0">
          {t('aiOrchestrator.featureRouting.bulkRouter', 'Bulk Model Router')}
        </span>
        <Select
          value={bulkModel}
          disabled={disabled}
          onValueChange={(value) => onBulkModelChange(String(value))}
        >
          <SelectTrigger className="h-8 w-[min(100%,200px)] bg-white">
            <SelectValue placeholder={t('aiOrchestrator.featureRouting.selectModel', 'Select model…')} />
          </SelectTrigger>
          <SelectContent>
            {ORCHESTRATOR_MODEL_OPTIONS.map((model) => (
              <SelectItem key={model.value} value={model.value}>
                {model.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="h-8 shrink-0"
          disabled={disabled || !bulkModel}
          onClick={onApplyAll}
        >
          {t('aiOrchestrator.featureRouting.applyToAll', 'Apply to All')}
        </Button>
      </div>
      <table className="w-full text-sm">
        <thead className="bg-slate-50">
          <tr>
            <th className="text-left p-3 font-semibold text-slate-600">
              {t('aiOrchestrator.featureRouting.featureColumn', 'Feature')}
            </th>
            <th className="text-left p-3 font-semibold text-slate-600">
              {t('aiOrchestrator.featureRouting.routedModelColumn', 'Routed Model')}
            </th>
          </tr>
        </thead>
        <tbody>
          {FEATURE_ROUTING_KEYS.map((key) => (
            <tr key={key} className="border-t border-slate-100">
              <td className="p-3 font-medium">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="truncate">
                    {t(`aiOrchestrator.features.${key}.label`, key.replace(/_/g, ' '))}
                  </span>
                  <FeatureInfoTooltip
                    text={t(
                      `aiOrchestrator.features.${key}.tooltip`,
                      'Configure which model handles this AI feature.',
                    )}
                  />
                </div>
              </td>
              <td className="p-3">
                <Select
                  value={routing[key]}
                  disabled={disabled}
                  onValueChange={(value) =>
                    onRoutingChange({ ...routing, [key]: String(value) })
                  }
                >
                  <SelectTrigger className="h-8 max-w-[200px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ORCHESTRATOR_MODEL_OPTIONS.map((model) => (
                      <SelectItem key={model.value} value={model.value}>
                        {model.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
