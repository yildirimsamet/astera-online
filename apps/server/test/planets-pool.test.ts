import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { pino } from 'pino';
import { afterAll, afterEach, beforeEach, expect, it } from 'vitest';
import { buildApp, type BuiltApp } from '../src/app.js';
import * as schema from '../src/db/schema.js';
import { seedWorld, testDb, testEnv, TEST_DATABASE_URL, type Fixture } from './helpers.js';

/**
 * A PLANET READ NEVER WAITS ON ITS OWN POOL. Capacity run 2026-10-31.
 *
 * `/api/planets` read the commander's research insight through the shared pool while its
 * own transaction held a connection of that same pool. With as many cold reads in
 * flight as the pool has connections, every transaction waited for a second connection
 * none of them would give back, and the API stopped answering. The insight is now read
 * before the transaction opens.
 */
const silent = pino({ level: 'silent' });
let f: Fixture;
let built: BuiltApp;
let client: ReturnType<typeof postgres>;

beforeEach(async () => {
  f = await seedWorld(6);
  client = postgres(TEST_DATABASE_URL, { max: 2, onnotice: () => undefined });
  built = buildApp({ db: drizzle(client, { schema }), clock: f.clock, logger: silent, env: testEnv() });
  await built.app.ready();
});
afterEach(async () => { await built.close(); await client.end(); });
afterAll(async () => { await (await testDb()).close(); });

for (const url of ['/api/planets', '/api/planet']) {
  it(`answers more cold ${url} reads at once than the pool has connections`, async () => {
    const reads = f.accountIds.map(async (accountId) => built.app.inject({ url,
      headers: { authorization: `Bearer ${await built.app.tokens.issueAccess(accountId)}` } }));
    const timeout = new Promise<'hung'>(resolve => { setTimeout(() => { resolve('hung'); }, 5_000); });
    const answered = await Promise.race([Promise.all(reads), timeout]);
    expect(answered).not.toBe('hung');
    if (answered !== 'hung') expect(answered.map(response => response.statusCode)).toEqual(f.accountIds.map(() => 200));
  });
}
