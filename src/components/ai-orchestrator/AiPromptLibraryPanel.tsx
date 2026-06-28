import { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { BookOpen, GitCompare, History, Loader2, RotateCcw, Save } from 'lucide-react';
import { Button } from '../ui/button';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Badge } from '../ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { useTranslation } from '../../lib/context/I18nContext';
import { diffLines } from '../../lib/text-diff';
import {
  PROMPT_LIBRARY_FEATURES,
  type AiPromptLibraryFeature,
  type AiPromptTemplate,
  type AiPromptVersion,
} from '../../types/aiOrchestrator';

interface AiPromptLibraryPanelProps {
  readOnly?: boolean;
}

export function AiPromptLibraryPanel({ readOnly }: AiPromptLibraryPanelProps) {
  const { t } = useTranslation();
  const [templates, setTemplates] = useState<AiPromptTemplate[]>([]);
  const [selectedFeature, setSelectedFeature] = useState<AiPromptLibraryFeature>('ticket_summarization');
  const [draftBody, setDraftBody] = useState('');
  const [versions, setVersions] = useState<AiPromptVersion[]>([]);
  const [compareVersionId, setCompareVersionId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isRollingBack, setIsRollingBack] = useState(false);

  const currentTemplate = useMemo(
    () => templates.find((tpl) => tpl.feature === selectedFeature),
    [templates, selectedFeature],
  );

  const compareVersion = useMemo(
    () => versions.find((v) => v.id === compareVersionId),
    [versions, compareVersionId],
  );

  const diff = useMemo(() => {
    if (!compareVersion || !currentTemplate) return [];
    return diffLines(compareVersion.body, draftBody);
  }, [compareVersion, currentTemplate, draftBody]);

  const loadFeature = useCallback(async (feature: AiPromptLibraryFeature) => {
    const [templatesRes, versionsRes] = await Promise.all([
      axios.get('/api/admin/orchestrator/prompts'),
      axios.get(`/api/admin/orchestrator/prompts/${feature}/versions`),
    ]);
    setTemplates(templatesRes.data.templates || []);
    setVersions(versionsRes.data.versions || []);
    const current = (templatesRes.data.templates || []).find((tpl: AiPromptTemplate) => tpl.feature === feature);
    setDraftBody(current?.body ?? versionsRes.data.current?.body ?? '');
    setCompareVersionId('');
  }, []);

  useEffect(() => {
    void (async () => {
      setIsLoading(true);
      try {
        await loadFeature(selectedFeature);
      } catch {
        toast.error(t('aiOrchestrator.promptLibrary.loadError', 'Failed to load prompt library.'));
      } finally {
        setIsLoading(false);
      }
    })();
  }, [loadFeature, selectedFeature, t]);

  const handleSave = async () => {
    if (readOnly) return;
    setIsSaving(true);
    try {
      await axios.post(`/api/admin/orchestrator/prompts/${selectedFeature}`, {
        body: draftBody,
        changeNote: t('aiOrchestrator.promptLibrary.savedVersion', 'Admin draft save'),
      });
      toast.success(t('aiOrchestrator.promptLibrary.saved', 'Prompt version saved.'));
      await loadFeature(selectedFeature);
    } catch {
      toast.error(t('aiOrchestrator.promptLibrary.saveError', 'Failed to save prompt.'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleRollback = async () => {
    if (readOnly || !compareVersionId) return;
    setIsRollingBack(true);
    try {
      await axios.post(`/api/admin/orchestrator/prompts/${selectedFeature}/rollback`, {
        versionId: compareVersionId,
      });
      toast.success(t('aiOrchestrator.promptLibrary.rolledBack', 'Prompt rolled back successfully.'));
      await loadFeature(selectedFeature);
    } catch {
      toast.error(t('aiOrchestrator.promptLibrary.rollbackError', 'Rollback failed.'));
    } finally {
      setIsRollingBack(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1.5 min-w-[220px]">
          <Label>{t('aiOrchestrator.promptLibrary.featureLabel', 'Core Feature')}</Label>
          <Select value={selectedFeature} onValueChange={(v) => setSelectedFeature(v as AiPromptLibraryFeature)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {PROMPT_LIBRARY_FEATURES.map((feature) => (
                <SelectItem key={feature} value={feature}>
                  {t(`aiOrchestrator.promptLibrary.features.${feature}`, feature.replace(/_/g, ' '))}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {currentTemplate && (
          <Badge variant="outline" className="h-8 px-3">
            {t('aiOrchestrator.promptLibrary.versionBadge', `Version ${currentTemplate.currentVersion}`)}
          </Badge>
        )}
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>{t('aiOrchestrator.promptLibrary.editorLabel', 'Prompt Template')}</Label>
          <Textarea
            value={draftBody}
            disabled={readOnly}
            onChange={(e) => setDraftBody(e.target.value)}
            className="min-h-[280px] font-mono text-xs leading-relaxed"
          />
          <div className="flex gap-2">
            <Button type="button" disabled={readOnly || isSaving} onClick={handleSave}>
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
              {t('aiOrchestrator.promptLibrary.saveVersion', 'Save New Version')}
            </Button>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-slate-500" />
            <Label>{t('aiOrchestrator.promptLibrary.historyTitle', 'Immutable History Trail')}</Label>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white max-h-40 overflow-y-auto divide-y">
            {versions.map((version) => (
              <button
                key={version.id}
                type="button"
                onClick={() => setCompareVersionId(version.id)}
                className={`w-full text-left px-3 py-2 text-xs hover:bg-slate-50 ${compareVersionId === version.id ? 'bg-indigo-50' : ''}`}
              >
                <span className="font-bold">v{version.versionNumber}</span>
                <span className="text-muted-foreground ml-2">{version.changeNote || '—'}</span>
              </button>
            ))}
          </div>

          {compareVersion && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <GitCompare className="w-4 h-4 text-indigo-500" />
                <Label>
                  {t(
                    'aiOrchestrator.promptLibrary.diffTitle',
                    `Layout Diff — v${compareVersion.versionNumber} → current draft`,
                  )}
                </Label>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-950 text-slate-100 max-h-52 overflow-y-auto p-3 font-mono text-[11px] leading-relaxed">
                {diff.map((line, idx) => (
                  <div
                    key={`${line.type}-${idx}`}
                    className={
                      line.type === 'added'
                        ? 'bg-emerald-900/40 text-emerald-200'
                        : line.type === 'removed'
                          ? 'bg-red-900/40 text-red-200 line-through'
                          : 'text-slate-300'
                    }
                  >
                    {line.type === 'added' ? '+ ' : line.type === 'removed' ? '- ' : '  '}
                    {line.text || ' '}
                  </div>
                ))}
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={readOnly || isRollingBack}
                onClick={handleRollback}
              >
                {isRollingBack ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <RotateCcw className="w-3 h-3 mr-1" />}
                {t('aiOrchestrator.promptLibrary.rollback', `Rollback to v${compareVersion.versionNumber}`)}
              </Button>
            </div>
          )}
        </div>
      </div>

      <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
        <BookOpen className="w-3.5 h-3.5" />
        {t('aiOrchestrator.promptLibrary.immutableNote', 'Every save creates an immutable version entry. Rollback creates a new version from historical content.')}
      </p>
    </div>
  );
}
