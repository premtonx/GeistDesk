import { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, Save, Upload } from 'lucide-react';
import { toast } from 'sonner';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '../ui/sheet';
import { Button } from '../ui/button';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Badge } from '../ui/badge';
import { useTranslation } from '../../lib/context/I18nContext';
import { updateAgentSkills } from '../../lib/orchestratorService';
import {
  AGENT_SKILL_BLUEPRINTS,
  getBlueprintManifest,
} from './agentSkillBlueprints';
import {
  AI_PERSONA_DEFINITIONS,
  type AiPersonaId,
  type AiPersonaSkillProfile,
} from '../../types/aiOrchestrator';
import { cn } from '../../lib/utils';

const SKILL_FILE_EXTENSIONS = ['.json', '.yaml', '.yml', '.md'];
const MAX_SKILL_BYTES = 128 * 1024;

interface AiAgentSkillsDrawerProps {
  agentId: AiPersonaId | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialSkill?: AiPersonaSkillProfile;
  readOnly?: boolean;
  onSaved?: (agentId: AiPersonaId, skill: AiPersonaSkillProfile) => void;
}

function detectFormat(content: string, fileName?: string): 'json' | 'yaml' | 'markdown' {
  const ext = fileName?.split('.').pop()?.toLowerCase();
  if (ext === 'json') return 'json';
  if (ext === 'yaml' || ext === 'yml') return 'yaml';
  if (ext === 'md') return 'markdown';
  const trimmed = content.trim();
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) return 'json';
  if (trimmed.includes('---') || /^[\w-]+:\s/m.test(trimmed)) return 'yaml';
  return 'markdown';
}

function validateSkillContent(content: string, format: 'json' | 'yaml' | 'markdown'): string | null {
  if (format === 'json' && content.trim()) {
    try {
      JSON.parse(content);
    } catch {
      return 'Invalid JSON syntax.';
    }
  }
  return null;
}

export function AiAgentSkillsDrawer({
  agentId,
  open,
  onOpenChange,
  initialSkill,
  readOnly,
  onSaved,
}: AiAgentSkillsDrawerProps) {
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [draftContent, setDraftContent] = useState('');
  const [fileName, setFileName] = useState<string | undefined>();
  const [isSaving, setIsSaving] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [blueprintHighlight, setBlueprintHighlight] = useState(false);
  const [activeBlueprintId, setActiveBlueprintId] = useState<string | null>(null);

  const persona = agentId ? AI_PERSONA_DEFINITIONS[agentId] : null;
  const format = detectFormat(draftContent, fileName);
  const validationError = validateSkillContent(draftContent, format);

  useEffect(() => {
    if (open && agentId) {
      setDraftContent(initialSkill?.skillsContent ?? '');
      setFileName(initialSkill?.skillsFileName);
      setActiveBlueprintId(null);
      setBlueprintHighlight(false);
    }
  }, [open, agentId, initialSkill?.skillsContent, initialSkill?.skillsFileName]);

  const applyBlueprint = useCallback(
    (blueprintId: string) => {
      if (readOnly) return;
      const manifest = getBlueprintManifest(blueprintId);
      if (!manifest) return;
      setDraftContent(manifest);
      setFileName(`${blueprintId}.sample.json`);
      setActiveBlueprintId(blueprintId);
      setBlueprintHighlight(true);
      window.setTimeout(() => setBlueprintHighlight(false), 1200);
      toast.success(
        t('aiOrchestrator.personas.blueprintLoaded', 'Sample blueprint loaded into editor.'),
      );
    },
    [readOnly, t],
  );

  const applyFile = useCallback(
    (file: File) => {
      const lower = file.name.toLowerCase();
      const allowed = SKILL_FILE_EXTENSIONS.some((ext) => lower.endsWith(ext));
      if (!allowed) {
        toast.error(
          t(
            'aiOrchestrator.personas.skillsInvalidType',
            'Only .json, .yaml, .yml, and .md skill manifests are supported.',
          ),
        );
        return;
      }
      if (file.size > MAX_SKILL_BYTES) {
        toast.error(
          t('aiOrchestrator.personas.skillsTooLarge', 'Skill file exceeds the 128 KB limit.'),
        );
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        const text = String(reader.result ?? '');
        let normalized = text;
        if (lower.endsWith('.json')) {
          try {
            normalized = JSON.stringify(JSON.parse(text), null, 2);
          } catch {
            toast.error(t('aiOrchestrator.personas.skillsReadError', 'Could not parse skill file.'));
            return;
          }
        }
        setDraftContent(normalized);
        setFileName(file.name);
        setActiveBlueprintId(null);
        setBlueprintHighlight(false);
        toast.success(t('aiOrchestrator.personas.skillsLoaded', 'Skill manifest loaded into editor.'));
      };
      reader.onerror = () => {
        toast.error(t('aiOrchestrator.personas.skillsReadError', 'Could not read skill file.'));
      };
      reader.readAsText(file);
    },
    [t],
  );

  const handleSave = async () => {
    if (!agentId || readOnly) return;
    if (validationError) {
      toast.error(validationError);
      return;
    }
    setIsSaving(true);
    try {
      const skillData: AiPersonaSkillProfile = {
        skillsContent: draftContent.trim() || undefined,
        skillsFileName: fileName,
      };
      const { skill } = await updateAgentSkills(agentId, skillData);
      onSaved?.(agentId, skill);
      toast.success(t('aiOrchestrator.personas.skillsSaved', 'Agent skills saved globally.'));
      onOpenChange(false);
    } catch {
      toast.error(t('aiOrchestrator.personas.skillsSaveError', 'Failed to save agent skills.'));
    } finally {
      setIsSaving(false);
    }
  };

  const agentLabel = persona
    ? t(persona.labelKey, agentId!.replace(/_/g, ' '))
    : '';

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-xl w-full flex flex-col p-0 gap-0">
        <SheetHeader className="border-b border-slate-200 px-5 py-4 shrink-0">
          <SheetTitle className="text-base font-bold break-words min-w-0 pr-8">
            {t('aiOrchestrator.personas.skillsDrawerTitle', 'Agenten-Skills verwalten: {{name}}').replace(
              '{{name}}',
              agentLabel,
            )}
          </SheetTitle>
          <SheetDescription className="text-xs">
            {t(
              'aiOrchestrator.personas.skillsDrawerDescription',
              'Edit system instructions, runtime boundaries, and tool definitions. Changes apply workspace-wide.',
            )}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5 min-h-0">
          <div className="space-y-2.5">
            <Label className="text-xs font-semibold tracking-wide">
              {t('aiOrchestrator.personas.blueprintsTitle', '💡 Vorlagen / Sample Blueprints')}
            </Label>
            <div className="flex flex-wrap gap-2">
              {AGENT_SKILL_BLUEPRINTS.map((blueprint) => {
                const isActive = activeBlueprintId === blueprint.id;
                const isRecommended = blueprint.personaId === agentId;
                return (
                  <button
                    key={blueprint.id}
                    type="button"
                    disabled={readOnly}
                    title={t(blueprint.descriptionKey, blueprint.defaultDescription)}
                    onClick={() => applyBlueprint(blueprint.id)}
                    className={cn(
                      'inline-flex items-center rounded-full border px-3 py-1.5 text-[11px] font-semibold transition-all duration-200',
                      'bg-slate-100/90 text-slate-600 border-slate-200',
                      'hover:bg-violet-50 hover:text-violet-700 hover:border-violet-300',
                      'hover:shadow-[0_0_0_3px_rgba(139,92,246,0.1)]',
                      'disabled:opacity-50 disabled:pointer-events-none',
                      isActive && 'bg-violet-100 text-violet-800 border-violet-400 ring-1 ring-violet-200',
                      isRecommended && !isActive && 'border-violet-200/70',
                    )}
                  >
                    {t(blueprint.labelKey, blueprint.defaultLabel)}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2 min-w-0">
              <Label htmlFor="agent-skill-script" className="text-xs font-semibold uppercase tracking-wider">
                {t('aiOrchestrator.personas.skillsEditorLabel', 'System Instructions & Skills')}
              </Label>
              <Badge variant="outline" className="text-[10px] uppercase shrink-0">
                {format}
              </Badge>
            </div>
            <Textarea
              id="agent-skill-script"
              disabled={readOnly}
              value={draftContent}
              onChange={(e) => {
                setDraftContent(e.target.value);
                setActiveBlueprintId(null);
              }}
              placeholder={t(
                'aiOrchestrator.personas.skillsEditorPlaceholder',
                'Enter JSON or YAML skill manifest — system instructions, runtime boundaries, tool definitions…',
              )}
              spellCheck={false}
              className={cn(
                'min-h-[280px] font-mono text-xs leading-relaxed resize-y transition-all duration-300',
                'bg-slate-950 text-emerald-100 border-slate-700 placeholder:text-slate-500',
                'focus-visible:ring-indigo-500/40',
                blueprintHighlight && 'ring-2 ring-violet-400/70 border-violet-500/60 shadow-[0_0_12px_rgba(139,92,246,0.25)]',
              )}
            />
            {validationError && (
              <p className="text-xs text-red-600 font-medium">{validationError}</p>
            )}
            {fileName && (
              <p className="text-[10px] text-muted-foreground">
                {t('aiOrchestrator.personas.skillAttached', 'Attached')}: {fileName}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-semibold uppercase tracking-wider">
              {t('aiOrchestrator.personas.skillsDropzoneLabel', 'Skill File Dropzone')}
            </Label>
            <div
              role="button"
              tabIndex={readOnly ? -1 : 0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click();
              }}
              onDragOver={(e) => {
                e.preventDefault();
                if (!readOnly) setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragging(false);
                if (readOnly) return;
                const file = e.dataTransfer.files[0];
                if (file) applyFile(file);
              }}
              onClick={() => !readOnly && fileInputRef.current?.click()}
              className={cn(
                'rounded-xl border-2 border-dashed p-6 text-center transition-colors cursor-pointer',
                isDragging
                  ? 'border-indigo-400 bg-indigo-50/80'
                  : 'border-slate-200 bg-slate-50/50 hover:border-indigo-300 hover:bg-indigo-50/40',
                readOnly && 'opacity-60 cursor-not-allowed pointer-events-none',
              )}
            >
              <Upload className="w-6 h-6 mx-auto mb-2 text-indigo-500" />
              <p className="text-sm font-semibold text-slate-700">
                {t('aiOrchestrator.personas.skillsDropzoneHint', 'Drop .json or .yaml skill manifest here')}
              </p>
              <p className="text-[11px] text-muted-foreground mt-1">
                {t('aiOrchestrator.personas.skillsDropzoneSubhint', 'Or click to browse — parsed instantly via FileReader')}
              </p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,.yaml,.yml,.md,application/json,text/yaml,text/x-yaml"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) applyFile(file);
                e.target.value = '';
              }}
            />
          </div>
        </div>

        <SheetFooter className="border-t border-slate-200 px-5 py-4 flex-row gap-2 shrink-0">
          <Button
            type="button"
            variant="outline"
            className="flex-1"
            onClick={() => onOpenChange(false)}
          >
            {t('common.cancel', 'Cancel')}
          </Button>
          <Button
            type="button"
            className="flex-1 bg-slate-900 hover:bg-black"
            disabled={readOnly || isSaving || Boolean(validationError)}
            onClick={() => void handleSave()}
          >
            {isSaving ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : (
              <Save className="w-4 h-4 mr-2" />
            )}
            {t('aiOrchestrator.personas.skillsSave', 'Speichern / Save')}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
