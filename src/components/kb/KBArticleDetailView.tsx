import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ThumbsUp, ThumbsDown } from 'lucide-react';
import { ScrollArea } from '../ui/scroll-area';
import { Button } from '../ui/button';
import { toast } from 'sonner';
import { KBArticleDetailHeader } from './KBArticleDetailHeader';
import { KBArticleDetailToolbar, type KBTranslateLanguage } from './KBArticleDetailToolbar';
import { KBArticleTableOfContents } from './KBArticleTableOfContents';
import { KBArticleDetailBody } from './KBArticleDetailBody';
import { KBKnowledgeIntelligencePanel } from './KBKnowledgeIntelligencePanel';
import { KBArticleToolbarPanels, type KBArticleToolbarPanel } from './KBArticleToolbarPanels';
import { extractArticleHeadings, injectHeadingIds } from './kb-article-detail-utils';
import { buildKbArticleDeepLink, toEditableHtml, toRenderableHtml } from './kb-content-format';
import type { KBArticleAlert, KBArticleHistoryEntry, KBArticleInfrastructureTrust } from '../../types';
import type { KBRelationship } from '../../services/kbRelationshipService';

export interface KBArticleDetailViewProps {
  article: any;
  title: string;
  htmlContent: string;
  alerts?: KBArticleAlert[];
  activeReadingLanguage: string;
  isTranslating?: boolean;
  infrastructureTrust: KBArticleInfrastructureTrust;
  aiSummary?: string | null;
  isSummaryLoading?: boolean;
  summaryFailed?: boolean;
  onRetrySummary?: () => void;
  relationships: KBRelationship[];
  historyEntries?: KBArticleHistoryEntry[];
  isHistoryLoading?: boolean;
  onBack: () => void;
  onCopyLink: () => void;
  onTranslate: (language: KBTranslateLanguage) => Promise<void>;
  onAiExplain: () => Promise<string>;
  onRegenerateSummary: (forceRefresh?: boolean) => Promise<void>;
  onLoadHistory: () => Promise<void>;
  onSaveContent: (content: string) => Promise<void>;
  onHelpful: () => Promise<void>;
  onUnhelpful: () => Promise<void>;
  indexInRag?: boolean;
  onToggleIndexInRag?: (checked: boolean) => void;
}

export function KBArticleDetailView({
  article,
  title,
  htmlContent,
  alerts = [],
  activeReadingLanguage,
  isTranslating = false,
  infrastructureTrust,
  aiSummary,
  isSummaryLoading = false,
  summaryFailed = false,
  onRetrySummary,
  relationships,
  historyEntries = [],
  isHistoryLoading = false,
  onBack,
  onCopyLink,
  onTranslate,
  onAiExplain,
  onRegenerateSummary,
  onLoadHistory,
  onSaveContent,
  onHelpful,
  onUnhelpful,
  indexInRag,
  onToggleIndexInRag,
}: KBArticleDetailViewProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editedContent, setEditedContent] = useState('');
  const [activePanel, setActivePanel] = useState<KBArticleToolbarPanel>(null);
  const [aiExplainContent, setAiExplainContent] = useState('');
  const [isAiExplainLoading, setIsAiExplainLoading] = useState(false);
  const scrollContainerRef = useRef<HTMLElement | null>(null);
  const scrollAreaRootRef = useRef<HTMLDivElement>(null);

  const articleUrl = useMemo(() => buildKbArticleDeepLink(article.id), [article.id]);
  const viewSourceContent = article.content ?? htmlContent;

  const renderedHtml = useMemo(() => {
    const displayHtml = toRenderableHtml(htmlContent);
    const headingList = extractArticleHeadings(displayHtml);
    return injectHeadingIds(displayHtml, headingList);
  }, [htmlContent]);

  const headings = useMemo(() => extractArticleHeadings(toRenderableHtml(htmlContent)), [htmlContent]);

  useEffect(() => {
    const viewport = scrollAreaRootRef.current
      ?.closest('[data-slot="scroll-area"]')
      ?.querySelector('[data-slot="scroll-area-viewport"]') as HTMLElement | null;
    scrollContainerRef.current = viewport;
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isEditing) {
        setEditedContent(toEditableHtml(viewSourceContent));
        setIsEditing(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isEditing, viewSourceContent]);

  const handleToggleEdit = () => {
    if (isEditing) return;
    setEditedContent(toEditableHtml(viewSourceContent));
    setIsEditing(true);
  };

  const handleSave = async () => {
    if (!editedContent.trim()) {
      toast.error('Article content cannot be empty.');
      return;
    }

    setIsSaving(true);
    try {
      await onSaveContent(editedContent.trim());
      setIsEditing(false);
      toast.success('Artikel erfolgreich aktualisiert!');
    } catch {
      toast.error('Failed to save article. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleExportPdf = useCallback(() => {
    window.print();
  }, []);

  const handleAiExplain = useCallback(async () => {
    setActivePanel('ai-explain');
    setAiExplainContent('');
    setIsAiExplainLoading(true);
    try {
      const output = await onAiExplain();
      setAiExplainContent(output);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'AI Explain failed.';
      setAiExplainContent(message);
      toast.error(message);
    } finally {
      setIsAiExplainLoading(false);
    }
  }, [onAiExplain]);

  const handleTranslate = useCallback(
    async (language: KBTranslateLanguage) => {
      try {
        await onTranslate(language);
      } catch {
        toast.error('Translation failed. Please try again.');
      }
    },
    [onTranslate],
  );

  const openHistoryPanel = useCallback(async () => {
    setActivePanel('history');
    await onLoadHistory();
  }, [onLoadHistory]);

  const openComparePanel = useCallback(async () => {
    setActivePanel('compare');
    await onLoadHistory();
  }, [onLoadHistory]);

  return (
    <div className="flex flex-1 min-h-0 min-w-0 overflow-hidden bg-[#FAFBFC] print:block print:overflow-visible print:bg-white">
      <div className="flex-[7] min-w-0 flex flex-col min-h-0 border-r border-slate-200/80 print:w-full print:max-w-none print:border-none print:min-h-0">
        <ScrollArea className="flex-1 min-h-0 print:overflow-visible print:h-auto">
          <div
            ref={scrollAreaRootRef}
            className="kb-article-print-root max-w-[850px] mx-auto px-5 sm:px-6 py-6 pb-12 min-w-0 overflow-x-hidden print:w-full print:max-w-none print:shadow-none print:border-none print:p-0 print:mx-0 print:bg-white"
          >
            <div className="kb-detail-no-print print:hidden">
              <KBArticleDetailHeader
                title={title}
                category={article.category}
                subCategory={article.subCategory}
                article={article}
                onBack={onBack}
              />
            </div>

            <div className="print:hidden">
              <KBArticleDetailToolbar
                className="mt-4"
                isEditing={isEditing}
                isSaving={isSaving}
                isTranslating={isTranslating}
                activeLanguage={activeReadingLanguage}
                onEdit={handleToggleEdit}
                onSave={() => void handleSave()}
                onShare={() => setActivePanel('share')}
                onHistory={() => void openHistoryPanel()}
                onCompare={() => void openComparePanel()}
                onTranslate={(lang) => void handleTranslate(lang)}
                onAiExplain={() => void handleAiExplain()}
                onExportPdf={handleExportPdf}
                onCopyLink={onCopyLink}
              />
            </div>

            <div className="print-only-article-title hidden print:block mb-6">
              <h1 className="text-2xl font-semibold text-slate-900">{title}</h1>
              <p className="text-sm text-slate-500 mt-1">
                {article.category} · {article.subCategory || 'General'}
              </p>
            </div>

            <div className="flex flex-col xl:flex-row gap-6 mt-6 min-w-0 print:mt-0 print:block">
              {!isEditing ? (
                <KBArticleTableOfContents
                  headings={headings}
                  scrollContainerRef={scrollContainerRef}
                />
              ) : null}
              <KBArticleDetailBody
                htmlContent={renderedHtml}
                alerts={alerts}
                isEditing={isEditing}
                editedContent={editedContent}
                onContentChange={setEditedContent}
              />
            </div>

            <div className="kb-detail-no-print print:hidden mt-8 rounded-xl border border-slate-200/80 bg-white p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div>
                <h4 className="text-xs font-semibold text-slate-900">Was this documentation helpful?</h4>
                <p className="text-[11px] text-slate-500 mt-0.5">Feedback updates the enterprise trust score model.</p>
              </div>
              <div className="flex gap-2 shrink-0">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 rounded-xl text-[11px] font-semibold gap-1.5 border-slate-200"
                  onClick={() => void onHelpful()}
                >
                  <ThumbsUp className="w-3.5 h-3.5 text-emerald-600" />
                  Yes ({article.helpfulCount || 0})
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 rounded-xl text-[11px] font-semibold gap-1.5 border-slate-200"
                  onClick={() => void onUnhelpful()}
                >
                  <ThumbsDown className="w-3.5 h-3.5 text-rose-500" />
                  No ({article.unhelpfulCount || 0})
                </Button>
              </div>
            </div>
          </div>
        </ScrollArea>
      </div>

      <aside className="kb-detail-no-print print:hidden flex-[3] min-w-[280px] max-w-[400px] shrink-0 min-h-0 overflow-y-auto bg-white p-4 custom-scrollbar">
        <KBKnowledgeIntelligencePanel
          article={article}
          infrastructureTrust={infrastructureTrust}
          aiSummary={aiSummary}
          isSummaryLoading={isSummaryLoading}
          summaryFailed={summaryFailed}
          onRetrySummary={onRetrySummary}
          relationships={relationships}
          onAskAi={(forceRefresh) => void onRegenerateSummary(forceRefresh)}
          indexInRag={indexInRag}
          onToggleIndexInRag={onToggleIndexInRag}
        />
      </aside>

      <KBArticleToolbarPanels
        activePanel={activePanel}
        onClose={() => setActivePanel(null)}
        article={article}
        articleUrl={articleUrl}
        historyEntries={historyEntries}
        isHistoryLoading={isHistoryLoading}
        aiExplainContent={aiExplainContent}
        isAiExplainLoading={isAiExplainLoading}
        onCopyLink={onCopyLink}
      />
    </div>
  );
}
