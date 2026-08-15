import { defineConfig } from 'vitest/config';

/**
 * Deliberately separate from vite.config.ts: the app builds on Vite 6 with the
 * React and Tailwind plugins, while Vitest brings its own Vite. Sharing one
 * config would couple the test runner to the build toolchain for no gain — JSX
 * needs no plugin here, esbuild reads `jsx: react-jsx` from tsconfig.
 */
export default defineConfig({
  test: {
    include: ['test/**/*.test.{ts,tsx}'],
    environment: 'jsdom',
    setupFiles: ['./test/setup.ts'],
    restoreMocks: true,
  },
});
