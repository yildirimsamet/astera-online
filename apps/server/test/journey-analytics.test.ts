import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { afterAll, afterEach, beforeEach, expect, it } from 'vitest';
import { journeyReportSchema } from '../../web/src/api/journeySchemas.js';
import { accounts, botProfiles, players, vesselBotState, vesselOrders, vessels } from '../src/db/schema.js';
import { testDb } from './helpers.js';
import { bearer, starterWorld } from './starterFixture.js';
import { aboard } from './starterShips.js';

let world: Awaited<ReturnType<typeof starterWorld>>;
beforeEach(async () => {
  world = await starterWorld({ ANALYTICS_ADMIN_ENABLED: 'true', ADMIN_USERNAMES: 'operator' });
  await world.f.db.update(accounts).set({ username: 'operator', createdAt: world.f.clock.now() }).where(eq(accounts.id, world.f.accountIds[0]!));
});
afterEach(async () => { await world.built.close(); });
afterAll(async () => { await (await testDb()).close(); });
const headers = async () => bearer(await world.app.tokens.issueAccess(world.f.accountIds[0]!));
const read = async (query = '') => world.app.inject({ url: `/api/admin/analytics/journey${query}`, headers: await headers() });
const pilot = async (name: string) => {
  const person = await aboard(world, name);
  await world.f.db.update(accounts).set({ createdAt: world.f.clock.now() }).where(eq(accounts.id, person.id));
  return person;
};

it('requires admin access and rejects invalid dates, future windows and unknown query keys', async () => {
  expect((await world.app.inject('/api/admin/analytics/journey')).statusCode).toBe(401);
  const person = await pilot('ordinary');
  expect((await world.app.inject({ url: '/api/admin/analytics/journey', headers: person.headers })).statusCode).toBe(403);
  expect((await read('?from=bad')).statusCode).toBe(400);
  expect((await read('?unknown=1')).statusCode).toBe(400);
  expect((await read(`?to=${encodeURIComponent(new Date(world.f.clock.now().getTime() + 86400000).toISOString())}`)).statusCode).toBe(400);
});

it('uses a registration cohort, excludes both types of bots and the admin, and includes ships without client telemetry', async () => {
  const human = await pilot('real');
  const bot = await pilot('bot');
  await world.f.db.insert(botProfiles).values({ accountId: bot.id, ordinal: 900_400, persona: 'steady', createdAt: world.f.clock.now(), nextActionAt: world.f.clock.now() });
  const crew = await pilot('crew');
  await world.f.db.insert(vesselBotState).values({ vesselId: crew.vesselId, persona: 'steady', createdAt: world.f.clock.now(), nextActionAt: world.f.clock.now(), sessionUntilAt: world.f.clock.now() });
  const old = await pilot('old');
  await world.f.db.update(accounts).set({ createdAt: new Date(world.f.clock.now().getTime() - 2 * 86400000) }).where(eq(accounts.id, old.id));
  const before = await world.f.db.select().from(vessels).where(eq(vessels.id, human.vesselId));
  const response = await read();
  expect(response.statusCode).toBe(200);
  const report = journeyReportSchema.parse(response.json<unknown>());
  expect(report.totalAccounts).toBe(1);
  expect(report.players).toHaveLength(1);
  expect(report.players[0]).toMatchObject({ accountId: human.id, stage: 'enlisted', foregroundMs: null, durationQuality: 'missing' });
  expect(await world.f.db.select().from(vessels).where(eq(vessels.id, human.vesselId))).toEqual(before);
});

it('recovers progress and the last manual order without a permitted analytics visit; worker completion never moves last activity', async () => {
  const person = await pilot('progress');
  const now = world.f.clock.now(), orderedAt = new Date(now.getTime() - 40 * 60000), readyAt = new Date(now.getTime() - 30 * 60000);
  await world.f.db.update(vessels).set({ lastSeenAt: orderedAt, modules: { REFINERY: 2, SHIPYARD: 1 }, facts: ['FIRST_MINING_SENT'] }).where(eq(vessels.id, person.vesselId));
  await world.f.db.insert(vesselOrders).values({ id: randomUUID(), vesselId: person.vesselId, queue: 'YARD', slot: 0, subject: 'DART', stage: 1,
    count: 1, status: 'DONE', startedAt: orderedAt, orderedAt, readyAt, remainingSeconds: 600, cost: { alloy: 0, crystal: 0, deuterium: 0 } });
  const response = await read();
  const report = journeyReportSchema.parse(response.json<unknown>());
  expect(report.players[0]).toMatchObject({ stage: 'built', lastActiveAt: orderedAt.getTime(), activity: 'absent',
    lastCommand: { at: orderedAt.getTime(), code: 'DART' }, waitingAtLastActivity: { count: 1, nextAt: readyAt.getTime() } });
});

it('uses exact inclusive start and exclusive end boundaries and never reads other players into a cohort', async () => {
  await pilot('new');
  const now = world.f.clock.now().toISOString();
  const empty = await read(`?from=${encodeURIComponent(new Date(world.f.clock.now().getTime() - 60000).toISOString())}&to=${encodeURIComponent(now)}`);
  expect(journeyReportSchema.parse(empty.json<unknown>()).totalAccounts).toBe(0);
  const included = await read(`?from=${encodeURIComponent(now)}`);
  expect(journeyReportSchema.parse(included.json<unknown>()).totalAccounts).toBe(1);
});

it('keeps tracking activity after the ship migrates into the main galaxy', async () => {
  const person = await pilot('migrated');
  const now = world.f.clock.now();
  await world.f.db.update(vessels).set({ status: 'DEPARTED', lastSeenAt: new Date(now.getTime() - 2 * 3600000) }).where(eq(vessels.id, person.vesselId));
  await world.f.db.update(players).set({ accountId: person.id, lastActiveAt: now }).where(eq(players.id, world.f.playerIds[0]!));
  const report = journeyReportSchema.parse((await read()).json<unknown>());
  expect(report.players[0]).toMatchObject({ stage: 'departed', lastActiveAt: now.getTime(), activity: 'recent' });
});

it('flags bounded cohorts instead of silently presenting the first page as all players', async () => {
  await world.f.db.insert(accounts).values(Array.from({ length: 501 }, (_, i) => ({ username: `cohort_${i}`, displayName: 'Test', passwordHash: 'unused', createdAt: world.f.clock.now() })));
  const report = journeyReportSchema.parse((await read()).json<unknown>());
  expect(report.totalAccounts).toBe(501);
  expect(report.players).toHaveLength(500);
  expect(report.truncated).toBe(true);
});
