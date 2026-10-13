import { useState } from 'react';
import {
  PenLine,
  Share2,
  History,
  Split,
  Languages,
  Sparkles,
  Download,
  Link2,
  Save,
  ChevronDown,
} from 'lucide-react';
import { Button } from '../ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { cn } from '../../lib/utils';

export const KB_TRANSLATE_LANGUAGES = [
  'English',
  'German',
  'French',
  'Spanish',
  'Japanese',
  'Italian',
  'Dutch',
] as const;

export type KBTranslateLanguage = (typeof KB_TRANSLATE_LANGUAGES)[number];

export interface KBArticleDetailToolbarProps {
  className?: string;
  isEditing?: boolean;
  isSaving?: boolean;
  isTranslating?: boolean;
  activeLanguage?: string;
  onEdit: () => void;
  onSave?: () => void;
  onShare: () => void;
  onHistory: () => void;
  onCompare: () => void;
  onTranslate: (language: KBTranslateLanguage) => void;
  onAiExplain: () => void;
  onExportPdf: () => void;
  onCopyLink: () => void;
}

type ToolbarActionId =
  | 'edit'
  | 'share'
  | 'history'
  | 'compare'
  | 'translate'
  | 'ai-explain'
  | 'export'
  | 'copy';

const TOOLBAR_ACTIONS: Array<{
  id: ToolbarActionId;
  label: string;
  icon: typeof PenLine;
}> = [
  { id: 'edit', label: 'Edit', icon: PenLine },
  { id: 'share', label: 'Share', icon: Share2 },
  { id: 'history', label: 'History', icon: History },
  { id: 'compare', label: 'Compare', icon: Split },
  { id: 'translate', label: 'Translate', icon: Languages },
  { id: 'ai-explain', label: 'AI Explain', icon: Sparkles },
  { id: 'export', label: 'Export PDF', icon: Download },
  { id: 'copy', label: 'Copy Link', icon: Link2 },
];

export function KBArticleDetailToolbar({
  className,
  isEditing = false,
  isSaving = false,
  isTranslating = false,
  activeLanguage = 'English',
  onEdit,
  onSave,
  onShare,
  onHistory,
  onCompare,
  onTranslate,
  onAiExplain,
  onExportPdf,
  onCopyLink,
}: KBArticleDetailToolbarProps) {
  const [translateOpen, setTranslateOpen] = useState(false);

  const handlers: Record<Exclude<ToolbarActionId, 'edit' | 'translate'>, () => void> = {
    share: onShare,
    history: onHistory,
    compare: onCompare,
    'ai-explain': onAiExplain,
    export: onExportPdf,
    copy: onCopyLink,
  };

  const actionDisabled = isSaving || isTranslating;

  return (
    <div
      className={cn(
        'sticky top-0 z-20 -mx-1 px-1 py-2 bg-[#FAFBFC]/95 backdrop-blur-sm border-b border-slate-200/80 print:hidden',
        className,
      )}
    >
      <div className="flex flex-wrap items-center gap-1.5">
        {TOOLBAR_ACTIONS.map((action) => {
          if (action.id === 'edit') {
            if (isEditing) {
              return (
                <Button
                  key="save"
                  type="button"
                  size="sm"
                  disabled={isSaving}
                  className="h-8 rounded-xl text-[11px] font-semibold gap-1.5 bg-blue-600 text-white hover:bg-blue-700 border-0 shadow-sm"
                  onClick={onSave}
                >
                  <Save className="w-3.5 h-3.5" />
                  Speichern / Save
                </Button>
              );
            }
            return (
              <Button
                key="edit"
                type="button"
                variant="outline"
                size="sm"
                disabled={actionDisabled}
                className="h-8 rounded-xl text-[11px] font-semibold gap-1.5 border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:border-slate-300 shadow-none"
                onClick={onEdit}
              >
                <PenLine className="w-3.5 h-3.5 text-slate-500" />
                Edit
              </Button>
            );
          }

          if (action.id === 'translate') {
            return (
              <Popover key="translate" open={translateOpen} onOpenChange={setTranslateOpen}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={actionDisabled || isEditing}
                    className={cn(
                      'h-8 rounded-xl text-[11px] font-semibold gap-1.5 border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:border-slate-300 shadow-none',
                      isTranslating && 'opacity-70',
                    )}
                  >
                    <Languages className="w-3.5 h-3.5 text-slate-500" />
                    {isTranslating ? 'Translating…' : 'Translate'}
                    <ChevronDown className="w-3 h-3 text-slate-400" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="start" className="w-48 p-2 rounded-xl">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 px-2 py-1">
                    Target locale
                  </p>
                  {KB_TRANSLATE_LANGUAGES.map((lang) => (
                    <button
                      key={lang}
                      type="button"
                      className={cn(
                        'w-full text-left rounded-lg px-2 py-1.5 text-xs hover:bg-slate-100 transition-colors',
                        activeLanguage === lang && 'bg-blue-50 text-blue-700 font-semibold',
                      )}
                      onClick={() => {
                        setTranslateOpen(false);
                        onTranslate(lang);
                      }}
                    >
                      {lang}
                    </button>
                  ))}
                </PopoverContent>
              </Popover>
            );
          }

          const Icon = action.icon;
          return (
            <Button
              key={action.id}
              type="button"
              variant="outline"
              size="sm"
              disabled={actionDisabled || (isEditing && action.id !== 'copy')}
              className="h-8 rounded-xl text-[11px] font-semibold gap-1.5 border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:border-slate-300 shadow-none"
              onClick={handlers[action.id]}
            >
              <Icon className="w-3.5 h-3.5 text-slate-500" />
              {action.label}
            </Button>
          );
        })}
      </div>
    </div>
  );
}
