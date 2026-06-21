import { db, auth } from '../lib/firebase';
import { collection, addDoc, serverTimestamp, getDocs, limit, query } from 'firebase/firestore';
import { OperationType, FirestoreErrorInfo } from '../types';

export type AuditModule = 'vault' | 'credentials' | 'insights' | 'tickets' | 'auth' | 'workforce' | 'rbac' | 'legal' | 'system';

export interface AuditPayload {
  module: AuditModule;
  action: string;
  details?: any;
  severity?: 'critical' | 'high' | 'medium' | 'low';
}

const generateMockSignature = (payload: any) => {
  // Simulate a cryptographic signature for UI authority
  const str = JSON.stringify(payload) + Date.now();
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return 'SIG-' + Math.abs(hash).toString(16).toUpperCase().padStart(12, '0');
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
    signature: generateMockSignature(payload),
    integrityCheck: true,
  };

  try {
    await addDoc(collection(db, 'audit_logs'), logData);
  } catch (error) {
    console.error("Failed to log audit action:", error);
  }
};

/**
 * Seeds audit logs dynamically for the logged-in user if empty.
 */
export const seedAuditLogsIfNeeded = async (userEmail: string, userId: string) => {
  try {
    const q = query(collection(db, 'audit_logs'), limit(1));
    const snapshot = await getDocs(q);
    if (!snapshot.empty) return; // already populated

    const mockLogs = [
      {
        actorId: userId,
        actorEmail: userEmail,
        module: 'rbac' as AuditModule,
        action: 'role_permissions_updated',
        severity: 'high' as const,
        details: { role: "agent", modifiedBy: "system_admin", rules: ["tickets.view", "tickets.edit", "insights.view"] }
      },
      {
        actorId: userId,
        actorEmail: userEmail,
        module: 'vault' as AuditModule,
        action: 'credential_retrieved',
        severity: 'medium' as const,
        details: { credentialId: "cred_091", keyName: "production-api-secret-key" }
      },
      {
        actorId: userId,
        actorEmail: userEmail,
        module: 'insights' as AuditModule,
        action: 'policy_activated',
        severity: 'low' as const,
        details: { policyName: "autonomous_remediation_vpn" }
      },
      {
        actorId: userId,
        actorEmail: userEmail,
        module: 'system' as AuditModule,
        action: 'database_migration_completed',
        severity: 'medium' as const,
        details: { version: "v2.0.4-sovereign", schema: "geistdesk_main" }
      },
      {
        actorId: userId,
        actorEmail: userEmail,
        module: 'legal' as AuditModule,
        action: 'guardrails_configured',
        severity: 'high' as const,
        details: { rulesActivated: ["anti_financial_commitment", "mandatory_ai_disclosure"] }
      }
    ];

    for (const log of mockLogs) {
      await addDoc(collection(db, 'audit_logs'), {
        ...log,
        timestamp: new Date(Date.now() - mockLogs.indexOf(log) * 3600000), // staggered times
        signature: generateMockSignature(log),
        integrityCheck: true
      });
    }
  } catch (error) {
    console.error("Failed to seed audit logs:", error);
  }
};

/**
 * Seeds compliance logs dynamically if empty.
 */
export const seedComplianceLogsIfNeeded = async () => {
  try {
    const q = query(collection(db, 'compliance_logs'), limit(1));
    const snapshot = await getDocs(q);
    if (!snapshot.empty) return; // already populated

    const mockCompliance = [
      {
        agentId: "agent_bruce",
        agentEmail: "agent_bruce@geistdesk.com",
        ticketId: "TKT-104",
        violatedRule: "Anti-Financial Commitment Policy (Rule #12): Agents are strictly prohibited from making specific, legally binding financial refund promises of more than $100 without manager approval.",
        draftContent: "I understand your frustration with the VPN downtime. I can promise you a full refund of $1,200 for this quarter's SLA violation. Please accept our apologies.",
        forbiddenText: "promise you a full refund of $1,200"
      },
      {
        agentId: "agent_sarah",
        agentEmail: "agent_sarah@geistdesk.com",
        ticketId: "TKT-239",
        violatedRule: "Mandatory AI Disclosure Rule (v1.1): Any AI-generated draft contents or automated agent assistance MUST contain a visible AI disclosure seal in the message footer.",
        draftContent: "Here is the solution to your firewall issue. Please verify ports 80 and 443 are open. Best regards, Support.",
        forbiddenText: "No visible AI disclosure signature found in footer"
      }
    ];

    for (const item of mockCompliance) {
      await addDoc(collection(db, 'compliance_logs'), {
        ...item,
        timestamp: new Date(Date.now() - mockCompliance.indexOf(item) * 7200000) // staggered times
      });
    }
  } catch (error) {
    console.error("Failed to seed compliance logs:", error);
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
