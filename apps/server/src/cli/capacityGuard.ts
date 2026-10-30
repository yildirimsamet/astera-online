import { sql } from 'drizzle-orm';
import type { Queryable } from '../db/client.js';

/**
 * THE CAPACITY SEED TRUNCATES EVERY TABLE. Scaling plan F0.1, §8.1.
 *
 * Two locks, each enough on its own: the database is named for a throwaway
 * environment and both confirmations are given, and it holds no account the seed
 * did not create itself. Production fails both.
 */
export const CAPACITY_CONFIRM = 'ASTERA_STAGING_ONLY';
/** The usernames the seed creates: `cap0001`, `cap0002`, … */
export const CAPACITY_USERNAME = /^cap[0-9]{4}$/;

export function assertDisposableDatabase(databaseUrl: string, input: { yes: boolean; confirm: string | undefined }): void {
  const database = decodeURIComponent(new URL(databaseUrl).pathname.slice(1));
  if (!/(?:^|_)(capacity|staging|loadtest)$/.test(database)) {
    throw new Error(
      `Refusing to seed database "${database}". Its name must end in _capacity, `
      + '_staging or _loadtest.',
    );
  }
  if (!input.yes || input.confirm !== CAPACITY_CONFIRM) {
    throw new Error(`Refusing destructive staging seed. Pass --yes and CAPACITY_SEED_CONFIRM=${CAPACITY_CONFIRM}.`);
  }
}

/** A database anyone signed up to is not disposable, whatever it is called. */
export async function assertNoRealAccounts(db: Queryable): Promise<void> {
  const [table] = await db.execute<{ present: boolean }>(sql`select to_regclass('public.accounts') is not null as present`);
  if (table?.present !== true) return;
  const [row] = await db.execute<{ real: number }>(
    sql`select count(*)::int as real from accounts where username !~ ${CAPACITY_USERNAME.source}`);
  const real = row?.real ?? 0;
  if (real > 0) {
    throw new Error(`Refusing to seed: the database holds ${String(real)} account${real === 1 ? '' : 's'} `
      + 'that the capacity seed did not create.');
  }
}
