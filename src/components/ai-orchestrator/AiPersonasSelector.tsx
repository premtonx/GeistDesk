import { useRef } from 'react';
import { FileUp, UserCircle2, X } from 'lucide-react';
import { Button } from '../ui/button';
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
  type AiPersonaSkillProfile,
  type AiPersonaSkillsMap,
} from '../../types/aiOrchestrator';
import { toast } from 'sonner';

const PERSONA_IDS = Object.keys(AI_PERSONA_DEFINITIONS) as AiPersonaId[];
const MAX_SKILL_BYTES = 65_536;

interface AiPersonasSelectorProps {
  value: AiFeaturePersonaMap;
  skills: AiPersonaSkillsMap;
  readOnly?: boolean;
  onChange: (next: AiFeaturePersonaMap) => void;
  onSkillsChange: (next: AiPersonaSkillsMap) => void;
}

export function AiPersonasSelector({
  value,
  skills,
  readOnly,
  onChange,
  onSkillsChange,
}: AiPersonasSelectorProps) {
  const { t } = useTranslation();
  const fileInputRefs = useRef<Partial<Record<AiPersonaId, HTMLInputElement | null>>>({});

  const patchPersona = (feature: AiFeatureId, personaId: AiPersonaId) => {
    onChange({ ...value, [feature]: personaId });
  };

  const patchSkill = (personaId: AiPersonaId, patch: AiPersonaSkillProfile | undefined) => {
    const next = { ...skills };
    if (!patch || (!patch.skillsContent && !patch.skillsFileName)) {
      delete next[personaId];
    } else {
      next[personaId] = patch;
    }
    onSkillsChange(next);
  };

  const handleSkillFile = (personaId: AiPersonaId, file: File | undefined) => {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.md')) {
      toast.error(t('aiOrchestrator.personas.skillsInvalidType', 'Only Markdown (.md) skill files are supported.'));
      return;
    }
    if (file.size > MAX_SKILL_BYTES) {
      toast.error(t('aiOrchestrator.personas.skillsTooLarge', 'Skill file exceeds the 64 KB limit.'));
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const content = typeof reader.result === 'string' ? reader.result : '';
      patchSkill(personaId, { skillsContent: content, skillsFileName: file.name });
      toast.success(t('aiOrchestrator.personas.skillsLoaded', 'Skill file loaded — save workspace to persist.'));
    };
    reader.onerror = () => {
      toast.error(t('aiOrchestrator.personas.skillsReadError', 'Could not read skill file.'));
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-4">
      <div className="grid sm:grid-cols-3 gap-3">
        {PERSONA_IDS.map((personaId) => {
          const persona = AI_PERSONA_DEFINITIONS[personaId];
          const skill = skills[personaId];
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
              <p className="text-[11px] text-muted-foreground mb-2">
                {t(persona.formatKey, 'Format')}: {t(`aiOrchestrator.personas.formats.${personaId}`, '—')}
              </p>

              <input
                ref={(el) => { fileInputRefs.current[personaId] = el; }}
                type="file"
                accept=".md,text/markdown"
                className="hidden"
                disabled={readOnly}
                onChange={(e) => {
                  handleSkillFile(personaId, e.target.files?.[0]);
                  e.target.value = '';
                }}
              />
              <div className="flex flex-wrap items-center gap-2 mt-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 text-[11px] px-2.5"
                  disabled={readOnly}
                  onClick={() => fileInputRefs.current[personaId]?.click()}
                >
                  <FileUp className="w-3 h-3 mr-1" />
                  {t('aiOrchestrator.personas.uploadSkill', 'Skill-Datei hochladen (.md) / Upload Skill File (.md)')}
                </Button>
                {skill?.skillsFileName && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 text-[11px] px-2 text-slate-500"
                    disabled={readOnly}
                    onClick={() => patchSkill(personaId, undefined)}
                  >
                    <X className="w-3 h-3 mr-1" />
                    {t('aiOrchestrator.personas.clearSkill', 'Clear')}
                  </Button>
                )}
              </div>
              {skill?.skillsFileName && (
                <p className="text-[10px] text-emerald-700 mt-1.5 truncate" title={skill.skillsFileName}>
                  {t('aiOrchestrator.personas.skillAttached', 'Attached')}: {skill.skillsFileName}
                </p>
              )}
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
