/**
 * Controllable demo-data seeder for GeistDesk (CLI + Admin Hub).
 *
 * Tags every row with `isDemoData: true` and stable ID prefixes so
 * `resetDemoData()` can wipe simulation rows without touching real tenant data.
 *
 * Idempotent: seed always purges prior demo rows first (unless skipIfPresent).
 */

import { encryptExchangeAtRest } from '../lib/crypto.js';
import { queryDb, setDocDirect } from '../lib/postgres-backend.js';
import { enqueueKbArticleIndex, deleteEmbeddingsForSource } from '../lib/ai/vector-queue.js';

export const DEMO_SIM_PREFIX = 'demo-sim';
export const DEMO_TICKET_PREFIX = 'tkt-demo-sim-';
export const DEMO_EXCHANGE_PREFIX = 'xchg-demo-sim-';
export const DEMO_VAULT_PREFIX = 'vault-demo-sim-';
export const DEMO_MESSAGE_PREFIX = 'msg-demo-sim-';
export const DEMO_KB_PREFIX = 'kb-demo-sim-';
export const DEMO_AUDIT_PREFIX = 'audit-demo-sim-';
export const DEMO_CATALOG_COLLECTION = 'geist_vault_simulation_catalog';

export interface DemoSeedOptions {
  actorUserId: string;
  actorName?: string;
  actorEmail?: string;
  tenantId?: string;
  /** Drop leftover onboarding/showcase tickets so dashboard KPIs stay clean. */
  replaceLegacySamples?: boolean;
  /** When true, do nothing if demo tickets already exist (boot path). */
  skipIfPresent?: boolean;
}

export interface DemoSeedResult {
  ok: true;
  skipped?: boolean;
  tickets: number;
  messages: number;
  kbArticles: number;
  vaultSecrets: number;
  exchangeSessions: number;
  auditEvents: number;
  personas: number;
  purged: number;
}

export interface DemoDataStatus {
  seeded: boolean;
  tickets: number;
  kbArticles: number;
  vaultSecrets: number;
  exchangeSessions: number;
}

interface DemoTicketSpec {
  id: string;
  subject: string;
  description: string;
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  /** Mapped to TicketPriority (`urgent` = Critical). */
  priority: 'low' | 'medium' | 'high' | 'urgent';
  team: 'support' | 'engineering' | 'legal';
  customerName: string;
  company: string;
  tags: string[];
  createdOffsetMs: number;
  resolutionTimeMinutes?: number;
  satisfactionRating?: 4 | 5;
  aiSuggestionUsed?: boolean;
  aiSuggestionsCount?: number;
  aiSummary?: string;
  aiSuggestedDraft?: string;
  aiInsights?: string[];
  originalLanguage?: string;
}

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

/** 7 diverse enterprise IT operations tickets. */
function buildTicketSpecs(): DemoTicketSpec[] {
  return [
    {
      id: `${DEMO_TICKET_PREFIX}001`,
      subject: 'VPN Connection timeout on Linux client after gateway upgrade',
      description:
        'After the WireGuard gateway upgrade to v1.0.20250515, Ubuntu 22.04 clients time out during handshake (handshake_timeout). Windows clients are unaffected. Affects the Berlin engineering VLAN.',
      status: 'in_progress',
      priority: 'high',
      team: 'engineering',
      customerName: 'Lena Hartmann',
      company: 'Nordlicht GmbH',
      tags: ['vpn', 'network', 'linux', 'wireguard'],
      createdOffsetMs: 6 * HOUR,
      aiSuggestionUsed: true,
      aiSuggestionsCount: 2,
      aiSummary:
        'Likely MTU / AllowedIPs regression after gateway upgrade. Compare peer configs and test with MTU 1280.',
      aiSuggestedDraft:
        'We are checking the WireGuard peer config on the upgraded gateway. Please try `wg-quick down wg0 && sudo ip link set mtu 1280 dev wg0` and reconnect.',
      aiInsights: ['Handshake timeout on Linux only', 'Gateway upgraded yesterday 18:00 UTC'],
      originalLanguage: 'en',
    },
    {
      id: `${DEMO_TICKET_PREFIX}002`,
      subject: 'Onboarding: Provision M365 license and hardware for new DevOps engineer',
      description:
        'Start date Monday. Need E5 license, Intune enrollment, YubiKey, and MacBook Pro 16" from the staging depot. Manager: Priya Nair (Atlas Robotics).',
      status: 'open',
      priority: 'medium',
      team: 'support',
      customerName: 'Priya Nair',
      company: 'Atlas Robotics',
      tags: ['onboarding', 'm365', 'access', 'hr'],
      createdOffsetMs: 3 * HOUR,
      aiSuggestionUsed: true,
      aiSuggestionsCount: 1,
      aiSummary: 'Standard M365 + hardware onboarding. SOP kb-demo-sim-001 applies.',
      aiSuggestedDraft:
        'Thanks — we will assign an E5 license, create the Intune profile, and schedule hardware pickup for Monday 09:00.',
      aiInsights: ['Start date Monday', 'E5 + YubiKey required'],
      originalLanguage: 'en',
    },
    {
      id: `${DEMO_TICKET_PREFIX}003`,
      subject: 'Critical: Proxmox node 02 unreachable via IPMI',
      description:
        'pve-node-02 (rack A2) does not respond to IPMI or SSH since 02:14 UTC. Ceph reports 1 OSD down. Cluster quorum still OK (3/3 remaining nodes).',
      status: 'in_progress',
      priority: 'urgent',
      team: 'engineering',
      customerName: 'Henrik Solberg',
      company: 'Fjord Analytics',
      tags: ['infrastructure', 'proxmox', 'ipmi', 'critical'],
      createdOffsetMs: 4 * HOUR,
      aiSuggestionUsed: true,
      aiSuggestionsCount: 3,
      aiSummary:
        'IPMI dead + OSD down suggests power or BMC fault. Escalate to DC tech for physical check; migrate VMs off node if possible.',
      aiSuggestedDraft:
        'We treat this as a P1 infrastructure incident. A DC technician is checking rack A2 power/BMC while we live-migrate critical VMs.',
      aiInsights: ['IPMI timeout', '1 OSD down', 'Quorum intact'],
      originalLanguage: 'en',
    },
    {
      id: `${DEMO_TICKET_PREFIX}004`,
      subject: 'Request: Temporary API token for staging pgvector sync',
      description:
        'Data platform needs a 72-hour scoped token to push staging embeddings into the pgvector schema `rag_staging`. No production DB access.',
      status: 'open',
      priority: 'medium',
      team: 'engineering',
      customerName: 'Daniel Cho',
      company: 'Atlas Robotics',
      tags: ['security', 'api', 'pgvector', 'staging'],
      createdOffsetMs: 2 * HOUR,
      aiSuggestionUsed: true,
      aiSuggestionsCount: 1,
      aiSummary: 'Issue short-lived scoped token; store in GeistExchange with 3-view burn limit.',
      aiSuggestedDraft:
        'We can issue a 72h staging-only token via GeistExchange. Please confirm the CIDR allow-list for the sync job.',
      aiInsights: ['72h TTL', 'staging schema only'],
      originalLanguage: 'en',
    },
    {
      id: `${DEMO_TICKET_PREFIX}005`,
      subject: 'Ollama embeddings timeout during KB backfill',
      description:
        'Nightly KB vector backfill fails with gateway timeout > 5s on `nomic-embed-text`. Queue depth stuck at 40.',
      status: 'resolved',
      priority: 'high',
      team: 'engineering',
      customerName: 'Chloe Bennett',
      company: 'Northwind Analytics',
      tags: ['ai', 'ollama', 'embeddings', 'kb'],
      createdOffsetMs: 2 * DAY,
      resolutionTimeMinutes: 47,
      satisfactionRating: 5,
      aiSuggestionUsed: true,
      aiSuggestionsCount: 2,
      aiSummary: 'Reduced chunk size and raised local embed timeout; queue drained.',
      aiSuggestedDraft: 'KB backfill completed. Embedding timeouts are resolved after chunk-size tuning.',
      aiInsights: ['Queue depth 40 → 0', 'Timeout 5s → mock fallback removed'],
      originalLanguage: 'en',
    },
    {
      id: `${DEMO_TICKET_PREFIX}006`,
      subject: 'Phishing report: fake Invoice PDF in shared mailbox',
      description:
        'finance@ reported a suspicious “Invoice-88421.pdf.exe” attachment. No clicks confirmed. Need quarantine + user guidance.',
      status: 'resolved',
      priority: 'high',
      team: 'support',
      customerName: 'Marc Lefevre',
      company: 'Lumière SAS',
      tags: ['security', 'phishing', 'email'],
      createdOffsetMs: 3 * DAY,
      resolutionTimeMinutes: 28,
      satisfactionRating: 5,
      aiSuggestionUsed: true,
      aiSuggestionsCount: 2,
      aiSummary: 'Quarantined message, revoked any accidental tokens, sent awareness blurb.',
      aiSuggestedDraft:
        'The message is quarantined. Please do not open the attachment. We published a short awareness note in GeistKB.',
      aiInsights: ['Attachment double extension', 'No credential use detected'],
      originalLanguage: 'en',
    },
    {
      id: `${DEMO_TICKET_PREFIX}007`,
      subject: 'Closed: Rotate expired Stripe webhook signing secret',
      description:
        'Production Stripe webhooks returned 401 after secret rotation in Dashboard was not mirrored to GeistDesk.',
      status: 'closed',
      priority: 'urgent',
      team: 'engineering',
      customerName: 'Elena Rossi',
      company: 'Helios Billing',
      tags: ['billing', 'stripe', 'webhook'],
      createdOffsetMs: 5 * DAY,
      resolutionTimeMinutes: 19,
      satisfactionRating: 4,
      aiSuggestionUsed: true,
      aiSuggestionsCount: 1,
      aiSummary: 'Updated vault item + inbound endpoint; replayed failed events.',
      aiSuggestedDraft: 'Stripe webhooks are healthy again. Failed events from the outage window were replayed.',
      aiInsights: ['whsec mismatch', 'Replay window 24h'],
      originalLanguage: 'en',
    },
    {
      id: `${DEMO_TICKET_PREFIX}008`,
      subject: 'Low: Update DNS resolver docs after WireGuard split-tunnel change',
      description:
        'Internal KB still lists the old 10.8.0.1 resolver. Split-tunnel now uses 10.9.0.53.',
      status: 'open',
      priority: 'low',
      team: 'support',
      customerName: 'Jonas Weber',
      company: 'Nordlicht GmbH',
      tags: ['docs', 'network', 'dns'],
      createdOffsetMs: 8 * HOUR,
      aiSuggestionUsed: false,
      aiSuggestionsCount: 0,
      aiSummary: 'Documentation drift after VPN change. Point to SOP kb-demo-sim-003.',
      aiSuggestedDraft: 'Thanks — we will refresh the WireGuard DNS section in GeistKB today.',
      aiInsights: ['Resolver 10.8.0.1 → 10.9.0.53'],
      originalLanguage: 'de',
    },
  ];
}

export const DEMO_VAULT_SECRETS = [
  {
    id: `${DEMO_VAULT_PREFIX}s3-backup`,
    label: 'Production Backup S3 Credentials',
    category: 'Cloud',
    tag: 'Backup',
    type: 'cloud',
    host: 's3.eu-central-1.amazonaws.com/geistdesk-prod-backups',
    username: 'AKIADDEMOBACKUP01',
    password: 's3-demo-backup-rotate-me',
    notes: 'Read/write key for nightly Postgres + object backups. Expires in 90 days.',
    expiresAtOffsetDays: 90,
  },
  {
    id: `${DEMO_VAULT_PREFIX}ldap-bind`,
    label: 'Internal LDAP / Active Directory Bind DN',
    category: 'Directory',
    tag: 'Identity',
    type: 'db',
    host: 'ldaps://dc01.corp.geistdesk.internal:636',
    username: 'CN=geistdesk-bind,OU=Service Accounts,DC=corp,DC=geistdesk,DC=internal',
    password: 'ldap-demo-bind-secret',
    notes: 'Service bind for group sync. Do not use for interactive login.',
    expiresAtOffsetDays: 180,
  },
  {
    id: `${DEMO_VAULT_PREFIX}rootca-staging`,
    label: 'Root CA Private Key Certificate (Staging)',
    category: 'Certificates',
    tag: 'PKI',
    type: 'api',
    host: 'pki-staging.geistdesk.internal',
    username: 'staging-root-ca',
    password: '-----BEGIN DEMO PRIVATE KEY-----\nMIIDemoOnlyNotRealKeyMaterial\n-----END DEMO PRIVATE KEY-----',
    notes: 'Staging-only root CA material for lab TLS. Never use in production.',
    expiresAtOffsetDays: 365,
  },
  {
    id: `${DEMO_VAULT_PREFIX}pgvector-staging`,
    label: 'Staging pgvector Sync Token',
    category: 'API Keys',
    tag: 'RAG',
    type: 'api',
    host: 'staging-api.geistdesk.internal/v1/embeddings',
    username: 'rag-staging-sync',
    password: 'gds_demo_stg_pgvector_72h',
    notes: 'Short-lived staging token mirrored for ticket tkt-demo-sim-004.',
    expiresAtOffsetDays: 3,
  },
] as const;

interface DemoKbArticleSpec {
  id: string;
  title: string;
  category: string;
  subCategory: string;
  content: string;
  tags: string[];
  indexInRag: boolean;
  status: 'Published' | 'Draft';
}

function buildKbArticles(authorId: string, tenantId: string): Array<DemoKbArticleSpec & Record<string, unknown>> {
  const now = new Date().toISOString();
  const articles: DemoKbArticleSpec[] = [
    {
      id: `${DEMO_KB_PREFIX}001`,
      title: 'Standard Operating Procedure: M365 User Provisioning & License Assignment',
      category: 'Operations',
      subCategory: 'Identity',
      tags: ['m365', 'onboarding', 'licenses'],
      indexInRag: true,
      status: 'Published',
      content: `
<h2>Purpose</h2>
<p>Provision Microsoft 365 identities, assign the correct SKU, and enroll devices in Intune for new joiners.</p>
<h2>Prerequisites</h2>
<ul>
  <li>Global Reader + License Administrator (or equivalent PIM role)</li>
  <li>Hardware depot ticket if a laptop is required</li>
  <li>Manager approval in the HR onboarding form</li>
</ul>
<h2>Procedure</h2>
<ol>
  <li>Create the Entra ID user in the correct OU / department group.</li>
  <li>Assign <strong>Microsoft 365 E5</strong> (or E3 + Defender add-on) via group-based licensing.</li>
  <li>Enable MFA and issue a YubiKey from GeistVault inventory.</li>
  <li>Create the Intune enrollment profile and ship hardware with BitLocker escrow verified.</li>
  <li>Notify the manager and close the onboarding ticket with the checklist attached.</li>
</ol>
<h2>Rollback</h2>
<p>Disable the account, revoke sessions, and reclaim the license within 24 hours if the start date slips.</p>
`.trim(),
    },
    {
      id: `${DEMO_KB_PREFIX}002`,
      title: 'Troubleshooting Bare-Metal Inference Latency & Ollama Memory Limits',
      category: 'AI Infrastructure',
      subCategory: 'Inference',
      tags: ['ollama', 'embeddings', 'latency'],
      indexInRag: true,
      status: 'Published',
      content: `
<h2>Symptoms</h2>
<p>Embedding or chat calls to the local Ollama node exceed 5s, or the process is OOM-killed during KB backfill.</p>
<h2>Checks</h2>
<ol>
  <li>Confirm <code>LOCAL_EMBEDDING_ENDPOINT</code> points at <code>host.docker.internal:8080</code> from containers.</li>
  <li>Inspect GPU/CPU memory: <code>ollama ps</code> and host <code>free -h</code>.</li>
  <li>Reduce chunk size to ~1.5k tokens for large SOP articles.</li>
  <li>Ensure only one heavy model is loaded; unload unused models with <code>ollama stop</code>.</li>
</ol>
<h2>Recovery</h2>
<p>Drain the vector queue, restart Ollama, and re-run Admin Hub → RAG → Index pending.</p>
`.trim(),
    },
    {
      id: `${DEMO_KB_PREFIX}003`,
      title: 'Internal WireGuard VPN Setup & DNS Resolver Configuration',
      category: 'Network',
      subCategory: 'VPN',
      tags: ['vpn', 'wireguard', 'dns'],
      indexInRag: true,
      status: 'Published',
      content: `
<h2>Client setup</h2>
<p>Import the peer config from GeistExchange. Linux clients must set MTU 1280 after gateway upgrades.</p>
<h2>DNS</h2>
<ul>
  <li>Split-tunnel resolver: <code>10.9.0.53</code></li>
  <li>Fallback corporate DNS: <code>10.0.0.53</code></li>
  <li>Do not use the legacy <code>10.8.0.1</code> address</li>
</ul>
<h2>Validation</h2>
<p><code>resolvectl query intranet.geistdesk.internal</code> should return an RFC1918 address via the tunnel.</p>
`.trim(),
    },
    {
      id: `${DEMO_KB_PREFIX}004`,
      title: 'Emergency Incident Response: Post-Quantum Secret Revocation Protocol',
      category: 'Security',
      subCategory: 'Incident Response',
      tags: ['security', 'pqc', 'revocation'],
      indexInRag: true,
      status: 'Published',
      content: `
<h2>When to use</h2>
<p>Suspected compromise of hybrid ML-KEM / classical secrets stored in GeistVault or GeistExchange.</p>
<h2>Immediate actions</h2>
<ol>
  <li>Declare a Sev-1 in the incident channel and freeze related vault folders.</li>
  <li>Rotate hybrid KEM encapsulations and AES-GCM content keys for affected items.</li>
  <li>Burn active GeistExchange links (<code>isBurned=true</code>) and invalidate download quotas.</li>
  <li>Revoke IdP sessions for impacted identities; force step-up MFA.</li>
  <li>Write the IR timeline into the audit log before closing the ticket.</li>
</ol>
`.trim(),
    },
    {
      id: `${DEMO_KB_PREFIX}005`,
      title: 'Draft: Staging pgvector sync runbook (WIP)',
      category: 'Operations',
      subCategory: 'RAG',
      tags: ['pgvector', 'staging', 'draft'],
      indexInRag: false,
      status: 'Draft',
      content: `
<h2>WIP</h2>
<p>Runbook for pushing staging embeddings into <code>rag_staging</code>. Not ready for production use.</p>
`.trim(),
    },
  ];

  return articles.map((article) => ({
    ...article,
    authorId,
    visibility: 'Private' as const,
    tenantId,
    language: 'en',
    views: article.status === 'Published' ? 12 + Math.floor(Math.random() * 40) : 0,
    helpfulCount: article.status === 'Published' ? 4 : 0,
    index_in_rag: article.indexInRag,
    inRag: article.indexInRag,
    isDemoData: true,
    source: 'demo-simulation',
    createdAt: now,
    updatedAt: now,
  }));
}

function isoFromOffset(offsetMs: number): string {
  return new Date(Date.now() - offsetMs).toISOString();
}

export async function getDemoDataStatus(): Promise<DemoDataStatus> {
  const result = await queryDb(
    `
    SELECT
      COUNT(*) FILTER (WHERE id LIKE $1)::int AS tickets,
      COUNT(*) FILTER (WHERE id LIKE $2)::int AS kb_articles,
      COUNT(*) FILTER (WHERE collection = $3)::int AS vault_catalog,
      COUNT(*) FILTER (WHERE id LIKE $4 AND collection = 'vault_items')::int AS exchange
    FROM geistdesk_documents
    WHERE id LIKE $1
       OR id LIKE $2
       OR collection = $3
       OR (id LIKE $4 AND collection = 'vault_items')
    `,
    [`${DEMO_TICKET_PREFIX}%`, `${DEMO_KB_PREFIX}%`, DEMO_CATALOG_COLLECTION, `${DEMO_EXCHANGE_PREFIX}%`],
  );
  const row = result.rows[0] as {
    tickets?: number;
    kb_articles?: number;
    vault_catalog?: number;
    exchange?: number;
  };
  const tickets = Number(row?.tickets || 0);
  const kbArticles = Number(row?.kb_articles || 0);
  const vaultSecrets = Number(row?.vault_catalog || 0) > 0 ? DEMO_VAULT_SECRETS.length : 0;
  const exchangeSessions = Number(row?.exchange || 0);
  return {
    seeded: tickets > 0 || kbArticles > 0 || vaultSecrets > 0 || exchangeSessions > 0,
    tickets,
    kbArticles,
    vaultSecrets,
    exchangeSessions,
  };
}

async function purgePreviousSimulation(replaceLegacySamples: boolean): Promise<number> {
  const kbIds = [
    `${DEMO_KB_PREFIX}001`,
    `${DEMO_KB_PREFIX}002`,
    `${DEMO_KB_PREFIX}003`,
    `${DEMO_KB_PREFIX}004`,
    `${DEMO_KB_PREFIX}005`,
  ];
  const ticketIds = buildTicketSpecs().map((t) => t.id);

  // Drop RAG vectors for demo KB + resolved demo tickets before document delete.
  for (const id of kbIds) {
    try {
      await deleteEmbeddingsForSource('default', 'KB_ARTICLE', id);
    } catch {
      /* table may be absent on fresh boots */
    }
  }
  for (const id of ticketIds) {
    try {
      await deleteEmbeddingsForSource('default', 'RESOLVED_TICKET', id);
    } catch {
      /* ignore */
    }
  }

  const result = await queryDb(
    `
    DELETE FROM geistdesk_documents
     WHERE id LIKE $1
        OR id LIKE $2
        OR id LIKE $3
        OR id LIKE $4
        OR id LIKE $5
        OR id LIKE $6
        OR collection LIKE $7
        OR collection = $8
        OR (data->>'isDemoData')::text = 'true'
        OR data->>'source' = 'demo-simulation'
        OR ($9::boolean AND (
             id LIKE 'tkt-sample-%'
          OR id LIKE 'tkt-seed-%'
          OR id LIKE 'kb-sample-%'
          OR collection LIKE 'tickets/tkt-sample-%/messages'
          OR collection LIKE 'tickets/tkt-seed-%/messages'
        ))
    `,
    [
      `${DEMO_TICKET_PREFIX}%`,
      `${DEMO_EXCHANGE_PREFIX}%`,
      `${DEMO_VAULT_PREFIX}%`,
      `${DEMO_MESSAGE_PREFIX}%`,
      `${DEMO_KB_PREFIX}%`,
      `${DEMO_AUDIT_PREFIX}%`,
      `tickets/${DEMO_TICKET_PREFIX}%/messages`,
      DEMO_CATALOG_COLLECTION,
      replaceLegacySamples,
    ],
  );
  return result.rowCount ?? 0;
}

async function seedTickets(specs: DemoTicketSpec[], opts: DemoSeedOptions): Promise<number> {
  const agentId = opts.actorUserId;
  const agentName = opts.actorName || 'Demo Agent';
  for (const spec of specs) {
    const createdAt = isoFromOffset(spec.createdOffsetMs);
    const resolutionMs = (spec.resolutionTimeMinutes ?? 0) * 60 * 1000;
    const resolvedAt =
      spec.status === 'resolved' || spec.status === 'closed'
        ? new Date(Date.parse(createdAt) + resolutionMs).toISOString()
        : undefined;
    await setDocDirect('tickets', spec.id, {
      id: spec.id,
      customId: `GD-SIM-${spec.id.slice(-3)}`,
      subject: spec.subject,
      description: spec.description,
      status: spec.status,
      priority: spec.priority,
      team: spec.team,
      channel: 'email',
      customerName: spec.customerName,
      company: spec.company,
      agentId: spec.status === 'open' ? null : agentId,
      agentName: spec.status === 'open' ? null : agentName,
      tags: spec.tags,
      tenantId: opts.tenantId || 'default',
      originalLanguage: spec.originalLanguage,
      createdAt,
      updatedAt: resolvedAt || createdAt,
      resolvedAt,
      closedAt: spec.status === 'closed' ? resolvedAt : undefined,
      resolutionTimeMinutes: spec.resolutionTimeMinutes,
      satisfactionRating: spec.satisfactionRating,
      aiSuggestionUsed: spec.aiSuggestionUsed === true,
      aiSuggestionsCount: spec.aiSuggestionsCount ?? 0,
      aiSentiment:
        spec.satisfactionRating ? 'positive' : spec.status === 'open' ? 'neutral' : 'positive',
      aiSummary: spec.aiSummary || null,
      aiSuggestedDraft: spec.aiSuggestedDraft || null,
      aiInsights: spec.aiInsights || [],
      source: 'demo-simulation',
      isDemoData: true,
    });
  }
  return specs.length;
}

async function seedConversationMessages(
  specs: DemoTicketSpec[],
  opts: DemoSeedOptions,
): Promise<number> {
  const byId = (suffix: string) => specs.find((t) => t.id === `${DEMO_TICKET_PREFIX}${suffix}`);
  const vpn = byId('001')!;
  const proxmox = byId('003')!;
  const token = byId('004')!;

  const threads: Array<{
    ticketId: string;
    messages: Array<{
      id: string;
      senderType: 'customer' | 'agent' | 'ai';
      senderName: string;
      content: string;
      originalContent: string;
      createdOffsetMs: number;
    }>;
  }> = [
    {
      ticketId: vpn.id,
      messages: [
        {
          id: `${DEMO_MESSAGE_PREFIX}vpn-1`,
          senderType: 'customer',
          senderName: 'Lena Hartmann',
          content:
            'After last night’s WireGuard gateway upgrade our Ubuntu clients fail the handshake. Windows is fine. Can you check AllowedIPs / MTU?',
          originalContent:
            'After last night’s WireGuard gateway upgrade our Ubuntu clients fail the handshake. Windows is fine. Can you check AllowedIPs / MTU?',
          createdOffsetMs: vpn.createdOffsetMs - 50 * 60 * 1000,
        },
        {
          id: `${DEMO_MESSAGE_PREFIX}vpn-2`,
          senderType: 'ai',
          senderName: 'Geist Assistant',
          content:
            'Draft solution: compare peer configs pre/post upgrade, force MTU 1280 on Linux, verify DNS resolver 10.9.0.53.',
          originalContent:
            'Draft solution: compare peer configs pre/post upgrade, force MTU 1280 on Linux, verify DNS resolver 10.9.0.53.',
          createdOffsetMs: vpn.createdOffsetMs - 45 * 60 * 1000,
        },
        {
          id: `${DEMO_MESSAGE_PREFIX}vpn-3`,
          senderType: 'agent',
          senderName: opts.actorName || 'Mara Voss',
          content:
            'Thanks — we reproduced the handshake timeout in the lab. Please try MTU 1280 while we roll a gateway config fix.',
          originalContent:
            'Thanks — we reproduced the handshake timeout in the lab. Please try MTU 1280 while we roll a gateway config fix.',
          createdOffsetMs: vpn.createdOffsetMs - 20 * 60 * 1000,
        },
      ],
    },
    {
      ticketId: proxmox.id,
      messages: [
        {
          id: `${DEMO_MESSAGE_PREFIX}pve-1`,
          senderType: 'customer',
          senderName: 'Henrik Solberg',
          content: 'pve-node-02 is dark on IPMI. Ceph shows one OSD down. Need Sev-1 handling.',
          originalContent: 'pve-node-02 is dark on IPMI. Ceph shows one OSD down. Need Sev-1 handling.',
          createdOffsetMs: proxmox.createdOffsetMs - 3 * HOUR,
        },
        {
          id: `${DEMO_MESSAGE_PREFIX}pve-2`,
          senderType: 'ai',
          senderName: 'Geist Assistant',
          content:
            'Suggested IR steps: confirm quorum, live-migrate VMs, dispatch DC tech for BMC/power, open bridge to Ceph on-call.',
          originalContent:
            'Suggested IR steps: confirm quorum, live-migrate VMs, dispatch DC tech for BMC/power, open bridge to Ceph on-call.',
          createdOffsetMs: proxmox.createdOffsetMs - 2.5 * HOUR,
        },
        {
          id: `${DEMO_MESSAGE_PREFIX}pve-3`,
          senderType: 'agent',
          senderName: opts.actorName || 'Mara Voss',
          content:
            'Sev-1 acknowledged. Quorum is healthy. DC tech ETA 25 minutes; we are migrating stateful VMs off node 02.',
          originalContent:
            'Sev-1 acknowledged. Quorum is healthy. DC tech ETA 25 minutes; we are migrating stateful VMs off node 02.',
          createdOffsetMs: proxmox.createdOffsetMs - HOUR,
        },
      ],
    },
    {
      ticketId: token.id,
      messages: [
        {
          id: `${DEMO_MESSAGE_PREFIX}tok-1`,
          senderType: 'customer',
          senderName: 'Daniel Cho',
          content:
            'Need a temporary API token for the staging pgvector sync job — 72 hours, staging schema only.',
          originalContent:
            'Need a temporary API token for the staging pgvector sync job — 72 hours, staging schema only.',
          createdOffsetMs: token.createdOffsetMs - 40 * 60 * 1000,
        },
        {
          id: `${DEMO_MESSAGE_PREFIX}tok-2`,
          senderType: 'agent',
          senderName: opts.actorName || 'Mara Voss',
          content:
            'Understood. We will place a burn-after-read token in GeistExchange (3 downloads max) once you confirm the egress CIDR.',
          originalContent:
            'Understood. We will place a burn-after-read token in GeistExchange (3 downloads max) once you confirm the egress CIDR.',
          createdOffsetMs: token.createdOffsetMs - 15 * 60 * 1000,
        },
      ],
    },
  ];

  let count = 0;
  for (const thread of threads) {
    for (const message of thread.messages) {
      const createdAt = isoFromOffset(message.createdOffsetMs);
      await setDocDirect(`tickets/${thread.ticketId}/messages`, message.id, {
        ticketId: thread.ticketId,
        senderId: message.senderType === 'customer' ? `cust-${thread.ticketId}` : opts.actorUserId,
        senderType: message.senderType,
        senderName: message.senderName,
        content: message.content,
        originalContent: message.originalContent,
        createdAt,
        updatedAt: createdAt,
        deliveryStatus: 'delivered',
        source: 'demo-simulation',
        isDemoData: true,
      });
      count += 1;
    }
  }
  return count;
}

async function seedKbArticles(opts: DemoSeedOptions): Promise<number> {
  const articles = buildKbArticles(opts.actorUserId, opts.tenantId || 'default');
  for (const article of articles) {
    await setDocDirect('kb_articles', article.id, article);
    if (article.status === 'Published' && article.indexInRag) {
      try {
        await enqueueKbArticleIndex(article.id, opts.tenantId || 'default');
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.warn(`[seedService] KB enqueue skipped for ${article.id}: ${message}`);
      }
    }
  }
  return articles.length;
}

async function seedVaultCatalog(): Promise<number> {
  const now = new Date().toISOString();
  const categories = [
    { id: 'cat-demo-sim-cloud', name: 'Cloud', slug: 'cloud', icon: 'cloud' },
    { id: 'cat-demo-sim-dir', name: 'Directory', slug: 'directory', icon: 'users' },
    { id: 'cat-demo-sim-pki', name: 'Certificates', slug: 'certificates', icon: 'shield' },
    { id: 'cat-demo-sim-api', name: 'API Keys', slug: 'api-keys', icon: 'key' },
  ];
  const credentials = DEMO_VAULT_SECRETS.map((item) => {
    const expiresAt = new Date(Date.now() + item.expiresAtOffsetDays * DAY).toISOString();
    return {
      id: item.id,
      type: item.type,
      label: item.label,
      username: item.username,
      encryptedPassword: item.password,
      host: item.host,
      notes: item.notes,
      expiresAt,
      updatedAt: Date.now(),
      lastModifiedBy: 'Demo Seeder',
      favorite: item.tag === 'Backup' || item.tag === 'PKI',
      vaultId: 'local',
      tags: [item.category, item.tag, 'simulation'],
      category: item.category,
      source: 'demo-simulation',
      isDemoData: true,
    };
  });

  await setDocDirect(DEMO_CATALOG_COLLECTION, 'global', {
    credentials,
    categories,
    createdAt: now,
    updatedAt: now,
    source: 'demo-simulation',
    isDemoData: true,
  });
  return credentials.length;
}

async function seedVaultAuditLogs(opts: DemoSeedOptions): Promise<number> {
  const events = [
    {
      id: `${DEMO_AUDIT_PREFIX}001`,
      action: 'vault.secret.view',
      target: `${DEMO_VAULT_PREFIX}s3-backup`,
      detail: 'Viewed Production Backup S3 Credentials metadata',
      offsetMs: 5 * HOUR,
    },
    {
      id: `${DEMO_AUDIT_PREFIX}002`,
      action: 'vault.secret.rotate',
      target: `${DEMO_VAULT_PREFIX}ldap-bind`,
      detail: 'Scheduled rotation reminder for LDAP bind DN',
      offsetMs: 2 * DAY,
    },
    {
      id: `${DEMO_AUDIT_PREFIX}003`,
      action: 'vault.secret.create',
      target: `${DEMO_VAULT_PREFIX}rootca-staging`,
      detail: 'Imported staging Root CA private key material (demo)',
      offsetMs: 4 * DAY,
    },
  ];

  for (const event of events) {
    const timestamp = isoFromOffset(event.offsetMs);
    await setDocDirect('audit_logs', event.id, {
      id: event.id,
      action: event.action,
      target: event.target,
      detail: event.detail,
      userId: opts.actorUserId,
      userEmail: opts.actorEmail || 'demo@geistdesk.com',
      timestamp,
      createdAt: timestamp,
      source: 'demo-simulation',
      isDemoData: true,
    });
  }
  return events.length;
}

async function seedExchangeSessions(opts: DemoSeedOptions): Promise<number> {
  const sessions = [
    {
      id: `${DEMO_EXCHANGE_PREFIX}pgvector-token`,
      content:
        'Staging pgvector sync token (72h)\nToken: gds_demo_stg_pgvector_72h\nScope: rag_staging only\nCIDR: pending confirmation',
      maxViews: 3,
      viewCount: 2, // 1 of 3 downloads remaining
      expirationType: 'quota' as const,
      expiresAt: new Date(Date.now() + 3 * DAY).toISOString(),
      metadata: {
        secretType: 'api-token',
        requestName: 'Staging pgvector sync token',
        description: 'Temporary API token for staging embeddings sync (1 of 3 downloads remaining).',
        relatedTicketId: `${DEMO_TICKET_PREFIX}004`,
        targetRecipient: 'daniel.cho@atlas.example',
        recipientEmails: ['daniel.cho@atlas.example'],
        downloadsRemaining: 1,
        autoDestruct: true,
      },
    },
    {
      id: `${DEMO_EXCHANGE_PREFIX}vpn-peer`,
      content:
        '[Interface]\nPrivateKey = DEMO_ONLY_PEER_KEY\nAddress = 10.9.20.14/32\nDNS = 10.9.0.53\n\n[Peer]\nPublicKey = DEMO_ONLY_GATEWAY\nEndpoint = vpn.geistdesk.example:51820\nAllowedIPs = 10.0.0.0/8',
      maxViews: 5,
      viewCount: 1,
      expirationType: 'time' as const,
      expiresAt: new Date(Date.now() + 2 * DAY).toISOString(),
      metadata: {
        secretType: 'config',
        requestName: 'WireGuard peer config — Lena Hartmann',
        description: 'Auto-destruct peer config after expiry or 5 downloads.',
        relatedTicketId: `${DEMO_TICKET_PREFIX}001`,
        targetRecipient: 'lena.hartmann@nordlicht.example',
        recipientEmails: ['lena.hartmann@nordlicht.example'],
        downloadsRemaining: 4,
        autoDestruct: true,
      },
    },
    {
      id: `${DEMO_EXCHANGE_PREFIX}ir-notes`,
      content:
        'Sev-1 bridge notes — pve-node-02\n- Quorum OK\n- DC tech dispatched\n- Do not reboot until BMC capture completes',
      maxViews: 10,
      viewCount: 3,
      expirationType: 'time' as const,
      expiresAt: new Date(Date.now() + 12 * HOUR).toISOString(),
      metadata: {
        secretType: 'incident-notes',
        requestName: 'Proxmox IR bridge notes',
        description: 'Transient IR notes with 12h auto-destruct.',
        relatedTicketId: `${DEMO_TICKET_PREFIX}003`,
        targetRecipient: opts.actorEmail || 'demo@geistdesk.com',
        recipientEmails: [opts.actorEmail || 'demo@geistdesk.com'],
        downloadsRemaining: 7,
        autoDestruct: true,
      },
    },
  ];

  for (const session of sessions) {
    const secretId = `${session.id}-secret`;
    const provenance = `exchange:${opts.actorUserId}:${session.id}`;
    await setDocDirect('vault_item_secrets', secretId, {
      createdBy: opts.actorUserId,
      createdAt: new Date().toISOString(),
      encryptedContent: encryptExchangeAtRest(session.content, provenance),
      isDemoData: true,
      source: 'demo-simulation',
    });
    await setDocDirect('vault_items', session.id, {
      type: 'secret',
      secretRef: secretId,
      expirationType: session.expirationType,
      expiresAt: session.expiresAt,
      maxViews: session.maxViews,
      viewCount: session.viewCount,
      isBurned: false,
      createdBy: opts.actorUserId,
      createdAt: new Date().toISOString(),
      metadata: session.metadata,
      source: 'demo-simulation',
      isDemoData: true,
    });
  }
  return sessions.length;
}

async function seedCustomPersonas(): Promise<number> {
  const extras = {
    tier3_technical_escalation: {
      skillsContent:
        '# Tier-3 Technical Escalation\n\nYou are a terse Tier-3 engineer. Lead with root cause, then the fix, then residual risk. Prefer German or English to match the customer. Never soften severity.',
      skillsFileName: 'tier3_technical_escalation.md',
    },
    friendly_billing_assistant: {
      skillsContent:
        '# Friendly Billing Assistant\n\nYou are a warm billing specialist. Explain invoices in plain language, never invent amounts, and offer the next concrete step. Mirror the customer language (DE/EN/FR).',
      skillsFileName: 'friendly_billing_assistant.md',
    },
  };

  const existing = await queryDb(
    `SELECT persona_skills_json FROM ai_orchestrator_config WHERE workspace_id = 'default' LIMIT 1`,
  );
  const current =
    existing.rows[0]?.persona_skills_json && typeof existing.rows[0].persona_skills_json === 'object'
      ? (existing.rows[0].persona_skills_json as Record<string, unknown>)
      : {};
  const merged = { ...current, ...extras };

  await queryDb(
    `INSERT INTO ai_orchestrator_config (workspace_id, persona_skills_json, created_by, updated_by, updated_at)
     VALUES ('default', $1::jsonb, 'demo-simulation', 'demo-simulation', NOW())
     ON CONFLICT (workspace_id) DO UPDATE
       SET persona_skills_json = $1::jsonb, updated_by = 'demo-simulation', updated_at = NOW()`,
    [JSON.stringify(merged)],
  );
  return Object.keys(extras).length;
}

/** Primary entry — used by CLI, Admin API, and optional boot seeding. */
export async function seedDemoData(options: DemoSeedOptions): Promise<DemoSeedResult> {
  if (options.skipIfPresent) {
    const status = await getDemoDataStatus();
    if (status.seeded) {
      return {
        ok: true,
        skipped: true,
        tickets: status.tickets,
        messages: 0,
        kbArticles: status.kbArticles,
        vaultSecrets: status.vaultSecrets,
        exchangeSessions: status.exchangeSessions,
        auditEvents: 0,
        personas: 0,
        purged: 0,
      };
    }
  }

  const replaceLegacySamples = options.replaceLegacySamples !== false;
  const purged = await purgePreviousSimulation(replaceLegacySamples);
  const specs = buildTicketSpecs();
  const tickets = await seedTickets(specs, options);
  const messages = await seedConversationMessages(specs, options);
  const kbArticles = await seedKbArticles(options);
  const vaultSecrets = await seedVaultCatalog();
  const auditEvents = await seedVaultAuditLogs(options);

  let exchangeSessions = 0;
  try {
    exchangeSessions = await seedExchangeSessions(options);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[seedService] Skipping GeistExchange sessions: ${message}`);
  }

  const personas = await seedCustomPersonas();
  return {
    ok: true,
    tickets,
    messages,
    kbArticles,
    vaultSecrets,
    exchangeSessions,
    auditEvents,
    personas,
    purged,
  };
}

/** Wipe only demo-tagged / demo-prefixed rows. */
export async function resetDemoData(options?: {
  replaceLegacySamples?: boolean;
}): Promise<{ ok: true; purged: number }> {
  const purged = await purgePreviousSimulation(options?.replaceLegacySamples !== false);
  return { ok: true, purged };
}

/** @deprecated Prefer seedDemoData — kept for existing CLI / onboarding imports. */
export async function seedDemoSimulation(options: DemoSeedOptions): Promise<DemoSeedResult> {
  return seedDemoData(options);
}

export function previewDemoSimulationKpis() {
  const specs = buildTicketSpecs();
  const resolved = specs.filter((s) => s.status === 'resolved' || s.status === 'closed');
  const total = specs.length;
  const avgMinutes =
    resolved.reduce((sum, spec) => sum + (spec.resolutionTimeMinutes || 0), 0) /
    Math.max(resolved.length, 1);
  const avgRating =
    resolved.reduce((sum, spec) => sum + (spec.satisfactionRating || 0), 0) /
    Math.max(resolved.length, 1);
  const aiSuggestions = specs.reduce((sum, spec) => sum + (spec.aiSuggestionsCount || 0), 0);
  return {
    tickets: total,
    resolved: resolved.length,
    open: total - resolved.length,
    resolutionRate: (resolved.length / total) * 100,
    avgResolutionMinutes: avgMinutes,
    csat: avgRating,
    aiSuggestions,
    kbArticles: 5,
    vaultSecrets: DEMO_VAULT_SECRETS.length,
    exchangeSessions: 3,
  };
}
