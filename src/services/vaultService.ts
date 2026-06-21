import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot
} from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { getSessionToken } from 'firebase/auth';
import { VaultItem, OperationType } from '../types';
import { handleFirestoreError } from '../lib/firebase';
import { logAudit } from './auditService';

const VAULT_COLLECTION = 'vault_items';

function authHeaders(): Record<string, string> {
  const token = getSessionToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  };
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
    item: Omit<VaultItem, 'id' | 'createdAt' | 'createdBy' | 'isBurned'> & { content?: string }
  ) => {
    const user = auth.currentUser;
    if (!user) throw new Error('Not authenticated');

    const res = await fetch('/api/vault/secrets', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({
        type: item.type,
        shares: item.shares || undefined,
        expirationType: item.expirationType,
        expiresAt: item.expiresAt instanceof Date ? item.expiresAt.toISOString() : item.expiresAt || null,
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
      const res = await fetch(`/api/vault/secrets/${encodeURIComponent(id)}`);
      if (res.status === 404) return null;
      const data = await parse(res);
      return data as VaultItem;
    } catch (error) {
      console.error('[vaultService.getItem]', error);
      return null;
    }
  },

  /**
   * Reveal a secret once. The server returns decrypted shares (and content for
   * dropzones) and burns read-once secrets immediately.
   */
  revealItem: async (id: string): Promise<{ shares: string[]; content: string | null } | null> => {
    try {
      const res = await fetch(`/api/vault/secrets/${encodeURIComponent(id)}/reveal`, { method: 'POST' });
      if (res.status === 410 || res.status === 404) return null;
      const data = await parse(res);
      await logAudit({ module: 'vault', action: 'VAULT_ITEM_ACCESSED', severity: 'low', details: { itemId: id } });
      return { shares: data.shares || [], content: data.content ?? null };
    } catch (error) {
      console.error('[vaultService.revealItem]', error);
      return null;
    }
  },

  burnItem: async (id: string) => {
    try {
      await fetch(`/api/vault/secrets/${encodeURIComponent(id)}/burn`, {
        method: 'POST',
        headers: authHeaders()
      });
      await logAudit({ module: 'vault', action: 'VAULT_ITEM_BURNED', severity: 'high', details: { itemId: id, trigger: 'Manual/Read' } });
    } catch (error) {
      console.error('[vaultService.burnItem]', error);
    }
  },

  /** Upload encrypted content to a dropzone-style request item. */
  updateItem: async (id: string, updates: Partial<VaultItem>) => {
    const res = await fetch(`/api/vault/secrets/${encodeURIComponent(id)}/content`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ content: updates.content, metadata: updates.metadata })
    });
    await parse(res);
    await logAudit({ module: 'vault', action: 'VAULT_ITEM_MODIFIED', severity: 'medium', details: { itemId: id } });
  },

  /** List the current user's vault items (metadata only; no secret material). */
  subscribeToHistory: (callback: (items: VaultItem[]) => void) => {
    const user = auth.currentUser;
    if (!user) return () => {};

    const q = query(
      collection(db, VAULT_COLLECTION),
      where('createdBy', '==', user.uid),
      orderBy('createdAt', 'desc')
    );

    return onSnapshot(q, (snap) => {
      const items = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }) as VaultItem);
      callback(items);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, VAULT_COLLECTION);
    });
  }
};
