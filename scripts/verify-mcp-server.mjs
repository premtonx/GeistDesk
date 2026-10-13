/**
 * Smoke-checks that MCP modules resolve and tool names match the contract.
 * Run: node scripts/verify-mcp-server.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sdkPath = path.join(root, 'node_modules/@modelcontextprotocol/sdk/package.json');
assert(fs.existsSync(sdkPath), 'MCP SDK package missing');
const sdk = JSON.parse(fs.readFileSync(sdkPath, 'utf8'));

const expectedTools = [
  'geistkb_search',
  'geistkb_get_article',
  'geistkb_create_article',
  'tickets_list',
  'tickets_get',
  'tickets_update_status',
  'vault_search_secrets',
  'vault_get_secret',
];

const toolFiles = [
  'src/mcp/tools/geistkb.ts',
  'src/mcp/tools/tickets.ts',
  'src/mcp/tools/vault.ts',
];
const joined = toolFiles.map((f) => fs.readFileSync(path.join(root, f), 'utf8')).join('\n');
for (const name of expectedTools) {
  assert(joined.includes(`'${name}'`) || joined.includes(`"${name}"`), `Missing tool registration: ${name}`);
}

assert(fs.existsSync(path.join(root, 'src/routes/mcpRoutes.ts')), 'mcpRoutes.ts missing');
assert(fs.existsSync(path.join(root, 'src/components/admin/hub/AdminHubMcpPanel.tsx')), 'AdminHubMcpPanel missing');
assert(fs.readFileSync(path.join(root, 'package.json'), 'utf8').includes('"@modelcontextprotocol/sdk"'), 'package.json missing MCP SDK dep');

console.log(`OK — MCP SDK ${sdk.version}; ${expectedTools.length} tools present`);
