import { pino } from 'pino';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { and, eq } from 'drizzle-orm';
import {
  DEBRIS,
  HULLS,
  fleetCount,
  gradeMultiplier,
  fleetEntries,
  flightSlots,
  pirateActive,
  piratePosition,
  sensorSphere,
  sensorZone,
  type Fleet,
  type PirateSpec,
} from '@astera/rules';
import {
  battleReports,
  buildings,
  debrisFields,
  notifications,
  pirateRaids,
  pirateState,
  planets,
  players,
  seasons,
  units,
} from '../src/db/schema.js';
import { launchPirateRaid } from '../src/services/pirateRaid.js';
import { privatePirateField, pirateId } from '../src/services/pirateField.js';
import { baysInUse } from '../src/services/flight.js';
import { fleetTruthFor } from '../src/services/intel.js';
import { EventWorker } from '../src/worker/loop.js';
import {
  giveUnits,
  grant,
  seedWorld,
  settledAt,
  testDb,
  type Fixture,
} from './helpers.js';

const silent = pino({ level: 'silent' });

/** Resource value of the hulls that were flying, which is what wreckage is priced on. */
const flying = (fleet: Fleet): number =>
  fleetEntries(fleet)
    .filter(([id]) => !HULLS[id].ground)
    .reduce((sum, [id, n]) => sum + n * (HULLS[id].alloy + HULLS[id].crystal + HULLS[id].deuterium), 0);

/**
 * RAIDING A PIRATE — D150.
 *
 * The third target class, and the first that moves. Every refusal below is a rule
 * the player is supposed to be able to read BEFORE committing a fleet, and every
 * payout is a promise the launch screen makes. What this file is really guarding
 * is that a PvE raid costs exactly what a PvP raid costs — a bay, both legs of
 * fuel, an undefended world for the whole trip — because the day it is cheaper is
 * the day people stop raiding each other.
 */
afterAll(async () => {
  const { close } = await testDb();
  await close();
});

interface Target {
  spec: PirateSpec;
  id: string;
  key: string;
}

describe('a raid at a pirate', () => {
  let f: Fixture;
  let mine: string;

  /**
   * Find a pirate this world can actually see, and move the clock to it.
   *
   * The lane is derived, so a test cannot invent one — it has to go looking, the
   * same way a player does. `sensorZone` is the one authority on whether the world
   * can see it, which is exactly the gate the launch applies.
   */
  const findVisible = async (skip: ReadonlySet<number> = new Set()): Promise<Target> => {
    const [season] = await f.db.select().from(seasons).where(eq(seasons.id, f.seasonId));
    const key = season!.asteroidKey;
    const field = privatePirateField(key);
    const [world] = await f.db.select().from(planets).where(eq(planets.id, mine));
    const eye = sensorSphere({ x: world!.x, y: world!.y, z: world!.z }, 0, 0, mine);

    /*
      Walk each pirate's own life rather than the whole season minute by minute.
      A world at the centre of the disc sees only the inner slice of the orbit
      band, so a visible target is genuinely uncommon — which is the feature
      working, and the reason this looks rather than assumes.
    */
    for (const spec of field) {
      if (skip.has(spec.index)) continue;
      const first = Math.ceil(spec.appearsAt) + 1;
      for (let minute = first; minute < spec.expiresAt; minute += 1) {
        if (sensorZone([eye], piratePosition(spec, minute)) === 'NONE') continue;
        f.clock.set(new Date(season!.startsAt.getTime() + minute * 60_000));
        return { spec, id: pirateId(key, spec.index), key };
      }
    }
    throw new Error('no visible pirate this season — the lane is too thin to test');
  };

  const armed = async (fleet: Fleet = { DART: 30, COURIER: 2 }): Promise<Fleet> => {
    await grant(f.db, mine, 200_000, 40_000);
    await giveUnits(f.db, mine, fleet);
    return fleet;
  };

  beforeEach(async () => {
    f = await seedWorld(2, 4242, { pirates: true });
    mine = f.planetIds[0]!;
  });

  it('takes a flight bay, both legs of fuel, and leaves the world reading AWAY', async () => {
    const target = await findVisible();
    const fleet = await armed();
    const [before] = await f.db.select().from(planets).where(eq(planets.id, mine));

    const launch = await launchPirateRaid(f.db, mine, target.id, fleet, f.clock);

    expect(launch.arriveAt.getTime()).toBeGreaterThan(f.clock.now().getTime());
    expect(launch.fuel).toBeGreaterThan(0);
    expect(await baysInUse(f.db, mine)).toBe(1);

    const [after] = await f.db.select().from(planets).where(eq(planets.id, mine));
    expect(after!.deuterium).toBeCloseTo(before!.deuterium - launch.fuel, 5);

    /*
      THE WORLD IS UNDEFENDED AND SAYS SO. This is a raid, not a mining run: the
      single most valuable fact in the game has to be true about it, and it is —
      the fleet sits under a non-home `units.location`, which is the only thing
      `fleetTruthFor` reads.
    */
    const truth = await fleetTruthFor(f.db, [mine], f.clock.now());
    expect(truth.get(mine)?.status).toBe('AWAY');

    // The rendezvous is a point in empty space, not a world.
    const worlds = await f.db.select().from(planets);
    for (const world of worlds) {
      expect(Math.hypot(
        world.x - launch.intercept.x,
        world.y - launch.intercept.y,
        world.z - launch.intercept.z,
      )).toBeGreaterThan(1);
    }
  });

  it('refuses a pirate outside the world\'s own sensors', async () => {
    /*
      LIVE SIGHT, NEVER MEMORY. A rock is remembered once found (D143); a pirate is
      a craft and stops existing for you the moment it leaves your circles (D123).
      Aiming at a remembered one would turn a sensor upgrade into a permanent
      address book, which is the opposite of what the instrument sells.
    */
    const [season] = await f.db.select().from(seasons).where(eq(seasons.id, f.seasonId));
    const field = privatePirateField(season!.asteroidKey);
    const [world] = await f.db.select().from(planets).where(eq(planets.id, mine));
    const eye = sensorSphere({ x: world!.x, y: world!.y, z: world!.z }, 0, 0, mine);

    let hidden: PirateSpec | undefined;
    for (let minute = 30; minute < 60 * 24 && !hidden; minute += 1) {
      for (const spec of field) {
        if (!pirateActive(spec, minute)) continue;
        if (sensorZone([eye], piratePosition(spec, minute)) !== 'NONE') continue;
        f.clock.set(new Date(season!.startsAt.getTime() + minute * 60_000));
        hidden = spec;
        break;
      }
    }
    expect(hidden).toBeDefined();
    const fleet = await armed();
    await expect(
      launchPirateRaid(f.db, mine, pirateId(season!.asteroidKey, hidden!.index), fleet, f.clock),
    ).rejects.toMatchObject({ code: 'PIRATE_OUT_OF_SIGHT' });
  });

  it('refuses a second raid at the same pirate from the same world', async () => {
    const target = await findVisible();
    await armed({ DART: 60 });
    await launchPirateRaid(f.db, mine, target.id, { DART: 30 }, f.clock);
    await expect(
      launchPirateRaid(f.db, mine, target.id, { DART: 30 }, f.clock),
    ).rejects.toMatchObject({ code: 'ALREADY_RAIDING_PIRATE' });
  });

  it('refuses when there is no bay left', async () => {
    /*
      D28's ONE SCARCITY, and pirates pay it like everything else. A target class
      that did not consume a bay would let a commander keep their whole raid budget
      while farming on the side.
    */
    await armed({ DART: 400 });
    const seen = new Set<number>();
    const [core] = await f.db
      .select({ level: buildings.level })
      .from(buildings)
      .where(and(eq(buildings.planetId, mine), eq(buildings.type, 'CORE')));
    const bays = flightSlots(core?.level ?? 0);
    for (let i = 0; i < bays; i++) {
      const target = await findVisible(seen);
      seen.add(target.spec.index);
      await launchPirateRaid(f.db, mine, target.id, { DART: 30 }, f.clock);
    }
    expect(await baysInUse(f.db, mine)).toBe(bays);
    const extra = await findVisible(seen);
    await expect(
      launchPirateRaid(f.db, mine, extra.id, { DART: 30 }, f.clock),
    ).rejects.toMatchObject({ code: 'NO_FREE_BAY' });
  });

  it('refuses without the deuterium for the round trip', async () => {
    const target = await findVisible();
    await giveUnits(f.db, mine, { DART: 40 });
    await f.db.update(planets).set({ deuterium: 0 }).where(eq(planets.id, mine));
    await expect(
      launchPirateRaid(f.db, mine, target.id, { DART: 40 }, f.clock),
    ).rejects.toMatchObject({ code: 'INSUFFICIENT_FUEL' });
  });

  it('refuses ships the world does not have, and anything that cannot fly', async () => {
    const target = await findVisible();
    await armed({ DART: 2 });
    await expect(
      launchPirateRaid(f.db, mine, target.id, { DART: 40 }, f.clock),
    ).rejects.toMatchObject({ code: 'NOT_ENOUGH_SHIPS' });
    await expect(
      launchPirateRaid(f.db, mine, target.id, { BASTION: 1 }, f.clock),
    ).rejects.toMatchObject({ code: 'BAD_FLEET' });
    await expect(
      launchPirateRaid(f.db, mine, target.id, { PROSPECTOR: 1 }, f.clock),
    ).rejects.toMatchObject({ code: 'BAD_FLEET' });
    await expect(
      launchPirateRaid(f.db, mine, target.id, {}, f.clock),
    ).rejects.toMatchObject({ code: 'BAD_FLEET' });
  });

  it('refuses an id that was never minted for this season', async () => {
    await findVisible();
    await armed();
    await expect(
      launchPirateRaid(f.db, mine, 'A'.repeat(22), { DART: 30 }, f.clock),
    ).rejects.toMatchObject({ code: 'NO_SUCH_PIRATE' });
  });
});

describe('what a pirate raid comes home with', () => {
  let f: Fixture;
  let mine: string;
  let me: string;

  const worker = () =>
    new EventWorker(f.db, f.clock, { pollMs: 50, batch: 50, staleMinutes: 5 }, silent);

  const findVisible = async (): Promise<Target> => {
    const [season] = await f.db.select().from(seasons).where(eq(seasons.id, f.seasonId));
    const key = season!.asteroidKey;
    const field = privatePirateField(key);
    const [world] = await f.db.select().from(planets).where(eq(planets.id, mine));
    const eye = sensorSphere({ x: world!.x, y: world!.y, z: world!.z }, 0, 0, mine);
    for (const spec of field) {
      const first = Math.ceil(spec.appearsAt) + 1;
      for (let minute = first; minute < spec.expiresAt; minute += 1) {
        if (sensorZone([eye], piratePosition(spec, minute)) === 'NONE') continue;
        f.clock.set(new Date(season!.startsAt.getTime() + minute * 60_000));
        return { spec, id: pirateId(key, spec.index), key };
      }
    }
    throw new Error('no visible pirate this season');
  };

  /** Enough force that the fight is decided rather than a coin toss. */
  const overwhelming = async (): Promise<Fleet> => {
    await grant(f.db, mine, 500_000, 100_000);
    const fleet: Fleet = { DART: 250, COURIER: 6 };
    await giveUnits(f.db, mine, fleet);
    return fleet;
  };

  beforeEach(async () => {
    f = await seedWorld(2, 4242, { pirates: true });
    mine = f.planetIds[0]!;
    me = f.playerIds[0]!;
  });

  it('writes a report with zero Dominion and no world on the other side', async () => {
    const target = await findVisible();
    const fleet = await overwhelming();
    const launch = await launchPirateRaid(f.db, mine, target.id, fleet, f.clock);

    f.clock.set(settledAt(launch.arriveAt));
    await worker().tick();

    const [report] = await f.db.select().from(battleReports);
    expect(report).toBeDefined();
    expect(report!.targetKind).toBe('PIRATE');
    expect(report!.pirateRaidId).toBe(launch.raidId);
    expect(report!.missionId).toBeNull();
    expect(report!.targetPlanetId).toBeNull();
    expect(report!.defenderPlayerId).toBeNull();
    /*
      DOMINION IS ZERO-SUM BETWEEN TWO COMMANDERS. There is no ledger on the other
      side of this fight, so any score at all would be created out of nothing and
      `invariants.test.ts`'s zero-sum property would stop holding.
    */
    expect(report!.dominionSwing).toBe(0);

    const [me2] = await f.db.select().from(players).where(eq(players.id, me));
    expect(me2!.dominionTaken).toBe(0);
    expect(me2!.dominionLost).toBe(0);
  });

  it('leaves a harvestable wreck field in open space, priced off both sides', async () => {
    /*
      THE APPROVED RULE IS PvP'S, NOT THE CARETAKER'S. D150.

      A caretaker world salvages nothing because nothing it fields is really there;
      a pirate flies real Fleet V2 hulls, so what dies leaves the same share of its
      value in orbit that a player battle would. The field is at the RENDEZVOUS —
      there is no planet under this fight — which is the whole reason the debris
      row had to learn a position of its own.
    */
    const target = await findVisible();
    const fleet = await overwhelming();
    const launch = await launchPirateRaid(f.db, mine, target.id, fleet, f.clock);

    f.clock.set(settledAt(launch.arriveAt));
    await worker().tick();

    const [report] = await f.db.select().from(battleReports);
    const [field] = await f.db.select().from(debrisFields);
    expect(field).toBeDefined();
    expect(field!.planetId).toBeNull();
    expect(field!.pirateRaidId).toBe(launch.raidId);
    // It sits where the fight happened, not where the fleet came from.
    expect(field!.x).toBeCloseTo(launch.intercept.x, 2);
    expect(field!.y).toBeCloseTo(launch.intercept.y, 2);
    expect(field!.z).toBeCloseTo(launch.intercept.z, 2);

    const total = field!.alloy + field!.crystal + field!.deuterium;
    expect(total).toBeGreaterThan(0);
    // The report and the field are priced from the same two loss lists.
    expect(total).toBeCloseTo(report!.wreckValue, 2);

    const both =
      flying(report!.attackerLosses) + flying(report!.defenderLosses);
    expect(total).toBeCloseTo(both * DEBRIS.share, 2);
  });

  it('brings the hoard and, on a wipe, sometimes a ship home', async () => {
    const target = await findVisible();
    const fleet = await overwhelming();
    const [before] = await f.db.select().from(planets).where(eq(planets.id, mine));
    const launch = await launchPirateRaid(f.db, mine, target.id, fleet, f.clock);

    f.clock.set(settledAt(launch.arriveAt));
    await worker().tick();

    const [raid] = await f.db.select().from(pirateRaids).where(eq(pirateRaids.id, launch.raidId));
    expect(raid!.status).toBe('returning');
    expect(raid!.homeAt).not.toBeNull();
    expect((raid!.loot?.alloy ?? 0) + (raid!.loot?.crystal ?? 0)).toBeGreaterThan(0);

    f.clock.set(new Date(raid!.homeAt!.getTime() + 1000));
    await worker().tick();

    const [settled] = await f.db.select().from(pirateRaids).where(eq(pirateRaids.id, launch.raidId));
    expect(settled!.status).toBe('done');

    const [after] = await f.db.select().from(planets).where(eq(planets.id, mine));
    // Fuel came off at launch and the hoard landed on return; the hoard is bigger.
    expect(after!.alloy).toBeGreaterThan(before!.alloy - launch.fuel);

    // Nothing is parked against the raid any more, and the bay is free.
    const parked = await f.db
      .select()
      .from(units)
      .where(and(eq(units.planetId, mine), eq(units.location, `pirate:${launch.raidId}`)));
    expect(parked).toHaveLength(0);
    expect(await baysInUse(f.db, mine)).toBe(0);

    if (settled!.capturedHull) {
      const [row] = await f.db
        .select()
        .from(units)
        .where(and(
          eq(units.planetId, mine),
          eq(units.location, 'home'),
          eq(units.hull, settled!.capturedHull),
        ));
      expect(row?.count ?? 0).toBeGreaterThan(0);
    }
  });

  it('records the damage it did, and marks a wiped pirate destroyed', async () => {
    const target = await findVisible();
    const fleet = await overwhelming();
    const launch = await launchPirateRaid(f.db, mine, target.id, fleet, f.clock);
    f.clock.set(settledAt(launch.arriveAt));
    await worker().tick();

    const [state] = await f.db
      .select()
      .from(pirateState)
      .where(and(
        eq(pirateState.seasonId, f.seasonId),
        eq(pirateState.index, target.spec.index),
      ));
    expect(state).toBeDefined();
    expect(fleetCount(state!.losses)).toBeGreaterThan(0);

    const [report] = await f.db.select().from(battleReports);
    if (report!.grade === 'DECISIVE') {
      expect(state!.destroyedAt).not.toBeNull();
      expect(state!.destroyedByPlayerId).toBe(me);
      // And a second raid can no longer be aimed at it.
      await grant(f.db, mine, 200_000, 40_000);
      await giveUnits(f.db, mine, { DART: 60 });
      await expect(
        launchPirateRaid(f.db, mine, target.id, { DART: 30 }, f.clock),
      ).rejects.toMatchObject({ code: 'PIRATE_GONE' });
    }
  });

  it('tells the commander what happened, once, however often the event is delivered', async () => {
    const target = await findVisible();
    const fleet = await overwhelming();
    const launch = await launchPirateRaid(f.db, mine, target.id, fleet, f.clock);
    f.clock.set(settledAt(launch.arriveAt));
    await worker().tick();
    // Redelivery: the status transition is the claim, so the second pass is a no-op.
    await worker().tick();

    const rows = await f.db
      .select()
      .from(notifications)
      .where(and(eq(notifications.playerId, me), eq(notifications.kind, 'raid_result')));
    expect(rows).toHaveLength(1);
    expect(rows[0]!.payload).toMatchObject({ targetKind: 'PIRATE', dominion: 0 });
    expect(rows[0]!.payload).toHaveProperty('pirateLevel', target.spec.level);

    const reports = await f.db.select().from(battleReports);
    expect(reports).toHaveLength(1);
  });

  it('flies nothing home when both sides are annihilated', async () => {
    /*
      G6. `resolveCombat` grades DECISIVE off the DEFENDER being gone, and the
      attacker reaching zero in the same exchange is possible. There is then nobody
      to load the hoard and nobody to fly a return leg — so the raid closes here,
      with a report and no ghost flight.
    */
    const target = await findVisible();
    await grant(f.db, mine, 200_000, 40_000);
    await giveUnits(f.db, mine, { DART: 30 });
    const launch = await launchPirateRaid(f.db, mine, target.id, { DART: 30 }, f.clock);

    // Empty the raid's parked stack: the fleet is gone before the fight resolves.
    await f.db
      .delete(units)
      .where(and(eq(units.planetId, mine), eq(units.location, `pirate:${launch.raidId}`)));

    f.clock.set(settledAt(launch.arriveAt));
    await worker().tick();

    const [raid] = await f.db.select().from(pirateRaids).where(eq(pirateRaids.id, launch.raidId));
    expect(raid!.status).toBe('done');
    expect(raid!.homeAt).toBeNull();
    expect(await baysInUse(f.db, mine)).toBe(0);
  });

  it('flies the fleet home rather than stranding it when the lane no longer has that pirate', async () => {
    /*
      A FLEET CAN NEVER DISAPPEAR. `architecture.md`, and it is the invariant this
      project has already paid for once on a live database.

      The lane is derived from the season key, so a constants change or a ruleset
      bump can leave a raid in the air pointing at an index that no longer resolves.
      Throwing there put the event through five retries and then `exhausted`, with
      the ships parked under `pirate:<id>` for ever and the origin world reading
      AWAY for the rest of the season. Coming home empty-handed is the honest
      outcome; losing the fleet is not.
    */
    const target = await findVisible();
    const fleet = await overwhelming();
    const launch = await launchPirateRaid(f.db, mine, target.id, fleet, f.clock);

    // The pirate this raid was aimed at is no longer in the lane.
    await f.db
      .update(pirateRaids)
      .set({ pirateIndex: 10_000_000 })
      .where(eq(pirateRaids.id, launch.raidId));

    f.clock.set(settledAt(launch.arriveAt));
    await worker().tick();

    const [raid] = await f.db.select().from(pirateRaids).where(eq(pirateRaids.id, launch.raidId));
    expect(raid!.status).toBe('returning');
    expect(raid!.homeAt).not.toBeNull();
    expect(raid!.loot).toBeNull();
    expect(raid!.capturedHull).toBeNull();

    f.clock.set(new Date(raid!.homeAt!.getTime() + 1000));
    await worker().tick();
    const [home] = await f.db
      .select()
      .from(units)
      .where(and(eq(units.planetId, mine), eq(units.location, 'home'), eq(units.hull, 'DART')));
    expect(home!.count).toBe(250);
  });

  it('turns around empty when another world got there first', async () => {
    const target = await findVisible();
    const fleet = await overwhelming();
    const launch = await launchPirateRaid(f.db, mine, target.id, fleet, f.clock);

    // Somebody else wiped it while this fleet was in the air.
    await f.db.insert(pirateState).values({
      seasonId: f.seasonId,
      index: target.spec.index,
      losses: target.spec.roster,
      destroyedAt: f.clock.now(),
      destroyedByPlayerId: f.playerIds[1]!,
      updatedAt: f.clock.now(),
    });

    f.clock.set(settledAt(launch.arriveAt));
    await worker().tick();

    const [raid] = await f.db.select().from(pirateRaids).where(eq(pirateRaids.id, launch.raidId));
    expect(raid!.loot).toBeNull();
    expect(raid!.capturedHull).toBeNull();
    expect(raid!.homeAt).not.toBeNull();
    expect(await f.db.select().from(battleReports)).toHaveLength(0);

    f.clock.set(new Date(raid!.homeAt!.getTime() + 1000));
    await worker().tick();
    const [home] = await f.db
      .select()
      .from(units)
      .where(and(eq(units.planetId, mine), eq(units.location, 'home'), eq(units.hull, 'DART')));
    expect(home!.count).toBe(250);
  });

  it('never lets the hoard exceed what the survivors could carry', async () => {
    const target = await findVisible();
    await grant(f.db, mine, 500_000, 100_000);
    // No transports at all: a swarm of Darts has very little hold between them.
    await giveUnits(f.db, mine, { DART: 250 });
    const launch = await launchPirateRaid(f.db, mine, target.id, { DART: 250 }, f.clock);
    f.clock.set(settledAt(launch.arriveAt));
    await worker().tick();

    const [raid] = await f.db.select().from(pirateRaids).where(eq(pirateRaids.id, launch.raidId));
    const [report] = await f.db.select().from(battleReports);
    expect(raid!.loot).not.toBeNull();
    expect(report).toBeDefined();
    const carried = raid!.loot!.alloy + raid!.loot!.crystal + raid!.loot!.deuterium;
    const hoard = target.spec.hoard.alloy + target.spec.hoard.crystal + target.spec.hoard.deuterium;
    expect(carried).toBeLessThanOrEqual(hoard);

    /*
      AND THE REPORT HAS TO SAY SO. D94 · D150.

      Cargo room is the throttle this whole feature rests on — you buy it with
      combat power on the way out — so a haul the holds cut short is the single
      most useful thing a pirate report can tell its reader. It is also the
      discovery signal for Dense Fuel Cells, which is a lesson about exactly this
      and does not care whether the ore was left on a world or on a wreck.
    */
    /*
      AND THE FLAG SAYS WHICH OF THE TWO LIMITS BOUND. D94 · D150.

      `cargoLimited` is set exactly when the holds, rather than the hoard, decided
      what came home — the report has to be able to tell a commander they left ore
      floating at the rendezvous, because cargo room is the throttle this whole
      feature rests on, and `researchState` reads this same column to discover
      Dense Fuel Cells.

      The slack is the three per-pile floors inside `computeLoot`: alloy, crystal
      and Deuterium each round down independently, so an uncapped haul can come in
      up to three units under its own arithmetic without any hold being full.
    */
    const available = gradeMultiplier(report!.grade) * hoard;
    expect(report!.cargoLimited).toBe(carried + 3 < available);
  });
});
