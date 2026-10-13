/**
 * Backward-compatible re-exports for the demo simulation seeder.
 * Implementation lives in `src/services/seedService.ts`.
 */

export {
  DEMO_SIM_PREFIX,
  DEMO_TICKET_PREFIX,
  DEMO_EXCHANGE_PREFIX,
  DEMO_VAULT_PREFIX,
  DEMO_MESSAGE_PREFIX,
  DEMO_KB_PREFIX,
  DEMO_AUDIT_PREFIX,
  DEMO_CATALOG_COLLECTION,
  DEMO_VAULT_SECRETS,
  seedDemoData,
  seedDemoSimulation,
  resetDemoData,
  getDemoDataStatus,
  previewDemoSimulationKpis,
} from '../services/seedService.js';

export type {
  DemoSeedOptions,
  DemoSeedResult,
  DemoDataStatus,
  DemoSeedOptions as DemoSimulationSeedOptions,
  DemoSeedResult as DemoSimulationSeedResult,
} from '../services/seedService.js';
