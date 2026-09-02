import { createDb } from '../db/client.js';
import { loadDotEnv, loadEnv } from '../env.js';
import { pendingMigrations, runMigrations } from '../db/migrate.js';

/**
 * RUN THE MIGRATIONS THIS BUILD CARRIES, AND NOTHING ELSE.
 *
 * `assertSchemaCurrent` refuses to boot a server that is ahead of its database
 * (D47), and the suite migrates its own database on the way in — which left the
 * DEVELOPMENT database with no supported way to catch up but `drizzle-kit push`,
 * a schema sync that does not run the hand-written backfills a migration may
 * carry. This is the same `runMigrations` the tests and production use.
 *
 *   pnpm --filter @astera/server migrate
 */
loadDotEnv();
const env = loadEnv();
const { db, close } = createDb(env.DATABASE_URL);
try {
  const before = await pendingMigrations(db);
  console.log(`pending before: ${String(before)}`);
  await runMigrations(db);
  console.log(`pending after:  ${String(await pendingMigrations(db))}`);
} finally {
  await close();
}
