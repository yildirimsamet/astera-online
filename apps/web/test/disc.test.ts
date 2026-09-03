import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { discProfile } from '../src/galaxy/nebula.js';
import {
  DISC_OPACITY,
  DISC_ROTATION_RADIANS_PER_SECOND,
  METEOR_GAP,
  METEOR_POOL,
  meteorPool,
  STARFIELD_ROTATION_RADIANS_PER_SECOND,
  advanceDiscRotation,
  advanceStarfieldRotation,
  syncStarShell,
} from '../src/galaxy/Environment.jsx';
import { STANCE_LIGHT } from '../src/galaxy/scene.js';

/**
 * THE GALACTIC PLANE. D53b.
 *
 * It was five rings and sixteen spokes, then the same rings with their brightness
 * modulated around the circumference — and photographed from overhead it still read
 * as a targeting reticle, because the graph-paper quality never came from the lines
 * being even. It came from them being LINES, and a telescope image has none.
 *
 * So the plane is a painted plate now: spiral arms of gas and dust lying flat. Most
 * of what makes that look right is judged from a photograph and belongs in one.
 * Two things are not, and both would ship a visible defect rather than a
 * different-looking one — so they are asserted here.
 */
describe('the galactic plane', () => {
  /**
   * IT HAS NO EDGE.
   *
   * A plate that is still bright where it stops is a disc with a cut boundary,
   * which is precisely the drawn quality that replacing the lines was for.
   */
  it('reaches nothing at the rim, and gets there smoothly', () => {
    expect(discProfile(1)).toBe(0);
    expect(discProfile(1.4)).toBe(0);
    // And the approach is continuous: no step from something to nothing.
    expect(discProfile(0.99)).toBeLessThan(0.01);
    expect(discProfile(0.95)).toBeLessThan(discProfile(0.85));
  });

  /**
   * AND IT LEAVES THE MIDDLE ALONE.
   *
   * `Core` already puts a warm brightening at the centre. If the plate stacked on
   * top of it the two would read as a STAR — and the design deliberately has none:
   * there is no sun in this galaxy and worlds do not orbit anything.
   */
  it('is empty where the core already is', () => {
    expect(discProfile(0)).toBe(0);
    expect(discProfile(0.04)).toBe(0);
    expect(discProfile(0.08)).toBe(0);
    // Then it arrives, rather than switching on.
    expect(discProfile(0.12)).toBeGreaterThan(0);
    expect(discProfile(0.12)).toBeLessThan(discProfile(0.25));
  });

  /** The body of the disc is where the disc is. */
  it('is strongest through the body', () => {
    const body = discProfile(0.3);
    expect(body).toBeGreaterThan(discProfile(0.1));
    expect(body).toBeGreaterThan(discProfile(0.8));
    expect(body).toBeCloseTo(1, 5);
  });

  /** Nonsense in, nothing out. This is fed a distance computed per pixel. */
  it('is never negative and never over one', () => {
    for (const r of [-1, 0, 0.001, 0.5, 0.999, 1, 99, Number.NaN]) {
      const v = discProfile(r);
      expect(v, `r=${String(r)}`).toBeGreaterThanOrEqual(0);
      expect(v, `r=${String(r)}`).toBeLessThanOrEqual(1);
    }
  });

  /**
   * IT IS SCENERY, AND SCENERY IS NOT ALLOWED TO BE THE SUBJECT. Owner decision.
   *
   * This first asserted only that the plate was dimmer than the dimmest thing that
   * has to read against it — a world the fog has taken down to `STANCE_LIGHT.dark`.
   * That is a LEGIBILITY test, and it is not the rule: it passed 0.38, which the
   * owner looked at and rejected because the arms held the eye. What a player is
   * meant to be looking at is the worlds.
   *
   * So the bar is subordination rather than mere darkness — comfortably under half
   * the dimmest world it sits behind. Stated as the relationship and not as the
   * number, because the number is a taste and the relationship is the decision.
   */
  it('stays clearly subordinate to the dimmest world it sits behind', () => {
    expect(DISC_OPACITY).toBeLessThanOrEqual(STANCE_LIGHT.dark / 2);
  });

  it('turns the dust plate slowly and smoothly from client frame deltas', () => {
    expect(DISC_ROTATION_RADIANS_PER_SECOND).toBeGreaterThan(0);
    expect((Math.PI * 2) / DISC_ROTATION_RADIANS_PER_SECOND).toBeCloseTo(2 * 60, 8);
    expect(advanceDiscRotation(0.4, 0.5)).toBeCloseTo(
      0.4 + DISC_ROTATION_RADIANS_PER_SECOND * 0.5,
      8,
    );
  });

  it('ignores bad frame deltas without allowing motion preferences to freeze the cloud', () => {
    expect(advanceDiscRotation(0.4, -1)).toBe(0.4);
    expect(advanceDiscRotation(0.4, Number.NaN)).toBe(0.4);
  });

  it('runs the camera-centred starfield twenty-five per cent faster', () => {
    expect((Math.PI * 2) / STARFIELD_ROTATION_RADIANS_PER_SECOND).toBeCloseTo(9.6 * 60, 8);
    expect(advanceStarfieldRotation(0.4, 1)).toBeCloseTo(
      0.4 + STARFIELD_ROTATION_RADIANS_PER_SECOND,
      8,
    );
    expect(advanceStarfieldRotation(0.4, -1)).toBe(0.4);
    expect(advanceStarfieldRotation(0.4, Number.NaN)).toBe(0.4);
  });

  it('keeps the rotating star shell centred on the camera, never inside the galaxy', () => {
    const shell = new THREE.Object3D();
    const camera = new THREE.PerspectiveCamera();
    camera.position.set(14, 3, -8);

    syncStarShell(shell, camera, 1);

    expect(shell.position.toArray()).toEqual([14, 3, -8]);
    expect(shell.rotation.y).toBeCloseTo(STARFIELD_ROTATION_RADIANS_PER_SECOND, 8);

    camera.position.set(-20, 7, 11);
    syncStarShell(shell, camera, 0.5);
    expect(shell.position.toArray()).toEqual([-20, 7, 11]);
  });

  it('halves both meteor gaps to double the random shooting-star cadence', () => {
    expect(METEOR_GAP).toEqual([3.5, 13]);
  });

  /**
   * THE SKY ANSWERS THE EVENT. Owner instruction.
   *
   * An Asteroid Shower is the one public moment the whole galaxy shares (D149),
   * and until now it was a line of text in the corner. Tripling the shooting stars
   * for exactly as long as it runs makes the sky itself the announcement — and
   * because meteors are purely local decoration that is seeded from nothing and
   * fetched from nowhere, it costs the server not one byte.
   */
  it('triples the shooting stars while a shower is running, and only while it runs', () => {
    expect(meteorPool(false)).toBe(METEOR_POOL);
    expect(meteorPool(true)).toBe(METEOR_POOL * 3);
  });
});
