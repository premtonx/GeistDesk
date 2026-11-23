/**
 * /api/portal/team — CLIENT_ADMIN org worker management.
 * SYSTEM_ADMIN may manage a specific organization via ?organizationId= / body.organizationId.
 */

import { Router, type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/authMiddleware.js';
import { attachClientOrganizationContext } from '../middleware/clientPortalMiddleware.js';
import { getDocDirect, updateDocDirect } from '../lib/postgres-backend.js';
import { routeParam } from '../lib/route-params.js';
import { safeErrorMessage, safeLog } from '../lib/safe-log.js';
import { isClientPortalRole } from '../lib/client-portal/roles.js';
import { resolveOrganizationIdFromUser } from '../lib/client-portal/ticket-visibility.js';
import {
  CLIENT_TEAM_ROLES,
  countActiveClientAdmins,
  createOrInviteTeamMember,
  ensureClientRoleDoc,
  isClientTeamRole,
  listOrganizationUsers,
  resetTeamMemberPassword,
  toTeamMemberView,
  userOrganizationId,
  type ClientTeamRole,
} from '../lib/client-portal/team-service.js';

const router = Router();

router.use(authenticate, attachClientOrganizationContext);

/** Resolve which organization the caller is allowed to manage. */
async function resolveManagedOrganizationId(
  req: Request,
  res: Response,
): Promise<string | null> {
  const role = String(req.user?.role || '');
  if (role === 'SYSTEM_ADMIN') {
    const fromQuery =
      (typeof req.query.organizationId === 'string' && req.query.organizationId.trim()) ||
      (typeof req.body?.organizationId === 'string' && req.body.organizationId.trim()) ||
      '';
    if (!fromQuery) {
      res.status(400).json({
        error: 'SYSTEM_ADMIN must specify organizationId (query or body).',
      });
      return null;
    }
    return fromQuery;
  }

  if (role !== 'CLIENT_ADMIN') {
    res.status(403).json({
      error: 'Forbidden: Only CLIENT_ADMIN (or SYSTEM_ADMIN) can manage the team.',
    });
    return null;
  }

  const organizationId = resolveOrganizationIdFromUser(req.user!);
  if (!organizationId) {
    res.status(403).json({ error: 'Forbidden: Client admin has no organization.' });
    return null;
  }
  return organizationId;
}

function requireTeamManager(req: Request, res: Response, next: NextFunction): any {
  const role = String(req.user?.role || '');
  if (role === 'SYSTEM_ADMIN' || role === 'CLIENT_ADMIN') return next();
  return res.status(403).json({
    error: 'Forbidden: Only CLIENT_ADMIN (or SYSTEM_ADMIN) can manage the team.',
  });
}

router.use(requireTeamManager);

const createSchema = z.object({
  name: z.string().min(1).max(200),
  email: z.string().email().max(320),
  role: z.enum(CLIENT_TEAM_ROLES),
  organizationId: z.string().min(1).max(80).optional(),
});

const patchSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  role: z.enum(CLIENT_TEAM_ROLES).optional(),
  isActive: z.boolean().optional(),
  organizationId: z.string().min(1).max(80).optional(),
});

/** GET /api/portal/team */
router.get('/', async (req: Request, res: Response): Promise<any> => {
  try {
    const organizationId = await resolveManagedOrganizationId(req, res);
    if (!organizationId) return;
    const members = await listOrganizationUsers(organizationId);
    const summary = {
      totalActive: members.filter((m) => m.isActive).length,
      clientAdmins: members.filter((m) => m.role === 'CLIENT_ADMIN' && m.isActive).length,
      clientSupporters: members.filter((m) => m.role === 'CLIENT_SUPPORTER' && m.isActive)
        .length,
      clientUsers: members.filter((m) => m.role === 'CLIENT_USER' && m.isActive).length,
      total: members.length,
    };
    return res.json({ members, summary, organizationId });
  } catch (err: any) {
    safeLog('error', '[portal/team] list failed', err?.message || err);
    return res.status(500).json({ error: safeErrorMessage(err, 'Failed to list team') });
  }
});

/** POST /api/portal/team */
router.post('/', async (req: Request, res: Response): Promise<any> => {
  const parsed = createSchema.safeParse(req.body || {});
  if (!parsed.success) {
    return res.status(400).json({
      error: 'Invalid team member payload',
      details: parsed.error.flatten().fieldErrors,
    });
  }
  try {
    const organizationId = await resolveManagedOrganizationId(req, res);
    if (!organizationId) return;

    // Never allow Hubcom internal roles — schema already restricts, belt-and-braces:
    if (!isClientTeamRole(parsed.data.role)) {
      return res.status(400).json({ error: 'Role must be a client portal role.' });
    }

    const result = await createOrInviteTeamMember({
      organizationId,
      name: parsed.data.name.trim(),
      email: parsed.data.email,
      role: parsed.data.role,
      invitedBy: String(req.user!.id),
    });

    return res.status(result.created ? 201 : 200).json({
      success: true,
      member: result.member,
      setupLink: result.setupLink,
      temporaryPassword: result.temporaryPassword,
      emailSent: result.emailSent,
      emailReason: result.emailReason || null,
      created: result.created,
    });
  } catch (err: any) {
    const status = Number(err?.status) || 500;
    if (status < 500) return res.status(status).json({ error: err.message });
    safeLog('error', '[portal/team] create failed', err?.message || err);
    return res.status(500).json({ error: safeErrorMessage(err, 'Failed to create team member') });
  }
});

/** PATCH /api/portal/team/:userId */
router.patch('/:userId', async (req: Request, res: Response): Promise<any> => {
  const userId = routeParam(req.params.userId);
  const parsed = patchSchema.safeParse(req.body || {});
  if (!parsed.success) {
    return res.status(400).json({
      error: 'Invalid update payload',
      details: parsed.error.flatten().fieldErrors,
    });
  }

  try {
    const organizationId = await resolveManagedOrganizationId(req, res);
    if (!organizationId) return;

    const user = await getDocDirect('users', userId);
    if (!user || userOrganizationId(user) !== organizationId) {
      return res.status(404).json({ error: 'User not found.' });
    }
    if (!isClientPortalRole(user.role) && user.role !== 'customer') {
      return res.status(403).json({ error: 'Cannot modify Hubcom staff via portal team API.' });
    }

    const updates: Record<string, unknown> = {
      updatedAt: new Date().toISOString(),
    };

    if (parsed.data.name !== undefined) {
      updates.name = parsed.data.name.trim();
    }

    if (parsed.data.role !== undefined) {
      if (!isClientTeamRole(parsed.data.role)) {
        return res.status(400).json({ error: 'Role must be a client portal role.' });
      }
      // Prevent demoting/removing the last active CLIENT_ADMIN.
      if (
        user.role === 'CLIENT_ADMIN' &&
        parsed.data.role !== 'CLIENT_ADMIN' &&
        user.isDeactivated !== true
      ) {
        const remaining = await countActiveClientAdmins(organizationId, userId);
        if (remaining < 1) {
          return res.status(400).json({
            error:
              'Cannot change role: this is the last active CLIENT_ADMIN in the organization.',
          });
        }
      }
      const roleId = await ensureClientRoleDoc(parsed.data.role as ClientTeamRole);
      updates.role = parsed.data.role;
      updates.roleId = roleId;
      updates.is_admin = false;
      updates.can_view_knowledgebase = parsed.data.role !== 'CLIENT_USER';
    }

    if (parsed.data.isActive !== undefined) {
      if (parsed.data.isActive === false) {
        // Prevent disabling the last active CLIENT_ADMIN.
        if (user.role === 'CLIENT_ADMIN' && user.isDeactivated !== true) {
          const remaining = await countActiveClientAdmins(organizationId, userId);
          if (remaining < 1) {
            return res.status(400).json({
              error:
                'Cannot deactivate: this is the last active CLIENT_ADMIN in the organization.',
            });
          }
        }
        // Prevent self-lockout.
        if (userId === req.user!.id) {
          return res.status(400).json({
            error: 'You cannot deactivate your own account.',
          });
        }
      }
      updates.isDeactivated = !parsed.data.isActive;
    }

    if (Object.keys(updates).length <= 1) {
      return res.status(400).json({ error: 'No updatable fields provided.' });
    }

    await updateDocDirect('users', userId, updates);
    const refreshed = await getDocDirect('users', userId);
    return res.json({
      success: true,
      member: toTeamMemberView({ id: userId, ...(refreshed || user) }),
    });
  } catch (err: any) {
    safeLog('error', '[portal/team] patch failed', err?.message || err);
    return res.status(500).json({ error: safeErrorMessage(err, 'Failed to update team member') });
  }
});

/** POST /api/portal/team/:userId/reset-password */
router.post('/:userId/reset-password', async (req: Request, res: Response): Promise<any> => {
  const userId = routeParam(req.params.userId);
  try {
    const organizationId = await resolveManagedOrganizationId(req, res);
    if (!organizationId) return;

    const result = await resetTeamMemberPassword({
      organizationId,
      userId,
      requestedBy: String(req.user!.id),
    });

    return res.json({
      success: true,
      member: result.member,
      setupLink: result.setupLink,
      temporaryPassword: result.temporaryPassword,
      emailSent: result.emailSent,
      emailReason: result.emailReason || null,
    });
  } catch (err: any) {
    const status = Number(err?.status) || 500;
    if (status < 500) return res.status(status).json({ error: err.message });
    safeLog('error', '[portal/team] reset-password failed', err?.message || err);
    return res.status(500).json({ error: safeErrorMessage(err, 'Failed to reset password') });
  }
});

export default router;
