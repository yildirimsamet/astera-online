import type { Resources } from './locales/en/index.js';

/**
 * `t()` IS TYPED AGAINST THE ENGLISH TREE.
 *
 * This is the half of "nothing may be missing" that costs nothing to run: a key
 * that does not exist is a compile error at the call site, not a string of dots
 * printed on a phone. `pnpm typecheck` is therefore the coverage check for the
 * default namespace, and `test/i18n.test.ts` is the coverage check for every
 * other language against it.
 */
declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'game';
    resources: { game: Resources };
    returnNull: false;
    keySeparator: '.';
    nsSeparator: ':';
  }
}
