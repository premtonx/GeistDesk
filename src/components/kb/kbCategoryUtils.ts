import type { LucideIcon } from 'lucide-react';

export const UNCATEGORIZED_CATEGORY_ID = 'uncategorized';

export interface KBCategoryRecord {
  id: string;
  name: string;
  subCategory?: string;
  desc?: string;
  owner?: string;
  updated?: string;
  icon: LucideIcon;
  order: number;
}

/** Legacy article.category values → stable category id */
export const CATEGORY_LEGACY_ID_MAP: Record<string, string> = {
  'Getting Started': 'getting-started',
  Billing: 'billing',
  'API Documentation': 'api-documentation',
  Integrations: 'integrations',
  Troubleshooting: 'troubleshooting',
  'Internal SOPs': 'internal-sops',
  [UNCATEGORIZED_CATEGORY_ID]: UNCATEGORIZED_CATEGORY_ID,
  Uncategorized: UNCATEGORIZED_CATEGORY_ID,
};

export function slugifyCategoryId(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || UNCATEGORIZED_CATEGORY_ID;
}

export function resolveArticleCategoryId(
  art: { category?: string },
  categories: KBCategoryRecord[],
): string {
  const raw = art.category ?? UNCATEGORIZED_CATEGORY_ID;
  if (categories.some((c) => c.id === raw)) return raw;
  const byName = categories.find((c) => c.name === raw);
  if (byName) return byName.id;
  return CATEGORY_LEGACY_ID_MAP[raw] ?? raw;
}

export function getCategoryDisplayName(
  categoryRef: string | undefined,
  categories: KBCategoryRecord[],
  t: (key: string, fallback?: string) => string,
  categoryI18nKey: (name: string) => string,
): string {
  const id = categoryRef ?? UNCATEGORIZED_CATEGORY_ID;
  const record =
    categories.find((c) => c.id === id) ??
    categories.find((c) => c.name === id);
  if (record) {
    return t(categoryI18nKey(record.name), record.name);
  }
  if (id === UNCATEGORIZED_CATEGORY_ID) {
    return t('kb.categories.uncategorized.name', 'Uncategorized');
  }
  return t(categoryI18nKey(id), id);
}

export function articleMatchesCategoryId(
  art: { category?: string; tags?: string[] },
  categoryId: string,
  categories: KBCategoryRecord[],
): boolean {
  const artCatId = resolveArticleCategoryId(art, categories);
  if (artCatId === categoryId) return true;

  // Sidebar alias mappings
  if (categoryId === 'Product Guides') {
    return (
      artCatId === 'getting-started' ||
      (art.tags ?? []).some((tag) => /product|guide/i.test(tag))
    );
  }
  if (categoryId === 'Security') {
    return (
      artCatId === 'internal-sops' ||
      (art.tags ?? []).some((tag) => /security|soc2/i.test(tag))
    );
  }
  if (categoryId === 'Company Policies') {
    return (art.tags ?? []).some((tag) => /policy|compliance|gdpr/i.test(tag));
  }
  if (categoryId === 'Billing') return artCatId === 'billing';
  return artCatId === categoryId || art.category === categoryId;
}
