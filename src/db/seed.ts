// GeistDesk database seeding utility.
//
// Populates the `geistdesk_documents` PostgreSQL table with structural sample
// data (users, tickets) using parameterized batch INSERTs. Passwords from the
// dataset are hashed with Argon2id before insertion — plaintext is NEVER
// written to the database.
//
// Usage:
//   DATABASE_URL=postgres://... VAULT_ENCRYPTION_KEY=... npm run seed
//
// This script is idempotent: re-running upserts the same rows by (collection, id).

import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";
import pg from "pg";
import { hashPassword } from "../lib/crypto.js";

const { Pool } = pg;

const DATABASE_URL = process.env.DATABASE_URL || process.env.PG_DATABASE_URL;
if (!DATABASE_URL) {
  console.error("[seed] DATABASE_URL is required.");
  process.exit(1);
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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

async function main() {
  const datasetPath = path.join(__dirname, "seed-data.json");
  const dataset: SeedDataset = JSON.parse(readFileSync(datasetPath, "utf-8"));

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
    await client.query(DDL);

    // Hash passwords for user rows; never persist plaintext.
    const users = [];
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

    const tickets = dataset.tickets.map(t => ({
      ...t,
      createdAt: t.createdAt || new Date().toISOString(),
      updatedAt: t.updatedAt || new Date().toISOString()
    }));

    await client.query("BEGIN");
    const u = await batchUpsert(client, "users", users);
    const k = await batchUpsert(client, "tickets", tickets);
    await client.query("COMMIT");

    console.log(`[seed] Upserted ${u} users and ${k} tickets into geistdesk_documents.`);
    console.log("[seed] Done. Default seeded credentials are dev-only — rotate them immediately.");
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
