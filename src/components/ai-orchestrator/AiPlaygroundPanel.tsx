import { useState } from 'react';
import axios from 'axios';
import { FlaskConical, Loader2, Play, Timer } from 'lucide-react';
import { Button } from '../ui/button';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Checkbox } from '../ui/checkbox';
import { Badge } from '../ui/badge';
import { useTranslation } from '../../lib/context/I18nContext';
import { PLAYGROUND_MODEL_OPTIONS, type AiPlaygroundRunResult } from '../../types/aiOrchestrator';

export function AiPlaygroundPanel() {
  const { t } = useTranslation();
  const [prompt, setPrompt] = useState('');
  const [selectedModels, setSelectedModels] = useState<string[]>(['gpt-5', 'claude', 'local-llama']);
  const [results, setResults] = useState<AiPlaygroundRunResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);

  const toggleModel = (model: string, checked: boolean) => {
    setSelectedModels((prev) => {
      if (checked) return prev.includes(model) ? prev : [...prev, model];
      return prev.filter((m) => m !== model);
    });
  };

  const handleRun = async () => {
    if (!prompt.trim() || selectedModels.length === 0) return;
    setIsRunning(true);
    setResults([]);
    try {
      const res = await axios.post('/api/admin/orchestrator/playground', {
        prompt,
        models: selectedModels,
      });
      setResults(res.data.results || []);
    } catch {
      setResults([]);
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="space-y-5">
      <p className="text-xs text-muted-foreground">
        {t(
          'aiOrchestrator.playground.description',
          'Isolated diagnostic workspace — test prompts across multiple models without affecting production routing.',
        )}
      </p>

      <div className="space-y-2">
        <Label>{t('aiOrchestrator.playground.inputLabel', 'Test Input')}</Label>
        <Textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder={t('aiOrchestrator.playground.inputPlaceholder', 'Type a test prompt to compare model outputs…')}
          className="min-h-[120px] text-sm"
        />
      </div>

      <div className="space-y-2">
        <Label>{t('aiOrchestrator.playground.modelsLabel', 'Target Models')}</Label>
        <div className="flex flex-wrap gap-3">
          {PLAYGROUND_MODEL_OPTIONS.map((model) => (
            <label key={model.value} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm cursor-pointer hover:bg-slate-50">
              <Checkbox
                checked={selectedModels.includes(model.value)}
                onCheckedChange={(checked) => toggleModel(model.value, checked === true)}
              />
              {model.label}
            </label>
          ))}
        </div>
      </div>

      <Button type="button" onClick={handleRun} disabled={isRunning || !prompt.trim() || selectedModels.length === 0}>
        {isRunning ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Play className="w-4 h-4 mr-2" />}
        {t('aiOrchestrator.playground.run', 'Execute Test Run')}
      </Button>

      {results.length > 0 && (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
          {results.map((result) => (
            <div key={result.model} className="rounded-xl border border-slate-200 bg-white overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-100 bg-slate-50 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <FlaskConical className="w-4 h-4 text-indigo-500 shrink-0" />
                  <span className="font-semibold text-sm truncate">{result.label}</span>
                </div>
                <Badge variant="outline" className={result.success ? 'text-emerald-700 border-emerald-200' : 'text-red-700 border-red-200'}>
                  {result.success
                    ? t('aiOrchestrator.playground.success', 'OK')
                    : t('aiOrchestrator.playground.failed', 'Failed')}
                </Badge>
              </div>
              <div className="p-4 space-y-3">
                <div className="flex flex-wrap gap-2 text-[11px]">
                  <Badge variant="outline" className="font-mono">
                    <Timer className="w-3 h-3 mr-1" />
                    {result.latencyMs}ms
                  </Badge>
                  <Badge variant="outline" className="font-mono">
                    {t('aiOrchestrator.playground.confidence', 'Confidence')}: {(result.confidence * 100).toFixed(1)}%
                  </Badge>
                </div>
                <pre className="text-xs whitespace-pre-wrap font-mono text-slate-700 bg-slate-50 rounded-lg p-3 max-h-48 overflow-y-auto">
                  {result.output || result.error || '—'}
                </pre>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
