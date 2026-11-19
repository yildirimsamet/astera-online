import { and, eq } from 'drizzle-orm';
import { pino } from 'pino';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { ABUSE, MOON, fleetEntries, type Fleet } from '@astera/rules';
import { missions, moons, planets, seasons, units } from '../src/db/schema.js';
import { launchAttack } from '../src/services/mission.js';
import { launchTransfer } from '../src/services/movement.js';
import { MOON_LOCATION, PLANET_LOCATION } from '../src/services/unitLocation.js';
import { EventWorker } from '../src/worker/loop.js';
import { fuelUp, giveUnits, grant, levelWorld, seedWorld, setLevel, settledAt, testDb, type Fixture } from './helpers.js';

/*
  F3c (S34, S49, S50, S52, V6, V9; plan §6.7): raids and transfers may leave from the moon, paying fuel
  from the planet's tank and using the world's flight bays. A fleet comes home to the body it left;
  when the moon is gone or its dock is full it lands on the planet. A transfer may land on the moon,
  and the world's five-minute unloading pause covers both bodies.
*/
const silent = pino({ level: 'silent' });

describe('leaving from and landing on the moon', () => {
  let f: Fixture;
  let mine: string;
  let theirs: string;
  let colony: string;
  let owner: string;

  const worker = () => new EventWorker(f.db, f.clock, { pollMs: 1000, batch: 100, staleMinutes: 5 }, silent);
  const onBody = async (planetId: string, location: string) => Object.fromEntries((await f.db.select().from(units)
    .where(and(eq(units.planetId, planetId), eq(units.location, location)))).filter((row) => row.count > 0)
    .map((row) => [row.hull, row.count]));
  const putOnMoon = async (planetId: string, fleet: Fleet) => {
    for (const [hull, count] of fleetEntries(fleet)) {
      await f.db.insert(units).values({ planetId, ownerPlayerId: owner, hull, location: MOON_LOCATION, count })
        .onConflictDoUpdate({ target: [units.planetId, units.hull, units.location], set: { count } });
    }
  };
  const deuterium = async (planetId: string) =>
    (await f.db.select({ d: planets.deuterium }).from(planets).where(eq(planets.id, planetId)))[0]!.d;
  /** Run the queue up to a flight's landing. */
  const landAt = async (at: Date) => { f.clock.set(settledAt(at)); await worker().tick(); };
  const raidFromMoon = (fleet: Fleet, target = theirs) =>
    launchAttack(f.db, mine, target, fleet, f.clock, undefined, false, undefined, false, new Set(), false, 'PLANET', 'MOON');

  beforeEach(async () => {
    f = await seedWorld(3, 20_110);
    [mine, theirs, colony] = f.planetIds as [string, string, string];
    owner = f.playerIds[0]!;
    await f.db.update(seasons).set({ rulesetVersion: MOON.rulesetVersion }).where(eq(seasons.id, f.seasonId));
    for (const id of f.planetIds) {
      await setLevel(f.db, id, 'CORE', 8);
      await setLevel(f.db, id, 'SHIPYARD', 4);
    }
    await f.db.update(planets).set({
      controllerPlayerId: owner, kind: 'COLONY', statsOwnerPlayerId: owner,
      seasonTelemetry: { produced: { alloy: 0, crystal: 0, deuterium: 0 }, productiveSeconds: 0, shipsBuilt: {} },
    }).where(eq(planets.id, colony));
    await f.db.insert(moons).values({ planetId: mine, rarity: 'COMMON', origin: 'BUILT', visualSeed: 5, bornAt: f.clock.now() });
    await levelWorld(f.db, f.planetIds);
    // Room in the world's Hangar, so the dock is the only limit these tests meet.
    for (const id of [mine, colony]) await setLevel(f.db, id, 'HANGAR', 10);
    f.clock.advance(250);
    await fuelUp(f.db, mine);
    await fuelUp(f.db, colony);
  });
  afterAll(async () => { const { close } = await testDb(); await close(); });

  it('raids from the moon: the moon’s ships go, the planet pays the fuel, and the survivors come home to the moon', async () => {
    await giveUnits(f.db, mine, { DART: 5 });
    await putOnMoon(mine, { DART: 20 });
    await grant(f.db, theirs, 30_000, 10_000);
    const tank = await deuterium(mine);
    const launch = await raidFromMoon({ DART: 20 });

    expect(await onBody(mine, MOON_LOCATION)).toEqual({});
    expect(await onBody(mine, PLANET_LOCATION)).toEqual({ DART: 5 });
    expect(await deuterium(mine)).toBeLessThan(tank);
    const [outbound] = await f.db.select().from(missions).where(eq(missions.id, launch.missionId));
    expect(outbound?.originBody).toBe('MOON');

    await landAt(launch.arriveAt);
    const [home] = await f.db.select().from(missions).where(eq(missions.parentMissionId, launch.missionId));
    expect(home?.targetBody).toBe('MOON');
    const storeBefore = (await f.db.select({ alloy: planets.alloy }).from(planets).where(eq(planets.id, mine)))[0]!.alloy;
    await landAt(home!.arriveAt);
    expect(await onBody(mine, MOON_LOCATION)).toEqual({ DART: 20 });
    expect(await onBody(mine, PLANET_LOCATION)).toEqual({ DART: 5 });
    // The loot is the planet's: a moon has no stores.
    const storeAfter = (await f.db.select({ alloy: planets.alloy }).from(planets).where(eq(planets.id, mine)))[0]!.alloy;
    expect(storeAfter).toBeGreaterThan(storeBefore);
  });

  it('comes down on the planet when the moon is gone or its dock has filled', async () => {
    await putOnMoon(mine, { DART: 20 });
    const first = await raidFromMoon({ DART: 20 });
    await landAt(first.arriveAt);
    const [back] = await f.db.select().from(missions).where(eq(missions.parentMissionId, first.missionId));
    // The dock filled while the wing was away (150 Pikes: 450 of a Common moon's 470).
    await putOnMoon(mine, { PIKE: 150 });
    await landAt(back!.arriveAt);
    expect(await onBody(mine, PLANET_LOCATION)).toMatchObject({ DART: 20 });

    await f.db.delete(units).where(and(eq(units.planetId, mine), eq(units.location, MOON_LOCATION)));
    await putOnMoon(mine, { DART: 10 });
    f.clock.advance(ABUSE.personalRaidCooldownMinutes + 60);
    const second = await raidFromMoon({ DART: 10 });
    await landAt(second.arriveAt);
    const [again] = await f.db.select().from(missions).where(eq(missions.parentMissionId, second.missionId));
    await f.db.delete(moons).where(eq(moons.planetId, mine));
    await landAt(again!.arriveAt);
    expect((await onBody(mine, PLANET_LOCATION)).DART).toBe(30);
  });

  it('refuses ships the moon does not hold, and a moon that is not there', async () => {
    await giveUnits(f.db, mine, { DART: 30 });
    await putOnMoon(mine, { DART: 3 });
    await expect(raidFromMoon({ DART: 4 })).rejects.toMatchObject({ code: 'NOT_ENOUGH_SHIPS' });
    await f.db.delete(moons).where(eq(moons.planetId, mine));
    await expect(raidFromMoon({ DART: 3 })).rejects.toMatchObject({ code: 'NO_MOON' });
  });

  it('transfers onto the moon with dock room, falls back to the planet when the dock filled, and pauses the whole world (S50, S52)', async () => {
    await giveUnits(f.db, colony, { DART: 40, PIKE: 200 });
    const toMoon = (fleet: Fleet) => launchTransfer(f.db, owner, colony, mine, fleet, { alloy: 0, crystal: 0, deuterium: 0 }, f.clock,
      undefined, undefined, false, 'MOON');
    await expect(toMoon({ PIKE: 200 })).rejects.toMatchObject({ code: 'DOCK_FULL' });

    const transfer = await toMoon({ DART: 20 });
    await landAt(transfer.arriveAt);
    expect(await onBody(mine, MOON_LOCATION)).toEqual({ DART: 20 });
    // The world unloads for five minutes, whichever body the squadron came down on.
    await expect(launchTransfer(f.db, owner, mine, colony, { DART: 5 }, { alloy: 0, crystal: 0, deuterium: 0 }, f.clock,
      undefined, undefined, false, 'PLANET', 'MOON')).rejects.toMatchObject({ code: 'TRANSFER_COOLDOWN' });

    const second = await toMoon({ DART: 20 });
    await putOnMoon(mine, { DART: 20, PIKE: 140 });
    await landAt(second.arriveAt);
    expect((await onBody(mine, PLANET_LOCATION)).DART).toBe(20);

    f.clock.advance(10);
    const fromMoon = await launchTransfer(f.db, owner, mine, colony, { DART: 5 }, { alloy: 0, crystal: 0, deuterium: 0 }, f.clock,
      undefined, undefined, false, 'PLANET', 'MOON');
    expect((await onBody(mine, MOON_LOCATION)).DART).toBe(15);
    await landAt(fromMoon.arriveAt);
    // The colony sent both its twenties to the moon; the five come back to its planet.
    expect((await onBody(colony, PLANET_LOCATION)).DART).toBe(5);
  });
});
