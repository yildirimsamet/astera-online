import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { sql } from 'drizzle-orm';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { Db } from './client.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const FOLDER = join(HERE, '../../drizzle');

export async function runMigrations(db: Db): Promise<void> {
  await migrate(db, { migrationsFolder: FOLDER });
}

/**
 * HOW MANY MIGRATIONS THIS BUILD EXPECTS THE DATABASE TO HAVE RUN.
 *
 * Read from the journal drizzle maintains, so it cannot drift from the folder.
 */
function expectedMigrations(): number {
  const journal = readFileSync(join(FOLDER, 'meta/_journal.json'), 'utf8');
  const parsed = JSON.parse(journal) as { entries?: unknown[] };
  return parsed.entries?.length ?? 0;
}

/**
 * MIGRATIONS THIS BUILD HAS AND THE DATABASE HAS NOT. D47.
 *
 * THE MOST EXPENSIVE HOUR OF THIS PROJECT SO FAR, and it left no signal anywhere.
 * A schema change added `notifications.ref_id` and generated a migration; the
 * migration was never run against the development database. Everything typechecked,
 * every test passed — the suite migrates its own database on the way in — and the
 * server started cleanly and reported `ok` on `/health`.
 *
 * What actually happened is that `notify()` threw on every insert, which meant
 * EVERY worker tick threw, which meant **no fleet in the galaxy ever landed
 * again**. Raids sat over their targets for ever, mining craft never came home,
 * no battle report was ever written and no debris was ever left. From the player's
 * seat the game had simply stopped, and the only trace was a stack trace scrolling
 * past in a dev-server log nobody was reading.
 *
 * A stale database is not a runtime condition to be tolerated. It is a deploy that
 * did not finish, and the honest thing is to refuse to run.
 */
export async function pendingMigrations(db: Db): Promise<number> {
  const expected = expectedMigrations();
  try {
    const rows = await db.execute<{ n: number }>(
      sql`select count(*)::int as n from drizzle.__drizzle_migrations`,
    );
    return Math.max(0, expected - (rows[0]?.n ?? 0));
  } catch {
    // No migrations table at all: nothing has ever been applied.
    return expected;
  }
}

/**
 * Refuse to run against a database this build is ahead of.
 *
 * Separated from the boot path so it can be tested, and so the message lives with
 * the reasoning rather than in `index.ts`.
 */
export async function assertSchemaCurrent(db: Db): Promise<void> {
  const behind = await pendingMigrations(db);
  if (behind === 0) return;
  throw new Error(
    `The database is ${String(behind)} migration(s) behind this build. Every worker ` +
      'tick will fail on the first insert that touches a missing column, and no fleet ' +
      'will ever land. Run: pnpm --filter @astera/server season migrate',
  );
}
