import { describe, expect, it } from 'vitest';
import {
  BANKABILITY_MARGIN,
  HANGAR,
  HULLS,
  NAVY_RUNG_TIER,
  NAVY_TIER_CARGO,
  RESEARCH_PROJECTS,
  START_BUILDINGS,
  buildingCost,
  buildingMinutes,
  hangarCapacity,
  hangarLoad,
  hullBuildable,
  hullBulk,
  fleetPathReference,
  hangarBankability,
  navyPackage,
  referenceFormation,
  researchMinutes,
  storeCeiling,
  type HullId,
  type NavyTier,
  type ResearchProjectId,
} from '../src/index.js';

/**
 * CAN A COMMANDER ON THE FLEET PATH EVER HOLD THIS PRICE AT ONCE? Plan §15.5b, item 2B.1.
 *
 * "Too expensive" and "impossible" are different findings and the game only has the second one on
 * record. A store has a hard ceiling — production overflows and is lost — so a rung priced above
 * what a world can HOLD is not a long grind, it is a rung that cannot be bought at all, and no
 * amount of patience fixes it.
 *
 * PER RESOURCE, NEVER IN ALLOY-EQUIVALENT. A positive AE headroom can sit entirely in crystal
 * while the alloy line is the one that refuses the purchase; collapsing the three into one number
 * is how the wall stayed invisible.
 */
describe('the state a fleet-path commander is measured in', () => {
  /**
   * PEGGED TO THE CORE, NOT TO WHAT IS EVENTUALLY REACHABLE. The plan rejects "reachable store"
   * by name: a Refinery 18 is technically reachable and assuming it would measure the ECONOMY
   * path's world while claiming to measure the fleet path's.
   */
  it('pegs the producers to the Core the rung actually gates', () => {
    const ref = fleetPathReference(10);
    expect(ref.core).toBe(10);
    expect(ref.refinery).toBe(10);
    expect(ref.extractor).toBe(10);
    expect(ref.plant).toBe(10);
  });

  /** No building may exceed the Core, so this is the MOST generous fleet-path state there is. */
  it('never puts a producer above the Core, because the game refuses that', () => {
    for (const core of [1, 4, 7, 10, 13, 16, 18]) {
      const ref = fleetPathReference(core);
      for (const level of [ref.refinery, ref.extractor, ref.plant, ref.vault]) {
        expect(level).toBeLessThanOrEqual(core);
      }
    }
  });

  /** A commander who spent on ships has no Vault; one who also built it holds far more. */
  it('takes the vault as a stated input rather than assuming one', () => {
    const bare = storeCeiling(fleetPathReference(16));
    const vaulted = storeCeiling(fleetPathReference(16, 16));
    expect(bare.alloy).toBeLessThan(vaulted.alloy);
    expect(bare.crystal).toBeLessThan(vaulted.crystal);
    expect(bare.deuterium).toBeLessThan(vaulted.deuterium);
  });
});

describe('whether a Hangar rung can be banked at all', () => {
  it('answers per resource, and fails when any single line is over the ceiling', () => {
    const b = hangarBankability(7, fleetPathReference(HANGAR.coreGate[7]));
    expect(b.cost).toEqual(buildingCost('HANGAR', 6));
    expect(b.ratio.alloy).toBeGreaterThan(BANKABILITY_MARGIN);
    expect(b.bankable).toBe(false);
  });

  /**
   * THE MEASURED WALL, PINNED. At Core 16 with no Vault a commander's whole alloy store is 50,252
   * and rung seven costs 263,137 — five stores. Rung ten costs eighteen. These are the levels the
   * chat logs call unbuyable, and they are unbuyable in the strict sense.
   */
  it('finds the fleet path walled from the sixth rung up', () => {
    const walled: number[] = [];
    for (let rung = 2; rung <= HANGAR.maxLevel; rung++) {
      if (!hangarBankability(rung, fleetPathReference(HANGAR.coreGate[rung]!)).bankable) {
        walled.push(rung);
      }
    }
    expect(walled).toEqual([6, 7, 8, 9, 10]);
  });

  /**
   * AND OPENS ALL OF THEM FOR A COMMANDER WHO ALSO BUILT THE VAULT. Owner decision, 2026-09-22.
   *
   * Before the late rungs were repriced (plan 2B.3) even a full Vault left rungs 9 and 10 out of
   * reach. At a third of the fleet they hold, the whole ladder fits — which is the rule this
   * pricing states: *if you have somewhere to put the ships, you need somewhere to put the ore.*
   */
  it('opens all of them for a commander who also built the Vault', () => {
    for (let rung = 2; rung <= HANGAR.maxLevel; rung++) {
      const core = HANGAR.coreGate[rung]!;
      expect(
        hangarBankability(rung, fleetPathReference(core, core)).bankable,
        `rung ${String(rung)}`,
      ).toBe(true);
    }
  });

  it('states its margin rather than hiding one inline', () => {
    expect(BANKABILITY_MARGIN).toBeGreaterThan(0);
    expect(BANKABILITY_MARGIN).toBeLessThanOrEqual(1);
  });
});

/**
 * THE REFERENCE FORMATION IS AUTHORED, AND THAT IS THE POINT. Plan §15.5b, item 2B.3.
 *
 * *"`HULLS`'tan dinamik 'en ucuz' okuma yok — bir gövde dengesi değişikliği altyapıyı sessizce
 * yeniden fiyatlandırmasın."* A rung's reference is the combat tier its Core gate is meant to
 * support, written down; its PRICE moves with the catalogue, its ROSTER never does.
 */
describe('what a Hangar rung is sized for', () => {
  it('names a combat tier for every rung the ladder has', () => {
    for (let rung = 1; rung <= HANGAR.maxLevel; rung++) {
      expect(NAVY_RUNG_TIER[rung]).toBeGreaterThanOrEqual(1);
    }
  });

  it('fills the room the rung adds with that tier’s authored hull', () => {
    const added = HANGAR.capacity[7] - HANGAR.capacity[6];
    const formation = referenceFormation(7);
    const ids = Object.keys(formation);
    expect(ids).toHaveLength(1);
    const hull = HULLS[ids[0] as keyof typeof HULLS];
    expect(hull.tier).toBe(NAVY_RUNG_TIER[7]);
    expect(formation[hull.id]! * hullBulk(hull.id)).toBeLessThanOrEqual(added);
  });

  it('never reads the catalogue for a cheapest hull', () => {
    // The Dart is the cheapest legal combat hull at every rung; a reference that read prices
    // would answer DART everywhere, and the late rungs would be priced for a tier-1 wing.
    expect(Object.keys(referenceFormation(HANGAR.maxLevel))).not.toEqual(['DART']);
  });
});

/**
 * THE FIRST USEFUL NAVY, AS ONE FIGURE. Plan §15.5b: *"Core + Tersane + Engineering + gerekli
 * doktrin + Hangar artışı + muharebe kanadı + kargo + hurdacı + ilk on kalkışın yakıtı + kuyruk
 * süreleri. Filo yolunun gerçek bariyeri budur; parçalar ayrı ölçülmez."*
 */
describe('the whole cost of a first useful navy', () => {
  it('counts every part the plan lists, and nothing is zero by accident', () => {
    const pkg = navyPackage(3);
    const parts = pkg.breakdown.map((line) => line.what);
    for (const part of [
      'CORE', 'SHIPYARD', 'HANGAR', 'STARSHIP_ENGINEERING', 'DOCTRINE',
      'WING', 'CARGO', 'COLLECTORS', 'FUEL',
    ]) {
      expect(parts).toContain(part);
    }
    for (const line of pkg.breakdown) {
      expect(line.cost.alloy + line.cost.crystal + line.cost.deuterium + line.minutes)
        .toBeGreaterThan(0);
    }
  });

  it('totals the parts rather than quoting one of them', () => {
    const pkg = navyPackage(3);
    const sum = pkg.breakdown.reduce(
      (acc, line) => ({
        alloy: acc.alloy + line.cost.alloy,
        crystal: acc.crystal + line.cost.crystal,
        deuterium: acc.deuterium + line.cost.deuterium,
      }),
      { alloy: 0, crystal: 0, deuterium: 0 },
    );
    expect(pkg.cost).toEqual(sum);
    expect(pkg.minutes).toBe(pkg.breakdown.reduce((n, line) => n + line.minutes, 0));
  });

  it('costs more to reach the tier above, in every resource', () => {
    const three = navyPackage(3);
    const four = navyPackage(4);
    expect(four.cost.alloy).toBeGreaterThan(three.cost.alloy);
    expect(four.cost.crystal).toBeGreaterThan(three.cost.crystal);
    expect(four.minutes).toBeGreaterThan(three.minutes);
  });

  /** Ten launches, because one raid is not a navy and the fuel is what strands a fleeter. */
  it('carries the fuel for the first ten launches', () => {
    const fuel = navyPackage(3).breakdown.find((line) => line.what === 'FUEL')!;
    expect(fuel.cost.deuterium).toBeGreaterThan(0);
    expect(fuel.cost.alloy).toBe(0);
  });
});

/**
 * A PACKAGE THAT CANNOT PASS ITS OWN GATES IS NOT A PRICE. Review 2026-09-22, finding #5.
 *
 * The first version summed the combat hull's research and nothing else, so every tier flew a
 * transport or a salvager its own Shipyard and research could not build: the collector needs
 * Shipyard 4 and Engineering 1, the Atlas needs Propulsion 2 — and Propulsion stands behind Dense
 * Fuel Cells, which stands behind Isotope Spectrometry. The server refuses every one of those
 * orders, so the figure was the price of a navy nobody can own.
 */
describe('a first navy that passes its own gates', () => {
  const TIERS: readonly NavyTier[] = [1, 2, 3, 4];

  for (const tier of TIERS) {
    it(`tier ${String(tier)}: every hull it flies is buildable with the Shipyard and research it paid for`, () => {
      const pkg = navyPackage(tier);
      const hulls = Object.keys(pkg.fleet) as HullId[];
      expect(hulls.length).toBeGreaterThan(1);
      for (const id of hulls) {
        expect(hullBuildable(id, pkg.shipyard, pkg.research), id).toBe(true);
      }
    });

    it(`tier ${String(tier)}: pays for every research prerequisite on the way`, () => {
      const pkg = navyPackage(tier);
      for (const [id, level] of Object.entries(pkg.research) as [ResearchProjectId, number][]) {
        expect(level).toBeGreaterThanOrEqual(1);
        expect(level).toBeLessThanOrEqual(RESEARCH_PROJECTS[id].maxLevel);
        const prerequisite = RESEARCH_PROJECTS[id].prerequisite;
        if (prerequisite !== null) {
          expect(pkg.research[prerequisite] ?? 0, `${id} needs ${prerequisite}`).toBeGreaterThanOrEqual(1);
        }
      }
    });

    it(`tier ${String(tier)}: stands on a Core every building and project it needs allows`, () => {
      const pkg = navyPackage(tier);
      // No building may exceed the Core; the Hangar is the one exemption (plan 2B.6).
      expect(pkg.shipyard).toBeLessThanOrEqual(pkg.core);
      for (const id of Object.keys(pkg.research) as ResearchProjectId[]) {
        expect(RESEARCH_PROJECTS[id].requiredCore ?? 0).toBeLessThanOrEqual(pkg.core);
      }
    });

    it(`tier ${String(tier)}: fits everything it flies in the Hangar it bought`, () => {
      const pkg = navyPackage(tier);
      expect(hangarLoad(pkg.fleet)).toBeLessThanOrEqual(hangarCapacity(pkg.hangar));
    });

    it(`tier ${String(tier)}: flies the wing, two transports and a salvager`, () => {
      const pkg = navyPackage(tier);
      expect(pkg.fleet).toMatchObject(pkg.wing);
      expect(pkg.fleet[NAVY_TIER_CARGO[tier]]).toBe(2);
      expect(pkg.fleet.GARBAGE_COLLECTOR).toBe(1);
    });
  }

  /** The measured hole from the review, pinned so it cannot quietly reopen. */
  it('buys the Atlas its whole propulsion chain at tier 3', () => {
    const pkg = navyPackage(3);
    expect(pkg.research).toMatchObject({
      SHIP_PROPULSION: 2, DENSE_FUEL_CELLS: 1, ISOTOPE_SPECTROMETRY: 1,
    });
    const support = pkg.breakdown.find((line) => line.what === 'SUPPORT_RESEARCH')!;
    expect(support.cost.alloy + support.cost.crystal + support.cost.deuterium).toBeGreaterThan(0);
  });

  it('opens Shipyard 4 even at tier 1, because the salvager needs it', () => {
    expect(navyPackage(1).shipyard).toBeGreaterThanOrEqual(HULLS.GARBAGE_COLLECTOR.minShipyard);
  });
});

/**
 * TIMED BY THE QUEUES THE PRODUCT RUNS. Review 2026-09-22, finding #6.
 *
 * Buildings were timed with the generic `buildMinutes(cost, core)` and research with the design
 * profile's reference minutes. The construction queue uses `buildingMinutes(type, level + 1)` and
 * the research queue `researchMinutes(costAt(level), researchCore)`, and the two errors ran in
 * opposite directions — buildings five times too slow, research half as long as it is.
 */
describe('a first navy timed by the product queues', () => {
  const ZERO = { alloy: 0, crystal: 0, deuterium: 0 };

  it('prices and times every building rung the way the construction queue does', () => {
    for (const tier of [1, 2, 3, 4] as const) {
      const pkg = navyPackage(tier);
      const climbs = [
        ['CORE', START_BUILDINGS.CORE, pkg.core],
        ['SHIPYARD', START_BUILDINGS.SHIPYARD, pkg.shipyard],
        ['HANGAR', START_BUILDINGS.HANGAR, pkg.hangar],
      ] as const;
      for (const [id, from, to] of climbs) {
        let cost = ZERO;
        let minutes = 0;
        for (let level = from; level < to; level++) {
          const rung = buildingCost(id, level);
          cost = {
            alloy: cost.alloy + rung.alloy,
            crystal: cost.crystal + rung.crystal,
            deuterium: cost.deuterium + rung.deuterium,
          };
          minutes += buildingMinutes(id, level + 1, {});
        }
        const line = pkg.breakdown.find((row) => row.what === id)!;
        expect(line.cost, `${id} tier ${String(tier)}`).toEqual(cost);
        expect(line.minutes, `${id} tier ${String(tier)}`).toBeCloseTo(minutes, 6);
      }
    }
  });

  it('prices research at costAt and times it on the research queue at the package Core', () => {
    for (const tier of [1, 2, 3, 4] as const) {
      const pkg = navyPackage(tier);
      let cost = ZERO;
      let minutes = 0;
      for (const [id, top] of Object.entries(pkg.research) as [ResearchProjectId, number][]) {
        for (let level = 1; level <= top; level++) {
          const rung = RESEARCH_PROJECTS[id].costAt(level);
          cost = {
            alloy: cost.alloy + rung.alloy,
            crystal: cost.crystal + rung.crystal,
            deuterium: cost.deuterium + rung.deuterium,
          };
          minutes += researchMinutes(rung, pkg.core);
        }
      }
      const lines = pkg.breakdown.filter((row) =>
        row.what === 'STARSHIP_ENGINEERING' || row.what === 'DOCTRINE' || row.what === 'SUPPORT_RESEARCH');
      expect(lines).toHaveLength(3);
      const sum = lines.reduce((acc, row) => ({
        alloy: acc.alloy + row.cost.alloy,
        crystal: acc.crystal + row.cost.crystal,
        deuterium: acc.deuterium + row.cost.deuterium,
      }), ZERO);
      expect(sum, `tier ${String(tier)}`).toEqual(cost);
      expect(lines.reduce((n, row) => n + row.minutes, 0)).toBeCloseTo(minutes, 6);
    }
  });
});
