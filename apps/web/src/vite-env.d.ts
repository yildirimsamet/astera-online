/// <reference types="vite/client" />

/**
 * THE BUILD-TIME CONFIGURATION, TYPED.
 *
 * Vite's own `ImportMetaEnv` allows any key and types every one of them as `any`,
 * which means a typo in `import.meta.env.VITE_GA_IDD` compiles, reads `undefined`
 * and silently disables the thing it configures. Declaring the keys here turns
 * both of those into compile errors — and `@typescript-eslint/no-unsafe-assignment`
 * refuses the `any` in the first place, which is how this file came to exist.
 *
 * Optional, because it genuinely is: a build with no measurement id installs no
 * tag at all. See `lib/analytics.ts`.
 */
interface ImportMetaEnv {
  /** Google Analytics 4 measurement id, `G-XXXXXXXXXX`. Unset means no analytics. */
  readonly VITE_GA_ID?: string;
  /** Local reference archive, supplied by the development server only. */
  readonly VITE_ASTERA_REFERENCE_ART?: string;
  /** Admin prototype entry outside local development; only '1' opens it. */
  readonly VITE_ARENA?: string;
  /** Explicitly built visual-test sandbox; never set for a public build. */
  readonly VITE_VISUAL_TEST?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
