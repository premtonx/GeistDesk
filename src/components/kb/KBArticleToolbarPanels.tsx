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
    updatedAt?: { toDate?: () => Date };
    createdAt?: { toDate?: () => Date };
  };
  articleUrl: string;
  aiExplainContent?: string;
  isAiExplainLoading?: boolean;
  onCopyLink: () => void;
}

function formatDate(value?: { toDate?: () => Date }): string {
  try {
    const date = value?.toDate?.();
    return date ? date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '—';
  } catch {
    return '—';
  }
}

export function KBArticleToolbarPanels({
  activePanel,
  onClose,
  article,
  articleUrl,
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
          <ol className="space-y-3 text-sm border-l border-slate-200 pl-4 ml-1">
            <li>
              <p className="text-xs font-semibold text-slate-900">Published revision</p>
              <p className="text-[11px] text-slate-500 mt-0.5">
                {formatDate(article.updatedAt)} · {article.lastEditor || article.owner || 'System'}
              </p>
            </li>
            <li>
              <p className="text-xs font-semibold text-slate-900">Initial draft</p>
              <p className="text-[11px] text-slate-500 mt-0.5">
                {formatDate(article.createdAt)} · {article.owner || 'Author'}
              </p>
            </li>
            <li>
              <p className="text-xs font-semibold text-slate-900">Reviewer sign-off</p>
              <p className="text-[11px] text-slate-500 mt-0.5">
                {article.reviewer || 'Pending'} · Compliance checkpoint
              </p>
            </li>
          </ol>
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
            {['Current published', 'Previous revision', 'Imported source'].map((label) => (
              <button
                key={label}
                type="button"
                className="w-full text-left rounded-xl border border-slate-200 px-3 py-2.5 text-sm hover:bg-slate-50 transition-colors"
                onClick={() => {
                  toast.info(`Compare mode: loading diff for "${label}".`);
                  onClose();
                }}
              >
                <p className="font-medium text-slate-800">{label}</p>
                <p className="text-[11px] text-slate-500 mt-0.5">Open side-by-side markdown diff</p>
              </button>
            ))}
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
