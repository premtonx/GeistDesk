import { db, auth } from '../lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { OperationType, FirestoreErrorInfo } from '../types';

export type AuditModule = 'vault' | 'credentials' | 'insights' | 'tickets' | 'auth' | 'workforce' | 'rbac' | 'legal' | 'system';

export interface AuditPayload {
  module: AuditModule;
  action: string;
  details?: any;
  severity?: 'critical' | 'high' | 'medium' | 'low';
}

/**
 * Deterministic content fingerprint of the log record. This is NOT a
 * server-issued cryptographic signature — it is a client-side checksum so the
 * UI can reference a stable per-record identifier. Real integrity verification
 * must be performed server-side (see /api/admin audit routes).
 */
const generateLogFingerprint = (payload: AuditPayload): string => {
  const str = JSON.stringify({ ...payload, actorId: null, actorEmail: null });
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return 'FP-' + Math.abs(hash).toString(16).toUpperCase().padStart(12, '0');
};

export const logAudit = async (payload: AuditPayload) => {
  const user = auth.currentUser;
  if (!user) return;

  const logData = {
    actorId: user.uid,
    actorEmail: user.email,
    module: payload.module,
    action: payload.action,
    details: payload.details || {},
    timestamp: serverTimestamp(),
    severity: payload.severity || 'low',
    signature: generateLogFingerprint(payload),
  };

  try {
    await addDoc(collection(db, 'audit_logs'), logData);
  } catch (error) {
    console.error("Failed to log audit action:", error);
  }
};

export const handleFirestoreError = (error: unknown, operationType: OperationType, path: string | null) => {
  const user = auth.currentUser;
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: user?.uid,
      email: user?.email,
      emailVerified: user?.emailVerified,
      isAnonymous: user?.isAnonymous,
      tenantId: user?.tenantId,
      providerInfo: user?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  
  console.error("Firestore Error:", JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
};
