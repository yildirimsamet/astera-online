import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach } from 'vitest';
import '@testing-library/jest-dom/vitest';
import i18n from '../src/i18n/index.js';

/**
 * EVERY TEST RUNS IN ENGLISH, AND IT SAYS SO OUT LOUD.
 *
 * jsdom reports `en-US`, so detection already lands here — but "already lands
 * here" is a property of the environment rather than of the suite, and the day
 * jsdom or a CI image reports something else, four hundred assertions would fail
 * at once for a reason none of them names. Pinning it makes the language an
 * explicit precondition instead of a coincidence.
 *
 * `beforeEach` rather than once at the top: `i18n.test.ts` switches languages to
 * check that the Turkish tree is complete, and a test that leaves the instance in
 * Turkish must not be able to break the next file that runs.
 */
beforeEach(async () => {
  if (i18n.resolvedLanguage !== 'en') await i18n.changeLanguage('en');
});

/**
 * Testing Library only registers its own cleanup when Vitest is running with
 * `globals: true`. It is not, so this has to be explicit — without it every
 * render in a file stacks up in the same document, and the second test that looks
 * for a string finds two of them. Two tests failed that way before this existed,
 * and both looked like assertion bugs rather than one missing hook.
 */
afterEach(cleanup);
