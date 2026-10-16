import { randomUUID } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { afterAll, afterEach, beforeEach, expect, it, vi } from 'vitest';
import { hpRadiationSources, notifications, planets, players, radiationBombFlights,
  scheduledEvents, seasons, strategicAssets } from '../src/db/schema.js';
import { pino } from 'pino';
import { EventWorker } from '../src/worker/loop.js';
import { bombInterceptionLeg } from '../src/services/radiationBombInterception.js';
import { loadTrafficSnapshot, projectStrategicInterceptions, projectStrategicInterceptionImpacts } from '../src/services/traffic.js';
import { wakeStrategicInterceptions } from '../src/services/radar.js';
import { buildRadiationBomb, launchRadiationBomb, resolveRadiationBomb } from '../src/services/radiationBomb.js';
import * as streamBus from '../src/stream/bus.js';
import { transferCommander } from '../src/services/commanderTransfer.js';
import { ensureWaitingSeason } from '../src/services/waitingServers.js';
import { recomputePlayerWealth } from '../src/services/planet.js';
import { giveInstrument, giveSatellite, grant, placeAt, seedWorld, setLevel, testDb, type Fixture } from './helpers.js';

let f: Fixture;
beforeEach(async () => {
  f = await seedWorld(4);
  await f.db.update(seasons).set({ radiationBombStartsAt: f.clock.now(), rulesetVersion: 18 }).where(eq(seasons.id, f.seasonId));
  await f.db.update(players).set({ newcomerShieldUntil: null, recoveryShieldUntil: null });
  for (const id of f.planetIds) {
    await setLevel(f.db, id, 'CORE', 13);
    await setLevel(f.db, id, 'SHIPYARD', 5);
    await grant(f.db, id, 500000, 500000);
    await f.db.update(planets).set({ deuterium: 500000 }).where(eq(planets.id, id));
  }
  await placeAt(f.db, f.planetIds[0]!, { x: 5000 });
  await placeAt(f.db, f.planetIds[1]!, { x: 0 });
  await giveSatellite(f.db, f.planetIds[1]!, 'UPLINK');
  await giveInstrument(f.db, f.planetIds[1]!, 'RADAR', 3);
});
afterAll(async () => { await (await testDb()).close(); });
afterEach(() => { vi.restoreAllMocks(); });
async function launch(level: 1 | 2 | 3 = 1) {
  const asset = await buildRadiationBomb(f.db, f.planetIds[0]!, level, f.clock, f.playerIds[0]);
  await f.db.update(strategicAssets).set({ status: 'READY' }).where(eq(strategicAssets.id, asset.assetId));
  return launchRadiationBomb(f.db, { playerId: f.playerIds[0]!, originPlanetId: f.planetIds[0]!,
    target: { kind: 'PLANET', id: f.planetIds[1]! }, level, key: randomUUID(), clock: f.clock });
}
async function charge(readyAt = f.clock.now()) {
  const [asset] = await f.db.insert(strategicAssets).values({ planetId: f.planetIds[1]!,
    type: 'INTERCEPTOR', status: 'READY', startedAt: f.clock.now(), readyAt }).returning();
  return asset!.id;
}

it('lets the target battery intercept a bomb even when the arrival worker wakes late, without radiation or a hit notice', async () => {
  const chargeId = await charge();
  const result = await launch();
  f.clock.set(new Date(new Date(result.arriveAt).getTime() + 60000));
  await resolveRadiationBomb(f.db, result.flightId, f.clock);
  await resolveRadiationBomb(f.db, result.flightId, f.clock);
  const [flight] = await f.db.select().from(radiationBombFlights).where(eq(radiationBombFlights.id, result.flightId));
  expect(flight).toMatchObject({ status: 'INTERCEPTED', chargeId, interception: { trigger: 'RADAR' } });
  expect(new Date(flight!.interception!.impactAt).getTime()).toBeLessThanOrEqual(new Date(result.arriveAt).getTime());
  const [spent] = await f.db.select().from(strategicAssets).where(eq(strategicAssets.id, chargeId));
  expect(spent!.status).toBe('CONSUMED');
  expect(await f.db.select().from(hpRadiationSources)).toHaveLength(0);
  expect(await f.db.select().from(notifications).where(and(eq(notifications.refId, result.flightId), eq(notifications.kind, 'radiation_bomb_result')))).toHaveLength(0);
});

it('refreshes both spent weapon and battery inventory values when interception is claimed', async () => {
  await charge();
  const sent = await launch();
  const before = await f.db.transaction(async tx => {
    const owner = await recomputePlayerWealth(tx, f.playerIds[0]!, f.clock.now());
    const defender = await recomputePlayerWealth(tx, f.playerIds[1]!, f.clock.now());
    return { owner, defender };
  });
  f.clock.set(new Date(sent.arriveAt));
  await resolveRadiationBomb(f.db, sent.flightId, f.clock);
  const owners = await f.db.select().from(players);
  expect(owners.find(player => player.id === f.playerIds[0])!.wealth).toBe(before.owner - 52000);
  expect(owners.find(player => player.id === f.playerIds[1])!.wealth).toBe(before.defender - 88000);
});

it('spends one ready charge only once for two simultaneous incoming bomb levels', async () => {
  await charge();
  const first = await launch(1);
  const second = await launch(2);
  f.clock.set(new Date(first.arriveAt));
  await Promise.all([resolveRadiationBomb(f.db, first.flightId, f.clock), resolveRadiationBomb(f.db, second.flightId, f.clock)]);
  const flights = await f.db.select().from(radiationBombFlights);
  expect(flights.filter(flight => flight.status === 'INTERCEPTED')).toHaveLength(1);
  expect(flights.filter(flight => flight.status === 'HIT')).toHaveLength(1);
  expect(await f.db.select().from(hpRadiationSources)).toHaveLength(1);
});

it('cannot borrow a different planet’s charge or shoot without Radar L3 or identifying Telescope sight', async () => {
  await f.db.insert(strategicAssets).values({ planetId: f.planetIds[0]!, type: 'INTERCEPTOR',
    status: 'READY', startedAt: f.clock.now() });
  const first = await launch();
  f.clock.set(new Date(first.arriveAt));
  await resolveRadiationBomb(f.db, first.flightId, f.clock);
  expect((await f.db.select().from(radiationBombFlights).where(eq(radiationBombFlights.id, first.flightId)))[0]!.status).toBe('HIT');
  await charge();
  await giveInstrument(f.db, f.planetIds[1]!, 'RADAR', 2);
  const second = await launch(2);
  f.clock.set(new Date(second.arriveAt));
  await resolveRadiationBomb(f.db, second.flightId, f.clock);
  expect((await f.db.select().from(radiationBombFlights).where(eq(radiationBombFlights.id, second.flightId)))[0]!.status).toBe('HIT');
});

it('does not backdate a charge that became ready only after the bomb arrived', async () => {
  const result = await launch();
  await charge(new Date(new Date(result.arriveAt).getTime() + 1000));
  f.clock.set(new Date(new Date(result.arriveAt).getTime() + 2000));
  await resolveRadiationBomb(f.db, result.flightId, f.clock);
  expect((await f.db.select().from(radiationBombFlights))[0]!.status).toBe('HIT');
});

it('resolves interception at its scheduled edge through the real worker and emits one collision notice', async () => {
  await charge();
  const result = await launch();
  const [check] = await f.db.select().from(scheduledEvents).where(and(
    eq(scheduledEvents.refId, result.flightId), eq(scheduledEvents.kind, 'radiation_bomb_intercept')));
  expect(check).toBeDefined();
  const worker = new EventWorker(f.db, f.clock, { pollMs: 1, batch: 100, staleMinutes: 5 }, pino({ level: 'silent' }));
  f.clock.set(check!.resolveAt);
  await worker.tick();
  const [flight] = await f.db.select().from(radiationBombFlights).where(eq(radiationBombFlights.id, result.flightId));
  expect(flight!.status).toBe('INTERCEPTED');
  f.clock.set(new Date(flight!.interception!.impactAt));
  await worker.tick();
  await worker.tick();
  const notices = await f.db.select().from(notifications).where(and(eq(notifications.refId, result.flightId), eq(notifications.kind, 'strategic_intercepted')));
  expect(notices).toHaveLength(2);
  expect(new Set(notices.map(notice => notice.playerId))).toEqual(new Set(f.playerIds.slice(0, 2)));
  for (const notice of notices) expect(notice.payload).toMatchObject({
    weaponKind: 'RADIATION_BOMB', level: 1, targetPlanetId: f.planetIds[1],
    defended: notice.playerId === f.playerIds[1],
  });
});

it('refreshes only participants and identifying Telescope witnesses during the interception launch', async () => {
  await placeAt(f.db, f.planetIds[2]!, { x: 4500 });
  await placeAt(f.db, f.planetIds[3]!, { x: 4500 });
  await giveSatellite(f.db, f.planetIds[2]!, 'UPLINK');
  await giveInstrument(f.db, f.planetIds[2]!, 'TELESCOPE', 5);
  await charge();
  const result = await launch();
  const sight = vi.spyOn(streamBus, 'publishStrategicSight');
  f.clock.set(new Date(result.arriveAt));
  await resolveRadiationBomb(f.db, result.flightId, f.clock);
  expect(new Set(sight.mock.calls.map(call => call[1]))).toEqual(new Set(f.playerIds.slice(0, 3)));
});

it('defers a commander transfer until the physical intercepted bomb collision has finished', async () => {
  await charge();
  const result = await launch();
  const [check] = await f.db.select().from(scheduledEvents).where(and(
    eq(scheduledEvents.refId, result.flightId), eq(scheduledEvents.kind, 'radiation_bomb_intercept')));
  f.clock.set(check!.resolveAt);
  await new EventWorker(f.db, f.clock, { pollMs: 1, batch: 100, staleMinutes: 5 }, pino({ level: 'silent' })).tick();
  expect((await f.db.select().from(radiationBombFlights).where(eq(radiationBombFlights.id, result.flightId)))[0]!.status).toBe('INTERCEPTED');
  const waiting = await ensureWaitingSeason(f.db, f.seasonId, f.clock);
  const moved = await transferCommander(f.db, f.playerIds[0]!, waiting!.id, f.clock, undefined, { ownerRequested: true });
  expect(moved.status).toBe('FLIGHT');
});

it('wakes an already-inside bomb when a new target battery becomes ready', async () => {
  const result = await launch();
  const [check] = await f.db.select().from(scheduledEvents).where(and(
    eq(scheduledEvents.refId, result.flightId), eq(scheduledEvents.kind, 'radiation_bomb_intercept')));
  f.clock.set(new Date(check!.resolveAt.getTime() + 1000));
  const worker = new EventWorker(f.db, f.clock, { pollMs: 1, batch: 100, staleMinutes: 5 }, pino({ level: 'silent' }));
  await worker.tick();
  expect((await f.db.select().from(radiationBombFlights))[0]!.status).toBe('OUTBOUND');
  await charge(f.clock.now());
  await f.db.transaction(tx => wakeStrategicInterceptions(tx, f.planetIds[1]!, f.clock.now()));
  await worker.tick();
  expect((await f.db.select().from(radiationBombFlights))[0]!.status).toBe('INTERCEPTED');
});

it('uses the bomb’s frozen trajectory for interception instead of re-deriving Death Star orbit geometry', async () => {
  const sent = await launch();
  const [flight] = await f.db.select().from(radiationBombFlights).where(eq(radiationBombFlights.id, sent.flightId));
  await placeAt(f.db, f.planetIds[0]!, { x: 10000 });
  const leg = await f.db.transaction(tx => bombInterceptionLeg(tx, flight!));
  expect(leg!.drawn).toEqual({ from: flight!.originPosition, to: flight!.targetPosition });
});

it('publishes the intercepted bomb’s model and geometry to participants, and only the explosion to an unseen bystander', async () => {
  await charge();
  const sent = await launch(3);
  f.clock.set(new Date(sent.arriveAt));
  await resolveRadiationBomb(f.db, sent.flightId, f.clock);
  const [flight] = await f.db.select().from(radiationBombFlights).where(eq(radiationBombFlights.id, sent.flightId));
  const snapshot = await loadTrafficSnapshot(f.db, f.seasonId, new Date(flight!.interception!.launchAt));
  expect(projectStrategicInterceptions(snapshot, f.playerIds[0]!, [])).toMatchObject([{ id: sent.flightId, radiationBombLevel: 3 }]);
  expect(projectStrategicInterceptions(snapshot, null, [])).toEqual([]);
  expect(projectStrategicInterceptionImpacts(snapshot, null, [], new Date(flight!.interception!.impactAt)))
    .toMatchObject([{ id: sent.flightId, effectOnly: true, focusEligible: false }]);
});

it('arms an immediate shot when the launch point is already inside the target interception ring', async () => {
  await placeAt(f.db, f.planetIds[0]!, { x: 500 });
  await charge();
  const sent = await launch();
  const events = await f.db.select().from(scheduledEvents).where(and(eq(scheduledEvents.refId, sent.flightId),
    eq(scheduledEvents.kind, 'radiation_bomb_intercept')));
  expect(events.some(event => event.resolveAt.toISOString() === sent.departAt)).toBe(true);
});

it('does not keep creating immediate polling events when the weapon is in range but the battery is empty', async () => {
  const sent = await launch();
  const [check] = await f.db.select().from(scheduledEvents).where(and(eq(scheduledEvents.refId, sent.flightId),
    eq(scheduledEvents.kind, 'radiation_bomb_intercept')));
  f.clock.set(new Date(check!.resolveAt.getTime()+1000));
  await new EventWorker(f.db, f.clock, {pollMs:1,batch:100,staleMinutes:5},pino({level:'silent'})).tick();
  const immediate = await f.db.select().from(scheduledEvents).where(and(eq(scheduledEvents.refId, sent.flightId),
    eq(scheduledEvents.kind, 'radiation_bomb_intercept'),eq(scheduledEvents.status,'pending')));
  expect(immediate.filter(event=>event.resolveAt<=f.clock.now())).toHaveLength(0);
});
