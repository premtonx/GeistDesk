import {
  PenLine,
  Share2,
  History,
  Split,
  Languages,
  Sparkles,
  Download,
  Link2,
} from 'lucide-react';
import { Button } from '../ui/button';
import { cn } from '../../lib/utils';

export interface KBArticleDetailToolbarProps {
  className?: string;
  onEdit: () => void;
  onShare: () => void;
  onHistory: () => void;
  onCompare: () => void;
  onTranslate: () => void;
  onAiExplain: () => void;
  onExportPdf: () => void;
  onCopyLink: () => void;
}

const TOOLBAR_ACTIONS = [
  { id: 'edit', label: 'Edit', icon: PenLine },
  { id: 'share', label: 'Share', icon: Share2 },
  { id: 'history', label: 'History', icon: History },
  { id: 'compare', label: 'Compare', icon: Split },
  { id: 'translate', label: 'Translate', icon: Languages },
  { id: 'ai-explain', label: 'AI Explain', icon: Sparkles },
  { id: 'export', label: 'Export PDF', icon: Download },
  { id: 'copy', label: 'Copy Link', icon: Link2 },
] as const;

export function KBArticleDetailToolbar({
  className,
  onEdit,
  onShare,
  onHistory,
  onCompare,
  onTranslate,
  onAiExplain,
  onExportPdf,
  onCopyLink,
}: KBArticleDetailToolbarProps) {
  const handlers: Record<string, () => void> = {
    edit: onEdit,
    share: onShare,
    history: onHistory,
    compare: onCompare,
    translate: onTranslate,
    'ai-explain': onAiExplain,
    export: onExportPdf,
    copy: onCopyLink,
  };

  return (
    <div
      className={cn(
        'sticky top-0 z-20 -mx-1 px-1 py-2 bg-[#FAFBFC]/95 backdrop-blur-sm border-b border-slate-200/80',
        className,
      )}
    >
      <div className="flex flex-wrap items-center gap-1.5">
        {TOOLBAR_ACTIONS.map((action) => (
          <Button
            key={action.id}
            type="button"
            variant="outline"
            size="sm"
            className="h-8 rounded-xl text-[11px] font-semibold gap-1.5 border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:border-slate-300 shadow-none"
            onClick={handlers[action.id]}
          >
            <action.icon className="w-3.5 h-3.5 text-slate-500" />
            {action.label}
          </Button>
        ))}
      </div>
    </div>
  );
}
