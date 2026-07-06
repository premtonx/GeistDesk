import { auth } from '../lib/firebase';
import { VaultItem } from '../types';
import { logAudit } from './auditService';

function authHeaders(): Record<string, string> {
  return { 'Content-Type': 'application/json' };
}

async function vaultFetch(input: RequestInfo, init?: RequestInit) {
  return fetch(input, { ...init, credentials: 'include', headers: { ...authHeaders(), ...(init?.headers as Record<string, string> | undefined) } });
}

async function parse(res: Response) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as any)?.error || `Vault request failed (${res.status})`);
  }
  return data;
}

export const vaultService = {
  /**
   * Create a secret. Shares are sent to the server which encrypts them with
   * AES-256-GCM and stores them in a separate collection. Plaintext content is
   * never persisted.
   */
  createItem: async (
    item: Omit<VaultItem, 'id' | 'createdAt' | 'createdBy' | 'isBurned'> & {
      content?: string;
      shares?: string[];
      passphrase?: string;
    }
  ) => {
    const user = auth.currentUser;
    if (!user) throw new Error('Not authenticated');

    const res = await vaultFetch('/api/vault/secrets', {
      method: 'POST',
      body: JSON.stringify({
        type: item.type,
        shares: item.shares || undefined,
        expirationType: item.expirationType,
        expiresAt: item.expiresAt instanceof Date ? item.expiresAt.toISOString() : item.expiresAt || null,
        maxViews: item.maxViews,
        passphrase: item.passphrase || undefined,
        metadata: item.metadata || {}
      })
    });
    const data = await parse(res);

    await logAudit({
      module: 'vault',
      action: 'VAULT_ITEM_CREATED',
      severity: 'medium',
      details: { itemId: data.id, type: item.type, expiration: item.expirationType, encryption: 'AES-256-GCM' }
    });

    return data.id as string;
  },

  /** Fetch non-sensitive metadata for a share link (no secret material). */
  getItem: async (id: string): Promise<VaultItem | null> => {
    try {
      const res = await fetch(`/api/vault/secrets/${encodeURIComponent(id)}`, {
        method: 'GET',
        headers: { Accept: 'application/json' },
      });
      if (res.status === 404) return null;
      const data = await res.json().catch(() => ({}));
      if (res.status === 410) {
        return { ...(data as VaultItem), id, isBurned: true };
      }
      if (!res.ok) return null;
      const item = data as VaultItem;
      if (item.isBurned) {
        return { ...item, id, isBurned: true };
      }
      return item;
    } catch (error) {
      console.error('[vaultService.getItem]', error);
      return null;
    }
  },

  /** List vault metadata for the signed-in user (PostgreSQL source of truth). */
  fetchHistory: async (): Promise<VaultItem[]> => {
    try {
      const res = await vaultFetch('/api/vault/history', {});
      if (!res.ok) return [];
      const data = await parse(res);
      return (data.items ?? []) as VaultItem[];
    } catch (error) {
      console.error('[vaultService.fetchHistory]', error);
      return [];
    }
  },

  /**
   * Reveal a secret once. The server returns decrypted shares (and content for
   * dropzones) and burns read-once secrets immediately.
   */
  revealItem: async (
    id: string,
    options?: { passphrase?: string; viewerEmail?: string },
  ): Promise<{
    shares: string[];
    content: string | null;
    preview?: boolean;
    viewCount?: number;
    maxViews?: number | null;
    burned?: boolean;
  } | null> => {
    try {
      const res = await fetch(`/api/vault/secrets/${encodeURIComponent(id)}/reveal`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-GeistDesk-Read-Intent': 'commit',
        },
        body: JSON.stringify({
          passphrase: options?.passphrase,
          viewerEmail: options?.viewerEmail,
        }),
      });
      if (res.status === 410 || res.status === 404) return null;
      const data = await parse(res);
      if (data.preview) {
        return { shares: [], content: null, preview: true };
      }
      await logAudit({ module: 'vault', action: 'VAULT_ITEM_ACCESSED', severity: 'low', details: { itemId: id } });
      return {
        shares: data.shares || [],
        content: data.content ?? null,
        viewCount: data.viewCount,
        maxViews: data.maxViews ?? null,
        burned: data.burned,
      };
    } catch (error) {
      console.error('[vaultService.revealItem]', error);
      return null;
    }
  },

  burnItem: async (id: string) => {
    try {
      await vaultFetch(`/api/vault/secrets/${encodeURIComponent(id)}/burn`, {
        method: 'POST',
        headers: authHeaders()
      });
      await logAudit({ module: 'vault', action: 'VAULT_ITEM_BURNED', severity: 'high', details: { itemId: id, trigger: 'Manual/Read' } });
    } catch (error) {
      console.error('[vaultService.burnItem]', error);
    }
  },

  /**
   * Permanently destroy a vault item. Secret material lives in a separate
   * server collection; burning it cryptographically erases the payload, which
   * is the strongest "delete" semantics the hardened pipeline exposes.
   */
  deleteItem: async (id: string) => {
    try {
      await vaultFetch(`/api/vault/secrets/${encodeURIComponent(id)}/burn`, {
        method: 'POST',
        headers: authHeaders()
      });
      await logAudit({ module: 'vault', action: 'VAULT_ITEM_BURNED', severity: 'high', details: { itemId: id, trigger: 'Delete' } });
    } catch (error) {
      console.error('[vaultService.deleteItem]', error);
    }
  },

  /** Upload encrypted content to a dropzone-style request item (authenticated owner path). */
  updateItem: async (id: string, updates: Partial<VaultItem>) => {
    const res = await vaultFetch(`/api/vault/secrets/${encodeURIComponent(id)}/content`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ content: updates.content, metadata: updates.metadata })
    });
    await parse(res);
    await logAudit({ module: 'vault', action: 'VAULT_ITEM_MODIFIED', severity: 'medium', details: { itemId: id } });
  },

  /** Public dropzone upload for inbound file receivers at /v/:id. */
  uploadDropzoneFile: async (
    id: string,
    payload: { content: string; fileName: string; fileSizeBytes: number },
  ): Promise<void> => {
    const res = await fetch(`/api/vault/secrets/${encodeURIComponent(id)}/upload`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    await parse(res);
  },

  /** Recover and download an uploaded dropzone payload for the authenticated owner. */
  downloadDropzoneFile: async (id: string): Promise<string> => {
    const res = await vaultFetch(`/api/vault/dropzones/download?id=${encodeURIComponent(id)}`, {
      method: 'GET',
      headers: authHeaders(),
    });

    if (res.status === 410) {
      const data = await res.json().catch(() => ({}));
      throw new Error(
        (data as { error?: string }).error ||
          'Uploaded file material was wiped by automated purge cycles.',
      );
    }

    if (res.status === 404) {
      const data = await res.json().catch(() => ({}));
      throw new Error((data as { error?: string }).error || 'Dropzone file not found.');
    }

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error((data as { error?: string }).error || `Download failed (${res.status})`);
    }

    const blob = await res.blob();
    const disposition = res.headers.get('Content-Disposition') || '';
    const fileNameMatch = disposition.match(/filename="?([^";]+)"?/i);
    const filename = fileNameMatch?.[1] ? decodeURIComponent(fileNameMatch[1]) : `dropzone-${id}.bin`;

    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.URL.revokeObjectURL(url);

    return filename;
  },

  /** Subscribe to vault history via PostgreSQL-backed API polling. */
  subscribeToHistory: (callback: (items: VaultItem[]) => void) => {
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | null = null;

    const refresh = async () => {
      if (cancelled) return;
      const user = auth.currentUser;
      if (!user) {
        callback([]);
        return;
      }
      const items = await vaultService.fetchHistory();
      if (!cancelled) callback(items);
    };

    void refresh();
    timer = setInterval(() => void refresh(), 15000);

    const onFocus = () => void refresh();
    if (typeof window !== 'undefined') {
      window.addEventListener('focus', onFocus);
    }

    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
      if (typeof window !== 'undefined') {
        window.removeEventListener('focus', onFocus);
      }
    };
  }
};
