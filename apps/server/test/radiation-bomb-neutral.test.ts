import { randomUUID } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { afterAll, beforeEach, expect, it } from 'vitest';
import { HULLS, MULTI_WORLD, applyHpDose, fleetEntries, resolveBattle, seededFrom, soloStack, type Fleet } from '@astera/rules';
import { battleReports, missions, neutralPlanetState, notifications, planets, seasons, strategicAssets, units } from '../src/db/schema.js';
import { buildRadiationBomb, launchRadiationBomb, resolveRadiationBomb } from '../src/services/radiationBomb.js';
import { advanceNeutralEconomy, reinforceNeutral, resolveNeutralBattle } from '../src/services/neutral.js';
import { readHomeHealth } from '../src/services/homeHealth.js';
import { grant, placeAt, seedWorld, setLevel, testDb, type Fixture } from './helpers.js';

let f: Fixture;
let npc: string;
beforeEach(async () => {
  f = await seedWorld(2);
  npc = f.planetIds[1]!;
  await f.db.update(seasons).set({ rulesetVersion: 18, radiationBombStartsAt: f.clock.now() }).where(eq(seasons.id, f.seasonId));
  await f.db.update(planets).set({ kind: 'NEUTRAL', controllerPlayerId: null, shield: 0 }).where(eq(planets.id, npc));
  await f.db.insert(neutralPlanetState).values({ planetId: npc, tier: 2, profileSeed: 123, economyAnchorAt: f.clock.now() });
  await f.db.delete(units).where(eq(units.planetId, npc));
  await setLevel(f.db, f.planetIds[0]!, 'CORE', 13);
  await setLevel(f.db, f.planetIds[0]!, 'SHIPYARD', 5);
  await grant(f.db, f.planetIds[0]!, 500000, 500000);
  await f.db.update(planets).set({ deuterium: 500000 }).where(eq(planets.id, f.planetIds[0]!));
  await placeAt(f.db, npc, { x: 0 }); await placeAt(f.db, f.planetIds[0]!, { x: 1000 });
});
afterAll(async () => { await (await testDb()).close(); });

async function hit(fleet: Fleet) {
  await f.db.insert(units).values(fleetEntries(fleet).map(([hull, count]) => ({
    planetId: npc, ownerPlayerId: null, location: 'home', hull, count,
  })));
  const built = await buildRadiationBomb(f.db, f.planetIds[0]!, 1, f.clock, f.playerIds[0]);
  await f.db.update(strategicAssets).set({ status: 'READY' }).where(eq(strategicAssets.id, built.assetId));
  const sent = await launchRadiationBomb(f.db, { playerId: f.playerIds[0]!, originPlanetId: f.planetIds[0]!,
    level: 1, target: { kind: 'PLANET', id: npc }, key: randomUUID(), clock: f.clock });
  f.clock.set(new Date(sent.arriveAt));
  await resolveRadiationBomb(f.db, sent.flightId, f.clock);
}

async function raid() {
  const [mission] = await f.db.insert(missions).values({ seasonId: f.seasonId, kind: 'attack', ownerPlayerId: f.playerIds[0]!,
    originPlanetId: f.planetIds[0]!, targetPlanetId: npc, fleet: { DART: 1 }, damage: [], tech: {}, fuelPaid: 0,
    distance: 1000, departAt: f.clock.now(), arriveAt: f.clock.now() }).returning();
  await f.db.insert(units).values({ planetId: f.planetIds[0]!, ownerPlayerId: f.playerIds[0]!,
    hull: 'DART', location: mission!.id, count: 1 });
  await f.db.transaction(tx => resolveNeutralBattle(tx, mission!, f.clock, 18));
  const [report] = await f.db.select().from(battleReports).where(eq(battleReports.missionId, mission!.id));
  return { mission: mission!, report: report! };
}

it('fights with the NPC’s radiation wounds and preserves the surviving HP in storage and the raid report', async () => {
  await hit({ CITADEL: 1 });
  f.clock.advance(1);
  const wounded = applyHpDose({ CITADEL: 1 }, [], 9);
  const { mission, report } = await raid();
  const expected = resolveBattle([soloStack({ DART: 1 }, { tech: {} }, [])],
    [{ stackId: 'neutral', playerId: '', fleet: { CITADEL: 1 }, damage: wounded.lots, tech: { tech: {} }, maintenanceExempt: true }],
    0, seededFrom(mission.id), 'HP_PLANET', true);
  expect(report.defenderLosses).toEqual(expected.defenderLosses);
  expect(report.defenderDamage).toEqual(expected.defenderDamage);
  const health = await readHomeHealth(f.db, npc);
  expect(health.fleet).toEqual(expected.defenderSurvivors);
  expect(health.damage).toEqual(expected.defenderDamage);
  expect(health.damage).not.toHaveLength(0);
  expect(health.damage[0]!.damageBp + (health.damage[0]!.remainderBp ?? 0)).toBeGreaterThan(9 / HULLS.CITADEL.hp * 10000);
});

it('settles unprocessed radiation deaths before a raid, without counting them as battle kills or radiation reports', async () => {
  await hit({ DART: 1 });
  f.clock.advance(10);
  const { report } = await raid();
  expect(report.defenderFleet.DART ?? 0).toBe(0);
  expect(report.defenderLosses.DART ?? 0).toBe(0);
  expect((await readHomeHealth(f.db, npc)).fleet.DART ?? 0).toBe(0);
  expect(await f.db.select().from(notifications).where(eq(notifications.kind, 'radiation_lost'))).toHaveLength(0);
});

it('keeps old wounds on reinforcement, births only the missing NPCs at the current cursor and never reapplies history to them', async () => {
  await hit({ DART: 1, STRONGHOLD: 1 });
  f.clock.advance(1);
  await f.db.transaction(tx => reinforceNeutral(tx, npc, f.clock.now()));
  await f.db.transaction(tx => reinforceNeutral(tx, npc, f.clock.now()));
  const born = await readHomeHealth(f.db, npc);
  expect(born.fleet.DART).toBe(MULTI_WORLD.neutral[2].fleet.DART);
  expect(born.damage.filter(lot => lot.hull === 'DART').reduce((sum, lot) => sum + lot.count, 0)).toBe(1);
  expect(born.damage.find(lot => lot.hull === 'DART')!.damageBp).toBe(Math.floor(9 / HULLS.DART.hp * 10000));
  f.clock.advance(1);
  await f.db.transaction(tx => advanceNeutralEconomy(tx, npc, f.clock.now()));
  const health = await readHomeHealth(f.db, npc);
  const dart = health.damage.filter(lot => lot.hull === 'DART');
  expect(dart).toHaveLength(2);
  const original = dart.find(lot => lot.count === 1)!;
  const newborn = dart.find(lot => lot.count === MULTI_WORLD.neutral[2].fleet.DART - 1)!;
  const protectedDose = 9 - MULTI_WORLD.neutral[2].instruments.AEGIS;
  expect(original.damageBp + (original.remainderBp ?? 0)).toBeCloseTo((9 + protectedDose) / HULLS.DART.hp * 10000);
  expect(newborn.damageBp + (newborn.remainderBp ?? 0)).toBeCloseTo(protectedDose / HULLS.DART.hp * 10000);
  expect((await f.db.select().from(units).where(and(eq(units.planetId, npc), eq(units.location, 'home'))))
    .every(row => row.ownerPlayerId === null)).toBe(true);
});
