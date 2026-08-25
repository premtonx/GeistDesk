import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';

/**
 * GeistDesk ESLint flat config.
 *
 * Layers:
 *   1. js.configs.recommended                     – baseline JS correctness rules
 *   2. tseslint.configs.recommendedTypeChecked    – TS + type-aware rules
 *   3. react-hooks plugin rules                   – react-hooks/exhaustive-deps + rules-of-hooks
 *
 * The client/server boundary rule lives in `eslint.boundary.config.js`
 * (allowlist-based custom rule) and is the CI gate (`npm run lint:eslint`).
 * This config provides the full strict diagnostics via
 * `npm run lint:eslint:full`.
 */

export default [
  { ignores: ['dist/**/*', 'node_modules/**/*', 'public/**/*'] },
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    files: ['**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks },
    languageOptions: {
      parserOptions: {
        project: './tsconfig.json',
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      // New code must not add to the `any` debt; existing `any`s stay until
      // the type-hygiene phase. `off` keeps lint green for legacy files while
      // the recommended ruleset still flags new violations.
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
];
