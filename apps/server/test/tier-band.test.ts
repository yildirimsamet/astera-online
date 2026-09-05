import { eq } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { planets } from '../src/db/schema.js';
import { launchAttack } from '../src/services/mission.js';
import { peakCoreLevels } from '../src/services/player.js';
import {
  fuelUp,
  giveUnits,
  seedWorld,
  setLevel,
  testDb,
  type Fixture,
} from './helpers.js';

/**
 * WHO MAY FIGHT WHOM, AND ON WHOSE DEVELOPMENT. D168.
 *
 * The band itself is arithmetic and is proved in `packages/rules`
 * (`foundations.test.ts`). What is proved HERE is the part a unit test cannot
 * reach: that the gate measures the two COMMANDERS and not the two worlds in the
 * launch. That distinction is the whole rule — a planet-measured band is bought
 * off with an undeveloped colony, and the failure mode is silent: every launch
 * still succeeds, the beginner is still farmed, and no test that only checks the
 * arithmetic notices.
 *
 * So each case below arranges a holding whose PEAK disagrees with the world in
 * front of the launch, and asserts the peak wins.
 */
afterAll(async () => {
  const { close } = await testDb();
  await close();
});

describe('the development band at launch', () => {
  let f: Fixture;
  let attacker: string;
  let defender: string;
  let spare: string;

  beforeEach(async () => {
    f = await seedWorld(3);
    [attacker, defender, spare] = f.planetIds as [string, string, string];
    await giveUnits(f.db, attacker, { DART: 20 });
    await fuelUp(f.db, attacker);
    await giveUnits(f.db, spare, { DART: 20 });
    await fuelUp(f.db, spare);
  });

  /** Hand a world to another commander as a colony, the way a capture would. */
  const colonyFor = async (planetId: string, playerIndex: number): Promise<void> => {
    await f.db
      .update(planets)
      .set({ controllerPlayerId: f.playerIds[playerIndex]!, kind: 'COLONY' })
      .where(eq(planets.id, planetId));
  };

  describe('the band itself', () => {
    it('lets two commanders of the same tier fight', async () => {
      await setLevel(f.db, attacker, 'CORE', 8); // tier 3
      await setLevel(f.db, defender, 'CORE', 7); // tier 3

      await expect(
        launchAttack(f.db, attacker, defender, { DART: 5 }, f.clock),
      ).resolves.toBeTruthy();
    });

    it('lets a commander reach one tier up', async () => {
      await setLevel(f.db, attacker, 'CORE', 8); // tier 3
      await setLevel(f.db, defender, 'CORE', 11); // tier 4

      await expect(
        launchAttack(f.db, attacker, defender, { DART: 5 }, f.clock),
      ).resolves.toBeTruthy();
    });

    it('refuses a target two tiers up', async () => {
      await setLevel(f.db, attacker, 'CORE', 8); // tier 3
      await setLevel(f.db, defender, 'CORE', 14); // tier 5

      await expect(
        launchAttack(f.db, attacker, defender, { DART: 5 }, f.clock),
      ).rejects.toMatchObject({ code: 'TIER_BAND' });
    });

    it('refuses a target two tiers down — this is the beginner the band protects', async () => {
      await setLevel(f.db, attacker, 'CORE', 14); // tier 5
      await setLevel(f.db, defender, 'CORE', 8); // tier 3

      await expect(
        launchAttack(f.db, attacker, defender, { DART: 5 }, f.clock),
      ).rejects.toMatchObject({ code: 'TIER_BAND_WEAK' });
    });

    it('refuses before anything is spent — the fleet stays home and the tank is full', async () => {
      await setLevel(f.db, attacker, 'CORE', 14);
      await setLevel(f.db, defender, 'CORE', 8);
      const [before] = await f.db.select().from(planets).where(eq(planets.id, attacker));

      await expect(
        launchAttack(f.db, attacker, defender, { DART: 5 }, f.clock),
      ).rejects.toMatchObject({ code: 'TIER_BAND_WEAK' });

      const [after] = await f.db.select().from(planets).where(eq(planets.id, attacker));
      expect(after!.deuterium).toBe(before!.deuterium);
    });
  });

  /**
   * THE COMMANDER, NOT THE PAD. Owner instruction: *"Gezegen'den çıkan filoya
   * bakılmayacak. User bazında bakılacak."*
   */
  describe('whose development is measured', () => {
    it('refuses a raid flown out of a small colony by a large commander', async () => {
      // The capital is tier 5; the colony the fleet leaves from is tier 1.
      await setLevel(f.db, attacker, 'CORE', 14);
      await colonyFor(spare, 0);
      await setLevel(f.db, spare, 'CORE', 1);
      await setLevel(f.db, defender, 'CORE', 2); // tier 1

      // Measured on the pad this is tier 1 against tier 1 and perfectly legal.
      await expect(
        launchAttack(f.db, spare, defender, { DART: 5 }, f.clock),
      ).rejects.toMatchObject({ code: 'TIER_BAND_WEAK' });
    });

    it('refuses a raid aimed at a small colony held by a large commander', async () => {
      await setLevel(f.db, attacker, 'CORE', 2); // tier 1
      await colonyFor(spare, 1);
      await setLevel(f.db, spare, 'CORE', 1); // the colony reads tier 1
      await setLevel(f.db, defender, 'CORE', 14); // its owner is tier 5

      await expect(
        launchAttack(f.db, attacker, spare, { DART: 5 }, f.clock),
      ).rejects.toMatchObject({ code: 'TIER_BAND' });
    });

    it('allows a raid on a small colony whose owner is inside the band', async () => {
      await setLevel(f.db, attacker, 'CORE', 8); // tier 3
      await colonyFor(spare, 1);
      await setLevel(f.db, spare, 'CORE', 1); // tier 1 world…
      await setLevel(f.db, defender, 'CORE', 7); // …tier 3 commander

      await expect(
        launchAttack(f.db, attacker, spare, { DART: 5 }, f.clock),
      ).resolves.toBeTruthy();
    });
  });

  describe('peakCoreLevels', () => {
    it('reports the tallest Core each commander holds', async () => {
      await setLevel(f.db, attacker, 'CORE', 5);
      await colonyFor(spare, 0);
      await setLevel(f.db, spare, 'CORE', 12);
      await setLevel(f.db, defender, 'CORE', 3);

      const peaks = await peakCoreLevels(f.db, [f.playerIds[0]!, f.playerIds[1]!]);
      expect(peaks.get(f.playerIds[0]!)).toBe(12);
      expect(peaks.get(f.playerIds[1]!)).toBe(3);
    });

    /**
     * A commander with nothing left standing still has to answer this question:
     * the band is read on a live launch, and `undefined` would silently become
     * `NaN` inside `coreTier`.
     */
    it('floors a commander who holds nothing at level 1', async () => {
      await f.db
        .update(planets)
        .set({ controllerPlayerId: null, kind: 'NEUTRAL' })
        .where(eq(planets.id, defender));

      const peaks = await peakCoreLevels(f.db, [f.playerIds[1]!]);
      expect(peaks.get(f.playerIds[1]!)).toBe(1);
    });

    it('asks nothing of the database for an empty list', async () => {
      await expect(peakCoreLevels(f.db, [])).resolves.toEqual(new Map());
    });
  });
});
