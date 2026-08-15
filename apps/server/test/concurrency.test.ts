import { and, eq } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { alloyRate, storageCap, upgradeCost } from '@blindspace/rules';
import { buildings, planets } from '../src/db/schema.js';
import { loadLocked, withTwoPlanetLock } from '../src/services/planet.js';
import { buildUnits, upgradeBuilding } from '../src/services/build.js';
import { grant, seedWorld, setLevel, testDb, type Fixture } from './helpers.js';

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
      await grant(f.db, planetId, 1000, 1000); // three Wasps at 260 each

      const results = await Promise.allSettled(
        Array.from({ length: 5 }, () => buildUnits(f.db, planetId, 'WASP', 3, f.clock)),
      );
      const won = results.filter((r) => r.status === 'fulfilled').length;
      expect(won).toBe(1);

      const [planet] = await f.db.select().from(planets).where(eq(planets.id, planetId));
      expect(planet!.alloy).toBeGreaterThanOrEqual(0);
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

  describe('the lazy tick', () => {
    it('credits exactly one hour of production after one hour', async () => {
      const planetId = f.planetIds[0]!;
      await grant(f.db, planetId, 0, 0);

      f.clock.advance(60);
      const after = await f.db.transaction((tx) => loadLocked(tx, planetId, f.clock));

      expect(after.alloy).toBeCloseTo(alloyRate(1), 3);
    });

    it('is idempotent — two loads at the same instant do not double-credit', async () => {
      const planetId = f.planetIds[0]!;
      await grant(f.db, planetId, 0, 0);
      f.clock.advance(60);

      const first = await f.db.transaction((tx) => loadLocked(tx, planetId, f.clock));
      const second = await f.db.transaction((tx) => loadLocked(tx, planetId, f.clock));

      expect(second.alloy).toBeCloseTo(first.alloy, 6);
    });

    it('never exceeds the storage cap, however long the absence', async () => {
      const planetId = f.planetIds[0]!;
      await grant(f.db, planetId, 0, 0);

      f.clock.advance(60 * 24 * 30); // a month away
      const after = await f.db.transaction((tx) => loadLocked(tx, planetId, f.clock));

      expect(after.alloy).toBe(storageCap(alloyRate(1)));
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

      expect(after.alloy).toBe(0);
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

      expect(after.alloy).toBeCloseTo(alloyRate(1), 3);
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

      await expect(buildUnits(f.db, planetId, 'BULWARK', 1, f.clock)).rejects.toThrow(
        /Shipyard L4/,
      );
    });

    it('rejects zero and negative counts before touching the database', async () => {
      const planetId = f.planetIds[0]!;
      await expect(buildUnits(f.db, planetId, 'WASP', 0, f.clock)).rejects.toThrow(/positive/);
      await expect(buildUnits(f.db, planetId, 'WASP', -5, f.clock)).rejects.toThrow(/positive/);
      await expect(buildUnits(f.db, planetId, 'WASP', 1.5, f.clock)).rejects.toThrow(/positive/);
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
