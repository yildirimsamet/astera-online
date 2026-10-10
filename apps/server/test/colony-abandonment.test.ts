import { randomUUID } from 'node:crypto';
import { and, eq, sql } from 'drizzle-orm';
import { pino } from 'pino';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MONUMENT_CAPACITY, dockLocation } from '@astera/rules';
import { buildApp } from '../src/app.js';
import { TokenService } from '../src/auth/tokens.js';
import {
  buildOrders, buildings, clans, clanSupportWaves, clanWarContributions, clanWarOperations,
  galaxyEventOccurrences, intergalacticConvoyRuns, miningRuns, missions, monumentProbes,
  monuments, monumentWaves, neutralPlanetState, notifications, pirateRaids, planetFaults, planets, players,
  scheduledEvents, seasons, shipDamageLots, strategicAssets, strategicInterceptions, tradeRuns, units,
} from '../src/db/schema.js';
import { launchAttack } from '../src/services/mission.js';
import { recomputePlayerWealth } from '../src/services/planet.js';
import type { StreamEvent } from '../src/stream/bus.js';
import { giveUnits, seedWorld, setLevel, testDb, testEnv, type Fixture } from './helpers.js';

let f: Fixture;
let built: ReturnType<typeof buildApp>;
let colony: string;
let capital: string;
let auth: { authorization: string };
const silent = pino({ level: 'silent' });
const later = () => new Date(f.clock.now().getTime() + 3_600_000);
const url = () => `/api/planets/${colony}/abandon`;
const drop = (payload: Record<string, unknown> = { confirm: true }) => built.app.inject({
  method: 'POST', url: url(), headers: auth, payload,
});
const check = () => built.app.inject({ method: 'GET', url: url(), headers: auth });
const world = () => f.db.select().from(planets).where(eq(planets.id, colony)).then(rows => rows[0]!);

beforeEach(async () => {
  f = await seedWorld(3);
  capital = f.planetIds[0]!;
  colony = f.planetIds[2]!;
  await f.db.update(planets).set({ kind: 'COLONY', controllerPlayerId: f.playerIds[0]! }).where(eq(planets.id, colony));
  await f.db.update(units).set({ ownerPlayerId: f.playerIds[0]! }).where(eq(units.planetId, colony));
  built = buildApp({ env: testEnv(), db: f.db, clock: f.clock, logger: silent });
  await built.app.ready();
  const token = await new TokenService('test-secret-that-is-long-enough', 15, 30).issueAccess(f.accountIds[0]!);
  auth = { authorization: `Bearer ${token}` };
});
afterEach(async () => { await built.close(); });
afterAll(async () => { await (await testDb()).close(); });

const flight = async (over: Partial<typeof missions.$inferInsert> = {}) => (await f.db.insert(missions).values({
  seasonId: f.seasonId, ownerPlayerId: f.playerIds[0]!, kind: 'attack', originPlanetId: colony,
  targetPlanetId: f.planetIds[1]!, fleet: { DART: 1 }, distance: 30, fuelPaid: 5,
  departAt: f.clock.now(), arriveAt: later(), ...over,
}).returning())[0]!;

async function blocked(reason: string): Promise<void> {
  const before = await world();
  const eligibility = await check();
  expect(eligibility.statusCode, eligibility.body).toBe(200);
  const state = eligibility.json<{ allowed: boolean; reasons: string[] }>();
  expect(state.allowed).toBe(false);
  expect(state.reasons).toContain(reason);
  const result = await drop();
  expect(result.statusCode, result.body).toBe(409);
  expect(result.json()).toMatchObject({ error: 'COLONY_ABANDON_BLOCKED' });
  expect(await world()).toEqual(before);
  expect(await f.db.select().from(neutralPlanetState).where(eq(neutralPlanetState.planetId, colony))).toHaveLength(0);
}

const clan = async () => (await f.db.insert(clans).values({
  seasonId: f.seasonId, name: 'Abandon Test', nameKey: 'abandon test', tag: 'AT', createdAt: f.clock.now(),
}).returning())[0]!;

describe('confirmed colony abandonment', () => {
  it('checking alone never changes ownership', async () => {
    const before = await world();
    const result = await check();
    expect(result.statusCode, result.body).toBe(200);
    expect(result.json()).toEqual({ planetId: colony, allowed: true, reasons: [] });
    expect(await world()).toEqual(before);
  });

  it('publishes a committed ownership change through the immediate control stream', async () => {
    const seen: StreamEvent[] = [];
    await built.bus.start();
    const unsubscribe = built.bus.subscribeShard(f.seasonId, event => { seen.push(event); });
    try {
      expect((await drop()).statusCode).toBe(200);
      await vi.waitFor(() => { expect(seen.map(event => event.kind)).toContain('shard:control'); }, { timeout: 2000 });
      expect(seen.find(event => event.kind === 'shard:control')).toEqual({ shard: f.seasonId, kind: 'shard:control' });
    } finally { unsubscribe(); }
  });

  it('keeps development and stock, sends mobile ships home and leaves ground defences', async () => {
    await setLevel(f.db, colony, 'CORE', 12);
    await giveUnits(f.db, colony, { DART: 8, THORN: 4 });
    const before = await world();
    const levels = await f.db.select().from(buildings).where(eq(buildings.planetId, colony));
    const homeBefore = (await f.db.select().from(units).where(and(eq(units.planetId, capital), eq(units.hull, 'DART'))))[0]?.count ?? 0;
    const result = await drop();
    expect(result.statusCode, result.body).toBe(200);
    expect(result.json()).toMatchObject({ abandonedPlanetId: colony, capital: { planet: { id: capital } } });
    expect(await world()).toMatchObject({ kind: 'NEUTRAL', controllerPlayerId: null, alloy: before.alloy, crystal: before.crystal });
    expect(await f.db.select().from(buildings).where(eq(buildings.planetId, colony))).toEqual(levels);
    const parked = await f.db.select().from(units).where(eq(units.planetId, colony));
    expect(parked.find(row => row.hull === 'DART' && row.location === 'home')).toBeUndefined();
    expect(parked.find(row => row.hull === 'THORN')).toMatchObject({ count: 4, ownerPlayerId: null });
    const home = await f.db.select().from(units).where(and(eq(units.planetId, capital), eq(units.hull, 'DART'), eq(units.location, 'home')));
    expect(home[0]?.count).toBe(homeBefore + 8);
    expect(await f.db.select().from(neutralPlanetState).where(eq(neutralPlanetState.planetId, colony))).toHaveLength(1);
    const notes = await f.db.select().from(notifications).where(eq(notifications.kind, 'colony_lost'));
    expect(notes).toHaveLength(1);
    expect(notes[0]?.payload).toMatchObject({ cause: 'ABANDONED', planetId: colony });
  });

  it('refreshes the former owner’s Wealth before returning the capital without changing Dominion', async () => {
    await giveUnits(f.db, colony, { DART: 8, THORN: 4 });
    const before = await f.db.transaction(tx => recomputePlayerWealth(tx, f.playerIds[0]!));
    const [actor] = await f.db.select().from(players).where(eq(players.id, f.playerIds[0]!));
    const result = await drop();
    expect(result.statusCode, result.body).toBe(200);
    const returned = result.json<{ capital: { score: { wealth: number } } }>().capital.score.wealth;
    expect(returned).toBeLessThan(before);
    const [after] = await f.db.select().from(players).where(eq(players.id, f.playerIds[0]!));
    expect(after).toMatchObject({ wealth: returned, dominionTaken: actor!.dominionTaken, dominionLost: actor!.dominionLost });
    expect(await f.db.transaction(tx => recomputePlayerWealth(tx, f.playerIds[0]!))).toBe(returned);
  });

  it('includes capital production accrued since its last tick in the returned Wealth', async () => {
    f.clock.set(later());
    const result = await drop();
    expect(result.statusCode, result.body).toBe(200);
    const returned = result.json<{ capital: { score: { wealth: number } } }>().capital.score.wealth;
    const [actor] = await f.db.select().from(players).where(eq(players.id, f.playerIds[0]!));
    const fresh = await f.db.transaction(tx => recomputePlayerWealth(tx, f.playerIds[0]!));
    expect(returned).toBe(fresh);
    expect(actor!.wealth).toBe(fresh);
  });

  it.each([{}, { confirm: false }, { confirm: 'true' }, { confirm: true, planetId: 'forged' }])('requires a strict explicit confirmation: %j', async payload => {
    expect((await drop(payload)).statusCode).toBe(400);
    expect((await world()).kind).toBe('COLONY');
  });

  it('rejects unauthenticated access, forged ownership, the capital and malformed IDs', async () => {
    expect((await built.app.inject({ method: 'POST', url: url(), payload: { confirm: true } })).statusCode).toBe(401);
    for (const method of ['GET', 'POST'] as const) {
      expect((await built.app.inject({ method, url: `/api/planets/${f.planetIds[1]!}/abandon`, headers: auth,
        ...(method === 'POST' ? { payload: { confirm: true } } : {}) })).statusCode).toBe(403);
      const home = await built.app.inject({ method, url: `/api/planets/${capital}/abandon`, headers: auth,
        ...(method === 'POST' ? { payload: { confirm: true } } : {}) });
      expect(home.statusCode).toBe(409);
      expect(home.json()).toMatchObject({ error: 'CAPITAL_CANNOT_BE_ABANDONED' });
    }
    expect((await built.app.inject({ method: 'POST', url: '/api/planets/not-a-uuid/abandon', headers: auth,
      payload: { confirm: true } })).statusCode).toBe(400);
  });

  it('cancels paid queue work without refund or a later build completion', async () => {
    const [order] = await f.db.insert(buildOrders).values({ planetId: colony, queue: 'YARD', slot: 0,
      kind: 'HULL', subject: 'DART', startedAt: f.clock.now(), readyAt: later(), remainingSeconds: 3600,
      cost: { alloy: 150, crystal: 10, deuterium: 0 } }).returning();
    await f.db.insert(scheduledEvents).values({ seasonId: f.seasonId, kind: 'build_complete', refId: order!.id, resolveAt: later() });
    const homeBefore = (await f.db.select().from(planets).where(eq(planets.id, capital)))[0]!.alloy;
    expect((await drop()).statusCode).toBe(200);
    expect((await f.db.select().from(buildOrders).where(eq(buildOrders.id, order!.id)))[0]?.status).toBe('CANCELLED');
    expect((await f.db.select().from(scheduledEvents).where(eq(scheduledEvents.refId, order!.id)))[0]?.status).toBe('done');
    expect((await f.db.select().from(planets).where(eq(planets.id, capital)))[0]?.alloy).toBe(homeBefore);
  });

  it('permits docked ships and moves their damage intact to the capital', async () => {
    const [lot] = await f.db.insert(shipDamageLots).values({ planetId: colony, hull: 'DART', damageBp: 6500,
      remainderBp: 0.25, createdAt: f.clock.now() }).returning();
    await f.db.insert(units).values({ planetId: colony, ownerPlayerId: f.playerIds[0]!, hull: 'DART',
      count: 2, location: dockLocation(lot!.id) });
    expect((await drop()).statusCode).toBe(200);
    expect((await f.db.select().from(shipDamageLots).where(eq(shipDamageLots.id, lot!.id)))[0])
      .toMatchObject({ planetId: capital, damageBp: 6500, remainderBp: 0.25, repairOrderId: null });
    expect((await f.db.select().from(units).where(eq(units.location, dockLocation(lot!.id))))[0])
      .toMatchObject({ planetId: capital, count: 2, ownerPlayerId: f.playerIds[0] });
  });

  it('two concurrent confirmations produce one abandonment and one fleet transfer', async () => {
    await giveUnits(f.db, colony, { DART: 7 });
    const before = (await f.db.select().from(units).where(and(eq(units.planetId, capital), eq(units.hull, 'DART'))))[0]?.count ?? 0;
    const results = await Promise.all([drop(), drop()]);
    expect(results.map(row => row.statusCode).toSorted()).toEqual([200, 403]);
    expect((await f.db.select().from(units).where(and(eq(units.planetId, capital), eq(units.hull, 'DART'))))[0]?.count).toBe(before + 7);
    expect(await f.db.select().from(notifications).where(eq(notifications.kind, 'colony_lost'))).toHaveLength(1);
  });

  it('rolls back ownership, fleet and caretaker if teardown fails', async () => {
    await f.db.execute(sql`create function test_abandon_failure() returns trigger language plpgsql as $$
      begin raise exception 'test notification failure'; end; $$`);
    await f.db.execute(sql`create trigger test_abandon_failure before insert on notifications
      for each row when (new.kind = 'colony_lost') execute function test_abandon_failure()`);
    try {
      const before = await world();
      const fleet = await f.db.select().from(units);
      expect((await drop()).statusCode).toBe(500);
      expect(await world()).toEqual(before);
      expect(await f.db.select().from(units)).toEqual(fleet);
      expect(await f.db.select().from(neutralPlanetState).where(eq(neutralPlanetState.planetId, colony))).toHaveLength(0);
    } finally {
      await f.db.execute(sql`drop trigger test_abandon_failure on notifications`);
      await f.db.execute(sql`drop function test_abandon_failure()`);
    }
  });

  it('refuses abandonment after the live season ends', async () => {
    await f.db.update(seasons).set({ status: 'frozen' }).where(eq(seasons.id, f.seasonId));
    expect((await drop()).statusCode).toBe(409);
    expect((await world()).kind).toBe('COLONY');
  });
});

describe('persistent activity guards', () => {
  it.each(['attack', 'probe', 'return', 'transfer', 'settlement', 'death_star', 'clan_transfer', 'clan_war', 'clan_support'] as const)('blocks an outgoing %s mission', async kind => {
      await flight({ kind });
      await blocked('FLIGHT');
    });

  it.each(['attack', 'probe', 'transfer', 'death_star', 'clan_war', 'clan_support'] as const)('blocks an undetected incoming %s without exposing its private details', async kind => {
      const incoming = await flight({ kind, ownerPlayerId: f.playerIds[1]!, originPlanetId: f.planetIds[1]!, targetPlanetId: colony });
      await blocked('FLIGHT');
      const result = await check();
      expect(result.json()).toEqual({ planetId: colony, allowed: false, reasons: ['FLIGHT'] });
      for (const hidden of [incoming.id, f.playerIds[1]!, f.planetIds[1]!, incoming.arriveAt.toISOString()]) {
        expect(result.body).not.toContain(hidden);
        expect((await drop()).body).not.toContain(hidden);
      }
    });

  it('uses unresolved status even when a flight arrival is overdue', async () => {
    await flight({ arriveAt: new Date(f.clock.now().getTime() - 1000) });
    await blocked('FLIGHT');
  });

  it.each(['resolved', 'cancelled'] as const)('ignores %s historical missions', async status => {
    await flight({ status });
    expect((await drop()).statusCode).toBe(200);
  });

  it('ignores another owned world’s independent flight', async () => {
    await flight({ originPlanetId: capital });
    expect((await drop()).statusCode).toBe(200);
  });

  it('checks again after a successful preflight and serializes with a concurrent launch', async () => {
    expect((await check()).json()).toMatchObject({ allowed: true });
    // The same world lock taken by every real launch: hold it while the POST queues.
    let release: () => void = () => undefined;
    let announce: () => void = () => undefined;
    const held = new Promise<void>(resolve => { announce = resolve; });
    const gate = new Promise<void>(resolve => { release = resolve; });
    const launch = f.db.transaction(async tx => {
      await tx.select().from(planets).where(eq(planets.id, colony)).for('update');
      announce();
      await gate;
      await tx.insert(missions).values({ seasonId: f.seasonId, ownerPlayerId: f.playerIds[1]!, kind: 'attack',
        originPlanetId: f.planetIds[1]!, targetPlanetId: colony, fleet: { DART: 1 }, distance: 30,
        fuelPaid: 5, departAt: f.clock.now(), arriveAt: later() });
    });
    await held;
    const abandoning = drop();
    release();
    await launch;
    expect((await abandoning).statusCode).toBe(409);
    expect((await world()).kind).toBe('COLONY');
  });

  it('races the real attack service without abandoning an already launched target or deadlocking', async () => {
    const enemy = f.planetIds[1]!;
    await setLevel(f.db, enemy, 'CORE', 9);
    await setLevel(f.db, colony, 'CORE', 9);
    await giveUnits(f.db, enemy, { DART: 2 });
    await f.db.update(planets).set({ deuterium: 300 }).where(eq(planets.id, enemy));
    const [attack, abandon] = await Promise.allSettled([
      launchAttack(f.db, enemy, colony, { DART: 1 }, f.clock, f.playerIds[1]), drop(),
    ]);
    if (attack.status === 'rejected') throw attack.reason;
    if (abandon.status === 'rejected') throw abandon.reason;
    expect([200, 409]).toContain(abandon.value.statusCode);
    if (abandon.value.statusCode === 409) {
      expect(abandon.value.json()).toMatchObject({ error: 'COLONY_ABANDON_BLOCKED' });
      expect((await world()).kind).toBe('COLONY');
    } else expect((await world()).kind).toBe('NEUTRAL');
    expect(await f.db.select().from(missions).where(and(eq(missions.targetPlanetId, colony), eq(missions.status, 'in_flight')))).toHaveLength(1);
  });

  it.each(['outbound', 'returning'] as const)('blocks %s mining and salvage runs', async status => {
    await f.db.insert(miningRuns).values({ seasonId: f.seasonId, planetId: colony, ownerPlayerId: f.playerIds[0]!,
      status, asteroidIndex: 0, craft: 1, holdEach: 200, interceptX: 1, interceptY: 0, interceptZ: 0,
      departAt: f.clock.now(), arriveAt: later() });
    await blocked('MINING');
  });

  it.each(['outbound', 'returning'] as const)('blocks %s pirate raids', async status => {
    await f.db.insert(pirateRaids).values({ seasonId: f.seasonId, planetId: colony, ownerPlayerId: f.playerIds[0]!,
      pirateIndex: 0, status, fleet: { DART: 1 }, interceptX: 1, interceptY: 0, interceptZ: 0,
      departAt: f.clock.now(), arriveAt: later() });
    await blocked('PIRATE');
  });

  it.each(['OUTBOUND', 'STAGED', 'RECALL_ORDERED', 'IN_BATTLE', 'RETURNING'] as const)('blocks %s joint war contributions even without an airborne mission', async status => {
      const group = await clan();
      const [operation] = await f.db.insert(clanWarOperations).values({ seasonId: f.seasonId, clanId: group.id,
        clanName: group.name, clanTag: group.tag, leaderPlayerId: f.playerIds[0]!, stagingPlanetId: capital,
        targetPlanetId: f.planetIds[1]!, targetPlayerId: f.playerIds[1]!, targetPlanetName: 'Target',
        targetX: 1, targetY: 0, targetZ: 0, createdAt: f.clock.now(), expiresAt: later() }).returning();
      await f.db.insert(clanWarContributions).values({ seasonId: f.seasonId, operationId: operation!.id,
        clanId: group.id, playerId: f.playerIds[0]!, originPlanetId: colony, fleet: { DART: 1 },
        tech: {}, unitLocation: `joint:${randomUUID()}`, reservedBulk: 1, fuelPaid: 5, fuelLegs: [],
        status, sentAt: f.clock.now() });
      await blocked('CLAN_WAR');
    });

  it('blocks an incoming joint attack using only a generic flight reason', async () => {
    const group = await clan();
    await f.db.insert(clanWarOperations).values({ seasonId: f.seasonId, clanId: group.id,
      clanName: group.name, clanTag: group.tag, leaderPlayerId: f.playerIds[1]!, stagingPlanetId: f.planetIds[1]!,
      targetPlanetId: colony, targetPlayerId: f.playerIds[0]!, targetPlanetName: 'Hidden target',
      targetX: 1, targetY: 0, targetZ: 0, status: 'ATTACKING', startedAt: f.clock.now(),
      createdAt: f.clock.now(), expiresAt: later() });
    await blocked('FLIGHT');
    expect((await check()).json()).toEqual({ planetId: colony, allowed: false, reasons: ['FLIGHT'] });
  });

  it.each(['OUTBOUND', 'STATIONED', 'RETURNING'] as const)('blocks %s support sent or hosted by the colony', async status => {
    const group = await clan();
    const outward = await flight({ kind: 'clan_support', status: 'resolved' });
    const id = randomUUID();
    await f.db.insert(clanSupportWaves).values({ id, seasonId: f.seasonId, clanId: group.id,
      senderPlayerId: f.playerIds[0]!, hostPlayerId: f.playerIds[1]!, originPlanetId: colony,
      hostPlanetId: f.planetIds[1]!, unitLocation: `support:${id}`, fleet: { DART: 1 },
      reservedBulk: 1, fuelPaid: 5, status, outboundMissionId: outward.id, sentAt: f.clock.now(),
      arriveAt: later(), stationedAt: f.clock.now(), expiresAt: later(), returnAt: later(), returnReason: 'RECALLED' });
    await blocked('CLAN_SUPPORT');
    await f.db.update(clanSupportWaves).set({ originPlanetId: f.planetIds[1]!, hostPlanetId: colony,
      senderPlayerId: f.playerIds[1]!, hostPlayerId: f.playerIds[0]! }).where(eq(clanSupportWaves.id, id));
    await blocked('CLAN_SUPPORT');
  });

  it.each(['OUTBOUND', 'HOLD', 'RETURNING'] as const)('blocks a %s monument fleet', async status => {
    const [target] = await f.db.insert(monuments).values({ seasonId: f.seasonId, ordinal: 1, x: 6000, y: 0, z: 0,
      capacity: MONUMENT_CAPACITY, productionPerMinute: 0, settledAt: f.clock.now() }).returning();
    const id = randomUUID();
    await f.db.insert(monumentWaves).values({ id, seasonId: f.seasonId, monumentId: target!.id,
      playerId: f.playerIds[0]!, originPlanetId: colony, unitLocation: `monument:${id}`, purpose: 'ATTACK',
      sentFleet: { DART: 1 }, tech: {}, route: [], fuelPaid: 5, status, sentAt: f.clock.now(),
      heldAt: f.clock.now(), arriveAt: later(), returnReason: status === 'RETURNING' ? 'RECALLED' : null,
      radiationSettledAt: f.clock.now() });
    await blocked('MONUMENT');
  });

  it.each(['OUTBOUND', 'RETURNING'] as const)('blocks a %s monument probe', async status => {
    const [target] = await f.db.insert(monuments).values({ seasonId: f.seasonId, ordinal: 1, x: 6000, y: 0, z: 0,
      capacity: MONUMENT_CAPACITY, productionPerMinute: 0, settledAt: f.clock.now() }).returning();
    await f.db.insert(monumentProbes).values({ seasonId: f.seasonId, monumentId: target!.id,
      playerId: f.playerIds[0]!, originPlanetId: colony, status, outboundRoute: [], departAt: f.clock.now(), arriveAt: later(),
      ...(status === 'RETURNING' ? { snapshotFleet: {}, observedAt: f.clock.now(), returnRoute: [], homeAt: later() } : {}) });
    await blocked('MONUMENT');
  });

  it('allows terminal monument history and preserves the former owner’s safe return origin', async () => {
    const [target] = await f.db.insert(monuments).values({ seasonId: f.seasonId, ordinal: 1, x: 6000, y: 0, z: 0,
      capacity: MONUMENT_CAPACITY, productionPerMinute: 0, settledAt: f.clock.now() }).returning();
    const id = randomUUID();
    await f.db.insert(monumentWaves).values({ id, seasonId: f.seasonId, monumentId: target!.id,
      playerId: f.playerIds[1]!, originPlanetId: colony, unitLocation: `monument:${id}`, purpose: 'ATTACK',
      sentFleet: { DART: 1 }, tech: {}, route: [], fuelPaid: 5, status: 'HOME', sentAt: f.clock.now(),
      arriveAt: f.clock.now(), resolvedAt: f.clock.now(), radiationSettledAt: f.clock.now() });
    expect((await drop()).statusCode).toBe(200);
    expect((await f.db.select().from(monumentWaves).where(eq(monumentWaves.id, id)))[0])
      .toMatchObject({ status: 'HOME', originPlanetId: f.planetIds[1] });
  });

  it.each(['BUILDING', 'PAUSED', 'LAUNCHED'] as const)('blocks %s strategic assets', async status => {
    await f.db.insert(strategicAssets).values({ planetId: colony, status, startedAt: f.clock.now(), readyAt: later() });
    await blocked('STRATEGIC');
  });

  it.each(['READY', 'CONSUMED'] as const)('ignores %s strategic hardware', async status => {
    const [asset] = await f.db.insert(strategicAssets).values({ planetId: colony, status, startedAt: f.clock.now() }).returning();
    expect((await drop()).statusCode).toBe(200);
    expect(await f.db.select().from(strategicAssets).where(eq(strategicAssets.id, asset!.id))).toEqual([asset]);
  });

  it.each(['target', 'origin'] as const)('blocks a still-unresolved interception after its mission is resolved at the %s', async end => {
    const incoming = await flight({ status: 'resolved', kind: 'death_star',
      originPlanetId: end === 'origin' ? colony : f.planetIds[1]!,
      targetPlanetId: end === 'target' ? colony : f.planetIds[1]!,
      ownerPlayerId: end === 'origin' ? f.playerIds[0]! : f.playerIds[1]!,
    });
    const [charge] = await f.db.insert(strategicAssets).values({ planetId: incoming.targetPlanetId,
      status: 'CONSUMED', type: 'INTERCEPTOR', startedAt: f.clock.now() }).returning();
    await f.db.insert(strategicInterceptions).values({ seasonId: f.seasonId, missionId: incoming.id,
      attackerPlayerId: incoming.ownerPlayerId, defenderPlayerId: end === 'target' ? f.playerIds[0]! : f.playerIds[1]!,
      targetPlanetId: incoming.targetPlanetId,
      chargeId: charge!.id, trigger: 'RADAR', launchAt: f.clock.now(), impactAt: later(),
      launchX: 0, launchY: 0, launchZ: 0, deathStarFromX: 1, deathStarFromY: 0, deathStarFromZ: 0,
      collisionX: 0, collisionY: 0, collisionZ: 0 });
    await blocked('STRATEGIC');
  });

  it('refuses positive off-world inventory even without a recognised mission', async () => {
    await f.db.insert(units).values({ planetId: colony, ownerPlayerId: f.playerIds[0]!, hull: 'DART', location: 'future-task', count: 1 });
    await blocked('AWAY_SHIPS');
  });

  it('ignores empty off-world rows and completed mining runs', async () => {
    await f.db.insert(units).values({ planetId: colony, ownerPlayerId: f.playerIds[0]!, hull: 'DART', location: 'past-task', count: 0 });
    await f.db.insert(miningRuns).values({ seasonId: f.seasonId, planetId: colony, status: 'done', asteroidIndex: 0,
      craft: 1, holdEach: 200, interceptX: 1, interceptY: 0, interceptZ: 0, departAt: f.clock.now(), arriveAt: later() });
    expect((await drop()).statusCode).toBe(200);
  });

  it.each(['protectedUntil', 'recoveryUntil'] as const)('blocks a live %s ownership transition', async field => {
    await f.db.update(planets).set({ [field]: later() }).where(eq(planets.id, colony));
    await blocked('RECOVERY');
  });

  it('blocks zero loyalty awaiting secession', async () => {
    await f.db.update(planets).set({ loyalty: 0 }).where(eq(planets.id, colony));
    await blocked('SECESSION');
  });

  it('blocks loyalty that reached zero since the last stored tick without mutating the preflight', async () => {
    await setLevel(f.db, colony, 'CORE', 6);
    await setLevel(f.db, colony, 'DEUTERIUM_PLANT', 3);
    await f.db.insert(planetFaults).values({ planetId: colony, kind: 'REFINERY_OUTAGE', startedAt: f.clock.now() });
    await f.db.update(planets).set({ loyalty: 0.1, lastTickAt: new Date(f.clock.now().getTime() - 86_400_000) }).where(eq(planets.id, colony));
    await blocked('SECESSION');
    expect((await world()).loyalty).toBe(0.1);
  });

  it.each(['protectedUntil', 'recoveryUntil'] as const)('allows abandonment exactly when %s ends', async field => {
    await f.db.update(planets).set({ [field]: f.clock.now() }).where(eq(planets.id, colony));
    expect((await check()).json()).toMatchObject({ allowed: true, reasons: [] });
    expect((await drop()).statusCode).toBe(200);
  });

  it.each(['outbound', 'returning'] as const)('blocks %s trade and intergalactic convoy runs', async status => {
    const [occurrence] = await f.db.insert(galaxyEventOccurrences).values({ seasonId: f.seasonId,
      sequence: 0, kind: 'TRADE_SHIP', definitionVersion: 1, startsAt: f.clock.now(), endsAt: later(),
      effect: { rate: { alloy: 1, crystal: 1, deuterium: 1 } } }).returning();
    if (!occurrence) throw new Error('event fixture was not inserted');
    await f.db.insert(tradeRuns).values({ seasonId: f.seasonId, occurrenceId: occurrence.id, planetId: colony,
      ownerPlayerId: f.playerIds[0]!, status, fleet: { COURIER: 1 }, give: { alloy: 1, crystal: 0, deuterium: 0 },
      want: { alloy: 0, crystal: 1, deuterium: 0 }, rate: { alloy: 1, crystal: 1, deuterium: 1 },
      interceptX: 1, interceptY: 0, interceptZ: 0, departAt: f.clock.now(), arriveAt: later() });
    await blocked('TRADE');
    await f.db.update(tradeRuns).set({ status: 'done' }).where(eq(tradeRuns.planetId, colony));
    await f.db.insert(intergalacticConvoyRuns).values({ seasonId: f.seasonId, occurrenceId: occurrence.id,
      planetId: colony, ownerPlayerId: f.playerIds[0]!, status, fleet: { DART: 1 }, tech: {},
      interceptX: 1, interceptY: 0, interceptZ: 0, engagementEndX: 1, engagementEndY: 0, engagementEndZ: 0,
      returnX: 0, returnY: 0, returnZ: 0, departAt: f.clock.now(), arriveAt: later(),
      engagementEndsAt: new Date(later().getTime() + 5000), homeAt: new Date(later().getTime() + 60000),
      productionCap: { alloy: 1, crystal: 1, deuterium: 1 }, resourceQualityFactor: 1,
      shipQualityFactor: 1, quotedResourceReward: { alloy: 1, crystal: 1, deuterium: 1 },
      ...(status === 'returning' ? { resourceReward: { alloy: 1, crystal: 1, deuterium: 1 }, awardedFleet: {} } : {}) });
    await blocked('CONVOY');
  });
});
