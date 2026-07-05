import { BookOpen, FlaskConical, Gauge, UserCircle2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { useTranslation } from '../../lib/context/I18nContext';
import type { AiFeaturePersonaMap, AiOrchestratorConfig } from '../../types/aiOrchestrator';
import { AiPromptLibraryPanel } from './AiPromptLibraryPanel';
import { AiProviderBenchmarkGrid } from './AiProviderBenchmarkGrid';
import { AiPlaygroundPanel } from './AiPlaygroundPanel';
import { AiPersonasSelector } from './AiPersonasSelector';

interface AiOrchestratorWorkbenchProps {
  config: AiOrchestratorConfig;
  readOnly?: boolean;
  onPersonasChange: (personas: AiFeaturePersonaMap) => void;
}

export function AiOrchestratorWorkbench({ config, readOnly, onPersonasChange }: AiOrchestratorWorkbenchProps) {
  const { t } = useTranslation();

  return (
    <Card className="rounded-2xl shadow-sm border-indigo-100 overflow-hidden">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <FlaskConical className="w-4 h-4 text-indigo-600" />
          {t('aiOrchestrator.workbench.title', 'Admin Control Utilities')}
        </CardTitle>
        <CardDescription>
          {t(
            'aiOrchestrator.workbench.description',
            'Draft prompts, benchmark providers, test models safely, and assign personas to feature rows.',
          )}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="prompts">
          <TabsList className="w-full flex flex-wrap h-auto gap-1 bg-slate-100 p-1">
            <TabsTrigger value="prompts" className="gap-1.5">
              <BookOpen className="w-3.5 h-3.5" />
              {t('aiOrchestrator.workbench.tabs.prompts', 'Prompt Library')}
            </TabsTrigger>
            <TabsTrigger value="benchmark" className="gap-1.5">
              <Gauge className="w-3.5 h-3.5" />
              {t('aiOrchestrator.workbench.tabs.benchmark', 'Benchmark Grid')}
            </TabsTrigger>
            <TabsTrigger value="playground" className="gap-1.5">
              <FlaskConical className="w-3.5 h-3.5" />
              {t('aiOrchestrator.workbench.tabs.playground', 'Playground')}
            </TabsTrigger>
            <TabsTrigger value="personas" className="gap-1.5">
              <UserCircle2 className="w-3.5 h-3.5" />
              {t('aiOrchestrator.workbench.tabs.personas', 'Personas')}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="prompts" className="mt-5">
            <AiPromptLibraryPanel readOnly={readOnly} />
          </TabsContent>
          <TabsContent value="benchmark" className="mt-5">
            <AiProviderBenchmarkGrid />
          </TabsContent>
          <TabsContent value="playground" className="mt-5">
            <AiPlaygroundPanel />
          </TabsContent>
          <TabsContent value="personas" className="mt-5">
            <AiPersonasSelector
              value={config.featurePersonas}
              readOnly={readOnly}
              onChange={onPersonasChange}
            />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
