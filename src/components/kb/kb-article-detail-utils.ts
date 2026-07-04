export interface ArticleHeading {
  id: string;
  text: string;
  level: 2 | 3;
}

function slugifyHeadingText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 48) || 'section';
}

export function buildHeadingId(text: string, index: number): string {
  return `${index + 1}-${slugifyHeadingText(text)}`;
}

export function extractArticleHeadings(html: string): ArticleHeading[] {
  if (!html) return [];
  const headings: ArticleHeading[] = [];
  const regex = /<h([23])[^>]*>(.*?)<\/h\1>/gi;
  let match: RegExpExecArray | null;
  let index = 0;
  while ((match = regex.exec(html)) !== null) {
    const level = Number(match[1]) as 2 | 3;
    const text = match[2].replace(/<[^>]+>/g, '').trim();
    if (!text) continue;
    const id = buildHeadingId(text, index++);
    headings.push({ id, text, level });
  }
  return headings;
}

export function injectHeadingIds(html: string, headings: ArticleHeading[]): string {
  if (!headings.length) return html;
  let index = 0;
  return html.replace(/<h([23])([^>]*)>(.*?)<\/h\1>/gi, (full, _level, attrs, inner) => {
    const heading = headings[index];
    if (!heading) return full;
    const text = inner.replace(/<[^>]+>/g, '').trim();
    if (text !== heading.text) return full;
    index += 1;
    if (/\bid\s*=/.test(attrs)) return full;
    return `<h${_level}${attrs} id="${heading.id}">${inner}</h${_level}>`;
  });
}

export function formatArticleViews(views?: number): string {
  return (views ?? 0).toLocaleString('en-US');
}

export interface ArticleBadge {
  key: string;
  label: string;
  className: string;
}

export function deriveArticleBadges(article: {
  status?: string;
  visibility?: string;
  category?: string;
  subCategory?: string;
  tags?: string[];
  approvalStatus?: string;
}): ArticleBadge[] {
  const badges: ArticleBadge[] = [];
  const base = 'text-[10px] font-semibold px-2 py-0.5 rounded-md border';

  if (article.status === 'Published') {
    badges.push({ key: 'published', label: 'Published', className: `${base} bg-emerald-50 text-emerald-700 border-emerald-200` });
  }
  if (article.approvalStatus === 'Approved' || article.status === 'Published') {
    badges.push({ key: 'verified', label: 'Verified', className: `${base} bg-blue-50 text-blue-700 border-blue-200` });
  }
  if (article.visibility === 'Private' || article.visibility === 'Internal') {
    badges.push({ key: 'internal', label: 'Internal', className: `${base} bg-slate-100 text-slate-600 border-slate-200` });
  }
  if (
    article.category?.toLowerCase().includes('security') ||
    article.tags?.some((t) => t.toLowerCase().includes('security'))
  ) {
    badges.push({ key: 'security', label: 'Security', className: `${base} bg-amber-50 text-amber-800 border-amber-200` });
  }
  if (
    article.category?.toLowerCase().includes('sop') ||
    article.subCategory?.toLowerCase().includes('sop')
  ) {
    badges.push({ key: 'sop', label: 'SOP', className: `${base} bg-violet-50 text-violet-700 border-violet-200` });
  }
  badges.push({ key: 'ai-reviewed', label: 'AI Reviewed', className: `${base} bg-slate-50 text-slate-600 border-slate-200` });

  return badges;
}

export const KB_ARTICLE_CONTENT_WRAP_CLASS =
  'min-w-0 max-w-full overflow-x-hidden break-words [overflow-wrap:anywhere] [word-break:break-word]';
