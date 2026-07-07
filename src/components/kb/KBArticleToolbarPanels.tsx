import { Copy, History, Share2, Split } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { toast } from 'sonner';
import type { KBArticleHistoryEntry } from '../../types';
import { formatArticleDate } from '../../lib/kb-article-defaults';

export type KBArticleToolbarPanel = 'share' | 'history' | 'compare' | 'ai-explain' | null;

interface KBArticleToolbarPanelsProps {
  activePanel: KBArticleToolbarPanel;
  onClose: () => void;
  article: {
    id?: string;
    title?: string;
    owner?: string;
    reviewer?: string;
    visibility?: string;
    lastEditor?: string;
    updatedAt?: unknown;
    createdAt?: unknown;
  };
  articleUrl: string;
  historyEntries?: KBArticleHistoryEntry[];
  isHistoryLoading?: boolean;
  aiExplainContent?: string;
  isAiExplainLoading?: boolean;
  onCopyLink: () => void;
}

export function KBArticleToolbarPanels({
  activePanel,
  onClose,
  article,
  articleUrl,
  historyEntries = [],
  isHistoryLoading = false,
  aiExplainContent,
  isAiExplainLoading,
  onCopyLink,
}: KBArticleToolbarPanelsProps) {
  return (
    <>
      <Dialog open={activePanel === 'share'} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Share2 className="w-4 h-4 text-blue-600" />
              Share article
            </DialogTitle>
            <DialogDescription>
              Distribute this document link to collaborators inside your workspace.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-xs text-slate-700 break-all">
              {articleUrl}
            </div>
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div className="rounded-lg border border-slate-200 px-3 py-2">
                <p className="text-slate-400 uppercase tracking-wide text-[9px] font-semibold">Visibility</p>
                <p className="font-medium text-slate-800 mt-0.5">{article.visibility || 'Internal'}</p>
              </div>
              <div className="rounded-lg border border-slate-200 px-3 py-2">
                <p className="text-slate-400 uppercase tracking-wide text-[9px] font-semibold">Owner</p>
                <p className="font-medium text-slate-800 mt-0.5">{article.owner || '—'}</p>
              </div>
            </div>
            <Button type="button" className="w-full rounded-xl" onClick={onCopyLink}>
              <Copy className="w-4 h-4 mr-2" />
              Copy share link
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={activePanel === 'history'} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="w-4 h-4 text-blue-600" />
              Revision history
            </DialogTitle>
            <DialogDescription>
              Governance timeline for &ldquo;{article.title}&rdquo;
            </DialogDescription>
          </DialogHeader>
          {isHistoryLoading ? (
            <p className="text-sm text-slate-500 animate-pulse">Loading revision history…</p>
          ) : historyEntries.length > 0 ? (
            <ol className="space-y-3 text-sm border-l border-slate-200 pl-4 ml-1 max-h-[360px] overflow-y-auto">
              {historyEntries.map((entry) => (
                <li key={entry.id}>
                  <p className="text-xs font-semibold text-slate-900">{entry.changeSummary}</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {formatArticleDate(entry.createdAt)} · {entry.authorName || 'System'}
                  </p>
                  {entry.snapshotTitle ? (
                    <p className="text-[10px] text-slate-400 mt-0.5 truncate">{entry.snapshotTitle}</p>
                  ) : null}
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-sm text-slate-500">No revision history recorded yet.</p>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={activePanel === 'compare'} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Split className="w-4 h-4 text-blue-600" />
              Compare versions
            </DialogTitle>
            <DialogDescription>
              Select a baseline revision to diff against the current published article.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            {historyEntries.slice(0, 3).map((entry) => (
              <button
                key={entry.id}
                type="button"
                className="w-full text-left rounded-xl border border-slate-200 px-3 py-2.5 text-sm hover:bg-slate-50 transition-colors"
                onClick={() => {
                  toast.info(`Compare mode: loading diff for "${entry.changeSummary}".`);
                  onClose();
                }}
              >
                <p className="font-medium text-slate-800">{entry.changeSummary}</p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  {formatArticleDate(entry.createdAt)} · {entry.authorName || 'System'}
                </p>
              </button>
            ))}
            {historyEntries.length === 0 ? (
              <p className="text-sm text-slate-500">Save revisions to enable version comparison.</p>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={activePanel === 'ai-explain'} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>AI Explain — Layout Analysis</DialogTitle>
            <DialogDescription>
              Simplified executive summary generated via the unified AI lifecycle.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700 leading-relaxed max-h-[360px] overflow-y-auto whitespace-pre-wrap">
            {isAiExplainLoading ? (
              <p className="text-slate-500 animate-pulse">Analyzing article structure…</p>
            ) : (
              aiExplainContent || 'No analysis available.'
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
