import { AsyncLocalStorage } from 'async_hooks';
import type { McpActorContext } from './types.js';
import { hasScope, type McpScope } from '../lib/api-tokens.js';
import { toolError } from './types.js';

export const mcpActorStore = new AsyncLocalStorage<McpActorContext>();

export function getMcpActor(): McpActorContext {
  const ctx = mcpActorStore.getStore();
  if (!ctx) {
    throw new Error('MCP actor context is not available for this request.');
  }
  return ctx;
}

export function requireMcpScope(scope: McpScope) {
  const actor = getMcpActor();
  if (!hasScope(actor.scopes, scope)) {
    return toolError(`Forbidden: API token is missing required scope "${scope}".`);
  }
  return null;
}
