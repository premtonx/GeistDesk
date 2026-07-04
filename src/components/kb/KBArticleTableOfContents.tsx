import { useRef, type RefObject } from 'react';
import { cn } from '../../lib/utils';
import type { ArticleHeading } from './kb-article-detail-utils';

interface KBArticleTableOfContentsProps {
  headings: ArticleHeading[];
  activeId?: string;
  className?: string;
  scrollContainerRef?: RefObject<HTMLElement | null>;
}

export function KBArticleTableOfContents({
  headings,
  activeId,
  className,
  scrollContainerRef,
}: KBArticleTableOfContentsProps) {
  if (headings.length === 0) return null;

  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (!el) return;

    const container = scrollContainerRef?.current;
    if (container) {
      const containerTop = container.getBoundingClientRect().top;
      const elementTop = el.getBoundingClientRect().top;
      const offset = elementTop - containerTop + container.scrollTop - 112;
      container.scrollTo({ top: Math.max(0, offset), behavior: 'smooth' });
      return;
    }

    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <nav
      className={cn(
        'hidden xl:block w-[180px] shrink-0 sticky top-24 self-start print:hidden',
        className,
      )}
      aria-label="On this page"
    >
      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-3">
        On this page
      </p>
      <ul className="space-y-1 border-l border-slate-200 pl-3">
        {headings.map((heading) => (
          <li key={heading.id}>
            <button
              type="button"
              onClick={() => scrollTo(heading.id)}
              className={cn(
                'text-left text-[11px] leading-snug py-1 transition-colors hover:text-blue-700',
                heading.level === 3 ? 'pl-2 text-slate-500' : 'font-medium text-slate-700',
                activeId === heading.id && 'text-blue-700 font-semibold',
              )}
            >
              {heading.text}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}
