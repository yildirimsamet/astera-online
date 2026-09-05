import { describe, expect, it } from 'vitest';
import {
  DEUTERIUM,
  MULTI_WORLD,
  PROSPECTOR,
  RESEARCH_PROJECTS,
  START_BUILDINGS,
  advanceEconomy,
  collect,
  crystalRate,
  deuteriumCollectorCap,
  deuteriumRate,
  deuteriumStorageCap,
  plantCeiling,
  vaultProtects,
  type PlanetEconomyState,
} from '../src/index.js';

const idle = (over: Partial<PlanetEconomyState> = {}): PlanetEconomyState => ({
  alloy: 0, crystal: 0, deuterium: 0,
  bufferAlloy: 0, bufferCrystal: 0, bufferDeuterium: 0,
  shield: 0, lastTickMinutes: 0, disruptedUntilMinutes: 0,
  ...over,
});

const input = (plantLevel: number) => ({
  refineryLevel: 1, extractorLevel: 1, aegisLevel: 0, vaultLevel: 0, plantLevel,
});

/**
 * DEUTERIUM STOPS BEING A THING YOU CAN ONLY WIN. T5.
 *
 * Measured on the gate seasons, the MEDIAN commander ends a fourteen-day season
 * holding ten deuterium. It exists only on isotope rocks, only after the season's
 * thirty-fifth hour, and only for whoever gets there first — so for most of the
 * field it may as well not exist at all. That was survivable while nothing needed
 * it; T6 makes every launch need it, and a resource most players cannot get is a
 * game most players cannot play.
 *
 * THE REFINERY IS THE FLOOR, NEVER THE CEILING. A guaranteed trickle you can plan
 * around; the rocks stay the fast, contested money that pays for Couriers,
 * Nullifiers, the last two research rungs and a Death Star. If the two ever meet,
 * the whole second act of the season becomes dead content — that is the acceptance
 * criterion, and it is asserted below rather than left as a hope.
 */
describe('the deuterium refinery', () => {
  it('produces nothing at all without a plant', () => {
    expect(deuteriumRate(0)).toBe(0);
    expect(START_BUILDINGS.DEUTERIUM_PLANT).toBe(0);
  });

  it('climbs with the plant, and never falls', () => {
    for (let level = 1; level <= 20; level++) {
      expect(deuteriumRate(level)).toBeGreaterThan(deuteriumRate(level - 1));
    }
  });

  /**
   * THE NUMBER THAT MATTERS, stated as a ratio so it survives a tempo change.
   *
   * Two craft on an isotope rock carry home about `2 × hold × mean share`. A
   * dedicated miner turns that round roughly once an hour while the frontier is
   * open. The plant at the very top of both its ladders must still be visibly
   * short of that, or nobody flies to a rock again.
   */
  it('stays below what a dedicated miner pulls off the rocks', () => {
    const perRun = 2 * PROSPECTOR.hold
      * (DEUTERIUM.isotopeShareMin + DEUTERIUM.isotopeShareMax) / 2;
    const ceiling = plantCeiling(RESEARCH_PROJECTS.DEUTERIUM_SYNTHESIS.maxLevel);
    expect(deuteriumRate(ceiling)).toBeLessThan(perRun);
    // And an ordinary developed plant is a trickle beside it, not a rival.
    expect(deuteriumRate(6)).toBeLessThan(perRun / 3);
  });

  it('is a fraction of what the other two produce, at every level', () => {
    for (const level of [1, 3, 6, 9, 12]) {
      expect(deuteriumRate(level)).toBeLessThan(crystalRate(level) / 2);
    }
  });

  describe('the research ceiling', () => {
    it('opens three plant levels per rung', () => {
      expect(plantCeiling(0)).toBe(0);
      for (const rung of [1, 2, 3]) {
        expect(plantCeiling(rung)).toBe(rung * DEUTERIUM.plantLevelsPerResearch);
      }
    });

    /**
     * LEVEL ONE COSTS NO DEUTERIUM, and that is a deadlock guard rather than a
     * price. The only way to make deuterium is the plant, the only way to the
     * plant is this rung, and a rung that charged deuterium would seal the door
     * from the inside.
     */
    it('never charges deuterium for the first rung', () => {
      expect(RESEARCH_PROJECTS.DEUTERIUM_SYNTHESIS.costAt(1).deuterium).toBe(0);
    });

    it('gets sharply dearer as it climbs', () => {
      const project = RESEARCH_PROJECTS.DEUTERIUM_SYNTHESIS;
      for (let level = 2; level <= project.maxLevel; level++) {
        const now = project.costAt(level);
        const before = project.costAt(level - 1);
        expect(now.alloy + now.crystal).toBeGreaterThan((before.alloy + before.crystal) * 2);
      }
    });

    /** Reachable from the first minute: the fuel chain cannot wait for an act break. */
    it('is open from the start of the season', () => {
      expect(RESEARCH_PROJECTS.DEUTERIUM_SYNTHESIS.availableAtMinutes).toBe(0);
      expect(RESEARCH_PROJECTS.DEUTERIUM_SYNTHESIS.prerequisite).toBeNull();
    });
  });

  describe('storage and the works', () => {
    /**
     * TWO SOURCES, TWO TERMS. A refinery raises the ceiling; the world's own
     * industrial base is what lets it hold what it MINES, and that half is exactly
     * the figure the game always gave it.
     */
    it('raises the ceiling for a refinery without taking the miner’s room away', () => {
      const industry = crystalRate(8);
      const none = deuteriumStorageCap(deuteriumRate(0), industry, 0);
      const some = deuteriumStorageCap(deuteriumRate(6), industry, 0);
      expect(none).toBeGreaterThan(0);
      expect(some).toBeGreaterThan(none);
      expect(deuteriumCollectorCap(deuteriumRate(0), industry)).toBeGreaterThan(0);
    });

    /**
     * THE REGRESSION THIS REPLACED. Sizing the ceiling off the plant ALONE looked
     * like the tidy answer: a world with no refinery got zero, and mined isotope
     * deuterium — the whole of the Frontier act — became impossible to collect on
     * the worlds that had not built one, which is nearly all of them.
     */
    it('leaves a world with no refinery room for what it mines', () => {
      expect(deuteriumStorageCap(0, crystalRate(8), 0)).toBeGreaterThan(0);
      expect(deuteriumCollectorCap(0, crystalRate(8))).toBeGreaterThan(0);
    });

    it('fills the works and stops at their ceiling', () => {
      const rate = deuteriumRate(4);
      const after = advanceEconomy(idle(), input(4), 60);
      expect(after.bufferDeuterium).toBeCloseTo(rate, 5);

      const full = advanceEconomy(idle(), input(4), 60 * 500);
      expect(full.bufferDeuterium)
        .toBeCloseTo(deuteriumCollectorCap(rate, crystalRate(1)), 0);
    });

    it('leaves a world with no plant exactly where it was', () => {
      const after = advanceEconomy(idle({ bufferDeuterium: 40 }), input(0), 60 * 24);
      expect(after.bufferDeuterium).toBe(40);
    });
  });

  /**
   * THE VAULT FLOOR FALLS OUT OF THE RULE IT ALWAYS HAD.
   *
   * "Vault floors use hours of each resource's own production" — deuterium's floor
   * was zero because its production was zero, which the docblock said in as many
   * words. Give it a rate and the floor appears on its own; no special case is
   * added and none is removed.
   */
  describe('the vault floor', () => {
    it('protects nothing on a world that makes none', () => {
      expect(vaultProtects(5, 5, 5, 0).deuterium).toBe(0);
    });

    it('protects hours of its own production once there is a plant', () => {
      const floor = vaultProtects(5, 5, 5, 6).deuterium;
      expect(floor).toBeGreaterThan(0);
      expect(floor).toBeLessThan(vaultProtects(5, 5, 5, 6).crystal);
    });

    it('grows with the plant and with the vault', () => {
      expect(vaultProtects(5, 5, 5, 9).deuterium)
        .toBeGreaterThan(vaultProtects(5, 5, 5, 6).deuterium);
      expect(vaultProtects(8, 5, 5, 6).deuterium)
        .toBeGreaterThan(vaultProtects(5, 5, 5, 6).deuterium);
    });
  });

  /** A caretaker world is seeded straight into the database, bypassing every gate. */
  it('leaves the neutral templates without a plant they never researched', () => {
    for (const tier of [1, 2, 3] as const) {
      const template = MULTI_WORLD.neutral[tier];
      expect(template.buildings.DEUTERIUM_PLANT).toBe(0);
    }
  });
});

/**
 * THE BUG THIS SUITE EXISTS TO STOP COMING BACK.
 *
 * T5 changed what `deuteriumStorageCap`'s first argument MEANS — from the
 * Extractor's rate to deuterium's own — and both are `number`, so the compiler
 * could not see a single one of the eleven call sites that went on passing a
 * crystal rate. The works filled to 111 while the screen and the collect clamp
 * both said 2,678: a twenty-four fold disagreement, invisible to every test that
 * checked only one of the three.
 *
 * The fix was to correct the call sites. THIS is what stops it happening again:
 * the three places that must agree are tied to one figure, so a fourth reader
 * that invents its own is a red test rather than a wrong number on a screen.
 */
describe('the three deuterium ceilings agree', () => {
  const cases = [
    { plant: 0, extractor: 8, vault: 0 },
    { plant: 6, extractor: 8, vault: 5 },
    { plant: 9, extractor: 12, vault: 8 },
  ];

  it.each(cases)('works, store and clamp read one rate at plant $plant', (row) => {
    const rate = deuteriumRate(row.plant);
    const industry = crystalRate(row.extractor);

    // 1. What the works actually fill to.
    const filled = advanceEconomy(
      idle(),
      {
        refineryLevel: 1, extractorLevel: row.extractor, plantLevel: row.plant,
        aegisLevel: 0, vaultLevel: row.vault,
      },
      60 * 5000,
    );
    if (row.plant > 0) {
      expect(filled.bufferDeuterium).toBeCloseTo(deuteriumCollectorCap(rate, industry), 0);
    }

    // 2. What a collection is allowed to move into storage.
    const collected = collect(
      { ...filled, bufferDeuterium: deuteriumCollectorCap(rate, industry) * 10 },
      {
        refineryLevel: 1, extractorLevel: row.extractor, plantLevel: row.plant,
        aegisLevel: 0, vaultLevel: row.vault,
      },
    );
    expect(collected.state.deuterium).toBeLessThanOrEqual(
      deuteriumStorageCap(rate, industry, row.vault),
    );

    // 3. And a refinery genuinely raises both of them above the industrial base.
    if (row.plant > 0) {
      expect(deuteriumCollectorCap(rate, industry))
        .toBeGreaterThan(deuteriumCollectorCap(0, industry));
      expect(deuteriumStorageCap(rate, industry, row.vault))
        .toBeGreaterThan(deuteriumStorageCap(0, industry, row.vault));
    }
  });

  /** And a world with no refinery can still bank what its craft brought home. */
  it('lets a world with no refinery collect what it mined', () => {
    const state = collect(
      idle({ bufferDeuterium: 5_000 }),
      { refineryLevel: 8, extractorLevel: 8, plantLevel: 0, aegisLevel: 0, vaultLevel: 8 },
    );
    // As much as its industry can contain: D169 cut the store with the Vault
    // table, so a 5,000 buffer now fills a Vault-8 world rather than fitting in
    // it. What matters is unchanged — a world with no refinery still banks the
    // isotope its craft flew home, which is the whole of D93's second act.
    expect(state.moved.deuterium).toBe(deuteriumStorageCap(0, crystalRate(8), 8));
    expect(state.moved.deuterium).toBeGreaterThan(0);
  });
});
