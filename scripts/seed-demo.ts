#!/usr/bin/env npx tsx
/**
 * CLI: npm run seed:demo
 * Seeds the production-simulation dataset (tickets, vault catalog, exchange, personas).
 */
import 'dotenv/config';
import { initDb, getDocsDirect } from '../src/lib/postgres-backend.js';
import { previewDemoSimulationKpis, seedDemoSimulation } from '../src/lib/demo-simulation-seed.js';

async function resolveActor() {
  const users = await getDocsDirect('users', []);
  const admin =
    users.find((user) => user.role === 'SYSTEM_ADMIN' || user.role === 'admin' || user.is_admin) ||
    users[0];
  return {
    actorUserId: String(admin?.id || process.env.DEMO_SEED_USER_ID || 'user-demo-admin'),
    actorName: String(admin?.name || 'Demo Administrator'),
    actorEmail: String(admin?.email || 'demo@geistdesk.com'),
    tenantId: String(admin?.tenantId || 'default'),
  };
}

async function main() {
  if (!process.env.DATABASE_URL && !process.env.PG_DATABASE_URL) {
    console.error('[seed-demo] DATABASE_URL is required.');
    process.exit(1);
  }
  await initDb();
  const actor = await resolveActor();
  const preview = previewDemoSimulationKpis();
  console.log('[seed-demo] Expected KPIs:', preview);
  const result = await seedDemoSimulation({ ...actor, replaceLegacySamples: true });
  console.log('[seed-demo] Seeded:', result);
}

main().catch((error) => {
  console.error('[seed-demo] Failed:', error);
  process.exit(1);
});
