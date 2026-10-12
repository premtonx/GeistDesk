import { useCallback, useEffect, useMemo, useRef, useState, type ElementType, type ReactNode } from 'react';
import { useEditor, EditorContent, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import Underline from '@tiptap/extension-underline';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import { common, createLowlight } from 'lowlight';
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  List,
  ListOrdered,
  Code2,
  Quote,
  Heading1,
  Heading2,
  Heading3,
  ImageIcon,
  Link2,
  Minus,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { useTranslation } from '../../lib/context/I18nContext';

const lowlight = createLowlight(common);

interface SlashItem {
  id: string;
  labelKey: string;
  defaultLabel: string;
  icon: ElementType;
  action: (editor: Editor) => void;
}

interface KBRichTextEditorProps {
  value: string;
  onChange: (content: string) => void;
  placeholder?: string;
  className?: string;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function ToolbarButton({
  active,
  onClick,
  children,
  title,
}: {
  active?: boolean;
  onClick: () => void;
  children: ReactNode;
  title?: string;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={cn(
        'h-8 w-8 inline-flex items-center justify-center rounded-lg transition-colors',
        active ? 'bg-blue-50 text-blue-600' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800',
      )}
    >
      {children}
    </button>
  );
}

export function KBRichTextEditor({ value, onChange, placeholder, className }: KBRichTextEditorProps) {
  const { t } = useTranslation();
  const [slashOpen, setSlashOpen] = useState(false);
  const [slashQuery, setSlashQuery] = useState('');
  const [slashPos, setSlashPos] = useState({ top: 0, left: 0 });
  const slashRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<Editor | null>(null);

  const slashItems: SlashItem[] = useMemo(
    () => [
      {
        id: 'h1',
        labelKey: 'kb.editor.slash.heading1',
        defaultLabel: 'Heading 1',
        icon: Heading1,
        action: (ed) => ed.chain().focus().toggleHeading({ level: 1 }).run(),
      },
      {
        id: 'h2',
        labelKey: 'kb.editor.slash.heading2',
        defaultLabel: 'Heading 2',
        icon: Heading2,
        action: (ed) => ed.chain().focus().toggleHeading({ level: 2 }).run(),
      },
      {
        id: 'h3',
        labelKey: 'kb.editor.slash.heading3',
        defaultLabel: 'Heading 3',
        icon: Heading3,
        action: (ed) => ed.chain().focus().toggleHeading({ level: 3 }).run(),
      },
      {
        id: 'bullet',
        labelKey: 'kb.editor.slash.bulletList',
        defaultLabel: 'Bullet list',
        icon: List,
        action: (ed) => ed.chain().focus().toggleBulletList().run(),
      },
      {
        id: 'ordered',
        labelKey: 'kb.editor.slash.orderedList',
        defaultLabel: 'Numbered list',
        icon: ListOrdered,
        action: (ed) => ed.chain().focus().toggleOrderedList().run(),
      },
      {
        id: 'quote',
        labelKey: 'kb.editor.slash.quote',
        defaultLabel: 'Quote',
        icon: Quote,
        action: (ed) => ed.chain().focus().toggleBlockquote().run(),
      },
      {
        id: 'code',
        labelKey: 'kb.editor.slash.codeBlock',
        defaultLabel: 'Code block',
        icon: Code2,
        action: (ed) => ed.chain().focus().toggleCodeBlock().run(),
      },
      {
        id: 'divider',
        labelKey: 'kb.editor.slash.divider',
        defaultLabel: 'Divider',
        icon: Minus,
        action: (ed) => ed.chain().focus().setHorizontalRule().run(),
      },
    ],
    [],
  );

  const filteredSlash = slashItems.filter((item) =>
    t(item.labelKey, item.defaultLabel).toLowerCase().includes(slashQuery.toLowerCase()),
  );

  const insertImage = useCallback(async (editor: Editor, file: File) => {
    if (!file.type.startsWith('image/')) return;
    const src = await fileToBase64(file);
    editor.chain().focus().setImage({ src, alt: file.name }).run();
  }, []);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ codeBlock: false }),
      Underline,
      Link.configure({ openOnClick: false, HTMLAttributes: { class: 'text-blue-600 underline' } }),
      Image.configure({ inline: false, allowBase64: true }),
      CodeBlockLowlight.configure({ lowlight }),
      Placeholder.configure({
        placeholder: placeholder ?? t('kb.editor.placeholder', 'Type / for blocks, or start writing…'),
      }),
    ],
    content: value || '',
    onUpdate: ({ editor: ed }) => onChange(ed.getHTML()),
    editorProps: {
      attributes: {
        class: 'kb-tiptap-editor min-h-[280px] px-4 py-3 outline-none prose prose-sm prose-slate max-w-none',
      },
      handleKeyDown: (_view, event) => {
        if (slashOpen && event.key === 'Escape') {
          setSlashOpen(false);
          return true;
        }
        return false;
      },
      handleDrop: (view, event) => {
        const files = event.dataTransfer?.files;
        const ed = editorRef.current;
        if (files?.length && ed) {
          event.preventDefault();
          void insertImage(ed, files[0]);
          return true;
        }
        return false;
      },
      handlePaste: (_view, event) => {
        const files = event.clipboardData?.files;
        const ed = editorRef.current;
        if (files?.length && ed) {
          event.preventDefault();
          void insertImage(ed, files[0]);
          return true;
        }
        return false;
      },
    },
  });

  editorRef.current = editor;

  useEffect(() => {
    if (!editor) return;
    const current = editor.getHTML();
    if (value !== current && value !== undefined) {
      editor.commands.setContent(value || '', { emitUpdate: false });
    }
  }, [editor, value]);

  useEffect(() => {
    if (!editor) return;

    const onUpdate = () => {
      const { state } = editor;
      const { from } = state.selection;
      const textBefore = state.doc.textBetween(Math.max(0, from - 20), from, '\n');
      const slashMatch = textBefore.match(/(?:^|\s)\/([^\s/]*)$/);
      if (slashMatch) {
        setSlashQuery(slashMatch[1] ?? '');
        setSlashOpen(true);
        const coords = editor.view.coordsAtPos(from);
        const wrapper = wrapperRef.current?.getBoundingClientRect();
        if (wrapper) {
          setSlashPos({
            top: coords.bottom - wrapper.top + 4,
            left: coords.left - wrapper.left,
          });
        }
      } else {
        setSlashOpen(false);
        setSlashQuery('');
      }
    };

    editor.on('update', onUpdate);
    editor.on('selectionUpdate', onUpdate);
    return () => {
      editor.off('update', onUpdate);
      editor.off('selectionUpdate', onUpdate);
    };
  }, [editor]);

  const runSlashCommand = (item: SlashItem) => {
    if (!editor) return;
    const { from } = editor.state.selection;
    const textBefore = editor.state.doc.textBetween(Math.max(0, from - 30), from, '\n');
    const slashIdx = textBefore.lastIndexOf('/');
    if (slashIdx >= 0) {
      const deleteFrom = from - (textBefore.length - slashIdx);
      editor.chain().focus().deleteRange({ from: deleteFrom, to: from }).run();
    }
    item.action(editor);
    setSlashOpen(false);
    setSlashQuery('');
  };

  const addLink = () => {
    if (!editor) return;
    const url = window.prompt(t('kb.editor.linkPrompt', 'Enter URL'));
    if (url) editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  };

  const addImageFromFile = () => {
    if (!editor) return;
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = () => {
      const file = input.files?.[0];
      if (file) void insertImage(editor, file);
    };
    input.click();
  };

  if (!editor) return null;

  return (
    <div
      ref={wrapperRef}
      className={cn(
        'relative w-full border border-slate-200/80 bg-white overflow-hidden rounded-xl shadow-sm',
        'focus-within:ring-2 focus-within:ring-blue-500/15 focus-within:border-blue-300 transition-all',
        className,
      )}
    >
      <div className="flex flex-wrap items-center gap-0.5 px-2 py-1.5 border-b border-slate-100 bg-slate-50/80">
        <ToolbarButton
          active={editor.isActive('bold')}
          onClick={() => editor.chain().focus().toggleBold().run()}
          title={t('kb.editor.bold', 'Bold')}
        >
          <Bold className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive('italic')}
          onClick={() => editor.chain().focus().toggleItalic().run()}
          title={t('kb.editor.italic', 'Italic')}
        >
          <Italic className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive('underline')}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          title={t('kb.editor.underline', 'Underline')}
        >
          <UnderlineIcon className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive('strike')}
          onClick={() => editor.chain().focus().toggleStrike().run()}
          title={t('kb.editor.strike', 'Strikethrough')}
        >
          <Strikethrough className="w-4 h-4" />
        </ToolbarButton>
        <span className="w-px h-5 bg-slate-200 mx-1" />
        <ToolbarButton
          active={editor.isActive('heading', { level: 2 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          title={t('kb.editor.heading', 'Heading')}
        >
          <Heading2 className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive('bulletList')}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          title={t('kb.editor.bulletList', 'Bullet list')}
        >
          <List className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive('orderedList')}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          title={t('kb.editor.orderedList', 'Numbered list')}
        >
          <ListOrdered className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive('codeBlock')}
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
          title={t('kb.editor.codeBlock', 'Code block')}
        >
          <Code2 className="w-4 h-4" />
        </ToolbarButton>
        <span className="w-px h-5 bg-slate-200 mx-1" />
        <ToolbarButton onClick={addLink} title={t('kb.editor.link', 'Link')}>
          <Link2 className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton onClick={addImageFromFile} title={t('kb.editor.image', 'Image')}>
          <ImageIcon className="w-4 h-4" />
        </ToolbarButton>
      </div>

      <EditorContent editor={editor} />

      {slashOpen && filteredSlash.length > 0 ? (
        <div
          ref={slashRef}
          className="absolute z-50 w-52 rounded-xl border border-slate-200/80 bg-white shadow-lg py-1 overflow-hidden"
          style={{ top: slashPos.top, left: slashPos.left }}
        >
          <p className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            {t('kb.editor.slashMenu', 'Insert block')}
          </p>
          {filteredSlash.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                className="w-full flex items-center gap-2.5 px-3 py-2 text-left text-xs font-medium text-slate-700 hover:bg-blue-50 hover:text-blue-700"
                onMouseDown={(e) => {
                  e.preventDefault();
                  runSlashCommand(item);
                }}
              >
                <Icon className="w-4 h-4 shrink-0 opacity-70" />
                {t(item.labelKey, item.defaultLabel)}
              </button>
            );
          })}
        </div>
      ) : null}

      <style>{`
        .kb-tiptap-editor p.is-editor-empty:first-child::before {
          color: #94a3b8;
          content: attr(data-placeholder);
          float: left;
          height: 0;
          pointer-events: none;
        }
        .kb-tiptap-editor pre {
          background: #0f172a;
          color: #e2e8f0;
          border-radius: 0.75rem;
          padding: 0.875rem 1rem;
          font-size: 0.8125rem;
          line-height: 1.6;
          overflow-x: auto;
        }
        .kb-tiptap-editor pre code {
          background: none;
          color: inherit;
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
        }
        .kb-tiptap-editor code {
          background: #f1f5f9;
          color: #be185d;
          border-radius: 0.375rem;
          padding: 0.125rem 0.375rem;
          font-size: 0.8125rem;
        }
        .kb-tiptap-editor img {
          max-width: 100%;
          border-radius: 0.75rem;
          margin: 0.75rem 0;
        }
        .kb-tiptap-editor h1 { font-size: 1.375rem; font-weight: 700; margin: 1rem 0 0.5rem; }
        .kb-tiptap-editor h2 { font-size: 1.125rem; font-weight: 700; margin: 0.875rem 0 0.375rem; }
        .kb-tiptap-editor h3 { font-size: 1rem; font-weight: 600; margin: 0.75rem 0 0.25rem; }
        .kb-tiptap-editor blockquote {
          border-left: 3px solid #cbd5e1;
          padding-left: 1rem;
          color: #64748b;
          font-style: italic;
        }
        /* Tailwind preflight strips list markers — restore them inside the editor */
        .kb-tiptap-editor ol {
          list-style-type: decimal !important;
          padding-left: 1.5rem !important;
          margin: 0.5rem 0 !important;
        }
        .kb-tiptap-editor ul {
          list-style-type: disc !important;
          padding-left: 1.5rem !important;
          margin: 0.5rem 0 !important;
        }
        .kb-tiptap-editor li {
          display: list-item !important;
        }
        .kb-tiptap-editor li p {
          margin: 0;
        }
        .kb-tiptap-editor hr { border: none; border-top: 1px solid #e2e8f0; margin: 1rem 0; }
      `}</style>
    </div>
  );
}
