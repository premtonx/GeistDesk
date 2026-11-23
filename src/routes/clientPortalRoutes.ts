/**
 * Client-facing portal APIs (CLIENT_ADMIN / CLIENT_SUPPORTER / CLIENT_USER).
 */

import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { randomBytes } from 'crypto';
import { authenticate } from '../middleware/authMiddleware.js';
import {
  attachClientOrganizationContext,
  requireClientPortalRole,
} from '../middleware/clientPortalMiddleware.js';
import {
  addDocDirect,
  getDocsDirect,
  setDocDirect,
  updateDocDirect,
} from '../lib/postgres-backend.js';
import { hashPassword } from '../lib/crypto.js';
import { safeErrorMessage, safeLog } from '../lib/safe-log.js';
import { CLIENT_PORTAL_ROLE_SEEDS, isClientPortalRole } from '../lib/client-portal/roles.js';
import { resolveOrganizationIdFromUser } from '../lib/client-portal/ticket-visibility.js';

const router = Router();

router.use(authenticate, attachClientOrganizationContext);

/** GET /api/portal/me — session identity for the Kunden-Portal shell. */
router.get('/me', requireClientPortalRole(), async (req: Request, res: Response): Promise<any> => {
  return res.json({
    user: {
      id: req.user!.id,
      name: req.user!.name,
      email: req.user!.email,
      role: req.user!.role,
      organizationId: resolveOrganizationIdFromUser(req.user!),
    },
  });
});

/** GET /api/portal/members — same-organization directory. */
router.get(
  '/members',
  requireClientPortalRole(['CLIENT_ADMIN', 'CLIENT_SUPPORTER', 'CLIENT_USER']),
  async (req: Request, res: Response): Promise<any> => {
    try {
      const organizationId = resolveOrganizationIdFromUser(req.user!);
      const users = await getDocsDirect('users', []);
      let members = users
        .filter((u) => {
          const oid =
            (typeof u.organizationId === 'string' && u.organizationId) ||
            (typeof u.organization_id === 'string' && u.organization_id) ||
            '';
          return oid === organizationId;
        })
        .map((u) => ({
          id: u.id,
          name: u.name || '',
          email: u.email || '',
          role: u.role || 'CLIENT_USER',
          isDeactivated: u.isDeactivated === true,
        }));

      if (req.user!.role === 'CLIENT_USER') {
        members = members.filter((m) => m.id === req.user!.id);
      }

      return res.json({ members });
    } catch (err: any) {
      safeLog('error', '[portal] list members failed', err?.message || err);
      return res.status(500).json({ error: safeErrorMessage(err, 'Failed to list members') });
    }
  },
);

const inviteMemberSchema = z.object({
  email: z.string().email().max(320),
  name: z.string().min(1).max(200),
  role: z.enum(['CLIENT_SUPPORTER', 'CLIENT_USER']),
  temporaryPassword: z.string().min(10).max(200).optional(),
});

/** POST /api/portal/members — CLIENT_ADMIN invites a colleague. */
router.post(
  '/members',
  requireClientPortalRole(['CLIENT_ADMIN']),
  async (req: Request, res: Response): Promise<any> => {
    const parsed = inviteMemberSchema.safeParse(req.body || {});
    if (!parsed.success) {
      return res.status(400).json({
        error: 'Invalid member payload',
        details: parsed.error.flatten().fieldErrors,
      });
    }

    try {
      const organizationId = resolveOrganizationIdFromUser(req.user!);
      if (!organizationId) {
        return res.status(403).json({ error: 'Organization missing.' });
      }

      const roleSeed = CLIENT_PORTAL_ROLE_SEEDS.find((r) => r.name === parsed.data.role)!;
      await setDocDirect('roles', roleSeed.id, {
        ...roleSeed,
        updatedAt: new Date().toISOString(),
      });

      const email = parsed.data.email.toLowerCase().trim();
      const existing = await getDocsDirect('users', [
        { type: 'where', field: 'email', op: '==', value: email },
      ]);
      const tempPassword =
        parsed.data.temporaryPassword || randomBytes(12).toString('base64url');
      const passwordHash = await hashPassword(tempPassword);
      const now = new Date().toISOString();

      if (existing.length > 0) {
        const user = existing[0];
        const existingOrg =
          (typeof user.organizationId === 'string' && user.organizationId) ||
          (typeof user.organization_id === 'string' && user.organization_id) ||
          '';
        if (existingOrg && existingOrg !== organizationId) {
          return res.status(409).json({
            error: 'User already belongs to another organization.',
          });
        }
        if (isClientPortalRole(user.role) === false && user.role && user.role !== 'customer') {
          return res.status(409).json({
            error: 'Cannot convert a Hubcom staff account into a client member.',
          });
        }
        await updateDocDirect('users', user.id, {
          name: parsed.data.name,
          role: parsed.data.role,
          roleId: roleSeed.id,
          organizationId,
          organization_id: organizationId,
          is_admin: false,
          can_create_tickets: true,
          password: passwordHash,
          authMethod: user.authMethod || 'password',
          updatedAt: now,
        });
        return res.json({
          success: true,
          member: {
            id: user.id,
            name: parsed.data.name,
            email,
            role: parsed.data.role,
          },
          temporaryPassword: tempPassword,
        });
      }

      const created = await addDocDirect('users', {
        name: parsed.data.name,
        email,
        role: parsed.data.role,
        roleId: roleSeed.id,
        organizationId,
        organization_id: organizationId,
        is_admin: false,
        can_create_tickets: true,
        can_view_knowledgebase: parsed.data.role === 'CLIENT_SUPPORTER',
        authMethod: 'password',
        password: passwordHash,
        isDeactivated: false,
        createdAt: now,
        updatedAt: now,
      });

      return res.status(201).json({
        success: true,
        member: {
          id: created.id,
          name: parsed.data.name,
          email,
          role: parsed.data.role,
        },
        temporaryPassword: tempPassword,
      });
    } catch (err: any) {
      safeLog('error', '[portal] invite member failed', err?.message || err);
      return res.status(500).json({ error: safeErrorMessage(err, 'Failed to invite member') });
    }
  },
);

export default router;
