#!/usr/bin/env npx tsx
/**
 * CLI: npm run seed:demo
 * Seeds realistic IT-operations demo data (tickets, KB, vault, exchange).
 *
 *   npm run seed:demo
 *   npm run seed:demo:dev
 *   SEED_DEMO_DATA=true npm run seed:prod   # also triggers once on boot when set
 */
import 'dotenv/config';
import { initDb, getDocsDirect } from '../src/lib/postgres-backend.js';
import {
  getDemoDataStatus,
  previewDemoSimulationKpis,
  resetDemoData,
  seedDemoData,
} from '../src/services/seedService.js';

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

  const args = new Set(process.argv.slice(2));
  await initDb();

  if (args.has('--reset') || args.has('--purge')) {
    const result = await resetDemoData({ replaceLegacySamples: true });
    console.log('[seed-demo] Reset:', result);
    return;
  }

  const actor = await resolveActor();
  const preview = previewDemoSimulationKpis();
  console.log('[seed-demo] Expected dataset:', preview);

  const skipIfPresent = args.has('--skip-if-present') || process.env.SEED_DEMO_DATA === 'true';
  if (skipIfPresent && !args.has('--force')) {
    const status = await getDemoDataStatus();
    if (status.seeded) {
      console.log('[seed-demo] Demo data already present — skipping (use --force to replace).', status);
      return;
    }
  }

  const result = await seedDemoData({
    ...actor,
    replaceLegacySamples: !args.has('--keep-legacy'),
    skipIfPresent: false,
  });
  console.log('[seed-demo] Seeded:', result);
}

main().catch((error) => {
  console.error('[seed-demo] Failed:', error);
  process.exit(1);
});
