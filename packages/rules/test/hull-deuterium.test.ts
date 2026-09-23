import { describe, expect, it } from 'vitest';
import { HULLS } from '../src/hulls.js';

import type { HullId } from '../src/types.js';

/** D208 prices build isotope at A + 2C + 32D; tier 1 remains buildable without it.
 * Viper joins every other tier-2 hull on this chain (the reversal of D170).
 * Transports retain their recipes; their capacity is calibrated separately.
 */

/** The entry tier, which charges no deuterium at all. */
const FREE_OF_DEUTERIUM: readonly HullId[] = ['WARDEN', 'COURIER'];

/**
 * WHICH HULLS CHARGE ISOTOPE AT ALL. The amounts used to be frozen here too, hull by hull, as a
 * snapshot of the D208 migration — and two of them (Sentinel, Praetorian) have since been
 * rebalanced, which turned this file red while saying nothing about isotope. The set is the
 * durable claim; the ladder below is the other one. See `rises with the tier inside every family`.
 */
const CALIBRATED: readonly HullId[] = [
  'VIPER', 'TALON', 'STRONGHOLD', 'SENTINEL', 'WAYFARER',
  'TEMPEST', 'BALLISTA', 'LEVIATHAN', 'PRAETORIAN', 'ATLAS',
  'NULLIFIER', 'CATACLYSM', 'CITADEL',
];

/**
 * D196's three tier-4 hulls, which never had a pre-D170 figure to be halved from.
 * They are listed so the sweep below stays exhaustive — a hull that grows a
 * deuterium price without anybody noticing is exactly what it exists to catch.
 */
const ADDED_AT_D196: readonly HullId[] = ['CORSAIR', 'PALADIN', 'ARGOSY'];

describe('the deuterium a hull costs to build', () => {
  for (const id of FREE_OF_DEUTERIUM) {
    it(`${id} asks for none at all`, () => {
      expect(HULLS[id].deuterium).toBe(0);
    });
  }

  for (const id of CALIBRATED) {
    it(`${id} charges the monthly tier recipe`, () => {
      expect(HULLS[id].deuterium).toBeGreaterThan(0);
    });
  }

  /**
   * THE LADDER, WHICH IS WHAT THE FROZEN FIGURES WERE REALLY PROTECTING.
   *
   * Isotope is one figure per family per tier and it rises with the tier — Offensive runs
   * 0 · 2 · 6 · 20, Defensive 0 · 3 · 8 · 25, Cargo 0 · 12 · 48 · 130. Stated this way it catches
   * the thing the snapshot existed for (a hull quietly drifting off its tier's recipe) and stays
   * green through an ordinary rebalance, which the snapshot did not.
   */
  it('charges one isotope figure per tier inside a family, rising with the tier', () => {
    for (const family of ['OFFENSIVE', 'DEFENSIVE', 'CARGO'] as const) {
      const byTier = new Map<number, Set<number>>();
      for (const id of Object.keys(HULLS) as HullId[]) {
        const hull = HULLS[id];
        if (hull.family !== family || hull.tier === null || hull.ground) continue;
        byTier.set(hull.tier, (byTier.get(hull.tier) ?? new Set()).add(hull.deuterium));
      }
      const tiers = [...byTier.keys()].sort((a, b) => a - b);
      expect(tiers.length, family).toBeGreaterThan(2);
      for (const tier of tiers) {
        expect([...byTier.get(tier)!], `${family} tier ${String(tier)}`).toHaveLength(1);
      }
      for (let i = 1; i < tiers.length; i++) {
        expect([...byTier.get(tiers[i]!)!][0]!, `${family} tier ${String(tiers[i]!)}`)
          .toBeGreaterThan([...byTier.get(tiers[i - 1]!)!][0]!);
      }
    }
  });

  /** Nothing else grew a deuterium price while the rest were being cut. */
  it('leaves no hull charging deuterium outside the two lists', () => {
    const charging = (Object.keys(HULLS) as HullId[])
      .filter((id) => HULLS[id].deuterium > 0)
      .sort();
    expect(charging).toEqual([...CALIBRATED, ...ADDED_AT_D196].sort());
  });

  /**
   * THE TIER THE CHAIN STARTS AT, ASSERTED AS A ROW RATHER THAN AS ONE HULL.
   *
   * This is the claim the owner actually made — not "the Viper costs 25" but "a
   * tier-2 hull costs deuterium, and one of them did not". Written against the
   * table so a future hull added at this tier cannot quietly arrive free.
   */
  it('charges every tier-2 hull for deuterium, with no exception left', () => {
    const freeAtTierTwo = (Object.keys(HULLS) as HullId[])
      .filter((id) => HULLS[id].tier === 2 && HULLS[id].deuterium === 0);
    expect(freeAtTierTwo).toEqual([]);
  });

  /** And the entry tier still charges none, which is the half of D170 that stands. */
  it('leaves the entry tier free of it', () => {
    const chargingAtTierOne = (Object.keys(HULLS) as HullId[])
      .filter((id) => HULLS[id].tier === 1 && HULLS[id].deuterium > 0);
    expect(chargingAtTierOne).toEqual([]);
  });

  /*
    REMOVED 2026-09-22: `links deuterium to the monthly resource recipes`.

    It asserted three alloy prices to say "this change is one column wide" — a guard for the D208
    migration, on the day of that migration. The migration is long finished and the catalogue has
    been rebalanced since, so all the test could do was go red and claim isotope was broken when
    alloy had moved. The two tests above it hold the claim that outlives the migration: tier 1
    charges none, every tier 2 charges some, and the set of charging hulls is exactly the authored
    list.
  */
});
