import { useState } from 'react';
import { UserCircle2 } from 'lucide-react';
import { Label } from '../ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
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
            <article
              key={personaId}
              className={cn(
                'flex flex-col rounded-xl border border-slate-200 bg-slate-50 min-w-0 w-full overflow-hidden',
                'transition-shadow hover:shadow-sm',
              )}
            >
              <div className="p-3 flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2 min-w-0">
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
              </div>

              <footer className="border-t border-slate-200/80 bg-white/70 px-3 py-2.5">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className={cn(
                    'w-full h-9 text-xs font-semibold',
                    'border-violet-200/80 text-violet-700 bg-violet-50/40',
                    'hover:bg-violet-50 hover:text-violet-800 hover:border-violet-400',
                    'hover:shadow-[0_0_0_3px_rgba(139,92,246,0.12)]',
                    'transition-all duration-200',
                  )}
                  onClick={() => openSkillsDrawer(personaId)}
                >
                  {t('aiOrchestrator.personas.manageSkillsButton', '🛠️ Skills verwalten')}
                </Button>
              </footer>
            </article>
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
