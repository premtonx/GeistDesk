/**
 * AI Orchestrator types — barrel entry.
 *
 * Split from the former monolith `src/types/aiOrchestrator.ts` into focused
 * modules. All historical public names are re-exported here so existing
 * importers keep working unchanged.
 */
export * from './feature-ids.js';
export * from './providers.js';
export * from './config.js';
export * from './routing.js';
export * from './lifecycle.js';
export * from './health.js';
export * from './personas.js';
