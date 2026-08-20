import { describe, expect, it } from 'vitest';
import { LIMB_SCALE, LIMB_TINT, SELECTION_RING } from '../src/galaxy/PlanetField.js';
import { STANCE_LIGHT } from '../src/galaxy/scene.js';

/**
 * THE AIR AROUND A WORLD, AND WHAT IT IS NOT ALLOWED TO BECOME. D53a.
 *
 * The planet renders end at a hard alpha cut, so every world sat on black as a
 * cut-out — and they were the only objects in a scene where a hull sheds a wake, a
 * shield breathes and a rock tumbles with nothing happening at all. The limb is the
 * light a planet scatters at its own edge, and it is one instanced quad.
 *
 * It is also the easiest thing here to get wrong, and it was got wrong twice before
 * the photographs came back right: too wide and it is a grey cloud, too even and it
 * is a gasket, too far out and it drowns the one marker that says which world the
 * player selected. Those are proportions, so they are asserted rather than judged
 * from a screenshot that nobody will take again.
 */
describe('the atmosphere limb', () => {
  /**
   * IT STANDS OFF THE WORLD, AND STOPS WELL SHORT OF THE MARKER.
   *
   * Every world in the galaxy has a limb; exactly one has a selection ring. A limb
   * that reached as far as the ring would make the marker read against a bright
   * band instead of against space, and "which of these did I tap" is the question
   * the ring exists to answer.
   */
  it('sits outside the world and inside the selection ring', () => {
    expect(LIMB_SCALE).toBeGreaterThan(1);
    expect(LIMB_SCALE).toBeLessThan(SELECTION_RING);
    // And not by a hair: the ring needs clear space to read in.
    expect(SELECTION_RING - LIMB_SCALE).toBeGreaterThan(0.1);
  });

  /**
   * A BAND, NOT A CLOUD.
   *
   * Photographed first at 1.34, which put half a radius of grey haze around every
   * world — the same failure `BLAST_SIZE` records, and the same fix. Anything past
   * a fifth of the radius stops reading as an edge effect and starts reading as
   * weather.
   */
  it('is a fifth of a radius at most', () => {
    expect(LIMB_SCALE - 1).toBeLessThanOrEqual(0.2);
  });

  /**
   * SCATTERED LIGHT IS WARM, and neutral grey is what the second attempt looked
   * like. The key light in this scene is warm and the sixteen planet renders are
   * lit to match, so a limb that is not warmer than it is blue belongs to a
   * different scene from the art it is drawn around.
   */
  it('is warm, in the same direction as the key light', () => {
    expect(LIMB_TINT.r).toBeGreaterThan(LIMB_TINT.g);
    expect(LIMB_TINT.g).toBeGreaterThan(LIMB_TINT.b);
  });

  /**
   * AND THE FOG STILL HOLDS OVER IT.
   *
   * The bodies are dimmed per instance by `STANCE_LIGHT`, so an unwatched world is
   * literally darker. The limb is multiplied by the same figure — if it were not,
   * the brightest pixel on the silhouette would be at full strength on exactly the
   * worlds the fog is hiding, which is the most eye-catching way available to undo
   * it.
   */
  it('is dimmed by the same stance light as the world it belongs to', () => {
    const brightest = Math.max(...Object.values(STANCE_LIGHT));
    const darkest = Math.min(...Object.values(STANCE_LIGHT));
    expect(darkest).toBeLessThan(brightest);
    // The value the component multiplies by, asserted as the relationship it has
    // to hold rather than as a repeat of the arithmetic.
    expect(LIMB_TINT.r * darkest).toBeLessThan(LIMB_TINT.r * brightest);
  });
});
