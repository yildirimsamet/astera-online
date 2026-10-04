import { randomUUID } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { HULLS, MONUMENT_CAPACITY, MULTI_WORLD, type MonumentShipLot } from '@astera/rules';
import { hpRadiationSources, monuments, monumentShipLots, monumentWaves, planets, scheduledEvents, seasons, shipDamageLots, units } from '../src/db/schema.js';
import { lockMonument, settleMonument } from '../src/services/monument.js';
import { recallMonument, resolveMonumentReturn, settleMonumentFlight } from '../src/services/monumentMovement.js';
import { baysInUse } from '../src/services/flight.js';
import { loadLocked, totalUnitsOf } from '../src/services/planet.js';
import { grant, seedWorld, testDb, type Fixture } from './helpers.js';

let f: Fixture;
let m: typeof monuments.$inferSelect;
let wave: typeof monumentWaves.$inferSelect;
let lots: (typeof monumentShipLots.$inferSelect)[];
let startedMs: number;
const at = (minutes: number) => new Date(startedMs + minutes * 60_000);
const recall = (selections = lots.map((lot) => ({ lotId: lot.id, count: lot.count })), playerId = f.playerIds[0]!) => f.db.transaction((tx) => recallMonument(tx, {
  playerId, waveId: wave.id, selections, clock: f.clock,
}));
const flight = (minutes: number) => {
  f.clock.set(at(minutes));
  return f.db.transaction(async (tx) => settleMonumentFlight(tx, await lockMonument(tx, m.id), wave.id, f.clock.now()));
};
async function cloud(intensity: number, over: Partial<typeof hpRadiationSources.$inferInsert> = {}) {
  await f.db.insert(hpRadiationSources).values({ seasonId: f.seasonId, anchorKind: 'MONUMENT', anchorId: m.id,
    x: m.x, y: m.y, z: m.z, radius: 20_000, mode: 'EMIT', intensityHpPerMinute: intensity, activeFrom: at(0), ...over });
}
async function setOutbound() {
  const [origin] = await f.db.select().from(planets).where(eq(planets.id, wave.originPlanetId));
  const route = [{ from: { x: origin!.x, y: origin!.y, z: origin!.z }, to: { x: m.x, y: m.y, z: m.z }, startMs: startedMs, endMs: at(10).getTime() }];
  await f.db.update(monumentWaves).set({ status: 'OUTBOUND', heldAt: null, arriveAt: at(10), reservedBulk: 9, route }).where(eq(monumentWaves.id, wave.id));
  await f.db.update(monumentShipLots).set({ damageBp: 0, remainderBp: 0, deuterium: 0 }).where(eq(monumentShipLots.waveId, wave.id));
  await f.db.update(monuments).set({ controllerPlayerId: null, garrison: { CITADEL: 1 } }).where(eq(monuments.id, m.id));
  wave = (await f.db.select().from(monumentWaves).where(eq(monumentWaves.id, wave.id)))[0]!;
  lots = await f.db.select().from(monumentShipLots).where(eq(monumentShipLots.waveId, wave.id));
}
beforeEach(async () => {
  f = await seedWorld(2, 20_261_003);
  await f.db.update(seasons).set({ rulesetVersion: MULTI_WORLD.shipDamageRulesetVersion }).where(eq(seasons.id, f.seasonId));
  await grant(f.db, f.planetIds[0]!, 100_000, 100_000);
  startedMs = f.clock.now().getTime();
  m = (await f.db.insert(monuments).values({ seasonId: f.seasonId, ordinal: 1, x: 6000, y: 0, z: 0,
    capacity: MONUMENT_CAPACITY, productionPerMinute: 60, controllerPlayerId: f.playerIds[0]!, settledAt: at(0) }).returning())[0]!;
  const id = randomUUID();
  wave = (await f.db.insert(monumentWaves).values({ id, seasonId: f.seasonId, monumentId: m.id,
    playerId: f.playerIds[0]!, originPlanetId: f.planetIds[0]!, unitLocation: `monument:${id}`,
    purpose: 'REINFORCE', sentFleet: { DART: 1, COURIER: 2 }, tech: { SHIP_ARMOR: 5 }, route: [], fuelPaid: 20,
    status: 'HOLD', sentAt: at(0), heldAt: at(0), radiationSettledAt: at(0) }).returning())[0]!;
  lots = await f.db.insert(monumentShipLots).values([
    { waveId: id, hull: 'DART', count: 1, damageBp: 1000, remainderBp: 0.25, deuterium: 0 },
    { waveId: id, hull: 'COURIER', count: 2, damageBp: 2000, remainderBp: 0.375, deuterium: 200.125 },
  ]).returning();
  await f.db.insert(units).values([
    { planetId: wave.originPlanetId, ownerPlayerId: wave.playerId, location: wave.unitLocation, hull: 'DART', count: 1 },
    { planetId: wave.originPlanetId, ownerPlayerId: wave.playerId, location: wave.unitLocation, hull: 'COURIER', count: 2 },
  ]);
});
afterAll(async () => { await (await testDb()).close(); });

describe('physical monument recalls and returns', () => {
  it('settles production first and splits exactly the selected ships, cargo, damage and root bay', async () => {
    f.clock.set(at(1));
    const cargo = lots.find((lot) => lot.hull === 'COURIER')!;
    const before = await totalUnitsOf(f.db, wave.originPlanetId);
    const result = await recall([{ lotId: cargo.id, count: 1 }]);
    expect(result.wave).toMatchObject({ rootWaveId: wave.id, status: 'RETURNING', returnReason: 'RECALLED', fuelPaid: 0 });
    const returning = await f.db.select().from(monumentShipLots).where(eq(monumentShipLots.waveId, result.wave.id));
    expect(returning).toMatchObject([{ hull: 'COURIER', count: 1, damageBp: 2000, remainderBp: 0.375, deuterium: 130.0625 }]);
    const remaining = await f.db.select().from(monumentShipLots).where(eq(monumentShipLots.waveId, wave.id));
    expect(remaining.find((lot) => lot.hull === 'COURIER')?.deuterium).toBeCloseTo(130.0625);
    expect(await totalUnitsOf(f.db, wave.originPlanetId)).toEqual(before);
    expect(await baysInUse(f.db, wave.originPlanetId)).toBe(1);
    expect((await f.db.select().from(monuments))[0]?.controllerPlayerId).toBe(wave.playerId);
  });

  it('keeps cargo-only control after the last combat ship is recalled and produces nothing for it', async () => {
    const dart = lots.find((lot) => lot.hull === 'DART')!;
    await recall([{ lotId: dart.id, count: 1 }]);
    const [held] = await f.db.select().from(monumentWaves).where(eq(monumentWaves.id, wave.id));
    expect(held?.status).toBe('HOLD');
    expect((await f.db.select().from(monuments))[0]?.controllerPlayerId).toBe(wave.playerId);
    f.clock.set(at(2));
    await f.db.transaction((tx) => settleMonument(tx, { monumentId: m.id, clock: f.clock }));
    const [cargo] = await f.db.select().from(monumentShipLots).where(eq(monumentShipLots.waveId, wave.id));
    expect(cargo?.deuterium).toBe(200.125);
  });

  it('reuses the original wave on full recall, clears control now and schedules the actual return', async () => {
    f.clock.set(at(1));
    const result = await recall();
    expect(result.wave).toMatchObject({ id: wave.id, rootWaveId: null, status: 'RETURNING', generation: 1, fuelPaid: 20 });
    expect((await f.db.select().from(monuments))[0]).toMatchObject({ controllerPlayerId: null, emptySince: at(1), generation: 1 });
    const [event] = await f.db.select().from(scheduledEvents).where(eq(scheduledEvents.refId, wave.id));
    expect(event).toMatchObject({ kind: 'monument_arrival', resolveAt: result.wave.arriveAt, payload: { generation: 1 } });
    expect(await baysInUse(f.db, wave.originPlanetId)).toBe(1);
  });

  it('refuses selecting another owner, another wave, repeated lots or unavailable counts', async () => {
    await expect(recall(undefined, f.playerIds[1])).rejects.toMatchObject({ code: 'MONUMENT_WAVE_NOT_OWNED' });
    for (const selections of [[], [{ lotId: randomUUID(), count: 1 }], [{ lotId: lots[0]!.id, count: 2 }], [{ lotId: lots[0]!.id, count: 1 }, { lotId: lots[0]!.id, count: 1 }]]) {
      await expect(recall(selections)).rejects.toMatchObject({ code: 'BAD_MONUMENT_RECALL' });
    }
    expect((await f.db.select().from(monumentWaves))[0]?.status).toBe('HOLD');
  });

  it('cannot duplicate a recalled ship when two partial recalls race for its last count', async () => {
    const dart = lots.find((lot) => lot.hull === 'DART')!;
    const before = await totalUnitsOf(f.db, wave.originPlanetId);
    const results = await Promise.allSettled([recall([{ lotId: dart.id, count: 1 }]), recall([{ lotId: dart.id, count: 1 }])]);
    expect(results.filter((row) => row.status === 'fulfilled')).toHaveLength(1);
    expect(await totalUnitsOf(f.db, wave.originPlanetId)).toEqual(before);
    expect(await f.db.select().from(monumentWaves).where(eq(monumentWaves.status, 'RETURNING'))).toHaveLength(1);
  });

  it('turns an outbound wave from its true halfway position with carried HP damage intact', async () => {
    await setOutbound();
    await cloud(1);
    f.clock.set(at(5));
    const result = await recall();
    const original = wave.route[0]!;
    expect(result.wave.route[0]?.from).toEqual({ x: (original.from.x + original.to.x) / 2, y: (original.from.y + original.to.y) / 2, z: (original.from.z + original.to.z) / 2 });
    const [dart] = await f.db.select().from(monumentShipLots).where(and(eq(monumentShipLots.waveId, wave.id), eq(monumentShipLots.hull, 'DART')));
    expect(dart!.damageBp + dart!.remainderBp).toBeCloseTo(5 / (HULLS.DART.hp * 1.25) * 10_000, 8);
    expect(result.wave.reservedBulk).toBe(0);
  });

  it('settles a flown prefix only once, with old and new historical source rates', async () => {
    await setOutbound();
    await cloud(1, { activeUntil: at(1) });
    await cloud(3, { activeFrom: at(1) });
    await flight(2);
    await flight(2);
    const [dart] = await f.db.select().from(monumentShipLots).where(and(eq(monumentShipLots.waveId, wave.id), eq(monumentShipLots.hull, 'DART')));
    expect(dart!.damageBp + dart!.remainderBp).toBeCloseTo(4 / (HULLS.DART.hp * 1.25) * 10_000, 8);
  });

  it('loses a dead cargo ship’s own load during a return and terminates a wholly lost wave at its real last death', async () => {
    const result = await recall();
    await cloud(200);
    f.clock.set(at(1));
    const loss = await f.db.transaction(async (tx) => settleMonumentFlight(tx, await lockMonument(tx, m.id), result.wave.id, f.clock.now()));
    expect(loss.lostDeuterium).toBeCloseTo(200.125);
    const [stored] = await f.db.select().from(monumentWaves).where(eq(monumentWaves.id, wave.id));
    expect(stored?.status).toBe('LOST');
    expect(stored!.resolvedAt!.getTime()).toBeLessThan(at(1).getTime());
    expect(await baysInUse(f.db, wave.originPlanetId)).toBe(0);
  });

  it('lands cargo and exact wounds once; stale and replayed return events create nothing', async () => {
    const result = await recall();
    const eta = result.wave.arriveAt!;
    const before = await totalUnitsOf(f.db, wave.originPlanetId);
    await f.db.transaction((tx) => loadLocked(tx, wave.originPlanetId, { now: () => eta }));
    const [planetBefore] = await f.db.select().from(planets).where(eq(planets.id, wave.originPlanetId));
    expect(await f.db.transaction((tx) => resolveMonumentReturn(tx, { waveId: wave.id, generation: 0, at: eta }))).toBeNull();
    const landed = await f.db.transaction((tx) => resolveMonumentReturn(tx, { waveId: wave.id, generation: result.wave.generation, at: eta }));
    expect(landed?.deliveredDeuterium).toBeCloseTo(200.125);
    expect(await totalUnitsOf(f.db, wave.originPlanetId)).toEqual(before);
    expect(await f.db.select().from(shipDamageLots)).toMatchObject([{ hull: 'COURIER', damageBp: 2000, remainderBp: 0.375 }]);
    const [home] = await f.db.select().from(units).where(and(eq(units.planetId, wave.originPlanetId), eq(units.location, 'home'), eq(units.hull, 'DART')));
    expect(home?.count).toBeGreaterThanOrEqual(1);
    const [planetAfter] = await f.db.select().from(planets).where(eq(planets.id, wave.originPlanetId));
    expect(planetAfter!.deuterium - planetBefore!.deuterium).toBeCloseTo(200.125, 8);
    expect(await f.db.transaction((tx) => resolveMonumentReturn(tx, { waveId: wave.id, generation: result.wave.generation, at: eta }))).toBeNull();
    expect((await f.db.select().from(planets).where(eq(planets.id, wave.originPlanetId)))[0]?.deuterium).toBe(planetAfter!.deuterium);
    expect(await baysInUse(f.db, wave.originPlanetId)).toBe(0);
  });

  it('claims a returning wave once when two arrival handlers race, and the loser is a no-op', async () => {
    const result = await recall();
    const eta = result.wave.arriveAt!;
    await f.db.transaction((tx) => loadLocked(tx, wave.originPlanetId, { now: () => eta }));
    const [before] = await f.db.select().from(planets).where(eq(planets.id, wave.originPlanetId));
    const deliver = () => f.db.transaction((tx) => resolveMonumentReturn(tx, {
      waveId: wave.id, generation: result.wave.generation, at: eta,
    }));
    const outcomes = await Promise.allSettled([deliver(), deliver()]);
    expect(outcomes.filter((row) => row.status === 'rejected')).toEqual([]);
    const values = outcomes.flatMap((row) => row.status === 'fulfilled' ? [row.value] : []);
    expect(values.filter((row) => row !== null)).toHaveLength(1);
    expect(values.filter((row) => row === null)).toHaveLength(1);
    const [after] = await f.db.select().from(planets).where(eq(planets.id, wave.originPlanetId));
    expect(after!.deuterium - before!.deuterium).toBeCloseTo(200.125, 8);
    expect(await f.db.select().from(shipDamageLots)).toHaveLength(1);
  });

  it('refuses return delivery before its ETA and rolls a partial transfer back atomically', async () => {
    const before = await totalUnitsOf(f.db, wave.originPlanetId);
    await expect(f.db.transaction(async (tx) => {
      await recallMonument(tx, { playerId: wave.playerId, waveId: wave.id, selections: [{ lotId: lots[1]!.id, count: 1 }], clock: f.clock });
      throw new Error('caller rollback');
    })).rejects.toThrow('caller rollback');
    expect(await totalUnitsOf(f.db, wave.originPlanetId)).toEqual(before);
    expect(await f.db.select().from(monumentWaves)).toHaveLength(1);
    const result = await recall();
    expect(await f.db.transaction((tx) => resolveMonumentReturn(tx, { waveId: wave.id, generation: result.wave.generation, at: at(0) }))).toBeNull();
  });

  it('preserves research/cargo provenance on every recalled lot', async () => {
    const result = await recall([{ lotId: lots[1]!.id, count: 1 }]);
    const stored = (await f.db.select().from(monumentWaves).where(eq(monumentWaves.id, result.wave.id)))[0]!;
    expect(stored.tech).toEqual(wave.tech);
    const own: MonumentShipLot[] = result.lots;
    expect(own.every((lot) => lot.playerId === wave.playerId && lot.waveId === stored.id && lot.tech.SHIP_ARMOR === 5)).toBe(true);
  });

  it('refuses a recall before the already-paid cursor rather than turning the wing from a past position', async () => {
    f.clock.set(at(2));
    await f.db.transaction((tx) => settleMonument(tx, { monumentId: m.id, clock: f.clock }));
    const before = await f.db.select().from(monumentShipLots);
    f.clock.set(at(1));
    await expect(recall()).rejects.toMatchObject({ code: 'MONUMENT_TIMELINE_INVALID' });
    expect(await f.db.select().from(monumentShipLots)).toEqual(before);
    expect((await f.db.select().from(monumentWaves))[0]?.status).toBe('HOLD');
  });

  it('rejects a malformed physical route with a domain error before charging HP', async () => {
    await setOutbound();
    await f.db.update(monumentWaves).set({ route: [{ from: { x: 0, y: 0, z: 0 }, to: { x: m.x, y: m.y, z: m.z },
      startMs: at(2).getTime(), endMs: at(1).getTime() }] }).where(eq(monumentWaves.id, wave.id));
    await expect(flight(2)).rejects.toMatchObject({ code: 'MONUMENT_ROUTE_INVALID' });
    expect((await f.db.select().from(monumentWaves))[0]?.radiationSettledAt).toEqual(at(0));
  });
});
