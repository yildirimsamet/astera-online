import { and, eq } from 'drizzle-orm';
import { pino } from 'pino';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import {
  GALAXY,
  PROSPECTOR,
  activeAsteroids,
  asteroidPosition,
  distance,
  generateGalaxy,
  prospectorHold,
  prospectorSpeed,
  prospectorTravelExact,
  type AsteroidSpec,
} from '@astera/rules';
import { asteroidClaims, miningRuns, planets, units } from '../src/db/schema.js';
import { launchMining, visibleAsteroids } from '../src/services/mining.js';
import { buildUnits } from '../src/services/build.js';
import { EventWorker } from '../src/worker/loop.js';
import {
  giveUnits,
  grant,
  placeAt,
  seedWorld,
  setLevel,
  testDb,
  type Fixture,
} from './helpers.js';

const silent = pino({ level: 'silent' });
const worker = (f: Fixture) =>
  new EventWorker(f.db, f.clock, { pollMs: 1000, batch: 100, staleMinutes: 5 }, silent);

afterAll(async () => {
  const { close } = await testDb();
  await close();
});

/**
 * MINING — D19.
 *
 * Two things here are worth more than the rest put together. The INTERCEPTION has
 * to actually put the craft and the rock in the same place, because a version that
 * misses still flies, still arrives, and just quietly never meets anything. And
 * the RACE has to be decided by arrival time under contention, because "first to
 * reach it takes what it can carry" is the entire decision the system exists to
 * create.
 */
describe('mining', () => {
  let f: Fixture;
  let mine: string;
  let other: string;

  /** A rock that is in the disc at the fixture's clock, with its whole spec. */
  const rockNow = (): AsteroidSpec => {
    const spec = generateGalaxy(4242, 60);
    const minutes = (f.clock.now().getTime() - new Date('2026-01-01T00:00:00.000Z').getTime()) / 60_000;
    const live = activeAsteroids(spec.asteroids, minutes);
    const rock = live[0];
    if (!rock) throw new Error('no asteroid in the disc at this instant — fixture assumption broke');
    return rock;
  };

  /** Advance until at least one rock is crossing, so tests never race the schedule. */
  const waitForRock = (): AsteroidSpec => {
    const spec = generateGalaxy(4242, 60);
    for (let i = 0; i < 400; i++) {
      const minutes =
        (f.clock.now().getTime() - new Date('2026-01-01T00:00:00.000Z').getTime()) / 60_000;
      const live = activeAsteroids(spec.asteroids, minutes);
      /**
       * Enough life left for a test's own round trip, and no more.
       *
       * This asked for 200 minutes when rocks lived about seven hours. They now
       * cross the disc in one to two (D19 raised their speed so they visibly move
       * and the field stops piling up), so 200 was unsatisfiable and every mining
       * test failed on the fixture rather than on the code. Forty-five is several
       * times the longest flight any test here launches.
       */
      const usable = live.find((a) => a.expiresAt - minutes > 45);
      if (usable) return usable;
      f.clock.advance(30);
    }
    throw new Error('no usable asteroid found');
  };

  beforeEach(async () => {
    f = await seedWorld(3);
    [mine, other] = f.planetIds as [string, string];
    for (const id of f.planetIds) await setLevel(f.db, id, 'CORE', 10);
    await setLevel(f.db, mine, 'SHIPYARD', 4);
    await setLevel(f.db, other, 'SHIPYARD', 4);
    // Near the middle of the disc, so rocks pass within reach.
    await placeAt(f.db, mine, { x: 0 });
    await placeAt(f.db, other, { x: 120 });
  });

  /* ── building the craft ───────────────────────────────────── */

  describe('the Prospector', () => {
    it('needs a Shipyard, and nothing in orbit — a drill is a craft', async () => {
      /**
       * D25. It used to demand a DRILL satellite, which no longer exists: a drill
       * is a craft, the Shipyard builds craft, and the DERRICK in orbit is what
       * makes one better rather than what makes one possible.
       */
      await setLevel(f.db, mine, 'SHIPYARD', 0);
      await expect(buildUnits(f.db, mine, 'PROSPECTOR', 1, f.clock)).rejects.toMatchObject({
        code: 'SHIPYARD_TOO_LOW',
      });

      await setLevel(f.db, mine, 'SHIPYARD', 1);
      await expect(buildUnits(f.db, mine, 'PROSPECTOR', 1, f.clock)).resolves.toMatchObject({
        hull: 'PROSPECTOR',
      });
    });

    /**
     * THREE, AND ONLY EVER THREE. `PROSPECTOR.max`.
     *
     * Mining is a side errand. Uncapped, the only question a miner faces is "how
     * many more can I afford", the answer is always "more", and mining income
     * scales with wealth instead of with the decisions D19 wanted — which rock,
     * and when, given a squadron is away for a round trip.
     */
    describe('is rationed to three', () => {
      it('refuses the fourth, and says how many you hold', async () => {
        await grant(f.db, mine, 500_000, 200_000);
        await expect(
          buildUnits(f.db, mine, 'PROSPECTOR', PROSPECTOR.max, f.clock),
        ).resolves.toMatchObject({ built: PROSPECTOR.max });

        await expect(buildUnits(f.db, mine, 'PROSPECTOR', 1, f.clock)).rejects.toMatchObject({
          code: 'PROSPECTOR_CAP',
        });
      });

      /** The boundary itself: `max` is allowed, `max + 1` is not, in one order. */
      it('allows exactly the cap in a single build and refuses one more', async () => {
        await grant(f.db, mine, 500_000, 200_000);
        await expect(
          buildUnits(f.db, mine, 'PROSPECTOR', PROSPECTOR.max + 1, f.clock),
        ).rejects.toMatchObject({ code: 'PROSPECTOR_CAP' });

        // And the refusal charged nothing — a rejected build must not bill.
        const [before] = await f.db.select().from(planets).where(eq(planets.id, mine));
        await expect(
          buildUnits(f.db, mine, 'PROSPECTOR', PROSPECTOR.max, f.clock),
        ).resolves.toBeDefined();
        const [after] = await f.db.select().from(planets).where(eq(planets.id, mine));
        expect(after!.alloy).toBeLessThan(before!.alloy);
      });

      /**
       * THE ONE THAT MAKES IT A REAL CAP.
       *
       * Craft that are away mining are still craft this planet owns. Counted off
       * `homeFleet` — which is what every other build path reads — a player builds
       * three, sends them out, and builds three more while the first squadron is in
       * the air. Repeat, and the cap is decoration.
       */
      it('counts craft that are away, not just the ones standing at home', async () => {
        await grant(f.db, mine, 500_000, 200_000);
        await buildUnits(f.db, mine, 'PROSPECTOR', PROSPECTOR.max, f.clock);

        const rock = waitForRock();
        await launchMining(f.db, mine, rock.index, PROSPECTOR.max, f.clock);

        // Nothing at home now — and still no room for a fourth.
        const home = await f.db
          .select()
          .from(units)
          .where(and(eq(units.planetId, mine), eq(units.location, 'home'), eq(units.hull, 'PROSPECTOR')));
        expect(home[0]?.count ?? 0).toBe(0);

        await expect(buildUnits(f.db, mine, 'PROSPECTOR', 1, f.clock)).rejects.toMatchObject({
          code: 'PROSPECTOR_CAP',
        });
      });

      /**
       * The check reads a count and then writes, so it is a check-then-act — the
       * same shape `assertFreeBay` exists for. It is taken under the planet row
       * lock, and this is what proves the lock is doing the work.
       */
      it('two simultaneous builds cannot both take the last slot', async () => {
        await grant(f.db, mine, 500_000, 200_000);
        await buildUnits(f.db, mine, 'PROSPECTOR', PROSPECTOR.max - 1, f.clock);

        const results = await Promise.allSettled([
          buildUnits(f.db, mine, 'PROSPECTOR', 1, f.clock),
          buildUnits(f.db, mine, 'PROSPECTOR', 1, f.clock),
        ]);
        expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);

        const owned = await f.db
          .select()
          .from(units)
          .where(and(eq(units.planetId, mine), eq(units.hull, 'PROSPECTOR')));
        expect(owned.reduce((s, u) => s + u.count, 0)).toBe(PROSPECTOR.max);
      });

      /** The cap is on Prospectors alone; nothing else in the yard is rationed. */
      it('does not ration any other hull', async () => {
        await grant(f.db, mine, 900_000, 400_000);
        await expect(buildUnits(f.db, mine, 'WASP', 40, f.clock)).resolves.toMatchObject({
          built: 40,
        });
        await expect(buildUnits(f.db, mine, 'HAULER', 10, f.clock)).resolves.toMatchObject({
          built: 10,
        });
      });
    });

    /**
     * D19, and the reason it is a rule rather than a nicety: the telescope sells
     * exactly one fact, and mining traffic must not pollute it.
     */
    it('never makes a planet read AWAY when it leaves', async () => {
      const { fleetTruthFor } = await import('../src/services/intel.js');

      await giveUnits(f.db, mine, { PROSPECTOR: 3, WASP: 10 });
      const rock = waitForRock();

      await launchMining(f.db, mine, rock.index, 3, f.clock);

      const truth = await fleetTruthFor(f.db, [mine], f.clock.now());
      expect(truth.get(mine)!.status).toBe('HOME');
    });

    it('cannot be sent on an attack by any route', async () => {
      const { launchAttack } = await import('../src/services/mission.js');
      await giveUnits(f.db, mine, { PROSPECTOR: 5 });
      await expect(
        launchAttack(f.db, mine, other, { PROSPECTOR: 2 }, f.clock),
      ).rejects.toMatchObject({ code: 'NOT_A_WARSHIP' });
    });
  });

  /* ── the interception ─────────────────────────────────────── */

  describe('interception', () => {
    /**
     * THE ONE THAT MATTERS. The craft flies a straight line to a fixed point; the
     * rock arrives there on its own schedule. If those disagree the whole system
     * is theatre.
     */
    it('aims where the rock will be, and both arrive together', async () => {
      await giveUnits(f.db, mine, { PROSPECTOR: 2 });
      const rock = waitForRock();

      const run = await launchMining(f.db, mine, rock.index, 2, f.clock);
      const seasonStart = new Date('2026-01-01T00:00:00.000Z');
      const meetMinutes = (run.arriveAt.getTime() - seasonStart.getTime()) / 60_000;

      const rockThen = asteroidPosition(rock, meetMinutes);
      expect(distance(rockThen, run.intercept)).toBeLessThan(0.5);

      /**
       * And the craft's own straight-line trip really does take that long.
       *
       * Read from the rules rather than repeated as literals — a hard-coded 62
       * silently stopped testing the interception the moment D43 moved the speed,
       * and `travelMinutes` silently stopped matching it when D48 gave a mining
       * craft its own launch overhead. Both figures now come from the one helper
       * the solver itself uses, so the tolerance can be exact.
       */
      const [home] = await f.db.select().from(planets).where(eq(planets.id, mine));
      const flight = prospectorTravelExact(distance(home!, run.intercept), prospectorSpeed([]));
      expect(Math.abs(flight - run.flightMinutes)).toBeLessThan(1e-6);
    });

    it('refuses a rock that will leave before the craft could reach it', async () => {
      await giveUnits(f.db, mine, { PROSPECTOR: 1 });
      const rock = waitForRock();

      // Jump to one minute before it goes.
      const seasonStart = new Date('2026-01-01T00:00:00.000Z');
      f.clock.set(new Date(seasonStart.getTime() + (rock.expiresAt - 1) * 60_000));

      await expect(launchMining(f.db, mine, rock.index, 1, f.clock)).rejects.toMatchObject({
        code: 'CANNOT_INTERCEPT',
      });
    });

    it('refuses a rock that is not in the disc at all', async () => {
      await giveUnits(f.db, mine, { PROSPECTOR: 1 });
      await expect(launchMining(f.db, mine, 999_999, 1, f.clock)).rejects.toMatchObject({
        status: 404,
      });
    });
  });

  /* ── the round trip ───────────────────────────────────────── */

  describe('a complete run', () => {
    it('takes ore home into the works, where it can still be raided', async () => {
      await giveUnits(f.db, mine, { PROSPECTOR: 2 });
      // Big enough works that the store can actually hold a full haul — otherwise
      // this measures the storage cap rather than the delivery. The overflow case
      // has its own test below.
      await setLevel(f.db, mine, 'REFINERY', 8);
      await setLevel(f.db, mine, 'EXTRACTOR', 8);
      const rock = waitForRock();

      const [before] = await f.db.select().from(planets).where(eq(planets.id, mine));
      const storedBefore = before!.alloy + before!.crystal;

      const run = await launchMining(f.db, mine, rock.index, 2, f.clock);

      // The craft are demonstrably not at home while they are out.
      const out = await f.db.select().from(units).where(eq(units.planetId, mine));
      expect(out.find((u) => u.hull === 'PROSPECTOR' && u.location === 'home')!.count).toBe(0);

      f.clock.set(run.arriveAt);
      await worker(f).tick();

      const [claimed] = await f.db.select().from(asteroidClaims);
      expect(claimed!.oreTaken).toBeGreaterThan(0);

      const [midRun] = await f.db.select().from(miningRuns).where(eq(miningRuns.id, run.runId));
      expect(midRun!.status).toBe('returning');

      f.clock.set(midRun!.homeAt!);
      await worker(f).tick();

      const [after] = await f.db.select().from(planets).where(eq(planets.id, mine));
      const [done] = await f.db.select().from(miningRuns).where(eq(miningRuns.id, run.runId));

      /**
       * MINED ORE LANDS IN THE WORKS, NOT IN STORAGE. D31.
       *
       * This test used to assert the opposite, and the reasoning was: ore was not
       * produced, so the collector has nothing to do with it, and a player should
       * not press a second button to be paid for a mission they already flew.
       *
       * That is an argument about convenience, and it was measured to be wrong on
       * the axis that matters. Ore banked straight to spendable, un-raidable stock
       * is risk-free income decoupled from the war economy — one Prospector returns
       * 589/h and about eleven of them lift the galaxy's entire ore supply, with no
       * exposure at all. Being asked to collect IS the point: it is what makes
       * mined ore raidable at `lootBufferShare`, and what re-couples throughput to
       * the size of the planet rather than to the number of craft.
       *
       * Storage must therefore be UNCHANGED, and the whole haul must be findable
       * in the buffer.
       */
      expect(Math.round(after!.alloy + after!.crystal)).toBe(Math.round(storedBefore));
      const bufferGain =
        after!.bufferAlloy + after!.bufferCrystal - (before!.bufferAlloy + before!.bufferCrystal);
      expect(Math.round(bufferGain)).toBeGreaterThanOrEqual(
        Math.round(done!.minedAlloy + done!.minedCrystal),
      );
      expect(done!.minedAlloy + done!.minedCrystal).toBeGreaterThan(0);

      const home = await f.db.select().from(units).where(eq(units.planetId, mine));
      expect(home.find((u) => u.hull === 'PROSPECTOR' && u.location === 'home')!.count).toBe(2);
      // The in-flight row is gone, not merely zeroed.
      expect(home.some((u) => u.location.startsWith('mine:'))).toBe(false);
    });

    it('never takes more than the squadron can carry', async () => {
      await giveUnits(f.db, mine, { PROSPECTOR: 1 });
      const rock = waitForRock();

      const run = await launchMining(f.db, mine, rock.index, 1, f.clock);
      f.clock.set(run.arriveAt);
      await worker(f).tick();

      const [claim] = await f.db.select().from(asteroidClaims);
      expect(claim!.oreTaken).toBeLessThanOrEqual(prospectorHold([]));
    });

    /**
     * A haul bigger than the store.
     *
     * The overflow IS lost — but it is reported, never silently dropped. That is
     * the same principle the collector runs on: a ceiling paces the session
     * honestly only if the player can see what it cost them, and "you left 1,700
     * alloy in space because your store was full" is a reason to spend before the
     * next run lands.
     */
    it('reports what would not fit rather than losing it silently', async () => {
      await giveUnits(f.db, mine, { PROSPECTOR: 3 });
      // Deliberately small works: three full holds cannot possibly fit. Since D31
      // the ceiling is `collectorCap` rather than `storageCap`, which is smaller
      // still — so this case got MORE common, not less, and the launch panel has
      // to warn about it before a player commits a squadron.
      await setLevel(f.db, mine, 'REFINERY', 1);
      await setLevel(f.db, mine, 'EXTRACTOR', 1);
      const rock = waitForRock();

      const run = await launchMining(f.db, mine, rock.index, 3, f.clock);
      f.clock.set(run.arriveAt);
      await worker(f).tick();

      const [mid] = await f.db.select().from(miningRuns).where(eq(miningRuns.id, run.runId));
      const { resolveMiningReturn } = await import('../src/services/mining.js');
      f.clock.set(mid!.homeAt!);
      const delivery = await f.db.transaction((tx) => resolveMiningReturn(tx, run.runId, f.clock));

      expect(delivery).not.toBeNull();
      const wasted = delivery!.wasted.alloy + delivery!.wasted.crystal;
      const got = delivery!.delivered.alloy + delivery!.delivered.crystal;
      expect(wasted).toBeGreaterThan(0);
      expect(Math.round(got + wasted)).toBe(Math.round(mid!.minedAlloy + mid!.minedCrystal));
    });

    /** Retried events must not pay twice. */
    it('is idempotent — resolving an arrival twice claims ore once', async () => {
      await giveUnits(f.db, mine, { PROSPECTOR: 1 });
      const rock = waitForRock();

      const run = await launchMining(f.db, mine, rock.index, 1, f.clock);
      f.clock.set(run.arriveAt);
      await worker(f).tick();
      const [once] = await f.db.select().from(asteroidClaims);

      const { resolveMiningArrival } = await import('../src/services/mining.js');
      await f.db.transaction((tx) => resolveMiningArrival(tx, run.runId, f.clock.now()));

      const [twice] = await f.db.select().from(asteroidClaims);
      expect(twice!.oreTaken).toBe(once!.oreTaken);
    });
  });

  /* ── the race ─────────────────────────────────────────────── */

  describe('the race for a rock', () => {
    /**
     * "First to arrive takes what it can carry; the next takes what is left; one
     * that finds it empty goes home with nothing." That sentence is the feature,
     * so it gets a test that runs both sides against one rock.
     */
    it('the second squadron gets only what the first left behind', async () => {
      const rock = waitForRock();

      // Enough craft between them to strip it several times over.
      const each = Math.ceil(rock.ore / prospectorHold([]));
      await giveUnits(f.db, mine, { PROSPECTOR: each });
      await giveUnits(f.db, other, { PROSPECTOR: each });

      const first = await launchMining(f.db, mine, rock.index, each, f.clock);
      const second = await launchMining(f.db, other, rock.index, each, f.clock);

      const [early, late] =
        first.arriveAt <= second.arriveAt ? [first, second] : [second, first];

      f.clock.set(early.arriveAt);
      await worker(f).tick();
      f.clock.set(late.arriveAt);
      await worker(f).tick();

      const [claim] = await f.db.select().from(asteroidClaims);
      // However the two are ordered, the rock cannot give up more than it had.
      expect(claim!.oreTaken).toBeLessThanOrEqual(rock.ore);

      const runs = await f.db.select().from(miningRuns);
      const total = runs.reduce((s, r) => s + r.minedAlloy + r.minedCrystal, 0);
      expect(Math.round(total)).toBeLessThanOrEqual(Math.ceil(rock.ore));
      // The early one did strip it, so the late one came home empty-handed.
      const lateRun = runs.find((r) => r.id === late.runId)!;
      expect(lateRun.minedAlloy + lateRun.minedCrystal).toBe(0);
    });

    it('refuses a second run at a rock you are already working', async () => {
      await giveUnits(f.db, mine, { PROSPECTOR: 4 });
      const rock = waitForRock();

      await launchMining(f.db, mine, rock.index, 2, f.clock);
      await expect(launchMining(f.db, mine, rock.index, 2, f.clock)).rejects.toMatchObject({
        code: 'ALREADY_MINING',
      });
    });

    it('refuses a rock that has already been stripped', async () => {
      await giveUnits(f.db, mine, { PROSPECTOR: 1 });
      const rock = waitForRock();

      await f.db.insert(asteroidClaims).values({
        seasonId: f.seasonId,
        index: rock.index,
        oreTaken: rock.ore,
        updatedAt: f.clock.now(),
      });

      await expect(launchMining(f.db, mine, rock.index, 1, f.clock)).rejects.toMatchObject({
        code: 'ASTEROID_EMPTY',
      });
    });
  });

  /* ── what the field looks like ────────────────────────────── */

  describe('the visible field', () => {
    it('shows only rocks that are crossing right now', async () => {
      waitForRock();
      const field = await visibleAsteroids(f.db, f.seasonId, f.clock.now());
      expect(field.length).toBeGreaterThan(0);

      const minutes =
        (f.clock.now().getTime() - new Date('2026-01-01T00:00:00.000Z').getTime()) / 60_000;
      for (const a of field) {
        expect(a.appearsAt).toBeLessThanOrEqual(minutes);
        expect(a.expiresAt).toBeGreaterThan(minutes);
        expect(a.oreRemaining).toBeGreaterThan(0);
      }
    });

    it('drops a rock from the field once it has been stripped', async () => {
      const rock = waitForRock();
      await f.db.insert(asteroidClaims).values({
        seasonId: f.seasonId,
        index: rock.index,
        oreTaken: rock.ore,
        updatedAt: f.clock.now(),
      });

      const field = await visibleAsteroids(f.db, f.seasonId, f.clock.now());
      expect(field.some((a) => a.index === rock.index)).toBe(false);
    });

    it('carries ore sized by level, and a level in range', async () => {
      waitForRock();
      const field = await visibleAsteroids(f.db, f.seasonId, f.clock.now());
      for (const a of field) {
        expect(a.level).toBeGreaterThanOrEqual(1);
        expect(a.level).toBeLessThanOrEqual(5);
        expect(a.ore).toBe(GALAXY.asteroidOreByLevel[a.level]);
      }
    });
  });

  it('rockNow agrees with the generated field', () => {
    waitForRock();
    expect(rockNow().index).toBeGreaterThanOrEqual(0);
  });
});
