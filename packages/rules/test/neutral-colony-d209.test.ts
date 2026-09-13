import { describe, expect, it } from 'vitest';
import {
  HULLS,
  MULTI_WORLD,
  SATELLITE_IDS,
  buildMinutes,
  robotSpeedMult,
  satelliteCost,
  satelliteMinutes,
  colonyCapacity,
  generateGalaxy,
  groundLoad,
  groundSlots,
  hasColonyCapacity,
  nextColonyCore,
  scaleNeutralDeuteriumLoot,
  selectNeutralSlots,
  shieldHp,
} from '../src/index.js';

/**
 * D209 — OWNER INSTRUCTION, after the first ruleset-8 season opened with three T2
 * colonies and full inherited stores inside three hours.
 *
 * A caretaker world is guarded at every tier, a captured world opens on a fixed
 * tier stock instead of whatever the caretaker was holding, colonies arrive at
 * Core 9 / 12 / 15, and the galaxy carries 38 / 19 / 8 of them.
 */
describe('D209 neutral garrisons', () => {
  it('guards tier 1 with twelve Darts, six Pikes, one Viper, one Stronghold, one Thorn and Aegis 1', () => {
    const t1 = MULTI_WORLD.neutral[1];
    expect(t1.fleet).toEqual({ DART: 12, PIKE: 6, VIPER: 1, STRONGHOLD: 1 });
    expect(t1.ground).toEqual({ THORN: 1 });
    expect(t1.instruments).toEqual({ AEGIS: 1 });
    expect(t1.deuteriumLootMultiplier).toBe(0.30);
  });

  it('guards tier 2 with a mixed wing, two of each gun and an Aegis at level 2', () => {
    const t2 = MULTI_WORLD.neutral[2];
    expect(t2.fleet).toEqual({ DART: 20, PIKE: 20, VIPER: 8, STRONGHOLD: 8 });
    expect(t2.ground).toEqual({ THORN: 2, BASTION: 2 });
    expect(t2.instruments).toEqual({ AEGIS: 2 });
    expect(t2.deuteriumLootMultiplier).toBe(0.50);
  });

  it('guards tier 3 with the full roster, 5 Thorns, 3 Bastions and an Aegis at level 4', () => {
    const t3 = MULTI_WORLD.neutral[3];
    expect(t3.fleet).toEqual({
      VIPER: 15, STRONGHOLD: 15, TEMPEST: 5, BALLISTA: 5, SENTINEL: 5, LEVIATHAN: 5, PRAETORIAN: 5,
    });
    // Five Bastions were asked for and do not fit Core 8; the owner chose three (84 of 100).
    expect(t3.ground).toEqual({ THORN: 5, BASTION: 3 });
    expect(t3.instruments).toEqual({ AEGIS: 4 });
    expect(t3.deuteriumLootMultiplier).toBe(0.70);
  });

  it.each([
    [1, 30], [2, 50], [3, 70],
  ] as const)('keeps only the owner-authored tier %i share of neutral deuterium loot', (tier, expected) => {
    const loot = {
      alloy: 300, crystal: 200, deuterium: 100,
      fromStock: { alloy: 200, crystal: 150, deuterium: 61 },
      fromBuffer: { alloy: 100, crystal: 50, deuterium: 39 },
    };
    const scaled = scaleNeutralDeuteriumLoot(loot, tier);
    const expectedStock = Math.floor(61 * expected / 100);
    expect(scaled).toEqual({
      alloy: 300, crystal: 200, deuterium: expected,
      fromStock: { alloy: 200, crystal: 150, deuterium: expectedStock },
      fromBuffer: { alloy: 100, crystal: 50, deuterium: expected - expectedStock },
    });
    expect(loot.deuterium).toBe(100);
  });

  it('keeps every garrison on real hulls, flying hulls in fleet and guns on the ground', () => {
    for (const tier of [1, 2, 3] as const) {
      const template = MULTI_WORLD.neutral[tier];
      for (const hull of Object.keys(template.fleet)) {
        expect(HULLS[hull as keyof typeof HULLS].ground, hull).toBe(false);
      }
      for (const hull of Object.keys(template.ground)) {
        expect(HULLS[hull as keyof typeof HULLS].ground, hull).toBe(true);
      }
      expect(groundLoad(template.ground)).toBeLessThanOrEqual(groundSlots(template.buildings.CORE));
    }
  });

  it('gives each armed dome a real shield', () => {
    expect(shieldHp(MULTI_WORLD.neutral[2].instruments.AEGIS)).toBeGreaterThan(0);
    expect(shieldHp(MULTI_WORLD.neutral[3].instruments.AEGIS))
      .toBeGreaterThan(shieldHp(MULTI_WORLD.neutral[2].instruments.AEGIS));
  });

  it('leaves the caretaker buildings exactly as they were', () => {
    expect(MULTI_WORLD.neutral[1].buildings).toEqual(
      { CORE: 2, REFINERY: 2, EXTRACTOR: 2, VAULT: 0, SHIPYARD: 0, DEUTERIUM_PLANT: 0 },
    );
    expect(MULTI_WORLD.neutral[2].buildings).toEqual(
      { CORE: 5, REFINERY: 5, EXTRACTOR: 5, VAULT: 0, SHIPYARD: 2, DEUTERIUM_PLANT: 0 },
    );
    expect(MULTI_WORLD.neutral[3].buildings).toEqual(
      { CORE: 8, REFINERY: 8, EXTRACTOR: 8, VAULT: 0, SHIPYARD: 4, DEUTERIUM_PLANT: 0 },
    );
  });
});

describe('D209 capture stock', () => {
  it('opens a captured world on the owner-authored tier stock', () => {
    expect(MULTI_WORLD.neutral[1].captureStock).toEqual({ alloy: 1_000, crystal: 500, deuterium: 0 });
    expect(MULTI_WORLD.neutral[2].captureStock).toEqual({ alloy: 5_000, crystal: 2_500, deuterium: 1_000 });
    expect(MULTI_WORLD.neutral[3].captureStock).toEqual({ alloy: 15_000, crystal: 5_000, deuterium: 3_000 });
  });
});

describe('D209 colony capacity', () => {
  it.each([
    [0, 0], [6, 0], [8, 0], [9, 1], [11, 1], [12, 2], [14, 2], [15, 3], [99, 3],
  ])('maps Core %i to %i colony slots', (core, capacity) => {
    expect(colonyCapacity(core)).toBe(capacity);
  });

  it('names the Core the next colony opens at, and null past the third', () => {
    expect(nextColonyCore(0)).toBe(9);
    expect(nextColonyCore(1)).toBe(12);
    expect(nextColonyCore(1, 1)).toBe(15);
    expect(nextColonyCore(2)).toBe(15);
    expect(nextColonyCore(3)).toBeNull();
  });

  it('still tops out at three colonies', () => {
    expect(colonyCapacity(Infinity)).toBe(3);
  });

  it('refuses a reservation that the new thresholds no longer allow', () => {
    expect(hasColonyCapacity(8, 0, 0)).toBe(false);
    expect(hasColonyCapacity(9, 0, 0)).toBe(true);
    expect(hasColonyCapacity(11, 1, 0)).toBe(false);
    expect(hasColonyCapacity(12, 1, 0)).toBe(true);
    expect(hasColonyCapacity(14, 2, 0)).toBe(false);
    expect(hasColonyCapacity(15, 2, 0)).toBe(true);
  });
});

describe('D209 neutral counts', () => {
  it('carries 38 / 19 / 8 caretaker worlds', () => {
    expect(MULTI_WORLD.neutralCounts).toEqual({ 1: 38, 2: 19, 3: 8 });
  });

  it.each([1, 2, 3, 8331])('places all 65 on distinct non-capital slots for seed %i', (seed) => {
    const slots = generateGalaxy(seed, MULTI_WORLD.neutralSlotPool).slots;
    const chosen = selectNeutralSlots(seed, slots);
    expect(chosen.filter((entry) => entry.tier === 1)).toHaveLength(38);
    expect(chosen.filter((entry) => entry.tier === 2)).toHaveLength(19);
    expect(chosen.filter((entry) => entry.tier === 3)).toHaveLength(8);
    expect(new Set(chosen.map((entry) => entry.slot.index))).toHaveLength(65);
    expect(chosen.every((entry) => entry.slot.index >= MULTI_WORLD.capitalSlots)).toBe(true);
  });
});

describe('D209 Uplink (Anten)', () => {
  it('costs the owner-authored 1,000 alloy and 500 crystal', () => {
    expect(satelliteCost('UPLINK')).toEqual({ alloy: 1_000, crystal: 500, deuterium: 0 });
  });

  it.each([1, 6, 20])('takes 6.5 minutes at Core %i after the owner 30% timer pass, before automation', (core) => {
    expect(satelliteMinutes('UPLINK', core, {})).toBe(6.5);
  });

  it('still takes the AI Robots discount, like everything else in Construction (D198)', () => {
    for (let rung = 0; rung <= 5; rung++) {
      expect(satelliteMinutes('UPLINK', 6, { AI_ROBOTS: rung }))
        .toBeCloseTo(6.5 * robotSpeedMult({ AI_ROBOTS: rung }), 10);
    }
  });

  it('leaves the other three satellites on their ordinary quote', () => {
    for (const id of SATELLITE_IDS) {
      if (id === 'UPLINK') continue;
      expect(satelliteMinutes(id, 6, { AI_ROBOTS: 2 })).toBe(buildMinutes(satelliteCost(id), 6, { AI_ROBOTS: 2 }));
    }
  });
});
