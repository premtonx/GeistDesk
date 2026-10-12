import { PenLine, Sparkles, Settings, Check, FilePenLine, X } from 'lucide-react';
import { useState, type Dispatch, type SetStateAction } from 'react';
import { cn } from '../../lib/utils';
import { useTranslation } from '../../lib/context/I18nContext';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Badge } from '../ui/badge';
import { Switch } from '../ui/switch';
import { KBRichTextEditor } from './KBRichTextEditor';
import type { KBCategoryRecord } from './kbCategoryUtils';

export interface KBArticleDraft {
  title: string;
  content: string;
  category: string;
  subCategory: string;
  visibility: 'Public' | 'Private';
  tags: string[];
  owner: string;
  reviewer: string;
  lastEditor: string;
  status: string;
  avgReadTime: string;
  index_in_rag: boolean;
}

export type KBArticleSaveMode = 'draft' | 'publish';

interface EnterpriseUser {
  uid: string;
  name: string;
  role: string;
  email: string;
  avatar: string;
}

interface KBArticleEditorWorkspaceProps {
  editingArticleId: string | null;
  selectedCategory: string;
  newArticle: KBArticleDraft;
  onNewArticleChange: Dispatch<SetStateAction<KBArticleDraft>>;
  tagInput: string;
  onTagInputChange: (value: string) => void;
  categories: KBCategoryRecord[];
  enterpriseUsers: EnterpriseUser[];
  onClose: () => void;
  onSave: (mode: KBArticleSaveMode) => void;
  /** Instant-persist RAG opt-in for existing articles (fires on toggle change). */
  onToggleIndexInRag?: (checked: boolean) => void;
  className?: string;
}

function stripHtmlText(html: string): string {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function KBArticleEditorWorkspace({
  editingArticleId,
  selectedCategory,
  newArticle,
  onNewArticleChange,
  tagInput,
  onTagInputChange,
  categories,
  enterpriseUsers,
  onClose,
  onSave,
  onToggleIndexInRag,
  className,
}: KBArticleEditorWorkspaceProps) {
  const { t } = useTranslation();
  const [titleTouched, setTitleTouched] = useState(false);
  const [attemptedMode, setAttemptedMode] = useState<KBArticleSaveMode | null>(null);

  const titleValid = newArticle.title.trim().length > 0;
  const bodyValid = stripHtmlText(newArticle.content).length > 0;
  const showTitleError = (titleTouched || attemptedMode !== null) && !titleValid;
  const showBodyError = attemptedMode === 'publish' && !bodyValid;

  const patchArticle = (patch: Partial<KBArticleDraft>) => {
    onNewArticleChange((prev) => ({ ...prev, ...patch }));
  };

  const handleSaveClick = (mode: KBArticleSaveMode) => {
    setAttemptedMode(mode);
    setTitleTouched(true);
    if (!titleValid) return;
    if (mode === 'publish' && !bodyValid) return;
    onSave(mode);
  };

  return (
    <div className={cn('flex flex-col lg:flex-row flex-1 min-h-0 h-full bg-white', className)}>
      {/* Main document column */}
      <div className="flex-1 flex flex-col min-w-0 min-h-0">
        <header className="px-4 sm:px-6 py-4 border-b shrink-0 flex flex-row items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-sm font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
              <PenLine className="w-4 h-4 text-indigo-500 shrink-0" />
              {editingArticleId
                ? t('kb.editor.reviseTitle', 'Revise Article Draft Payload')
                : t('kb.editor.createTitle', 'Create Article Draft Payload')}
            </h2>
            <p className="text-[11px] text-slate-400 font-semibold mt-0.5 truncate">
              {t('kb.editor.categoryHint', 'Authoring new guidelines for selected directory')}:{' '}
              <span className="text-indigo-600 font-bold">{selectedCategory}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg border shrink-0"
            aria-label={t('kb.editor.closeDraft', 'Close draft')}
          >
            <X className="w-4 h-4" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 min-h-0">
          <div className="space-y-1">
            <Label className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider">
              {t('kb.editor.documentTitle', 'Document Master Title')}
            </Label>
            <Input
              value={newArticle.title}
              onChange={(e) => patchArticle({ title: e.target.value })}
              onBlur={() => setTitleTouched(true)}
              aria-invalid={showTitleError}
              placeholder={t(
                'kb.editor.titlePlaceholder',
                'Enter descriptive article title, e.g. AWS SMTP Relay failover protocol...',
              )}
              className={cn(
                'h-11 text-md font-bold rounded-xl border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-100 placeholder:text-slate-300',
                showTitleError && 'border-rose-400 focus:ring-rose-100',
              )}
            />
            {showTitleError ? (
              <p className="text-[11px] font-semibold text-rose-600" role="alert">
                {t('kb.editor.titleRequired', 'A document title is required before saving.')}
              </p>
            ) : null}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider">
                {t('kb.editor.categoryDestination', 'Category destination')}
              </Label>
              <select
                value={newArticle.category}
                onChange={(e) => patchArticle({ category: e.target.value })}
                className="w-full h-11 border border-slate-200 rounded-xl px-3 text-xs bg-slate-50 font-bold cursor-pointer"
              >
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <Label className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider">
                {t('kb.editor.subcategory', 'Subcategory folder node')}
              </Label>
              <Input
                value={newArticle.subCategory}
                onChange={(e) => patchArticle({ subCategory: e.target.value })}
                placeholder={t('kb.editor.subcategoryPlaceholder', 'e.g. Workspace Setup, RBAC, Webhooks')}
                className="h-11 text-xs font-bold rounded-xl border-slate-200 bg-slate-50"
              />
            </div>
          </div>

          <div className="flex-1 flex flex-col space-y-2 min-h-[250px]">
            <div className="flex justify-between items-center text-[10px] font-extrabold uppercase tracking-widest text-slate-400">
              <span>{t('kb.editor.bodyLabel', 'Article documentation body')}</span>
              <span className="flex items-center gap-1 text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded-md font-black">
                <Sparkles className="w-3 h-3 animate-pulse" />
                {t('kb.editor.autoAssist', 'Auto-Assist Enabled')}
              </span>
            </div>

            <KBRichTextEditor
              value={newArticle.content}
              onChange={(content) => patchArticle({ content })}
              placeholder={t('kb.editor.placeholder', 'Type / for blocks, or start writing…')}
              className={cn(
                'flex-1 min-h-[280px]',
                showBodyError && 'ring-2 ring-rose-300 border-rose-300 rounded-xl',
              )}
            />
            {showBodyError ? (
              <p className="text-[11px] font-semibold text-rose-600" role="alert">
                {t(
                  'kb.editor.bodyRequiredToPublish',
                  'Add article body content before publishing. You can still save as a draft.',
                )}
              </p>
            ) : null}
          </div>
        </div>

        <footer className="px-4 sm:px-6 py-4 border-t bg-slate-50 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <Button
            variant="ghost"
            className="rounded-xl px-4 text-xs font-extrabold text-slate-400 hover:text-slate-600"
            onClick={onClose}
          >
            {t('kb.editor.closeDraft', 'Close Draft')}
          </Button>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              className="rounded-xl px-4 h-10 text-xs font-extrabold border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
              onClick={() => handleSaveClick('draft')}
            >
              <FilePenLine className="w-4 h-4" />
              <span>
                {editingArticleId
                  ? t('kb.editor.saveDraftAmendments', 'Save as draft')
                  : t('kb.editor.saveDraft', 'Save draft')}
              </span>
            </Button>
            <Button
              type="button"
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold px-6 h-10 rounded-xl text-xs flex items-center gap-1.5 shadow-sm"
              onClick={() => handleSaveClick('publish')}
            >
              <Check className="w-4 h-4" />
              <span>
                {editingArticleId
                  ? t('kb.editor.saveAmendments', 'Save Guidelines Amendments')
                  : t('kb.editor.publishLive', 'Publish Document Live')}
              </span>
            </Button>
          </div>
        </footer>
      </div>

      {/* Publishing parameters sidebar */}
      <aside className="w-full lg:w-[320px] bg-slate-50/70 border-t lg:border-t-0 lg:border-l border-slate-150 p-4 sm:p-6 flex flex-col gap-5 shrink-0 overflow-y-auto min-h-0">
        <div className="flex items-center gap-2 pb-4 border-b">
          <Settings className="w-4 h-4 text-indigo-500" />
          <h4 className="text-xs font-black uppercase text-slate-800">
            {t('kb.editor.publishingParams', 'Article Publishing parameters')}
          </h4>
        </div>

        <div className="space-y-2">
          <Label className="text-[9.5px] uppercase font-black text-slate-400 tracking-wider">
            {t('kb.editor.accessScope', 'Access Scope Visibility')}
          </Label>
          <div className="flex items-center justify-between p-3 bg-white border rounded-xl shadow-3xs">
            <div className="flex flex-col">
              <span className="text-xs font-black text-slate-800">
                {t('kb.editor.publicPortal', 'Public Portal access')}
              </span>
              <span className="text-[10px] text-slate-400 font-semibold mt-0.5">
                {t('kb.editor.publicPortalHint', 'Dispatched to help desk hubs')}
              </span>
            </div>
            <Switch
              checked={newArticle.visibility === 'Public'}
              onCheckedChange={(checked) => patchArticle({ visibility: checked ? 'Public' : 'Private' })}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-[9.5px] uppercase font-black text-slate-400 tracking-wider">
            {t('kb.editor.ragAccess', 'KI-Wissensspeicher (RAG)')}
          </Label>
          <div className="flex items-center justify-between p-3 bg-white border rounded-xl shadow-3xs">
            <div className="flex flex-col">
              <span className="text-xs font-black text-slate-800">
                {t('kb.editor.includeInRag', 'In KI-Wissensspeicher (RAG) aufnehmen')}
              </span>
              <span className="text-[10px] text-slate-400 font-semibold mt-0.5">
                {t(
                  'kb.editor.includeInRagHint',
                  'Wenn deaktiviert, ist der Artikel öffentlich lesbar, wird aber nicht vom KI-Copilot zitiert.',
                )}
              </span>
            </div>
            <Switch
              checked={newArticle.index_in_rag !== false}
              onCheckedChange={(checked) => {
                const value = Boolean(checked);
                patchArticle({ index_in_rag: value });
                onToggleIndexInRag?.(value);
              }}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-[9.5px] uppercase font-black text-slate-400 tracking-wider">
            {t('kb.editor.documentOwner', 'Document Metadata Owner')}
          </Label>
          <select
            value={newArticle.owner}
            onChange={(e) => patchArticle({ owner: e.target.value })}
            className="w-full h-10 bg-white border rounded-xl px-2.5 text-xs font-bold"
          >
            {enterpriseUsers.map((user) => (
              <option key={user.uid} value={user.name}>
                {user.name} ({user.role})
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <Label className="text-[9.5px] uppercase font-black text-slate-400 tracking-wider">
            {t('kb.editor.auditor', 'Assigned Auditor Representative')}
          </Label>
          <select
            value={newArticle.reviewer}
            onChange={(e) => patchArticle({ reviewer: e.target.value })}
            className="w-full h-10 bg-white border rounded-xl px-2.5 text-xs font-bold"
          >
            {enterpriseUsers.map((user) => (
              <option key={user.uid} value={user.name}>
                {user.name} ({user.role})
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <Label className="text-[9.5px] uppercase font-black text-slate-400 tracking-wider">
            {t('kb.editor.workflowStatus', 'Active Workflow Status')}
          </Label>
          <select
            value={newArticle.status}
            onChange={(e) => patchArticle({ status: e.target.value })}
            className="w-full h-10 bg-white border rounded-xl px-2.5 text-xs font-bold"
          >
            <option value="Published">{t('kb.status.published', 'Published & Live')}</option>
            <option value="Draft">{t('kb.status.draft', 'Draft Workspace Cache')}</option>
            <option value="Needs Review">{t('kb.status.needsReview', 'Under Auditor Verification')}</option>
            <option value="Outdated">{t('kb.status.outdated', 'Annotated Outdated Guidelines')}</option>
            <option value="Archived">{t('kb.status.archived', 'Secure Archive Folder')}</option>
            <option value="AI Generated">{t('kb.status.aiGenerated', 'Raw AI Suggested draft')}</option>
            <option value="Under Revision">{t('kb.status.underRevision', 'Active Hot-fix overhaul')}</option>
          </select>
        </div>

        <div className="space-y-2">
          <Label className="text-[9.5px] uppercase font-black text-slate-400 tracking-wider">
            {t('kb.editor.tagsLabel', 'Tags (comma separated)')}
          </Label>
          <Input
            value={tagInput}
            onChange={(e) => onTagInputChange(e.target.value)}
            placeholder={t('kb.editor.tagsPlaceholder', 'e.g. guide, active, network')}
            className="h-10 bg-white border text-xs font-bold rounded-xl"
          />
          <div className="flex flex-wrap gap-1 mt-1.5">
            {tagInput
              .split(',')
              .map((tag) => tag.trim())
              .filter(Boolean)
              .map((tag, idx) => (
                <Badge
                  key={idx}
                  className="bg-slate-200 text-slate-600 font-extrabold uppercase text-[7.5px] py-0 px-1 border-none rounded-md"
                >
                  #{tag}
                </Badge>
              ))}
          </div>
        </div>
      </aside>
    </div>
  );
}
