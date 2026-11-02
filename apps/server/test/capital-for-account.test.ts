import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { afterAll, expect, it } from 'vitest';
import { countStatements } from '../src/db/client.js';
import { planets } from '../src/db/schema.js';
import { capitalIdForAccount } from '../src/services/ownership.js';
import { seedWorld, testDb } from './helpers.js';

/**
 * THE CALLER'S CAPITAL IN ONE READ. Capacity fix plan, item M (2026-10-31).
 *
 * Every `/api/planet/*` action found the commander and then their capital, two
 * statements before the action began. One join answers both, and still tells a
 * caller without a commander from a commander without a capital.
 */
afterAll(async () => { await (await testDb()).close(); });

it('finds the capital of the account in one statement', async () => {
  const f = await seedWorld(2);
  const scope = { statements: 0 };
  const id = await countStatements(scope, () => capitalIdForAccount(f.db, f.accountIds[1]!));
  expect(id).toBe(f.planetIds[1]);
  expect(scope.statements).toBe(1);
});

it('refuses an account with no commander as before', async () => {
  const f = await seedWorld(1);
  await expect(capitalIdForAccount(f.db, randomUUID())).rejects.toMatchObject({ code: 'NO_PLANET', status: 404 });
});

it('refuses a commander with no capital as before', async () => {
  const f = await seedWorld(1);
  await f.db.update(planets).set({ kind: 'COLONY' }).where(eq(planets.id, f.planetIds[0]!));
  await expect(capitalIdForAccount(f.db, f.accountIds[0]!)).rejects.toMatchObject({ code: 'NO_CAPITAL', status: 409 });
});
