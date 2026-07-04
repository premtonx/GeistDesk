import 'react-quill-new/dist/quill.snow.css';

const RICH_TEXT_PREVIEW_STYLES = `
  .rich-text-preview-container .ql-container.ql-snow {
    border: none;
    min-height: 0;
    font-family: 'Inter', system-ui, sans-serif;
  }
  .rich-text-preview-container .ql-editor {
    min-height: 0;
    padding: 16px;
    font-size: 14px;
    line-height: 1.6;
    color: #334155;
    overflow-wrap: anywhere;
    word-break: break-word;
  }
  .rich-text-preview-container .ql-editor h1,
  .rich-text-preview-container .ql-editor h2,
  .rich-text-preview-container .ql-editor h3 {
    font-weight: 600;
    color: #0f172a;
    scroll-margin-top: 7rem;
  }
  .rich-text-preview-container .ql-editor h2 {
    font-size: 1.25rem;
    margin-top: 2rem;
    margin-bottom: 0.75rem;
  }
  .rich-text-preview-container .ql-editor h3 {
    font-size: 1rem;
    margin-top: 1.5rem;
    margin-bottom: 0.5rem;
  }
  .rich-text-preview-container .ql-editor p {
    margin-bottom: 1rem;
  }
  .rich-text-preview-container .ql-editor pre {
    border-radius: 0.75rem;
    background: #0f172a;
    color: #f8fafc;
    padding: 1rem;
    overflow-x: auto;
  }
  .rich-text-preview-container .ql-editor code {
    background: #eff6ff;
    color: #1d4ed8;
    padding: 0.125rem 0.25rem;
    border-radius: 0.25rem;
  }
`;

interface RichTextPreviewProps {
  html: string;
  className?: string;
}

/** Read-only Quill HTML surface — matches the Tickets RichTextEditor canvas layout. */
export function RichTextPreview({ html, className }: RichTextPreviewProps) {
  return (
    <div
      className={`rich-text-preview-container w-full border border-slate-200 rounded-lg overflow-hidden bg-white shadow-sm ${className || ''}`}
    >
      <div className="ql-container ql-snow">
        {html.trim() ? (
          <div className="ql-editor" dangerouslySetInnerHTML={{ __html: html }} />
        ) : (
          <div className="ql-editor ql-blank" />
        )}
      </div>
      <style>{RICH_TEXT_PREVIEW_STYLES}</style>
    </div>
  );
}
