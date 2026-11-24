import { and, eq } from 'drizzle-orm';
import { pino } from 'pino';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { MOON, fleetEntries, type Fleet } from '@astera/rules';
import {
  battleReplays, battleReports, dominionEvents, missions, moons, notifications, planetFaults, planets, seasons, units,
} from '../src/db/schema.js';
import { launchAttack } from '../src/services/mission.js';
import { hopFleet } from '../src/services/moonMovement.js';
import { MOON_LOCATION, PLANET_LOCATION } from '../src/services/unitLocation.js';
import { EventWorker } from '../src/worker/loop.js';
import { fuelUp, giveUnits, grant, levelWorld, seedWorld, setLevel, settledAt, testDb, type Fixture } from './helpers.js';

/*
  F3b (S2/S6, S21, S28, S31, S55; plan §6.9, V11, V43): a moon is a target of its own. Only the ships
  standing on it fight — no ground, no Aegis, no clan support, no loot, no Tactical Retreat — and a moon
  with nothing able to fight is "empty": no battle, no score, no loyalty, but the raid still counts.
*/
const silent = pino({ level: 'silent' });

describe('a raid on the moon', () => {
  let f: Fixture;
  let mine: string;
  let theirs: string;
  let colony: string;
  const HEAVY: Fleet = { DART: 240, COURIER: 60 };

  const worker = () => new EventWorker(f.db, f.clock, { pollMs: 1000, batch: 100, staleMinutes: 5 }, silent);

  const onBody = async (planetId: string, location: string) => Object.fromEntries((await f.db.select().from(units)
    .where(and(eq(units.planetId, planetId), eq(units.location, location)))).filter((row) => row.count > 0)
    .map((row) => [row.hull, row.count]));

  const putOnMoon = async (planetId: string, ownerIndex: number, fleet: Fleet) => {
    for (const [hull, count] of fleetEntries(fleet)) {
      await f.db.insert(units).values({ planetId, ownerPlayerId: f.playerIds[ownerIndex]!, hull, location: MOON_LOCATION, count });
    }
  };

  const raid = async (target: string, fleet: Fleet = HEAVY) => {
    await giveUnits(f.db, mine, fleet);
    await fuelUp(f.db, mine);
    const launch = await launchAttack(f.db, mine, target, fleet, f.clock, undefined, false, undefined, false, new Set(), false, 'MOON');
    f.clock.set(settledAt(launch.arriveAt));
    await worker().tick();
    const [report] = await f.db.select().from(battleReports).where(eq(battleReports.missionId, launch.missionId));
    return { launch, report };
  };

  const payloadOf = async (playerIndex: number, kind: 'raid_result' | 'raided') => {
    const [row] = await f.db.select({ payload: notifications.payload }).from(notifications)
      .where(and(eq(notifications.playerId, f.playerIds[playerIndex]!), eq(notifications.kind, kind)));
    return row?.payload;
  };

  beforeEach(async () => {
    f = await seedWorld(3, 20_070);
    [mine, theirs, colony] = f.planetIds as [string, string, string];
    await f.db.update(seasons).set({ rulesetVersion: MOON.rulesetVersion }).where(eq(seasons.id, f.seasonId));
    for (const id of f.planetIds) {
      await setLevel(f.db, id, 'CORE', 8);
      await setLevel(f.db, id, 'SHIPYARD', 4);
    }
    await f.db.update(planets).set({
      controllerPlayerId: f.playerIds[1]!, kind: 'COLONY', statsOwnerPlayerId: f.playerIds[1]!,
      seasonTelemetry: { produced: { alloy: 0, crystal: 0, deuterium: 0 }, productiveSeconds: 0, shipsBuilt: {} },
    }).where(eq(planets.id, colony));
    await f.db.insert(moons).values([
      { planetId: theirs, rarity: 'RARE', origin: 'BUILT', visualSeed: 1, bornAt: f.clock.now() },
      { planetId: colony, rarity: 'COMMON', origin: 'BUILT', visualSeed: 2, bornAt: f.clock.now() },
    ]);
    await levelWorld(f.db, f.planetIds);
    f.clock.advance(250);
  });
  afterAll(async () => { const { close } = await testDb(); await close(); });

  it('fights only the ships on the moon: the planet’s fleet, ground and Aegis stay out, and nothing is looted', async () => {
    await grant(f.db, theirs, 60_000, 15_000);
    await giveUnits(f.db, theirs, { DART: 30, BASTION: 4 });
    await putOnMoon(theirs, 1, { PIKE: 2 });

    const { launch, report } = await raid(theirs);
    expect(report).toBeDefined();
    expect(report!.targetBody).toBe('MOON');
    expect(report!.defenderFleet).toEqual({ PIKE: 2 });
    expect(report!.loot).toEqual({ alloy: 0, crystal: 0, deuterium: 0 });
    expect(report!.shieldAbsorbed).toBe(0);
    expect(await onBody(theirs, MOON_LOCATION)).toEqual({});
    expect(await onBody(theirs, PLANET_LOCATION)).toEqual({ DART: 30, BASTION: 4 });

    const [replay] = await f.db.select({ data: battleReplays.data }).from(battleReplays)
      .where(eq(battleReplays.battleReportId, report!.id));
    expect(replay?.data?.environment).toBe('MOON');
    const [home] = await f.db.select().from(missions).where(eq(missions.parentMissionId, launch.missionId));
    expect(home?.loot).toEqual({ alloy: 0, crystal: 0, deuterium: 0 });
    expect(await payloadOf(0, 'raid_result')).toMatchObject({ targetBody: 'MOON', lootAlloy: 0 });
    expect(await payloadOf(1, 'raided')).toMatchObject({ targetBody: 'MOON' });
  });

  it('ignores the world’s Tactical Retreat: the moon is the last stop (S55)', async () => {
    await f.db.update(planets).set({ defencePosture: 'ESCAPE' }).where(eq(planets.id, theirs));
    await fuelUp(f.db, theirs);
    await putOnMoon(theirs, 1, { PIKE: 3 });
    const { report } = await raid(theirs);
    expect(report!.fleetEscape).toBeNull();
    expect(report!.defenderLosses).toEqual({ PIKE: 3 });
  });

  it('costs a colony its loyalty and moves Dominion like a planet battle (S28)', async () => {
    // A planet this hard would not fall to the wing; the moon's two Darts do.
    await giveUnits(f.db, colony, { BASTION: 60, HARPOON: 60 });
    await putOnMoon(colony, 1, { DART: 2 });
    const { launch, report } = await raid(colony);
    expect(report!.grade).toBe('DECISIVE');
    const [world] = await f.db.select({ loyalty: planets.loyalty }).from(planets).where(eq(planets.id, colony));
    expect(world!.loyalty).toBe(70);
    const [dominion] = await f.db.select().from(dominionEvents).where(eq(dominionEvents.missionId, launch.missionId));
    expect(dominion?.eligible).toBe(true);
    expect(dominion!.transfer).toBeGreaterThan(0);
  });

  it('breaks no colony buildings, however heavy the defeat on the moon (V44)', async () => {
    await putOnMoon(colony, 1, { DART: 90 });
    const { report } = await raid(colony);
    expect(report!.grade).toBe('DECISIVE');
    expect(report!.recoveryShieldUntil, 'fixture: a loss heavy enough to earn the shield').not.toBeNull();
    expect(report!.colonyFaults).toEqual([]);
    expect(await f.db.select().from(planetFaults).where(eq(planetFaults.planetId, colony))).toEqual([]);
  });

  it('finds an empty moon: no fight, no score, no loyalty, the wing comes home whole, and the raid still counts (S31)', async () => {
    // A ship too broken to fight stands aside on the moon, as on the planet (V11).
    await putOnMoon(colony, 1, { PIKE: 1 });
    await f.db.update(units).set({ damage: [{ hull: 'PIKE', count: 1, damageBp: 9_800, remainderBp: 0 }] })
      .where(and(eq(units.planetId, colony), eq(units.location, MOON_LOCATION)));
    const { launch, report } = await raid(colony);

    expect(report).toMatchObject({ targetBody: 'MOON', rounds: [], defenderFleet: {}, dominionSwing: 0, dominionEligible: false });
    expect(await f.db.select().from(battleReplays).where(eq(battleReplays.battleReportId, report!.id))).toEqual([]);
    expect(await f.db.select().from(dominionEvents).where(eq(dominionEvents.missionId, launch.missionId))).toEqual([]);
    const [world] = await f.db.select({ loyalty: planets.loyalty, recoveryUntil: planets.recoveryUntil }).from(planets)
      .where(eq(planets.id, colony));
    expect(world).toEqual({ loyalty: 100, recoveryUntil: null });
    expect(await onBody(colony, MOON_LOCATION)).toEqual({ PIKE: 1 });
    const [home] = await f.db.select().from(missions).where(and(eq(missions.kind, 'return'), eq(missions.targetPlanetId, mine)));
    expect(home?.fleet).toEqual(HEAVY);
    expect(await payloadOf(0, 'raid_result')).toMatchObject({ targetBody: 'MOON', moonEmpty: true });
    expect(await payloadOf(1, 'raided')).toMatchObject({ targetBody: 'MOON', moonEmpty: true });

    // It arrived, so the twelve-hour personal cooldown against that commander runs as after any raid.
    f.clock.advance(60);
    await giveUnits(f.db, mine, { DART: 5 });
    await expect(launchAttack(f.db, mine, theirs, { DART: 5 }, f.clock)).rejects.toMatchObject({ code: 'PERSONAL_RAID_COOLDOWN' });
  });

  it('turns home untouched when the moon is gone before it lands', async () => {
    await putOnMoon(colony, 1, { DART: 2 });
    await giveUnits(f.db, mine, HEAVY);
    await fuelUp(f.db, mine);
    const launch = await launchAttack(f.db, mine, colony, HEAVY, f.clock, undefined, false, undefined, false, new Set(), false, 'MOON');
    await f.db.delete(moons).where(eq(moons.planetId, colony));
    f.clock.set(settledAt(launch.arriveAt));
    await worker().tick();
    expect(await f.db.select().from(battleReports).where(eq(battleReports.missionId, launch.missionId))).toEqual([]);
    const [home] = await f.db.select().from(missions).where(eq(missions.parentMissionId, launch.missionId));
    expect(home).toBeUndefined();
    const [back] = await f.db.select().from(missions).where(and(eq(missions.kind, 'return'), eq(missions.targetPlanetId, mine)));
    expect(back?.fleet).toEqual(HEAVY);
  });

  it('refuses a moon target that is not there to fight', async () => {
    await giveUnits(f.db, mine, { DART: 5 });
    await fuelUp(f.db, mine);
    const moonLaunch = (target: string) =>
      launchAttack(f.db, mine, target, { DART: 5 }, f.clock, undefined, false, undefined, false, new Set(), false, 'MOON');
    await f.db.delete(moons).where(eq(moons.planetId, colony));
    await expect(moonLaunch(colony)).rejects.toMatchObject({ code: 'NO_MOON' });
    await f.db.update(seasons).set({ rulesetVersion: MOON.rulesetVersion - 1 }).where(eq(seasons.id, f.seasonId));
    await expect(moonLaunch(theirs)).rejects.toMatchObject({ code: 'MOONS_DISABLED' });
  });

  it('closes only the moon once its battle is due: the moon fleet cannot hop away, the planet may still launch (K12 by body)', async () => {
    await putOnMoon(theirs, 1, { PIKE: 2 });
    await giveUnits(f.db, theirs, { DART: 5 });
    await fuelUp(f.db, theirs);
    await giveUnits(f.db, mine, HEAVY);
    await fuelUp(f.db, mine);
    const launch = await launchAttack(f.db, mine, theirs, HEAVY, f.clock, undefined, false, undefined, false, new Set(), false, 'MOON');
    f.clock.set(launch.arriveAt);
    await expect(hopFleet(f.db, f.playerIds[1]!, theirs, 'DOWN', { PIKE: 2 }, f.clock)).rejects.toMatchObject({ code: 'ARRIVAL_PENDING' });
    await expect(hopFleet(f.db, f.playerIds[1]!, theirs, 'UP', { DART: 2 }, f.clock)).resolves.toBeDefined();
  });
});
