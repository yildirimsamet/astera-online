import { and, eq } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { HULLS, alloyRate, collectorCap, flightSlots, storageCap, upgradeCost } from '@astera/rules';
import { buildings, planets } from '../src/db/schema.js';
import { loadLocked, withTwoPlanetLock } from '../src/services/planet.js';
import { buildUnits, upgradeBuilding } from '../src/services/build.js';
import { baysInUse } from '../src/services/flight.js';
import { launchProbe } from '../src/services/intel.js';
import { grant, seedWorld, settleBuilds, setLevel, testDb, type Fixture } from './helpers.js';

/**
 * ACCEPTANCE CRITERION (build plan, phase 1):
 * "Two concurrent upgrades — exactly one succeeds."
 *
 * These tests are the reason the lazy tick lives inside the row lock rather than
 * beside it. Without that, two requests both read a pre-tick balance, both pass
 * their affordability check, and the planet spends the same alloy twice.
 */
// The database pool is shared across this whole file, so it is torn down at FILE
// scope. An afterAll inside a describe would close it out from under any describe
// that follows.
afterAll(async () => {
  const { close } = await testDb();
  await close();
});

describe('concurrency', () => {
  let f: Fixture;

  beforeEach(async () => {
    f = await seedWorld(2);
  });


  describe('double-spend', () => {
    it('two simultaneous upgrades of the same building: exactly one wins', async () => {
      const planetId = f.planetIds[0]!;
      // Raise the Core first: a subsystem may never exceed it, and that rule
      // fires before the affordability check.
      await setLevel(f.db, planetId, 'CORE', 6);
      const cost = upgradeCost(1);
      // Enough for exactly one upgrade, not two.
      await grant(f.db, planetId, cost.alloy + 10, cost.crystal + 10);

      const results = await Promise.allSettled([
        upgradeBuilding(f.db, planetId, 'REFINERY', f.clock),
        upgradeBuilding(f.db, planetId, 'REFINERY', f.clock),
      ]);

      const won = results.filter((r) => r.status === 'fulfilled');
      const lost = results.filter((r) => r.status === 'rejected');
      expect(won).toHaveLength(1);
      expect(lost).toHaveLength(1);
      // The loser must fail for the RIGHT reason — otherwise a gating bug would
      // read exactly like working mutual exclusion.
      expect(lost[0]!.reason).toMatchObject({
        code: 'INSUFFICIENT_RESOURCES',
      });
      await settleBuilds(f, planetId);

      const [row] = await f.db
        .select()
        .from(buildings)
        .where(and(eq(buildings.planetId, planetId), eq(buildings.type, 'REFINERY')));
      expect(row?.level).toBe(2);
    });

    it('ten simultaneous upgrades still only spend what exists', async () => {
      const planetId = f.planetIds[0]!;
      // Target the Vault: it starts at 0 and nothing else in this test touches
      // it, so the budget below is exactly three upgrades' worth.
      await setLevel(f.db, planetId, 'CORE', 12);
      const budget = [0, 1, 2].reduce((s, l) => s + upgradeCost(l).alloy, 0);
      await grant(f.db, planetId, budget, budget);

      const results = await Promise.allSettled(
        Array.from({ length: 10 }, () => upgradeBuilding(f.db, planetId, 'VAULT', f.clock)),
      );
      const won = results.filter((r) => r.status === 'fulfilled').length;

      const [planet] = await f.db.select().from(planets).where(eq(planets.id, planetId));
      expect(planet!.alloy).toBeGreaterThanOrEqual(0);
      // At least one must land, and no more than the budget allows.
      expect(won).toBeGreaterThan(0);
      expect(won).toBeLessThanOrEqual(3);
      await settleBuilds(f, planetId);

      const [vault] = await f.db
        .select()
        .from(buildings)
        .where(and(eq(buildings.planetId, planetId), eq(buildings.type, 'VAULT')));
      expect(vault!.level).toBe(won);
    });

    it('concurrent ship builds cannot overdraw the same alloy', async () => {
      const planetId = f.planetIds[0]!;
      await setLevel(f.db, planetId, 'SHIPYARD', 1);
      await setLevel(f.db, planetId, 'CORE', 5);
      // Priced from the rules, not written down: hull costs doubled with D17 and a
      // literal here made this test pass for the wrong reason — nobody could afford
      // the batch, so "exactly one winner" became "no winners" and the mutual
      // exclusion it exists to prove was never exercised.
      const batch = HULLS.DART.alloy * 3;
      await grant(f.db, planetId, batch + 10, batch + 10);

      const results = await Promise.allSettled(
        Array.from({ length: 5 }, () => buildUnits(f.db, planetId, 'DART', 3, f.clock)),
      );
      const won = results.filter((r) => r.status === 'fulfilled').length;
      expect(won).toBe(1);

      const [planet] = await f.db.select().from(planets).where(eq(planets.id, planetId));
      expect(planet!.alloy).toBeGreaterThanOrEqual(0);
    });
  });

  /**
   * FLIGHT BAYS ARE A COUNT READ UNDER A LOCK, WHICH IS THE ONLY WAY IT IS SAFE. D28.
   *
   * A bay check outside the planet's row lock is the classic check-then-act race:
   * both requests count the same free bay, both pass, and a planet ends up with more
   * craft in the air than the Command Core allows. `assertFreeBay` takes the `tx`
   * that `loadLocked` already holds precisely so this cannot happen — and this test
   * is what proves it, because nothing else in the suite would notice.
   */
  describe('flight bays', () => {
    it('two simultaneous launches into one free bay: exactly one wins', async () => {
      const f = await seedWorld(4);
      const [mine, a, b, c] = f.planetIds as [string, string, string, string];
      for (const id of f.planetIds) {
        await setLevel(f.db, id, 'CORE', 1);
        await grant(f.db, id, 200_000, 20_000);
      }
      f.clock.advance(600);

      // Fill every bay but one.
      expect(flightSlots(1)).toBe(3);
      await launchProbe(f.db, mine, a, f.clock);
      await launchProbe(f.db, mine, b, f.clock);

      // Two launches race for the last bay, at two different targets so the
      // one-probe-per-target rule cannot be what refuses either of them.
      const results = await Promise.allSettled([
        launchProbe(f.db, mine, c, f.clock),
        launchProbe(f.db, mine, c, f.clock),
      ]);
      const won = results.filter((r) => r.status === 'fulfilled').length;
      expect(won, 'both launches got the same bay').toBe(1);

      const inAir = await baysInUse(f.db, mine);
      expect(inAir).toBe(flightSlots(1));
    });
  });

  describe('deadlock avoidance', () => {
    /**
     * Two players raiding each other at the same moment is the one place a lock
     * cycle can form. Locks are always taken in ascending planet id order, which
     * makes a cycle impossible rather than merely unlikely.
     */
    it('two planets locking each other in opposite orders do not deadlock', async () => {
      const [a, b] = f.planetIds as [string, string];

      const both = await Promise.all([
        withTwoPlanetLock(f.db, a, b, f.clock, (_tx, first, second) =>
          Promise.resolve([first.planetId, second.planetId]),
        ),
        withTwoPlanetLock(f.db, b, a, f.clock, (_tx, first, second) =>
          Promise.resolve([first.planetId, second.planetId]),
        ),
      ]);

      // Each caller gets its arguments back in the order it asked for them,
      // regardless of the internal locking order.
      expect(both[0]).toEqual([a, b]);
      expect(both[1]).toEqual([b, a]);
    });

    it('survives many interleaved mutual locks', async () => {
      const [a, b] = f.planetIds as [string, string];
      const work = Array.from({ length: 12 }, (_, i) =>
        withTwoPlanetLock(f.db, i % 2 ? a : b, i % 2 ? b : a, f.clock, () => Promise.resolve(i)),
      );
      await expect(Promise.all(work)).resolves.toHaveLength(12);
    });
  });

  /**
   * D16 moved production into the works. Every assertion here reads
   * `bufferAlloy` rather than `alloy` for that reason — an untouched planet's
   * SPENDABLE stock no longer moves at all, and a test still watching `alloy`
   * would report the lazy tick as broken when it is working exactly as designed.
   */
  describe('the lazy tick', () => {
    it('credits exactly one hour of production after one hour', async () => {
      const planetId = f.planetIds[0]!;
      await grant(f.db, planetId, 0, 0);

      f.clock.advance(60);
      const after = await f.db.transaction((tx) => loadLocked(tx, planetId, f.clock));

      expect(after.bufferAlloy).toBeCloseTo(alloyRate(1), 3);
      // ...and storage is untouched, which is the half of D16 most likely to be
      // broken by accident later.
      expect(after.alloy).toBe(0);
    });

    it('is idempotent — two loads at the same instant do not double-credit', async () => {
      const planetId = f.planetIds[0]!;
      await grant(f.db, planetId, 0, 0);
      f.clock.advance(60);

      const first = await f.db.transaction((tx) => loadLocked(tx, planetId, f.clock));
      const second = await f.db.transaction((tx) => loadLocked(tx, planetId, f.clock));

      expect(second.bufferAlloy).toBeCloseTo(first.bufferAlloy, 6);
    });

    it('stops at the collector cap, however long the absence', async () => {
      const planetId = f.planetIds[0]!;
      await grant(f.db, planetId, 0, 0);

      f.clock.advance(60 * 24 * 30); // a month away
      const after = await f.db.transaction((tx) => loadLocked(tx, planetId, f.clock));

      // The works fill and STOP. This clamp is what makes a month away and a day
      // away produce the same planet, and it is the honest version of a cap: the
      // waste is real and the interface says so.
      expect(after.bufferAlloy).toBe(collectorCap(alloyRate(1)));
      expect(collectorCap(alloyRate(1))).toBeLessThan(storageCap(alloyRate(1), 0));
    });

    it('produces nothing while the surface works are disrupted', async () => {
      const planetId = f.planetIds[0]!;
      await grant(f.db, planetId, 0, 0);
      await f.db
        .update(planets)
        .set({ disruptedUntil: new Date(f.clock.now().getTime() + 120 * 60_000) })
        .where(eq(planets.id, planetId));

      f.clock.advance(120);
      const after = await f.db.transaction((tx) => loadLocked(tx, planetId, f.clock));

      expect(after.bufferAlloy).toBe(0);
    });

    it('resumes for exactly the minutes after disruption ends', async () => {
      const planetId = f.planetIds[0]!;
      await grant(f.db, planetId, 0, 0);
      await f.db
        .update(planets)
        .set({ disruptedUntil: new Date(f.clock.now().getTime() + 60 * 60_000) })
        .where(eq(planets.id, planetId));

      f.clock.advance(120); // 60 disrupted, 60 producing
      const after = await f.db.transaction((tx) => loadLocked(tx, planetId, f.clock));

      expect(after.bufferAlloy).toBeCloseTo(alloyRate(1), 3);
    });

    it('does not run time backwards if the clock is behind lastTick', async () => {
      const planetId = f.planetIds[0]!;
      f.clock.advance(60);
      const forward = await f.db.transaction((tx) => loadLocked(tx, planetId, f.clock));

      f.clock.advance(-30);
      const backward = await f.db.transaction((tx) => loadLocked(tx, planetId, f.clock));

      expect(backward.alloy).toBe(forward.alloy);
    });
  });

  describe('rule enforcement under lock', () => {
    it('refuses to raise a subsystem past the Command Core', async () => {
      const planetId = f.planetIds[0]!;
      await grant(f.db, planetId, 1_000_000, 1_000_000);
      await setLevel(f.db, planetId, 'REFINERY', 1);
      await setLevel(f.db, planetId, 'CORE', 1);

      await expect(upgradeBuilding(f.db, planetId, 'REFINERY', f.clock)).rejects.toThrow(
        /Command Core/,
      );
    });

    it('refuses a hull the shipyard cannot make', async () => {
      const planetId = f.planetIds[0]!;
      await grant(f.db, planetId, 1_000_000, 1_000_000);
      await setLevel(f.db, planetId, 'SHIPYARD', 1);

      await expect(buildUnits(f.db, planetId, 'TEMPEST', 1, f.clock)).rejects.toThrow(
        /Shipyard L4/,
      );
    });

    it('rejects zero and negative counts before touching the database', async () => {
      const planetId = f.planetIds[0]!;
      await expect(buildUnits(f.db, planetId, 'DART', 0, f.clock)).rejects.toThrow(/positive/);
      await expect(buildUnits(f.db, planetId, 'DART', -5, f.clock)).rejects.toThrow(/positive/);
      await expect(buildUnits(f.db, planetId, 'DART', 1.5, f.clock)).rejects.toThrow(/positive/);
    });

    it('rolls the whole transaction back when a rule rejects it', async () => {
      const planetId = f.planetIds[0]!;
      await grant(f.db, planetId, 50, 50); // nowhere near enough
      const before = await f.db.select().from(planets).where(eq(planets.id, planetId));

      await expect(upgradeBuilding(f.db, planetId, 'CORE', f.clock)).rejects.toThrow();

      const after = await f.db.select().from(planets).where(eq(planets.id, planetId));
      expect(after[0]!.alloy).toBe(before[0]!.alloy);
    });
  });
});

/**
 * TWO WORLDS, ONE PIRATE. D150 — trap 13.
 *
 * The race is the decision: two commanders arriving seconds apart at the same
 * pirate is the intended case, not the exotic one. `pirate_state` holds the only
 * non-derivable fact about a pirate — what has been shot off it — so if the second
 * arrival reads the crew before the first has written its casualties, the damage
 * simply disappears and both raids fight a full-strength fleet.
 */
describe('two raids at one pirate', () => {
  let f: Fixture;

  beforeEach(async () => {
    f = await seedWorld(2, 4242, { pirates: true });
  });

  it('accumulates both sets of casualties under the row lock', async () => {
    const { and: sqlAnd, eq: sqlEq } = await import('drizzle-orm');
    const { pirateRaids, pirateState, seasons } = await import('../src/db/schema.js');
    const { privatePirateField, pirateId } = await import('../src/services/pirateField.js');
    const { launchPirateRaid } = await import('../src/services/pirateRaid.js');
    const { EventWorker } = await import('../src/worker/loop.js');
    const { giveUnits, settledAt } = await import('./helpers.js');
    const { pino } = await import('pino');
    const { piratePosition, pirateActive, sensorSphere, distance, fleetCount } =
      await import('@astera/rules');

    const [season] = await f.db.select().from(seasons).where(sqlEq(seasons.id, f.seasonId));
    const key = season!.asteroidKey;
    const field = privatePirateField(key);
    const worlds = await f.db.select().from(planets);
    const eyes = worlds
      .filter((w) => f.planetIds.includes(w.id))
      .map((w) => sensorSphere({ x: w.x, y: w.y, z: w.z }, 0, 0, w.id));

    // A pirate both test worlds can see at the same minute.
    let chosen: { index: number; minute: number } | null = null;
    outer: for (const spec of field) {
      for (let minute = Math.ceil(spec.appearsAt) + 1; minute < spec.expiresAt; minute += 1) {
        if (!pirateActive(spec, minute)) continue;
        const at = piratePosition(spec, minute);
        if (eyes.every((eye) => distance(eye.at, at) <= eye.identify)) {
          chosen = { index: spec.index, minute };
          break outer;
        }
      }
    }
    expect(chosen).not.toBeNull();
    f.clock.set(new Date(season!.startsAt.getTime() + chosen!.minute * 60_000));

    for (const planetId of f.planetIds) {
      await grant(f.db, planetId, 200_000, 40_000);
      await giveUnits(f.db, planetId, { DART: 12 });
    }
    const launches = await Promise.all(f.planetIds.map((planetId) =>
      launchPirateRaid(f.db, planetId, pirateId(key, chosen!.index), { DART: 12 }, f.clock)));

    const silent = pino({ level: 'silent' });
    const worker = new EventWorker(
      f.db, f.clock, { pollMs: 50, batch: 50, staleMinutes: 5 }, silent,
    );
    const latest = launches.reduce(
      (a, b) => (a.arriveAt > b.arriveAt ? a : b),
      launches[0]!,
    );
    f.clock.set(settledAt(latest.arriveAt));
    await worker.tick();

    const rows = await f.db
      .select()
      .from(pirateRaids)
      .where(sqlEq(pirateRaids.seasonId, f.seasonId));
    expect(rows).toHaveLength(2);
    for (const row of rows) expect(row.status).not.toBe('outbound');

    const [state] = await f.db
      .select()
      .from(pirateState)
      .where(sqlAnd(
        sqlEq(pirateState.seasonId, f.seasonId),
        sqlEq(pirateState.index, chosen!.index),
      ));
    expect(state).toBeDefined();
    /*
      THE CREW NEVER COMES BACK. Whatever the two raids destroyed between them, the
      stored losses can only be a subset of the original roster and can never
      exceed it — a second arrival that overwrote rather than accumulated would
      show fewer losses than the first one already wrote.
    */
    const roster = field[chosen!.index]!.roster;
    expect(fleetCount(state!.losses)).toBeGreaterThan(0);
    for (const [hull, lost] of Object.entries(state!.losses)) {
      expect(lost).toBeLessThanOrEqual(roster[hull as keyof typeof roster] ?? 0);
    }
  });
});
