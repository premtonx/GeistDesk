import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import jwksClient from "jwks-rsa";
import { getDocDirect, getDocsDirect } from "../lib/postgres-backend.js";

// JWT and Microsoft JWKS Clients
const JWKS_URI = "https://login.microsoftonline.com/common/discovery/v2.0/keys";
const microsoftJwksClient = jwksClient({
  jwksUri: JWKS_URI,
  cache: true,
  rateLimit: true,
  jwksRequestsPerMinute: 10
});

// The local session signing secret MUST be provided via environment. There is
// intentionally no insecure hardcoded fallback: an unset secret would allow
// trivial token forgery, so we fail fast instead.
const LOCAL_JWT_SECRET = process.env.JWT_SECRET;
if (!LOCAL_JWT_SECRET) {
  throw new Error(
    "[Auth] JWT_SECRET environment variable is required. Refusing to start with an insecure default signing key."
  );
}

// Extend Express Request type locally for safety
export type AuthenticatedRequest = any;

/**
 * Beta-stage auto-admin — disabled by default.
 * In production (NODE_ENV=production / IS_PROD) this is always refused so a
 * mis-set env cannot elevate every authenticated user to SYSTEM_ADMIN.
 */
function isServerBetaAutoAdminEnabled(): boolean {
  if (process.env.NODE_ENV === 'production' || process.env.IS_PROD === 'true') {
    if (process.env.BETA_AUTO_ADMIN === 'true') {
      console.error(
        '[Auth] BETA_AUTO_ADMIN=true is forbidden in production and will be ignored.',
      );
    }
    return false;
  }
  return process.env.BETA_AUTO_ADMIN === 'true';
}

function resolveUserTenantId(userDoc: Record<string, unknown>): string {
  const raw =
    (typeof userDoc.tenantId === 'string' && userDoc.tenantId.trim()) ||
    (typeof userDoc.tenant_id === 'string' && userDoc.tenant_id.trim()) ||
    (typeof userDoc.workspaceId === 'string' && userDoc.workspaceId.trim()) ||
    '';
  return raw || 'default';
}

/**
 * Retrieves the signing key from Microsoft Entra JWKS
 */
function getMicrosoftSigningKey(header: jwt.JwtHeader, callback: jwt.SigningKeyCallback) {
  if (!header.kid) {
    return callback(new Error("Missing 'kid' in Microsoft Token Header"));
  }
  microsoftJwksClient.getSigningKey(header.kid, (err, key) => {
    if (err) {
      return callback(err);
    }
    const signingKey = key?.getPublicKey();
    callback(null, signingKey);
  });
}

/** Extracts a raw cookie value by name from the incoming request. */
function readSessionCookie(req: AuthenticatedRequest): string | undefined {
  let cookieSession = req.cookies?.session || req.cookies?.session_token;
  if (!cookieSession && req.headers.cookie) {
    const rawCookies = req.headers.cookie.split(";");
    for (const cookie of rawCookies) {
      const parts = cookie.split("=");
      const key = parts[0]?.trim();
      const val = parts.slice(1).join("=")?.trim();
      if (key === "session" || key === "session_token") {
        cookieSession = val;
        break;
      }
    }
  }
  return cookieSession;
}

/**
 * Core Authentication and Handshake Verification Middleware (Zero-Trust).
 *
 * Identity is established ONLY from a cryptographically verified token:
 *   1. A Microsoft Entra ID (SSO) RS256 JWT verified against Microsoft's JWKS.
 *   2. A locally-issued HS256 session JWT signed with JWT_SECRET.
 *
 * There is NO header-based identity fallback and NO self-provisioning of
 * users. If the token is missing/invalid, or no matching active user record
 * exists in the database, the request is rejected with 401/403.
 */
export async function authenticate(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<any> {
  const authHeader = req.headers.authorization;
  const cookieSession = readSessionCookie(req);

  let verifiedEmail: string | undefined;
  let verifiedUid: string | undefined;

  try {
    // 1. Bearer token (SSO Entra ID or local session JWT)
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.split(" ")[1];
      const decoded: any = jwt.decode(token, { complete: true });

      if (!decoded || !decoded.payload) {
        return res.status(401).json({ error: "Unauthorized: Malformed authentication token." });
      }

      const iss = decoded.payload.iss || "";
      if (iss.startsWith("https://login.microsoftonline.com") || iss.startsWith("https://sts.windows.net")) {
        // Microsoft Entra ID: verify signature against JWKS public certs.
        // Audience MUST be configured; without it any Microsoft-issued token
        // from any application would be accepted, so we refuse to proceed.
        const expectedAudience = process.env.MICROSOFT_PROVIDER_CLIENT_ID;
        if (!expectedAudience) {
          return res.status(500).json({
            error: "Server misconfiguration: MICROSOFT_PROVIDER_CLIENT_ID is required to validate SSO tokens."
          });
        }
        const verifiedToken = await new Promise<any>((resolve, reject) => {
          jwt.verify(
            token,
            getMicrosoftSigningKey,
            { algorithms: ["RS256"], audience: expectedAudience },
            (err, decodedToken) => {
              if (err) reject(err);
              else resolve(decodedToken);
            }
          );
        });
        verifiedEmail = verifiedToken.preferred_username || verifiedToken.email || verifiedToken.upn || verifiedToken.unique_name;
        verifiedUid = verifiedToken.oid || verifiedToken.sub;
      } else {
        // Local session token: enforce HS256 to prevent algorithm confusion.
        const verifiedToken = jwt.verify(token, LOCAL_JWT_SECRET as string, { algorithms: ["HS256"] }) as any;
        verifiedEmail = verifiedToken.email;
        verifiedUid = verifiedToken.uid || verifiedToken.id;
      }
    }
    // 2. HTTP-only cookie session token (local HS256)
    else if (cookieSession) {
      const verifiedToken = jwt.verify(cookieSession, LOCAL_JWT_SECRET as string, { algorithms: ["HS256"] }) as any;
      verifiedEmail = verifiedToken.email;
      verifiedUid = verifiedToken.uid || verifiedToken.id;
    }

    if (!verifiedUid && !verifiedEmail) {
      return res.status(401).json({
        error: "Unauthorized: A valid signed session or SSO token is required."
      });
    }

    // Resolve the user strictly from the database. No record => no access.
    let userDoc: any = null;
    if (verifiedUid) {
      userDoc = await getDocDirect("users", verifiedUid);
    }
    if (!userDoc && verifiedEmail) {
      const results = await getDocsDirect("users", [
        { type: "where", field: "email", op: "==", value: verifiedEmail.toLowerCase().trim() }
      ]);
      if (results && results.length > 0) {
        userDoc = results[0];
      }
    }

    if (!userDoc) {
      // Zero-trust: an authenticated token with no provisioned account is
      // rejected. Accounts must be created explicitly via registration or by
      // an administrator — never implicitly synthesized here.
      return res.status(403).json({
        error: "Forbidden: No active user profile is provisioned for this identity."
      });
    }

    if (userDoc.isDeactivated) {
      return res.status(403).json({
        error: "Forbidden: Your workforce account has been deactivated."
      });
    }

    // Resolve effective role strictly from the verified DB record.
    let computedRole = userDoc.role || "agent";
    let isAdminClaim = userDoc.is_admin === true;

    if (userDoc.roleId) {
      try {
        const roleDoc = await getDocDirect("roles", userDoc.roleId);
        if (roleDoc) {
          if (roleDoc.name === "admin" || roleDoc.is_admin === true || roleDoc.name === "SYSTEM_ADMIN") {
            computedRole = "SYSTEM_ADMIN";
            isAdminClaim = true;
          }
        }
      } catch (err) {
        console.error("[Auth Middleware] Failed looking up associated role doc:", err);
      }
    }

    if (computedRole === "admin" || computedRole === "SYSTEM_ADMIN" || isAdminClaim) {
      computedRole = "SYSTEM_ADMIN";
      isAdminClaim = true;
    }

    if (isServerBetaAutoAdminEnabled()) {
      computedRole = "SYSTEM_ADMIN";
      isAdminClaim = true;
    }

    req.user = {
      id: userDoc.id || verifiedUid,
      name: userDoc.name || "Default User",
      email: userDoc.email || verifiedEmail || "",
      role: computedRole,
      is_admin: isAdminClaim,
      tenantId: resolveUserTenantId(userDoc as Record<string, unknown>),
      dbRecord: userDoc
    };

    next();
  } catch (error: any) {
    console.error("[Authentication Core Failure]:", error?.message || error);
    return res.status(401).json({
      error: "Unauthorized: Signature validation or token parsing failed."
    });
  }
}

/**
 * Strict Role-Based Access Control Rule Middleware
 * @param allowedRolesArray Array of allowed role codes (e.g., ["SYSTEM_ADMIN", "team_lead"])
 */
export function requireRole(allowedRolesArray: string[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): any => {
    if (!req.user) {
      return res.status(401).json({
        error: "Unauthorized: Complete authentication handshake is required to verify permissions."
      });
    }

    const currentRole = req.user.role;

    // Admin-only endpoints require SYSTEM_ADMIN explicitly.
    if (allowedRolesArray.includes("SYSTEM_ADMIN") && currentRole !== "SYSTEM_ADMIN") {
      return res.status(403).json({
        error: "Forbidden: Strict Administrative access required. This transaction has been audited."
      });
    }

    if (!allowedRolesArray.includes(currentRole)) {
      return res.status(403).json({
        error: `Forbidden: Resource restricted. Allowed roles: [${allowedRolesArray.join(", ")}]. Current: ${currentRole}`
      });
    }

    next();
  };
}
