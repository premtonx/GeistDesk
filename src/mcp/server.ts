import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { getMcpActor } from './context.js';
import { registerGeistKbTools } from './tools/geistkb.js';
import { registerTicketTools } from './tools/tickets.js';
import { registerVaultTools } from './tools/vault.js';

/**
 * Build a fresh MCP server instance with GeistDesk tools.
 * One instance per Streamable HTTP session / request factory.
 */
export function createGeistDeskMcpServer(): McpServer {
  const server = new McpServer({
    name: 'geistdesk',
    version: '1.0.0',
  });

  registerGeistKbTools(server);
  registerTicketTools(server);
  registerVaultTools(server);

  server.registerPrompt(
    'geistdesk_system_guidance',
    {
      title: 'GeistDesk system guidance',
      description:
        'Workspace-configured additional guidance that MCP clients should prepend to their system prompt.',
    },
    async () => {
      const actor = getMcpActor();
      const guidance =
        actor.systemInstructions?.trim() ||
        'Prioritize searching GeistKB before proposing infrastructure modifications. Respect vault audit requirements.';
      return {
        description: 'GeistDesk workspace guidance',
        messages: [
          {
            role: 'user' as const,
            content: {
              type: 'text' as const,
              text: guidance,
            },
          },
        ],
      };
    },
  );

  return server;
}
