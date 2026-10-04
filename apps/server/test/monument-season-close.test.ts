import { randomUUID } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { HULLS, MONUMENT_CAPACITY, MULTI_WORLD, fleetValue, type Fleet } from '@astera/rules';
import { clanMemberships, clans, hpRadiationSources, monumentBattles, monumentBattleParticipants, monuments, monumentShipLots, monumentWaves, planets, scheduledEvents, seasonResults, seasons, shipDamageLots, units } from '../src/db/schema.js';
import { loadLocked, totalUnitsOf } from '../src/services/planet.js';
import { HANDLERS, forceSeasonEnd, onSeasonEnd } from '../src/worker/handlers.js';
import { seedWorld, testDb, type Fixture } from './helpers.js';

let f: Fixture;
let m: typeof monuments.$inferSelect;
let wave: typeof monumentWaves.$inferSelect;
let start: number;
const at = (minutes: number) => new Date(start + minutes * 60_000);
async function addWave(owner: number, status: 'OUTBOUND' | 'HOLD' | 'RETURNING', eta = 20, fleet: Fleet = { DART: 1, COURIER: 1 }) {
  const id = randomUUID();
  const origin = (await f.db.select().from(planets).where(eq(planets.id, f.planetIds[owner]!)))[0]!;
  const [row] = await f.db.insert(monumentWaves).values({ id, seasonId: f.seasonId, monumentId: m.id,
    playerId: f.playerIds[owner]!, originPlanetId: origin.id, unitLocation: `monument:${id}`, purpose: 'ATTACK', sentFleet: fleet,
    tech: {}, status, fuelPaid: 18, route: status === 'HOLD' ? [] : [{
      from: status === 'OUTBOUND' ? { x: origin.x, y: origin.y, z: origin.z } : { x: m.x, y: m.y, z: m.z },
      to: status === 'OUTBOUND' ? { x: m.x, y: m.y, z: m.z } : { x: origin.x, y: origin.y, z: origin.z },
      startMs: start, endMs: at(eta).getTime(),
    }], sentAt: at(0), heldAt: status === 'HOLD' ? at(0) : null, arriveAt: status === 'HOLD' ? null : at(eta),
    returnReason: status === 'RETURNING' ? 'RECALLED' : null, radiationSettledAt: at(0) }).returning();
  for (const hull of ['DART', 'COURIER', 'CATACLYSM'] as const) {
    const count = fleet[hull] ?? 0;
    if (count === 0) continue;
    await f.db.insert(monumentShipLots).values({ waveId: id, hull, count, damageBp: hull === 'COURIER' ? 2000 : 1000,
      remainderBp: hull === 'COURIER' ? 0.5 : 0.25, deuterium: hull === 'COURIER' ? 0.125 : 0 });
    await f.db.insert(units).values({ planetId: origin.id, ownerPlayerId: row!.playerId, location: row!.unitLocation, hull, count });
  }
  return row!;
}
async function cloud(intensity: number, from = 0, until = 10) {
  await f.db.insert(hpRadiationSources).values({ seasonId: f.seasonId, anchorKind: 'MONUMENT', anchorId: m.id,
    x: m.x, y: m.y, z: m.z, radius: 20_000, mode: 'EMIT', intensityHpPerMinute: intensity, activeFrom: at(from), activeUntil: at(until) });
}
async function stock(owner: number, cutoff = 10) {
  return f.db.transaction((tx) => loadLocked(tx, f.planetIds[owner]!, { now: () => at(cutoff) }));
}
async function close(minutes = 30) {
  const [event] = await f.db.select().from(scheduledEvents).where(and(eq(scheduledEvents.kind, 'season_end'), eq(scheduledEvents.seasonId, f.seasonId)));
  f.clock.set(at(minutes));
  await onSeasonEnd({ db: f.db, clock: f.clock }, event!);
}
beforeEach(async () => {
  f = await seedWorld(2, 20_261_003);
  start = f.clock.now().getTime();
  await f.db.update(seasons).set({ rulesetVersion: MULTI_WORLD.rulesetVersion, endsAt: at(10) }).where(eq(seasons.id, f.seasonId));
  await f.db.update(scheduledEvents).set({ resolveAt: at(10) }).where(eq(scheduledEvents.kind, 'season_end'));
  m = (await f.db.insert(monuments).values({ seasonId: f.seasonId, ordinal: 1, x: 6000, y: 0, z: 0,
    capacity: MONUMENT_CAPACITY, productionPerMinute: 1, controllerPlayerId: f.playerIds[0]!, settledAt: at(0) }).returning())[0]!;
  wave = await addWave(0, 'HOLD');
});
afterAll(async () => { await (await testDb()).close(); });

describe('physical monument fleets at the season boundary', () => {
  it('lands a wave whose ETA equals the exclusive closing instant without fighting at that instant', async () => {
    const incoming = await addWave(1, 'OUTBOUND', 10, { CATACLYSM: 20 });
    await close();
    expect(await f.db.select().from(monumentBattles)).toEqual([]);
    expect((await f.db.select().from(monumentWaves).where(eq(monumentWaves.id, incoming.id)))[0])
      .toMatchObject({ status: 'HOME', returnReason: 'FREEZE', resolvedAt: at(10) });
    const results = await f.db.select().from(seasonResults);
    expect(results.every(row => row.stats!.competition.battles === 0)).toBe(true);
  });
  it('includes a delayed PvP battle and each participant’s own losses in the closing audit and season statistics', async () => {
    const attacker = await addWave(1, 'OUTBOUND', 4, { CATACLYSM: 20, COURIER: 1 });
    await close();
    const [battle] = await f.db.select().from(monumentBattles);
    expect(battle).toMatchObject({ triggerWaveId: attacker.id, createdAt: at(4), eligible: true, control: 'ATTACKER' });
    const shares = await f.db.select().from(monumentBattleParticipants);
    expect(shares.reduce((sum, share) => sum + share.dominionDelta, 0)).toBe(0);
    const results = await f.db.select().from(seasonResults);
    const attackerStats = results.find((row) => row.accountId === f.accountIds[1])!.stats!;
    const defenderStats = results.find((row) => row.accountId === f.accountIds[0])!.stats!;
    expect(attackerStats.competition).toMatchObject({ battles: 1, attacks: 1, defences: 0 });
    expect(defenderStats.competition).toMatchObject({ battles: 1, attacks: 0, defences: 1, shipsLost: 2 });
    expect(defenderStats.competition.damageTaken).toBe(fleetValue(shares.find((share) => share.side === 'DEFENCE')!.losses));
    expect(attackerStats.competition.playerLoot.deuterium).toBe(battle!.lootDeuterium);
  });

  it('closes HOLD without waiting for a flight and delivers precise cargo and damaged dock lots directly once', async () => {
    const before = await stock(0);
    const population = await totalUnitsOf(f.db, wave.originPlanetId);
    await close();
    expect((await f.db.select().from(seasons).where(eq(seasons.id, f.seasonId)))[0]?.status).toBe('frozen');
    expect((await f.db.select().from(monumentWaves))[0]).toMatchObject({ status: 'HOME', returnReason: 'FREEZE', resolvedAt: at(10), fuelPaid: 18 });
    expect((await f.db.select().from(planets).where(eq(planets.id, wave.originPlanetId)))[0]!.deuterium - before.deuterium).toBeCloseTo(10.125, 8);
    expect(await totalUnitsOf(f.db, wave.originPlanetId)).toEqual(population);
    expect((await f.db.select().from(shipDamageLots))[0]).toMatchObject({ hull: 'COURIER', damageBp: 2000, remainderBp: 0.5 });
    expect(await f.db.select().from(monumentShipLots)).toHaveLength(0);
    expect((await f.db.select().from(units).where(eq(units.location, wave.unitLocation)))).toHaveLength(0);
    const saved = await f.db.select().from(planets);
    await close();
    expect(await f.db.select().from(planets)).toEqual(saved);
    expect(await f.db.select().from(shipDamageLots)).toHaveLength(1);
  });

  it.each(['OUTBOUND', 'RETURNING'] as const)('charges only the actual %s prefix through cutoff and gives no HOLD income or invented return dose', async (status) => {
    await f.db.delete(units).where(eq(units.location, wave.unitLocation));
    await f.db.delete(monumentWaves).where(eq(monumentWaves.id, wave.id));
    await f.db.update(monuments).set({ controllerPlayerId: null }).where(eq(monuments.id, m.id));
    wave = await addWave(0, status);
    const intensity = HULLS.COURIER.hp / 100;
    await cloud(intensity, 0, 60);
    const before = await stock(0);
    await close();
    expect((await f.db.select().from(monumentWaves))[0]).toMatchObject({ status: 'HOME', radiationSettledAt: at(10), fuelPaid: 18, returnReason: 'FREEZE' });
    const cargoDock = (await f.db.select().from(shipDamageLots)).find((lot) => lot.hull === 'COURIER')!;
    expect(cargoDock.damageBp + cargoDock.remainderBp).toBeCloseTo(3000.5, 8);
    expect((await f.db.select().from(planets).where(eq(planets.id, wave.originPlanetId)))[0]!.deuterium - before.deuterium).toBeCloseTo(0.125, 8);
    expect(await f.db.select().from(monumentBattles)).toHaveLength(0);
  });

  it('never revives a ship or its physical load that radiation destroyed before cutoff', async () => {
    const before = await stock(0);
    await cloud(Math.max(HULLS.DART.hp, HULLS.COURIER.hp) * 2);
    await close();
    expect((await f.db.select().from(monumentWaves))[0]?.status).toBe('LOST');
    expect(await f.db.select().from(monumentShipLots)).toHaveLength(0);
    expect(await f.db.select().from(shipDamageLots)).toHaveLength(0);
    expect(await f.db.select().from(units).where(eq(units.location, wave.unitLocation))).toHaveLength(0);
    expect((await f.db.select().from(planets).where(eq(planets.id, wave.originPlanetId)))[0]!.deuterium).toBe(before.deuterium);
  });

  it('resolves a delayed friendly arrival at its ETA and pays each owner only their real HOLD interval', async () => {
    const [clan] = await f.db.insert(clans).values({ seasonId: f.seasonId, name: 'Closing Pact', nameKey: 'closing pact', tag: 'CP', level: 1, createdAt: at(0) }).returning();
    for (const owner of [0, 1]) await f.db.insert(clanMemberships).values({ seasonId: f.seasonId, clanId: clan!.id,
      playerId: f.playerIds[owner]!, slot: owner, role: owner === 0 ? 'LEADER' : 'MEMBER', joinedAt: at(0), matureAt: at(0), aidPolicyChangedAt: at(0) });
    await f.db.update(monuments).set({ controllerPlayerId: null, controllerClanId: clan!.id }).where(eq(monuments.id, m.id));
    const incoming = await addWave(1, 'OUTBOUND', 4);
    const [before0, before1] = await Promise.all([stock(0), stock(1)]);
    await close();
    expect((await f.db.select().from(monumentWaves).where(eq(monumentWaves.id, incoming.id)))[0]).toMatchObject({ status: 'HOME', heldAt: at(4), resolvedAt: at(10) });
    for (const [owner, before, cargo] of [[0, before0, 7.125], [1, before1, 3.125]] as const) {
      expect((await f.db.select().from(planets).where(eq(planets.id, f.planetIds[owner]!)))[0]!.deuterium - before.deuterium).toBeCloseTo(cargo, 8);
    }
  });

  it('lands an overdue return at its actual ETA without charging radiation after it already reached home', async () => {
    await f.db.delete(units).where(eq(units.location, wave.unitLocation));
    await f.db.delete(monumentWaves).where(eq(monumentWaves.id, wave.id));
    await f.db.update(monuments).set({ controllerPlayerId: null }).where(eq(monuments.id, m.id));
    wave = await addWave(0, 'RETURNING', 6);
    await cloud(HULLS.COURIER.hp, 6, 60);
    await close();
    expect((await f.db.select().from(monumentWaves))[0]).toMatchObject({ status: 'HOME', resolvedAt: at(6), radiationSettledAt: at(6) });
    expect((await f.db.select().from(shipDamageLots)).find((lot) => lot.hull === 'COURIER')).toMatchObject({ damageBp: 2000, remainderBp: 0.5, createdAt: at(6) });
  });

  it('rolls the whole close back if a fleet’s stored physical path is corrupt', async () => {
    await f.db.update(monumentWaves).set({ status: 'RETURNING', returnReason: 'RECALLED', arriveAt: at(20), route: [] }).where(eq(monumentWaves.id, wave.id));
    const before = await f.db.select().from(monumentShipLots);
    await expect(close()).rejects.toMatchObject({ code: 'MONUMENT_ROUTE_INVALID' });
    expect((await f.db.select().from(seasons).where(eq(seasons.id, f.seasonId)))[0]?.status).toBe('live');
    expect(await f.db.select().from(monumentShipLots)).toEqual(before);
    expect(await f.db.select().from(shipDamageLots)).toHaveLength(0);
  });

  it('uses the actual early cutoff on forced closure and serializes duplicate closure requests', async () => {
    const before = await stock(0, 2);
    f.clock.set(at(2));
    await Promise.all([forceSeasonEnd({ db: f.db, clock: f.clock }, f.seasonId), forceSeasonEnd({ db: f.db, clock: f.clock }, f.seasonId)]);
    expect((await f.db.select().from(monumentWaves))[0]).toMatchObject({ status: 'HOME', resolvedAt: at(2) });
    expect((await f.db.select().from(planets).where(eq(planets.id, wave.originPlanetId)))[0]!.deuterium - before.deuterium).toBeCloseTo(2.125, 8);
    expect(await f.db.select().from(shipDamageLots)).toHaveLength(1);
  });

  it('terminates native events atomically and makes their old delivery inert after the season froze', async () => {
    const rows = await f.db.insert(scheduledEvents).values([
      { seasonId: f.seasonId, kind: 'monument_loss', refId: m.id, payload: { scope: 'HOLD', generation: m.generation }, resolveAt: at(5) },
      { seasonId: f.seasonId, kind: 'monument_respawn', refId: m.id, payload: { generation: m.generation }, resolveAt: at(5) },
      { seasonId: f.seasonId, kind: 'monument_arrival', refId: wave.id, payload: { generation: wave.generation }, resolveAt: at(5) },
    ]).returning();
    await close();
    expect(await f.db.select().from(scheduledEvents).where(eq(scheduledEvents.kind, 'monument_loss'))).toHaveLength(0);
    expect(await f.db.select().from(scheduledEvents).where(eq(scheduledEvents.kind, 'monument_respawn'))).toHaveLength(0);
    expect(await f.db.select().from(scheduledEvents).where(eq(scheduledEvents.kind, 'monument_arrival'))).toHaveLength(0);
    const saved = await f.db.select().from(planets);
    for (const row of rows) await HANDLERS[row.kind]!({ db: f.db, clock: f.clock }, row);
    expect(await f.db.select().from(planets)).toEqual(saved);
  });
});
