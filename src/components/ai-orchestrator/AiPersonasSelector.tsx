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
    const content = patch?.skillsContent?.trim();
    const fileName = patch?.skillsFileName?.trim();
    if (!patch || (!content && !fileName)) {
      delete next[personaId];
    } else {
      next[personaId] = {
        skillsContent: patch.skillsContent ?? '',
        ...(fileName ? { skillsFileName: fileName } : {}),
      };
    }
    onSkillsChange(next);
  };

  const handleSkillContentChange = (personaId: AiPersonaId, rawContent: string) => {
    if (new TextEncoder().encode(rawContent).length > MAX_SKILL_BYTES) {
      toast.error(t('aiOrchestrator.personas.skillsTooLarge', 'Skill file exceeds the 64 KB limit.'));
      return;
    }
    const existing = skills[personaId];
    if (!rawContent.trim() && !existing?.skillsFileName) {
      patchSkill(personaId, undefined);
      return;
    }
    patchSkill(personaId, {
      skillsContent: rawContent,
      skillsFileName: rawContent.trim() ? existing?.skillsFileName : undefined,
    });
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

  const clearSkill = (personaId: AiPersonaId) => {
    patchSkill(personaId, undefined);
  };

  return (
    <div className="space-y-4 min-w-0">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {PERSONA_IDS.map((personaId) => {
          const persona = AI_PERSONA_DEFINITIONS[personaId];
          const skill = skills[personaId];
          const hasSkillData = Boolean(skill?.skillsContent?.trim() || skill?.skillsFileName);

          return (
            <div key={personaId} className="min-w-0 rounded-xl border border-slate-200 bg-slate-50 p-3 flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <UserCircle2 className="w-4 h-4 text-indigo-500 shrink-0" />
                <p className="text-sm font-bold truncate">{t(persona.labelKey, personaId.replace(/_/g, ' '))}</p>
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
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 text-[11px] px-2.5 max-w-full"
                  disabled={readOnly}
                  onClick={() => fileInputRefs.current[personaId]?.click()}
                >
                  <FileUp className="w-3 h-3 mr-1 shrink-0" />
                  <span className="truncate">
                    {t('aiOrchestrator.personas.uploadSkill', 'Skill-Datei hochladen (.md) / Upload Skill File (.md)')}
                  </span>
                </Button>
                {hasSkillData && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 text-[11px] px-2 text-slate-500 shrink-0"
                    disabled={readOnly}
                    onClick={() => clearSkill(personaId)}
                  >
                    <X className="w-3 h-3 mr-1" />
                    {t('aiOrchestrator.personas.clearSkill', 'Clear')}
                  </Button>
                )}
              </div>
              {skill?.skillsFileName && (
                <p className="text-[10px] text-emerald-700 truncate" title={skill.skillsFileName}>
                  {t('aiOrchestrator.personas.skillAttached', 'Attached')}: {skill.skillsFileName}
                </p>
              )}

              <div className="mt-1 min-w-0">
                <label
                  htmlFor={`persona-skills-${personaId}`}
                  className="block text-[10px] font-semibold uppercase tracking-wider text-slate-600 mb-1.5"
                >
                  {t(
                    'aiOrchestrator.personas.skillsEditorLabel',
                    'System-Anweisungen & Skills / System Instructions & Skills',
                  )}
                </label>
                <textarea
                  id={`persona-skills-${personaId}`}
                  value={skill?.skillsContent ?? ''}
                  disabled={readOnly}
                  rows={6}
                  spellCheck={false}
                  placeholder={t(
                    'aiOrchestrator.personas.skillsEditorPlaceholder',
                    'Geben Sie hier Markdown-Anweisungen ein oder laden Sie eine Datei hoch... / Enter Markdown instructions here or upload a file...',
                  )}
                  onChange={(e) => handleSkillContentChange(personaId, e.target.value)}
                  className="w-full min-w-0 min-h-[120px] max-h-64 resize-y rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-xs leading-relaxed tracking-tight text-slate-900 placeholder:text-slate-400 shadow-inner focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-400 disabled:cursor-not-allowed disabled:opacity-60"
                />
              </div>
            </div>
          );
        })}
      </div>

      <div className="rounded-xl border overflow-hidden bg-white min-w-0">
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
