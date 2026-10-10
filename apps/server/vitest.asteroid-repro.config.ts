import { defineConfig } from 'vitest/config';

/** An isolated run of the incident regressions; the same tests also run in ordinary CI. */
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('Set DATABASE_URL to a dedicated local asteroid reproduction database.');
const database = new URL(databaseUrl);
if (!['localhost', '127.0.0.1', '[::1]'].includes(database.hostname)
  || !/^\/astera_asteroid_repro_[a-z0-9_]+_test$/.test(database.pathname)) {
  throw new Error('Asteroid reproduction requires a local astera_asteroid_repro_*_test database.');
}

export default defineConfig({
  test: {
    include: ['test/asteroid-spawn-regression.test.ts'],
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
