import type { McpScope } from '../lib/api-tokens.js';

/** Per-request context available to MCP tool handlers. */
export interface McpActorContext {
  userId: string;
  userEmail: string;
  userName: string;
  role: string;
  isAdmin: boolean;
  tenantId: string;
  scopes: McpScope[];
  tokenId?: string;
  authMethod: 'api_token' | 'session';
  systemInstructions: string;
}

export function toolError(message: string): { content: Array<{ type: 'text'; text: string }>; isError: true } {
  return {
    isError: true,
    content: [{ type: 'text', text: message }],
  };
}

export function toolJson(payload: unknown): { content: Array<{ type: 'text'; text: string }> } {
  return {
    content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }],
  };
}
