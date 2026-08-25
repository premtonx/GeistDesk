// Production PostgreSQL Generic Document Engine.
// PostgreSQL is the singular source of truth. There is intentionally no
// local-file fallback: if the database is unavailable the application must
// fail rather than silently diverge onto volatile local storage.

import pg from 'pg';
import { randomUUID } from 'crypto';

const { Pool } = pg;

// Connection string can come from standard custom env variables
const DATABASE_URL = process.env.DATABASE_URL || process.env.PG_DATABASE_URL;

let pgPool: pg.Pool | null = null;
let isPostgres = false;

// Safe JSON Parsing Helper
function safeParseJson(data: any): any {
  if (data === null || data === undefined) {
    return {};
  }
  if (typeof data === 'string') {
    try {
      return JSON.parse(data);
    } catch (e) {
      console.error("[DB Engine] JSONB safe payload parsing failed:", e);
      return {};
    }
  }
  if (typeof data === 'object') {
    return data;
  }
  return {};
}

// Initialize Connection. PostgreSQL is mandatory.
export async function initDb() {
  if (!DATABASE_URL) {
    throw new Error(
      "[DB Engine] DATABASE_URL (or PG_DATABASE_URL) is required. PostgreSQL is the singular source of truth; there is no local-file fallback."
    );
  }

  console.log("[DB Engine] Connecting to PostgreSQL...");

  // TLS policy: only disable TLS for explicitly-local connections. For all
  // remote connections we require a verified certificate chain (set
  // PGSSLROOTCERT / standard libpq env vars to supply a CA when needed).
  const isLocal =
    DATABASE_URL.includes('localhost') ||
    DATABASE_URL.includes('127.0.0.1') ||
    DATABASE_URL.includes('sslmode=disable');
  const allowInsecureTls = process.env.DATABASE_SSL_INSECURE === 'true';

  pgPool = new Pool({
    connectionString: DATABASE_URL,
    ssl: isLocal ? false : { rejectUnauthorized: !allowInsecureTls }
  });

  // Ping check — surface failures instead of falling back.
  await pgPool.query('SELECT NOW()');
  isPostgres = true;
  console.log("[DB Engine] PostgreSQL Connection Successful!");

  // DDL: document-oriented store plus indexes for JSONB lookups.
  await pgPool.query(`
    CREATE TABLE IF NOT EXISTS geistdesk_documents (
      collection VARCHAR(255) NOT NULL,
      id VARCHAR(255) NOT NULL,
      data JSONB NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (collection, id)
    );
    CREATE INDEX IF NOT EXISTS idx_geistdesk_documents_collection ON geistdesk_documents(collection);
    CREATE INDEX IF NOT EXISTS idx_geistdesk_documents_data_gin ON geistdesk_documents USING GIN (data);
  `);
  // Self-heal: an existing geistdesk_documents table created by an older image
  // or foreign schema may predate the `data` JSONB column. CREATE TABLE IF NOT
  // EXISTS is a no-op on an existing table, so repair it explicitly. Every
  // accessor (getDocDirect / updateDocDirect / query filters) reads `data`.
  await pgPool.query(`
    ALTER TABLE geistdesk_documents
      ADD COLUMN IF NOT EXISTS data JSONB,
      ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
  `);
  await pgPool.query(`
    CREATE TABLE IF NOT EXISTS ai_orchestrator_config (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      workspace_id VARCHAR(255) NOT NULL DEFAULT 'default',
      scope VARCHAR(32) NOT NULL DEFAULT 'workspace',
      primary_model VARCHAR(128) NOT NULL DEFAULT 'gemini-flash',
      reasoning_model VARCHAR(128) NOT NULL DEFAULT 'gemini-pro',
      triage_model VARCHAR(128) NOT NULL DEFAULT 'gemini-flash',
      fallback_models JSONB NOT NULL DEFAULT '["claude","gpt-5","local-llama"]',
      feature_routing_json JSONB NOT NULL DEFAULT '{}',
      endpoint_url TEXT NOT NULL DEFAULT '',
      pii_enabled BOOLEAN NOT NULL DEFAULT true,
      auto_escalation_enabled BOOLEAN NOT NULL DEFAULT true,
      audit_enabled BOOLEAN NOT NULL DEFAULT true,
      config_locked BOOLEAN NOT NULL DEFAULT false,
      reasoning_level VARCHAR(32) NOT NULL DEFAULT 'balanced',
      content_filtering_enabled BOOLEAN NOT NULL DEFAULT true,
      prompt_logging_enabled BOOLEAN NOT NULL DEFAULT false,
      data_residency VARCHAR(64) NOT NULL DEFAULT 'eu',
      created_by VARCHAR(255),
      updated_by VARCHAR(255),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(workspace_id)
    );
    ALTER TABLE ai_orchestrator_config ADD COLUMN IF NOT EXISTS redaction_rules_json JSONB NOT NULL DEFAULT '[{"id":"email","name":"Email Addresses","description":"Detects and masks personal and corporate email patterns.","enabled":true},{"id":"phone","name":"Phone Numbers","description":"International and local phone number formats.","enabled":true},{"id":"cc","name":"Credit Card (PCI)","description":"Luhn-validated 13-16 digit card numbers.","enabled":true},{"id":"address","name":"Physical Addresses","description":"Street addresses, zip codes, and city names.","enabled":false},{"id":"ssn","name":"Sensitive IDs (SSN/VAT)","description":"Government-issued identification numbers.","enabled":true}]';
    CREATE TABLE IF NOT EXISTS ai_orchestrator_secrets (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      workspace_id VARCHAR(255) NOT NULL DEFAULT 'default',
      provider VARCHAR(64) NOT NULL,
      secret_encrypted TEXT NOT NULL,
      updated_by VARCHAR(255),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(workspace_id, provider)
    );
    CREATE TABLE IF NOT EXISTS rag_pipeline_config (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      workspace_id VARCHAR(255) NOT NULL DEFAULT 'default',
      resolution_mode VARCHAR(24) NOT NULL DEFAULT 'hybrid',
      redact_pii BOOLEAN NOT NULL DEFAULT true,
      chunk_overlap_tokens INTEGER NOT NULL DEFAULT 100,
      updated_by VARCHAR(255),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(workspace_id)
    );
    ALTER TABLE rag_pipeline_config ADD COLUMN IF NOT EXISTS resolution_mode VARCHAR(24) NOT NULL DEFAULT 'hybrid';
    ALTER TABLE rag_pipeline_config ADD COLUMN IF NOT EXISTS redact_pii BOOLEAN NOT NULL DEFAULT true;
    ALTER TABLE rag_pipeline_config ADD COLUMN IF NOT EXISTS chunk_overlap_tokens INTEGER NOT NULL DEFAULT 100;
    CREATE TABLE IF NOT EXISTS ai_orchestrator_audit (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      workspace_id VARCHAR(255) NOT NULL DEFAULT 'default',
      user_id VARCHAR(255),
      user_email VARCHAR(255),
      action VARCHAR(128) NOT NULL,
      field_name VARCHAR(128),
      old_value TEXT,
      new_value TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_ai_orchestrator_audit_workspace ON ai_orchestrator_audit(workspace_id, created_at DESC);
    CREATE TABLE IF NOT EXISTS ai_orchestrator_versions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      workspace_id VARCHAR(255) NOT NULL DEFAULT 'default',
      version_number INTEGER NOT NULL,
      config_json JSONB NOT NULL,
      created_by VARCHAR(255),
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_ai_orchestrator_versions_ws ON ai_orchestrator_versions(workspace_id, version_number DESC);
    CREATE TABLE IF NOT EXISTS ai_usage_log (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      workspace_id VARCHAR(255) NOT NULL DEFAULT 'default',
      module VARCHAR(32) NOT NULL,
      feature VARCHAR(64) NOT NULL,
      model VARCHAR(128) NOT NULL,
      latency_ms INTEGER DEFAULT 0,
      prompt_tokens INTEGER DEFAULT 0,
      completion_tokens INTEGER DEFAULT 0,
      cost_usd NUMERIC(12, 6) DEFAULT 0,
      success BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_ai_usage_log_workspace ON ai_usage_log(workspace_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_ai_usage_log_feature ON ai_usage_log(workspace_id, feature, created_at DESC);
    ALTER TABLE ai_orchestrator_config ADD COLUMN IF NOT EXISTS provider_priority JSONB NOT NULL DEFAULT '["gpt-5","claude","gemini-flash","local-llama"]';
    ALTER TABLE ai_orchestrator_config ADD COLUMN IF NOT EXISTS model_mode VARCHAR(16) NOT NULL DEFAULT 'advanced';
    ALTER TABLE ai_orchestrator_config ADD COLUMN IF NOT EXISTS kill_switch_json JSONB NOT NULL DEFAULT '{"master":false,"smartReply":false,"summaries":false,"kbGeneration":false,"sentiment":false}';
    ALTER TABLE ai_orchestrator_config ADD COLUMN IF NOT EXISTS daily_budget_usd NUMERIC(12,2) NOT NULL DEFAULT 10;
    ALTER TABLE ai_orchestrator_config ADD COLUMN IF NOT EXISTS monthly_budget_usd NUMERIC(12,2) NOT NULL DEFAULT 300;
    ALTER TABLE ai_orchestrator_config ADD COLUMN IF NOT EXISTS daily_budget_eur NUMERIC(12,2) NOT NULL DEFAULT 50;
    ALTER TABLE ai_orchestrator_config ADD COLUMN IF NOT EXISTS budget_exceeded_action VARCHAR(32) NOT NULL DEFAULT 'local_fallback';
    ALTER TABLE ai_orchestrator_config ADD COLUMN IF NOT EXISTS config_version INTEGER NOT NULL DEFAULT 1;
    ALTER TABLE ai_orchestrator_config ADD COLUMN IF NOT EXISTS corporate_policies_json JSONB NOT NULL DEFAULT '{"customerPiiNeverLeavesWorkspace":true,"vaultAnalysisMustStayLocal":false,"rootCauseAnalysisRequiresAuditLogging":true,"promptLoggingRequiresExplicitConsent":true,"cloudFallbackRequiresApproval":false}';
    ALTER TABLE ai_orchestrator_config ADD COLUMN IF NOT EXISTS trust_level INTEGER NOT NULL DEFAULT 3;
    ALTER TABLE ai_orchestrator_config ADD COLUMN IF NOT EXISTS data_residency_policy_json JSONB NOT NULL DEFAULT '{"allowedRegions":["Germany","EU"],"customerDataNeverLeavesEU":true}';
    ALTER TABLE ai_orchestrator_config ADD COLUMN IF NOT EXISTS confidence_thresholds_json JSONB NOT NULL DEFAULT '{"ticket_summarization":0.75,"sentiment_analysis":0.7,"smart_reply":0.85,"kb_generation":0.8,"escalation_analysis":0.85,"root_cause_analysis":0.9,"translation":0.8,"vault_insights":0.85}';
    ALTER TABLE ai_orchestrator_config ADD COLUMN IF NOT EXISTS memory_policy_json JSONB NOT NULL DEFAULT '{"rememberContext30Days":true,"doNotRememberVipData":true,"purgeMemoryOnTicketClose":true}';
    CREATE TABLE IF NOT EXISTS ai_approval_queue (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      workspace_id VARCHAR(255) NOT NULL DEFAULT 'default',
      request_id UUID NOT NULL,
      feature VARCHAR(64) NOT NULL,
      approval_role VARCHAR(32) NOT NULL,
      status VARCHAR(32) NOT NULL DEFAULT 'pending',
      prompt_hash TEXT,
      payload_json JSONB,
      requested_by VARCHAR(255),
      approved_by VARCHAR(255),
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      resolved_at TIMESTAMPTZ
    );
    CREATE INDEX IF NOT EXISTS idx_ai_approval_queue_ws ON ai_approval_queue(workspace_id, status, created_at DESC);
    CREATE TABLE IF NOT EXISTS ai_human_review_pool (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      workspace_id VARCHAR(255) NOT NULL DEFAULT 'default',
      request_id UUID NOT NULL,
      feature VARCHAR(64) NOT NULL,
      confidence FLOAT NOT NULL,
      threshold FLOAT NOT NULL,
      output_text TEXT,
      status VARCHAR(32) NOT NULL DEFAULT 'pending',
      assigned_to VARCHAR(255),
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_ai_human_review_ws ON ai_human_review_pool(workspace_id, status, created_at DESC);
    CREATE TABLE IF NOT EXISTS ai_explainability_log (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      workspace_id VARCHAR(255) NOT NULL DEFAULT 'default',
      request_id UUID NOT NULL,
      feature VARCHAR(64) NOT NULL,
      model_chosen VARCHAR(128),
      model_choice_reason TEXT,
      policies_checked JSONB,
      cost_usd NUMERIC(12, 6) DEFAULT 0,
      latency_ms INTEGER DEFAULT 0,
      log_line TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_ai_explainability_ws ON ai_explainability_log(workspace_id, created_at DESC);
    CREATE TABLE IF NOT EXISTS ai_prompt_templates (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      workspace_id VARCHAR(255) NOT NULL DEFAULT 'default',
      feature VARCHAR(64) NOT NULL,
      name VARCHAR(255) NOT NULL,
      current_version INTEGER NOT NULL DEFAULT 1,
      body TEXT NOT NULL,
      updated_by VARCHAR(255),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(workspace_id, feature)
    );
    CREATE TABLE IF NOT EXISTS ai_prompt_versions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      template_id UUID NOT NULL,
      feature VARCHAR(64) NOT NULL,
      version_number INTEGER NOT NULL,
      body TEXT NOT NULL,
      change_note TEXT,
      created_by VARCHAR(255),
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_ai_prompt_versions_template ON ai_prompt_versions(template_id, version_number DESC);
    ALTER TABLE ai_orchestrator_config ADD COLUMN IF NOT EXISTS feature_personas_json JSONB NOT NULL DEFAULT '{"ticket_summarization":"support_agent","smart_reply":"support_agent","kb_generation":"knowledge_writer","root_cause_analysis":"security_analyst","translation":"knowledge_writer"}';
    ALTER TABLE ai_orchestrator_config ADD COLUMN IF NOT EXISTS persona_skills_json JSONB NOT NULL DEFAULT '{}';
    ALTER TABLE ai_orchestrator_config ADD COLUMN IF NOT EXISTS enable_self_critique_loop BOOLEAN NOT NULL DEFAULT true;
    ALTER TABLE ai_orchestrator_config ADD COLUMN IF NOT EXISTS max_critique_iterations INTEGER NOT NULL DEFAULT 2;
    ALTER TABLE ai_orchestrator_config ADD COLUMN IF NOT EXISTS auto_dispatch_threshold INTEGER NOT NULL DEFAULT 95;
    ALTER TABLE ai_orchestrator_config ADD COLUMN IF NOT EXISTS critic_model VARCHAR(64) NOT NULL DEFAULT 'deepseek-reasoner';
    ALTER TABLE ai_orchestrator_config ADD COLUMN IF NOT EXISTS enable_swarm_detection BOOLEAN NOT NULL DEFAULT true;
    ALTER TABLE ai_orchestrator_config ADD COLUMN IF NOT EXISTS enable_human_diff_learning BOOLEAN NOT NULL DEFAULT true;
    CREATE TABLE IF NOT EXISTS ai_draft_learning_diffs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      ticket_id VARCHAR(255) NOT NULL,
      agent_id VARCHAR(255),
      original_draft TEXT NOT NULL,
      final_sent_message TEXT NOT NULL,
      diff_summary TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_ai_draft_learning_diffs_ticket ON ai_draft_learning_diffs(ticket_id, created_at DESC);
    CREATE TABLE IF NOT EXISTS ai_incident_clusters (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      cluster_title VARCHAR(255) NOT NULL,
      ticket_count INTEGER NOT NULL DEFAULT 0,
      sample_ticket_ids JSONB NOT NULL DEFAULT '[]',
      status VARCHAR(16) NOT NULL DEFAULT 'active',
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_ai_incident_clusters_status ON ai_incident_clusters(status, created_at DESC);
  `);

  // Global email/domain blacklist for inbound spam rejection (pre-filter).
  // blocked_value is always stored lowercase (email or domain).
  await pgPool.query(`
    CREATE TABLE IF NOT EXISTS global_blacklist (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      blocked_value TEXT NOT NULL UNIQUE,
      blocked_by VARCHAR(255),
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_global_blacklist_created
      ON global_blacklist ("createdAt" DESC);
  `);

  // pgvector RAG store (KnowledgeEmbedding) — mirrored from prisma/migrations.
  try {
    await pgPool.query(`CREATE EXTENSION IF NOT EXISTS vector`);
    await pgPool.query(`
      DO $$ BEGIN
        CREATE TYPE "KnowledgeSourceType" AS ENUM ('KB_ARTICLE', 'RESOLVED_TICKET');
      EXCEPTION
        WHEN duplicate_object THEN NULL;
      END $$;
    `);
    // GeistKB Document Library — extend the enum without recreating the type.
    try {
      await pgPool.query(`ALTER TYPE "KnowledgeSourceType" ADD VALUE IF NOT EXISTS 'KB_DOCUMENT'`);
    } catch (enumErr: any) {
      console.warn('[DB Engine] KnowledgeSourceType KB_DOCUMENT add skipped:', enumErr?.message || enumErr);
    }
    await pgPool.query(`
      CREATE TABLE IF NOT EXISTS "KnowledgeEmbedding" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenant_id" VARCHAR(255) NOT NULL DEFAULT 'default',
        "source_type" "KnowledgeSourceType" NOT NULL,
        "source_id" VARCHAR(255) NOT NULL,
        "chunk_index" INTEGER NOT NULL DEFAULT 0,
        "chunk_content" TEXT NOT NULL,
        "metadata" JSONB NOT NULL DEFAULT '{}'::jsonb,
        "embedding" vector(1536),
        "search_tsv" tsvector,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE UNIQUE INDEX IF NOT EXISTS "knowledge_embedding_source_chunk_uq"
        ON "KnowledgeEmbedding" ("tenant_id", "source_type", "source_id", "chunk_index");
      CREATE INDEX IF NOT EXISTS "idx_knowledge_embedding_source"
        ON "KnowledgeEmbedding" ("tenant_id", "source_type", "source_id");
      CREATE INDEX IF NOT EXISTS "idx_knowledge_embedding_fts"
        ON "KnowledgeEmbedding" USING gin ("search_tsv");
    `);
    // HNSW may fail on very old pgvector builds — non-fatal for boot.
    try {
      await pgPool.query(`
        CREATE INDEX IF NOT EXISTS "idx_knowledge_embedding_hnsw"
          ON "KnowledgeEmbedding"
          USING hnsw ("embedding" vector_cosine_ops);
      `);
    } catch (hnswErr: any) {
      console.warn(
        '[DB Engine] HNSW index skipped (pgvector HNSW unavailable):',
        hnswErr?.message || hnswErr,
      );
    }
    console.log('[DB Engine] KnowledgeEmbedding (pgvector) verified.');
  } catch (vectorErr: any) {
    console.warn(
      '[DB Engine] pgvector / KnowledgeEmbedding unavailable — RAG indexing disabled until extension is installed:',
      vectorErr?.message || vectorErr,
    );
  }

  // First-run wizard: stamp is_initialized=false when the key is absent.
  // Never overwrite an explicit true (completed onboarding).
  try {
    await pgPool.query(`
      UPDATE geistdesk_documents
         SET data = jsonb_set(
               jsonb_set(
                 jsonb_set(COALESCE(data, '{}'::jsonb), '{is_initialized}', 'false'::jsonb, true),
                 '{initializedBy}',
                 'null'::jsonb,
                 true
               ),
               '{initializedAt}',
               'null'::jsonb,
               true
             ),
             updated_at = NOW()
       WHERE collection = 'module_config'
         AND id = 'global'
         AND (
           COALESCE(data->>'is_initialized', '') NOT IN ('true', 'false')
           OR data->>'initializedBy' = 'legacy-migration'
         )
    `);
  } catch (initFlagErr: any) {
    console.warn(
      '[DB Engine] module_config.is_initialized default skipped:',
      initFlagErr?.message || initFlagErr,
    );
  }

  console.log("[DB Engine] PostgreSQL Tables Verified.");
}

/** Guard that returns a live pool or throws — never silently no-ops. */
function requirePool(): pg.Pool {
  if (!isPostgres || !pgPool) {
    throw new Error("[DB Engine] PostgreSQL pool is not initialized. Call initDb() before issuing queries.");
  }
  return pgPool;
}

/** Run a callback inside a single PostgreSQL transaction. */
export async function withPgTransaction<T>(
  fn: (client: pg.PoolClient) => Promise<T>,
): Promise<T> {
  const client = await requirePool().connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/** Execute parameterized SQL against the live pool. */
export async function queryDb(sql: string, params: unknown[] = []): Promise<pg.QueryResult> {
  return requirePool().query(sql, params);
}

// -----------------------------------------------------------------------------
// CORE DB DATA ACCESORS
// -----------------------------------------------------------------------------

async function readAllDocs(collectionName: string): Promise<any[]> {
  const pool = requirePool();
  const res = await pool.query(
    'SELECT id, data FROM geistdesk_documents WHERE collection = $1',
    [collectionName]
  );
  return res.rows.map(row => {
    const parsed = safeParseJson(row.data);
    return {
      id: row.id,
      ...parsed
    };
  });
}

// -----------------------------------------------------------------------------
// QUERY INTERPRETER / CONSTRAINTS PARSER
// -----------------------------------------------------------------------------

function applyQueryConstraints(docs: any[], constraints: any[]): any[] {
  let result = [...docs];
  
  for (const c of constraints) {
    if (!c) continue;

    if (c.type === 'where') {
      result = result.filter(doc => {
        const val = doc[c.field];
        const checkVal = c.value;

        if (c.op === '==' || c.op === '===') {
          return val === checkVal;
        }
        if (c.op === '!=') {
          return val !== checkVal;
        }
        if (c.op === '>') {
          return val > checkVal;
        }
        if (c.op === '>=') {
          return val >= checkVal;
        }
        if (c.op === '<') {
          return val < checkVal;
        }
        if (c.op === '<=') {
          return val <= checkVal;
        }
        if (c.op === 'array-contains') {
          return Array.isArray(val) && val.includes(checkVal);
        }
        return true;
      });
    } else if (c.type === 'orderBy') {
      result.sort((a, b) => {
        let valA = a[c.field];
        let valB = b[c.field];

        if (valA && typeof valA === 'object' && valA._seconds) {
          valA = valA._seconds * 1000;
        }
        if (valB && typeof valB === 'object' && valB._seconds) {
          valB = valB._seconds * 1000;
        }

        if (valA === undefined || valA === null) return 1;
        if (valB === undefined || valB === null) return -1;

        if (valA < valB) return c.direction === 'desc' ? 1 : -1;
        if (valA > valB) return c.direction === 'desc' ? -1 : 1;
        return 0;
      });
    } else if (c.type === 'limit') {
      result = result.slice(0, c.count);
    }
  }

  return result;
}

/**
 * Builds a type-aware SQL expression for jsonb range comparisons.
 *
 * `data->>field` returns text, so `>`/`<` would compare lexicographically
 * (e.g. '100' < '9'). When the comparison value looks numeric, the field is
 * cast so SQL matches the JS value semantics of the in-memory fallback filter.
 * ISO timestamps compare correctly as text (lexicographic order matches
 * chronological order), so they are left untouched. Non-numeric rows yield
 * NULL in the CASE, which never satisfies a range predicate — mirroring the
 * JS fallback where `'abc' > 5` is false.
 *
 * @param paramIndex Index of the field-name query parameter (value is +1).
 */
function sqlRangeCast(value: unknown, paramIndex: number): string {
  const raw = String(value ?? '').trim();
  if (raw !== '' && /^-?\d+(\.\d+)?$/.test(raw)) {
    return `CASE WHEN data->>$${paramIndex} ~ '^-?\\d+(\\.\\d+)?$' THEN (data->>$${paramIndex})::numeric END`;
  }
  return `data->>$${paramIndex}`;
}

// Deep process dynamic insert object (replacing Firestore types with native formats)
function processValueMutations(obj: any, existingDocData: any = {}): any {
  if (!obj || typeof obj !== 'object') {
    return obj;
  }

  const existing =
    existingDocData != null && typeof existingDocData === 'object' ? existingDocData : {};

  const result: any = Array.isArray(obj) ? [] : {};

  for (const key of Object.keys(obj)) {
    const val = obj[key];

    if (Array.isArray(val)) {
      // Arrays are replaced wholesale (e.g. encryptedShares). Do not recurse into
      // elements — null parents like encryptedShares: null would crash otherwise.
      result[key] = val;
    } else if (val && typeof val === 'object') {
      if (val._type === 'serverTimestamp') {
        result[key] = new Date().toISOString();
      } else if (val._type === 'arrayUnion') {
        const existingArray = Array.isArray(existing[key]) ? existing[key] : [];
        result[key] = Array.from(new Set([...existingArray, ...val.values]));
      } else if (val._type === 'increment') {
        const existingNum = typeof existing[key] === 'number' ? existing[key] : 0;
        result[key] = existingNum + (val.value || 0);
      } else if (val._type === 'deleteField') {
        // Handled by skipping writing this property in result
        continue;
      } else {
        const childExisting = existing[key];
        result[key] = processValueMutations(
          val,
          childExisting != null && typeof childExisting === 'object' ? childExisting : {},
        );
      }
    } else {
      result[key] = val;
    }
  }

  return result;
}

// -----------------------------------------------------------------------------
// PUBLIC DIRECT ACCESORS (USED BY CLIENT ENDPOINT HOOKS)
// -----------------------------------------------------------------------------

export async function getDocDirect(collectionName: string, id: string): Promise<any | null> {
  const pool = requirePool();
  const res = await pool.query(
    'SELECT data FROM geistdesk_documents WHERE collection = $1 AND id = $2',
    [collectionName, id]
  );
  if (res.rowCount && res.rows[0]) {
    const parsed = safeParseJson(res.rows[0].data);
    return { id, ...parsed };
  }
  return null;
}

export async function getDocsDirect(collectionName: string, constraints: any[]): Promise<any[]> {
  const pool = requirePool();
  {
    try {
      let queryStr = `SELECT id, data FROM geistdesk_documents WHERE collection = $1`;
      const queryParams: any[] = [collectionName];
      const ALLOWED_OPS = new Set(['==', '===', '!=', '>', '>=', '<', '<=']);

      // Safe JSONB constraint compilation to guarantee alignment of unassigned accounts
      for (const c of constraints) {
        if (!c || c.type !== 'where') continue;

        const field = c.field;
        const op = c.op;
        const value = c.value;

        if (typeof field !== 'string' || !field.trim()) {
          throw new Error('Invalid query constraint: field must be a non-empty string');
        }

        // 1. Unified Unassigned Check mapping both agentId / assignedTo / non-existent / empty keys
        if (field === 'agentId' || field === 'assignedTo') {
          if (value === null || value === undefined || value === '' || value === 'unassigned') {
            if (op === '==' || op === '===') {
              queryStr += ` AND (
                data->>'agentId' IS NULL 
                OR data->>'agentId' = '' 
                OR data->>'agentId' = 'unassigned'
                OR data->>'assignedTo' IS NULL 
                OR data->>'assignedTo' = ''
                OR data->>'assignedTo' = 'unassigned'
              )`;
            } else if (op === '!=') {
              queryStr += ` AND (
                data->>'agentId' IS NOT NULL 
                AND data->>'agentId' != '' 
                AND data->>'agentId' != 'unassigned'
                AND data->>'assignedTo' IS NOT NULL 
                AND data->>'assignedTo' != ''
                AND data->>'assignedTo' != 'unassigned'
              )`;
            } else {
              throw new Error(`Unsupported query operator for ${field}: ${op}`);
            }
            continue;
          }
        }

        // 2. Harmonized Casing on 'Nicht zugewiesen' / 'unassigned' / 'nicht-zugewiesen' for statuses
        if (field === 'status') {
          const valStr = String(value).toLowerCase().trim();
          if (valStr === 'unassigned' || valStr === 'nicht-zugewiesen' || valStr === 'nicht zugewiesen' || valStr === 'nicht_zugewiesen') {
            if (op === '==' || op === '===') {
              queryStr += ` AND (
                LOWER(data->>'status') = 'unassigned' 
                OR LOWER(data->>'status') = 'nicht-zugewiesen' 
                OR LOWER(data->>'status') = 'nicht zugewiesen'
                OR LOWER(data->>'status') = 'nicht_zugewiesen'
                OR data->>'status' IS NULL
              )`;
            } else if (op === '!=') {
              queryStr += ` AND (
                LOWER(data->>'status') != 'unassigned' 
                AND LOWER(data->>'status') != 'nicht-zugewiesen' 
                AND LOWER(data->>'status') != 'nicht zugewiesen'
                AND LOWER(data->>'status') != 'nicht_zugewiesen'
                AND data->>'status' IS NOT NULL
              )`;
            } else {
              throw new Error(`Unsupported query operator for status: ${op}`);
            }
            continue;
          }
        }

        // 3. Generic constraint fallback with direct values — fail closed on unknown ops
        if (!ALLOWED_OPS.has(op)) {
          throw new Error(`Unsupported query operator: ${String(op)}`);
        }
        const paramIndex = queryParams.length + 1;
        // Range comparisons must not run lexicographically on jsonb text: a
        // numeric or ISO-timestamp field is cast so SQL matches the JS value
        // semantics of the in-memory fallback filter (applyQueryConstraints).
        const isRange = op === '>' || op === '>=' || op === '<' || op === '<=';
        const castExpr = isRange ? sqlRangeCast(value, paramIndex) : `data->>$${paramIndex}`;
        if (op === '==' || op === '===') {
          queryStr += ` AND data->>$${paramIndex} = $${paramIndex + 1}`;
          queryParams.push(field, String(value));
        } else if (op === '!=') {
          queryStr += ` AND data->>$${paramIndex} != $${paramIndex + 1}`;
          queryParams.push(field, String(value));
        } else if (op === '>') {
          queryStr += ` AND ${castExpr} > $${paramIndex + 1}`;
          queryParams.push(field, String(value));
        } else if (op === '>=') {
          queryStr += ` AND ${castExpr} >= $${paramIndex + 1}`;
          queryParams.push(field, String(value));
        } else if (op === '<') {
          queryStr += ` AND ${castExpr} < $${paramIndex + 1}`;
          queryParams.push(field, String(value));
        } else if (op === '<=') {
          queryStr += ` AND ${castExpr} <= $${paramIndex + 1}`;
          queryParams.push(field, String(value));
        }
      }

      const res = await pool.query(queryStr, queryParams);
      const docs = res.rows.map(row => {
        const parsed = safeParseJson(row.data);
        return {
          id: row.id,
          ...parsed
        };
      });

      // Post-process with sorting/limits using existing in-memory constraints
      return applyQueryConstraints(docs, constraints.filter(c => c && c.type !== 'where'));
    } catch (error) {
      console.error(`[DB Error] Native SQL constraint query failed for ${collectionName}:`, error instanceof Error ? error.message : 'unknown');
      throw error;
    }
  }
}

// Cryptographically strong document identifier.
function generateDocId(): string {
  return randomUUID();
}

function toJsonbParam(value: unknown): string {
  return JSON.stringify(value ?? {});
}

export async function addDocDirect(collectionName: string, data: any): Promise<any> {
  const pool = requirePool();
  const generatedId = generateDocId();
  const processed = processValueMutations(data);
  processed.id = generatedId;

  await pool.query(
    `INSERT INTO geistdesk_documents (collection, id, data) VALUES ($1, $2, $3::jsonb)
     ON CONFLICT (collection, id) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()`,
    [collectionName, generatedId, toJsonbParam(processed)]
  );

  return { id: generatedId, data: processed };
}

/**
 * Marker-aware JSON patch build for atomic `updateDocDirect`.
 * Returns `{ expr, params }` where `expr` is a chained jsonb expression
 * applied on top of the stored `data` column, so concurrent writers never
 * clobber each other's fields (no read-modify-write in JS).
 *
 * Marker values ({ _type: 'arrayUnion' | 'increment' | 'serverTimestamp' |
 * 'deleteField' }) are resolved inside the SQL against the live row; all
 * other values replace the key wholesale (matching the previous shallow-merge
 * semantics of `{ ...existing, ...patch }`).
 */
function buildAtomicJsonbPatch(data: Record<string, unknown>) {
  // The patch is applied in the ON CONFLICT DO UPDATE SET clause, where a bare
  // `data` reference is ambiguous (target row vs EXCLUDED), so the target
  // table's column must be explicitly qualified.
  let expr = 'geistdesk_documents.data';
  const params: unknown[] = [];
  // $1 (collection), $2 (id) and $3 (insert fallback JSON) are reserved by
  // the INSERT statement, so patch params start at $4.
  let paramIndex = 4;

  for (const key of Object.keys(data)) {
    if (key === 'id') continue;
    const val = data[key];
    const keyParam = `$${paramIndex++}`;
    params.push(key);

    if (val && typeof val === 'object' && !Array.isArray(val) && (val as { _type?: string })._type === 'deleteField') {
      // data = data - 'key'
      expr = `${expr} - ${keyParam}`;
    } else if (val && typeof val === 'object' && !Array.isArray(val) && (val as { _type?: string })._type === 'arrayUnion') {
      // data = jsonb_set(data, '{key}', COALESCE(data->'key','[]') || '[added]')
      const arrParam = `$${paramIndex++}`;
      params.push(toJsonbParam((val as { values?: unknown[] }).values || []));
      expr = `jsonb_set(${expr}, ARRAY[${keyParam}], COALESCE(${expr}->${keyParam}, '[]'::jsonb) || ${arrParam}::jsonb, true)`;
    } else if (val && typeof val === 'object' && !Array.isArray(val) && (val as { _type?: string })._type === 'increment') {
      // data = jsonb_set(data, '{key}', to_jsonb(COALESCE((data->>'key')::numeric, 0) + amount))
      const amtParam = `$${paramIndex++}`;
      params.push(Number((val as { value?: unknown }).value) || 0);
      expr = `jsonb_set(${expr}, ARRAY[${keyParam}], to_jsonb(COALESCE((${expr}->>${keyParam})::numeric, 0) + ${amtParam}), true)`;
    } else if (val && typeof val === 'object' && !Array.isArray(val) && (val as { _type?: string })._type === 'serverTimestamp') {
      // data = jsonb_set(data, '{key}', to_jsonb(NOW()))
      expr = `jsonb_set(${expr}, ARRAY[${keyParam}], to_jsonb(NOW()), true)`;
    } else {
      // Plain value (object, array, scalar) — replace or create the key.
      const valParam = `$${paramIndex++}`;
      params.push(toJsonbParam(val));
      expr = `jsonb_set(${expr}, ARRAY[${keyParam}], ${valParam}::jsonb, true)`;
    }
  }

  return { expr, params };
}

export async function updateDocDirect(collectionName: string, id: string, data: any): Promise<void> {
  const pool = requirePool();
  const { expr, params } = buildAtomicJsonbPatch(data || {});

  // Atomic upsert: on a fresh row the raw (marker-resolved) JSON is inserted;
  // on an existing row the patch is applied to the live data column so
  // concurrent writers never clobber each other's fields.
  const insertJson = toJsonbParam(processValueMutations(data || {}, {}));
  await pool.query(
    `INSERT INTO geistdesk_documents (collection, id, data) VALUES ($1, $2, $3::jsonb)
     ON CONFLICT (collection, id) DO UPDATE SET data = ${expr}, updated_at = NOW()`,
    [collectionName, id, insertJson, ...params],
  );
}

export async function setDocDirect(collectionName: string, id: string, data: any): Promise<void> {
  const pool = requirePool();
  const processed = processValueMutations(data);
  delete processed.id;

  await pool.query(
    `INSERT INTO geistdesk_documents (collection, id, data) VALUES ($1, $2, $3::jsonb)
     ON CONFLICT (collection, id) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()`,
    [collectionName, id, toJsonbParam(processed)]
  );
}

export async function deleteDocDirect(collectionName: string, id: string): Promise<void> {
  const pool = requirePool();
  await pool.query(
    'DELETE FROM geistdesk_documents WHERE collection = $1 AND id = $2',
    [collectionName, id]
  );
}

// -----------------------------------------------------------------------------
// SERVER-SIDE AGGREGATIONS (computed in SQL, not in the client)
// -----------------------------------------------------------------------------

export interface TicketStats {
  total: number;
  open: number;
  pending: number;
  resolved: number;
  closed: number;
  unassigned: number;
  urgent: number;
}

/**
 * Compute ticket dashboard counts directly in PostgreSQL so every client
 * (sandbox or production) sees identical, authoritative figures.
 */
export async function getTicketStats(): Promise<TicketStats> {
  const pool = requirePool();
  const res = await pool.query(`
    SELECT
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE LOWER(data->>'status') = 'open')::int AS open,
      COUNT(*) FILTER (WHERE LOWER(data->>'status') = 'pending')::int AS pending,
      COUNT(*) FILTER (WHERE LOWER(data->>'status') = 'resolved')::int AS resolved,
      COUNT(*) FILTER (WHERE LOWER(data->>'status') = 'closed')::int AS closed,
      COUNT(*) FILTER (WHERE COALESCE(data->>'agentId', '') = '')::int AS unassigned,
      COUNT(*) FILTER (WHERE LOWER(data->>'priority') = 'urgent')::int AS urgent
    FROM geistdesk_documents
    WHERE collection = 'tickets'
  `);
  const row = res.rows[0] || {};
  return {
    total: row.total || 0,
    open: row.open || 0,
    pending: row.pending || 0,
    resolved: row.resolved || 0,
    closed: row.closed || 0,
    unassigned: row.unassigned || 0,
    urgent: row.urgent || 0
  };
}

// -----------------------------------------------------------------------------
// FIRESTORE COMPATIBILITY LAYER / SDK MOCKER FOR SERVER-SIDE DB INTEGRATION
// -----------------------------------------------------------------------------

export class ServerCollectionRef {
  constructor(private collectionName: string) {}

  where(field: string, op: string, value: any) {
    return new ServerCollectionQuery(this.collectionName, [{ type: 'where', field, op, value }]);
  }

  orderBy(field: string, direction: 'asc' | 'desc' = 'asc') {
    return new ServerCollectionQuery(this.collectionName, [{ type: 'orderBy', field, direction }]);
  }

  limit(count: number) {
    return new ServerCollectionQuery(this.collectionName, [{ type: 'limit', count }]);
  }

  async get() {
    const docs = await getDocsDirect(this.collectionName, []);
    return new ServerQuerySnapshot(docs);
  }

  async add(data: any) {
    const res = await addDocDirect(this.collectionName, data);
    return new ServerDocRef(this.collectionName, res.id);
  }

  doc(id: string) {
    return new ServerDocRef(this.collectionName, id);
  }
}

class ServerCollectionQuery {
  constructor(private collectionName: string, private constraints: any[]) {}

  where(field: string, op: string, value: any) {
    return new ServerCollectionQuery(this.collectionName, [...this.constraints, { type: 'where', field, op, value }]);
  }

  orderBy(field: string, direction: 'asc' | 'desc' = 'asc') {
    return new ServerCollectionQuery(this.collectionName, [...this.constraints, { type: 'orderBy', field, direction }]);
  }

  limit(count: number) {
    return new ServerCollectionQuery(this.collectionName, [...this.constraints, { type: 'limit', count }]);
  }

  async get() {
    const docs = await getDocsDirect(this.collectionName, this.constraints);
    return new ServerQuerySnapshot(docs);
  }
}

class ServerQuerySnapshot {
  constructor(private rawDocs: any[]) {}
  get empty() {
    return this.rawDocs.length === 0;
  }
  get docs() {
    return this.rawDocs.map(d => new ServerDocSnapshot(d.id || d.customId, d));
  }
}

class ServerDocSnapshot {
  constructor(public id: string, private rawData: any) {}
  get exists() {
    return !!this.rawData;
  }
  data() {
    return this.rawData;
  }
  get ref() {
    return new ServerDocRef('tickets', this.id);
  }
}

export class ServerDocRef {
  constructor(private collectionName: string, public id: string) {}

  collection(subCollectionName: string) {
    return new ServerCollectionRef(`${this.collectionName}/${this.id}/${subCollectionName}`);
  }

  async get() {
    const data = await getDocDirect(this.collectionName, this.id);
    return new ServerDocSnapshot(this.id, data);
  }

  async update(data: any) {
    await updateDocDirect(this.collectionName, this.id, data);
  }

  async set(data: any) {
    await setDocDirect(this.collectionName, this.id, data);
  }
}

// Emulated Database Wrapper Instance
export function getDb() {
  return {
    collection: (name: string) => new ServerCollectionRef(name)
  };
}

/** @internal Regression-tested by scripts/verify-process-value-mutations.mjs */
export { processValueMutations };
