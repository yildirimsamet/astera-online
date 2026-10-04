import { randomUUID } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { HULLS, MONUMENT_CAPACITY, combatValue, type MobileHullId, type TechLevels } from '@astera/rules';
import { hpRadiationSources, monuments, monumentShipLots, monumentWaves, players, seasons, units } from '../src/db/schema.js';
import { settleMonument } from '../src/services/monument.js';
import { recomputePlayerWealth, setUnits } from '../src/services/planet.js';
import { seedWorld, testDb, type Fixture } from './helpers.js';

let f: Fixture;
let target: typeof monuments.$inferSelect;
const start = () => f.clock.now().getTime();
const afterMinutes = (n: number) => new Date(start() + n * 60_000);
interface LotInput { hull: MobileHullId; count: number; damageBp?: number; remainderBp?: number; deuterium?: number }
async function hold(owner = 0, lots: LotInput[] = [{ hull: 'DART', count: 1 }, { hull: 'COURIER', count: 1 }], tech: TechLevels = {}, status: 'HOLD' | 'OUTBOUND' | 'RETURNING' = 'HOLD') {
  const id = randomUUID();
  const fleet = Object.fromEntries(lots.map((lot) => [lot.hull, lots.filter((row) => row.hull === lot.hull).reduce((n, row) => n + row.count, 0)]));
  const [wave] = await f.db.insert(monumentWaves).values({
    id, seasonId: f.seasonId, monumentId: target.id, playerId: f.playerIds[owner]!, originPlanetId: f.planetIds[owner]!,
    unitLocation: `monument:${id}`, purpose: 'ATTACK', sentFleet: fleet, tech, route: [], fuelPaid: 0, status,
    sentAt: f.clock.now(), heldAt: status === 'HOLD' ? f.clock.now() : null,
    arriveAt: status === 'HOLD' ? null : afterMinutes(10), returnReason: status === 'RETURNING' ? 'RECALLED' : null,
    radiationSettledAt: f.clock.now(),
  }).returning();
  const stored = await f.db.insert(monumentShipLots).values(lots.map((lot) => ({
    waveId: id, hull: lot.hull, count: lot.count, damageBp: lot.damageBp ?? 0,
    remainderBp: lot.remainderBp ?? 0, deuterium: lot.deuterium ?? 0,
  }))).returning();
  await f.db.transaction(async (tx) => { await setUnits(tx, f.planetIds[owner]!, fleet, `monument:${id}`, f.playerIds[owner]); });
  return { wave: wave!, lots: stored };
}
async function cloud(intensity: number, over: Partial<typeof hpRadiationSources.$inferInsert> = {}) {
  await f.db.insert(hpRadiationSources).values({
    seasonId: f.seasonId, anchorKind: 'MONUMENT', anchorId: target.id, x: target.x, y: target.y, z: target.z,
    mode: 'EMIT', radius: 100, intensityHpPerMinute: intensity, activeFrom: f.clock.now(), ...over,
  });
}
async function settle(at: Date, requireLive = true) {
  f.clock.set(at);
  return f.db.transaction((tx) => settleMonument(tx, { monumentId: target.id, clock: f.clock, requireLive }));
}
async function cargo(waveId: string) {
  return (await f.db.select().from(monumentShipLots).where(eq(monumentShipLots.waveId, waveId))).reduce((n, lot) => n + lot.deuterium, 0);
}
beforeEach(async () => {
  f = await seedWorld(2, 20_261_003);
  [target] = await f.db.insert(monuments).values({
    seasonId: f.seasonId, ordinal: 1, x: 6000, y: 0, z: 0, capacity: MONUMENT_CAPACITY,
    productionPerMinute: 60, controllerPlayerId: f.playerIds[0]!, settledAt: f.clock.now(),
  }).returning().then((rows) => [rows[0]!]);
});
afterAll(async () => { const { close } = await testDb(); await close(); });

describe('transactional monument HOLD settlement', () => {
  it('counts physically carried production in Wealth and removes lost ships and their cargo exactly once', async () => {
    await hold(0, [{ hull: 'DART', count: 1 }, { hull: 'COURIER', count: 1, deuterium: 10.125 }]);
    const initial = await f.db.transaction((tx) => recomputePlayerWealth(tx, f.playerIds[0]!));
    // Existing cargo is already owned even before production is settled.
    await settle(afterMinutes(1));
    expect((await f.db.select().from(players).where(eq(players.id, f.playerIds[0]!)))[0]?.wealth).toBe(initial + 60);
    const charged = await f.db.transaction((tx) => recomputePlayerWealth(tx, f.playerIds[0]!));
    expect(charged).toBe(initial + 60);
    const cargoHp = HULLS.COURIER.hp;
    await cloud(cargoHp);
    await settle(afterMinutes(1));
    const cost = HULLS.DART.alloy + HULLS.DART.crystal + HULLS.DART.deuterium + HULLS.COURIER.alloy + HULLS.COURIER.crystal + HULLS.COURIER.deuterium;
    expect((await f.db.select().from(players).where(eq(players.id, f.playerIds[0]!)))[0]?.wealth).toBe(initial - cost - 10);
    await settle(f.clock.now());
    expect((await f.db.select().from(players).where(eq(players.id, f.playerIds[0]!)))[0]?.wealth).toBe(initial - cost - 10);
  });
  it('combines an owner’s waves, writes real cargo and is idempotent at the same or an earlier instant', async () => {
    const a = await hold(0);
    const a2 = await hold(0, [{ hull: 'DART', count: 2 }]);
    const b = await hold(1);
    const at = afterMinutes(1);
    const result = await settle(at);
    expect(result.producedDeuterium).toBe(60);
    expect(await cargo(a.wave.id)).toBeCloseTo(45);
    expect(await cargo(b.wave.id)).toBeCloseTo(15);
    expect(await cargo(a2.wave.id)).toBe(0);
    expect((await settle(at)).producedDeuterium).toBe(0);
    expect((await settle(new Date(at.getTime() - 1))).producedDeuterium).toBe(0);
    expect(await cargo(a.wave.id)).toBeCloseTo(45);
    expect((await f.db.select().from(monuments))[0]?.settledAt).toEqual(at);
  });

  it('serializes real concurrent transactions without double production or lost sub-bp damage', async () => {
    const a = await hold();
    await cloud(0.001);
    f.clock.set(afterMinutes(1));
    const outcomes = await Promise.all(Array.from({ length: 5 }, () => f.db.transaction((tx) => settleMonument(tx, { monumentId: target.id, clock: f.clock }))));
    expect(outcomes.reduce((n, row) => n + row.producedDeuterium, 0)).toBe(60);
    expect(await cargo(a.wave.id)).toBeCloseTo(60);
    const [lot] = await f.db.select().from(monumentShipLots).where(and(eq(monumentShipLots.waveId, a.wave.id), eq(monumentShipLots.hull, 'DART')));
    expect(lot!.damageBp + lot!.remainderBp).toBeCloseTo(0.001 / HULLS.DART.hp * 10_000, 8);
  });

  it('persists carried fractional health and technology without healing or rounding cargo', async () => {
    const a = await hold(0, [{ hull: 'DART', count: 1, damageBp: 2000, remainderBp: 0.375 }, { hull: 'COURIER', count: 1, deuterium: 0.125 }], { SHIP_ARMOR: 5, CARGO_HOLDS: 2 });
    await cloud(1);
    await settle(afterMinutes(0.5));
    const stored = await f.db.select().from(monumentShipLots).where(eq(monumentShipLots.waveId, a.wave.id));
    const dart = stored.find((row) => row.hull === 'DART')!;
    expect(dart.damageBp + dart.remainderBp).toBeCloseTo(2000.375 + 0.5 / (HULLS.DART.hp * 1.25) * 10_000, 8);
    expect(await cargo(a.wave.id)).toBeCloseTo(30.125);
  });

  it('reweights at a combat ship’s actual death, leaving cargo-only control alive with zero income', async () => {
    const a = await hold(0, [{ hull: 'DART', count: 1 }, { hull: 'ARGOSY', count: 1 }]);
    const b = await hold(1, [{ hull: 'CITADEL', count: 1 }, { hull: 'ARGOSY', count: 1 }]);
    await cloud(HULLS.DART.hp);
    await settle(afterMinutes(2));
    const dart = await f.db.select().from(units).where(and(eq(units.location, a.wave.unitLocation), eq(units.hull, 'DART')));
    expect(dart).toHaveLength(0);
    const aLots = await f.db.select().from(monumentShipLots).where(eq(monumentShipLots.waveId, a.wave.id));
    expect(aLots.map((row) => row.hull)).toEqual(['ARGOSY']);
    const expectedFirst = 60 * combatValue({ DART: 1 }) / (combatValue({ DART: 1 }) + combatValue({ CITADEL: 1 }));
    expect(await cargo(a.wave.id)).toBeCloseTo(expectedFirst);
    expect(await cargo(a.wave.id) + await cargo(b.wave.id)).toBeCloseTo(120);
    expect((await f.db.select().from(monuments))[0]?.controllerPlayerId).toBe(f.playerIds[0]);
  });

  it('destroys a dead cargo ship’s own load and marks a fully annihilated wave LOST', async () => {
    const a = await hold(0, [{ hull: 'COURIER', count: 2, deuterium: 20.125 }]);
    await cloud(HULLS.COURIER.hp);
    const death = afterMinutes(1);
    const result = await settle(afterMinutes(3));
    expect(result.lostDeuterium).toBeCloseTo(20.125);
    expect(await cargo(a.wave.id)).toBe(0);
    expect(result.destroyed.reduce((n, lot) => n + lot.count, 0)).toBe(2);
    const [wave] = await f.db.select().from(monumentWaves).where(eq(monumentWaves.id, a.wave.id));
    expect(wave).toMatchObject({ status: 'LOST', reservedBulk: 0, generation: 1, resolvedAt: death });
    const [m] = await f.db.select().from(monuments);
    expect(m).toMatchObject({ controllerPlayerId: null, emptySince: death, generation: 1 });
    await settle(f.clock.now());
    expect((await f.db.select().from(monuments))[0]?.generation).toBe(1);
  });

  it('uses historical source windows, not the current intensity for past time', async () => {
    const a = await hold();
    const firstEnd = afterMinutes(0.5);
    await cloud(1, { activeUntil: firstEnd });
    await cloud(3, { activeFrom: firstEnd });
    await settle(afterMinutes(1));
    const [lot] = await f.db.select().from(monumentShipLots).where(and(eq(monumentShipLots.waveId, a.wave.id), eq(monumentShipLots.hull, 'DART')));
    expect(lot!.damageBp + lot!.remainderBp).toBeCloseTo(2 / HULLS.DART.hp * 10_000, 8);
  });

  it('does not produce in OUTBOUND or RETURNING waves or touch their manifest', async () => {
    const outbound = await hold(0, [{ hull: 'DART', count: 1 }], {}, 'OUTBOUND');
    const returning = await hold(1, [{ hull: 'COURIER', count: 1, damageBp: 2345, remainderBp: 0.5, deuterium: 17.25 }], {}, 'RETURNING');
    await cloud(100);
    const result = await settle(afterMinutes(1));
    expect(result.discardedDeuterium).toBe(60);
    expect(await f.db.select().from(monumentShipLots).where(eq(monumentShipLots.waveId, outbound.wave.id))).toEqual(outbound.lots);
    expect(await f.db.select().from(monumentShipLots).where(eq(monumentShipLots.waveId, returning.wave.id))).toEqual(returning.lots);
  });

  it('predicts the next individual ship loss and never schedules beyond the season cutoff', async () => {
    await hold();
    await cloud(HULLS.DART.hp);
    const end = afterMinutes(0.5);
    await f.db.update(seasons).set({ endsAt: end }).where(eq(seasons.id, f.seasonId));
    expect((await settle(afterMinutes(0.25))).nextLossAt).toBeNull();
  });

  it('predicts the first casualty rather than the death of the whole HOLD fleet', async () => {
    await hold();
    await cloud(HULLS.DART.hp);
    const death = afterMinutes(1);
    expect((await settle(afterMinutes(0.25))).nextLossAt).toEqual(death);
  });

  it('never advances production past an unresolved earlier arrival', async () => {
    const a = await hold();
    const inbound = await hold(1, [{ hull: 'DART', count: 1 }], {}, 'OUTBOUND');
    const arriveAt = afterMinutes(1);
    await f.db.update(monumentWaves).set({ arriveAt }).where(eq(monumentWaves.id, inbound.wave.id));
    await expect(settle(afterMinutes(2))).rejects.toMatchObject({ code: 'MONUMENT_ARRIVAL_PENDING' });
    expect(await cargo(a.wave.id)).toBe(0);
    // Settlement at the arrival boundary itself is valid, before the roster changes.
    await settle(arriveAt);
    expect(await cargo(a.wave.id)).toBeCloseTo(60);
  });

  it('clips both production and radiation to season end, including the explicit freeze path', async () => {
    const a = await hold();
    await cloud(1);
    const end = afterMinutes(1);
    await f.db.update(seasons).set({ endsAt: end }).where(eq(seasons.id, f.seasonId));
    await settle(afterMinutes(5));
    expect(await cargo(a.wave.id)).toBeCloseTo(60);
    expect((await f.db.select().from(monuments))[0]?.settledAt).toEqual(end);
    await f.db.update(seasons).set({ status: 'frozen' }).where(eq(seasons.id, f.seasonId));
    await expect(settle(afterMinutes(2))).rejects.toMatchObject({ code: 'SEASON_FROZEN' });
    expect((await settle(afterMinutes(2), false)).producedDeuterium).toBe(0);
  });

  it.each(['count', 'owner', 'origin'] as const)('refuses a manifest–units %s mismatch atomically', async (kind) => {
    const a = await hold();
    await f.db.update(units).set(kind === 'count' ? { count: 5 } : kind === 'owner' ? { ownerPlayerId: f.playerIds[1]! } : { planetId: f.planetIds[1]! }).where(eq(units.location, a.wave.unitLocation));
    await expect(settle(afterMinutes(1))).rejects.toMatchObject({ code: 'MONUMENT_MANIFEST_MISMATCH' });
    expect(await cargo(a.wave.id)).toBe(0);
    expect((await f.db.select().from(monuments))[0]?.settledAt).toEqual(target.settledAt);
  });

  it('rejects cargo overflow and invalid research snapshots before any write', async () => {
    const a = await hold();
    await f.db.update(monumentShipLots).set({ deuterium: HULLS.COURIER.cargo + 1 }).where(and(eq(monumentShipLots.waveId, a.wave.id), eq(monumentShipLots.hull, 'COURIER')));
    await expect(settle(afterMinutes(1))).rejects.toMatchObject({ code: 'MONUMENT_MANIFEST_INVALID' });
    await f.db.update(monumentShipLots).set({ deuterium: 0 }).where(eq(monumentShipLots.waveId, a.wave.id));
    await f.db.update(monumentWaves).set({ tech: { SHIP_ARMOR: -1 } }).where(eq(monumentWaves.id, a.wave.id));
    await expect(settle(f.clock.now())).rejects.toMatchObject({ code: 'MONUMENT_MANIFEST_INVALID' });
    expect(await cargo(a.wave.id)).toBe(0);
  });

  it('refuses HOLD added after an unadvanced cursor and rolls all writes back on caller failure', async () => {
    const a = await hold();
    await f.db.update(monumentWaves).set({ heldAt: afterMinutes(0.5) }).where(eq(monumentWaves.id, a.wave.id));
    await expect(settle(afterMinutes(1))).rejects.toMatchObject({ code: 'MONUMENT_TIMELINE_INVALID' });
    await f.db.update(monumentWaves).set({ heldAt: target.settledAt }).where(eq(monumentWaves.id, a.wave.id));
    await expect(f.db.transaction(async (tx) => {
      await settleMonument(tx, { monumentId: target.id, clock: f.clock });
      throw new Error('caller rollback');
    })).rejects.toThrow('caller rollback');
    expect(await cargo(a.wave.id)).toBe(0);
    expect((await f.db.select().from(monuments))[0]?.settledAt).toEqual(target.settledAt);
  });
});
