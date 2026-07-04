import { useMemo } from 'react';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';

const RICH_TEXT_SURFACE_STYLES = `
  .rich-text-editor-container .ql-container.ql-snow {
    border: none;
    min-height: 220px;
    font-family: 'Inter', system-ui, sans-serif;
  }
  .rich-text-editor-container .ql-editor {
    min-height: 220px;
    padding: 16px;
    font-size: 14px;
    line-height: 1.6;
    color: #334155;
    overflow-wrap: anywhere;
    word-break: break-word;
  }
  .rich-text-editor-container .ql-editor.ql-blank::before {
    color: #94a3b8;
    font-style: normal;
    left: 16px;
    font-weight: 400;
  }
  .rich-text-editor-container .ql-toolbar.ql-snow {
    border: none;
    background-color: #fcfcfc;
    border-bottom: 1px solid #f1f5f9;
    padding: 8px 12px;
  }
  .rich-text-editor-container .ql-snow .ql-stroke {
    stroke: #64748b;
    stroke-width: 1.5px;
  }
  .rich-text-editor-container .ql-snow .ql-fill {
    fill: #64748b;
  }
  .rich-text-editor-container .ql-snow.ql-toolbar button:hover .ql-stroke {
    stroke: #1a73e8;
  }
  .rich-text-editor-container .ql-snow.ql-toolbar button:hover .ql-fill {
    fill: #1a73e8;
  }
  .rich-text-editor-container .ql-snow.ql-toolbar button.ql-active .ql-stroke {
    stroke: #1a73e8;
  }
  .rich-text-editor-container .ql-snow.ql-toolbar button.ql-active .ql-fill {
    fill: #1a73e8;
  }
  .rich-text-editor-container .ql-snow.ql-toolbar a {
    color: #1a73e8;
  }
  .rich-text-editor-container .ql-editor::-webkit-scrollbar {
    width: 8px;
  }
  .rich-text-editor-container .ql-editor::-webkit-scrollbar-track {
    background: #f8fafc;
  }
  .rich-text-editor-container .ql-editor::-webkit-scrollbar-thumb {
    background: #e2e8f0;
    border-radius: 10px;
  }
  .rich-text-editor-container .ql-editor::-webkit-scrollbar-thumb:hover {
    background: #cbd5e1;
  }
`;

interface RichTextEditorProps {
  value: string;
  onChange: (content: string) => void;
  placeholder?: string;
  className?: string;
}

export function RichTextEditor({ value, onChange, placeholder, className }: RichTextEditorProps) {
  const modules = useMemo(() => ({
    toolbar: {
      container: [
        ['bold', 'italic', 'underline', 'strike'],
        [{ 'list': 'ordered'}, { 'list': 'bullet' }],
        ['link', 'image'],
        ['clean']
      ],
    },
    clipboard: {
      matchVisual: false,
    }
  }), []);

  return (
    <div className={`rich-text-editor-container w-full border border-slate-200 rounded-lg overflow-hidden bg-white shadow-sm focus-within:ring-1 focus-within:ring-primary/20 focus-within:border-primary transition-all ${className || ''}`}>
      <ReactQuill 
        theme="snow"
        value={value || ''}
        onChange={onChange}
        modules={modules}
        placeholder={placeholder}
      />
      <style>{RICH_TEXT_SURFACE_STYLES}</style>
    </div>
  );
}
