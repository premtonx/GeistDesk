import { useMemo } from 'react';
import { ThumbsUp, ThumbsDown } from 'lucide-react';
import { ScrollArea } from '../ui/scroll-area';
import { Button } from '../ui/button';
import { toast } from 'sonner';
import { KBArticleDetailHeader } from './KBArticleDetailHeader';
import { KBArticleDetailToolbar } from './KBArticleDetailToolbar';
import { KBArticleTableOfContents } from './KBArticleTableOfContents';
import { KBArticleDetailBody } from './KBArticleDetailBody';
import { KBKnowledgeIntelligencePanel } from './KBKnowledgeIntelligencePanel';
import { extractArticleHeadings, injectHeadingIds } from './kb-article-detail-utils';

export interface KBArticleDetailViewProps {
  article: any;
  title: string;
  htmlContent: string;
  activeReadingLanguage: string;
  onBack: () => void;
  onEdit: () => void;
  onCopyLink: () => void;
  onTranslate: () => void;
  onDelete?: () => void;
  onHelpful: () => Promise<void>;
  onUnhelpful: () => Promise<void>;
  onTrustScoreUpdated?: (score: number) => void;
}

export function KBArticleDetailView({
  article,
  title,
  htmlContent,
  onBack,
  onEdit,
  onCopyLink,
  onTranslate,
  onHelpful,
  onUnhelpful,
  onTrustScoreUpdated,
}: KBArticleDetailViewProps) {
  const headings = useMemo(() => extractArticleHeadings(htmlContent), [htmlContent]);
  const enrichedHtml = useMemo(() => injectHeadingIds(htmlContent, headings), [htmlContent, headings]);

  const toolbarHandlers = {
    onEdit,
    onShare: () => toast.info('Share link copied to collaboration clipboard.'),
    onHistory: () => toast.info('Opening article revision history.'),
    onCompare: () => toast.info('Compare mode: select a second article version.'),
    onTranslate,
    onAiExplain: () => toast.info('AI is generating an executive explanation for this article.'),
    onExportPdf: () => toast.info('Exporting article as compliance PDF.'),
    onCopyLink,
  };

  const intelligenceHandlers = {
    onAskAi: () => toast.info('Opening AI assistant scoped to this article.'),
    onGenerateRunbook: () => toast.info('Generating operational runbook from article context.'),
    onCreatePlaybook: () => toast.info('Creating incident playbook draft.'),
    onAssignReviewer: () => toast.info('Reviewer assignment workflow opened.'),
    onOpenPullRequest: () => toast.info('Documentation pull request queued.'),
  };

  return (
    <div className="flex flex-1 min-h-0 min-w-0 overflow-hidden bg-[#FAFBFC]">
      {/* Middle column — 70% article workspace */}
      <div className="flex-[7] min-w-0 flex flex-col min-h-0 border-r border-slate-200/80">
        <ScrollArea className="flex-1 min-h-0">
          <div className="max-w-[850px] mx-auto px-5 sm:px-6 py-6 pb-12">
            <KBArticleDetailHeader
              title={title}
              category={article.category}
              subCategory={article.subCategory}
              article={article}
              onBack={onBack}
            />

            <KBArticleDetailToolbar className="mt-4" {...toolbarHandlers} />

            <div className="flex gap-6 mt-6">
              <KBArticleTableOfContents headings={headings} />
              <KBArticleDetailBody htmlContent={enrichedHtml} />
            </div>

            <div className="mt-8 rounded-xl border border-slate-200/80 bg-white p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
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

      {/* Right column — 30% Knowledge Intelligence Panel */}
      <aside className="flex-[3] min-w-[280px] max-w-[400px] shrink-0 min-h-0 overflow-y-auto bg-white p-4 custom-scrollbar">
        <KBKnowledgeIntelligencePanel
          article={article}
          onTrustScoreUpdated={onTrustScoreUpdated}
          {...intelligenceHandlers}
        />
      </aside>
    </div>
  );
}
