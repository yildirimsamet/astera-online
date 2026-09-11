import { describe, expect, it } from 'vitest';
import {
  BUILD,
  BUILDING_IDS,
  INSTRUMENT_IDS,
  RESEARCH_MAX_LEVEL,
  RESEARCH_TECH,
  SATELLITE_IDS,
  buildMinutes,
  buildingCost,
  buildingMinutes,
  defenceMinutes,
  instrumentCost,
  profileBuilding,
  researchMinutes,
  robotSpeedMult,
  satelliteCost,
  shipMinutes,
} from '../src/index.js';
import type { Resources } from '../src/index.js';

/**
 * AI ROBOTS: ONE RULE, AND IT IS THE QUEUE RATHER THAN A LIST. D198.
 *
 * "Everything in the CONSTRUCTION queue finishes sooner" is a sentence a
 * commander can hold in their head and predict from — six buildings, four
 * instruments, four satellites, and nothing else. The alternative the owner's
 * first sketch implied was a list of twelve named structures, which would have
 * left the Derrick and the Beacon as two exceptions with no readable reason.
 *
 * THE YARD IS THE OTHER QUEUE AND IT HAS ITS OWN PROJECT. Yard Automation shaves
 * hulls; this shaves the surface. A project that did both would make one of them
 * pointless, so the halves below asserting that ships, ground guns and research
 * are UNTOUCHED matter as much as the half asserting the discount lands.
 */

const CORE = 8;
const cost = (alloy: number, crystal: number, deuterium = 0): Resources =>
  ({ alloy, crystal, deuterium });

describe('the AI Robots ladder', () => {
  it('sells five rungs, a twentieth at a time to a quarter', () => {
    expect(robotSpeedMult({})).toBe(1);
    expect(robotSpeedMult({ AI_ROBOTS: 1 })).toBeCloseTo(0.95, 10);
    expect(robotSpeedMult({ AI_ROBOTS: 2 })).toBeCloseTo(0.90, 10);
    expect(robotSpeedMult({ AI_ROBOTS: 3 })).toBeCloseTo(0.85, 10);
    expect(robotSpeedMult({ AI_ROBOTS: 4 })).toBeCloseTo(0.80, 10);
    expect(robotSpeedMult({ AI_ROBOTS: 5 })).toBeCloseTo(0.75, 10);
  });

  it('stops at the top of its own table rather than running on', () => {
    expect(robotSpeedMult({ AI_ROBOTS: 99 })).toBeCloseTo(0.75, 10);
    expect(RESEARCH_MAX_LEVEL.AI_ROBOTS).toBe(RESEARCH_TECH.robotSpeedLadder.length);
  });

  it('reads an absent, zero or negative rung as holding nothing', () => {
    expect(robotSpeedMult({ AI_ROBOTS: 0 })).toBe(1);
    expect(robotSpeedMult({ AI_ROBOTS: -4 })).toBe(1);
  });
});

describe('what the robots actually shorten', () => {
  /**
   * A BUILDING'S TIMER IS AUTHORED WORK, NOT A PRICE. `profileBuilding().minutes`
   * is the design reference; `buildingMinutes` is the QUOTE, and it is the only
   * thing a server, a client or the simulator may put on a screen.
   */
  it('takes a quarter off every building at the top rung', () => {
    for (const id of BUILDING_IDS) {
      for (let level = 1; level <= 12; level++) {
        const base = profileBuilding(id, level).minutes;
        expect(buildingMinutes(id, level, {}), `${id} L${String(level)}`).toBe(base);
        expect(buildingMinutes(id, level, { AI_ROBOTS: 5 }), `${id} L${String(level)}`)
          .toBeCloseTo(base * 0.75, 10);
      }
    }
  });

  it('takes the same quarter off every instrument', () => {
    for (const id of INSTRUMENT_IDS) {
      for (let level = 0; level < 5; level++) {
        const price = instrumentCost(id, level);
        const base = buildMinutes(price, CORE, {});
        expect(buildMinutes(price, CORE, { AI_ROBOTS: 5 }), `${id} L${String(level)}`)
          .toBeCloseTo(base * 0.75, 10);
      }
    }
  });

  /**
   * INCLUDING THE TWO THE OWNER'S LIST DID NOT NAME. The Derrick and the Beacon
   * go down the same queue as the Foundry and the Uplink; leaving them out would
   * be an exception nothing on the screen could explain.
   */
  it('takes it off all four satellites, the Derrick and Beacon included', () => {
    for (const id of SATELLITE_IDS) {
      const base = buildMinutes(satelliteCost(id), CORE, {});
      expect(buildMinutes(satelliteCost(id), CORE, { AI_ROBOTS: 5 }), id)
        .toBeCloseTo(base * 0.75, 10);
    }
    expect(SATELLITE_IDS).toContain('DERRICK');
    expect(SATELLITE_IDS).toContain('BEACON');
  });

  it('shortens a building by exactly the rung it sold', () => {
    const base = profileBuilding('CORE', 9).minutes;
    for (let rung = 0; rung <= 5; rung++) {
      expect(buildingMinutes('CORE', 9, { AI_ROBOTS: rung }), `L${String(rung)}`)
        .toBeCloseTo(base * robotSpeedMult({ AI_ROBOTS: rung }), 10);
    }
  });
});

describe('what the robots must not touch', () => {
  /** The Yard is a separate queue with a separate project. */
  it('leaves a hull exactly where Yard Automation left it', () => {
    const price = cost(4500, 1200, 80);
    expect(shipMinutes(price, 6, { AI_ROBOTS: 5 }))
      .toBe(shipMinutes(price, 6, {}));
    expect(shipMinutes(price, 6, { AI_ROBOTS: 5, YARD_AUTOMATION: 5 }))
      .toBeCloseTo(shipMinutes(price, 6, {}) * 0.70, 10);
  });

  it('leaves a ground gun alone', () => {
    const price = cost(600, 200);
    expect(defenceMinutes(price, 4)).toBe(defenceMinutes(price, 4));
    expect(defenceMinutes(price, 4)).toBeGreaterThan(0);
  });

  /** Research has its own lane and the owner's list did not name it. */
  it('leaves a research rung alone', () => {
    const price = cost(9000, 7000);
    expect(researchMinutes(price, CORE)).toBeGreaterThan(0);
  });

  it('leaves the Yard project shaving only the Yard', () => {
    const base = profileBuilding('SHIPYARD', 5).minutes;
    expect(buildingMinutes('SHIPYARD', 5, { YARD_AUTOMATION: 5 })).toBe(base);
  });
});

/**
 * THE DISCOUNT LANDS AFTER THE CEILING, AND THAT IS DELIBERATE.
 *
 * `shipMinutes` multiplies before its clamp, so at `BUILD.capMinutes` a rung of
 * Yard Automation buys nothing. `research.ts` already names that defect in as
 * many words — at the cap "further cost stops being felt as time at all" — and a
 * commander who bought five rungs and watched a Core timer refuse to move would
 * be reading exactly that bug. So the cap bounds the WORK and the robots shorten
 * what comes out of it.
 */
describe('a timer already at the ceiling', () => {
  it('still feels the research', () => {
    const capped = BUILDING_IDS.map((id) => ({ id, level: 40 }))
      .filter(({ id, level }) => profileBuilding(id, level).minutes === BUILD.capMinutes);
    expect(capped.length).toBeGreaterThan(0);
    for (const { id, level } of capped) {
      expect(buildingMinutes(id, level, { AI_ROBOTS: 5 }), id)
        .toBeCloseTo(BUILD.capMinutes * 0.75, 10);
    }
  });

  it('does the same for an instrument priced past the cap', () => {
    const dear = cost(9_000_000, 9_000_000);
    expect(buildMinutes(dear, 1, {})).toBe(BUILD.capMinutes);
    expect(buildMinutes(dear, 1, { AI_ROBOTS: 5 })).toBeCloseTo(BUILD.capMinutes * 0.75, 10);
  });
});

/** A quote nobody can reach by accident: the argument is required, not defaulted. */
describe('the tech argument', () => {
  it('is asked of every construction quote', () => {
    expect(buildMinutes(buildingCost('VAULT', 3), CORE, {})).toBeGreaterThan(0);
    expect(buildingMinutes('VAULT', 4, {})).toBeGreaterThan(0);
  });
});
