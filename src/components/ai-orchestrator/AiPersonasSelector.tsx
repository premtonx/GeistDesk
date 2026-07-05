import { useState } from 'react';
import { Settings2, UserCircle2 } from 'lucide-react';
import { Label } from '../ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { Badge } from '../ui/badge';
import { useTranslation } from '../../lib/context/I18nContext';
import {
  AI_PERSONA_DEFINITIONS,
  FEATURE_ROUTING_KEYS,
  type AiFeatureId,
  type AiFeaturePersonaMap,
  type AiPersonaId,
  type AiPersonaSkillProfile,
  type AiPersonaSkillsMap,
} from '../../types/aiOrchestrator';
import { AiAgentSkillsDrawer } from './AiAgentSkillsDrawer';
import { cn } from '../../lib/utils';

const PERSONA_IDS = Object.keys(AI_PERSONA_DEFINITIONS) as AiPersonaId[];

interface AiPersonasSelectorProps {
  value: AiFeaturePersonaMap;
  personaSkills: AiPersonaSkillsMap;
  readOnly?: boolean;
  onChange: (next: AiFeaturePersonaMap) => void;
  onSkillsSaved?: (agentId: AiPersonaId, skill: AiPersonaSkillProfile) => void;
}

export function AiPersonasSelector({
  value,
  personaSkills,
  readOnly,
  onChange,
  onSkillsSaved,
}: AiPersonasSelectorProps) {
  const { t } = useTranslation();
  const [skillsAgentId, setSkillsAgentId] = useState<AiPersonaId | null>(null);
  const [skillsDrawerOpen, setSkillsDrawerOpen] = useState(false);

  const patchPersona = (feature: AiFeatureId, personaId: AiPersonaId) => {
    onChange({ ...value, [feature]: personaId });
  };

  const openSkillsDrawer = (personaId: AiPersonaId) => {
    setSkillsAgentId(personaId);
    setSkillsDrawerOpen(true);
  };

  return (
    <div className="space-y-4 min-w-0 w-full">
      <div className="grid sm:grid-cols-3 gap-3 min-w-0 w-full">
        {PERSONA_IDS.map((personaId) => {
          const persona = AI_PERSONA_DEFINITIONS[personaId];
          const skill = personaSkills[personaId];
          const hasSkill = Boolean(skill?.skillsContent?.trim());
          const label = t(persona.labelKey, personaId.replace(/_/g, ' '));

          return (
            <button
              key={personaId}
              type="button"
              onClick={() => openSkillsDrawer(personaId)}
              className={cn(
                'group relative rounded-xl border border-slate-200 bg-slate-50 p-3 text-left transition-all min-w-0 w-full',
                'hover:border-indigo-300 hover:bg-white hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400',
              )}
            >
              <div className="absolute top-2.5 right-2.5 opacity-0 group-hover:opacity-100 transition-opacity">
                <Settings2 className="w-4 h-4 text-indigo-600" aria-hidden />
              </div>
              <div className="flex items-center gap-2 mb-2 min-w-0 pr-6">
                <UserCircle2 className="w-4 h-4 shrink-0 text-indigo-500" />
                <p className="text-sm font-bold break-words min-w-0">{label}</p>
              </div>
              <p className="text-[11px] text-muted-foreground break-words">
                {t(persona.toneKey, 'Tone')}: {t(`aiOrchestrator.personas.tones.${personaId}`, personaId)}
              </p>
              <p className="text-[11px] text-muted-foreground break-words">
                {t(persona.languageKey, 'Language')}: {t(`aiOrchestrator.personas.languages.${personaId}`, '—')}
              </p>
              <p className="text-[11px] text-muted-foreground break-words">
                {t(persona.formatKey, 'Format')}: {t(`aiOrchestrator.personas.formats.${personaId}`, '—')}
              </p>
              {hasSkill && (
                <Badge variant="outline" className="mt-2 text-[9px] border-emerald-200 text-emerald-700">
                  {t('aiOrchestrator.personas.skillAttached', 'Attached')}
                  {skill?.skillsFileName ? `: ${skill.skillsFileName}` : ''}
                </Badge>
              )}
              <p className="mt-2 text-[10px] font-semibold text-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity">
                {t('aiOrchestrator.personas.manageSkills', 'Skills verwalten →')}
              </p>
            </button>
          );
        })}
      </div>

      <div className="rounded-xl border overflow-hidden bg-white min-w-0 w-full">
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
                <td className="p-3 font-medium min-w-0">
                  <span className="break-words">
                    {t(`aiOrchestrator.features.${feature}.label`, feature.replace(/_/g, ' '))}
                  </span>
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

      <AiAgentSkillsDrawer
        agentId={skillsAgentId}
        open={skillsDrawerOpen}
        onOpenChange={setSkillsDrawerOpen}
        initialSkill={skillsAgentId ? personaSkills[skillsAgentId] : undefined}
        readOnly={readOnly}
        onSaved={onSkillsSaved}
      />
    </div>
  );
}
