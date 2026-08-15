import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';
import { defineConfig } from 'eslint/config';

export default defineConfig(
  { ignores: ['**/dist/**', '**/node_modules/**', 'legacy/**', '**/drizzle/**'] },

  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,

  {
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
      globals: { ...globals.node },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/restrict-template-expressions': [
        'error',
        { allowNumber: true, allowBoolean: true },
      ],
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { fixStyle: 'inline-type-imports' },
      ],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      // Drizzle's `.returning()` gives an array; the row is guaranteed by the
      // insert succeeding, so `!` is the honest expression of that.
      '@typescript-eslint/no-non-null-assertion': 'off',
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      'no-console': 'off',
    },
  },

  /**
   * THE ARCHITECTURAL BOUNDARY, mechanically enforced.
   *
   * @blindspace/rules must stay pure: zero runtime dependencies, no clock, no
   * I/O, no ambient randomness. This is the invariant the whole design rests on
   * — the server, the simulator and the client can only agree about outcomes if
   * the rules cannot observe anything but their arguments.
   */
  {
    files: ['packages/rules/src/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['node:*', 'fs', 'path', 'crypto', 'os', 'http*'],
              message: 'rules must be I/O-free — no Node builtins',
            },
            {
              group: ['@blindspace/*', 'drizzle-orm*', 'postgres', 'fastify*', 'zod'],
              message: 'rules must have zero runtime dependencies',
            },
          ],
        },
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector: "CallExpression[callee.object.name='Math'][callee.property.name='random']",
          message: 'rules must be deterministic — take an Rng argument instead',
        },
        {
          selector: "CallExpression[callee.object.name='Date'][callee.property.name='now']",
          message: 'rules must be clock-free — take the time as an argument instead',
        },
        {
          selector: "NewExpression[callee.name='Date']",
          message: 'rules must be clock-free — take the time as an argument instead',
        },
      ],
    },
  },

  /** Tests may be looser about assertions; they are the thing making the claims. */
  {
    files: ['**/test/**/*.ts', '**/*.test.ts'],
    rules: {
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
      'no-restricted-syntax': 'off',
    },
  },
);
