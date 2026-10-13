import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { addDocDirect, getDocDirect, getDocsDirect, updateDocDirect } from '../../lib/postgres-backend.js';
import { decryptPayloadAuto } from '../../lib/crypto.js';
import type { AnyEncryptedPayload } from '../../lib/crypto-payload.js';
import { appendExchangeAuditLog } from '../../lib/exchange-audit-log.js';
import { getMcpActor, requireMcpScope } from '../context.js';
import { toolError, toolJson } from '../types.js';

const VAULT_ITEMS = 'vault_items';
const VAULT_SECRETS = 'vault_item_secrets';

function metadataOnly(item: Record<string, unknown>) {
  const meta = (item.metadata && typeof item.metadata === 'object' ? item.metadata : {}) as Record<
    string,
    unknown
  >;
  return {
    id: item.id,
    type: item.type ?? null,
    expirationType: item.expirationType ?? null,
    expiresAt: item.expiresAt ?? null,
    maxViews: item.maxViews ?? item.viewLimit ?? null,
    viewCount: item.viewCount ?? 0,
    isBurned: Boolean(item.isBurned) || item.is_active === false,
    burnedAt: item.burnedAt ?? null,
    createdAt: item.createdAt ?? null,
    createdBy: item.createdBy ?? null,
    metadata: {
      requestName: meta.requestName ?? null,
      secretType: meta.secretType ?? null,
      labels: meta.labels ?? meta.tags ?? null,
      description: meta.description ?? null,
      passphraseRequired: Boolean(item.passphraseHash || meta.passphraseEnabled),
    },
  };
}

function matchesQuery(item: Record<string, unknown>, query: string): boolean {
  const q = query.toLowerCase().trim();
  if (!q) return true;
  const meta = metadataOnly(item);
  const haystack = JSON.stringify({
    id: meta.id,
    type: meta.type,
    metadata: meta.metadata,
  }).toLowerCase();
  return haystack.includes(q);
}

export function registerVaultTools(server: McpServer): void {
  server.registerTool(
    'vault_search_secrets',
    {
      title: 'Search vault secrets (metadata)',
      description:
        'Search GeistExchange / vault secrets and return metadata + identifiers only. Never returns plaintext credentials.',
      inputSchema: {
        query: z.string().min(1).max(500).describe('Search string matched against secret metadata'),
      },
    },
    async ({ query }) => {
      const denied = requireMcpScope('vault:read');
      if (denied) return denied;
      const actor = getMcpActor();
      try {
        const constraints = actor.isAdmin
          ? []
          : [{ type: 'where', field: 'createdBy', op: '==', value: actor.userId }];
        const rows = await getDocsDirect(VAULT_ITEMS, constraints);
        const items = rows
          .filter((row) => matchesQuery(row as Record<string, unknown>, query))
          .map((row) => metadataOnly(row as Record<string, unknown>))
          .filter((item) => !item.isBurned)
          .slice(0, 40);

        return toolJson({
          query,
          count: items.length,
          items,
          note: 'Plaintext secrets are intentionally omitted. Use vault_get_secret with a reason to decrypt.',
        });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        return toolError(`vault_search_secrets failed: ${message}`);
      }
    },
  );

  server.registerTool(
    'vault_get_secret',
    {
      title: 'Reveal vault secret',
      description:
        'Decrypt a vault credential for the authenticated owner/admin. Requires a reason and writes an immutable audit event.',
      inputSchema: {
        id: z.string().min(1).max(200).describe('Vault item id'),
        reason: z
          .string()
          .min(3)
          .max(2000)
          .describe('Mandatory business reason for decrypting the secret (audit trail)'),
      },
    },
    async ({ id, reason }) => {
      const denied = requireMcpScope('vault:reveal');
      if (denied) return denied;
      const actor = getMcpActor();
      try {
        const item = await getDocDirect(VAULT_ITEMS, id);
        if (!item) return toolError(`Vault item not found: ${id}`);
        if (item.isBurned || item.is_active === false) {
          return toolError('This secret has already been burned or expired.');
        }

        const ownerId = String(item.createdBy || '');
        if (!actor.isAdmin && ownerId !== actor.userId) {
          return toolError('Forbidden: you can only reveal secrets you own (or as SYSTEM_ADMIN).');
        }

        let encryptedShares: AnyEncryptedPayload[] | null = null;
        let encryptedContent: AnyEncryptedPayload | null = null;
        if (item.secretRef) {
          const secretDoc = await getDocDirect(VAULT_SECRETS, String(item.secretRef));
          if (secretDoc) {
            encryptedShares = (secretDoc.encryptedShares as AnyEncryptedPayload[] | undefined) ?? null;
            encryptedContent = (secretDoc.encryptedContent as AnyEncryptedPayload | undefined) ?? null;
          }
        }

        if (!encryptedShares?.length && !encryptedContent) {
          return toolError('No decryptable secret material is stored for this item.');
        }

        const shares = encryptedShares ? encryptedShares.map((payload) => decryptPayloadAuto(payload)) : [];
        const content = encryptedContent ? decryptPayloadAuto(encryptedContent) : null;

        const nextViewCount = Number(item.viewCount || 0) + 1;
        const maxViews = Number(item.maxViews ?? item.viewLimit);
        const shouldBurn =
          item.expirationType === 'read' || (Number.isFinite(maxViews) && nextViewCount >= maxViews);
        const now = new Date().toISOString();

        await updateDocDirect(VAULT_ITEMS, id, {
          viewCount: nextViewCount,
          ...(shouldBurn ? { isBurned: true, is_active: false, burnedAt: now } : {}),
        });

        const auditMessage = `MCP vault reveal by ${actor.userEmail || actor.userId}: ${reason.trim()}`;
        void appendExchangeAuditLog({
          userId: ownerId || actor.userId,
          actorId: actor.userId,
          actorEmail: actor.userEmail,
          action: shouldBurn ? 'credential_burned' : 'secret_viewed',
          itemId: id,
          itemName: String(
            (item.metadata as Record<string, unknown> | undefined)?.requestName ||
              (item.metadata as Record<string, unknown> | undefined)?.secretType ||
              'Geheimnis',
          ),
          message: auditMessage,
        });

        await addDocDirect('audit_logs', {
          actorId: actor.userId,
          actorEmail: actor.userEmail,
          module: 'vault',
          action: 'VAULT_SECRET_REVEALED_MCP',
          severity: 'high',
          details: {
            itemId: id,
            reason: reason.trim(),
            burned: shouldBurn,
            via: 'mcp',
            tokenId: actor.tokenId ?? null,
          },
          timestamp: now,
          createdAt: now,
        });

        return toolJson({
          id,
          type: item.type ?? null,
          metadata: metadataOnly(item as Record<string, unknown>).metadata,
          content,
          shares,
          viewCount: nextViewCount,
          burned: shouldBurn,
          reason: reason.trim(),
          warning: 'Handle revealed credentials carefully. This access was permanently audited.',
        });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        return toolError(`vault_get_secret failed: ${message}`);
      }
    },
  );
}
