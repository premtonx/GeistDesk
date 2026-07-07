import { Router, type Request, type Response } from 'express';
import { authenticate } from '../middleware/authMiddleware.js';
import { routeParam } from '../lib/route-params.js';
import {
  deleteDocDirect,
  getDocDirect,
  getDocsDirect,
  setDocDirect,
  updateDocDirect,
} from '../lib/postgres-backend.js';

const router = Router();
const COLLECTION = 'kb_categories';
const ARTICLES = 'kb_articles';
const UNCATEGORIZED = 'uncategorized';

const DEFAULT_CATEGORIES = [
  { id: 'getting-started', name: 'Getting Started', iconName: 'BookOpen', order: 1 },
  { id: 'billing', name: 'Billing', iconName: 'CreditCard', order: 2 },
  { id: 'api-documentation', name: 'API Documentation', iconName: 'Code2', order: 3 },
  { id: 'integrations', name: 'Integrations', iconName: 'Plug', order: 4 },
  { id: 'troubleshooting', name: 'Troubleshooting', iconName: 'Wrench', order: 5 },
  { id: 'internal-sops', name: 'Internal SOPs', iconName: 'ShieldCheck', order: 6 },
];

function slugifyCategoryId(name: string): string {
  return (
    name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || UNCATEGORIZED
  );
}

async function ensureDefaultCategories() {
  const existing = await getDocsDirect(COLLECTION, []);
  if (existing.length > 0) return existing;

  const now = new Date().toISOString();
  for (const cat of DEFAULT_CATEGORIES) {
    await setDocDirect(COLLECTION, cat.id, {
      ...cat,
      desc: '',
      owner: 'Sarah James',
      updatedAt: now,
      createdAt: now,
    });
  }
  return getDocsDirect(COLLECTION, []);
}

router.get('/', authenticate, async (_req: Request, res: Response) => {
  try {
    const rows = await ensureDefaultCategories();
    const categories = rows
      .map((row) => ({ ...row, id: row.id }))
      .sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0));
    return res.json({ categories });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to load categories.';
    return res.status(500).json({ error: message });
  }
});

router.post('/', authenticate, async (req: Request, res: Response) => {
  try {
    const { name, desc, owner, subCategory, order, iconName } = req.body || {};
    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: 'Category name is required.' });
    }

    const id = slugifyCategoryId(name);
    const existing = await getDocDirect(COLLECTION, id);
    if (existing) {
      return res.status(409).json({ error: 'A category with this name already exists.' });
    }

    const now = new Date().toISOString();
    const payload = {
      name: name.trim(),
      desc: typeof desc === 'string' ? desc : '',
      owner: typeof owner === 'string' ? owner : 'Sarah James',
      subCategory: typeof subCategory === 'string' ? subCategory : 'General',
      iconName: typeof iconName === 'string' ? iconName : 'BookOpen',
      order: typeof order === 'number' ? order : Date.now(),
      createdAt: now,
      updatedAt: now,
    };

    await setDocDirect(COLLECTION, id, payload);
    return res.status(201).json({ category: { id, ...payload } });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to create category.';
    return res.status(500).json({ error: message });
  }
});

router.patch('/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const id = routeParam(req.params.id);
    const existing = await getDocDirect(COLLECTION, id);
    if (!existing) {
      return res.status(404).json({ error: 'Category not found.' });
    }

    const { name, desc, owner, subCategory, order, iconName } = req.body || {};
    const patch: Record<string, unknown> = { updatedAt: new Date().toISOString() };

    if (typeof name === 'string' && name.trim()) patch.name = name.trim();
    if (typeof desc === 'string') patch.desc = desc;
    if (typeof owner === 'string') patch.owner = owner;
    if (typeof subCategory === 'string') patch.subCategory = subCategory;
    if (typeof order === 'number') patch.order = order;
    if (typeof iconName === 'string') patch.iconName = iconName;

    await updateDocDirect(COLLECTION, id, patch);

    const articles = await getDocsDirect(ARTICLES, []);
    const renamed = typeof name === 'string' && name.trim();
    if (renamed) {
      const oldName = existing.name as string | undefined;
      for (const article of articles) {
        if (article.category === id || article.category === oldName) {
          await updateDocDirect(ARTICLES, article.id, { category: id, updatedAt: new Date().toISOString() });
        }
      }
    }

    const updated = await getDocDirect(COLLECTION, id);
    return res.json({ category: { ...updated, id } });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to update category.';
    return res.status(500).json({ error: message });
  }
});

router.delete('/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const id = routeParam(req.params.id);
    if (id === UNCATEGORIZED) {
      return res.status(400).json({ error: 'The uncategorized bucket cannot be deleted.' });
    }

    const existing = await getDocDirect(COLLECTION, id);
    if (!existing) {
      return res.status(404).json({ error: 'Category not found.' });
    }

    const strategy = req.body?.strategy === 'purge' ? 'purge' : 'reassign';
    const articles = await getDocsDirect(ARTICLES, []);
    const affected = articles.filter(
      (a) => a.category === id || a.category === existing.name,
    );

    if (strategy === 'purge') {
      for (const article of affected) {
        await deleteDocDirect(ARTICLES, article.id);
      }
    } else {
      for (const article of affected) {
        await updateDocDirect(ARTICLES, article.id, {
          category: UNCATEGORIZED,
          updatedAt: new Date().toISOString(),
        });
      }
    }

    await deleteDocDirect(COLLECTION, id);
    return res.json({
      success: true,
      strategy,
      affectedCount: affected.length,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to delete category.';
    return res.status(500).json({ error: message });
  }
});

export default router;
