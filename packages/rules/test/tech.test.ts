import { describe, expect, it } from 'vitest';
import {
  ALL_HULLS,
  COMBAT,
  RESEARCH_PROJECTS,
  RESEARCH_PROJECT_IDS,
  RESEARCH_TECH,
  COMBAT_RESEARCH_PROJECTS,
  hullTech,
  cargoMult,
  fleetCargo,
  prospectorHold,
  prospectorHoldMult,
  shipMinutes,
  transferCargoCapacity,
  yardSpeedMult,
  type TechLevels,
} from '../src/index.js';

const max = RESEARCH_TECH.economyMaxLevel;
const cost = { alloy: 10_000, crystal: 4_000, deuterium: 0 };

/**
 * THREE LADDERS, THREE NUMBERS A COMMANDER ALREADY READS. T8.
 *
 * Each effect is ONE exported pure function and every consumer reads it. That is
 * not tidiness: this code base has shipped an effect honoured in one place and
 * forgotten in another, and a multiplier that applies on the server but not in the
 * launch preview is a screen that lies about a decision being made on it.
 */
describe('the economy ladders', () => {
  it('do nothing at all to a commander who has researched none of them', () => {
    const none: TechLevels = {};
    expect(yardSpeedMult(none)).toBe(1);
    expect(prospectorHoldMult(none)).toBe(1);
    expect(cargoMult(none)).toBe(1);
  });

  it('cannot be pushed past their own ceiling', () => {
    const over: TechLevels = {
      YARD_AUTOMATION: 99, PROSPECTOR_HOLDS: 99, CARGO_HOLDS: 99,
    };
    const atMax: TechLevels = {
      YARD_AUTOMATION: max, PROSPECTOR_HOLDS: max, CARGO_HOLDS: max,
    };
    expect(yardSpeedMult(over)).toBe(yardSpeedMult(atMax));
    expect(prospectorHoldMult(over)).toBe(prospectorHoldMult(atMax));
    expect(cargoMult(over)).toBe(cargoMult(atMax));
  });

  /**
   * D169 MADE THEM CONSEQUENTIAL ON PURPOSE, and this is what they cost now.
   *
   * These were modest by design — 20% off a build, 40% more ore, 20% more loot —
   * and priced as conveniences. The owner's tables take all three to a different
   * order: a third off the yard, two and a half times the hold, two and a half
   * times what a raid carries home. The bound left is that they stay FINITE and
   * stop where the table stops; the smallness is gone deliberately.
   */
  it('reach the top of their own tables and stop there', () => {
    expect(yardSpeedMult({ YARD_AUTOMATION: max })).toBe(0.70);
    expect(prospectorHoldMult({ PROSPECTOR_HOLDS: max })).toBe(2.5);
    expect(cargoMult({ CARGO_HOLDS: max })).toBe(2.5);
  });

  describe('yard automation', () => {
    it('shaves real time off a build', () => {
      const plain = shipMinutes(cost, 4, {});
      expect(shipMinutes(cost, 4, { YARD_AUTOMATION: max })).toBeLessThan(plain);
    });

    /**
     * IT IS WORTH ABOUT TWO SHIPYARD LEVELS NOW, and that is the D169 table.
     * At 4% a rung it was worth less than one and the Shipyard owned the curve
     * outright; at three tenths off the top rung it buys real yard, which is what
     * the price it charges is for. It still does not outrun three levels.
     */
    it('is worth about two Shipyard levels, and never three', () => {
      const teched = shipMinutes(cost, 4, { YARD_AUTOMATION: max });
      expect(teched).toBeLessThan(shipMinutes(cost, 5, {}));
      expect(teched).toBeGreaterThan(shipMinutes(cost, 7, {}));
    });
  });

  describe('prospector holds', () => {
    /**
     * MULTIPLICATIVE WITH THE DERRICK, deliberately. Hardware in orbit lifts every
     * craft you own; the technique lifts every craft you will ever own. A player
     * who has bought both should see both — additive, whichever came second would
     * feel like it did nothing.
     */
    it('compounds with a Derrick rather than sharing with it', () => {
      const bare = prospectorHold([], {});
      const drill = prospectorHold(['DERRICK'], {});
      const both = prospectorHold(['DERRICK'], { PROSPECTOR_HOLDS: max });
      expect(both / drill).toBeCloseTo(prospectorHold([], { PROSPECTOR_HOLDS: max }) / bare, 6);
      expect(both).toBeGreaterThan(drill);
    });
  });

  describe('cargo holds', () => {
    it('raises what a raid can carry home', () => {
      const fleet = { DART: 40, WAYFARER: 4 };
      expect(fleetCargo(fleet, { CARGO_HOLDS: max }))
        .toBeGreaterThan(fleetCargo(fleet, {}));
    });

    /**
     * AND LEAVES WORLD TRANSFERS ALONE. `transferCargoCapacity` answers a different
     * question — what a logistics run between a commander's own worlds can move —
     * and the two were separated long before this ladder existed.
     */
    it('does not touch a transfer between your own worlds', () => {
      const fleet = { WAYFARER: 4, COURIER: 2 };
      expect(transferCargoCapacity(fleet)).toBe(transferCargoCapacity(fleet));
      const before = transferCargoCapacity(fleet);
      expect(before).toBeGreaterThan(0);
      // The ladder is not a parameter here at all, which is the point.
      expect(transferCargoCapacity.length).toBe(1);
    });
  });

  it('prices every rung dearer than the last, and none of them in deuterium', () => {
    for (const id of ['YARD_AUTOMATION', 'PROSPECTOR_HOLDS', 'CARGO_HOLDS'] as const) {
      const project = RESEARCH_PROJECTS[id];
      expect(project.maxLevel).toBe(max);
      for (let level = 2; level <= project.maxLevel; level++) {
        expect(project.costAt(level).alloy, `${id} L${String(level)}`)
          .toBeGreaterThan(project.costAt(level - 1).alloy);
      }
      // Nothing here competes with fuel for a resource the player may have none of.
      expect(project.costAt(project.maxLevel).deuterium).toBe(0);
    }
  });
});

/**
 * THE ONE HARD RULE IN THE WEAPON LADDERS, AND IT IS THE GAME'S CENTRAL CLAIM. T9.
 *
 *   information (the counter cycle)  1.6 / 0.625 = 2.56x   =  156% advantage
 *   technology  (every project)                    1.25x   =   25% advantage
 *
 * `hulls.ts` says it outright: "information beats tech by construction, and that
 * is the claim the whole game rests on." Give attack and hit points 25% EACH and
 * the product is 1.5625x — 56%, not 25% — which lands close enough to the counter
 * cycle that knowing what your opponent flies stops being decisive. Every one of
 * these walks the real functions rather than trusting the paragraph.
 */
describe('the Fleet V2 military ceiling', () => {
  const maxed: TechLevels = {
    SHIP_POWER: RESEARCH_TECH.weaponMaxLevel,
    SHIP_ARMOR: RESEARCH_TECH.weaponMaxLevel,
    SHIP_PROPULSION: RESEARCH_TECH.weaponMaxLevel,
    EMPLACEMENT_DOCTRINE: RESEARCH_TECH.weaponMaxLevel,
  };

  it('never lets any hull past the ceiling, however much is researched', () => {
    for (const id of ALL_HULLS) {
      const { atk, hp } = hullTech(maxed, id);
      expect(atk * hp, `${id} equal-budget power`)
        .toBeLessThanOrEqual(RESEARCH_TECH.powerCeiling + 1e-9);
    }
  });

  /** And the ceiling is worth reaching: a fully-teched hull is meaningfully better. */
  it('is worth researching at all', () => {
    const { atk, hp } = hullTech(maxed, 'DART');
    expect(atk * hp).toBeGreaterThan(RESEARCH_TECH.powerCeiling * 0.99);
  });

  /**
   * THE COMPARISON THAT MATTERS. A commander who has researched everything still
   * loses to the counter cycle by a wide margin — which is what makes a probe
   * worth flying and what makes this whole ladder a side bet rather than the game.
   */
  /**
   * D169 NARROWED IT FROM A DIFFERENT LEAGUE TO A LEAD, on the owner's decision.
   *
   * The ceiling was 1.25 against a 2.56x counter cycle — information beat tech by
   * six times over. Power and Armor now pay a quarter EACH, so the product is
   * 1.5625 and the margin is 1.64x. Information still wins every equal-budget
   * fight it is brought to; a probe is still the best thing a commander can spend
   * on. What it no longer is, is the only thing worth spending on.
   */
  it('stays below what knowing your enemy buys', () => {
    const counter = COMBAT.strongMult / COMBAT.weakMult;
    expect(RESEARCH_TECH.powerCeiling).toBeLessThan(counter);
    expect(counter / RESEARCH_TECH.powerCeiling).toBeGreaterThan(1.6);
  });

  it('does nothing at all before anything is researched', () => {
    for (const id of ALL_HULLS) {
      expect(hullTech({}, id)).toEqual({ atk: 1, hp: 1, speed: 1 });
    }
  });

  it('gives transports Armor and Propulsion, but never Power', () => {
    const support = hullTech(maxed, 'WAYFARER');
    expect(support.atk).toBe(1);
    expect(support.hp).toBeGreaterThan(1);
    expect(support.speed).toBeGreaterThan(1);
  });

  it('covers both emplacements with the one ground doctrine', () => {
    const ground: TechLevels = { EMPLACEMENT_DOCTRINE: RESEARCH_TECH.weaponMaxLevel };
    expect(hullTech(ground, 'BASTION').atk).toBeGreaterThan(1);
    expect(hullTech(ground, 'THORN').atk).toBe(hullTech(ground, 'BASTION').atk);
    expect(hullTech(ground, 'DART')).toEqual({ atk: 1, hp: 1, speed: 1 });
  });

  it('splits the product ceiling between the Power and Armor decisions', () => {
    const power = hullTech({ SHIP_POWER: RESEARCH_TECH.weaponMaxLevel }, 'DART');
    const armor = hullTech({ SHIP_ARMOR: RESEARCH_TECH.weaponMaxLevel }, 'DART');
    expect(power.atk).toBeGreaterThan(1);
    expect(power.hp).toBe(1);
    expect(armor.atk).toBe(1);
    expect(armor.hp).toBeGreaterThan(1);
    const both = hullTech(maxed, 'DART');
    expect(both.atk * both.hp)
      .toBeCloseTo(power.atk * armor.hp, 9);
  });

  /**
   * TECH MUST BE VISIBLE, or it silently eats the value of every scouting flight.
   * D124: a rule the player cannot SEE is not a rule. This is the list a probe
   * brings home, and it has to be the same list the effects read.
   */
  it('publishes exactly the projects that change a battle', () => {
    const covered = new Set(COMBAT_RESEARCH_PROJECTS);
    for (const id of RESEARCH_PROJECT_IDS) {
      const changes = ALL_HULLS.some((hull) => {
        const solo: TechLevels = { [id]: RESEARCH_TECH.weaponMaxLevel };
        const { atk, hp } = hullTech(solo, hull);
        return atk !== 1 || hp !== 1;
      });
      expect(changes, `${id} visibility`).toBe(covered.has(id));
    }
  });
});
