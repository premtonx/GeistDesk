/**
 * Strict tenant isolation guards for MSP client portal roles.
 */

import type { Response, NextFunction } from 'express';
import type { AuthenticatedRequest } from './authMiddleware.js';
import {
  isClientPortalRole,
  isHubcomStaffRole,
} from '../lib/client-portal/roles.js';
import {
  resolveOrganizationIdFromUser,
  stripClientSpoofFields,
} from '../lib/client-portal/ticket-visibility.js';
import { getOrganization } from '../lib/client-portal/organizations.js';

/**
 * Block ALL client portal roles from Hubcom Admin Hub / internal admin APIs.
 * Mount on `/api/admin/*` after authenticate.
 */
export function forbidClientPortalRoles(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): any {
  const role = req.user?.role;
  if (isClientPortalRole(role)) {
    return res.status(403).json({
      error: 'Forbidden: Client portal accounts cannot access Hubcom Admin Hub endpoints.',
    });
  }
  return next();
}

/**
 * Require an authenticated Hubcom staff role (not a client portal role).
 */
export function requireHubcomStaff(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): any {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized.' });
  }
  if (!isHubcomStaffRole(req.user.role) && req.user.role !== 'SYSTEM_ADMIN') {
    return res.status(403).json({
      error: 'Forbidden: Hubcom staff access required.',
    });
  }
  return next();
}

/**
 * Require one of the client portal roles and a bound organization.
 * Also strips spoofed organization_id from the body.
 */
export function requireClientPortalRole(
  allowed: Array<'CLIENT_ADMIN' | 'CLIENT_SUPPORTER' | 'CLIENT_USER'> = [
    'CLIENT_ADMIN',
    'CLIENT_SUPPORTER',
    'CLIENT_USER',
  ],
) {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<any> => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized.' });
    }
    if (!isClientPortalRole(req.user.role) || !allowed.includes(req.user.role as any)) {
      return res.status(403).json({
        error: `Forbidden: Requires client portal role (${allowed.join(', ')}).`,
      });
    }

    const organizationId = resolveOrganizationIdFromUser(req.user);
    if (!organizationId) {
      return res.status(403).json({
        error: 'Forbidden: Client account is not linked to an organization.',
      });
    }

    const org = await getOrganization(organizationId);
    if (!org || !org.is_active) {
      return res.status(403).json({
        error: 'Forbidden: Organization is inactive or missing.',
      });
    }

    // Always derive org from session — never trust client body/query.
    (req.user as any).organizationId = organizationId;
    if (req.body && typeof req.body === 'object') {
      req.body = stripClientSpoofFields(req.body);
      // Re-stamp the session organization so handlers can rely on it when needed
      // for creates — but only after strip, and only for ticket create paths that
      // explicitly re-apply from session (never from client).
    }
    if (req.query && typeof req.query === 'object') {
      delete (req.query as any).organizationId;
      delete (req.query as any).organization_id;
    }

    return next();
  };
}

/**
 * For mixed staff/client ticket endpoints: strip spoof fields for client roles
 * and ensure organizationId on the session is populated.
 */
export async function attachClientOrganizationContext(
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction,
): Promise<any> {
  if (req.user && isClientPortalRole(req.user.role)) {
    const organizationId = resolveOrganizationIdFromUser(req.user);
    (req.user as any).organizationId = organizationId;
    if (req.body && typeof req.body === 'object') {
      req.body = stripClientSpoofFields(req.body);
    }
  }
  return next();
}
