import { CORE_TOP_LEVEL, worldRadius } from '@astera/rules';
import { describe, expect, it } from 'vitest';
import { ASTEROID_RADIUS, CRAFT_SCALE, asteroidRadius } from '../src/galaxy/scene.js';
import { TRADE_SHIP_BASE_SCALE, TRADE_SHIP_SCALE } from '../src/galaxy/TradeShip.js';
import { HULL_VISUAL_SCALE, hullVisualScale } from '../src/galaxy/flightVisual.js';

/**
 * HOW BIG THINGS ARE DRAWN, AFTER THE OWNER LOOKED AT A PHONE.
 *
 * Rocks, craft and worlds all grew on the same report — they were too small to see
 * on the screen the game is actually played on. Each moved through ONE factor, and
 * that is the property worth a test: the relative sizes inside each family are a
 * design statement, and a bulk change that flattened them would fix the complaint
 * and delete the information at the same time.
 */

describe('the rock ladder', () => {
  /**
   * SIZE IS VALUE. Ore comes from level and nothing else, so a player sweeping the
   * disc can rank rocks by eye without opening anything. A resize therefore has to
   * move every rung by the same factor or that ranking stops being readable.
   */
  it('grew by one factor, so every ratio between grades survived', () => {
    const authored = [0.075, 0.105, 0.143, 0.195, 0.255];
    const factor = ASTEROID_RADIUS[1]! / authored[0]!;

    expect(factor).toBeGreaterThan(1);
    for (const [index, base] of authored.entries()) {
      expect(ASTEROID_RADIUS[index + 1]! / base, `grade ${String(index + 1)}`)
        .toBeCloseTo(factor, 9);
    }
  });

  it('still rises with every grade', () => {
    for (let level = 1; level < 5; level += 1) {
      expect(asteroidRadius(level + 1)).toBeGreaterThan(asteroidRadius(level));
    }
  });

  /**
   * Only planets take the additional 20% season shrink. Rocks retain their
   * existing sizes, so their size relative to a planet rises by 1/0.8.
   */
  it('keeps its size while developed worlds remain larger after the planet shrink', () => {
    const richest = asteroidRadius(5);
    expect(richest).toBeCloseTo(0.3825, 9);
    expect(worldRadius(1)).toBeCloseTo((0.54 * 1.25 * 1.3 / 1.8636) * 0.8 * 0.8, 9);
    expect(richest).toBeLessThan(worldRadius(11) * 0.6 / 0.8);
    expect(richest).toBeLessThan(worldRadius(CORE_TOP_LEVEL) * 0.35 / 0.8);
  });
});

describe('the craft dial', () => {
  /**
   * ONE MULTIPLIER FOR EVERY HULL, PROBE AND DRILL, which is why the fleet and the
   * strategic weapon could be doubled without inverting them. Doubling only the
   * two classes the owner named would have left the Death Star (0.34) drawn
   * smaller than an ordinary squadron (0.39), and an unidentified contact visibly
   * smaller than the same craft once a telescope had named it.
   */
  it('is a single factor the whole galaxy reads', () => {
    const source = String(CRAFT_SCALE);
    expect(Number(source)).toBeGreaterThan(1);
    expect(CRAFT_SCALE).toBe(1.6);
  });

  /** The authored per-hull table is untouched: it states shape, not absolute size. */
  it('leaves the relative hull table alone', () => {
    expect(HULL_VISUAL_SCALE.DART).toBeLessThan(HULL_VISUAL_SCALE.VIPER);
    expect(HULL_VISUAL_SCALE.VIPER).toBeLessThan(HULL_VISUAL_SCALE.TEMPEST);
    expect(HULL_VISUAL_SCALE.TEMPEST).toBeLessThan(HULL_VISUAL_SCALE.CATACLYSM);
  });

  /**
   * FORMATION SPACING RIDES THE SAME NUMBER. `formationLayout` takes its spacing
   * from the largest drawn hull, so bigger craft make bigger room for themselves —
   * which is the reason a bulk resize does not put a Cataclysm through a Dart.
   */
  it('scales a hull and the room around it together', () => {
    const small = hullVisualScale('DART', 1);
    const large = hullVisualScale('CATACLYSM', 1);
    expect(hullVisualScale('DART', 2) / small).toBeCloseTo(2, 9);
    expect(hullVisualScale('CATACLYSM', 2) / large).toBeCloseTo(2, 9);
  });
});

describe('the merchant', () => {
  /**
   * THE TRADE SHIP IS STATED AS A FRACTION OF `CRAFT_SCALE`, so the owner's
   * "double the trade ship" was already paid by the craft dial and its own
   * multiplier did not have to move. That relationship is the thing to hold: a
   * future craft resize must carry the merchant with it rather than leaving it
   * behind at a hand-typed size.
   */
  it('rides the craft dial rather than a size of its own', () => {
    expect(TRADE_SHIP_BASE_SCALE / CRAFT_SCALE).toBeCloseTo(0.2, 9);
    expect(TRADE_SHIP_SCALE).toBeCloseTo(TRADE_SHIP_BASE_SCALE * 4, 9);
  });

  /** Its fixed silhouette can exceed a middle world after only planets shrink. */
  it('retains its own size as planets become smaller around it', () => {
    expect(TRADE_SHIP_SCALE).toBeCloseTo(1.28, 9);
    expect(TRADE_SHIP_SCALE).toBeGreaterThan(hullVisualScale('CATACLYSM', 0.195 * CRAFT_SCALE));
    expect(TRADE_SHIP_SCALE).toBeGreaterThan(worldRadius(11) * 2);
    expect(TRADE_SHIP_SCALE).toBeLessThan(worldRadius(CORE_TOP_LEVEL) * 2);
  });
});
