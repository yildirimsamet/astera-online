import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { assertDisposableDatabase, assertNoRealAccounts } from '../src/cli/capacityGuard.js';
import { accounts } from '../src/db/schema.js';
import { testDb, truncateAll } from './helpers.js';

/**
 * THE CAPACITY SEED TRUNCATES EVERY TABLE, SO IT MUST REFUSE PRODUCTION. Scaling plan F0.1.
 *
 * Two locks, each sufficient on its own: the database is named for a throwaway
 * environment, and it holds no account the seed itself did not create.
 */
const confirmed = { yes: true, confirm: 'ASTERA_STAGING_ONLY' };

describe('the database name', () => {
  it('refuses the production database', () => {
    expect(() => { assertDisposableDatabase('postgres://astera:secret@postgres:5432/astera', confirmed); })
      .toThrow(/Refusing to seed database "astera"/);
  });

  it('refuses a disposable database without both confirmations', () => {
    const url = 'postgres://u:p@postgres:5432/astera_capacity';
    expect(() => { assertDisposableDatabase(url, { yes: false, confirm: 'ASTERA_STAGING_ONLY' }); }).toThrow(/Refusing destructive/);
    expect(() => { assertDisposableDatabase(url, { yes: true, confirm: undefined }); }).toThrow(/Refusing destructive/);
    expect(() => { assertDisposableDatabase(url, confirmed); }).not.toThrow();
  });
});

describe('the accounts it already holds', () => {
  const account = async (username: string) => (await testDb()).db.insert(accounts)
    .values({ username, passwordHash: 'not-a-real-hash', displayName: username });
  beforeEach(async () => { await truncateAll((await testDb()).db); });
  afterAll(async () => { await (await testDb()).close(); });

  it('accepts an empty database and one holding only capacity fixtures', async () => {
    const { db } = await testDb();
    await expect(assertNoRealAccounts(db)).resolves.toBeUndefined();
    await account('cap0001');
    await account('cap1999');
    await expect(assertNoRealAccounts(db)).resolves.toBeUndefined();
  });

  it('refuses a database a real commander has signed up to', async () => {
    const { db } = await testDb();
    await account('cap0001');
    await account('pilot');
    await expect(assertNoRealAccounts(db)).rejects.toThrow(/1 account that the capacity seed did not create/);
  });
});
