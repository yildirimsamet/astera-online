import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it } from 'vitest';
import { lockViewportZoom } from '../src/lib/viewport.js';

/**
 * THE PAGE DOES NOT ZOOM; THE GALAXY DOES.
 *
 * Four mechanisms are needed because no single one holds on every browser, and the
 * failure mode of any of them is silent — a pinch that scales the whole document
 * slides the fixed header off the top of the screen and leaves the in-flight strip
 * below the bottom edge, on the one screen the game is played on.
 *
 * The last case is the one worth guarding hardest: the canvas must KEEP its own
 * gestures. A fix that stopped the disc from being pinched would have replaced a
 * cosmetic bug with the loss of a game control.
 */
describe('page zoom is refused and the disc keeps its gestures', () => {
  const teardowns: (() => void)[] = [];
  const lock = (): void => { teardowns.push(lockViewportZoom()); };
  afterEach(() => {
    while (teardowns.length) teardowns.pop()?.();
  });

  /** Safari's own pinch events, the last route left on an installed home-screen app. */
  it.each(['gesturestart', 'gesturechange', 'gestureend'])('refuses %s', (type) => {
    lock();
    const event = new Event(type, { cancelable: true, bubbles: true });
    document.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
  });

  it('refuses a trackpad pinch, which every browser reports as ctrl+wheel', () => {
    lock();
    const pinch = new WheelEvent('wheel', { ctrlKey: true, deltaY: -8, cancelable: true });
    window.dispatchEvent(pinch);
    expect(pinch.defaultPrevented).toBe(true);
  });

  /**
   * The half that would be easy to get wrong. An ordinary wheel still has to
   * scroll a sheet and still has to dolly the disc; only the ctrl-flagged one is
   * a zoom.
   */
  it('leaves an ordinary wheel alone', () => {
    lock();
    const scroll = new WheelEvent('wheel', { deltaY: 120, cancelable: true });
    window.dispatchEvent(scroll);
    expect(scroll.defaultPrevented).toBe(false);
  });

  it('releases every listener when torn down', () => {
    const release = lockViewportZoom();
    release();
    const gesture = new Event('gesturestart', { cancelable: true, bubbles: true });
    document.dispatchEvent(gesture);
    const pinch = new WheelEvent('wheel', { ctrlKey: true, cancelable: true });
    window.dispatchEvent(pinch);
    expect(gesture.defaultPrevented).toBe(false);
    expect(pinch.defaultPrevented).toBe(false);
  });

  /**
   * THE GESTURE IS REFUSED; THE CAPABILITY IS NOT.
   *
   * Locking the scale in the meta would have been the shortest route and it is the
   * wrong one: it removes magnification altogether on the browsers that honour it,
   * and `interface-accessibility.test.tsx` already forbade those flags under
   * `mobile access` before the pinch was ever a problem. Everything above targets
   * the accidental two-finger gesture instead, so Safari's Aa menu, keyboard zoom
   * and OS-level magnification are all untouched.
   *
   * The assertion reads the RAW FILE, so a comment that spelled the flags out
   * would fail it too. That is the right bluntness for a rule this easy to undo by
   * pasting a snippet from the internet.
   */
  it('refuses the gesture without disabling magnification in the meta', () => {
    const html = readFileSync('index.html', 'utf8');
    expect(html).not.toContain('user-scalable=no');
    expect(html).not.toContain('maximum-scale=1');
    // The notch inset is load-bearing for the header's safe-area padding.
    expect(html).toContain('viewport-fit=cover');
  });

  it('states it again as touch-action, which is the half iOS Safari obeys', () => {
    const css = readFileSync('src/styles.css', 'utf8');
    const html = /\bhtml\s*\{([^}]*)\}/s.exec(css)?.[1] ?? '';
    // `pan-x pan-y` and not `none`: the page must still scroll.
    expect(html).toMatch(/touch-action:\s*pan-x pan-y/);
  });

  /**
   * THE CONTROL THIS MUST NOT COST. `OrbitControls` only receives a pinch if the
   * canvas asks the browser for every gesture, and `none` is more restrictive than
   * the root's `pan-x pan-y`, so the intersection still resolves to `none`.
   */
  it('leaves the disc asking for every gesture it is given', () => {
    const canvas = readFileSync('src/galaxy/GalaxyCanvas.tsx', 'utf8');
    expect(canvas).toContain("touchAction: 'none'");
  });
});
