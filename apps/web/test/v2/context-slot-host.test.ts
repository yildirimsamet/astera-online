import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * THE GALAXY HOSTS THE CONTEXT SLOT, AND WIRES IT AS THE OLD GUIDE WAS WIRED.
 *
 * A missing host condition is a regression no component test can see (the same
 * reasoning `trade-wiring.test` gives), so these read the host's source.
 */

const source = readFileSync('src/screens/GalaxyView.tsx', 'utf8');

describe('the galaxy host', () => {
  /** Spec H1: the shield reaches the suggestion from the season the galaxy already reads. */
  it('passes the attack shield to the suggestion', () => {
    expect(source).toMatch(/shieldUntil: season\.data\.shieldUntil/);
  });

  it('draws one context slot and no longer the old guide or the event chip', () => {
    expect(source.match(/<ContextSlot\b/g)).toHaveLength(1);
    expect(source).not.toMatch(/<SituationGuide\b|<ActiveGalaxyEvent\b/);
  });

  it('keeps the slot out of the Academy and the rehearsal', () => {
    expect(source).toMatch(/\{showGuidance && planet\.data && panel === null/);
  });
});

describe('the collect bubble on the world', () => {
  const canvas = readFileSync('src/galaxy/GalaxyCanvas.tsx', 'utf8');

  it('is anchored to the active world in the scene', () => {
    expect(canvas).toMatch(/onHomeAnchor && \(\s*<Html position=\{home\}/);
  });

  /**
   * THROUGH A PORTAL, NOT INSIDE THE <Html>. Found in the real game: drei's `<Html>`
   * renders into a React root of its own, and a bubble drawn inside it lost every
   * provider — "useApi called outside ApiProvider". The scene only lends an anchor
   * element; the galaxy portals the bubble into it from its own tree.
   */
  it('is portalled into that anchor by the galaxy, in the real game only', () => {
    expect(canvas).not.toMatch(/homeOverlay/);
    expect(source).toMatch(/showGuidance && season\.data\?\.status === 'live' \? \{ onHomeAnchor: setHomeAnchor \}/);
    expect(source).toMatch(/createPortal\(\s*<CollectHost\b/);
  });
});
