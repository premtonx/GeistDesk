import { cn } from '../../lib/utils';
import type { AppWorkspace } from '../../lib/ticketWorkspace';

export const KB_RADIUS = 'rounded-xl';

const DEVELOPER_CATEGORIES = new Set([
  'API Documentation',
  'Internal SOPs',
  'Integrations',
]);
const SUPPORT_CATEGORIES = new Set([
  'Getting Started',
  'Billing',
  'Troubleshooting',
]);

const SUPPORT_TAG_RE = /faq|sla|customer|troubleshoot|onboarding|billing|support|public/i;
const DEVELOPER_TAG_RE = /api|developer|sop|internal|runbook|engineering|security|infrastructure|architecture/i;

export function stripHtml(html: string): string {
  if (typeof document === 'undefined') {
    return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  }
  const tmp = document.createElement('DIV');
  tmp.innerHTML = html;
  return tmp.textContent || tmp.innerText || '';
}

export function formatArticleDate(art: { updatedAt?: { toDate?: () => Date } | Date | string }): string {
  if (art.updatedAt && typeof art.updatedAt === 'object' && 'toDate' in art.updatedAt && art.updatedAt.toDate) {
    return art.updatedAt.toDate().toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }
  if (art.updatedAt instanceof Date) {
    return art.updatedAt.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }
  return '';
}

export function getStatusBadgeClass(status?: string): string {
  switch (status) {
    case 'Published':
      return 'bg-emerald-50 text-emerald-800 border-emerald-100';
    case 'Draft':
      return 'bg-orange-50 text-orange-800 border-orange-100';
    case 'Needs Review':
    case 'Under Revision':
      return 'bg-violet-50 text-violet-800 border-violet-100';
    case 'Archived':
    case 'Outdated':
      return 'bg-slate-100 text-slate-700 border-slate-200';
    default:
      return 'bg-slate-100 text-slate-600 border-slate-200';
  }
}

export function statusLabelKey(status?: string): string {
  const map: Record<string, string> = {
    Published: 'kb.status.published',
    Draft: 'kb.status.draft',
    'Needs Review': 'kb.status.review',
    'Under Revision': 'kb.status.review',
    Archived: 'kb.status.archived',
    Outdated: 'kb.status.archived',
  };
  return map[status ?? ''] ?? 'kb.status.draft';
}

export function categoryI18nKey(name: string): string {
  return `kb.categories.${name.replace(/\s+/g, '_').toLowerCase()}.name`;
}

export function filterArticlesByWorkspace<
  T extends { category?: string; visibility?: string; tags?: string[] },
>(articles: T[], workspace: AppWorkspace): T[] {
  if (workspace === 'developer') {
    return articles.filter(
      (a) =>
        a.visibility === 'Private' ||
        DEVELOPER_CATEGORIES.has(a.category ?? '') ||
        (a.tags ?? []).some((tag) => DEVELOPER_TAG_RE.test(tag)),
    );
  }
  return articles.filter(
    (a) =>
      a.visibility === 'Public' ||
      SUPPORT_CATEGORIES.has(a.category ?? '') ||
      (a.tags ?? []).some((tag) => SUPPORT_TAG_RE.test(tag)) ||
      !(DEVELOPER_CATEGORIES.has(a.category ?? '') && a.visibility === 'Private'),
  );
}

export interface KBTreeNode {
  id: string;
  label: string;
  count: number;
  category?: string;
  subCategory?: string;
  children?: KBTreeNode[];
}

export function buildCategoryTree(
  articles: { category?: string; subCategory?: string }[],
): KBTreeNode[] {
  const byCat = new Map<string, Map<string, number>>();
  for (const a of articles) {
    const cat = a.category ?? 'Uncategorized';
    const sub = a.subCategory ?? 'General';
    if (!byCat.has(cat)) byCat.set(cat, new Map());
    const subs = byCat.get(cat)!;
    subs.set(sub, (subs.get(sub) ?? 0) + 1);
  }
  return Array.from(byCat.entries()).map(([cat, subs]) => ({
    id: cat,
    label: cat,
    category: cat,
    count: Array.from(subs.values()).reduce((s, n) => s + n, 0),
    children: Array.from(subs.entries()).map(([sub, count]) => ({
      id: `${cat}::${sub}`,
      label: sub,
      category: cat,
      subCategory: sub,
      count,
    })),
  }));
}

export function estimateReadTime(content?: string, fallback?: string): string {
  if (fallback) return fallback;
  const words = stripHtml(content ?? '').split(/\s+/).filter(Boolean).length;
  const mins = Math.max(1, Math.ceil(words / 200));
  return `${mins}m`;
}

export function qualityBarClass(score: number): string {
  if (score >= 85) return 'bg-emerald-500';
  if (score >= 70) return 'bg-blue-500';
  if (score >= 50) return 'bg-amber-500';
  return 'bg-rose-500';
}

export function kbPanelClass(className?: string): string {
  return cn(KB_RADIUS, 'border border-slate-200/80 bg-white overflow-hidden', className);
}
