import { describe, expect, it } from 'vitest';
import {
  CORE_TOP_LEVEL,
  alloyRate,
  orbitStandoff,
  storageCap,
  surfaceStandoff,
  toWorld,
  upgradeCost,
  visualLeg,
  worldRadius,
  worldWeight,
  type Vec3,
} from '../src/index.js';

const gap = (a: Vec3, b: Vec3): number => {
  const left = toWorld(a);
  const right = toWorld(b);
  return Math.hypot(left[0] - right[0], left[1] - right[1], left[2] - right[2]);
};

describe('the shared visual leg', () => {
  it('uses tight surface clearance rather than the wider orbital hold', () => {
    expect(surfaceStandoff(1.4)).toBeCloseTo(1.61, 8);
    expect(surfaceStandoff(1.4)).toBeLessThan(orbitStandoff(1.4));
  });

  it('bakes both endpoint clearances into one straight leg in world space', () => {
    const from = { x: -400, y: -60, z: 20 };
    const to = { x: 600, y: 90, z: -130 };
    const start = surfaceStandoff(0.82);
    const end = orbitStandoff(1.4);
    const drawn = visualLeg(from, to, start, end);

    expect(gap(from, drawn.from)).toBeCloseTo(start, 8);
    expect(gap(to, drawn.to)).toBeCloseTo(end, 8);
    expect(gap(drawn.from, drawn.to)).toBeGreaterThan(0);
  });

  it('never reverses a very short leg when both ends need clearance', () => {
    const from = { x: 0, y: 0, z: 0 };
    const to = { x: 10, y: 0, z: 0 };
    const drawn = visualLeg(from, to, 40, 40);
    const start = toWorld(drawn.from)[0];
    const end = toWorld(drawn.to)[0];

    expect(start).toBeLessThanOrEqual(end);
    expect(start).toBeCloseTo(end, 8);
  });
});

/**
 * A WORLD GROWS EVERY CORE LEVEL, NOT EVERY THIRD ONE. D153.
 *
 * The disc used to draw three silhouettes off the coarse tier, which put the whole
 * public development signal into two hard steps — Core 3 → 4 and Core 9 → 10 — each
 * of them close to doubling a world's drawn size. The owner's report is what that
 * looks like from the map: a neighbour who was one thing yesterday is suddenly
 * another, and nothing between those two levels reads at all.
 *
 * SO THE THREE AUTHORED SIZES BECOME THE ANCHORS OF A RAMP rather than the whole
 * table. Nothing about the tuned spread moves — 0.44 at the floor, 0.82 in the
 * middle, 1.40 at the cap, and the same 3.2× between the ends that makes a
 * heavyweight read as one from across the disc — but the steps between them are now
 * one per Core level and geometric, so every level is the same proportional growth
 * and none of them is a jump.
 *
 * IT READS THE EXACT LEVEL, WHICH COSTS NOTHING NEW: `publicGalaxy` has published
 * `coreLevel` since the dyson rings, because a ring count that steps every three
 * levels and a colour that steps every one cannot be drawn from a tier. The tier
 * stays exactly where it was, and is still what D49's ±2 attack band is defined on.
 */
describe('D153 world size by core level', () => {
  it('anchors the three authored sizes at the floor, the middle and the cap', () => {
    expect(worldRadius(1)).toBeCloseTo(0.44, 8);
    expect(worldRadius(11)).toBeCloseTo(0.82, 8);
    expect(worldRadius(CORE_TOP_LEVEL)).toBeCloseTo(1.4, 8);
  });

  /**
   * THE WHOLE POINT: no single level is a step the eye reads as an event. The old
   * table's two transitions were +86% and +71%; this one's largest is under 7%.
   */
  it('grows at every level, and never in a jump', () => {
    for (let level = 1; level < CORE_TOP_LEVEL; level += 1) {
      const step = worldRadius(level + 1) / worldRadius(level);
      expect(step, `core ${String(level)} to ${String(level + 1)}`).toBeGreaterThan(1);
      expect(step, `core ${String(level)} to ${String(level + 1)}`).toBeLessThan(1.07);
    }
  });

  /** The signal the whole thing exists for is the spread, and it is unchanged. */
  it('keeps the authored spread from the floor to the cap', () => {
    expect(worldRadius(CORE_TOP_LEVEL) / worldRadius(1)).toBeCloseTo(3.18, 2);
  });

  /**
   * A WORLD NOBODY HAS SEEN IS A POINT WITH NOTHING BEHIND IT. D127 omits
   * `coreLevel` for an UNKNOWN world and the schema parses the gap to zero, so the
   * floor has to hold below the first level as well as at it.
   */
  it('draws an unread world at the smallest size', () => {
    expect(worldRadius(0)).toBe(worldRadius(1));
    expect(worldRadius(-3)).toBe(worldRadius(1));
  });

  /**
   * A RADIUS FEEDS A POSITION BUFFER, and one NaN takes the whole scene down. A
   * level that is not a number is answered the way a missing one is.
   */
  it('never answers with a NaN', () => {
    expect(worldRadius(Number.NaN)).toBe(worldRadius(1));
    expect(worldRadius(Number.POSITIVE_INFINITY)).toBe(worldRadius(1));
  });

  /** Nothing in the game reaches past the cap, and nothing may grow past it either. */
  it('clamps at the top of the ladder rather than growing forever', () => {
    expect(worldRadius(CORE_TOP_LEVEL + 9)).toBe(worldRadius(CORE_TOP_LEVEL));
  });

  /**
   * THE CAP IS A MEASUREMENT, NOT A PREFERENCE, and this is the guard on it. Nothing
   * caps the Command Core in `build.ts`; the economy does — `upgradeCost` outgrows
   * what a world can hold, and past that a Core rises only on resources shipped in
   * from colonies. Both ladders anchored on the number, so a tempo change that moved
   * it silently would leave the biggest world in the galaxy a rung short of its own
   * structure.
   */
  it('anchors the cap at the last Core level a world can fund itself', () => {
    const selfFunded = (level: number): boolean =>
      upgradeCost(level).alloy < storageCap(alloyRate(level), level);
    expect(selfFunded(CORE_TOP_LEVEL - 1)).toBe(true);
    expect(selfFunded(CORE_TOP_LEVEL)).toBe(false);
  });

  /** And it is genuinely no longer a tier: two levels inside one tier differ. */
  it('separates two worlds the coarse tier could not tell apart', () => {
    expect(worldRadius(4)).toBeLessThan(worldRadius(5));
    expect(worldRadius(5)).toBeLessThan(worldRadius(6));
  });

  /**
   * The words still come from the tier. `weight` is what a surface says out loud —
   * one of three — while the radius is what the eye reads, and only the radius
   * needed the resolution.
   */
  it('leaves the coarse tier and its three weights exactly where they were', () => {
    expect(worldWeight(1)).toBe(1);
    expect(worldWeight(2)).toBe(2);
    expect(worldWeight(3)).toBe(2);
    expect(worldWeight(4)).toBe(3);
  });
});
