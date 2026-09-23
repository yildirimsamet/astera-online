import { describe, expect, it } from 'vitest';
import { RADAR_VISIBILITY, radarPosts, type ReachRing } from '../src/galaxy/SensorRings.js';

/**
 * WHICH WORLDS DRAW A RADAR, AND HOW LOUD. Split out of the old sensor-switch test when the
 * switches moved into the v2 View sheet (their rules live in test/v2/view-sheet.test.tsx).
 */

/**
 * EVERY GREEN THING AT THE SAME FRACTION. Owner instruction: *"tarama çemberindeki
 * ve küredeki görselin hepsini oranlı bir şekilde → %70 daha saydam yap"*.
 *
 * One constant rather than eight hand-edited alphas, because the RELATIONSHIPS
 * between those alphas are what make the instrument read as one object — the wide
 * volume is deliberately fainter than the beam, and eight separate edits would
 * quietly lose that.
 */
describe('how loud the radar is allowed to be', () => {
  it('draws everything at three tenths of its tuned strength', () => {
    expect(RADAR_VISIBILITY).toBeCloseTo(0.3, 5);
  });
});

/**
 * BOTH SWITCHES COVER EVERY WORLD. Owner instruction, and the third version of it.
 *
 * The first was one flag for the galaxy while only the ACTIVE world's radar was
 * drawn, so the two adjacent switches had two different reaches. The second keyed
 * visibility by world, which was consistent and still wrong: a player who takes
 * the glass off does not mean "off here". The switch is global again, and the half
 * that made version one wrong is fixed at the other end — every world that owns a
 * radar draws one.
 */
describe('whose circles a switch covers', () => {
  const post = (planetId: string, detect: number): ReachRing => ({
    planetId,
    at: { x: 0, y: 0, z: 0 },
    telescope: true,
    identify: 900,
    detect,
  });

  it('draws a radar for every world that has one', () => {
    const drawn = radarPosts([post('capital', 1300), post('colony', 700)]);
    expect(drawn.map((entry) => entry.key)).toEqual(['capital', 'colony']);
  });

  /** A naked-eye world owns no green circle and must not be given one. */
  it('draws none for a world with no radar', () => {
    expect(radarPosts([post('capital', 1300), post('bare', 0)]).map((e) => e.key))
      .toEqual(['capital']);
    expect(radarPosts([post('bare', 0)])).toEqual([]);
  });

  /** The sweep and the shell are one instrument stating one reach. */
  it('gives the circle the radar’s own detection radius', () => {
    const [drawn] = radarPosts([post('capital', 2200)]);
    expect(drawn!.radius).toBeGreaterThan(0);
    expect(radarPosts([post('near', 700)])[0]!.radius).toBeLessThan(drawn!.radius);
  });
});
