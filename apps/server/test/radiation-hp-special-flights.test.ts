import { randomUUID } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { GALAXY_EVENTS, HULLS, TRADE, pirateCapture, seededFrom, type Fleet } from '@astera/rules';
import { asteroidSpawnHours, galaxyEventOccurrences, hpRadiationSources, intergalacticConvoyRuns, notifications, pirateRaids, planets, seasons, tradeRuns, units } from '../src/db/schema.js';
import { loadPirateSnapshot } from '../src/services/pirateField.js';
import { resolvePirateArrival, resolvePirateReturn } from '../src/services/pirateRaid.js';
import { abandonTradeRun, dockEndsAt, resolveTradeArrival, resolveTradeReturn, tradeLocation } from '../src/services/trade.js';
import { abandonIntergalacticConvoyRun, intergalacticConvoyLocation, resolveIntergalacticConvoyArrival, resolveIntergalacticConvoyReturn } from '../src/services/intergalacticConvoyRaid.js';
import { dockLotsOf } from '../src/services/shipDamage.js';
import { lockSeason } from '../src/services/planet.js';
import { pendingThreads } from '../src/services/session.js';
import { loadTrafficSnapshot, projectGalaxyTraffic, type SensorPost } from '../src/services/traffic.js';
import { lockWorlds } from '../src/services/ownership.js';
import type { Tx } from '../src/db/client.js';
import { giveUnits, seedWorld, testDb, type Fixture } from './helpers.js';

let f: Fixture;
const now = () => f.clock.now();
const minute = (offset: number) => new Date(now().getTime() + offset * 60_000);
const zero = { alloy: 0, crystal: 0, deuterium: 0 };
async function cloud(hp: number, over: Partial<typeof hpRadiationSources.$inferInsert> = {}) {
  await f.db.insert(hpRadiationSources).values({ seasonId: f.seasonId, anchorKind: 'ZONE', x: 0, y: 0, z: 0,
    radius: 100_000, intensityHpPerMinute: hp, mode: 'EMIT', activeFrom: now(), ...over });
}
async function apply<T>(fn: (tx: Tx) => Promise<T>) {
  return f.db.transaction(async (tx) => {
    await lockSeason(tx, f.seasonId);
    await lockWorlds(tx, f.planetIds);
    return fn(tx);
  });
}
async function merchant() {
  const [row] = await f.db.insert(galaxyEventOccurrences).values({ seasonId: f.seasonId, sequence: 0,
    kind: 'TRADE_SHIP', definitionVersion: GALAXY_EVENTS.definitions.TRADE_SHIP.version,
    startsAt: now(), endsAt: minute(180), effect: { rate: TRADE.rate } }).returning();
  if (!row) throw new Error('missing merchant');
  return row;
}
async function trade(fleet: Fleet = { COURIER: 2 }) {
  const occurrence = await merchant();
  const [run] = await f.db.insert(tradeRuns).values({ seasonId: f.seasonId, occurrenceId: occurrence.id,
    planetId: f.planetIds[0]!, ownerPlayerId: f.playerIds[0]!, fleet, give: { ...zero, alloy: 600 },
    want: { ...zero, crystal: 200 }, rate: TRADE.rate, interceptX: 100, interceptY: 0, interceptZ: 0,
    departAt: now(), arriveAt: minute(1) }).returning();
  if (!run) throw new Error('missing trade run');
  await giveUnits(f.db, f.planetIds[0]!, fleet, tradeLocation(run.id));
  return run;
}
async function convoy(fleet: Fleet = { DART: 2 }) {
  const [occurrence] = await f.db.insert(galaxyEventOccurrences).values({ seasonId: f.seasonId, sequence: 0,
    kind: 'INTERGALACTIC_CONVOY', definitionVersion: GALAXY_EVENTS.definitions.INTERGALACTIC_CONVOY.version,
    startsAt: now(), endsAt: minute(180), effect: GALAXY_EVENTS.definitions.INTERGALACTIC_CONVOY.windows[0]!.effect }).returning();
  if (!occurrence) throw new Error('missing convoy');
  const [run] = await f.db.insert(intergalacticConvoyRuns).values({ seasonId: f.seasonId, occurrenceId: occurrence.id,
    planetId: f.planetIds[0]!, ownerPlayerId: f.playerIds[0]!, fleet, tech: {},
    interceptX: 100, interceptY: 0, interceptZ: 0, engagementEndX: 101, engagementEndY: 0, engagementEndZ: 0,
    returnX: 0, returnY: 0, returnZ: 0, departAt: now(), arriveAt: minute(1),
    engagementEndsAt: new Date(minute(1).getTime() + 5000), homeAt: minute(2),
    productionCap: { alloy: 100, crystal: 100, deuterium: 100 }, resourceQualityFactor: 1, shipQualityFactor: 0,
    quotedResourceReward: { alloy: 100, crystal: 0, deuterium: 0 } }).returning();
  if (!run) throw new Error('missing convoy run');
  await giveUnits(f.db, f.planetIds[0]!, fleet, intergalacticConvoyLocation(run.id));
  return run;
}
beforeEach(async () => {
  f = await seedWorld(1, 20_261_008);
  await f.db.update(seasons).set({ rulesetVersion: 16 }).where(eq(seasons.id, f.seasonId));
  await f.db.update(planets).set({ x: 0, y: 0, z: 0 }).where(eq(planets.id, f.planetIds[0]!));
});
afterAll(async () => { await (await testDb()).close(); });

describe('fixed HP radiation on special flight families', () => {
  it('puts a newly captured pirate hull aboard at acquisition, before HOME settlement or owner reads', async () => {
    f = await seedWorld(1, 20_261_008, { pirates: true });
    await f.db.update(seasons).set({ rulesetVersion: 16 }).where(eq(seasons.id, f.seasonId));
    await f.db.update(planets).set({ x: 0, y: 0, z: 0 }).where(eq(planets.id, f.planetIds[0]!));
    await f.db.insert(asteroidSpawnHours).values({ seasonId: f.seasonId, hourStartsAt: now(), spawnFrom: now(),
      activePlayers: 1, lanes: [], pirateLane: { fromMinute: 0, untilMinute: 60, count: 25 } });
    f.clock.set(minute(61));
    const snapshot = await loadPirateSnapshot(f.db, f.seasonId, now());
    const spec = snapshot.pirates.find(row => row.level === 1);
    if (!spec) throw new Error('missing level-one pirate');
    let id = '', capture: string | null = null;
    for (let n = 1; n <= 100 && capture === null; n++) {
      id = `00000000-0000-4000-8000-${n.toString().padStart(12, '0')}`;
      capture = pirateCapture(spec.level, spec.roster, 'DECISIVE', seededFrom('pirate:capture', id));
    }
    if (!capture) throw new Error('fixture did not produce a capture');
    const [raid] = await f.db.insert(pirateRaids).values({ id, seasonId: f.seasonId, planetId: f.planetIds[0]!, ownerPlayerId: f.playerIds[0]!,
      pirateIndex: spec.index, fleet: { CITADEL: 40 }, tech: {}, interceptX: 100, interceptY: 0, interceptZ: 0,
      departAt: now(), arriveAt: minute(1) }).returning();
    if (!raid) throw new Error('missing capturing raid');
    await giveUnits(f.db, raid.planetId, raid.fleet, `pirate:${raid.id}`);
    f.clock.set(new Date(raid.arriveAt.getTime() + 10_000));
    await apply(tx => resolvePirateArrival(tx, raid.id, f.clock));
    const [turned] = await f.db.select().from(pirateRaids).where(eq(pirateRaids.id, raid.id));
    expect(turned?.capturedHull).toBe(capture);
    expect(await f.db.select().from(units).where(and(eq(units.location, `pirate:${raid.id}`), eq(units.hull, turned!.capturedHull!))))
      .toMatchObject([{ count: 1, ownerPlayerId: raid.ownerPlayerId }]);
    const thread = (await pendingThreads(f.db, raid.planetId, now())).find(row => row.id === raid.id);
    expect(thread?.fleet?.[turned!.capturedHull!]).toBe(1);
    expect(thread?.path?.departAt).toEqual(turned?.returnDepartAt);
  });

  it('identifies the physical special wings through Telescope and removes total HP losses from a reused snapshot', async () => {
    const merchantRun = await trade({ DART: 2, CITADEL: 1 });
    const convoyRun = await convoy({ DART: 2, CITADEL: 1 });
    const [raid] = await f.db.insert(pirateRaids).values({ seasonId: f.seasonId, planetId: f.planetIds[0]!, ownerPlayerId: f.playerIds[0]!,
      pirateIndex: 999_999, fleet: { DART: 2, CITADEL: 1 }, tech: {}, interceptX: 100, interceptY: 0, interceptZ: 0,
      departAt: now(), arriveAt: minute(1) }).returning();
    if (!raid) throw new Error('missing raid');
    await giveUnits(f.db, raid.planetId, raid.fleet, `pirate:${raid.id}`);
    await cloud(HULLS.CITADEL.hp * 2);
    const snapshot = await loadTrafficSnapshot(f.db, f.seasonId, now());
    const sensors: SensorPost[] = [{ at: { x: 0, y: 0, z: 0 }, identify: 100_000, detect: 100_000,
      telescope: true, warn: 100_000, planetId: f.planetIds[0]!, revealsSize: true, revealsKind: true }];
    const read = (at: Date) => projectGalaxyTraffic(snapshot, null, at, null, [], sensors, new Set(), null, new Set());
    const partial = read(new Date(merchantRun.departAt.getTime() + 20_000));
    for (const id of [merchantRun.id, convoyRun.id, raid.id]) {
      expect(partial.find(row => row.id === id)).toMatchObject({ kind: 'fleet', fleet: { CITADEL: 1 } });
      for (const field of ['tech', 'damage', 'cargo', 'ownerPlayerId', 'planetId', 'fadeAt']) expect(partial.find(row => row.id === id)).not.toHaveProperty(field);
    }
    expect(read(new Date(merchantRun.departAt.getTime() + 40_000))).toEqual([]);
  });

  it('shows surviving physical trade and convoy hulls, and hides the whole wing before a late worker', async () => {
    const merchantRun = await trade({ DART: 2, CITADEL: 1 });
    const convoyRun = await convoy({ DART: 2, CITADEL: 1 });
    await cloud(HULLS.CITADEL.hp * 2);
    f.clock.set(new Date(merchantRun.departAt.getTime() + 20_000));
    let pending = await pendingThreads(f.db, f.planetIds[0]!, now());
    for (const id of [merchantRun.id, convoyRun.id]) {
      expect(pending.find(row => row.id === id)?.fleet).toEqual({ CITADEL: 1 });
      expect(pending.find(row => row.id === id)?.fadeAt?.getTime()).toBe(merchantRun.departAt.getTime() + 30_000);
    }
    f.clock.set(new Date(merchantRun.departAt.getTime() + 40_000));
    pending = await pendingThreads(f.db, f.planetIds[0]!, now());
    expect(pending.some(row => [merchantRun.id, convoyRun.id].includes(row.id ?? ''))).toBe(false);
    expect((await f.db.select().from(tradeRuns))[0]?.status).toBe('outbound');
  });

  it('never fills an empty physical trade roster from its immutable launch snapshot', async () => {
    const run = await trade();
    await f.db.delete(units).where(eq(units.location, tradeLocation(run.id)));
    expect((await pendingThreads(f.db, f.planetIds[0]!, now())).find(row => row.id === run.id)).toBeUndefined();
  });

  it('finishes a pirate wing before it can fight or turn home with a reward', async () => {
    const [raid] = await f.db.insert(pirateRaids).values({ id: randomUUID(), seasonId: f.seasonId,
      planetId: f.planetIds[0]!, ownerPlayerId: f.playerIds[0]!, pirateIndex: 999_999, fleet: { DART: 2 }, tech: {},
      interceptX: 100, interceptY: 0, interceptZ: 0, departAt: now(), arriveAt: minute(1) }).returning();
    if (!raid) throw new Error('missing pirate raid');
    await giveUnits(f.db, f.planetIds[0]!, { DART: 2 }, `pirate:${raid.id}`);
    await cloud(HULLS.DART.hp);
    f.clock.set(new Date(raid.arriveAt.getTime() + 10_000));
    await apply((tx) => resolvePirateArrival(tx, raid.id, f.clock));
    const [lost] = await f.db.select().from(pirateRaids).where(eq(pirateRaids.id, raid.id));
    expect(lost?.status).toBe('done');
    expect(lost?.homeAt).toBeNull();
    expect(await f.db.select().from(units).where(eq(units.location, `pirate:${raid.id}`))).toEqual([]);
  });

  it('does not resurrect a pirate return wing or its haul when the cloud destroys it', async () => {
    const [raid] = await f.db.insert(pirateRaids).values({ seasonId: f.seasonId, planetId: f.planetIds[0]!, ownerPlayerId: f.playerIds[0]!,
      pirateIndex: 999_999, fleet: { DART: 2 }, tech: {}, status: 'returning', loot: { ...zero, alloy: 500 },
      interceptX: 100, interceptY: 0, interceptZ: 0, departAt: minute(-1), arriveAt: now(), homeAt: minute(1) }).returning();
    if (!raid) throw new Error('missing pirate return');
    await giveUnits(f.db, f.planetIds[0]!, { DART: 2 }, `pirate:${raid.id}`);
    await cloud(HULLS.DART.hp * 2);
    const [before] = await f.db.select().from(planets).where(eq(planets.id, f.planetIds[0]!));
    f.clock.set(raid.homeAt!);
    await apply((tx) => resolvePirateReturn(tx, raid.id, f.clock));
    const [after] = await f.db.select().from(planets).where(eq(planets.id, f.planetIds[0]!));
    expect(after?.alloy).toBe(before?.alloy);
    expect(await f.db.select().from(units).where(eq(units.planetId, f.planetIds[0]!))).toEqual([]);
  });

  it('loses a trade offer with the outbound cargo ships and cannot buy goods with it', async () => {
    const run = await trade();
    await cloud(HULLS.COURIER.hp);
    f.clock.set(dockEndsAt(run.arriveAt));
    await apply((tx) => resolveTradeArrival(tx, run.id, f.clock));
    const [lost] = await f.db.select().from(tradeRuns).where(eq(tradeRuns.id, run.id));
    expect(lost?.status).toBe('done');
    expect(lost?.homeAt).toBeNull();
    expect(await f.db.select().from(units).where(eq(units.location, tradeLocation(run.id)))).toEqual([]);
  });

  it('keeps a trade wound through dock time and a surviving return to the Repair Station', async () => {
    const run = await trade();
    const doseMinutes = (dockEndsAt(run.arriveAt).getTime() - run.departAt.getTime()) / 60_000;
    await cloud(HULLS.COURIER.hp * 0.3000125 / doseMinutes, { activeUntil: dockEndsAt(run.arriveAt) });
    f.clock.set(new Date(dockEndsAt(run.arriveAt).getTime() + 3600_000));
    await apply((tx) => resolveTradeArrival(tx, run.id, f.clock));
    const [returning] = await f.db.select().from(tradeRuns).where(eq(tradeRuns.id, run.id));
    if (!returning?.homeAt) throw new Error('missing trade return');
    f.clock.set(returning.homeAt);
    await apply((tx) => resolveTradeReturn(tx, run.id, f.clock));
    const [lot] = await dockLotsOf(f.db, f.planetIds[0]!);
    expect(lot?.damageBp).toBe(3000);
    expect(lot?.remainderBp).toBeCloseTo(0.125, 7);
    expect(await apply((tx) => resolveTradeReturn(tx, run.id, f.clock))).toBeNull();
  });

  it('does not deliver trade goods when the return wing is lost', async () => {
    const run = await trade();
    f.clock.set(dockEndsAt(run.arriveAt));
    await apply((tx) => resolveTradeArrival(tx, run.id, f.clock));
    const [returning] = await f.db.select().from(tradeRuns).where(eq(tradeRuns.id, run.id));
    if (!returning?.homeAt) throw new Error('missing trade return');
    await cloud(1_000_000);
    const [before] = await f.db.select().from(planets).where(eq(planets.id, f.planetIds[0]!));
    f.clock.set(returning.homeAt);
    await apply((tx) => resolveTradeReturn(tx, run.id, f.clock));
    const [after] = await f.db.select().from(planets).where(eq(planets.id, f.planetIds[0]!));
    expect(after?.crystal).toBe(before?.crystal);
    expect(await f.db.select().from(notifications).where(and(eq(notifications.refId, run.id), eq(notifications.kind, 'fleet_returned')))).toEqual([]);
  });

  it('does not let a convoy wing destroyed before engagement earn or deliver prizes', async () => {
    const run = await convoy();
    await cloud(HULLS.DART.hp * 2);
    f.clock.set(run.engagementEndsAt);
    await apply((tx) => resolveIntergalacticConvoyArrival(tx, run.id, f.clock));
    const [lost] = await f.db.select().from(intergalacticConvoyRuns).where(eq(intergalacticConvoyRuns.id, run.id));
    expect(lost?.status).toBe('done');
    expect(lost?.resourceReward).toEqual(zero);
    expect(lost?.awardedFleet).toEqual({});
    expect(await f.db.select().from(units).where(eq(units.location, intergalacticConvoyLocation(run.id)))).toEqual([]);
  });

  it('cannot rebuild convoy’s launch snapshot or pay its prize after return radiation destroys the real wing', async () => {
    const run = await convoy();
    f.clock.set(run.engagementEndsAt);
    await apply((tx) => resolveIntergalacticConvoyArrival(tx, run.id, f.clock));
    await cloud(1_000_000);
    const [before] = await f.db.select().from(planets).where(eq(planets.id, f.planetIds[0]!));
    f.clock.set(run.homeAt);
    await apply((tx) => resolveIntergalacticConvoyReturn(tx, run.id, f.clock));
    const [after] = await f.db.select().from(planets).where(eq(planets.id, f.planetIds[0]!));
    expect(after?.alloy).toBe(before?.alloy);
    expect(await f.db.select().from(units).where(eq(units.planetId, f.planetIds[0]!))).toEqual([]);
  });

  it('anchors a late pirate turn on the engagement deadline rather than the worker clock', async () => {
    const [raid] = await f.db.insert(pirateRaids).values({ seasonId: f.seasonId, planetId: f.planetIds[0]!, ownerPlayerId: f.playerIds[0]!,
      pirateIndex: 999_999, fleet: { DART: 2 }, tech: {}, interceptX: 100, interceptY: 0, interceptZ: 0,
      departAt: now(), arriveAt: minute(1) }).returning();
    if (!raid) throw new Error('missing pirate');
    await giveUnits(f.db, raid.planetId, raid.fleet, `pirate:${raid.id}`);
    f.clock.set(minute(61));
    await apply((tx) => resolvePirateArrival(tx, raid.id, f.clock));
    const [turned] = await f.db.select().from(pirateRaids).where(eq(pirateRaids.id, raid.id));
    expect(turned?.returnDepartAt?.getTime()).toBe(raid.arriveAt.getTime() + 10_000);
    expect(turned?.homeAt?.getTime()).toBeLessThan(f.clock.now().getTime());
  });

  it('includes a pirate’s ten-second rendezvous in its HP exposure before battle', async () => {
    const [raid] = await f.db.insert(pirateRaids).values({ seasonId: f.seasonId, planetId: f.planetIds[0]!, ownerPlayerId: f.playerIds[0]!,
      pirateIndex: 999_999, fleet: { DART: 2 }, tech: {}, interceptX: 100, interceptY: 0, interceptZ: 0,
      departAt: now(), arriveAt: minute(1) }).returning();
    if (!raid) throw new Error('missing pirate');
    await giveUnits(f.db, raid.planetId, raid.fleet, `pirate:${raid.id}`);
    await cloud(HULLS.DART.hp * 0.95);
    f.clock.set(new Date(raid.arriveAt.getTime() + 10_000));
    await apply((tx) => resolvePirateArrival(tx, raid.id, f.clock));
    const [lost] = await f.db.select().from(pirateRaids).where(eq(pirateRaids.id, raid.id));
    expect(lost?.status).toBe('done');
    expect(lost?.homeAt).toBeNull();
  });

  it('settles the flown prefix before a competing pirate strike turns a later wing early', async () => {
    f = await seedWorld(2, 20_261_008);
    await f.db.update(seasons).set({ rulesetVersion: 16 }).where(eq(seasons.id, f.seasonId));
    for (const id of f.planetIds) await f.db.update(planets).set({ x: 0, y: 0, z: 0 }).where(eq(planets.id, id));
    const start = now();
    await f.db.insert(asteroidSpawnHours).values({ seasonId: f.seasonId, hourStartsAt: start, spawnFrom: start,
      activePlayers: 1, lanes: [], pirateLane: { fromMinute: 0, untilMinute: 60, count: 1 } });
    const snapshot = await loadPirateSnapshot(f.db, f.seasonId, minute(61));
    const spec = snapshot.pirates[0];
    if (!spec) throw new Error('missing pirate');
    const [winner, later] = await f.db.insert(pirateRaids).values([
      { seasonId: f.seasonId, planetId: f.planetIds[0]!, ownerPlayerId: f.playerIds[0]!, pirateIndex: spec.index,
        fleet: { CITADEL: 200 }, tech: {}, interceptX: 100, interceptY: 0, interceptZ: 0, departAt: start,
        arriveAt: new Date(start.getTime() + 5000) },
      { seasonId: f.seasonId, planetId: f.planetIds[1]!, ownerPlayerId: f.playerIds[1]!, pirateIndex: spec.index,
        fleet: { DART: 2 }, tech: {}, interceptX: 1000, interceptY: 0, interceptZ: 0, departAt: start, arriveAt: minute(1) },
    ]).returning();
    if (!winner || !later) throw new Error('missing raid race');
    await giveUnits(f.db, winner.planetId, winner.fleet, `pirate:${winner.id}`);
    await giveUnits(f.db, later.planetId, later.fleet, `pirate:${later.id}`);
    await cloud(100);
    f.clock.set(new Date(start.getTime() + 15_000));
    await apply((tx) => resolvePirateArrival(tx, winner.id, f.clock));
    const [turned] = await f.db.select().from(pirateRaids).where(eq(pirateRaids.id, later.id));
    expect(turned?.status).toBe('returning');
    expect(turned?.radiationSettledAt).toEqual(f.clock.now());
    expect(turned?.returnDepartAt).toEqual(f.clock.now());
    expect(turned?.damage?.[0]?.damageBp).toBe(Math.floor(25 / HULLS.DART.hp * 10_000));
  });

  it('returns a surviving captured hull after radiation kills its hunter and reports that hull once', async () => {
    const [raid] = await f.db.insert(pirateRaids).values({ seasonId: f.seasonId, planetId: f.planetIds[0]!, ownerPlayerId: f.playerIds[0]!,
      pirateIndex: 999_999, fleet: { DART: 1 }, tech: {}, status: 'returning', capturedHull: 'ATLAS',
      interceptX: 100, interceptY: 0, interceptZ: 0, departAt: minute(-1), arriveAt: now(), returnDepartAt: now(), homeAt: minute(1) }).returning();
    if (!raid) throw new Error('missing tow');
    await giveUnits(f.db, raid.planetId, { ...raid.fleet, ATLAS: 1 }, `pirate:${raid.id}`);
    await cloud(HULLS.DART.hp);
    f.clock.set(raid.homeAt!);
    const result = await apply((tx) => resolvePirateReturn(tx, raid.id, f.clock));
    expect(result?.capturedHull).toBe('ATLAS');
    expect(await f.db.select().from(units).where(and(eq(units.planetId, raid.planetId), eq(units.location, 'home'))))
      .toMatchObject([{ hull: 'ATLAS', count: 1 }]);
    expect(await apply((tx) => resolvePirateReturn(tx, raid.id, f.clock))).toBeNull();
  });

  it('pays only the trade offer that surviving cargo ships delivered at the frozen rate', async () => {
    const run = await trade();
    await f.db.update(tradeRuns).set({ give: { ...zero, alloy: 1800 }, want: { ...zero, crystal: 900 },
      damage: [{ hull: 'COURIER', count: 1, damageBp: 9500, remainderBp: 0 }] }).where(eq(tradeRuns.id, run.id));
    await cloud(6);
    f.clock.set(dockEndsAt(run.arriveAt));
    await apply((tx) => resolveTradeArrival(tx, run.id, f.clock));
    const [dealt] = await f.db.select().from(tradeRuns).where(eq(tradeRuns.id, run.id));
    expect(dealt?.give).toEqual({ ...zero, alloy: 1000 });
    expect(dealt?.want).toEqual({ ...zero, crystal: 500 });
  });

  it('does not credit cargo on a failed trade arrival after its real wing died', async () => {
    const run = await trade();
    await cloud(HULLS.COURIER.hp);
    const [before] = await f.db.select().from(planets).where(eq(planets.id, run.planetId));
    f.clock.set(dockEndsAt(run.arriveAt));
    await abandonTradeRun(f.db, run.id, 'outbound', f.clock);
    const [after] = await f.db.select().from(planets).where(eq(planets.id, run.planetId));
    expect(after?.alloy).toBe(before?.alloy);
    expect(await f.db.select().from(units).where(eq(units.planetId, run.planetId))).toEqual([]);
  });

  it('cannot resurrect an abandoned convoy from its launch snapshot', async () => {
    const run = await convoy();
    await cloud(HULLS.DART.hp * 2);
    f.clock.set(run.engagementEndsAt);
    await abandonIntergalacticConvoyRun(f.db, run.id, 'outbound', f.clock);
    expect(await f.db.select().from(units).where(eq(units.planetId, run.planetId))).toEqual([]);
  });

  it('charges only the flown prefix on an early trade recovery and preserves its wound', async () => {
    const run = await trade();
    await cloud(HULLS.COURIER.hp * 0.6);
    f.clock.set(new Date(run.departAt.getTime() + 30_000));
    await abandonTradeRun(f.db, run.id, 'outbound', f.clock);
    const [lot] = await dockLotsOf(f.db, run.planetId);
    expect(lot?.damageBp).toBe(3000);
    expect(lot?.count).toBe(2);
  });

  it('settles only the return exposure on a freshly acquired convoy hull', async () => {
    const run = await convoy();
    await f.db.update(intergalacticConvoyRuns).set({ status: 'returning', resourceReward: zero, awardedFleet: { DART: 1 },
      damage: [{ hull: 'DART', count: 2, damageBp: 9500, remainderBp: 0 }], radiationSettledAt: run.engagementEndsAt })
      .where(eq(intergalacticConvoyRuns.id, run.id));
    await giveUnits(f.db, run.planetId, { DART: 3 }, intergalacticConvoyLocation(run.id));
    await cloud(HULLS.DART.hp * 0.1 * 60_000 / (run.homeAt.getTime() - run.engagementEndsAt.getTime()));
    f.clock.set(run.homeAt);
    const delivery = await apply((tx) => resolveIntergalacticConvoyReturn(tx, run.id, f.clock));
    expect(delivery?.awardedFleet).toEqual({ DART: 1 });
    expect(await f.db.select().from(units).where(and(eq(units.planetId, run.planetId), eq(units.location, 'home'))))
      .toMatchObject([{ hull: 'DART', count: 1 }]);
  });

  it('keeps an older season’s special flight unchanged even if HP sources exist', async () => {
    await f.db.update(seasons).set({ rulesetVersion: 15 }).where(eq(seasons.id, f.seasonId));
    const run = await trade();
    await cloud(1_000_000);
    f.clock.set(dockEndsAt(run.arriveAt));
    await apply((tx) => resolveTradeArrival(tx, run.id, f.clock));
    const [returning] = await f.db.select().from(tradeRuns).where(eq(tradeRuns.id, run.id));
    expect(returning?.status).toBe('returning');
    expect(returning?.damage).toBeNull();
    expect(returning?.radiationSettledAt).toBeNull();
    expect(returning?.want).toEqual(run.want);
  });
});
