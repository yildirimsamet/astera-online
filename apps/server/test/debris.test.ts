import { pino } from 'pino';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { and, eq, sql } from 'drizzle-orm';
import {
  DEBRIS,
  HULLS,
  debrisRemaining,
  fleetEntries,
  type Fleet,
  type HullId,
} from '@astera/rules';
import {
  battleReports,
  debrisFields,
  galaxyEvents,
  miningRuns,
  players,
  scheduledEvents,
  type GalaxyEventPayload,
  units,
} from '../src/db/schema.js';
import { launchAttack } from '../src/services/mission.js';
import { launchHarvest, visibleDebris } from '../src/services/mining.js';
import { createSeason } from '../src/services/season.js';
import { collectWorks } from '../src/services/build.js';
import { baysInUse } from '../src/services/flight.js';
import { EventWorker } from '../src/worker/loop.js';
import { abandon } from '../src/worker/abandon.js';
import { fail } from '../src/worker/queue.js';
import {
  giveUnits,
  grant,
  levelWorld,
  seedWorld,
  setLevel,
  settledAt,
  testDb,
  type Fixture,
} from './helpers.js';

const publicPlanetName = (payload: GalaxyEventPayload): string => {
  if (!('planetName' in payload)) throw new Error('expected a public planet identity payload');
  return payload.planetName;
};

const silent = pino({ level: 'silent' });

afterAll(async () => {
  const { close } = await testDb();
  await close();
});

/**
 * THE EDGES OF A WRECK FIELD. D32.
 *
 * The happy path — a battle leaves debris, somebody flies out and takes it home —
 * is covered in `reports.test.ts`. What lives here is everything that happens when
 * the timing, the race or the machinery goes wrong, because a wreck field is the
 * first object in the game that is PUBLIC, SHARED, and DECAYING at once. Every one
 * of those three properties has a failure mode that a happy-path test cannot see.
 */
describe('wreck fields', () => {
  let f: Fixture;
  let mine: string;
  let theirs: string;
  let third: string;

  const worker = () =>
    new EventWorker(f.db, f.clock, { pollMs: 1000, batch: 100, staleMinutes: 5 }, silent);

  beforeEach(async () => {
    f = await seedWorld(3);
    [mine, theirs, third] = f.planetIds as [string, string, string];
    for (const id of f.planetIds) {
      await setLevel(f.db, id, 'CORE', 8);
      await setLevel(f.db, id, 'SHIPYARD', 3);
    }
    f.clock.advance(250);
  });

  /** A raid big enough on both sides to leave a field worth flying to. */
  /**
   * THE ATTACKING FLEET IS DERIVED, NOT PICKED. It has to win DECISIVELY, because
   * everything in this file is downstream of a fight that actually happened.
   *
   * Sixty Wasps was enough against the old hull table and is REPELLED against the
   * current one — ground defence is now priced at 1.6x equal-budget power, so six
   * Bastions are worth 19,200 rather than 13,050. Measured against the real
   * resolver: 60 is repelled, 90 is partial, 120 is decisive and leaves a field of
   * about 5,600.
   */
  const fight = async (): Promise<typeof debrisFields.$inferSelect> => {
    await grant(f.db, theirs, 60_000, 6_000);
    await giveUnits(f.db, theirs, { BASTION: 6, WASP: 20 });
    await giveUnits(f.db, mine, { WASP: 120, HAULER: 3 });
    await levelWorld(f.db, f.planetIds);
    const launch = await launchAttack(f.db, mine, theirs, { WASP: 120, HAULER: 3 }, f.clock);
    f.clock.set(settledAt(launch.arriveAt));
    await worker().tick();
    const [field] = await f.db.select().from(debrisFields);
    expect(field, 'the fixture fight left no wreckage to test with').toBeDefined();
    return field!;
  };

  /** Run a harvest all the way home and give back what it delivered. */
  const flyHome = async (runId: string): Promise<{ alloy: number; crystal: number }> => {
    const [out] = await f.db.select().from(miningRuns).where(eq(miningRuns.id, runId));
    f.clock.set(out!.arriveAt);
    await worker().tick();
    const [back] = await f.db.select().from(miningRuns).where(eq(miningRuns.id, runId));
    f.clock.set(back!.homeAt!);
    await worker().tick();
    const [done] = await f.db.select().from(miningRuns).where(eq(miningRuns.id, runId));
    return { alloy: done!.minedAlloy, crystal: done!.minedCrystal };
  };

  /**
   * THE LATE ARRIVAL.
   *
   * A field decays on a wall clock, not on arrival order, so a craft launched at a
   * live field can reach a dead one. The craft must still come home and must still
   * release its bay — an empty-handed return is a disappointment, but a craft that
   * never lands is a bug that costs a player a permanent slot.
   */
  it('a harvest that lands after the field has faded comes home empty, and gives its bay back', async () => {
    const field = await fight();
    await giveUnits(f.db, mine, { PROSPECTOR: 3 });
    await collectWorks(f.db, mine, f.clock);

    const run = await launchHarvest(f.db, mine, field.id, 3, f.clock);
    expect(await baysInUse(f.db, mine)).toBeGreaterThan(0);

    // Sit still until the field is provably gone, THEN land.
    f.clock.set(new Date(field.createdAt.getTime() + (DEBRIS.decayMinutes + 5) * 60_000));
    await worker().tick();
    const [mid] = await f.db.select().from(miningRuns).where(eq(miningRuns.id, run.runId));
    f.clock.set(mid!.homeAt!);
    await worker().tick();

    const [done] = await f.db.select().from(miningRuns).where(eq(miningRuns.id, run.runId));
    expect(done!.minedAlloy).toBe(0);
    expect(done!.minedCrystal).toBe(0);
    expect(done!.status).toBe('done');

    // The craft are home — not destroyed, not stranded at the wreck.
    const [home] = await f.db
      .select()
      .from(units)
      .where(and(eq(units.planetId, mine), eq(units.location, 'home'), eq(units.hull, 'PROSPECTOR')));
    expect(home!.count).toBe(3);
    expect(await baysInUse(f.db, mine)).toBe(0);
  });

  /**
   * THE RACE.
   *
   * Two planets can be flying at the same field, and the field is one row. If the
   * claim were read-then-write without a lock, both would see the full amount and
   * the galaxy would get more out of a wreck than ever went into it — an invented
   * resource, which is the same class of bug as a broken zero-sum ladder.
   */
  it('two harvests at one field never take more than the field holds', async () => {
    const born = await fight();
    await giveUnits(f.db, mine, { PROSPECTOR: 3 });
    await giveUnits(f.db, third, { PROSPECTOR: 3 });
    await collectWorks(f.db, mine, f.clock);
    await collectWorks(f.db, third, f.clock);

    /**
     * Shrink the field so the two squadrons genuinely over-subscribe it. Left at
     * its natural size they would both come home full and the test would pass
     * without ever exercising the contested path — which is the only path the
     * `FOR UPDATE` on the field row exists for.
     */
    await f.db
      .update(debrisFields)
      .set({ alloy: 600, crystal: 200 })
      .where(eq(debrisFields.id, born.id));
    const [field] = await f.db.select().from(debrisFields).where(eq(debrisFields.id, born.id));

    const a = await launchHarvest(f.db, mine, field!.id, 3, f.clock);
    const b = await launchHarvest(f.db, third, field!.id, 3, f.clock);
    expect(a.capacity + b.capacity).toBeGreaterThan(field!.alloy + field!.crystal);

    const gotA = await flyHome(a.runId);
    const gotB = await flyHome(b.runId);

    const took = gotA.alloy + gotA.crystal + gotB.alloy + gotB.crystal;
    expect(took).toBeGreaterThan(0);
    // Never more than was there — and decay means it is normally strictly less.
    expect(took).toBeLessThanOrEqual(field!.alloy + field!.crystal + 1e-6);
    // Somebody was rationed: the pair asked for more than the field could give.
    expect(took).toBeLessThan(a.capacity + b.capacity);

    const [after] = await f.db.select().from(debrisFields).where(eq(debrisFields.id, field!.id));
    expect(after!.takenAlloy + after!.takenCrystal).toBeCloseTo(took, 4);
    const exhausted = await f.db
      .select()
      .from(galaxyEvents)
      .where(eq(galaxyEvents.kind, 'wreck_exhausted'));
    expect(exhausted).toHaveLength(1);
    expect(Object.keys(exhausted[0]!.payload).sort()).toEqual(['commanderName', 'planetName']);
  });

  it('chronicles a new public wreck and a changed Dominion leader without combat intel', async () => {
    // Make a different world the leader before the raid; the attacker must earn
    // the transition rather than inheriting the all-zero joined-at tie-break.
    await f.db
      .update(players)
      .set({ dominionTaken: 1 })
      .where(eq(players.id, f.playerIds[2]!));
    const field = await fight();

    const events = await f.db.select().from(galaxyEvents);
    const formed = events.find((event) => event.kind === 'wreck_formed');
    expect(formed).toMatchObject({
      refId: field.id,
      subjectPlanetId: theirs,
      payload: { commanderName: 'Tester1' },
    });
    expect(typeof publicPlanetName(formed!.payload)).toBe('string');
    expect(Object.keys(formed!.payload).sort()).toEqual(['commanderName', 'planetName']);

    const leader = events.find((event) => event.kind === 'dominion_leader');
    expect(leader).toMatchObject({
      subjectPlanetId: mine,
      payload: { commanderName: 'Tester0' },
    });
    expect(typeof publicPlanetName(leader!.payload)).toBe('string');
    expect(JSON.stringify(events)).not.toMatch(/fleet|loot|attacker/i);
  });

  /**
   * A wreck field is not owned. It sits at the defender's coordinates, and the
   * defender is exactly as entitled to it as the raider who made it — that is what
   * stops a lost battle from being a pure loss, and it is deliberate.
   */
  it('the defender may harvest the wreckage of their own defeat', async () => {
    const field = await fight();
    expect(field.planetId).toBe(theirs);
    await giveUnits(f.db, theirs, { PROSPECTOR: 3 });
    await collectWorks(f.db, theirs, f.clock);

    const run = await launchHarvest(f.db, theirs, field.id, 3, f.clock);
    const got = await flyHome(run.runId);
    expect(got.alloy + got.crystal).toBeGreaterThan(0);
  });

  it('refuses a launch at a field that has already faded', async () => {
    const field = await fight();
    await giveUnits(f.db, mine, { PROSPECTOR: 3 });
    f.clock.set(new Date(field.createdAt.getTime() + (DEBRIS.decayMinutes + 1) * 60_000));
    await expect(launchHarvest(f.db, mine, field.id, 3, f.clock)).rejects.toMatchObject({
      code: 'FIELD_GONE',
    });
  });

  /**
   * A field id from another galaxy must not be usable here.
   *
   * The lookup is scoped by season, and this is what proves the scope is doing
   * work rather than decorating the query — the row genuinely exists, so an
   * unscoped lookup would happily fly craft at another galaxy's wreckage.
   *
   * The second season is made in place rather than by a second `seedWorld`, which
   * truncates the database and would delete the very field under test.
   */
  it('refuses a field that belongs to another galaxy', async () => {
    const field = await fight();
    await giveUnits(f.db, mine, { PROSPECTOR: 3 });

    const { season: elsewhere } = await createSeason(f.db, {
      shardCode: 'EU-TEST-ELSEWHERE',
      seed: 777,
      startsAt: f.clock.now(),
      playerCap: 10,
    });
    await f.db
      .update(debrisFields)
      .set({ seasonId: elsewhere.id })
      .where(eq(debrisFields.id, field.id));

    await expect(launchHarvest(f.db, mine, field.id, 3, f.clock)).rejects.toMatchObject({
      code: 'NO_SUCH_FIELD',
    });
  });

  it('refuses a launch with no craft in it', async () => {
    const field = await fight();
    await giveUnits(f.db, mine, { PROSPECTOR: 3 });
    for (const bad of [0, -1, 1.5]) {
      await expect(launchHarvest(f.db, mine, field.id, bad, f.clock)).rejects.toMatchObject({
        code: 'BAD_COUNT',
      });
    }
    await expect(launchHarvest(f.db, mine, field.id, 99, f.clock)).rejects.toMatchObject({
      code: 'NOT_ENOUGH_CRAFT',
    });
  });

  /**
   * THE TWO PARTIAL UNIQUE INDEXES MUST NOT COLLIDE WITH EACH OTHER.
   *
   * `mining_planet_rock_idx` is `(planet_id, asteroid_index)` and
   * `mining_planet_debris_idx` is `(planet_id, debris_field_id)`, and since D32
   * each run leaves one of those columns NULL. This only works because Postgres
   * treats NULLs as distinct in a unique index — so two harvests do not collide on
   * the rock index they both leave empty. That is load-bearing behaviour resting on
   * a default, which is exactly the kind of thing to pin down.
   */
  it('two harvests at two different fields coexist — NULL rock indexes do not collide', async () => {
    const field = await fight();
    await giveUnits(f.db, mine, { PROSPECTOR: 3 });
    // The raid's own survivors are still flying home in this fixture, so bays are
    // counted as a delta rather than from zero.
    const before = await baysInUse(f.db, mine);

    const harvest = await launchHarvest(f.db, mine, field.id, 2, f.clock);
    // A second harvest at a DIFFERENT field, and a rock run, all from one planet.
    const [second] = await f.db
      .insert(debrisFields)
      .values({
        seasonId: f.seasonId,
        planetId: third,
        alloy: 8_000,
        crystal: 2_000,
        createdAt: f.clock.now(),
      })
      .returning();
    const other = await launchHarvest(f.db, mine, second!.id, 1, f.clock);

    expect(harvest.runId).not.toBe(other.runId);
    expect(await baysInUse(f.db, mine)).toBe(before + 2);
  });

  /**
   * The CHECK is the thing that makes `debrisFieldId is not null` a fact the
   * resolver can branch on rather than a convention. Assert it directly — a
   * constraint nobody tests is a constraint that can be dropped by a bad migration
   * without a single test turning red.
   */
  it('the database refuses a run aimed at both targets, or at neither', async () => {
    const field = await fight();
    const base = {
      seasonId: f.seasonId,
      planetId: mine,
      craft: 1,
      holdEach: 100,
      interceptX: 0,
      interceptY: 0,
      interceptZ: 0,
      departAt: f.clock.now(),
      arriveAt: f.clock.now(),
    };
    await expect(
      f.db.insert(miningRuns).values({ ...base, asteroidIndex: 3, debrisFieldId: field.id }),
    ).rejects.toThrow(/mining_one_target/);
    await expect(
      f.db.insert(miningRuns).values({ ...base, asteroidIndex: null, debrisFieldId: null }),
    ).rejects.toThrow(/mining_one_target/);
  });

  /**
   * A harvest is resolved by the same worker as everything else, so it inherits the
   * same failure mode: an event that exhausts its retries used to strand its craft
   * forever. D28 closed that for missions; this proves it is closed for a haul too,
   * which matters more here because a harvest also holds a partial unique index —
   * a stranded run would block the planet from ever re-targeting that field.
   */
  it('a harvest whose event gives up returns its craft and frees the field again', async () => {
    const field = await fight();
    await giveUnits(f.db, mine, { PROSPECTOR: 3 });
    const run = await launchHarvest(f.db, mine, field.id, 3, f.clock);

    const [event] = await f.db
      .select()
      .from(scheduledEvents)
      .where(eq(scheduledEvents.refId, run.runId));
    expect(event).toBeDefined();
    for (let i = 0; i < 6; i++) {
      await f.db
        .update(scheduledEvents)
        .set({ attempts: sql`${scheduledEvents.attempts} + 1` })
        .where(eq(scheduledEvents.id, event!.id));
      await fail(f.db, event!.id, new Error('handler is broken'));
    }

    // The raid's own survivors are still flying home, so the harvest's bay is a
    // delta rather than a return to zero.
    const held = await baysInUse(f.db, mine);
    expect(await abandon(f.db, event!, f.clock)).toBe(true);
    expect(await baysInUse(f.db, mine)).toBe(held - 1);

    const [home] = await f.db
      .select()
      .from(units)
      .where(and(eq(units.planetId, mine), eq(units.location, 'home'), eq(units.hull, 'PROSPECTOR')));
    expect(home!.count).toBe(3);

    // Nothing is parked at the wreck any more...
    const parked = await f.db
      .select()
      .from(units)
      .where(and(eq(units.planetId, mine), eq(units.location, `mine:${run.runId}`)));
    expect(parked).toHaveLength(0);

    // ...and the field can be flown at again, which the partial unique index only
    // allows because the abandoned run was moved to 'done'.
    await expect(launchHarvest(f.db, mine, field.id, 3, f.clock)).resolves.toBeDefined();
  });

  /**
   * The read the whole disc makes on every refresh. It is pruned in SQL by age
   * because nothing ever deletes a debris row — left unbounded it would grow to
   * every battle the galaxy has fought by the end of a season.
   */
  it('does not list a field that is older than its own decay life', async () => {
    const field = await fight();
    const live = await visibleDebris(f.db, f.seasonId, f.clock.now());
    expect(live.map((d) => d.id)).toContain(field.id);

    f.clock.set(new Date(field.createdAt.getTime() + (DEBRIS.decayMinutes + 1) * 60_000));
    const dead = await visibleDebris(f.db, f.seasonId, f.clock.now());
    expect(dead.map((d) => d.id)).not.toContain(field.id);

    // And the arithmetic agrees with the pruning — the cut is exact, not a guess.
    expect(debrisRemaining(field.alloy, field.takenAlloy, DEBRIS.decayMinutes + 1)).toBe(0);
  });

  /**
   * WHAT THE FIELD IS MADE OF, TO THE LAST UNIT.
   *
   * Checked against the battle report's own stored losses rather than against a
   * hand-copied number, so the two can never drift apart. Two rules are being
   * pinned at once and both are load-bearing:
   *
   *  - GROUND UNITS CONTRIBUTE NOTHING. They already get `defenceSalvage` (D7), so
   *    counting them here would return roughly 85% of a defender's losses and make
   *    a fortress PROFIT from being attacked. The fixture fight deliberately kills
   *    Bastions, so a regression that included them would show up immediately.
   *  - THE SPLIT FOLLOWS WHAT DIED. A crystal-heavy battle leaves crystal-heavy
   *    wreckage; the field is not two arbitrary piles.
   */
  it('is exactly a share of the non-ground hulls that died, both sides', async () => {
    await fight();
    const [field] = await f.db.select().from(debrisFields);
    const [report] = await f.db.select().from(battleReports);
    expect(report).toBeDefined();

    const flying = (fleet: Fleet, pick: (h: HullId) => number): number =>
      fleetEntries(fleet)
        .filter(([id]) => !HULLS[id].ground)
        .reduce((s, [id, n]) => s + n * pick(id), 0);

    const both = [report!.attackerLosses, report!.defenderLosses];
    const raw = both.reduce((s, x) => s + flying(x, (h) => HULLS[h].alloy + HULLS[h].crystal), 0);
    const rawAlloy = both.reduce((s, x) => s + flying(x, (h) => HULLS[h].alloy), 0);

    // Ground really did die in this fight — otherwise the exclusion proves nothing.
    const groundDied = fleetEntries(report!.defenderLosses).some(([id]) => HULLS[id].ground);
    expect(groundDied, 'fixture left no ground losses, so the exclusion is untested').toBe(true);

    expect(field!.alloy + field!.crystal).toBeCloseTo(raw * DEBRIS.share, 3);
    expect(field!.alloy).toBeCloseTo(raw * DEBRIS.share * (rawAlloy / raw), 3);
    expect(field!.alloy + field!.crystal).toBeGreaterThanOrEqual(DEBRIS.minimum);
  });

  /**
   * Harvesting is Wealth, never Dominion. The galaxy-wide sum is the check that
   * catches score being created from nothing, and it is asserted here on the
   * harvest path specifically — `reports.test.ts` asserts it across a full round
   * trip, this one asserts it holds while craft are still in the air.
   */
  it('moves the ladder by exactly nothing, at every point in the flight', async () => {
    const field = await fight();
    const sumDominion = async (): Promise<number> => {
      const rows = await f.db.select().from(players);
      return rows.reduce((s, p) => s + p.dominionTaken - p.dominionLost, 0);
    };
    const before = await sumDominion();

    await giveUnits(f.db, mine, { PROSPECTOR: 3 });
    const run = await launchHarvest(f.db, mine, field.id, 3, f.clock);
    expect(await sumDominion()).toBeCloseTo(before, 5);

    const [out] = await f.db.select().from(miningRuns).where(eq(miningRuns.id, run.runId));
    f.clock.set(out!.arriveAt);
    await worker().tick();
    expect(await sumDominion()).toBeCloseTo(before, 5);

    const [back] = await f.db.select().from(miningRuns).where(eq(miningRuns.id, run.runId));
    f.clock.set(back!.homeAt!);
    await worker().tick();
    expect(await sumDominion()).toBeCloseTo(before, 5);
  });

  /**
   * A harvest is charged one bay however many craft are in it, the same rule a rock
   * run gets — the bay prices the DECISION, not its size.
   */
  it('costs one bay however many craft go', async () => {
    const field = await fight();
    await giveUnits(f.db, mine, { PROSPECTOR: 3 });
    const before = await baysInUse(f.db, mine);
    await launchHarvest(f.db, mine, field.id, 3, f.clock);
    expect(await baysInUse(f.db, mine)).toBe(before + 1);
  });
});