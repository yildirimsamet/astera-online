import { eq } from 'drizzle-orm';
import { afterAll, afterEach, beforeEach, expect, it } from 'vitest';
import { pushDevices, returnReminders, vesselNotifications, vesselUnits, vessels } from '../src/db/schema.js';
import { planStarterReturn, sweepReturnSignals } from '../src/services/returnSignals.js';
import { setPushTransport, type PushMessage } from '../src/services/notificationCenter.js';
import { starterWorld } from './starterFixture.js';
import { aboard, arm, enrich, post } from './starterShips.js';
import { testDb } from './helpers.js';
import { countStatements } from '../src/db/client.js';
import { Presence } from '../src/services/presence.js';
let world: Awaited<ReturnType<typeof starterWorld>>, sent: PushMessage[];
beforeEach(async () => { world = await starterWorld(); world.f.clock.advance(12 * 60); sent = []; setPushTransport({ send: (_tokens, message) => { sent.push(message); return Promise.resolve({ invalid: [] }); } }); });
afterEach(async () => { setPushTransport(null); await world.built.close(); });
afterAll(async () => { await (await testDb()).close(); });
const setup = async () => {
  const me = await aboard(world, 'Me', { REFINERY: 2, EXTRACTOR: 2, TELESCOPE: 1, RADAR: 1, SURVEY: 1, SHIPYARD: 1 });
  await world.f.db.update(vessels).set({ alloy: 150, crystal: 0, bufferAlloy: 0, bufferCrystal: 0 }).where(eq(vessels.id, me.vesselId));
  await world.f.db.insert(pushDevices).values({ token: 'tok', accountId: me.id, platform: 'android', locale: 'en', createdAt: world.f.clock.now(), lastSeenAt: world.f.clock.now() });
  await world.f.db.transaction(async tx => { const [ship] = await tx.select().from(vessels).where(eq(vessels.id, me.vesselId)); await planStarterReturn(tx, ship!, world.f.clock.now(), true); });
  return me;
};
it('plans affordability, requires three hours away and limits the funded notice to once per day', async () => {
  const me = await setup();
  expect((await world.f.db.select().from(returnReminders))[0]?.nextRepairAt).not.toBeNull();
  world.f.clock.advance(179);
  await sweepReturnSignals(world.f.db, world.f.clock);
  expect(sent).toHaveLength(0);
  world.f.clock.advance(2);
  await sweepReturnSignals(world.f.db, world.f.clock);
  expect(sent.map(m => m.kind)).toEqual(['repair_funded']);
  await sweepReturnSignals(world.f.db, world.f.clock);
  expect(sent).toHaveLength(1);
  await world.f.db.transaction(async tx => { const [ship] = await tx.select().from(vessels).where(eq(vessels.id, me.vesselId)); await planStarterReturn(tx, ship!, world.f.clock.now(), true); });
  await sweepReturnSignals(world.f.db, world.f.clock);
  expect(sent).toHaveLength(1);
});
it('sends news only for real events at 24 and 72 hours, at most twice per absence', async () => {
  const me = await setup();
  world.f.clock.advance(60);
  await world.f.db.insert(vesselNotifications).values({ vesselId: me.vesselId, kind: 'PROBE_DETECTED', refId: me.vesselId, payload: {}, createdAt: world.f.clock.now() });
  world.f.clock.advance(23 * 60);
  await sweepReturnSignals(world.f.db, world.f.clock);
  expect(sent.filter(m => m.kind === 'while_away')).toHaveLength(1);
  world.f.clock.advance(48 * 60);
  await sweepReturnSignals(world.f.db, world.f.clock);
  await sweepReturnSignals(world.f.db, world.f.clock);
  expect(sent.filter(m => m.kind === 'while_away')).toHaveLength(2);
  world.f.clock.advance(48 * 60);
  await sweepReturnSignals(world.f.db, world.f.clock);
  expect(sent.filter(m => m.kind === 'while_away')).toHaveLength(2);
});
it('refreshes the affordability plan on collect and order', async () => {
  const me = await setup();
  await world.f.db.update(vessels).set({ alloy: 1000, crystal: 500 }).where(eq(vessels.id, me.vesselId));
  expect((await post(world, '/api/starter/repair', me.headers, { module: 'REFINERY', stage: 3 })).statusCode).toBe(200);
  const [ordered] = await world.f.db.select().from(returnReminders);
  expect(ordered?.subject).not.toBe('REFINERY:3');
  const { vessel: { queue } } = (await world.app.inject({ url: '/api/starter/vessel', headers: me.headers })).json<{ vessel: { queue: { id: string }[] } }>();
  const cancelled = await post(world, `/api/starter/orders/${queue[0]!.id}/cancel`, me.headers);
  expect(cancelled.statusCode).toBe(200);
  expect((await world.f.db.select().from(returnReminders))[0]?.subject).toBe('REFINERY:3');
  expect((await post(world, '/api/starter/collect', me.headers)).statusCode).toBe(200);
  expect((await world.f.db.select().from(returnReminders))[0]?.accountId).toBe(me.id);
});
it.each([
  { path: 'build', body: { hull: 'DART', count: 1 } },
  { path: 'research', body: { projectId: 'SHIP_POWER' } },
  { path: 'dock', body: {} },
])('refreshes the forecast after a $path order spends resources', async ({ path, body }) => {
  const me = await aboard(world, 'Orders', { REFINERY: 3, EXTRACTOR: 3, SURVEY: 2, VAULT: 1, SHIPYARD: 1, HANGAR: 2 });
  await enrich(world, me.vesselId);
  await world.f.db.insert(pushDevices).values({ token: 'orders', accountId: me.id, platform: 'android', locale: 'en', createdAt: world.f.clock.now(), lastSeenAt: world.f.clock.now() });
  await world.f.db.update(vessels).set({ facts: ['FIRST_PROBE_REPORT', 'FIRST_MINING_RETURN', 'FIRST_BATTLE_REPORT'] }).where(eq(vessels.id, me.vesselId));
  await arm(world, me.vesselId, { DART: 1 });
  await world.f.db.update(vesselUnits).set({ damage: [{ hull: 'DART', count: 1, damageBp: 4000 }] }).where(eq(vesselUnits.vesselId, me.vesselId));
  await world.f.db.insert(returnReminders).values({ accountId: me.id, vesselId: me.vesselId, subject: 'stale', absenceAt: world.f.clock.now() });
  const result = await post(world, `/api/starter/${path}`, me.headers, body);
  expect(result.statusCode).toBe(200);
  expect((await world.f.db.select().from(returnReminders).where(eq(returnReminders.accountId, me.id)))[0]?.subject).not.toBe('stale');
});
it('counts reading as presence, so an active starter commander receives no absence notice', async () => {
  const me = await setup();
  world.f.clock.advance(180);
  expect((await world.app.inject({ url: '/api/starter/vessel', headers: me.headers })).statusCode).toBe(200);
  await sweepReturnSignals(world.f.db, world.f.clock);
  expect(sent).toHaveLength(0);
});
it('stamps starter presence and resets its absence in one statement', async () => {
  const me = await setup();
  world.f.clock.advance(2);
  const scope = { statements: 0 };
  expect(await countStatements(scope, () => new Presence(world.f.db, world.f.clock).touch(me.id))).toBe(true);
  expect(scope.statements).toBe(1);
  const [reminder] = await world.f.db.select().from(returnReminders).where(eq(returnReminders.accountId, me.id));
  expect(reminder?.absenceAt).toEqual(world.f.clock.now());
});
it('carries return signals to the landed capital and ends funded notices after seven days', async () => {
  const { STARTER } = await import('@astera/rules');
  const { players, planets, vesselMigrations, notifications } = await import('../src/db/schema.js');
  const { planPlanetReturn } = await import('../src/services/returnSignals.js');
  const { loadLocked } = await import('../src/services/planet.js');
  const me = await aboard(world, 'Landing', { DRIVE_HULL: 1, DRIVE_THRUST: 1, DEUTERIUM_PLANT: 2 });
  await world.f.db.update(vessels).set({ fuel: STARTER.fuelForJump }).where(eq(vessels.id, me.vesselId));
  await world.f.db.insert(pushDevices).values({ token: 'landed', accountId: me.id, platform: 'android', locale: 'en', createdAt: world.f.clock.now(), lastSeenAt: world.f.clock.now() });
  const jump = await post(world, '/api/starter/migrate', me.headers);
  expect(jump.statusCode).toBe(200);
  const { placement } = jump.json<{ placement: { planetId: string; playerId: string } }>();
  await world.f.db.update(vesselMigrations).set({ startedAt: new Date(world.f.clock.now().getTime() - 8 * 86400000) }).where(eq(vesselMigrations.vesselId, me.vesselId));
  await world.f.db.transaction(async tx => { await planPlanetReturn(tx, await loadLocked(tx, placement.planetId, world.f.clock)); });
  world.f.clock.advance(181);
  await sweepReturnSignals(world.f.db, world.f.clock);
  expect(sent.filter(m => m.kind === 'repair_funded')).toHaveLength(1);
  await world.app.inject({ url: '/api/planet', headers: me.headers });
  const [active] = await world.f.db.select().from(players).where(eq(players.id, placement.playerId));
  expect(active?.lastActiveAt.getTime()).toBe(world.f.clock.now().getTime());
  sent.length = 0;
  world.f.clock.advance(7 * 24 * 60);
  await world.f.db.transaction(async tx => { await planPlanetReturn(tx, await loadLocked(tx, placement.planetId, world.f.clock)); });
  await world.f.db.insert(notifications).values({ playerId: placement.playerId, kind: 'scan_detected', payload: {}, createdAt: world.f.clock.now() });
  await sweepReturnSignals(world.f.db, world.f.clock);
  expect(sent.filter(m => m.kind === 'repair_funded')).toHaveLength(0);
  expect(sent.filter(m => m.kind === 'while_away')).toHaveLength(1);
  expect((await world.f.db.select().from(planets).where(eq(planets.id, placement.planetId))).length).toBe(1);
  expect((await world.f.db.select().from(vesselMigrations).where(eq(vesselMigrations.vesselId, me.vesselId)))[0]?.status).toBe('DONE');
});

it('never invents news for an empty absence, and waits until 72h after an empty first summary', async () => {
  const me = await setup();
  world.f.clock.advance(24 * 60);
  await sweepReturnSignals(world.f.db, world.f.clock);
  expect(sent.filter(m => m.kind === 'while_away')).toHaveLength(0);
  world.f.clock.advance(60);
  await world.f.db.insert(vesselNotifications).values({ vesselId: me.vesselId, kind: 'PROBE_DETECTED', refId: me.vesselId, payload: {}, createdAt: world.f.clock.now() });
  await sweepReturnSignals(world.f.db, world.f.clock);
  expect(sent.filter(m => m.kind === 'while_away')).toHaveLength(0);
  world.f.clock.advance(47 * 60);
  await sweepReturnSignals(world.f.db, world.f.clock);
  expect(sent.filter(m => m.kind === 'while_away')).toHaveLength(1);
});

it('forgets a removed main world without blocking other reminders', async () => {
  const { planets } = await import('../src/db/schema.js');
  const planetId = world.f.planetIds[0]!;
  await world.f.db.insert(returnReminders).values({ accountId: world.f.accountIds[0]!, planetId, absenceAt: world.f.clock.now(), nextCheckAt: world.f.clock.now() });
  // The season eraser removes dependants first; a reminder has no season foreign key.
  await world.f.db.update(returnReminders).set({ planetId: '00000000-0000-4000-8000-000000000001', nextRepairAt: world.f.clock.now() }).where(eq(returnReminders.planetId, planetId));
  await expect(sweepReturnSignals(world.f.db, world.f.clock)).resolves.toBeUndefined();
  expect(await world.f.db.select().from(returnReminders).where(eq(returnReminders.planetId, '00000000-0000-4000-8000-000000000001'))).toHaveLength(0);
  expect((await world.f.db.select().from(planets).where(eq(planets.id, planetId))).length).toBe(1);
});

it('adds no planner queries for an ineligible main commander or ship', async () => {
  const { planPlanetReturn } = await import('../src/services/returnSignals.js');
  const { loadLocked } = await import('../src/services/planet.js');
  const me = await aboard(world);
  await world.f.db.transaction(async tx => {
    const main = await loadLocked(tx, world.f.planetIds[0]!, world.f.clock);
    const [ship] = await tx.select().from(vessels).where(eq(vessels.id, me.vesselId));
    const scope = { statements: 0 };
    await countStatements(scope, async () => { await planPlanetReturn(tx, main); await planStarterReturn(tx, ship!, world.f.clock.now()); });
    expect(scope.statements).toBe(0);
  });
});

it('uses a rolling 24 hours instead of a UTC date for funded reminders', async () => {
  const me = await setup();
  world.f.clock.set(new Date('2026-01-02T08:30:00Z'));
  await world.f.db.update(vessels).set({ alloy: 5000, crystal: 5000, lastSeenAt: new Date('2026-01-01T00:00:00Z') }).where(eq(vessels.id, me.vesselId));
  await world.f.db.update(returnReminders).set({ lastFundedAt: new Date('2026-01-01T23:30:00Z'), nextRepairAt: world.f.clock.now() }).where(eq(returnReminders.accountId, me.id));
  await sweepReturnSignals(world.f.db, world.f.clock);
  expect(sent.filter(m => m.kind === 'repair_funded')).toHaveLength(0);
});

it('moves a stage-one absence to 72h and lets a new 24h absence pass 150 older rows', async () => {
  const { randomUUID } = await import('node:crypto');
  const { accounts } = await import('../src/db/schema.js');
  const me = await setup();
  const base = world.f.clock.now();
  const ids = Array.from({ length: 150 }, () => randomUUID());
  await world.f.db.insert(accounts).values(ids.map(id => ({ id, username: `absent_${id.slice(0, 12)}`, displayName: 'Absent', passwordHash: 'test' })));
  await world.f.db.insert(returnReminders).values(ids.map(accountId => ({ accountId, absenceAt: new Date(base.getTime() - 36 * 3600000), summaryStage: 1, nextCheckAt: new Date(base.getTime() + 36 * 3600000) })));
  world.f.clock.advance(60);
  await world.f.db.insert(vesselNotifications).values({ vesselId: me.vesselId, kind: 'PROBE_DETECTED', refId: me.vesselId, payload: {}, createdAt: world.f.clock.now() });
  world.f.clock.advance(23 * 60);
  await sweepReturnSignals(world.f.db, world.f.clock);
  expect(sent.filter(m => m.kind === 'while_away')).toHaveLength(1);
  const scope = { statements: 0 };
  await countStatements(scope, () => sweepReturnSignals(world.f.db, world.f.clock));
  expect(scope.statements).toBe(1);
});

it('describes only the departure that really happened', async () => {
  const me = await setup();
  const { starterDepartures } = await import('../src/db/schema.js');
  const [ship] = await world.f.db.select().from(vessels).where(eq(vessels.id, me.vesselId));
  world.f.clock.advance(60);
  await world.f.db.insert(starterDepartures).values({ starterGalaxyId: ship!.starterGalaxyId, accountId: me.id, displayName: 'Vela', countryCode: 'TR', x: 0, y: 0, z: 0, at: world.f.clock.now() });
  world.f.clock.advance(23 * 60); await sweepReturnSignals(world.f.db, world.f.clock);
  const message = sent.find(m => m.kind === 'while_away');
  expect(message?.body).toContain('Vela');
  expect(message?.body).not.toMatch(/probe|repair|visit/i);
});

it('does not wake a commander whose absence began long before the phone was found', async () => {
  const { players, notifications } = await import('../src/db/schema.js');
  const accountId = world.f.accountIds[0]!;
  const [player] = await world.f.db.select().from(players).where(eq(players.accountId, accountId));
  const left = new Date(world.f.clock.now().getTime() - 30 * 86_400_000);
  await world.f.db.update(players).set({ lastActiveAt: left }).where(eq(players.id, player!.id));
  await world.f.db.insert(notifications).values({ playerId: player!.id, kind: 'scan_detected', payload: {}, createdAt: new Date(left.getTime() + 86_400_000) });
  await world.f.db.insert(pushDevices).values({ token: 'dormant', accountId, platform: 'android', locale: 'en', createdAt: world.f.clock.now(), lastSeenAt: world.f.clock.now() });
  await sweepReturnSignals(world.f.db, world.f.clock);
  expect(await world.f.db.select().from(returnReminders).where(eq(returnReminders.accountId, accountId))).toHaveLength(1);
  expect(sent.filter(m => m.kind === 'while_away')).toHaveLength(0);
});
