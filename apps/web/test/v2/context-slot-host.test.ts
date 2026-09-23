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

describe('Galaxy pressed again', () => {
  /**
   * THE OLD HOME MARK'S THREE STEPS (D163), NOT THE ACADEMY'S FLIGHT (D56). Home
   * clears the focus, focuses the active world — so the very next tap on it opens
   * management — and raises the home signal. The Academy's `goHome` clears the
   * focus instead, which is right for a lesson and wrong for the dock.
   */
  it('flies home and primes the active world, as the disc Home mark did', () => {
    const home = source.slice(source.indexOf('useRequest(homeRequest'), source.indexOf('useRequest(worldsRequest'));
    expect(home).toMatch(/close\(\);\s*focusPlanet\(activePlanetId\);\s*setHomeSignal/);
  });

  it('is what the app hands the shell’s home request to', () => {
    const app = readFileSync('src/App.tsx', 'utf8');
    expect(app).toMatch(/homeRequest=\{homeRequest\}/);
    expect(app).not.toMatch(/goHome=\{goHome\}/);
  });
});

describe('the View chip in the Academy', () => {
  /**
   * The Academy hides `[data-sensor-toggles]` until its Telescope exercise and
   * `[data-disc-controls]` always. The chip carries the switches now, so it answers
   * to the first rule — or the exercise could never be reached.
   */
  it('answers to the rule that reveals the sensor switches for the Telescope exercise', () => {
    expect(source).toMatch(/<div data-sensor-toggles className="pointer-events-none">\s*<ViewChip/);
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
