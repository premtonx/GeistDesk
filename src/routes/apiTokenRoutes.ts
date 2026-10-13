/**
 * Admin / self-service API token management for MCP and integrations.
 * Mounted at /api/api-tokens.
 */

import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { authenticate, requireRole } from '../middleware/authMiddleware.js';
import {
  ALL_MCP_SCOPES,
  createApiToken,
  listAllApiTokens,
  listApiTokensForUser,
  revokeApiToken,
  scopesForRole,
} from '../lib/api-tokens.js';
import { routeParam } from '../lib/route-params.js';
import { resolveTenantFromRequest } from '../lib/tenant-context.js';
import { getDocDirect } from '../lib/postgres-backend.js';

const router = Router();

const createSchema = z.object({
  name: z.string().min(1).max(120),
  scopes: z
    .array(z.string())
    .optional()
    .transform((scopes) =>
      (scopes || []).filter((s): s is (typeof ALL_MCP_SCOPES)[number] =>
        (ALL_MCP_SCOPES as readonly string[]).includes(s),
      ),
    ),
  expiresAt: z.string().datetime().nullable().optional(),
});

router.get('/', authenticate, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const tokens =
      user?.role === 'SYSTEM_ADMIN'
        ? await listAllApiTokens()
        : await listApiTokensForUser(user.id);
    return res.json({ tokens, availableScopes: ALL_MCP_SCOPES });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ error: 'Failed to list API tokens.', details: message });
  }
});

router.post('/', authenticate, async (req: Request, res: Response) => {
  try {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'Input validation failed',
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const user = (req as any).user;
    const role = user.role || 'agent';
    const allowed = new Set(scopesForRole(role));
    let requested = parsed.data.scopes?.length
      ? parsed.data.scopes.filter((s) => allowed.has(s))
      : [...allowed];

    // Non-admins cannot mint vault:reveal.
    if (role !== 'SYSTEM_ADMIN') {
      requested = requested.filter((s) => s !== 'vault:reveal');
    }

    const created = await createApiToken({
      name: parsed.data.name,
      userId: user.id,
      userEmail: user.email,
      role,
      scopes: requested,
      tenantId: resolveTenantFromRequest(req),
      expiresAt: parsed.data.expiresAt ?? null,
    });

    return res.status(201).json({
      token: created,
      warning: 'Store this token securely. The plaintext value is shown only once.',
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ error: 'Failed to create API token.', details: message });
  }
});

router.delete('/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const id = routeParam(req.params.id);
    if (!id) return res.status(400).json({ error: 'Token id is required.' });

    const user = (req as any).user;
    const existing = await getDocDirect('api_tokens', id);
    if (!existing) return res.status(404).json({ error: 'Token not found.' });

    if (user.role !== 'SYSTEM_ADMIN' && existing.userId !== user.id) {
      return res.status(403).json({ error: 'Forbidden: you can only revoke your own tokens.' });
    }

    await revokeApiToken(id);
    return res.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ error: 'Failed to revoke API token.', details: message });
  }
});

/** Admin-only: list every token across the workspace. */
router.get('/admin/all', authenticate, requireRole(['SYSTEM_ADMIN']), async (_req, res) => {
  try {
    const tokens = await listAllApiTokens();
    return res.json({ tokens });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ error: 'Failed to list tokens.', details: message });
  }
});

export default router;
