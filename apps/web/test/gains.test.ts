import { describe, expect, it } from 'vitest';
import {
  BUILDING_IDS,
  INSTRUMENT_IDS,
  INSTRUMENT_MAX_LEVEL,
  SATELLITE_IDS,
  instrumentMaxed,
  radarContactRange,
  radarRange,
  sensorReach,
  telescopeSlots,
  type BuildingLevels,
  START_BUILDINGS,
} from '@astera/rules';
import { buildingGain, instrumentGain, satelliteGain } from '../src/lib/gains.js';

/**
 * AN UPGRADE ROW MUST NEVER SAY "X -> X".
 *
 * This file exists because of a real report, and the report was right about the
 * symptom and understated the cause. A player raised their Radar past level five
 * and the row kept reading "12 min -> 12 min"; the Telescope kept offering the
 * same slot bump; the Shipyard sat at "100% -> 100%". In every one of those cases
 * the game charged an exponential price.
 *
 * There were two separate faults underneath, and they need different fixes:
 *
 *   · THE TABLES RUN OUT. `radarRange` and `telescopeRange` have six entries
 *     each, and `atLevel` clamps — so level five really is the last one that buys
 *     anything, and nothing enforced or said so. That is now a hard ceiling (D36),
 *     refused by the server and marked `maxed` here.
 *   · THE ROW MEASURED THE WRONG THING. A Shipyard past L4 still buys probe
 *     accuracy against a VEILED target and still buys stealth, and a Veil past L4
 *     still blinds better telescopes — both were showing a clamped headline while
 *     the number that was actually moving went unmentioned.
 *
 * So the invariant below is deliberately blunt: at every level, of every item, in
 * every one of the four tabs, either the figures differ or the row is marked as
 * having nothing left to sell. Nothing may quietly show a purchase that changes
 * nothing.
 */

/** Deep enough to pass every table's end and every clamp in the game. */
const LEVELS = Array.from({ length: 15 }, (_, i) => i);

/**
 * The sibling levels a row needs to price itself.
 *
 * A building row cannot be described from its own level alone: the STORE's ceiling
 * scales with the Vault, and the Vault's floor is denominated in hours of the
 * Refinery's and the Extractor's production. Held at the level under test so each
 * row is read against a world that is actually that developed.
 */
const at = (level: number): BuildingLevels => ({
  // Never below what a planet is CREATED with. A world with a Refinery of zero
  // cannot exist, and asking what a row says on one produces a rate of zero and a
  // Vault that protects nothing — a failure of the fixture, not of the row.
  CORE: Math.max(START_BUILDINGS.CORE, level),
  REFINERY: Math.max(START_BUILDINGS.REFINERY, level),
  EXTRACTOR: Math.max(START_BUILDINGS.EXTRACTOR, level),
  VAULT: Math.max(START_BUILDINGS.VAULT, level),
  SHIPYARD: Math.max(START_BUILDINGS.SHIPYARD, level),
  HANGAR: Math.max(START_BUILDINGS.HANGAR, level),
  DEUTERIUM_PLANT: Math.max(START_BUILDINGS.DEUTERIUM_PLANT, level),
});

describe('every upgrade row states something that actually changes', () => {
  it('formats fractional storage hours to one decimal place', () => {
    const gain = buildingGain('VAULT', 0, 0, at(0));

    expect(gain.now).toContain('13.2h');
    expect(gain.next).toContain('14.1h');
    expect(gain.now).not.toContain('000000000');
    expect(gain.next).not.toContain('000000000');
  });

  it.each(BUILDING_IDS)('%s, at every level', (id) => {
    for (const level of LEVELS) {
      const gain = buildingGain(id, level, 0, at(level));
      expect(
        gain.now !== gain.next,
        `${id} L${String(level)} shows "${gain.now}" -> "${gain.next}" and still charges for it`,
      ).toBe(true);
    }
  });

  it.each(INSTRUMENT_IDS)('%s, at every level', (id) => {
    for (const level of LEVELS) {
      const gain = instrumentGain(id, level);
      const honest = gain.now !== gain.next || gain.maxed === true;
      expect(
        honest,
        `${id} L${String(level)} shows "${gain.now}" -> "${gain.next}" and is not marked maxed`,
      ).toBe(true);
    }
  });

  /** A satellite is bought once, so its row states an effect rather than a step. */
  it.each(SATELLITE_IDS)('%s says what it does', (id) => {
    const gain = satelliteGain(id);
    expect(gain.label.length).toBeGreaterThan(0);
    expect(gain.now !== gain.next || gain.now.length > 0).toBe(true);
  });

  /** And every row names its quantity — an unlabelled figure is a number, not a decision. */
  it('labels every figure it shows', () => {
    for (const id of BUILDING_IDS) {
      for (const level of LEVELS) expect(buildingGain(id, level, 0, at(level)).label).not.toBe('');
    }
    for (const id of INSTRUMENT_IDS) {
      for (const level of LEVELS) expect(instrumentGain(id, level).label).not.toBe('');
    }
  });
});

describe('the instrument ceiling', () => {
  /**
   * The cap is DERIVED from each table, so extending a table raises the ceiling
   * with it and nothing has to be typed twice. This pins the derivation rather
   * than the numbers, which is what stops the two drifting apart.
   */
  it('stops exactly where the effect table stops', () => {
    expect(INSTRUMENT_MAX_LEVEL.TELESCOPE).toBe(5);
    expect(INSTRUMENT_MAX_LEVEL.RADAR).toBe(5);
    // No table, no cap: a shield curve and a Veil both keep buying at every level.
    expect(INSTRUMENT_MAX_LEVEL.AEGIS).toBeNull();
    expect(INSTRUMENT_MAX_LEVEL.VEIL).toBeNull();
  });

  it('reports maxed only at and above the ceiling', () => {
    for (const id of INSTRUMENT_IDS) {
      const max = INSTRUMENT_MAX_LEVEL[id];
      if (max === null) {
        for (const level of LEVELS) expect(instrumentMaxed(id, level), `${id} L${String(level)}`).toBe(false);
        continue;
      }
      expect(instrumentMaxed(id, max - 1)).toBe(false);
      expect(instrumentMaxed(id, max)).toBe(true);
      expect(instrumentMaxed(id, max + 7)).toBe(true);
    }
  });

  it('marks the row maxed at exactly the same level the rule does', () => {
    for (const id of INSTRUMENT_IDS) {
      for (const level of LEVELS) {
        expect(instrumentGain(id, level).maxed === true, `${id} L${String(level)}`).toBe(
          instrumentMaxed(id, level),
        );
      }
    }
  });

  /**
   * THE UNBOUNDED SLOT COUNT, WHICH IS THE PART THAT WAS A BALANCE HOLE.
   *
   * `telescopeSlots` had no table behind it and grew forever — L7 bought a fourth
   * watch slot, L9 a fifth — while range and cooldown had quietly stopped at L5.
   * D18 is explicit that watching a fourth planet should be a mid-season project;
   * an unbounded fog advantage available to anyone who keeps paying is the
   * opposite of that.
   */
  it('never grants a watch slot past the telescope ceiling', () => {
    const top = telescopeSlots(INSTRUMENT_MAX_LEVEL.TELESCOPE ?? 5);
    for (const level of [...LEVELS, 40, 400]) {
      expect(telescopeSlots(level), `L${String(level)}`).toBeLessThanOrEqual(top);
    }
    expect(top).toBe(3);
  });

  it('still grows the slot count on the way up', () => {
    expect(telescopeSlots(0)).toBe(0);
    expect(telescopeSlots(1)).toBe(1);
    expect(telescopeSlots(3)).toBe(2);
    expect(telescopeSlots(5)).toBe(3);
  });

  it('shows the capped moving-contact reach instead of promising the whole galaxy', () => {
    const top = instrumentGain('TELESCOPE', 5);
    expect(top.unlocks).toContain(String(sensorReach(5)));
    expect(top.unlocks?.toLowerCase()).not.toContain('whole disc');

    const lastStep = instrumentGain('TELESCOPE', 4);
    expect(lastStep.unlocks).toContain(String(sensorReach(5)));
    expect(lastStep.unlocks).not.toContain('Infinity');
  });

  it('shows both Radar areas and keeps the wide one explicitly clockless', () => {
    for (const level of [3, 4, 5]) {
      const gain = instrumentGain('RADAR', level);
      expect(gain.now).toContain(String(radarContactRange(level)));
      expect(gain.now).toContain(String(radarRange(level)));
      expect(gain.now.toLowerCase()).toContain('no eta');
    }
  });
});

/**
 * The two rows that were measuring a clamped number. Both now report something
 * monotonic, and monotonic is the property that matters: every level must be worth
 * strictly more than the one below it, or the row is back to lying.
 */
describe('the rows that switch metric once their headline flattens', () => {
  it('the Shipyard keeps naming a bigger number at every level', () => {
    const seen = LEVELS.map((l) => buildingGain('SHIPYARD', l, 0, at(l)));
    for (const [i, gain] of seen.entries()) {
      expect(gain.now, `L${String(i)}`).not.toBe(gain.next);
    }
    // Past the accuracy clamp it talks about Veils instead, and that figure rises.
    const high = seen.slice(6);
    for (const gain of high) expect(gain.label).toMatch(/veil/i);
  });

  it('the Veil keeps naming a better telescope at every level', () => {
    for (const level of LEVELS) {
      const gain = instrumentGain('VEIL', level);
      expect(gain.now, `L${String(level)}`).not.toBe(gain.next);
    }
    // And the figure it names climbs rather than bottoming out at BLIND.
    expect(instrumentGain('VEIL', 8).next).not.toBe(instrumentGain('VEIL', 4).next);
  });
});
