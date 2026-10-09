import { defineConfig } from 'vitest/config';

// Owner rule: even a direct/recursive test invocation must not start long seasons
// unless those simulations were explicitly requested. pnpm test:long opts in.
const includeLongTests = process.env.ASTERA_INCLUDE_LONG_TESTS === '1';
export default defineConfig({
  test: {
    include: includeLongTests ? ['test/**/*.test.ts'] : [],
    passWithNoTests: !includeLongTests,
    testTimeout: 60_000,
  },
});
