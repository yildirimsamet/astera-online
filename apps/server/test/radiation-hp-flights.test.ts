import { and, eq } from 'drizzle-orm';
import { pino } from 'pino';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { HULLS, hullTech, distance, fleetTravelExact, engagementEndsAt, type Fleet, type HpDamageLot, type TechLevels } from '@astera/rules';
import { battleReports, clanSupportWaves, clanWarContributions, clanWarParticipantResults, clans, hpRadiationSources, missions, planets, playerResearch, radiationSources, seasons, units } from '../src/db/schema.js';
import { assertRadiationSafe, settleFlightRadiation, settleMissionRadiation } from '../src/services/radiation.js';
import { dockLotsOf, landShips } from '../src/services/shipDamage.js';
import { launchAttack } from '../src/services/mission.js';
import { launchTransfer } from '../src/services/movement.js';
import { recallClanSupport, sendClanSupport, setDefencePosture } from '../src/services/clanSupport.js';
import { clanActor } from '../src/services/clan.js';
import { markClanWarTarget, sendClanWarContribution, startClanWar } from '../src/services/clanWar.js';
import { loadLocked, lockSeason } from '../src/services/planet.js';
import { standStations } from '../src/services/defenderLine.js';
import { lockWorlds } from '../src/services/ownership.js';
import { EventWorker } from '../src/worker/loop.js';
import { pendingThreads } from '../src/services/session.js';
import { fuelUp, giveUnits, seedWorld, setLevel, settledAt, testDb, type Fixture } from './helpers.js';
import { formClan, supportWorld } from './clanSupportFixture.js';

let f: Fixture;
const version = 16;
const start = () => f.clock.now().getTime();
const minutePath = () => [{ from: { x: 0, y: 0, z: 0 }, to: { x: 1, y: 0, z: 0 }, startMs: start(), endMs: start() + 60_000 }];
const worker = () => new EventWorker(f.db, f.clock, { pollMs: 1000, batch: 100, staleMinutes: 5 }, pino({ level: 'silent' }));

async function hpCloud(intensity: number, over: Partial<typeof hpRadiationSources.$inferInsert> = {}) {
  await f.db.insert(hpRadiationSources).values({
    seasonId: f.seasonId, anchorKind: 'ZONE', x: 0, y: 0, z: 0, radius: 100_000,
    intensityHpPerMinute: intensity, mode: 'EMIT', activeFrom: f.clock.now(), ...over,
  });
}
async function percentageCloud(rate = 25) {
  await f.db.insert(radiationSources).values({
    seasonId: f.seasonId, anchorKind: 'ZONE', x: 0, y: 0, z: 0, radius: 100_000,
    intensityPctPerMinute: rate, mode: 'EMIT', activeFrom: f.clock.now(),
  });
}
async function dose(fleet: Fleet, tech: TechLevels = {}, rulesetVersion = version) {
  await giveUnits(f.db, f.planetIds[0]!, fleet, 'hp-flight');
  return f.db.transaction(async (tx) => {
    await lockSeason(tx, f.seasonId);
    await lockWorlds(tx, [f.planetIds[0]!]);
    return settleFlightRadiation(tx, { seasonId: f.seasonId, rulesetVersion, path: minutePath(),
      planetId: f.planetIds[0]!, location: 'hp-flight', damage: null, tech });
  });
}
async function flight(fleet: Fleet, tech: TechLevels = {}) {
  const [row] = await f.db.insert(missions).values({
    seasonId: f.seasonId, kind: 'attack', ownerPlayerId: f.playerIds[0]!, originPlanetId: f.planetIds[0]!,
    targetPlanetId: f.planetIds[1]!, fleet, tech, fuelPaid: 0, distance: 100,
    departAt: f.clock.now(), arriveAt: new Date(start() + 60_000),
  }).returning();
  if (!row) throw new Error('missing test flight');
  await giveUnits(f.db, f.planetIds[0]!, fleet, row.id);
  return row;
}
async function settle(id: string) {
  return f.db.transaction(async (tx) => {
    await lockSeason(tx, f.seasonId);
    await lockWorlds(tx, f.planetIds);
    const [row] = await tx.select().from(missions).where(eq(missions.id, id));
    if (!row) throw new Error('missing test flight');
    return settleMissionRadiation(tx, row, { storagePlanetId: f.planetIds[0]!, rulesetVersion: version });
  });
}
const exact = (lot: HpDamageLot | undefined) => (lot?.damageBp ?? 0) + (lot?.remainderBp ?? 0);

beforeEach(async () => {
  f = await seedWorld(2, 20_261_004);
  await f.db.update(seasons).set({ rulesetVersion: version }).where(eq(seasons.id, f.seasonId));
  for (const planetId of f.planetIds) await setLevel(f.db, planetId, 'SHIPYARD', 4);
  await fuelUp(f.db, f.planetIds[0]!);
});
afterAll(async () => { const { close } = await testDb(); await close(); });

describe('new-season HP radiation on ordinary flights', () => {
  it('carries the support owner’s committed armor home after research changes during its stay', async () => {
    f = await supportWorld(3, 20_261_015, version);
    await formClan(f, 0, [1]);
    await f.db.insert(playerResearch).values({ playerId: f.playerIds[0]!, projectId: 'SHIP_ARMOR', level: 2, completedAt: f.clock.now() });
    await f.db.transaction(tx => setDefencePosture(tx, { planetId: f.planetIds[1]!, playerId: f.playerIds[1]!,
      toggles: { escape: false, support: true }, clock: f.clock }));
    const { wave } = await f.db.transaction(tx => sendClanSupport(tx, { senderPlayerId: f.playerIds[0]!, originPlanetId: f.planetIds[0]!,
      hostPlanetId: f.planetIds[1]!, fleet: { DART: 2 }, clock: f.clock }));
    f.clock.set(new Date(wave.arriveAt));
    await worker().tick();
    await f.db.update(playerResearch).set({ level: 10 }).where(eq(playerResearch.playerId, f.playerIds[0]!));
    const [standing] = await f.db.select().from(clanSupportWaves).where(eq(clanSupportWaves.id, wave.id));
    if (!standing) throw new Error('missing stationed support');
    const stations = await f.db.transaction(async tx => {
      await lockSeason(tx, f.seasonId);
      await lockWorlds(tx, f.planetIds);
      return standStations(tx, { waves: [standing], host: await loadLocked(tx, standing.hostPlanetId, f.clock),
        rulesetVersion: version, now: f.clock.now() });
    });
    expect(stations[0]?.stack.tech.tech.SHIP_ARMOR).toBe(2);
    await f.db.transaction(tx => recallClanSupport(tx, { playerId: f.playerIds[0]!, waveId: wave.id, clock: f.clock }));
    const [back] = await f.db.select().from(missions).where(eq(missions.parentMissionId, standing.outboundMissionId));
    expect(back?.tech?.SHIP_ARMOR).toBe(2);
    if (!back) throw new Error('missing support return');
    await hpCloud(HULLS.DART.hp * hullTech({ SHIP_ARMOR: 2 }, 'DART').hp * 0.3000125
      / ((back.arriveAt.getTime() - back.departAt.getTime()) / 60_000));
    f.clock.set(back.arriveAt);
    await worker().tick();
    expect(exact((await dockLotsOf(f.db, f.planetIds[0]!))[0])).toBeCloseTo(3000.125, 7);
  });
  it('projects a paid ordinary cohort once, without resurrecting its dead launch hulls', async () => {
    const mission = await flight({ DART: 1, CITADEL: 1 });
    await hpCloud(HULLS.CITADEL.hp);
    await f.db.delete(units).where(and(eq(units.location, mission.id), eq(units.hull, 'DART')));
    await f.db.update(missions).set({ damage: [{ hull: 'CITADEL', count: 1, damageBp: 5000 }],
      radiationSettledAt: new Date(start() + 30_000) }).where(eq(missions.id, mission.id));
    f.clock.set(new Date(start() + 30_000));
    const thread = (await pendingThreads(f.db, f.planetIds[0]!, f.clock.now())).find(row => row.id === mission.id);
    expect(thread?.fleet).toEqual({ CITADEL: 1 });
    expect(thread?.fadeAt?.getTime()).toBe(mission.arriveAt.getTime());
    f.clock.set(mission.arriveAt);
    expect((await pendingThreads(f.db, f.planetIds[0]!, f.clock.now())).find(row => row.id === mission.id)).toBeUndefined();
  });

  it('asks for the ordinary raid’s known return-only loss before committing any ships', async () => {
    const worlds = await f.db.select().from(planets);
    const origin = worlds.find(row => row.id === f.planetIds[0]!)!, target = worlds.find(row => row.id === f.planetIds[1]!)!;
    const minutes = fleetTravelExact(distance(origin, target), { DART: 2 }, { boost: 1, tech: {} });
    await giveUnits(f.db, origin.id, { DART: 2 });
    await hpCloud(HULLS.DART.hp * 6, { activeFrom: new Date(engagementEndsAt(start() + minutes * 60_000)) });
    await expect(launchAttack(f.db, origin.id, target.id, { DART: 2 }, f.clock)).rejects.toMatchObject({
      code: 'RADIATION_LETHAL', params: { count: 2 },
    });
    expect(await f.db.select().from(missions)).toHaveLength(0);
    await expect(launchAttack(f.db, origin.id, target.id, { DART: 2 }, f.clock, f.playerIds[0], true, 1, true)).resolves.toHaveProperty('missionId');
  });

  it('asks only about selected return ships when a transfer’s HP cloud starts after unloading', async () => {
    await f.db.update(planets).set({ controllerPlayerId: f.playerIds[0]!, kind: 'COLONY' }).where(eq(planets.id, f.planetIds[1]!));
    await setLevel(f.db, f.planetIds[1]!, 'HANGAR', 10);
    const worlds = await f.db.select().from(planets);
    const origin = worlds.find(row => row.id === f.planetIds[0]!)!, target = worlds.find(row => row.id === f.planetIds[1]!)!;
    const fleet = { DART: 1, COURIER: 1 }, cargo = { alloy: 0, crystal: 0, deuterium: 0 };
    await giveUnits(f.db, origin.id, fleet);
    const minutes = fleetTravelExact(distance(origin, target), fleet, { boost: 1, tech: {} });
    await hpCloud(HULLS.COURIER.hp * 6, { activeFrom: new Date(start() + minutes * 60_000) });
    await expect(launchTransfer(f.db, f.playerIds[0]!, origin.id, target.id, fleet, cargo, f.clock, 1,
      { cargoShips: 'RETURN', otherShips: 'STAY' })).rejects.toMatchObject({ code: 'RADIATION_LETHAL', params: { count: 1 } });
    expect(await f.db.select().from(missions)).toHaveLength(0);
    await expect(launchTransfer(f.db, f.playerIds[0]!, origin.id, target.id, fleet, cargo, f.clock, 1,
      { cargoShips: 'STAY', otherShips: 'STAY' })).resolves.toHaveProperty('missionId');
  });

  it('requires loss acknowledgement for an actual engagement-only HP source on a complete route', async () => {
    const path = minutePath();
    const arrival = new Date(path[0]!.endMs), end = new Date(arrival.getTime() + 10_000);
    await hpCloud(HULLS.DART.hp * 6, { activeFrom: arrival, activeUntil: end });
    const input = { seasonId: f.seasonId, from: path[0]!.from, to: path[0]!.to, departAt: f.clock.now(), arriveAt: arrival,
      fleet: { DART: 2 }, tech: {}, acknowledged: false,
      path: [...path, { from: path[0]!.to, to: path[0]!.to, startMs: arrival.getTime(), endMs: end.getTime() }] };
    await expect(f.db.transaction(tx => assertRadiationSafe(tx, input))).rejects.toMatchObject({ code: 'RADIATION_LETHAL', params: { count: 2 } });
    await expect(f.db.transaction(tx => assertRadiationSafe(tx, { ...input, acknowledged: true }))).resolves.toBeUndefined();
  });
  it('gives every ship the same HP dose using the committing owner’s armor', async () => {
    const tech: TechLevels = { SHIP_ARMOR: 5 };
    await hpCloud(0.001);
    const outcome = await dose({ DART: 3, CITADEL: 2 }, tech);
    expect(exact(outcome.damage.find((lot) => lot.hull === 'DART'))).toBeCloseTo(0.001 / (HULLS.DART.hp * hullTech(tech, 'DART').hp) * 10_000, 10);
    expect(exact(outcome.damage.find((lot) => lot.hull === 'CITADEL'))).toBeCloseTo(0.001 / (HULLS.CITADEL.hp * hullTech(tech, 'CITADEL').hp) * 10_000, 10);
    expect(outcome.fleet).toEqual({ DART: 3, CITADEL: 2 });
  });

  it('keeps the legacy percentage model and ignores HP rows in the older ruleset', async () => {
    await hpCloud(1_000_000);
    await percentageCloud();
    expect((await dose({ DART: 1 }, {}, 15)).damage).toEqual([{ hull: 'DART', count: 1, damageBp: 2500 }]);
  });

  it('does not reinterpret percentage sources as HP or stack the two models', async () => {
    await percentageCloud(1000);
    expect((await dose({ DART: 1 })).damage).toEqual([]);
    await hpCloud(HULLS.DART.hp / 10);
    const outcome = await dose({ DART: 1 });
    expect(exact(outcome.damage[0])).toBeCloseTo(1000, 8);
    expect(outcome.destroyed).toEqual({});
  });

  it('charges only the source window the original route actually crossed', async () => {
    await hpCloud(HULLS.DART.hp / 10, { activeFrom: new Date(start() + 30_000), activeUntil: new Date(start() + 90_000) });
    const outcome = await dose({ DART: 1 });
    expect(exact(outcome.damage[0])).toBeCloseTo(500, 8);
  });

  it('removes low-HP hulls, keeps the surviving hull’s wound, and leaves Prospectors immune', async () => {
    await hpCloud(HULLS.DART.hp);
    const outcome = await dose({ DART: 2, CITADEL: 1, PROSPECTOR: 4 });
    expect(outcome.destroyed).toEqual({ DART: 2 });
    expect(outcome.fleet).toEqual({ CITADEL: 1, PROSPECTOR: 4 });
    expect(outcome.damage.map((lot) => lot.hull)).toEqual(['CITADEL']);
    const parked = await f.db.select().from(units).where(and(eq(units.planetId, f.planetIds[0]!), eq(units.location, 'hp-flight')));
    expect(parked.map((row) => row.hull).sort()).toEqual(['CITADEL', 'PROSPECTOR']);
  });

  it('persists sub-bp wounds and never pays the same mission interval twice', async () => {
    const mission = await flight({ DART: 2 }, { SHIP_ARMOR: 5 });
    await hpCloud(0.001);
    const first = await settle(mission.id);
    const expected = 0.001 / (HULLS.DART.hp * hullTech(mission.tech ?? {}, 'DART').hp) * 10_000;
    expect(exact(first.mission.damage?.[0])).toBeCloseTo(expected, 10);
    const second = await settle(mission.id);
    expect(second.mission.damage).toEqual(first.mission.damage);
    expect(second.destroyed).toEqual({});
  });

  it('docks a ship just above twenty percent through the ordinary landing adapter', async () => {
    const damage: HpDamageLot[] = [{ hull: 'DART', count: 1, damageBp: 2000, remainderBp: Number.MIN_VALUE }];
    await f.db.transaction(async (tx) => {
      await lockWorlds(tx, [f.planetIds[0]!]);
      await landShips(tx, { planetId: f.planetIds[0]!, ownerPlayerId: f.playerIds[0]!, fleet: { DART: 1 }, damage, at: f.clock.now() });
    });
    expect(await dockLotsOf(f.db, f.planetIds[0]!)).toMatchObject([{ hull: 'DART', count: 1, damageBp: 2000, remainderBp: Number.MIN_VALUE }]);
  });

  it('carries the arrival fraction through a planet walkover, its return flight and the dock', async () => {
    await giveUnits(f.db, f.planetIds[0]!, { DART: 2 });
    const launched = await launchAttack(f.db, f.planetIds[0]!, f.planetIds[1]!, { DART: 2 }, f.clock);
    const minutes = (launched.arriveAt.getTime() - start()) / 60_000;
    await hpCloud(HULLS.DART.hp * 0.3000125 / minutes, { activeUntil: launched.arriveAt });
    f.clock.set(settledAt(launched.arriveAt));
    await worker().tick();
    const [report] = await f.db.select().from(battleReports).where(eq(battleReports.missionId, launched.missionId));
    expect(exact(report?.attackerDamage[0])).toBeCloseTo(3000.125, 7);
    const [back] = await f.db.select().from(missions).where(eq(missions.parentMissionId, launched.missionId));
    if (!back) throw new Error('missing surviving return');
    expect(exact(back.damage?.[0])).toBeCloseTo(3000.125, 7);
    f.clock.set(back.arriveAt);
    await worker().tick();
    expect(await dockLotsOf(f.db, f.planetIds[0]!)).toMatchObject([{ hull: 'DART', count: 2, damageBp: 3000 }]);
    expect(exact((await dockLotsOf(f.db, f.planetIds[0]!))[0])).toBeCloseTo(3000.125, 7);
    await worker().tick();
    expect(await dockLotsOf(f.db, f.planetIds[0]!)).toHaveLength(1);
  });

  it('uses the same HP and armor in the lethal route acknowledgement', async () => {
    await hpCloud(HULLS.DART.hp * 1.1);
    const input = { seasonId: f.seasonId, from: minutePath()[0]!.from, to: minutePath()[0]!.to,
      departAt: f.clock.now(), arriveAt: new Date(start() + 60_000), fleet: { DART: 1 }, acknowledged: false };
    await expect(f.db.transaction((tx) => assertRadiationSafe(tx, input))).rejects.toMatchObject({ code: 'RADIATION_LETHAL', params: { count: 1 } });
    await expect(f.db.transaction((tx) => assertRadiationSafe(tx, { ...input, tech: { SHIP_ARMOR: 10 } }))).resolves.toBeUndefined();
  });

  it('serializes repeated reads from stale mission copies without charging the interval again', async () => {
    const mission = await flight({ DART: 2 });
    await hpCloud(0.001);
    await Promise.all(Array.from({ length: 4 }, () => f.db.transaction(async (tx) => {
      await lockSeason(tx, f.seasonId);
      await lockWorlds(tx, f.planetIds);
      return settleMissionRadiation(tx, mission, { storagePlanetId: f.planetIds[0]!, rulesetVersion: version });
    })));
    const [stored] = await f.db.select().from(missions).where(eq(missions.id, mission.id));
    expect(exact(stored?.damage?.[0])).toBeCloseTo(0.001 / HULLS.DART.hp * 10_000, 10);
  });

  it('shows the whole-wing loss time on an own contact using HP instead of percentage sources', async () => {
    const mission = await flight({ DART: 1, CITADEL: 1 });
    await hpCloud(HULLS.CITADEL.hp * 2);
    const thread = (await pendingThreads(f.db, f.planetIds[0]!, f.clock.now())).find((row) => row.id === mission.id);
    expect(thread?.fadeAt?.getTime()).toBe(start() + 30_000);
  });

  it('keeps each hull’s fraction when a transfer lands combat ships and sends cargo ships home', async () => {
    await f.db.update(planets).set({ controllerPlayerId: f.playerIds[0]!, kind: 'COLONY' }).where(eq(planets.id, f.planetIds[1]!));
    await setLevel(f.db, f.planetIds[1]!, 'HANGAR', 10);
    await giveUnits(f.db, f.planetIds[0]!, { DART: 1, COURIER: 1 });
    const launched = await launchTransfer(f.db, f.playerIds[0]!, f.planetIds[0]!, f.planetIds[1]!,
      { DART: 1, COURIER: 1 }, { alloy: 0, crystal: 0, deuterium: 0 }, f.clock, 1, { cargoShips: 'RETURN', otherShips: 'STAY' });
    const minutes = (launched.arriveAt.getTime() - start()) / 60_000;
    const exposure = Math.max(HULLS.DART.hp, HULLS.COURIER.hp) * 0.3000125;
    await hpCloud(exposure / minutes, { activeUntil: launched.arriveAt });
    f.clock.set(launched.arriveAt);
    await worker().tick();
    const [back] = await f.db.select().from(missions).where(eq(missions.parentMissionId, launched.missionId));
    expect(exact(back?.damage?.[0])).toBeCloseTo(exposure / HULLS.COURIER.hp * 10_000, 7);
    expect(exact((await dockLotsOf(f.db, f.planetIds[1]!))[0])).toBeCloseTo(exposure / HULLS.DART.hp * 10_000, 7);
  });

  it('writes support’s HP wound on the wave and preserves it when recalled to its own dock', async () => {
    f = await supportWorld(3, 20_261_005, version);
    await formClan(f, 0, [1]);
    await f.db.transaction((tx) => setDefencePosture(tx, { planetId: f.planetIds[1]!, playerId: f.playerIds[1]!,
      toggles: { escape: false, support: true }, clock: f.clock }));
    const { wave } = await f.db.transaction((tx) => sendClanSupport(tx, { senderPlayerId: f.playerIds[0]!, originPlanetId: f.planetIds[0]!,
      hostPlanetId: f.planetIds[1]!, fleet: { DART: 2 }, clock: f.clock }));
    const arriveAt = new Date(wave.arriveAt);
    const minutes = (arriveAt.getTime() - start()) / 60_000;
    await hpCloud(HULLS.DART.hp * 0.3000125 / minutes, { activeUntil: arriveAt });
    f.clock.set(arriveAt);
    await worker().tick();
    const [standing] = await f.db.select().from(clanSupportWaves).where(eq(clanSupportWaves.id, wave.id));
    expect(exact(standing?.damage?.[0])).toBeCloseTo(3000.125, 7);
    await f.db.transaction((tx) => recallClanSupport(tx, { playerId: f.playerIds[0]!, waveId: wave.id, clock: f.clock }));
    const [returning] = await f.db.select().from(clanSupportWaves).where(eq(clanSupportWaves.id, wave.id));
    if (!returning?.returnAt) throw new Error('missing support return');
    f.clock.set(returning.returnAt);
    await worker().tick();
    expect(exact((await dockLotsOf(f.db, f.planetIds[0]!))[0])).toBeCloseTo(3000.125, 7);
  });

  it('preserves each joint contributor’s fraction on the personal battle result and return', async () => {
    f = await supportWorld(3, 20_261_006, version);
    const clanId = await formClan(f, 0, [1]);
    await f.db.update(clans).set({ level: 5 }).where(eq(clans.id, clanId));
    await f.db.delete(units).where(eq(units.planetId, f.planetIds[2]!));
    await f.db.transaction(async (tx) => markClanWarTarget(tx, { actor: await clanActor(tx, f.accountIds[0]!),
      targetPlanetId: f.planetIds[2]!, clock: f.clock }));
    for (const index of [0, 1]) await f.db.transaction(async (tx) => sendClanWarContribution(tx, {
      actor: await clanActor(tx, f.accountIds[index]!), originPlanetId: f.planetIds[index]!, fleet: { DART: 2 },
      acknowledgeShieldLoss: true, clock: f.clock,
    }));
    const [staging] = await f.db.select().from(missions).where(eq(missions.status, 'in_flight'));
    if (!staging) throw new Error('missing staging flight');
    f.clock.set(staging.arriveAt);
    await worker().tick();
    await f.db.transaction(async (tx) => startClanWar(tx, { actor: await clanActor(tx, f.accountIds[0]!),
      acknowledgeShieldLoss: true, clock: f.clock }));
    const [strike] = await f.db.select().from(missions).where(eq(missions.status, 'in_flight'));
    if (!strike) throw new Error('missing joint strike');
    const minutes = (strike.arriveAt.getTime() - strike.departAt.getTime()) / 60_000;
    await hpCloud(HULLS.DART.hp * 0.3000125 / minutes, { activeUntil: strike.arriveAt });
    f.clock.set(settledAt(strike.arriveAt));
    await worker().tick();
    const results = await f.db.select().from(clanWarParticipantResults);
    expect(results).toHaveLength(2);
    for (const result of results) expect(exact(result.damage[0])).toBeCloseTo(3000.125, 7);
    for (const contribution of await f.db.select().from(clanWarContributions)) {
      expect(exact(contribution.damage?.[0])).toBeCloseTo(3000.125, 7);
    }
  });
});
