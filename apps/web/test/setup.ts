import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';
import '@testing-library/jest-dom/vitest';

/**
 * Testing Library only registers its own cleanup when Vitest is running with
 * `globals: true`. It is not, so this has to be explicit — without it every
 * render in a file stacks up in the same document, and the second test that looks
 * for a string finds two of them. Two tests failed that way before this existed,
 * and both looked like assertion bugs rather than one missing hook.
 */
afterEach(cleanup);
