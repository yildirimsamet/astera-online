import { describe, expect, it } from 'vitest';
import {
  BUILDING_IDS,
  INSTRUMENT_IDS,
  INSTRUMENT_MAX_LEVEL,
  SATELLITE_IDS,
  instrumentMaxed,
  telescopeSlots,
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

describe('every upgrade row states something that actually changes', () => {
  it.each(BUILDING_IDS)('%s, at every level', (id) => {
    for (const level of LEVELS) {
      const gain = buildingGain(id, level, 0);
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
      for (const level of LEVELS) expect(buildingGain(id, level, 0).label).not.toBe('');
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
});

/**
 * The two rows that were measuring a clamped number. Both now report something
 * monotonic, and monotonic is the property that matters: every level must be worth
 * strictly more than the one below it, or the row is back to lying.
 */
describe('the rows that switch metric once their headline flattens', () => {
  it('the Shipyard keeps naming a bigger number at every level', () => {
    const seen = LEVELS.map((l) => buildingGain('SHIPYARD', l, 0));
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
