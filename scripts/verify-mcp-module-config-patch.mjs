/**
 * Reproduces the MCP toggle 400: full hydrated module-config payloads (with
 * unknown keys like `id`) must validate, and mcp-only patches must parse.
 */
import { z } from 'zod';

const moduleConfigPatchSchema = z.object({
  is_initialized: z.boolean().optional(),
  platformModules: z
    .object({
      geistKB: z.boolean().optional(),
      geistVault: z.boolean().optional(),
      geistExchange: z.boolean().optional(),
    })
    .optional(),
  mcp: z
    .object({
      enabled: z.boolean().optional(),
      systemInstructions: z.string().max(20_000).optional(),
      customInstructions: z.string().max(20_000).optional(),
    })
    .optional(),
});

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

// Former bug: .strict() rejected `id` from GET → PUT round-trip.
const hydrated = {
  id: 'global',
  initializedAt: '2026-01-01T00:00:00.000Z',
  onboardingSteps: { secretsStored: true },
  is_initialized: true,
  mcp: { enabled: true, systemInstructions: 'Prefer GeistKB first.' },
  platformModules: { tickets: true, geistKB: true, geistVault: true, geistExchange: true },
};

const full = moduleConfigPatchSchema.safeParse(hydrated);
assert(full.success, `hydrated payload should parse: ${JSON.stringify(full.error?.flatten())}`);
assert(full.data.mcp?.enabled === true, 'mcp.enabled preserved');
assert(full.data.id === undefined, 'unknown id stripped');

const focused = moduleConfigPatchSchema.safeParse({ mcp: { enabled: false } });
assert(focused.success, 'mcp-only patch should parse');
assert(focused.data.mcp?.enabled === false, 'mcp.enabled false');

const alias = moduleConfigPatchSchema.safeParse({
  mcp: { enabled: true, customInstructions: 'Outline-style guidance' },
});
assert(alias.success, 'customInstructions alias should parse');

console.log('OK — module-config MCP patch validation accepts hydrated + focused payloads');
