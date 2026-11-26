import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    // Owner rule: the long audit requires an explicit user request and opt-in.
    exclude: [...configDefaults.exclude, ...(process.env.ASTERA_INCLUDE_LONG_TESTS === '1' ? [] : ['**/snowball-audit.test.*'])],
    // Persistence tests share one database; running files in parallel would have
    // them truncating each other's rows mid-assertion.
    fileParallelism: false,
    // Client lists read strictly: a row the client would skip fails the contract test instead.
    setupFiles: ['test/strictLists.setup.ts'],
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
