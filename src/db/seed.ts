// GeistDesk database seeding utility.
//
// Always stamps platform defaults (module_config.is_initialized=false on fresh
// boots, prompt templates). Demo vault folders are purged, never inserted.
// Fixture users/tickets from seed-data.json are
// inserted only when ENABLE_DEMO_LOGIN=true on a non-production runtime.
// Passwords are hashed with Argon2id — plaintext is NEVER written to the database.
//
// Usage:
//   DATABASE_URL=postgres://... VAULT_ENCRYPTION_KEY=... npm run seed
//
// This script is idempotent: re-running upserts the same rows by (collection, id).

import "dotenv/config";
import pg from "pg";
import { hashPassword } from "../lib/crypto.js";
import { initDb } from "../lib/postgres-backend.js";
// Bundled directly into dist/seed.cjs at build time so the production image
// (which ships no source files) can still run the seeder.
import seedDatasetJson from "./seed-data.json";
import { seedAllPlatformDefaults } from "./seed-platform-defaults.js";
import { isDemoLoginEnabled } from "../lib/runtime-env.js";
import { seedDemoSimulation } from "../lib/demo-simulation-seed.js";

const { Pool } = pg;

const DATABASE_URL = process.env.DATABASE_URL || process.env.PG_DATABASE_URL;
if (!DATABASE_URL) {
  console.error("[seed] DATABASE_URL is required.");
  process.exit(1);
}

interface SeedDataset {
  users: any[];
  tickets: any[];
}

const DDL = `
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
`;

/**
 * Batch-insert an array of {id, ...data} documents into a collection using a
 * single multi-row parameterized statement. Upserts on (collection, id).
 */
async function batchUpsert(client: pg.PoolClient, collection: string, rows: any[]): Promise<number> {
  if (rows.length === 0) return 0;

  const valueClauses: string[] = [];
  const params: any[] = [];
  let p = 1;

  for (const row of rows) {
    const { id, ...rest } = row;
    if (!id) throw new Error(`[seed] Row in '${collection}' is missing an id.`);
    valueClauses.push(`($${p++}, $${p++}, $${p++})`);
    params.push(collection, id, rest);
  }

  const sql = `
    INSERT INTO geistdesk_documents (collection, id, data)
    VALUES ${valueClauses.join(", ")}
    ON CONFLICT (collection, id) DO UPDATE
      SET data = EXCLUDED.data, updated_at = NOW()
  `;
  await client.query(sql, params);
  return rows.length;
}

/**
 * Remove legacy/duplicate user rows that share a seeded email but live under a
 * different id. The persistent DB volume survives every redeploy, so stale
 * pre-hardening records (without a passwordHash, or with a downgraded role) can
 * otherwise shadow the canonical seeded account at login and in the UI.
 */
async function purgeStaleDuplicateUsers(client: pg.PoolClient, users: any[]): Promise<number> {
  let removed = 0;
  for (const u of users) {
    const email = String(u.email || "").toLowerCase().trim();
    if (!email || !u.id) continue;
    const result = await client.query(
      `DELETE FROM geistdesk_documents
        WHERE collection = 'users'
          AND id <> $1
          AND lower(trim(data->>'email')) = $2`,
      [u.id, email]
    );
    removed += result.rowCount || 0;
  }
  return removed;
}

async function main() {
  const dataset: SeedDataset = seedDatasetJson as SeedDataset;

  const isLocal =
    DATABASE_URL!.includes("localhost") ||
    DATABASE_URL!.includes("127.0.0.1") ||
    DATABASE_URL!.includes("sslmode=disable");

  const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: isLocal ? false : { rejectUnauthorized: process.env.DATABASE_SSL_INSECURE !== "true" }
  });

  const client = await pool.connect();
  try {
    await initDb();
    await client.query(DDL);

    const seedDemoFixtures = isDemoLoginEnabled();
    const users = [];
    const tickets = [];

    if (seedDemoFixtures) {
      // Hash passwords for showcase users; never persist plaintext.
      for (const u of dataset.users) {
        const { password, ...rest } = u;
        const passwordHash = password ? await hashPassword(password) : undefined;
        users.push({
          ...rest,
          ...(passwordHash ? { passwordHash } : {}),
          createdAt: rest.createdAt || new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
      }
      // Ticket fixtures come from the production-simulation seeder (relative dates + KPIs).
    } else {
      console.log(
        "[seed] Skipping demo users/tickets — ENABLE_DEMO_LOGIN is unset or this is a production runtime.",
      );
    }

    await client.query("BEGIN");
    const purged = seedDemoFixtures ? await purgeStaleDuplicateUsers(client, users) : 0;
    const u = await batchUpsert(client, "users", users);
    const k = await batchUpsert(client, "tickets", tickets);
    const platform = await seedAllPlatformDefaults(client);
    await client.query("COMMIT");

    let simulation = { tickets: 0, messages: 0, vaultSecrets: 0, exchangeSessions: 0, personas: 0, purged: 0 };
    if (seedDemoFixtures) {
      const actor =
        users.find((user) => user.role === "admin" || user.is_admin) || users[0] || { id: "user-demo-admin" };
      simulation = await seedDemoSimulation({
        actorUserId: String(actor.id || "user-demo-admin"),
        actorName: String(actor.name || "Demo Administrator"),
        actorEmail: String(actor.email || "demo@geistdesk.com"),
        replaceLegacySamples: true,
      });
    }

    if (purged > 0) {
      console.log(`[seed] Purged ${purged} stale duplicate user row(s) sharing a seeded email.`);
    }
    if (seedDemoFixtures) {
      console.log(`[seed] Upserted ${u} users into geistdesk_documents.`);
      console.log(
        `[seed] Simulation: ${simulation.tickets} tickets, ${simulation.vaultSecrets} vault secrets, ${simulation.exchangeSessions} exchange sessions, ${simulation.personas} personas (purged ${simulation.purged}).`,
      );
    } else {
      console.log("[seed] Fresh boot: no fixture users. Complete /onboarding to create the primary admin.");
    }
    if (platform.moduleConfig) {
      console.log("[seed] Seeded module_config/global with is_initialized=false (First-Run Wizard required).");
    }
    if (platform.vaultFolders > 0) {
      console.log(`[seed] Purged ${platform.vaultFolders} leftover demo vault_folders (folder-seed-*).`);
    }
    if (platform.kbCategoriesPurged > 0) {
      console.log(`[seed] Purged ${platform.kbCategoriesPurged} leftover placeholder kb_categories.`);
    }
    if (platform.kbSeedArticlesPurged > 0) {
      console.log(`[seed] Purged ${platform.kbSeedArticlesPurged} leftover frontend seed kb_articles.`);
    }
    if (platform.kbCoveragePurged > 0) {
      console.log(`[seed] Cleared ${platform.kbCoveragePurged} stale kb_coverage cache rows.`);
    }
    if (platform.autopilotPurged > 0) {
      console.log(`[seed] Purged ${platform.autopilotPurged} leftover Autopilot demo fixtures.`);
    }
    if (platform.promptTemplates > 0) {
      console.log(`[seed] Inserted ${platform.promptTemplates} German ai_prompt_templates.`);
    }
    if (platform.personaSkills) {
      console.log("[seed] Seeded default German persona_skills_json on orchestrator config.");
    }
    const initFlag = await client.query(
      `SELECT data->>'is_initialized' AS is_initialized
         FROM geistdesk_documents
        WHERE collection = 'module_config' AND id = 'global'`,
    );
    console.log(
      `[seed] module_config.is_initialized=${initFlag.rows[0]?.is_initialized ?? '(missing)'}`,
    );
    console.log("[seed] Done. Production boots stay uninitialized until the first-run wizard completes.");
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("[seed] Failed:", err);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

main();
