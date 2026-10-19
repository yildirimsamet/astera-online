import { mkdtemp, readFile, rm, stat, writeFile, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { sql } from 'drizzle-orm';
import { afterAll, afterEach, beforeEach, expect, it } from 'vitest';
import { FixedClock } from '../src/clock.js';
import { accounts, accountDeletionRequests } from '../src/db/schema.js';
import { writeErasureIntent, readErasureJournal, reapplyErasureJournal, pruneErasureJournal } from '../src/services/erasureJournal.js';
import { testDb, truncateAll } from './helpers.js';

let directory: string;
const secret = 'fixture-erasure-secret-not-production';
const clock = new FixedClock(new Date('2026-10-19T00:00:00.000Z'));
beforeEach(async () => { const { db } = await testDb(); await truncateAll(db); directory = await mkdtemp(join(tmpdir(), 'astera-erasure-journal-')); });
afterEach(async () => { await rm(directory, { recursive: true, force: true }); });
afterAll(async () => { await (await testDb()).close(); });
async function fixture() {
  const { db } = await testDb();
  const [account] = await db.insert(accounts).values({ username: 'journalpilot', displayName: 'Journal Pilot', passwordHash: 'fixture-hash-unused' }).returning();
  if (!account) throw new Error('Missing fixture');
  const requestId = randomUUID();
  await writeErasureIntent({ directory, secret }, { accountId: account.id, requestId, requestedAt: clock.now(), approvedAt: clock.now(), locale: 'tr' }, clock.now());
  const entries = await readErasureJournal({ directory, secret });
  return { db, account, requestId, entries };
}

it('uses private atomic signed files, contains no raw account identity, and rejects tampering or the wrong key', async () => {
  const { account, requestId, entries } = await fixture();
  expect(entries).toHaveLength(1); expect(entries[0]?.requestId).toBe(requestId);
  const path = join(directory, '.account-erasure-ledger');
  const files = await readdir(path); expect(files).toHaveLength(1);
  const file = join(path, files[0]!); const raw = await readFile(file, 'utf8');
  expect(raw).not.toContain(account.id); expect(raw).not.toContain(account.username);
  expect((await stat(file)).mode & 0o777).toBe(0o600);
  await expect(readErasureJournal({ directory, secret: 'wrong-fixture-key' })).rejects.toThrow();
  await writeFile(file, raw.replace(requestId, randomUUID()));
  await expect(readErasureJournal({ directory, secret })).rejects.toThrow();
});
it('previews only the exact restored account, then revokes access and restores an approved request idempotently', async () => {
  const { db, account, requestId, entries } = await fixture();
  expect(await reapplyErasureJournal(db, entries, false)).toEqual({ matched: 1, changed: 0 });
  expect(await db.select().from(accountDeletionRequests)).toHaveLength(0);
  expect(await reapplyErasureJournal(db, entries, true)).toEqual({ matched: 1, changed: 1 });
  expect(await db.select().from(accountDeletionRequests)).toMatchObject([{ accountId: account.id, requestId, approvedAt: clock.now() }]);
  expect(await db.select().from(accounts)).toMatchObject([{ id: account.id, authVersion: 1, deletionApprovedAt: clock.now() }]);
  expect(await reapplyErasureJournal(db, entries, true)).toEqual({ matched: 1, changed: 0 });
  expect(await db.execute(sql`select id from players`)).toHaveLength(0);
});
it('does not target a new account that reused the old username', async () => {
  const { db, account, entries } = await fixture();
  await db.execute(sql`delete from accounts where id = ${account.id}`);
  const [fresh] = await db.insert(accounts).values({ username: account.username, displayName: account.displayName, passwordHash: 'new-fixture-hash' }).returning();
  expect(await reapplyErasureJournal(db, entries, true)).toEqual({ matched: 0, changed: 0 });
  expect(await db.select().from(accounts)).toMatchObject([{ id: fresh?.id, authVersion: 0, deletionApprovedAt: null }]);
});
it('rolls back rather than overwriting a conflicting durable request', async () => {
  const { db, account, entries } = await fixture();
  await db.insert(accountDeletionRequests).values({ accountId: account.id, requestId: randomUUID(), requestedAt: clock.now(), locale: 'en' });
  await expect(reapplyErasureJournal(db, entries, true)).rejects.toThrow();
  expect(await db.select().from(accounts)).toMatchObject([{ authVersion: 0, deletionApprovedAt: null }]);
});
it('rejects missing journal directories and malformed records instead of interpreting them as no deletions', async () => {
  await expect(readErasureJournal({ directory, secret })).rejects.toThrow();
  await fixture();
  const path = join(directory, '.account-erasure-ledger'); const [file] = await readdir(path);
  await writeFile(join(path, file!), '{"version":1,"accountHash":"bad"}');
  await expect(readErasureJournal({ directory, secret })).rejects.toThrow();
});
it('expires completed-account markers after 30 days while retaining an active approved account’s restore protection', async () => {
  const { db, account } = await fixture();
  const later = new Date(clock.now().getTime() + 31 * 86_400_000);
  expect(await pruneErasureJournal(db, { directory, secret }, later)).toEqual({ removed: 0 });
  await db.execute(sql`delete from accounts where id = ${account.id}`);
  expect(await pruneErasureJournal(db, { directory, secret }, new Date(clock.now().getTime() + 29 * 86_400_000))).toEqual({ removed: 0 });
  expect(await pruneErasureJournal(db, { directory, secret }, later)).toEqual({ removed: 1 });
  expect(await readdir(join(directory, '.account-erasure-ledger'))).toEqual([]);
});
