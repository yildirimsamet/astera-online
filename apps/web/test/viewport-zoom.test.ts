import { globSync, readFileSync } from 'node:fs';
import { afterEach, describe, expect, it } from 'vitest';
import { runInNewContext } from 'node:vm';
import { lockViewportZoom } from '../src/lib/viewport.js';

it('keeps the game loading viewport locked when Suspense retains a hidden public tree', () => {
  const publicPage = document.createElement('main');
  publicPage.dataset.publicLanding = '';
  publicPage.style.display = 'none';
  const loading = document.createElement('div');
  loading.dataset.loadingScreen = '';
  document.body.append(publicPage, loading);
  const stop = lockViewportZoom();
  try {
    const pinch = new WheelEvent('wheel', { ctrlKey: true, cancelable: true });
    window.dispatchEvent(pinch);
    expect(pinch.defaultPrevented).toBe(true);
  } finally { stop(); publicPage.remove(); loading.remove(); }
});

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

  it('allows magnification while reading the public landing and restores the game guard afterwards', () => {
    const page = document.createElement('main'); page.dataset.publicLanding = ''; document.body.append(page);
    lock();
    try {
      const pinch = new WheelEvent('wheel', { ctrlKey: true, cancelable: true }); window.dispatchEvent(pinch);
      const gesture = new Event('gesturestart', { cancelable: true }); document.dispatchEvent(gesture);
      expect(pinch.defaultPrevented).toBe(false); expect(gesture.defaultPrevented).toBe(false);
      page.remove();
      const gamePinch = new WheelEvent('wheel', { ctrlKey: true, cancelable: true }); window.dispatchEvent(gamePinch);
      expect(gamePinch.defaultPrevented).toBe(true);
    } finally { page.remove(); }
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
   * THE CASCADE, NOT THE INTENTION, DECIDES WHETHER SAFARI ZOOMS.
   *
   * `.field` owns a 16px floor for iOS, but Tailwind's utilities are emitted
   * after the components layer. Putting `text-body` beside `field` therefore
   * turns the control into 14px in production even though the field rule still
   * says 16px. The same mistake at `text-caption` makes a select 12px.
   *
   * Scan every TSX class literal rather than naming the two controls that first
   * exposed this. A future composer or search box must not reopen the same route.
   */
  it('never lets an undersized typography utility override the 16px field floor', () => {
    const chrome = readFileSync('src/styles/chrome.css', 'utf8');
    const field = /\.field\s*\{([^}]*)\}/s.exec(chrome)?.[1] ?? '';
    const conflicts: string[] = [];
    const undersizedNames = new Set([
      'text-sm',
      'text-xs',
      'text-body',
      'text-caption',
      'text-label',
      'text-micro',
    ]);

    for (const file of globSync('src/**/*.tsx')) {
      const source = readFileSync(file, 'utf8');
      const classLiterals = source.matchAll(/className=(?:"([^"]*)"|'([^']*)'|\{`([^`]*)`\})/g);
      for (const match of classLiterals) {
        const literal = match[1] ?? match[2] ?? match[3] ?? '';
        const classes = literal.split(/\s+/);
        if (!classes.includes('field')) continue;
        const undersized = classes.filter((name) => {
          if (undersizedNames.has(name)) return true;
          const pixels = /^text-\[(\d+(?:\.\d+)?)px\]$/.exec(name)?.[1];
          return pixels !== undefined && Number(pixels) < 16;
        });
        if (undersized.length > 0) conflicts.push(`${file}: ${undersized.join(', ')}`);
      }
    }

    expect(field).toMatch(/font-size:\s*16px/);
    expect(conflicts).toEqual([]);
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


describe('loading viewport before and after the app bundle arrives', () => {
  let release: (() => void) | undefined;
  afterEach(() => {
    release?.();
    document.dispatchEvent(new Event('astera:viewport-ready'));
    document.querySelector('[data-loading-screen]')?.remove();
  });
  function cover() {
    const node = document.createElement('main');
    node.setAttribute('data-loading-screen', '');
    document.body.append(node);
    return node;
  }
  function boot() {
    const html = readFileSync('index.html', 'utf8');
    const script = /<script[^>]*data-viewport-boot[^>]*>([\s\S]*?)<\/script>/.exec(html)?.[1];
    expect(script, 'the first HTML must guard zoom before deferred modules load').toBeTruthy();
    if (!script) throw new Error('Missing boot viewport guard');
    runInNewContext(script, { window, document });
  }
  it('blocks the first-frame pinch before any app JavaScript has loaded', () => {
    cover(); boot();
    const wheel = new WheelEvent('wheel', { ctrlKey: true, cancelable: true });
    window.dispatchEvent(wheel);
    expect(wheel.defaultPrevented).toBe(true);
    const gesture = new Event('gesturestart', { cancelable: true });
    document.dispatchEvent(gesture);
    expect(gesture.defaultPrevented).toBe(true);
    const scroll = new WheelEvent('wheel', { cancelable: true });
    window.dispatchEvent(scroll);
    expect(scroll.defaultPrevented).toBe(false);
  });
  it('releases the temporary guard after the permanent viewport lock is installed', () => {
    cover(); boot();
    release = lockViewportZoom();
    release(); release = undefined;
    const wheel = new WheelEvent('wheel', { ctrlKey: true, cancelable: true });
    window.dispatchEvent(wheel);
    expect(wheel.defaultPrevented).toBe(false);
  });
  it('protects the static opening frame and React cover with the same critical touch rule', () => {
    const css = readFileSync('src/brand/opening.css', 'utf8');
    expect(/\.brand-loading\s*\{([^}]*)\}/s.exec(css)?.[1]).toMatch(/touch-action:\s*none/);
  });
  it.each(['+', '=', '-'])('refuses keyboard zoom %s only while loading is covered', key => {
    const node = cover();
    release = lockViewportZoom();
    const zoom = new KeyboardEvent('keydown', { key, ctrlKey: true, cancelable: true });
    window.dispatchEvent(zoom);
    expect(zoom.defaultPrevented).toBe(true);
    node.remove();
    const readyZoom = new KeyboardEvent('keydown', { key, ctrlKey: true, cancelable: true });
    window.dispatchEvent(readyZoom);
    expect(readyZoom.defaultPrevented).toBe(false);
  });
  it('keeps zoom reset and browser shortcuts available while loading', () => {
    cover(); boot(); release = lockViewportZoom();
    for (const key of ['0', 'r', 'l']) {
      const event = new KeyboardEvent('keydown', { key, ctrlKey: true, cancelable: true });
      window.dispatchEvent(event);
      expect(event.defaultPrevented).toBe(false);
    }
  });
});
