/**
 * Phase 5 — Multi-tenant Client Portal isolation & RBAC test suite.
 *
 * Fixtures:
 *   Hubcom SYSTEM_ADMIN
 *   Org A: CLIENT_ADMIN, CLIENT_SUPPORTER, CLIENT_USER
 *   Org B: CLIENT_ADMIN, CLIENT_USER
 *
 * Usage: npm run test:portal-isolation
 */

import {
  evaluateClientTicketVisibility,
  filterMessagesForClient,
  filterTicketsForClient,
  isInternalMessage,
  sanitizeTicketForClient,
  stripClientSpoofFields,
  ticketOrganizationId,
} from '../src/lib/client-portal/ticket-visibility.js';
import { enforceClientDbTicketAccess } from '../src/lib/client-portal/db-ticket-guard.js';
import {
  encryptEmailChannelSecret,
  decryptEmailChannelSecret,
  isEncryptedEmailSecret,
} from '../src/lib/email-ingestion/channel-secret-crypto.js';
import {
  channelBelongsToOrgOrGlobal,
  isHealthySendAsGraph,
  redactChannelSecrets,
} from '../src/lib/email-ingestion/channel-store.js';
import type { EmailChannelConfig } from '../src/lib/email-ingestion/types.js';
import { redactSecrets } from '../src/lib/safe-log.js';
import { isClientPortalRole } from '../src/lib/client-portal/roles.js';

process.env.EMAIL_CHANNEL_SECRET_KEY =
  process.env.EMAIL_CHANNEL_SECRET_KEY ||
  '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

let passed = 0;
let failed = 0;

function assert(condition: boolean, label: string, detail?: string): void {
  if (condition) {
    passed += 1;
    console.log(`  ✓ ${label}`);
  } else {
    failed += 1;
    console.error(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`);
  }
}

// ── Fixtures ──────────────────────────────────────────────────────────────

const ORG_A = 'org-a-aaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const ORG_B = 'org-b-bbbbbbbbbbbbbbbbbbbbbbbbbbbb';

const hubcomAdmin = {
  id: 'user-hubcom-admin',
  role: 'SYSTEM_ADMIN',
  organizationId: null as string | null,
};

const orgAAdmin = {
  id: 'user-a-admin',
  role: 'CLIENT_ADMIN',
  organizationId: ORG_A,
};

const orgASupporter = {
  id: 'user-a-supporter',
  role: 'CLIENT_SUPPORTER',
  organizationId: ORG_A,
};

const orgAUser = {
  id: 'user-a-user',
  role: 'CLIENT_USER',
  organizationId: ORG_A,
};

const orgAColleague = {
  id: 'user-a-colleague',
  role: 'CLIENT_USER',
  organizationId: ORG_A,
};

const orgBAdmin = {
  id: 'user-b-admin',
  role: 'CLIENT_ADMIN',
  organizationId: ORG_B,
};

const orgBUser = {
  id: 'user-b-user',
  role: 'CLIENT_USER',
  organizationId: ORG_B,
};

const ticketOrgA = {
  id: 'ticket-a-1',
  subject: 'Org A printer',
  organizationId: ORG_A,
  organization_id: ORG_A,
  requesterId: orgAUser.id,
  agentComments: [{ text: 'Hubcom internal note — never leak' }],
  internalNotes: 'private hubcom thread',
  aiSummary: 'secret diagnosis',
  aiInsights: ['do not show'],
  aiRootCause: 'hidden',
  aiChecklist: [{ task: 'x', completed: false }],
  aiSentiment: 'Angry',
  status: 'open',
};

const ticketOrgAColleague = {
  id: 'ticket-a-2',
  subject: 'Colleague only',
  organizationId: ORG_A,
  requesterId: orgAColleague.id,
  status: 'open',
};

const ticketOrgB = {
  id: 'ticket-b-1',
  subject: 'Org B VPN',
  organizationId: ORG_B,
  organization_id: ORG_B,
  requesterId: orgBUser.id,
  agentComments: [{ text: 'Org B hubcom note' }],
  internalNotes: 'b-internal',
  status: 'open',
};

const publicMsg = {
  id: 'm1',
  content: 'Hello from customer',
  is_internal: false,
  senderType: 'customer',
};

const internalMsg = {
  id: 'm2',
  content: 'Hubcom private note',
  is_internal: true,
  isInternal: true,
  senderType: 'agent',
};

const visibilityInternal = {
  id: 'm3',
  content: 'also internal',
  visibility: 'internal',
};

// ── Tests ─────────────────────────────────────────────────────────────────

function testCrossTenantBlock(): void {
  console.log('\n[1] Cross-tenant block (Org A ↔ Org B)');

  for (const actor of [orgAAdmin, orgASupporter, orgAUser]) {
    assert(
      evaluateClientTicketVisibility(actor, ticketOrgB) === false,
      `${actor.role} cannot view Org B ticket`,
    );
    assert(
      evaluateClientTicketVisibility(actor, ticketOrgB, { isParticipant: true }) === false,
      `${actor.role} cannot view Org B ticket even if participant flag spoofed`,
    );
  }

  assert(
    evaluateClientTicketVisibility(orgBAdmin, ticketOrgA) === false,
    'Org B CLIENT_ADMIN cannot view Org A ticket',
  );
  assert(
    evaluateClientTicketVisibility(orgAAdmin, ticketOrgA) === true,
    'Org A CLIENT_ADMIN can view Org A ticket',
  );
  assert(
    evaluateClientTicketVisibility(orgASupporter, ticketOrgA) === true,
    'Org A CLIENT_SUPPORTER can view Org A ticket',
  );
}

function testInternalNotesBlock(): void {
  console.log('\n[2] Internal notes never returned to CLIENT_* roles');

  const sanitized = sanitizeTicketForClient({ ...ticketOrgA });
  assert(!('agentComments' in sanitized), 'agentComments stripped');
  assert(!('internalNotes' in sanitized), 'internalNotes stripped');
  assert(!('aiSummary' in sanitized), 'aiSummary stripped');
  assert(!('aiInsights' in sanitized), 'aiInsights stripped');
  assert(!('aiRootCause' in sanitized), 'aiRootCause stripped');
  assert(!('aiChecklist' in sanitized), 'aiChecklist stripped');
  assert(!('aiSentiment' in sanitized), 'aiSentiment stripped');
  assert(sanitized.subject === ticketOrgA.subject, 'public subject preserved');

  assert(isInternalMessage(internalMsg) === true, 'is_internal detected');
  assert(isInternalMessage(visibilityInternal) === true, 'visibility=internal detected');
  assert(isInternalMessage(publicMsg) === false, 'public message not flagged');

  const filtered = filterMessagesForClient([
    publicMsg as any,
    internalMsg as any,
    visibilityInternal as any,
  ]);
  assert(filtered.length === 1 && filtered[0].id === 'm1', 'only public message remains');

  for (const role of ['CLIENT_ADMIN', 'CLIENT_SUPPORTER', 'CLIENT_USER']) {
    assert(isClientPortalRole(role), `${role} is a portal role`);
  }
}

async function testClientUserScoping(): Promise<void> {
  console.log('\n[3] CLIENT_USER scoping (requester ∪ participants)');

  assert(
    evaluateClientTicketVisibility(orgAUser, ticketOrgA) === true,
    'CLIENT_USER sees own requester ticket',
  );
  assert(
    evaluateClientTicketVisibility(orgAUser, ticketOrgAColleague) === false,
    'CLIENT_USER cannot see colleague ticket without participant',
  );
  assert(
    evaluateClientTicketVisibility(orgAUser, ticketOrgAColleague, {
      isParticipant: true,
    }) === true,
    'CLIENT_USER sees colleague ticket when in ticket_participants',
  );

  // filterTicketsForClient needs DB for participants — exercise org-wide path + requester.
  const filteredAdmin = await filterTicketsForClient(orgAAdmin, [
    ticketOrgA,
    ticketOrgAColleague,
    ticketOrgB,
  ] as any);
  assert(
    filteredAdmin.length === 2 &&
      filteredAdmin.every((t) => ticketOrganizationId(t) === ORG_A),
    'CLIENT_ADMIN list is org-scoped (no Org B)',
  );
  assert(
    filteredAdmin.every((t) => !('agentComments' in t) && !('internalNotes' in t)),
    'list sanitize strips Hubcom notes',
  );
}

async function testPrivilegeEscalation(): Promise<void> {
  console.log('\n[4] Privilege escalation & organization_id spoof block');

  const spoof = stripClientSpoofFields({
    organizationId: ORG_B,
    organization_id: ORG_B,
    role: 'SYSTEM_ADMIN',
    roleId: 'role-system-admin',
    is_admin: true,
    isAdmin: true,
    is_internal: true,
    status: 'closed',
    agentComments: [{ text: 'inject' }],
  });
  assert(spoof.organizationId === undefined, 'organizationId stripped');
  assert(spoof.organization_id === undefined, 'organization_id stripped');
  assert(spoof.role === undefined, 'role stripped');
  assert(spoof.is_admin === undefined, 'is_admin stripped');
  assert(spoof.is_internal === undefined, 'is_internal stripped');
  assert(spoof.agentComments === undefined, 'agentComments stripped from spoof');
  assert(spoof.status === 'closed', 'legitimate status preserved');

  const denyOtherUser = await enforceClientDbTicketAccess({
    user: { id: orgAAdmin.id, role: 'CLIENT_ADMIN', organizationId: ORG_A } as any,
    collection: 'users',
    action: 'update_doc',
    id: orgBAdmin.id,
    data: { role: 'SYSTEM_ADMIN', organizationId: ORG_A },
  });
  assert(denyOtherUser.ok === false, 'CLIENT_ADMIN cannot update Org B / other users via /api/db');

  const selfUpdate = await enforceClientDbTicketAccess({
    user: { id: orgAAdmin.id, role: 'CLIENT_ADMIN', organizationId: ORG_A } as any,
    collection: 'users',
    action: 'update_doc',
    id: orgAAdmin.id,
    data: { role: 'SYSTEM_ADMIN', organizationId: ORG_B, name: 'Hacker' },
  });
  assert(selfUpdate.ok === true, 'self update allowed after strip');
  assert(
    selfUpdate.ok === true &&
      selfUpdate.data &&
      selfUpdate.data.role === undefined &&
      selfUpdate.data.organizationId === undefined,
    'self update cannot set role or organizationId',
  );

  const crossTicketMutate = await enforceClientDbTicketAccess({
    user: { id: orgAAdmin.id, role: 'CLIENT_ADMIN', organizationId: ORG_A } as any,
    collection: 'tickets',
    action: 'update_doc',
    id: ticketOrgB.id,
    data: { status: 'closed', organizationId: ORG_A },
  });
  assert(
    crossTicketMutate.ok === true && crossTicketMutate.requireMutate === true,
    'ticket update signals requireMutate (router enforces live visibility)',
  );
  assert(
    crossTicketMutate.ok === true &&
      crossTicketMutate.data &&
      crossTicketMutate.data.organizationId === undefined,
    'ticket update cannot overwrite organizationId',
  );

  const denyDelete = await enforceClientDbTicketAccess({
    user: { id: orgAAdmin.id, role: 'CLIENT_ADMIN', organizationId: ORG_A } as any,
    collection: 'tickets',
    action: 'delete_doc',
    id: ticketOrgA.id,
  });
  assert(denyDelete.ok === false, 'CLIENT_ADMIN cannot delete tickets via /api/db');
}

function testSecretProtection(): void {
  console.log('\n[5] M365 client_secret encryption & API redaction');

  const plaintext = 'SuperSecret-ClientValue-9f3a';
  const encrypted = encryptEmailChannelSecret(plaintext);
  assert(isEncryptedEmailSecret(encrypted), 'secret encrypted with enc:v1 prefix');
  assert(!encrypted.includes(plaintext), 'ciphertext does not contain plaintext');
  assert(decryptEmailChannelSecret(encrypted) === plaintext, 'decrypt roundtrip');

  const channel = {
    id: 'ch-1',
    name: 'Org A Graph',
    email: 'it@kunde-a.de',
    connectionType: 'microsoft_graph',
    enabled: true,
    status: 'connected',
    clientSecret: encrypted,
    tenantId: 'tenant-a',
    clientId: 'client-a',
    organizationId: ORG_A,
    sendAsEnabled: true,
  } as EmailChannelConfig;

  const redacted = redactChannelSecrets(channel);
  assert(redacted.clientSecret === '••••••••', 'API returns masked secret');
  assert(redacted.hasClientSecret === true, 'hasClientSecret indicator set');
  assert(
    JSON.stringify(redacted).includes(plaintext) === false,
    'redacted payload has no plaintext secret',
  );
  assert(
    JSON.stringify(redacted).includes(encrypted) === false,
    'redacted payload has no ciphertext either',
  );

  const logLine = redactSecrets(
    `Graph auth failed client_secret=${plaintext} clientSecret=${plaintext}`,
  );
  assert(!logLine.includes(plaintext), 'safe-log redacts client_secret / clientSecret');
}

function testOutboundFallback(): void {
  console.log('\n[6] Outbound Send-As routing (org vs Hubcom fallback)');

  const orgAChannel: EmailChannelConfig = {
    id: 'ch-org-a',
    name: 'Org A',
    email: 'it@kunde-a.de',
    mailbox: 'it@kunde-a.de',
    connectionType: 'microsoft_graph',
    enabled: true,
    status: 'connected',
    organizationId: ORG_A,
    sendAsEnabled: true,
    lastTestOk: true,
  };

  const orgADisabled: EmailChannelConfig = {
    ...orgAChannel,
    id: 'ch-org-a-off',
    sendAsEnabled: false,
    status: 'failed',
  };

  const orgBChannel: EmailChannelConfig = {
    id: 'ch-org-b',
    name: 'Org B',
    email: 'it@kunde-b.de',
    mailbox: 'it@kunde-b.de',
    connectionType: 'microsoft_graph',
    enabled: true,
    status: 'connected',
    organizationId: ORG_B,
    sendAsEnabled: true,
    lastTestOk: true,
  };

  const hubcomGlobal: EmailChannelConfig = {
    id: 'ch-hubcom',
    name: 'Hubcom Support',
    email: 'hubcom.support@hubcom.de',
    mailbox: 'hubcom.support@hubcom.de',
    connectionType: 'microsoft_graph',
    enabled: true,
    status: 'connected',
    organizationId: null,
    lastTestOk: true,
  };

  assert(isHealthySendAsGraph(orgAChannel) === true, 'healthy org Send-As accepted');
  assert(isHealthySendAsGraph(orgADisabled) === false, 'disabled/failed org channel rejected');
  assert(isHealthySendAsGraph(hubcomGlobal) === true, 'Hubcom global Graph healthy');

  assert(
    channelBelongsToOrgOrGlobal(orgAChannel, ORG_A) === true,
    'Org A channel belongs to Org A',
  );
  assert(
    channelBelongsToOrgOrGlobal(orgBChannel, ORG_A) === false,
    'Org B channel must NOT be selected for Org A ticket',
  );
  assert(
    channelBelongsToOrgOrGlobal(hubcomGlobal, ORG_A) === true,
    'Hubcom global allowed as Org A fallback',
  );
  assert(
    channelBelongsToOrgOrGlobal(orgAChannel, null) === false,
    'Org channel not used for unscoped/global tickets',
  );
  assert(
    channelBelongsToOrgOrGlobal(hubcomGlobal, null) === true,
    'Hubcom global used for unscoped tickets',
  );

  // Simulate selection preference: healthy org → else hubcom → never foreign org.
  const candidatesForOrgA = [orgADisabled, orgBChannel, hubcomGlobal, orgAChannel];
  const preferred =
    candidatesForOrgA.find(
      (c) =>
        channelBelongsToOrgOrGlobal(c, ORG_A) &&
        isHealthySendAsGraph(c) &&
        (c.organizationId || c.organization_id) === ORG_A &&
        c.sendAsEnabled === true,
    ) ||
    candidatesForOrgA.find(
      (c) => channelBelongsToOrgOrGlobal(c, ORG_A) && !(c.organizationId || c.organization_id),
    );
  assert(preferred?.id === 'ch-org-a', 'Org A ticket prefers Org A Send-As channel');

  const whenOrgDisabled = [orgADisabled, orgBChannel, hubcomGlobal];
  const fallback =
    whenOrgDisabled.find(
      (c) =>
        channelBelongsToOrgOrGlobal(c, ORG_A) &&
        isHealthySendAsGraph(c) &&
        (c.organizationId || c.organization_id) === ORG_A &&
        c.sendAsEnabled === true,
    ) ||
    whenOrgDisabled.find(
      (c) =>
        channelBelongsToOrgOrGlobal(c, ORG_A) &&
        !(c.organizationId || c.organization_id) &&
        isHealthySendAsGraph(c),
    );
  assert(fallback?.id === 'ch-hubcom', 'falls back to Hubcom when Org A Send-As disabled');
  assert(fallback?.id !== 'ch-org-b', 'never falls back to Org B channel');
}

function testHubcomStaffBypass(): void {
  console.log('\n[7] Hubcom staff vs portal role helpers');
  assert(isClientPortalRole(hubcomAdmin.role) === false, 'SYSTEM_ADMIN is not a portal role');
  assert(
    evaluateClientTicketVisibility(
      { id: hubcomAdmin.id, role: hubcomAdmin.role, organizationId: null },
      ticketOrgA,
    ) === false,
    'evaluateClientTicketVisibility is portal-only (staff use other paths)',
  );
}

async function main(): Promise<void> {
  console.log('=== Client Portal Isolation & RBAC Suite (Phase 5) ===');
  testCrossTenantBlock();
  testInternalNotesBlock();
  await testClientUserScoping();
  await testPrivilegeEscalation();
  testSecretProtection();
  testOutboundFallback();
  testHubcomStaffBypass();

  console.log(`\nResults: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
  console.log('OK: client portal isolation suite passed.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
