import { readFileSync } from 'node:fs';
import { eq, sql } from 'drizzle-orm';
import { afterAll, expect, it } from 'vitest';
import { accounts } from '../src/db/schema.js';
import { makeAccount, testDb, truncateAll } from './helpers.js';

afterAll(async () => { await (await testDb()).close(); });

const MIGRATION = new URL('../drizzle/0114_magical_forge.sql', import.meta.url);

class Rollback extends Error {}

/**
 * EVERY ACCOUNT THAT ALREADY EXISTS IS TURKISH. Owner instruction, 2026-09-27:
 * *"Var olan kullanıcıların ülkesi default tr olarak migrate edilmeli."*
 *
 * 0114 adds `country_code` as `DEFAULT 'TR' NOT NULL`, which PostgreSQL applies to every row
 * already in the table. This replays the migration against an account written before it, inside a
 * transaction that is rolled back, so the shared schema is untouched afterwards.
 */
it('gives every account that predates the column the TR country', async () => {
  const { db } = await testDb();
  await truncateAll(db);
  const veteran = await makeAccount(db, 'Eski Komutan');

  let seen: string | undefined;
  await expect(db.transaction(async (tx) => {
    await tx.execute(sql`ALTER TABLE "accounts" DROP CONSTRAINT "accounts_country_code_check"`);
    await tx.execute(sql`ALTER TABLE "accounts" DROP COLUMN "country_code"`);
    for (const statement of readFileSync(MIGRATION, 'utf8').split('--> statement-breakpoint')) {
      if (statement.trim()) await tx.execute(sql.raw(statement));
    }
    const [row] = await tx.select({ country: accounts.countryCode }).from(accounts)
      .where(eq(accounts.id, veteran.id));
    seen = row?.country;
    throw new Rollback();
  })).rejects.toBeInstanceOf(Rollback);

  expect(seen).toBe('TR');
  const [after] = await db.select({ country: accounts.countryCode }).from(accounts)
    .where(eq(accounts.id, veteran.id));
  expect(after?.country).toBe('TR');
});
