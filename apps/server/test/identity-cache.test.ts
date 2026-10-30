import { eq, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { pino } from 'pino';
import { afterAll, afterEach, beforeEach, expect, it } from 'vitest';
import { buildApp, type BuiltApp } from '../src/app.js';
import * as schema from '../src/db/schema.js';
import { accounts, nativeSessions } from '../src/db/schema.js';
import { findAccount } from '../src/services/account.js';
import { makeAccount, seedWorld, testDb, testEnv, TEST_DATABASE_URL, type Fixture } from './helpers.js';

/**
 * WHO IS ASKING, READ ONCE. Scaling plan F1.8 (C1 + Q7).
 *
 * Every authenticated request read the account (or the native session) to prove its
 * token was still current. A read now trusts the answer it got last time, until the
 * database says otherwise: anything that ends a token — a credential change, a ban,
 * a deletion approval, a device logging out, the account row going — is announced by
 * a trigger in the transaction that made it, for the ACCOUNT, so an account with no
 * commander is covered too. A native session also ends at its own expiry with no
 * event. A command never trusts the cache, and a process whose bus is down trusts
 * nothing.
 */
const silent = pino({ level: 'silent' });
let f: Fixture;
let built: BuiltApp;
let client: ReturnType<typeof postgres>;
const wire: string[] = [];

beforeEach(async () => {
  f = await seedWorld(1);
  client = postgres(TEST_DATABASE_URL, { max: 4, onnotice: () => undefined,
    debug: (_connection, query) => { wire.push(query.toLowerCase()); } });
  built = buildApp({ db: drizzle(client, { schema }), clock: f.clock, logger: silent,
    env: testEnv({ NATIVE_AUTH_ENABLED: 'true', NATIVE_APP_ORIGINS: 'https://localhost' }) });
  await built.app.ready();
  await built.bus.start();
});
afterEach(async () => { await built.close(); await client.end(); });
afterAll(async () => { await (await testDb()).close(); });

/** The token checks: the account's version, or the native session joined to it. */
const identityReads = () => wire.filter(query =>
  query.includes('select "auth_version", "deletion_approved_at" from "accounts"') || query.includes('from "native_sessions" inner join "accounts"')).length;
const read = (token: string, headers: Record<string, string> = {}) =>
  built.app.inject({ url: '/api/auth/security', headers: { authorization: `Bearer ${token}`, ...headers } });
const command = (token: string) => built.app.inject({ method: 'POST', url: '/api/session/return/seen',
  headers: { authorization: `Bearer ${token}` }, payload: {} });
async function rejected(token: string, headers: Record<string, string> = {}): Promise<void> {
  for (let waited = 0; (await read(token, headers)).statusCode !== 401; waited += 20) {
    if (waited > 2_000) throw new Error('the revoked token was still accepted after 2 s');
    await new Promise(resolve => setTimeout(resolve, 20));
  }
}

it('reads the account once, then serves its reads without asking again', async () => {
  const token = await built.app.tokens.issueAccess(f.accountIds[0]!);
  expect((await read(token)).statusCode).toBe(200);
  wire.length = 0;
  for (let i = 0; i < 5; i++) expect((await read(token)).statusCode).toBe(200);
  expect(identityReads()).toBe(0);
});

it('never lets a command trust it', async () => {
  const token = await built.app.tokens.issueAccess(f.accountIds[0]!);
  await read(token);
  wire.length = 0;
  await command(token);
  expect(identityReads()).toBe(1);
});

const revocations: { name: string; commander: boolean; revoke: (accountId: string) => Promise<unknown> }[] = [
  { name: 'a credential change (password reset, ban, deletion approval)', commander: true, revoke: accountId =>
    f.db.update(accounts).set({ authVersion: sql`${accounts.authVersion} + 1` }).where(eq(accounts.id, accountId)) },
  // Erasure removes the commander first; the row itself goes last.
  { name: 'the account row being erased', commander: false, revoke: accountId => f.db.delete(accounts).where(eq(accounts.id, accountId)) },
];

for (const { name, commander, revoke } of revocations) {
  it(`refuses the next read after ${name}${commander ? ', with or without a commander' : ''}`, async () => {
    const lone = await makeAccount(f.db, 'Lone');
    for (const accountId of commander ? [f.accountIds[0]!, lone.id] : [lone.id]) {
      const token = await built.app.tokens.issueAccess(accountId);
      expect((await read(token)).statusCode).toBe(200);
      await revoke(accountId);
      await rejected(token);
    }
  });
}

it('refuses a native device that logged out, and one whose session ran out without any event', async () => {
  const account = await findAccount(f.db, f.accountIds[0]!);
  if (!account) throw new Error('Missing fixture account');
  const native = { origin: 'https://localhost' };
  const loggedOut = await built.app.nativeSessions.open(account);
  expect((await read(loggedOut.accessToken, native)).statusCode).toBe(200);
  await built.app.nativeSessions.logout({ sessionId: loggedOut.nativeSessionId, refreshToken: loggedOut.refreshToken });
  await rejected(loggedOut.accessToken, native);

  const expiring = await built.app.nativeSessions.open(account);
  await f.db.update(nativeSessions).set({ expiresAt: new Date(f.clock.now().getTime() + 60_000) })
    .where(eq(nativeSessions.id, expiring.nativeSessionId));
  expect((await read(expiring.accessToken, native)).statusCode).toBe(200);
  f.clock.advance(2);
  expect((await read(expiring.accessToken, native)).statusCode).toBe(401);
});

it('asks the database on every read while the bus is down', async () => {
  const token = await built.app.tokens.issueAccess(f.accountIds[0]!);
  await read(token);
  await built.bus.stop();
  wire.length = 0;
  for (let i = 0; i < 3; i++) await read(token);
  expect(identityReads()).toBe(3);
});
