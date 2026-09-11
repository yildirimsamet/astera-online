import { pino } from 'pino';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { and, eq } from 'drizzle-orm';
import {
  DEBRIS,
  HULLS,
  MULTI_WORLD,
  SALVAGE,
  SERVERS,
  fleetDiff,
  fleetEntries,
  piratePosition,
  sensorSphere,
  sensorZone,
  type Fleet,
  type PirateSpec,
  type Resources,
} from '@astera/rules';
import {
  battleReports,
  debrisFields,
  missions,
  neutralPlanetState,
  notifications,
  pirateRaids,
  planets,
  players,
  scheduledEvents,
  seasons,
  units,
} from '../src/db/schema.js';
import { abandon } from '../src/worker/abandon.js';
import { FixedClock } from '../src/clock.js';
import { buildUnits } from '../src/services/build.js';
import { launchAttack } from '../src/services/mission.js';
import { launchPirateRaid } from '../src/services/pirateRaid.js';
import { pirateId, privatePirateField } from '../src/services/pirateField.js';
import { joinSeason } from '../src/services/player.js';
import { readBattleReports } from '../src/services/reports.js';
import { createSeason } from '../src/services/season.js';
import { EventWorker } from '../src/worker/loop.js';
import {
  fuelUp,
  giveResearch,
  giveUnits,
  grant,
  levelWorld,
  makeAccount,
  seedWorld,
  setLevel,
  settledAt,
  testDb,
  truncateAll,
  type Fixture,
} from './helpers.js';

const silent = pino({ level: 'silent' });

afterAll(async () => {
  const { close } = await testDb();
  await close();
});

const total = (r: Resources): number => r.alloy + r.crystal + r.deuterium;

/**
 * The wreck a battle made, priced the way every lane prices it: `DEBRIS.share` of
 * the non-ground hulls that died. Recomputed here from the report's own loss lists
 * rather than copied from the server, so the two can never agree by accident.
 */
const wreckOf = (...losses: Fleet[]): Resources => {
  const out = { alloy: 0, crystal: 0, deuterium: 0 };
  for (const fleet of losses) {
    for (const [id, n] of fleetEntries(fleet)) {
      if (HULLS[id].ground) continue;
      out.alloy += n * HULLS[id].alloy * DEBRIS.share;
      out.crystal += n * HULLS[id].crystal * DEBRIS.share;
      out.deuterium += n * HULLS[id].deuterium * DEBRIS.share;
    }
  }
  return out;
};

/** What a collector room of `room` takes from `wreck`: proportional, floored per column. */
const liftFrom = (wreck: Resources, room: number): Resources => {
  const all = total(wreck);
  const factor = all <= 0 ? 0 : Math.min(1, room / all);
  return {
    alloy: Math.floor(wreck.alloy * factor),
    crystal: Math.floor(wreck.crystal * factor),
    deuterium: Math.floor(wreck.deuterium * factor),
  };
};

/** Within one unit per column: the server floors its own float, this floors ours. */
const expectLifted = (actual: Resources | null | undefined, expected: Resources): void => {
  expect(actual).toBeDefined();
  expect(actual).not.toBeNull();
  for (const k of ['alloy', 'crystal', 'deuterium'] as const) {
    expect(Math.abs(actual![k] - expected[k]), k).toBeLessThanOrEqual(1);
    expect(Number.isInteger(actual![k]), k).toBe(true);
  }
};

const ZERO: Resources = { alloy: 0, crystal: 0, deuterium: 0 };

/**
 * THE GARBAGE COLLECTOR, ON EVERY LANE A BATTLE HAPPENS ON. D200.
 *
 * Owner instruction: every collector that SURVIVES lifts up to `SALVAGE.perCollector`
 * of its own battle's wreck, in the wreck's proportions, at the moment the battle
 * resolves; the rest is the ordinary public field. It is Wealth and never Dominion,
 * it lands in storage with the fleet, and it is the attacker's alone.
 */
describe('a Garbage Collector in a raid on a commander', () => {
  let f: Fixture;
  let mine: string;
  let theirs: string;

  const worker = () =>
    new EventWorker(f.db, f.clock, { pollMs: 1000, batch: 100, staleMinutes: 5 }, silent);

  beforeEach(async () => {
    f = await seedWorld(2);
    [mine, theirs] = f.planetIds as [string, string];
    for (const id of f.planetIds) {
      await setLevel(f.db, id, 'CORE', 8);
      await setLevel(f.db, id, 'SHIPYARD', 4);
    }
    f.clock.advance(250);
  });

  /**
   * A fight whose wreck is bigger than one collector's room. 150 Darts standing is
   * 54,000 of flying value on the defending side alone, so the field the battle
   * makes clears 15k before the attacker loses anything.
   */
  const fight = async (wing: Fleet, garrison: Fleet = { DART: 150 }) => {
    await grant(f.db, theirs, 40_000, 8_000);
    await giveUnits(f.db, theirs, garrison);
    await giveUnits(f.db, mine, wing);
    await fuelUp(f.db, mine);
    await levelWorld(f.db, f.planetIds);
    const launch = await launchAttack(f.db, mine, theirs, wing, f.clock);
    f.clock.set(settledAt(launch.arriveAt));
    await worker().tick();
    const [report] = await f.db.select().from(battleReports)
      .where(eq(battleReports.missionId, launch.missionId));
    if (!report) throw new Error('the fixture fight wrote no report');
    const [ret] = await f.db.select().from(missions).where(and(
      eq(missions.kind, 'return'),
      eq(missions.parentMissionId, launch.missionId),
    ));
    return { launch, report, ret };
  };

  it('lifts its share of the wreck in the wreck’s proportions, and leaves the rest in orbit', async () => {
    const { report, ret } = await fight({ DART: 400, GARBAGE_COLLECTOR: 1 });

    // It flew behind the line, so it is still there to collect.
    expect(report.attackerLosses.GARBAGE_COLLECTOR).toBeUndefined();
    const wreck = wreckOf(report.attackerLosses, report.defenderLosses);
    expect(total(wreck), 'fixture wreck must exceed one collector').toBeGreaterThan(SALVAGE.perCollector);

    const lifted = liftFrom(wreck, SALVAGE.perCollector);
    expectLifted(report.salvage, lifted);
    expect(total(report.salvage)).toBeLessThanOrEqual(SALVAGE.perCollector);

    const [field] = await f.db.select().from(debrisFields);
    expect(field, 'what the collector left should still be a field').toBeDefined();
    expect(field!.alloy).toBeCloseTo(wreck.alloy - report.salvage.alloy, 2);
    expect(field!.crystal).toBeCloseTo(wreck.crystal - report.salvage.crystal, 2);
    expect(field!.deuterium).toBeCloseTo(wreck.deuterium - report.salvage.deuterium, 2);
    // The report's wreck line is what was LEFT in orbit — the field anyone can race for.
    expect(report.wreckValue).toBeCloseTo(field!.alloy + field!.crystal + field!.deuterium, 0);

    // It rides home with the survivors, apart from the loot it is not.
    expect(ret).toBeDefined();
    expect(ret!.salvage).toEqual(report.salvage);
    expect(ret!.loot).toEqual(report.loot);
  });

  it('brings the salvage home into storage and moves the ladder by the loot alone', async () => {
    const { report, ret } = await fight({ DART: 400, GARBAGE_COLLECTOR: 1 });
    expect(ret).toBeDefined();
    expect(total(report.salvage)).toBeGreaterThan(0);

    // D2: wreckage is Wealth, never Dominion — the exchange priced the loot and nothing else.
    expect(report.dominionLootValue).toBe(total(report.loot));
    const [attacker] = await f.db.select().from(players).where(eq(players.id, f.playerIds[0]!));
    expect(attacker!.dominionTaken - attacker!.dominionLost).toBe(report.dominionSwing);

    const [before] = await f.db.select().from(planets).where(eq(planets.id, mine));
    f.clock.set(ret!.arriveAt);
    await worker().tick();
    const [after] = await f.db.select().from(planets).where(eq(planets.id, mine));
    expect(after!.alloy - before!.alloy).toBeCloseTo(report.loot.alloy + report.salvage.alloy, 3);
    expect(after!.crystal - before!.crystal).toBeCloseTo(report.loot.crystal + report.salvage.crystal, 3);
    expect(after!.deuterium - before!.deuterium)
      .toBeCloseTo(report.loot.deuterium + report.salvage.deuterium, 3);

    // And the collector is home again, ready for the next fight.
    const [home] = await f.db.select().from(units).where(and(
      eq(units.planetId, mine), eq(units.location, 'home'), eq(units.hull, 'GARBAGE_COLLECTOR'),
    ));
    expect(home?.count).toBe(1);

    const [landed] = await f.db.select().from(notifications).where(and(
      eq(notifications.playerId, f.playerIds[0]!), eq(notifications.kind, 'fleet_returned'),
    ));
    expect(landed?.payload).toMatchObject({
      trip: 'raid',
      salvageAlloy: report.salvage.alloy,
      salvageCrystal: report.salvage.crystal,
      salvageDeuterium: report.salvage.deuterium,
    });
  });

  /**
   * A LEG THE SERVER GIVES UP ON IS STILL A SAFE LANDING. `abandon()` already lands
   * a return leg's loot rather than deleting half of a recorded exchange, and the
   * salvage rides the same leg — it must not be the one thing a broken handler eats.
   */
  it('lands the salvage even when the server gives up on the leg home', async () => {
    const { report, ret } = await fight({ DART: 400, GARBAGE_COLLECTOR: 1 });
    expect(total(report.salvage)).toBeGreaterThan(0);
    const [event] = await f.db.select().from(scheduledEvents)
      .where(eq(scheduledEvents.refId, ret!.id));
    expect(event).toBeDefined();
    const [before] = await f.db.select().from(planets).where(eq(planets.id, mine));
    expect(await abandon(f.db, event!, f.clock)).toBe(true);
    const [after] = await f.db.select().from(planets).where(eq(planets.id, mine));
    expect(after!.alloy - before!.alloy).toBeCloseTo(report.loot.alloy + report.salvage.alloy, 3);
    expect(after!.crystal - before!.crystal).toBeCloseTo(report.loot.crystal + report.salvage.crystal, 3);
  });

  /**
   * WEALTH IS EVERYTHING A COMMANDER OWNS, AND THAT INCLUDES WHAT IS IN THE AIR.
   * `recomputePlayerWealth` already counts a return leg's loot while it flies; the
   * salvage riding beside it is owned just as surely, so landing it must move
   * nothing — a figure that jumped at the dock would be counting it for the first time.
   */
  it('counts the salvage as the commander’s wealth while it is still flying home', async () => {
    const { report, ret } = await fight({ DART: 400, GARBAGE_COLLECTOR: 1 });
    expect(total(report.salvage)).toBeGreaterThan(0);
    const [flying] = await f.db.select({ wealth: players.wealth }).from(players)
      .where(eq(players.id, f.playerIds[0]!));
    f.clock.set(ret!.arriveAt);
    await worker().tick();
    const [landed] = await f.db.select({ wealth: players.wealth }).from(players)
      .where(eq(players.id, f.playerIds[0]!));
    expect(landed!.wealth).toBe(flying!.wealth);
  });

  it('tells the attacker at the fight what the collectors lifted', async () => {
    const { report } = await fight({ DART: 400, GARBAGE_COLLECTOR: 1 });
    const [result] = await f.db.select().from(notifications).where(and(
      eq(notifications.playerId, f.playerIds[0]!), eq(notifications.kind, 'raid_result'),
    ));
    expect(result?.payload).toMatchObject({
      salvageAlloy: report.salvage.alloy,
      salvageCrystal: report.salvage.crystal,
      salvageDeuterium: report.salvage.deuterium,
    });
  });

  it('lifts in proportion to how many came home, never beyond the wreck', async () => {
    const { report } = await fight({ DART: 400, GARBAGE_COLLECTOR: 3 });
    const survivors = 3 - (report.attackerLosses.GARBAGE_COLLECTOR ?? 0);
    expect(survivors).toBe(3);
    const wreck = wreckOf(report.attackerLosses, report.defenderLosses);
    expectLifted(report.salvage, liftFrom(wreck, survivors * SALVAGE.perCollector));
    expect(total(report.salvage)).toBeLessThanOrEqual(total(wreck));
  });

  it('lifts nothing when it dies in the fight, and its own hull joins the wreck', async () => {
    const { report, ret } = await fight({ DART: 1, GARBAGE_COLLECTOR: 1 });
    expect(report.attackerLosses.GARBAGE_COLLECTOR).toBe(1);
    expect(report.salvage).toEqual(ZERO);
    expect(ret).toBeUndefined();

    const wreck = wreckOf(report.attackerLosses, report.defenderLosses);
    const [field] = await f.db.select().from(debrisFields);
    expect(field).toBeDefined();
    expect(field!.alloy + field!.crystal + field!.deuterium).toBeCloseTo(total(wreck), 2);
  });

  it('leaves a wing with no collector exactly as it always resolved', async () => {
    const { report, ret } = await fight({ DART: 400 });
    expect(report.salvage).toEqual(ZERO);
    expect(ret!.salvage ?? ZERO).toEqual(ZERO);
    const wreck = wreckOf(report.attackerLosses, report.defenderLosses);
    const [field] = await f.db.select().from(debrisFields);
    expect(field!.alloy + field!.crystal + field!.deuterium).toBeCloseTo(total(wreck), 2);
    expect(report.wreckValue).toBeCloseTo(total(wreck), 0);
  });

  it('shows both sides of the fight what was lifted from over the defender’s world', async () => {
    const { report } = await fight({ DART: 400, GARBAGE_COLLECTOR: 1 });
    expect(total(report.salvage)).toBeGreaterThan(0);
    const [attacking] = (await readBattleReports(f.db, f.playerIds[0]!)).reports;
    const [defending] = (await readBattleReports(f.db, f.playerIds[1]!)).reports;
    if (attacking?.kind !== 'BATTLE' || defending?.kind !== 'BATTLE') {
      throw new Error('expected two battle reports');
    }
    expect(attacking.salvage).toEqual(report.salvage);
    expect(defending.salvage).toEqual(report.salvage);
  });

  /**
   * AT HOME IT IS A HULL IN THE LINE, AND IT CAN DIE THERE. Owner instruction:
   * *"garbage collector'un da canı olacak. Normal yük gemileri nasıl ölebiliyorsa
   * bu da ölebilecek."* Standing at home it is exactly a transport — covered while a
   * combat hull on its side lives, sunk once they are gone — and it lifts nothing:
   * collecting is what an ATTACKING wing does on its way home.
   */
  it('dies at home like a transport once the line in front of it falls, and never collects there', async () => {
    const { report } = await fight({ DART: 400 }, { DART: 40, GARBAGE_COLLECTOR: 2 });
    expect(report.defenderFleet.GARBAGE_COLLECTOR).toBe(2);
    expect(report.defenderLosses.DART).toBe(40);
    expect(report.defenderLosses.GARBAGE_COLLECTOR).toBe(2);
    // Its own hull is wreck like any other that died, and nobody lifted any of it.
    expect(report.salvage).toEqual(ZERO);
    const wreck = wreckOf(report.attackerLosses, report.defenderLosses);
    const [field] = await f.db.select().from(debrisFields);
    expect(field!.alloy + field!.crystal + field!.deuterium).toBeCloseTo(total(wreck), 2);
  });

  it('survives at home, like a transport, while the line in front of it holds', async () => {
    const { report } = await fight({ DART: 10 }, { DART: 150, GARBAGE_COLLECTOR: 1 });
    expect(report.grade).toBe('REPELLED');
    expect(report.defenderLosses.GARBAGE_COLLECTOR).toBeUndefined();
    const [home] = await f.db.select().from(units).where(and(
      eq(units.planetId, theirs), eq(units.location, 'home'), eq(units.hull, 'GARBAGE_COLLECTOR'),
    ));
    expect(home?.count).toBe(1);
    // The defender's collector took nothing from the raiders' dead.
    expect(report.salvage).toEqual(ZERO);
  });

  it('cannot fly an attack on its own', async () => {
    await giveUnits(f.db, mine, { GARBAGE_COLLECTOR: 2 });
    await fuelUp(f.db, mine);
    await expect(launchAttack(f.db, mine, theirs, { GARBAGE_COLLECTOR: 2 }, f.clock))
      .rejects.toMatchObject({ code: 'NOT_A_WARSHIP' });
  });

  it('is built behind Shipyard 4 and Starship Engineering 1, at the owner’s price', async () => {
    await grant(f.db, mine, 60_000, 30_000);
    await setLevel(f.db, mine, 'SHIPYARD', 3);
    await expect(buildUnits(f.db, mine, 'GARBAGE_COLLECTOR', 1, f.clock))
      .rejects.toMatchObject({ code: 'SHIPYARD_TOO_LOW' });
    await setLevel(f.db, mine, 'SHIPYARD', 4);
    await expect(buildUnits(f.db, mine, 'GARBAGE_COLLECTOR', 1, f.clock))
      .rejects.toMatchObject({ code: 'NEEDS_HULL_RESEARCH' });
    await giveResearch(f.db, mine, 'STARSHIP_ENGINEERING', 1);
    const [before] = await f.db.select().from(planets).where(eq(planets.id, mine));
    const built = await buildUnits(f.db, mine, 'GARBAGE_COLLECTOR', 1, f.clock);
    expect(built.built).toBe(1);
    const [after] = await f.db.select().from(planets).where(eq(planets.id, mine));
    expect(before!.alloy - after!.alloy).toBeCloseTo(10_000, 0);
    expect(before!.crystal - after!.crystal).toBeCloseTo(5_000, 0);
  });
});

describe('a Garbage Collector in a raid on a caretaker world', () => {
  it('lifts from the attacker’s own wreck, the only wreck a caretaker fight leaves', async () => {
    const { db } = await testDb();
    await truncateAll(db);
    const clock = new FixedClock(new Date('2026-08-01T00:00:00.000Z'));
    const { season } = await createSeason(db, {
      shardCode: 'EU-GC',
      seed: 91273,
      startsAt: clock.now(),
      playerCap: SERVERS.capacity,
      rulesetVersion: MULTI_WORLD.rulesetVersion,
    });
    const account = await makeAccount(db, 'Scavenger');
    const joined = await joinSeason(db, account.id, season.id, clock);
    const [target] = await db.select({ id: planets.id }).from(planets)
      .innerJoin(neutralPlanetState, eq(neutralPlanetState.planetId, planets.id))
      .where(eq(neutralPlanetState.tier, 2));
    if (!target) throw new Error('no tier-two caretaker world');
    await db.update(planets).set({ x: 150, y: 0, z: 0 }).where(eq(planets.id, target.id));
    await db.update(planets).set({ x: 0, y: 0, z: 0 }).where(eq(planets.id, joined.planetId));
    await db.delete(units).where(eq(units.planetId, target.id));
    await db.insert(units).values({
      planetId: target.id, ownerPlayerId: null, hull: 'DART', location: 'home', count: 60,
    });
    await setLevel(db, joined.planetId, 'CORE', 5);
    const wing: Fleet = { DART: 300, GARBAGE_COLLECTOR: 1 };
    await giveUnits(db, joined.planetId, wing);
    await fuelUp(db, joined.planetId);

    const launch = await launchAttack(db, joined.planetId, target.id, wing, clock);
    clock.set(settledAt(launch.arriveAt));
    await new EventWorker(db, clock, { pollMs: 1, batch: 100, staleMinutes: 5 }, silent).tick();

    const [report] = await db.select().from(battleReports)
      .where(eq(battleReports.missionId, launch.missionId));
    expect(report?.targetKind).toBe('NEUTRAL');
    expect(report!.attackerLosses.GARBAGE_COLLECTOR).toBeUndefined();
    // A caretaker's hulls leave nothing; only the raider's own dead are wreck.
    const wreck = wreckOf(report!.attackerLosses);
    expect(total(wreck), 'the raid must lose something for there to be a wreck').toBeGreaterThan(0);
    expectLifted(report!.salvage, liftFrom(wreck, SALVAGE.perCollector));

    const [ret] = await db.select().from(missions).where(and(
      eq(missions.kind, 'return'), eq(missions.ownerPlayerId, joined.playerId),
    ));
    expect(ret?.salvage).toEqual(report!.salvage);

    const left = total(wreck) - total(report!.salvage);
    const fields = await db.select().from(debrisFields);
    if (left >= DEBRIS.minimum) {
      expect(fields).toHaveLength(1);
      expect(report!.wreckValue).toBeCloseTo(left, 0);
    } else {
      expect(fields).toHaveLength(0);
      expect(report!.wreckValue).toBe(0);
    }
  });
});

describe('a Garbage Collector in a raid on a pirate', () => {
  let f: Fixture;
  let mine: string;

  const worker = () =>
    new EventWorker(f.db, f.clock, { pollMs: 50, batch: 50, staleMinutes: 5 }, silent);

  const findVisible = async (): Promise<{ spec: PirateSpec; id: string }> => {
    const [season] = await f.db.select().from(seasons).where(eq(seasons.id, f.seasonId));
    const key = season!.asteroidKey;
    const [world] = await f.db.select().from(planets).where(eq(planets.id, mine));
    const eye = sensorSphere({ x: world!.x, y: world!.y, z: world!.z }, 0, 0, mine);
    for (const spec of privatePirateField(key)) {
      for (let minute = Math.ceil(spec.appearsAt) + 1; minute < spec.expiresAt; minute += 1) {
        if (sensorZone([eye], piratePosition(spec, minute)) === 'NONE') continue;
        f.clock.set(new Date(season!.startsAt.getTime() + minute * 60_000));
        return { spec, id: pirateId(key, spec.index) };
      }
    }
    throw new Error('no visible pirate this season');
  };

  beforeEach(async () => {
    f = await seedWorld(2, 4242, { pirates: true });
    mine = f.planetIds[0]!;
  });

  it('lifts its share of the void wreck and brings it home into storage', async () => {
    const target = await findVisible();
    await grant(f.db, mine, 500_000, 100_000);
    const wing: Fleet = { DART: 250, COURIER: 6, GARBAGE_COLLECTOR: 1 };
    await giveUnits(f.db, mine, wing);
    const launch = await launchPirateRaid(f.db, mine, target.id, wing, f.clock);

    f.clock.set(settledAt(launch.arriveAt));
    await worker().tick();

    const [report] = await f.db.select().from(battleReports)
      .where(eq(battleReports.pirateRaidId, launch.raidId));
    expect(report).toBeDefined();
    expect(report!.attackerLosses.GARBAGE_COLLECTOR).toBeUndefined();
    const wreck = wreckOf(report!.attackerLosses, report!.defenderLosses);
    expectLifted(report!.salvage, liftFrom(wreck, SALVAGE.perCollector));

    const [raid] = await f.db.select().from(pirateRaids).where(eq(pirateRaids.id, launch.raidId));
    expect(raid!.salvage).toEqual(report!.salvage);

    const [result] = await f.db.select().from(notifications).where(and(
      eq(notifications.playerId, f.playerIds[0]!), eq(notifications.kind, 'raid_result'),
    ));
    expect(result?.payload).toMatchObject({
      targetKind: 'PIRATE',
      salvageAlloy: report!.salvage.alloy,
      salvageCrystal: report!.salvage.crystal,
      salvageDeuterium: report!.salvage.deuterium,
    });

    const [before] = await f.db.select().from(planets).where(eq(planets.id, mine));
    f.clock.set(new Date(raid!.homeAt!.getTime() + 1000));
    await worker().tick();
    const [after] = await f.db.select().from(planets).where(eq(planets.id, mine));
    const loot = raid!.loot ?? ZERO;
    expect(after!.alloy - before!.alloy).toBeCloseTo(loot.alloy + report!.salvage.alloy, 3);
    expect(after!.crystal - before!.crystal).toBeCloseTo(loot.crystal + report!.salvage.crystal, 3);

    const [landed] = await f.db.select().from(notifications).where(and(
      eq(notifications.playerId, f.playerIds[0]!), eq(notifications.kind, 'fleet_returned'),
    ));
    expect(landed?.payload).toMatchObject({
      trip: 'pirate',
      salvageAlloy: report!.salvage.alloy,
      salvageCrystal: report!.salvage.crystal,
      salvageDeuterium: report!.salvage.deuterium,
    });

    // The survivors, collector included, are home.
    const home = await f.db.select().from(units).where(and(
      eq(units.planetId, mine), eq(units.location, 'home'), eq(units.hull, 'GARBAGE_COLLECTOR'),
    ));
    expect(home[0]?.count).toBe(1);
    expect(fleetDiff(wing, report!.attackerLosses).GARBAGE_COLLECTOR).toBe(1);
  });
});
