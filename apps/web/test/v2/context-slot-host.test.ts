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

  /** The slot is unmounted under every page; what the player closed must outlive it. */
  it('keeps the closed cards in the galaxy, which outlives the slot', () => {
    expect(source).toMatch(/dismissed=\{slotDismissed\}/);
  });

  it('keeps the slot out of the Academy and the rehearsal', () => {
    expect(source).toMatch(/const slotShown = showGuidance && Boolean\(planet\.data\) && panel === null/);
    expect(source).toMatch(/\{slotShown && planet\.data && season\.data && \(\s*<ContextSlot/);
  });
});

/** Owner, 2026-09-24: a closed event card came back on every return to the game. */
describe('the slot’s closed cards', () => {
  it('starts from what this device remembers and remembers each close', () => {
    expect(source).toMatch(/useState<ReadonlySet<string>>\(\(\) => readDismissed\(serverNow\(\)\)\)/);
    const dismiss = source.slice(source.indexOf('onDismiss={(keys) =>'));
    expect(dismiss.slice(0, 200)).toMatch(/rememberDismissed\(keys, serverNow\(\)\)/);
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
    const home = source.slice(source.indexOf('const flyHome'), source.indexOf('useRequest(homeRequest'));
    expect(home).toMatch(/close\(\);\s*focusPlanet\(activePlanetId\);\s*setHomeSignal/);
  });

  it('is what the app hands the shell’s home request to', () => {
    const app = readFileSync('src/App.tsx', 'utf8');
    expect(app).toMatch(/homeRequest=\{homeRequest\}/);
    expect(app).not.toMatch(/goHome=\{goHome\}/);
  });
});

describe('the galaxy corners (owner, 2026-09-24)', () => {
  it('flies home from the round button exactly as the dock does', () => {
    expect(source).toMatch(/useRequest\(homeRequest, flyHome\)/);
    expect(source).toMatch(/<HomeChip onHome=\{flyHome\} \/>/);
  });

  it('keeps the event chips out of the way while a selection has the screen', () => {
    expect(source).toMatch(/!slotSelected && \(\s*<EventChips/);
    expect(source).toMatch(/selected=\{slotSelected\}/);
  });

  /** Owner, 2026-09-24: low on the right, riding the slot's corner, opening chat's own page. */
  it('opens chat from low on the right, above the slot, and never in the rehearsal', () => {
    expect(source).toMatch(/const chatButton = showGuidance && showChat\s*\?\s*<ChatChip[\s\S]*?onPanel\('chat'\)/);
    expect(source).toMatch(/corner: chatButton/);
  });
});

describe('the report door in the galaxy (E6)', () => {
  /** "Yeniden saldır (dosyaya gider)": the raided world, focused, with its dossier open. */
  it('sends Attack again to the raided world’s open dossier', () => {
    const door = source.slice(source.indexOf('<BattleReportDoor'), source.indexOf("{panel === 'intel' && ("));
    expect(door).toMatch(/onAttackAgain=\{\(planetId\) => \{\s*onPanel\(null\);\s*focusPlanet\(planetId\);\s*setDetail\(true\);/);
    expect(door).toMatch(/colonyOf=\{\(planetId\) => planets\.find\(\(world\) => world\.id === planetId\)\?\.kind === 'COLONY'\}/);
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
