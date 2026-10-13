/**
 * Native MCP (Model Context Protocol) endpoint — Streamable HTTP / SSE.
 * Mounted at /api/mcp. Authenticated via GeistDesk API tokens (gdk_*) or session JWT.
 */

import { randomUUID } from 'crypto';
import { Router, type Request, type Response } from 'express';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
import jwt from 'jsonwebtoken';
import { authenticate } from '../middleware/authMiddleware.js';
import { getDocDirect } from '../lib/postgres-backend.js';
import {
  ALL_MCP_SCOPES,
  hasScope,
  scopesForRole,
  verifyApiToken,
  type McpScope,
} from '../lib/api-tokens.js';
import { DEFAULT_MCP_SETTINGS, normalizeMcpSettings } from '../lib/mcp-config.js';
import { createGeistDeskMcpServer } from '../mcp/server.js';
import { mcpActorStore } from '../mcp/context.js';
import type { McpActorContext } from '../mcp/types.js';
import { safeLog } from '../lib/safe-log.js';

const router = Router();

const LOCAL_JWT_SECRET = process.env.JWT_SECRET as string;

type McpSession = {
  transport: StreamableHTTPServerTransport;
  actor: McpActorContext;
};

const sessions = new Map<string, McpSession>();

async function loadMcpSettings(): Promise<ReturnType<typeof normalizeMcpSettings>> {
  try {
    const doc = await getDocDirect('module_config', 'global');
    const mcp = (doc as { mcp?: Record<string, unknown> } | null)?.mcp;
    return normalizeMcpSettings(mcp);
  } catch {
    return { ...DEFAULT_MCP_SETTINGS };
  }
}

async function resolveActorFromRequest(req: Request): Promise<McpActorContext | null> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.slice('Bearer '.length).trim();
  if (!token) return null;

  const settings = await loadMcpSettings();

  // Prefer GeistDesk API tokens (gdk_…).
  if (token.startsWith('gdk_')) {
    const verified = await verifyApiToken(token);
    if (!verified) return null;
    if (!hasScope(verified.scopes, 'mcp:connect')) return null;

    let userDoc: Record<string, unknown> | null = null;
    try {
      userDoc = await getDocDirect('users', verified.userId);
    } catch {
      userDoc = null;
    }
    if (userDoc?.isDeactivated) return null;

    const role = verified.role || String(userDoc?.role || 'agent');
    const isAdmin = role === 'SYSTEM_ADMIN' || role === 'admin' || userDoc?.is_admin === true;

    return {
      userId: verified.userId,
      userEmail: verified.userEmail,
      userName: String(userDoc?.name || verified.userEmail || 'API Token'),
      role: isAdmin ? 'SYSTEM_ADMIN' : role,
      isAdmin,
      tenantId: verified.tenantId || 'default',
      scopes: verified.scopes,
      tokenId: verified.tokenId,
      authMethod: 'api_token',
      systemInstructions: settings.systemInstructions,
    };
  }

  // Fall back to local session JWT (same secret as cookie sessions).
  try {
    const verifiedToken = jwt.verify(token, LOCAL_JWT_SECRET, { algorithms: ['HS256'] }) as {
      email?: string;
      uid?: string;
      id?: string;
    };
    const verifiedUid = verifiedToken.uid || verifiedToken.id;
    const verifiedEmail = verifiedToken.email;
    let userDoc: any = null;
    if (verifiedUid) userDoc = await getDocDirect('users', verifiedUid);
    if (!userDoc && verifiedEmail) {
      // authenticate() already handles email lookup; keep MCP path lean.
      return null;
    }
    if (!userDoc || userDoc.isDeactivated) return null;

    let role = userDoc.role || 'agent';
    let isAdmin = userDoc.is_admin === true;
    if (userDoc.roleId) {
      try {
        const roleDoc = await getDocDirect('roles', userDoc.roleId);
        if (roleDoc && (roleDoc.name === 'admin' || roleDoc.is_admin === true || roleDoc.name === 'SYSTEM_ADMIN')) {
          role = 'SYSTEM_ADMIN';
          isAdmin = true;
        }
      } catch {
        /* ignore */
      }
    }
    if (role === 'admin' || role === 'SYSTEM_ADMIN' || isAdmin) {
      role = 'SYSTEM_ADMIN';
      isAdmin = true;
    }

    const tenantId =
      (typeof userDoc.tenantId === 'string' && userDoc.tenantId.trim()) ||
      (typeof userDoc.tenant_id === 'string' && userDoc.tenant_id.trim()) ||
      'default';

    return {
      userId: userDoc.id || verifiedUid!,
      userEmail: userDoc.email || verifiedEmail || '',
      userName: userDoc.name || 'User',
      role,
      isAdmin,
      tenantId,
      scopes: scopesForRole(role) as McpScope[],
      authMethod: 'session',
      systemInstructions: settings.systemInstructions,
    };
  } catch {
    return null;
  }
}

async function requireMcpEnabledAndAuth(
  req: Request,
  res: Response,
): Promise<McpActorContext | null> {
  const settings = await loadMcpSettings();
  if (!settings.enabled) {
    res.status(503).json({
      error: 'MCP server is disabled. Enable it in Admin Hub → Mail & Schnittstellen → API & MCP.',
    });
    return null;
  }

  const actor = await resolveActorFromRequest(req);
  if (!actor) {
    res.status(401).json({
      error: 'Unauthorized: Provide a GeistDesk API token (Bearer gdk_…) or a valid session JWT.',
    });
    return null;
  }
  if (!hasScope(actor.scopes, 'mcp:connect')) {
    res.status(403).json({ error: 'Forbidden: token lacks mcp:connect scope.' });
    return null;
  }

  // Stash on request for debugging / logging.
  (req as any).mcpActor = actor;
  (req as any).user = {
    id: actor.userId,
    email: actor.userEmail,
    name: actor.userName,
    role: actor.role,
    is_admin: actor.isAdmin,
    tenantId: actor.tenantId,
  };
  return actor;
}

async function handleMcpPost(req: Request, res: Response): Promise<void> {
  const actor = await requireMcpEnabledAndAuth(req, res);
  if (!actor) return;

  const sessionId = req.headers['mcp-session-id'] as string | undefined;

  try {
    await mcpActorStore.run(actor, async () => {
      let session = sessionId ? sessions.get(sessionId) : undefined;

      if (session) {
        // Bind actor for this request onto the existing session.
        session.actor = actor;
        await session.transport.handleRequest(req, res, req.body);
        return;
      }

      if (!sessionId && isInitializeRequest(req.body)) {
        const transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => randomUUID(),
          onsessioninitialized: (id) => {
            sessions.set(id, { transport, actor });
          },
        });

        transport.onclose = () => {
          const id = transport.sessionId;
          if (id) sessions.delete(id);
        };

        const server = createGeistDeskMcpServer();
        await server.connect(transport);
        await transport.handleRequest(req, res, req.body);
        return;
      }

      res.status(400).json({
        jsonrpc: '2.0',
        error: { code: -32000, message: 'Bad Request: No valid MCP session ID provided' },
        id: null,
      });
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    safeLog('error', '[MCP] POST handler failed', message);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: '2.0',
        error: { code: -32603, message: 'Internal MCP server error' },
        id: null,
      });
    }
  }
}

async function handleSessionRequest(req: Request, res: Response): Promise<void> {
  const actor = await requireMcpEnabledAndAuth(req, res);
  if (!actor) return;

  const sessionId = req.headers['mcp-session-id'] as string | undefined;
  const session = sessionId ? sessions.get(sessionId) : undefined;
  if (!session) {
    res.status(400).json({
      jsonrpc: '2.0',
      error: { code: -32000, message: 'Bad Request: No valid MCP session ID provided' },
      id: null,
    });
    return;
  }

  session.actor = actor;
  try {
    await mcpActorStore.run(actor, async () => {
      await session.transport.handleRequest(req, res);
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    safeLog('error', '[MCP] session request failed', message);
    if (!res.headersSent) {
      res.status(500).json({ error: 'MCP session request failed.' });
    }
  }
}

/** Health / discovery for admins (does not require MCP enabled). */
router.get('/status', authenticate, async (_req: Request, res: Response) => {
  const settings = await loadMcpSettings();
  return res.json({
    enabled: settings.enabled,
    endpoint: '/api/mcp',
    scopes: ALL_MCP_SCOPES,
    transport: 'streamable-http',
    activeSessions: sessions.size,
  });
});

router.post('/', (req, res) => {
  void handleMcpPost(req, res);
});
router.get('/', (req, res) => {
  void handleSessionRequest(req, res);
});
router.delete('/', (req, res) => {
  void handleSessionRequest(req, res);
});

export default router;
