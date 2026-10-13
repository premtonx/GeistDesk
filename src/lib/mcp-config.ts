/**
 * MCP server workspace settings stored on module_config/global.
 */

export interface McpWorkspaceSettings {
  /** When false, /api/mcp rejects all client connections. */
  enabled: boolean;
  /** Additional guidance prepended for MCP clients (system prompt helper). */
  systemInstructions: string;
}

export const DEFAULT_MCP_SETTINGS: McpWorkspaceSettings = {
  enabled: false,
  systemInstructions:
    'Prioritize searching GeistKB before proposing infrastructure modifications. Always provide a reason when revealing vault secrets.',
};

export function normalizeMcpSettings(
  raw: Partial<McpWorkspaceSettings> | Record<string, unknown> | undefined,
): McpWorkspaceSettings {
  const source = (raw ?? {}) as Partial<McpWorkspaceSettings> & {
    customInstructions?: unknown;
  };
  const instructions =
    typeof source.systemInstructions === 'string'
      ? source.systemInstructions
      : typeof source.customInstructions === 'string'
        ? source.customInstructions
        : DEFAULT_MCP_SETTINGS.systemInstructions;
  return {
    enabled: source.enabled === true,
    systemInstructions: instructions,
  };
}
