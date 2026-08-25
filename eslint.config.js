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
   * @astera/rules must stay pure: zero runtime dependencies, no clock, no
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
              group: ['@astera/*', 'drizzle-orm*', 'postgres', 'fastify*', 'zod'],
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

  /**
   * Development tooling, deliberately exempt from type-aware linting.
   *
   * These scripts run in Node but carry code that executes inside a browser page
   * — everything passed to `page.evaluate` is compiled and run somewhere else
   * entirely. Type-aware rules need one type context per file and there are two
   * here, so they report every DOM reference as unsafe. Turning them off for this
   * directory is honest; annotating browser code as if it were Node would not be.
   *
   * Nothing here ships: no application code imports it.
   */
  {
    files: ['tools/**/*.mjs'],
    extends: [tseslint.configs.disableTypeChecked],
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
    rules: {
      'no-undef': 'off',
      'no-console': 'off',
    },
  },

  /**
   * The client runs in a browser, not in Node. Without this every `window`,
   * `document` and `setTimeout` reads as an undefined global.
   */
  {
    files: ['apps/web/**/*.{ts,tsx}'],
    languageOptions: { globals: { ...globals.browser } },
  },

  /**
   * THE SCALES ARE ENFORCED, BECAUSE THEY WERE ONCE ONLY WRITTEN DOWN.
   *
   * `styles.css` has carried a type scale for a long time, with a comment saying
   * it existed "so the sprawl of arbitrary text-[13px] can end". It did not end:
   * a later audit counted 346 hand-written `text-[Npx]` declarations in eighteen
   * distinct sizes against nineteen uses of the tokens, eighteen different
   * letter-spacings (two of them the same number spelled differently), and nine
   * corner radii live on a single screen.
   *
   * A convention that is only documented decays back to whatever each author
   * types. This is the same rule with teeth: use `text-title`, not `text-[18px]`.
   * If a new step is genuinely needed, add it to `@theme` where the whole
   * interface can see it — that is the change the arbitrary value was avoiding.
   *
   * Arbitrary values for things that are NOT on a scale — a one-off `size-[74px]`
   * socket, a `max-w-[34ch]` measure, a `shadow-[…]` — stay allowed. Only the
   * three sprawling scales are closed.
   */
  {
    files: ['apps/web/src/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector:
            'Literal[value=/(?:^|[\\s"\'`])(?:text|tracking|rounded)-\\[/]',
          message:
            'Use the scale: text-{micro,label,caption,body,title,figure,readout,hero}, '
            + 'tracking-{label,wide}, rounded-{cell,chip,control,plate,sheet,pill}. '
            + 'A new step goes in @theme, not in a class.',
        },
        {
          selector:
            'TemplateElement[value.raw=/(?:^|[\\s"\'`])(?:text|tracking|rounded)-\\[/]',
          message:
            'Use the scale: text-{micro,label,caption,body,title,figure,readout,hero}, '
            + 'tracking-{label,wide}, rounded-{cell,chip,control,plate,sheet,pill}. '
            + 'A new step goes in @theme, not in a class.',
        },
      ],
    },
  },

  /** Tests may use assertion-focused syntax, but their data flow stays type-safe. */
  {
    files: ['**/test/**/*.ts', '**/*.test.ts'],
    rules: {
      '@typescript-eslint/no-non-null-assertion': 'off',
      'no-restricted-syntax': 'off',
    },
  },
);
