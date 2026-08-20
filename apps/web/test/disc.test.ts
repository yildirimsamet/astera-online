import { describe, expect, it } from 'vitest';
import { discProfile } from '../src/galaxy/nebula.js';
import { DISC_OPACITY } from '../src/galaxy/Environment.jsx';
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
});
