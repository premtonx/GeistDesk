import { UserCircle2 } from 'lucide-react';
import { Label } from '../ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { useTranslation } from '../../lib/context/I18nContext';
import {
  AI_PERSONA_DEFINITIONS,
  FEATURE_ROUTING_KEYS,
  type AiFeatureId,
  type AiFeaturePersonaMap,
  type AiPersonaId,
} from '../../types/aiOrchestrator';

const PERSONA_IDS = Object.keys(AI_PERSONA_DEFINITIONS) as AiPersonaId[];

interface AiPersonasSelectorProps {
  value: AiFeaturePersonaMap;
  readOnly?: boolean;
  onChange: (next: AiFeaturePersonaMap) => void;
}

export function AiPersonasSelector({ value, readOnly, onChange }: AiPersonasSelectorProps) {
  const { t } = useTranslation();

  const patchPersona = (feature: AiFeatureId, personaId: AiPersonaId) => {
    onChange({ ...value, [feature]: personaId });
  };

  return (
    <div className="space-y-4">
      <div className="grid sm:grid-cols-3 gap-3">
        {PERSONA_IDS.map((personaId) => {
          const persona = AI_PERSONA_DEFINITIONS[personaId];
          return (
            <div key={personaId} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <div className="flex items-center gap-2 mb-2">
                <UserCircle2 className="w-4 h-4 text-indigo-500" />
                <p className="text-sm font-bold">{t(persona.labelKey, personaId.replace(/_/g, ' '))}</p>
              </div>
              <p className="text-[11px] text-muted-foreground">
                {t(persona.toneKey, 'Tone')}: {t(`aiOrchestrator.personas.tones.${personaId}`, personaId)}
              </p>
              <p className="text-[11px] text-muted-foreground">
                {t(persona.languageKey, 'Language')}: {t(`aiOrchestrator.personas.languages.${personaId}`, '—')}
              </p>
              <p className="text-[11px] text-muted-foreground">
                {t(persona.formatKey, 'Format')}: {t(`aiOrchestrator.personas.formats.${personaId}`, '—')}
              </p>
            </div>
          );
        })}
      </div>

      <div className="rounded-xl border overflow-hidden bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="text-left p-3 font-semibold text-slate-600">{t('aiOrchestrator.personas.featureColumn', 'Feature')}</th>
              <th className="text-left p-3 font-semibold text-slate-600">{t('aiOrchestrator.personas.personaColumn', 'Assigned Persona')}</th>
            </tr>
          </thead>
          <tbody>
            {FEATURE_ROUTING_KEYS.map((feature) => (
              <tr key={feature} className="border-t border-slate-100">
                <td className="p-3 font-medium">
                  {t(`aiOrchestrator.features.${feature}.label`, feature.replace(/_/g, ' '))}
                </td>
                <td className="p-3">
                  <Select
                    value={value[feature] ?? 'support_agent'}
                    disabled={readOnly}
                    onValueChange={(v) => patchPersona(feature, v as AiPersonaId)}
                  >
                    <SelectTrigger className="h-8 max-w-[240px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {PERSONA_IDS.map((personaId) => (
                        <SelectItem key={personaId} value={personaId}>
                          {t(AI_PERSONA_DEFINITIONS[personaId].labelKey, personaId.replace(/_/g, ' '))}
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
    </div>
  );
}
