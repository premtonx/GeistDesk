/**
 * Opt-in production-simulation seeder for GeistDesk.
 * Idempotent: deletes previous demo-sim rows, then upserts the same IDs.
 * Never runs on container boot unless ENABLE_DEMO_LOGIN (non-production)
 * or an admin explicitly calls POST /api/demo/seed / `npm run seed:demo`.
 */

import { encryptExchangeAtRest } from './crypto.js';
import { queryDb, setDocDirect } from './postgres-backend.js';

export const DEMO_SIM_PREFIX = 'demo-sim';
export const DEMO_TICKET_PREFIX = 'tkt-demo-sim-';
export const DEMO_EXCHANGE_PREFIX = 'xchg-demo-sim-';
export const DEMO_VAULT_PREFIX = 'vault-demo-sim-';
export const DEMO_MESSAGE_PREFIX = 'msg-demo-sim-';
export const DEMO_CATALOG_COLLECTION = 'geist_vault_simulation_catalog';

export interface DemoSimulationSeedOptions {
  actorUserId: string;
  actorName?: string;
  actorEmail?: string;
  tenantId?: string;
  /** Drop leftover onboarding/showcase tickets so dashboard KPIs stay clean. */
  replaceLegacySamples?: boolean;
}

export interface DemoSimulationSeedResult {
  tickets: number;
  messages: number;
  vaultSecrets: number;
  exchangeSessions: number;
  personas: number;
  purged: number;
}

interface DemoTicketSpec {
  id: string;
  subject: string;
  description: string;
  status: 'resolved' | 'closed' | 'open';
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

const RESOLUTION_MINUTES = [18, 22, 31, 14, 27, 35, 19, 24, 33, 16, 29, 12, 38, 21, 26, 24, 23, 17] as const;
const SATISFACTION: Array<4 | 5> = [5, 5, 5, 5, 5, 5, 5, 5, 4, 5, 5, 5, 5, 5, 4, 5, 5, 5];
const AI_COUNTS = [3, 3, 3, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 3];

const RESOLVED_SPECS: Array<Omit<DemoTicketSpec, 'id' | 'createdOffsetMs' | 'resolutionTimeMinutes' | 'satisfactionRating' | 'aiSuggestionUsed' | 'aiSuggestionsCount'>> = [
  {
    subject: 'VPN-Tunnel bricht nach IKE-Rekey ab',
    description: 'Enterprise-Kunde: Site-to-Site VPN trennt sich alle 8 Minuten im Engineering-Subnetz.',
    status: 'resolved',
    priority: 'high',
    team: 'engineering',
    customerName: 'Lena Hartmann',
    company: 'Nordlicht GmbH',
    tags: ['vpn', 'network'],
    aiSummary: 'IKE-Rekey-Timer nach Firewall-Update zu aggressiv; Timer auf 60 Minuten gesetzt.',
    aiSuggestedDraft: 'Wir haben den IKE-Rekey-Timer angepasst. Bitte testen Sie den Tunnel erneut.',
    aiInsights: ['Rekey-Intervall 8 Min.', 'Nur Subnetz 10.20.0.0/16 betroffen'],
    originalLanguage: 'de',
  },
  {
    subject: 'SSO login loop after Entra Conditional Access change',
    description: 'Users bounce between the IdP and GeistDesk after a new device-compliance policy.',
    status: 'resolved',
    priority: 'urgent',
    team: 'support',
    customerName: 'James Whitaker',
    company: 'Northwind Analytics',
    tags: ['sso', 'entra'],
    aiSummary: 'Conditional Access blocked the OIDC redirect URI. Allow-listed the production callback.',
    aiSuggestedDraft: 'The Entra policy now allows the GeistDesk redirect URI. Please retry SSO.',
    aiInsights: ['Redirect URI mismatch', 'Policy applied to all cloud apps'],
    originalLanguage: 'en',
  },
  {
    subject: 'Latence webhook Postal > 12s',
    description: 'Les webhooks inbound mettent plus de 12 secondes avant d’arriver dans GeistDesk.',
    status: 'resolved',
    priority: 'high',
    team: 'engineering',
    customerName: 'Camille Dupont',
    company: 'Lumière SAS',
    tags: ['webhook', 'mail'],
    aiSummary: 'Postal worker queue backed up; scaled inbound workers and raised timeout.',
    aiSuggestedDraft: 'Nous avons augmenté les workers Postal. La latence est revenue sous 800 ms.',
    aiInsights: ['Queue depth 240', 'p95 12.4s → 0.7s'],
    originalLanguage: 'fr',
  },
  {
    subject: 'Invoice PDF missing from customer portal',
    description: 'August invoices do not render for EU accounts using the S3 archive.',
    status: 'resolved',
    priority: 'medium',
    team: 'support',
    customerName: 'Mira Patel',
    company: 'Helios Billing',
    tags: ['billing', 's3'],
    aiSummary: 'Archive bucket IAM key expired. Rotated the read-only key and backfilled index.',
    aiSuggestedDraft: 'The invoice archive key was rotated. PDFs are available again.',
    aiInsights: ['AccessDenied on GET', 'Key last rotated 90 days ago'],
    originalLanguage: 'en',
  },
  {
    subject: 'KI-Antworten in falscher Sprache',
    description: 'Agent sieht englische Entwürfe obwohl die Kundensprache Deutsch ist.',
    status: 'resolved',
    priority: 'medium',
    team: 'support',
    customerName: 'Tobias Krüger',
    company: 'Nordlicht GmbH',
    tags: ['polyglot', 'ai'],
    aiSummary: 'Polyglot target language defaulted to EN. Pinned DE for the workspace.',
    aiSuggestedDraft: 'Die Polyglot-Brücke übersetzt jetzt wieder nach Deutsch.',
    aiInsights: ['Default target EN', 'Dictionary hit rate 62%'],
    originalLanguage: 'de',
  },
  {
    subject: 'Stripe webhook signature rejected',
    description: 'Checkout completed events fail HMAC verification in production.',
    status: 'closed',
    priority: 'urgent',
    team: 'engineering',
    customerName: 'Elena Rossi',
    company: 'Helios Billing',
    tags: ['stripe', 'billing'],
    aiSummary: 'Rotated signing secret was not updated on the inbound endpoint.',
    aiSuggestedDraft: 'Please retry the failed Stripe events — the new signing secret is live.',
    aiInsights: ['whsec mismatch', 'Replay window 24h'],
    originalLanguage: 'en',
  },
  {
    subject: 'Ollama embeddings timeout on KB ingest',
    description: 'Large SOP articles fail vector backfill with 60s gateway timeout.',
    status: 'resolved',
    priority: 'high',
    team: 'engineering',
    customerName: 'Priya Nair',
    company: 'Atlas Robotics',
    tags: ['kb', 'embeddings'],
    aiSummary: 'Chunk size 8k exceeded local context. Split to 1.5k tokens and retried.',
    aiSuggestedDraft: 'KB ingest completed after reducing chunk size. Coverage is back to 94%.',
    aiInsights: ['Timeout at 60s', '1536-dim nomic-embed-text'],
    originalLanguage: 'en',
  },
  {
    subject: 'Dropzone upload rejected as malware false positive',
    description: 'Customer cannot send firewall logs; ClamAV flags a packet capture.',
    status: 'resolved',
    priority: 'medium',
    team: 'support',
    customerName: 'Jonas Weber',
    company: 'Nordlicht GmbH',
    tags: ['exchange', 'dropzone'],
    aiSummary: 'PCAP heuristic too strict. Allow-listed .pcapng for this tenant dropzone.',
    aiSuggestedDraft: 'You can re-upload the packet capture. The false positive is cleared.',
    aiInsights: ['Heuristic HEUR/PCAP', 'Tenant allow-list'],
    originalLanguage: 'de',
  },
  {
    subject: 'CSAT survey not sent after resolve',
    description: 'Resolved tickets last week never triggered the 4-hour CSAT mail.',
    status: 'resolved',
    priority: 'low',
    team: 'support',
    customerName: 'Sofia Álvarez',
    company: 'Iberia Cloud',
    tags: ['csat', 'mail'],
    aiSummary: 'Outbound From domain unverified. DKIM published and survey job unblocked.',
    aiSuggestedDraft: 'CSAT surveys are sending again. Sorry for the gap last week.',
    aiInsights: ['DKIM missing', 'Job parked 47 tickets'],
    originalLanguage: 'es',
  },
  {
    subject: 'Read-replica lag on reporting dashboard',
    description: 'Executive dashboard shows stale ticket counts (5–8 minutes behind).',
    status: 'resolved',
    priority: 'high',
    team: 'engineering',
    customerName: 'Henrik Solberg',
    company: 'Fjord Analytics',
    tags: ['postgres', 'replica'],
    aiSummary: 'Replica apply lag from a long VACUUM. Tuned autovacuum and replayed WAL.',
    aiSuggestedDraft: 'Replica lag is back under 2 seconds. Dashboard numbers are live.',
    aiInsights: ['apply_lag 7m', 'autovacuum scale factor'],
    originalLanguage: 'en',
  },
  {
    subject: 'Teams bot silent after certificate rotation',
    description: 'MicrosoftAppPassword expired; inbound Teams messages are dropped.',
    status: 'resolved',
    priority: 'high',
    team: 'support',
    customerName: 'Aisha Rahman',
    company: 'Northwind Analytics',
    tags: ['teams', 'bot'],
    aiSummary: 'Rotated bot secret in Azure and updated the vault item.',
    aiSuggestedDraft: 'The Teams bot is online again. Please resend the last message.',
    aiInsights: ['401 from Bot Framework', 'Secret expired 2026-08-18'],
    originalLanguage: 'en',
  },
  {
    subject: 'Knowledge article stale after product rename',
    description: 'KB still mentions the old product code in 14 published articles.',
    status: 'resolved',
    priority: 'low',
    team: 'support',
    customerName: 'Nina Berg',
    company: 'Fjord Analytics',
    tags: ['kb', 'content'],
    aiSummary: 'Bulk-replaced product name and republished the 14 articles.',
    aiSuggestedDraft: 'The knowledge base now uses the current product name.',
    aiInsights: ['14 published hits', 'Redirects added'],
    originalLanguage: 'en',
  },
  {
    subject: '2FA enrollment fails for shared mailbox',
    description: 'Finance shared inbox cannot complete TOTP enrollment.',
    status: 'closed',
    priority: 'medium',
    team: 'support',
    customerName: 'Marc Lefevre',
    company: 'Lumière SAS',
    tags: ['auth', '2fa'],
    aiSummary: 'Shared mailboxes are not TOTP principals. Switched to a security group.',
    aiSuggestedDraft: 'Bitte nutzen Sie das Finance-Security-Group-Konto für 2FA.',
    aiInsights: ['Shared mailbox limitation', 'Group MFA'],
    originalLanguage: 'fr',
  },
  {
    subject: 'SLA clock not pausing on customer wait',
    description: 'Tickets in waiting_customer still burn first-response SLA.',
    status: 'resolved',
    priority: 'medium',
    team: 'support',
    customerName: 'Greta Holm',
    company: 'Nordlicht GmbH',
    tags: ['sla', 'workflow'],
    aiSummary: 'Pause-on-pending flag was off. Enabled and backfilled 9 timers.',
    aiSuggestedDraft: 'SLA timers now pause while we wait for the customer.',
    aiInsights: ['waiting_customer not paused', '9 timers corrected'],
    originalLanguage: 'de',
  },
  {
    subject: 'OpenAI gateway 429 during peak',
    description: 'Smart-reply bursts hit the enterprise gateway rate limit at 09:00.',
    status: 'resolved',
    priority: 'high',
    team: 'engineering',
    customerName: 'Daniel Cho',
    company: 'Atlas Robotics',
    tags: ['llm', 'openai'],
    aiSummary: 'Raised TPM quota and added local fallback for smart-reply.',
    aiSuggestedDraft: 'Peak-hour replies now fail over to the local model automatically.',
    aiInsights: ['429 TPM', 'Fallback Llama'],
    originalLanguage: 'en',
  },
  {
    subject: 'Export CSV truncated at 10k rows',
    description: 'Monthly ticket export stops at 10,000 rows for the EU tenant.',
    status: 'resolved',
    priority: 'low',
    team: 'engineering',
    customerName: 'Ines Costa',
    company: 'Iberia Cloud',
    tags: ['export', 'reporting'],
    aiSummary: 'Streaming export now pages at 50k. Re-ran August export.',
    aiSuggestedDraft: 'The full August export is attached. The 10k cap is removed.',
    aiInsights: ['Hard cap 10000', 'Streaming writer'],
    originalLanguage: 'en',
  },
  {
    subject: 'Mailbox forwarding loop on alias',
    description: 'support@ and help@ alias created a bounce loop over the weekend.',
    status: 'resolved',
    priority: 'urgent',
    team: 'support',
    customerName: 'Paul Richter',
    company: 'Nordlicht GmbH',
    tags: ['mail', 'alias'],
    aiSummary: 'Broke the alias cycle and added a loop detector on inbound.',
    aiSuggestedDraft: 'The forwarding loop is stopped. Weekend bounces were discarded.',
    aiInsights: ['Alias cycle', 'Loop detector'],
    originalLanguage: 'de',
  },
  {
    subject: 'Vault unlock slow after Argon2 memory bump',
    description: 'Unlock takes 9–11s on older laptops after the memory parameter change.',
    status: 'resolved',
    priority: 'medium',
    team: 'engineering',
    customerName: 'Chloe Bennett',
    company: 'Northwind Analytics',
    tags: ['vault', 'argon2'],
    aiSummary: 'Tuned memory to 64 MiB with more iterations. Unlock back under 1.5s.',
    aiSuggestedDraft: 'Vault unlock should feel instant again. Please retry.',
    aiInsights: ['11s unlock', '64 MiB Argon2'],
    originalLanguage: 'en',
  },
];

const OPEN_SPECS: Array<Omit<DemoTicketSpec, 'id' | 'createdOffsetMs'>> = [
  {
    subject: 'Need written enterprise SLA for 24/7 EU coverage',
    description: 'German customer requested the signed enterprise SLA (DE) including weekend coverage.',
    status: 'open',
    priority: 'high',
    team: 'legal',
    customerName: 'Lena Hartmann',
    company: 'Nordlicht GmbH',
    tags: ['sla', 'enterprise'],
    originalLanguage: 'de',
    aiSummary: 'Customer wants the EU 24/7 addendum in German. Legal draft is ready.',
    aiSuggestedDraft: 'Anbei der Enterprise-SLA-Entwurf inkl. Wochenendabdeckung.',
    aiInsights: ['Needs legal sign-off'],
    aiSuggestionUsed: true,
    aiSuggestionsCount: 0,
  },
  {
    subject: 'Webhook latency spike after Friday deploy',
    description: 'French customer reports p95 inbound webhook latency above 8s since Friday.',
    status: 'open',
    priority: 'high',
    team: 'engineering',
    customerName: 'Camille Dupont',
    company: 'Lumière SAS',
    tags: ['webhook', 'latency'],
    originalLanguage: 'fr',
    aiSummary: 'Follow-up after Friday deploy. Worker saturation suspected.',
    aiSuggestedDraft: 'Nous surveillons la latence et vous envoyons un rapport sous 2 heures.',
    aiInsights: ['p95 8.2s'],
    aiSuggestionUsed: true,
    aiSuggestionsCount: 0,
  },
];

export const DEMO_VAULT_SECRETS = [
  {
    id: `${DEMO_VAULT_PREFIX}stripe`,
    label: 'Stripe Production Webhook Secret',
    category: 'API Keys',
    tag: 'Billing',
    type: 'api',
    host: 'hooks.stripe.com',
    username: 'whsec_live',
    password: 'whsec_demo_stripe_prod_7f3c1a',
    notes: 'Production Stripe webhook signing secret. Rotate via Stripe Dashboard → Developers.',
  },
  {
    id: `${DEMO_VAULT_PREFIX}postmark`,
    label: 'Postmark SMTP Relay Credentials',
    category: 'Email',
    tag: 'Infra',
    type: 'email',
    host: 'smtp.postmarkapp.com:587',
    username: 'outbound@geistdesk.example',
    password: 'pm-demo-smtp-relay-9k2',
    notes: 'Transactional SMTP relay for CSAT and agent replies.',
  },
  {
    id: `${DEMO_VAULT_PREFIX}s3`,
    label: 'AWS S3 Invoice Archive Bucket Key',
    category: 'Cloud',
    tag: 'Storage',
    type: 'cloud',
    host: 's3.eu-central-1.amazonaws.com/geistdesk-invoices',
    username: 'AKIADDEMOINVOICE',
    password: 's3-demo-invoice-archive-key',
    notes: 'Read-only key for the EU invoice archive bucket.',
  },
  {
    id: `${DEMO_VAULT_PREFIX}openai`,
    label: 'OpenAI Enterprise Gateway Token',
    category: 'AI Services',
    tag: 'LLM',
    type: 'api',
    host: 'gateway.openai.example',
    username: 'org-geistdesk-eu',
    password: 'sk-demo-enterprise-gateway',
    notes: 'Enterprise gateway token for smart-reply and summarization.',
  },
  {
    id: `${DEMO_VAULT_PREFIX}postgres`,
    label: 'PostgreSQL Read-Replica Access',
    category: 'Database',
    tag: 'Backend',
    type: 'db',
    host: 'replica.db.geistdesk.internal:5432',
    username: 'geist_readonly',
    password: 'replica-demo-readonly',
    notes: 'Reporting replica. Do not run writes. sslmode=require.',
  },
] as const;

function isoFromOffset(offsetMs: number): string {
  return new Date(Date.now() - offsetMs).toISOString();
}

function buildTicketSpecs(): DemoTicketSpec[] {
  const resolved = RESOLVED_SPECS.map((spec, index) => {
    const createdOffsetMs =
      (index % 7) * 24 * 60 * 60 * 1000 +
      (4 + (index % 5)) * 60 * 60 * 1000 +
      (index * 17) * 60 * 1000;
    const used = index < AI_COUNTS.length;
    return {
      ...spec,
      id: `${DEMO_TICKET_PREFIX}${String(index + 1).padStart(3, '0')}`,
      createdOffsetMs,
      resolutionTimeMinutes: RESOLUTION_MINUTES[index],
      satisfactionRating: SATISFACTION[index],
      aiSuggestionUsed: used,
      aiSuggestionsCount: used ? AI_COUNTS[index] : 0,
    };
  });

  const open = OPEN_SPECS.map((spec, index) => ({
    ...spec,
    id: `${DEMO_TICKET_PREFIX}${String(resolved.length + index + 1).padStart(3, '0')}`,
    createdOffsetMs: (5 + index) * 60 * 60 * 1000,
  }));

  return [...resolved, ...open];
}

async function purgePreviousSimulation(replaceLegacySamples: boolean): Promise<number> {
  const result = await queryDb(
    `
    DELETE FROM geistdesk_documents
     WHERE id LIKE $1
        OR id LIKE $2
        OR id LIKE $3
        OR id LIKE $4
        OR collection LIKE $5
        OR collection = $6
        OR ($7::boolean AND (
             id LIKE 'tkt-sample-%'
          OR id LIKE 'tkt-seed-%'
          OR collection LIKE 'tickets/tkt-sample-%/messages'
          OR collection LIKE 'tickets/tkt-seed-%/messages'
        ))
    `,
    [
      `${DEMO_TICKET_PREFIX}%`,
      `${DEMO_EXCHANGE_PREFIX}%`,
      `${DEMO_VAULT_PREFIX}%`,
      `${DEMO_MESSAGE_PREFIX}%`,
      `tickets/${DEMO_TICKET_PREFIX}%/messages`,
      DEMO_CATALOG_COLLECTION,
      replaceLegacySamples,
    ],
  );
  return result.rowCount ?? 0;
}

async function seedTickets(
  specs: DemoTicketSpec[],
  opts: DemoSimulationSeedOptions,
): Promise<number> {
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
      aiSentiment: spec.satisfactionRating ? 'positive' : spec.status === 'open' ? 'neutral' : 'positive',
      aiSummary: spec.aiSummary || null,
      aiSuggestedDraft: spec.aiSuggestedDraft || null,
      aiInsights: spec.aiInsights || [],
      source: 'demo-simulation',
    });
  }
  return specs.length;
}

async function seedConversationMessages(
  specs: DemoTicketSpec[],
  opts: DemoSimulationSeedOptions,
): Promise<number> {
  const slaTicket = specs.find((t) => t.id === `${DEMO_TICKET_PREFIX}019`) ?? specs[18];
  const webhookTicket = specs.find((t) => t.id === `${DEMO_TICKET_PREFIX}020`) ?? specs[19];
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
      ticketId: slaTicket.id,
      messages: [
        {
          id: `${DEMO_MESSAGE_PREFIX}de-en-1`,
          senderType: 'customer',
          senderName: 'Lena Hartmann',
          content: 'Guten Tag, wir benötigen die unterzeichnete Enterprise-SLA mit 24/7-Abdeckung für die EU — inklusive Wochenenden.',
          originalContent: 'Guten Tag, wir benötigen die unterzeichnete Enterprise-SLA mit 24/7-Abdeckung für die EU — inklusive Wochenenden.',
          createdOffsetMs: slaTicket.createdOffsetMs - 10 * 60 * 1000,
        },
        {
          id: `${DEMO_MESSAGE_PREFIX}de-en-2`,
          senderType: 'ai',
          senderName: 'Polyglot Bridge',
          content: 'Good day, we need the signed enterprise SLA with 24/7 EU coverage — including weekends.',
          originalContent: 'Good day, we need the signed enterprise SLA with 24/7 EU coverage — including weekends.',
          createdOffsetMs: slaTicket.createdOffsetMs - 9 * 60 * 1000,
        },
        {
          id: `${DEMO_MESSAGE_PREFIX}de-en-3`,
          senderType: 'agent',
          senderName: opts.actorName || 'Mara Voss',
          content: 'Vielen Dank — ich stelle den deutschen Enterprise-SLA-Entwurf inkl. Wochenendabdeckung bereit.',
          originalContent: 'Thanks — I will prepare the German enterprise SLA draft including weekend coverage.',
          createdOffsetMs: slaTicket.createdOffsetMs - 4 * 60 * 1000,
        },
      ],
    },
    {
      ticketId: webhookTicket.id,
      messages: [
        {
          id: `${DEMO_MESSAGE_PREFIX}fr-de-1`,
          senderType: 'customer',
          senderName: 'Camille Dupont',
          content: 'Bonjour, depuis vendredi la latence de nos webhooks dépasse 8 secondes. Pouvez-vous vérifier ?',
          originalContent: 'Bonjour, depuis vendredi la latence de nos webhooks dépasse 8 secondes. Pouvez-vous vérifier ?',
          createdOffsetMs: webhookTicket.createdOffsetMs - 8 * 60 * 1000,
        },
        {
          id: `${DEMO_MESSAGE_PREFIX}fr-de-2`,
          senderType: 'ai',
          senderName: 'Polyglot Bridge',
          content: 'Guten Tag, seit Freitag liegt unsere Webhook-Latenz über 8 Sekunden. Können Sie das prüfen?',
          originalContent: 'Guten Tag, seit Freitag liegt unsere Webhook-Latenz über 8 Sekunden. Können Sie das prüfen?',
          createdOffsetMs: webhookTicket.createdOffsetMs - 7 * 60 * 1000,
        },
        {
          id: `${DEMO_MESSAGE_PREFIX}fr-de-3`,
          senderType: 'agent',
          senderName: opts.actorName || 'Mara Voss',
          content: 'Nous avons identifié une saturation des workers Postal et augmentons la capacité. Rapport sous 2 heures.',
          originalContent: 'Wir haben eine Sättigung der Postal-Worker erkannt und skalieren. Bericht in 2 Stunden.',
          createdOffsetMs: webhookTicket.createdOffsetMs - 2 * 60 * 1000,
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
      });
      count += 1;
    }
  }
  return count;
}

async function seedVaultCatalog(): Promise<number> {
  const now = new Date().toISOString();
  const categories = [
    { id: 'cat-demo-sim-api', name: 'API Keys', slug: 'api-keys', icon: 'key' },
    { id: 'cat-demo-sim-email', name: 'Email', slug: 'email', icon: 'mail' },
    { id: 'cat-demo-sim-cloud', name: 'Cloud', slug: 'cloud', icon: 'cloud' },
    { id: 'cat-demo-sim-ai', name: 'AI Services', slug: 'ai-services', icon: 'sparkles' },
    { id: 'cat-demo-sim-db', name: 'Database', slug: 'database', icon: 'database' },
  ];
  const credentials = DEMO_VAULT_SECRETS.map((item) => ({
    id: item.id,
    type: item.type,
    label: item.label,
    username: item.username,
    encryptedPassword: item.password,
    host: item.host,
    notes: item.notes,
    updatedAt: Date.now(),
    lastModifiedBy: 'Simulation Seeder',
    favorite: item.tag === 'Billing' || item.tag === 'LLM',
    vaultId: 'local',
    tags: [item.category, item.tag, 'simulation'],
    category: item.category,
    source: 'demo-simulation',
  }));

  await setDocDirect(DEMO_CATALOG_COLLECTION, 'global', {
    credentials,
    categories,
    createdAt: now,
    updatedAt: now,
    source: 'demo-simulation',
  });
  return credentials.length;
}

async function seedExchangeSessions(
  specs: DemoTicketSpec[],
  opts: DemoSimulationSeedOptions,
): Promise<number> {
  const slaTicket = specs.find((t) => t.id === `${DEMO_TICKET_PREFIX}019`);
  const webhookTicket = specs.find((t) => t.id === `${DEMO_TICKET_PREFIX}020`);
  const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
  const sessions = [
    {
      id: `${DEMO_EXCHANGE_PREFIX}de-en`,
      content:
        'DE→EN live translation session\nCustomer (DE): Wir benötigen die unterzeichnete Enterprise-SLA inkl. 24/7.\nAgent (EN view): We need the signed enterprise SLA including 24/7 coverage.',
      metadata: {
        secretType: 'conversation',
        requestName: 'Enterprise SLA — DE ↔ EN',
        description: 'German customer asking about enterprise SLAs with real-time English agent translation.',
        sourceLanguage: 'de',
        targetLanguage: 'en',
        relatedTicketId: slaTicket?.id,
        targetRecipient: 'lena.hartmann@nordlicht.example',
        recipientEmails: ['lena.hartmann@nordlicht.example'],
        persona: 'support_agent',
        translationLive: true,
      },
    },
    {
      id: `${DEMO_EXCHANGE_PREFIX}fr-de`,
      content:
        'FR→DE live translation session\nCustomer (FR): La latence webhook dépasse 8 secondes.\nAgent (DE view): Die Webhook-Latenz liegt über 8 Sekunden.',
      metadata: {
        secretType: 'conversation',
        requestName: 'Webhook latency — FR ↔ DE',
        description: 'French customer reporting webhook latency with German support response.',
        sourceLanguage: 'fr',
        targetLanguage: 'de',
        relatedTicketId: webhookTicket?.id,
        targetRecipient: 'camille.dupont@lumiere.example',
        recipientEmails: ['camille.dupont@lumiere.example'],
        persona: 'tier3_technical_escalation',
        translationLive: true,
      },
    },
    {
      id: `${DEMO_EXCHANGE_PREFIX}personas`,
      content:
        'Custom AI persona pack\n- Tier-3 Technical Escalation: terse, root-cause first, German/English.\n- Friendly Billing Assistant: warm, invoice-aware, never invents amounts.',
      metadata: {
        secretType: 'persona-pack',
        requestName: 'Tier-3 Technical Escalation & Friendly Billing Assistant',
        description: 'Custom AI persona setup for technical escalations and billing conversations.',
        personas: ['tier3_technical_escalation', 'friendly_billing_assistant'],
        targetRecipient: opts.actorEmail || 'demo@geistdesk.com',
        recipientEmails: [opts.actorEmail || 'demo@geistdesk.com'],
        translationLive: false,
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
    });
    await setDocDirect('vault_items', session.id, {
      type: 'secret',
      secretRef: secretId,
      expirationType: 'time',
      expiresAt,
      maxViews: 25,
      viewCount: 0,
      isBurned: false,
      createdBy: opts.actorUserId,
      createdAt: new Date().toISOString(),
      metadata: session.metadata,
      source: 'demo-simulation',
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

  if (!existing.rowCount) {
    await queryDb(
      `INSERT INTO ai_orchestrator_config (workspace_id, persona_skills_json, created_by, updated_by, updated_at)
       VALUES ('default', $1::jsonb, 'demo-simulation', 'demo-simulation', NOW())
       ON CONFLICT (workspace_id) DO UPDATE
         SET persona_skills_json = $1::jsonb, updated_by = 'demo-simulation', updated_at = NOW()`,
      [JSON.stringify(merged)],
    );
  } else {
    await queryDb(
      `UPDATE ai_orchestrator_config
          SET persona_skills_json = $1::jsonb, updated_by = 'demo-simulation', updated_at = NOW()
        WHERE workspace_id = 'default'`,
      [JSON.stringify(merged)],
    );
  }
  return Object.keys(extras).length;
}

export async function seedDemoSimulation(
  options: DemoSimulationSeedOptions,
): Promise<DemoSimulationSeedResult> {
  const replaceLegacySamples = options.replaceLegacySamples !== false;
  const purged = await purgePreviousSimulation(replaceLegacySamples);
  const specs = buildTicketSpecs();
  const tickets = await seedTickets(specs, options);
  const messages = await seedConversationMessages(specs, options);
  const vaultSecrets = await seedVaultCatalog();
  let exchangeSessions = 0;
  try {
    exchangeSessions = await seedExchangeSessions(specs, options);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[demo-simulation] Skipping GeistExchange sessions: ${message}`);
  }
  const personas = await seedCustomPersonas();
  return { tickets, messages, vaultSecrets, exchangeSessions, personas, purged };
}

export function previewDemoSimulationKpis() {
  const specs = buildTicketSpecs();
  const resolved = specs.filter((s) => s.status === 'resolved' || s.status === 'closed');
  const total = specs.length;
  const avgMinutes =
    resolved.reduce((sum, spec) => sum + (spec.resolutionTimeMinutes || 0), 0) / resolved.length;
  const avgRating =
    resolved.reduce((sum, spec) => sum + (spec.satisfactionRating || 0), 0) / resolved.length;
  const aiSuggestions = specs.reduce((sum, spec) => sum + (spec.aiSuggestionsCount || 0), 0);
  return {
    tickets: total,
    resolved: resolved.length,
    open: total - resolved.length,
    resolutionRate: (resolved.length / total) * 100,
    avgResolutionMinutes: avgMinutes,
    csat: avgRating,
    aiSuggestions,
  };
}
