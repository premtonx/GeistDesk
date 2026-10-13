import { addDocDirect, getDocsDirect } from './postgres-backend.js';

export const EXCHANGE_AUDIT_LOG = 'exchange_audit_log';

export type ExchangeAuditAction =
  | 'secret_created'
  | 'secret_viewed'
  | 'credential_burned'
  | 'dropzone_uploaded'
  | 'dropzone_created'
  | 'ai_analysis_completed'
  | 'item_deleted';

export interface ExchangeAuditEntry {
  id?: string;
  userId: string;
  actorId: string;
  actorEmail?: string;
  action: ExchangeAuditAction;
  itemId?: string;
  itemName?: string;
  message: string;
  createdAt: string;
}

export async function appendExchangeAuditLog(entry: Omit<ExchangeAuditEntry, 'id' | 'createdAt'>): Promise<void> {
  try {
    await addDocDirect(EXCHANGE_AUDIT_LOG, {
      ...entry,
      createdAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[exchange-audit] Failed to append log entry', err);
  }
}

export async function listExchangeAuditLog(userId: string, limit = 20): Promise<ExchangeAuditEntry[]> {
  const rows = await getDocsDirect(EXCHANGE_AUDIT_LOG, [
    { type: 'where', field: 'userId', op: '==', value: userId },
  ]);

  return rows
    .map((row) => ({
      id: row.id,
      userId: row.userId,
      actorId: row.actorId,
      actorEmail: row.actorEmail,
      action: row.action,
      itemId: row.itemId,
      itemName: row.itemName,
      message: row.message,
      createdAt: row.createdAt,
    }))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, limit);
}
