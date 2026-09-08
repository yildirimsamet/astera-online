import { eq, sql } from 'drizzle-orm';
import { pino } from 'pino';
import { afterAll, afterEach, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { players } from '../src/db/schema.js';
import { seedWorld, testDb, testEnv } from './helpers.js';
let built: ReturnType<typeof buildApp> | undefined;
afterEach(async () => { await built?.close(); built = undefined; });
afterAll(async () => { await (await testDb()).close(); });
it('rejects old browser intents after relocation and publishes the current placement on me', async () => {
  const f = await seedWorld(1);
  built = buildApp({ env: testEnv(), db: f.db, clock: f.clock, logger: pino({ level: 'silent' }) });
  await built.app.ready();
  const authorization = `Bearer ${await built.app.tokens.issueAccess(f.accountIds[0]!)}`;
  await f.db.update(players).set({ placementVersion: 1 }).where(eq(players.id, f.playerIds[0]!));
  const old = await built.app.inject({ method: 'POST', url: `/api/planets/${f.planetIds[0]!}/collect`, headers: { authorization } });
  expect(old.statusCode).toBe(409);
  expect(old.json()).toMatchObject({ error: 'PLACEMENT_CHANGED' });
  const me = await built.app.inject({ url: '/api/auth/me', headers: { authorization } });
  expect(me.statusCode).toBe(200);
  expect(me.headers['x-placement']).toBe(`${f.playerIds[0]}:1`);
  const current = await built.app.inject({ url: '/api/galaxy', headers: { authorization, 'x-placement': `${f.playerIds[0]}:1` } });
  expect(current.statusCode).toBe(200);
});
it('keeps the galaxy placement stable throughout an authenticated handler', async () => {
  const f = await seedWorld(1);
  built = buildApp({ env: testEnv(), db: f.db, clock: f.clock, logger: pino({ level: 'silent' }) });
  const { requireAuth } = await import('../src/routes/auth.js');
  let locked = false;
  built.app.get('/api/placement-test', { preHandler: requireAuth }, async () => {
    locked = await f.db.transaction(async tx => {
      const [row] = await tx.execute<{ acquired: boolean }>(sql`select pg_try_advisory_xact_lock(hashtextextended(${`placement:${f.seasonId}`}, 0)) as acquired`);
      return row?.acquired === false;
    });
    return { ok: true };
  });
  const authorization = `Bearer ${await built.app.tokens.issueAccess(f.accountIds[0]!)}`;
  expect((await built.app.inject({ url: '/api/placement-test', headers: { authorization } })).statusCode).toBe(200);
  expect(locked).toBe(true);
});
it('invalidates a warm commander projection even before the transfer notification arrives', async () => {
  const f = await seedWorld(1);
  built = buildApp({ env: testEnv(), db: f.db, clock: f.clock, logger: pino({ level: 'silent' }) });
  const { requireAuth } = await import('../src/routes/auth.js');
  built.app.get('/api/placement-cache-test', { preHandler: requireAuth }, async () => built!.projections.commander(f.accountIds[0]!));
  await built.bus.start();
  const authorization = `Bearer ${await built.app.tokens.issueAccess(f.accountIds[0]!)}`;
  await built.app.inject({ url: '/api/placement-cache-test', headers: { authorization } });
  const { createSeason } = await import('../src/services/season.js');
  const { planets } = await import('../src/db/schema.js');
  const target = await createSeason(f.db, { shardCode: 'CACHE-WAIT', seed: 7, startsAt: f.clock.now(), role: 'WAITING' });
  await f.db.update(players).set({ placementVersion: 1, seasonId: target.season.id });
  await f.db.update(planets).set({ seasonId: target.season.id }).where(eq(planets.id, f.planetIds[0]!));
  const current = await built.app.inject({ url: '/api/placement-cache-test', headers: { authorization, 'x-placement': `${f.playerIds[0]}:1` } });
  expect(current.json()).toMatchObject({ seasonId: target.season.id });
});
