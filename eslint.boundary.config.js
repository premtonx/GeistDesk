import path from 'node:path';
import tseslint from 'typescript-eslint';

/**
 * Boundary-only ESLint config used by `npm run lint:eslint` in CI.
 *
 * Enforces the client/server boundary with an allowlist-based rule: client code
 * (`src/components/*`, `src/hooks/*`, `src/context/*`) may only import the
 * browser-safe helpers in BROWSER_SAFE_LIB_MODULES from `src/lib/`. Anything
 * else under `src/lib/` (postgres-backend, job-queue, crypto, orchestrator
 * store, ...) is treated as server-only and rejected.
 *
 * Run `npm run lint:eslint:full` locally for the complete (non-blocking)
 * typescript-eslint + React Hooks diagnostics.
 */

const BROWSER_SAFE_LIB_MODULES = new Set([
  // generic utilities / hooks
  'src/lib/utils',
  'src/lib/hooks',
  'src/lib/runtime-env',
  'src/lib/firebase',
  'src/lib/firebase-custom-client',
  'src/lib/sanitize-html',
  'src/lib/safe-log',
  'src/lib/text-diff',
  'src/lib/account-health',
  'src/lib/dashboard-format-utils',
  'src/lib/route-params',
  'src/lib/beta-admin-bypass',
  'src/lib/client-aes-gcm',
  // contexts (React providers, browser-safe)
  'src/lib/context/I18nContext',
  'src/lib/context/SidebarContext',
  'src/lib/context/WorkspaceContext',
  // AI client-side adapters (axios/fetch-based, no Node-only imports)
  'src/lib/aiLifecycleClient',
  'src/lib/aiOrchestratorClient',
  'src/lib/ticket-ai-analysis',
  'src/lib/polyglot-bridge',
  'src/lib/polyglot-translate-service',
  'src/lib/client-ai-local',
  'src/lib/ai/pii-shield',
  'src/lib/ai/human-diff-learning',
  'src/lib/ai/provider-adapter',
  'src/lib/ai-orchestrator-policies',
  'src/lib/persistOrchestratorPatch',
  'src/lib/orchestratorService',
  'src/lib/rag-pipeline-config',
  // KB helpers (pure functions)
  'src/lib/kb-dashboard-metrics',
  'src/lib/kb-article-defaults',
  'src/lib/kb-category-icons',
  'src/lib/kb-demo-purge',
  // ticket helpers (pure functions / prefs)
  'src/lib/ticketWorkspace',
  'src/lib/ticketViewFilters',
  'src/lib/ticketsSidebarPreferences',
  'src/lib/ticket-checklist-utils',
  'src/lib/email-forwarding-address',
  'src/lib/ticket-kanban-status',
  // module config (localStorage-backed, browser-safe)
  'src/lib/module-config',
  // vault/exchange client helpers (plaintext stays in the browser)
  'src/lib/vault-dropzone-utils',
  'src/lib/oauth-device-flow',
  'src/lib/vaultRequestUtils',
  'src/lib/demo-simulation-seed',
  'src/lib/vault-service',
  'src/lib/vault-import-processor',
  'src/lib/credential-vault-export',
  'src/lib/credential-vault-sync',
  'src/lib/credential-vault-crypto',
]);

const boundaryRule = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Forbid client-side code from importing server-only modules under src/lib/',
    },
    messages: {
      serverImport:
        'Client code must not import "{{path}}" (server-only). Use src/services/* for API calls or move shared logic to src/shared/.',
      unknownLib:
        'Import of "{{path}}" is not on the browser-safe allowlist. If it is safe for the browser, add it to BROWSER_SAFE_LIB_MODULES in eslint.boundary.config.js.',
    },
    schema: [],
  },
  create(context) {
    const filename = context.filename ?? context.getFilename();
    const projectRoot = path.resolve(import.meta.dirname);
    const filePath = path.resolve(filename);

    return {
      ImportDeclaration(node) {
        const specifier = node.source.value;
        if (!specifier || !specifier.startsWith('.')) return;
        if (!specifier.includes('/lib/') && !specifier.includes('/lib')) return;

        const baseDir = path.dirname(filePath);
        let resolved;
        try {
          resolved = path.resolve(baseDir, specifier);
        } catch {
          return;
        }
        resolved = resolved.replace(/[\\/]index$/, '').replace(/\.[jt]sx?$/, '');
        const rel = path.relative(projectRoot, resolved).replace(/\\/g, '/');
        if (!rel.startsWith('src/lib/') && rel !== 'src/lib') return;

        if (BROWSER_SAFE_LIB_MODULES.has(rel)) return;

        context.report({
          node,
          messageId: 'serverImport',
          data: { path: rel },
        });
      },
    };
  },
};

export default [
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        project: './tsconfig.json',
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    files: ['src/components/**/*.{ts,tsx}', 'src/hooks/**/*.{ts,tsx}', 'src/context/**/*.{ts,tsx}'],
    plugins: { 'geistdesk-boundary': { rules: { 'no-server-import': boundaryRule } } },
    rules: {
      'geistdesk-boundary/no-server-import': 'error',
    },
  },
];
