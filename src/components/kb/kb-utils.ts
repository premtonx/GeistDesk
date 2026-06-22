import { cn } from '../../lib/utils';

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
      return 'bg-emerald-50 text-emerald-700 border-emerald-100';
    case 'Draft':
      return 'bg-orange-50 text-orange-700 border-orange-100';
    case 'Needs Review':
    case 'Under Revision':
      return 'bg-violet-50 text-violet-700 border-violet-100';
    case 'Archived':
    case 'Outdated':
      return 'bg-slate-100 text-slate-600 border-slate-200';
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
