import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  H5_BRIDGE_SRC,
  configureH5Ads,
  h5BridgeHeadTag,
  h5BridgeReady,
  resetH5AdsForTests,
  syncH5Sound,
} from '../src/lib/h5.js';
import { adsenseHeadTags } from '../src/lib/adsense.js';
import { musicEnabled, setMusicEnabled } from '../src/lib/music.js';

const webRoot = resolve(import.meta.dirname, '..');

/**
 * THE H5 GAMES ADS BRIDGE.
 *
 * Google's H5 Ad Placement API is not a separate library: it rides inside the
 * AdSense loader, and a game reaches it through two globals it defines itself —
 * `adBreak` and `adConfig`, both of which simply push onto `window.adsbygoogle`.
 * `public/h5-ads.js` is that snippet, verbatim as Google publishes it, as a
 * first-party file rather than an inline block because the production CSP grants
 * `script-src 'self'` and never `'unsafe-inline'`.
 *
 * WHAT IS HERE AND WHAT IS NOT. The bridge and `adConfig()` are the integration
 * Google's placement documentation asks for and the thing a reviewer loads the
 * page to see. PLACEMENTS ARE NOT HERE: no `adBreak()` call ships until the
 * rewarded reward itself is decided, and a placement written against an
 * undecided reward would be exactly the silent placeholder this project bans.
 */
beforeEach(() => {
  resetH5AdsForTests();
  delete (window as { adsbygoogle?: unknown }).adsbygoogle;
  delete (window as { adConfig?: unknown }).adConfig;
  delete (window as { adBreak?: unknown }).adBreak;
});

afterEach(() => {
  resetH5AdsForTests();
});

describe('the snippet Google publishes', () => {
  it('defines both globals over one shared queue', async () => {
    const script = await readFile(resolve(webRoot, 'public/h5-ads.js'), 'utf8');
    const browser: Record<string, unknown> = {};

    runInNewContext(script, { window: browser });

    expect(Array.isArray(browser.adsbygoogle)).toBe(true);
    expect(typeof browser.adBreak).toBe('function');
    expect(typeof browser.adConfig).toBe('function');

    (browser.adConfig as (o: unknown) => void)({ sound: 'on' });
    (browser.adBreak as (o: unknown) => void)({ type: 'reward' });
    expect(browser.adsbygoogle).toEqual([{ sound: 'on' }, { type: 'reward' }]);
  });

  /**
   * IT MUST NOT DESTROY A QUEUE THE LOADER ALREADY MADE. The AdSense loader is
   * `async`, so on a fast connection it can run first and leave commands on
   * `adsbygoogle`; replacing the array would throw them away.
   */
  it('adopts an existing queue rather than replacing it', async () => {
    const script = await readFile(resolve(webRoot, 'public/h5-ads.js'), 'utf8');
    const existing = [{ already: 'queued' }];
    const browser: Record<string, unknown> = { adsbygoogle: existing };

    runInNewContext(script, { window: browser });

    expect(browser.adsbygoogle).toBe(existing);
    expect(browser.adsbygoogle).toEqual([{ already: 'queued' }]);
  });
});

describe('the head tags of a built page', () => {
  it('loads the bridge after the loader it extends', () => {
    const tags = adsenseHeadTags();
    const srcs = tags.map((tag) => tag.attrs?.src);

    expect(srcs).toEqual([
      '/consent-bootstrap.js',
      expect.stringContaining('adsbygoogle.js?client='),
      H5_BRIDGE_SRC,
    ]);
    expect(h5BridgeHeadTag().injectTo).toBe('head');
  });

  /** Classic script, no `async`: the globals must exist before the app runs. */
  it('is synchronous so the game can call adConfig immediately', () => {
    const tag = h5BridgeHeadTag();

    expect(tag.attrs?.async).toBeUndefined();
    expect(tag.attrs?.defer).toBeUndefined();
  });
});

describe('configuring the API', () => {
  it('does nothing at all when no bridge was loaded', () => {
    expect(h5BridgeReady()).toBe(false);
    expect(() => {
      configureH5Ads();
    }).not.toThrow();
  });

  it('declares the sound state and leaves preloading to Google', () => {
    const adConfig = vi.fn();
    (window as { adConfig?: unknown }).adConfig = adConfig;
    setMusicEnabled(true);

    configureH5Ads();

    expect(h5BridgeReady()).toBe(true);
    expect(adConfig).toHaveBeenCalledWith({ preloadAdBreaks: 'auto', sound: 'on' });
  });

  it('reports muted sound so Google does not send a video ad into silence', () => {
    const adConfig = vi.fn();
    (window as { adConfig?: unknown }).adConfig = adConfig;
    setMusicEnabled(false);

    configureH5Ads();

    expect(adConfig).toHaveBeenCalledWith({ preloadAdBreaks: 'auto', sound: 'off' });
  });

  /**
   * `preloadAdBreaks` may be set once and never again, and the game has no
   * placement yet — so a second configure must not re-declare it. React 19
   * StrictMode mounts twice in development, which is enough to hit this.
   */
  it('declares the configuration once however often it is called', () => {
    const adConfig = vi.fn();
    (window as { adConfig?: unknown }).adConfig = adConfig;

    configureH5Ads();
    configureH5Ads();
    configureH5Ads();

    expect(adConfig).toHaveBeenCalledOnce();
  });

  /**
   * A throw out of Google's loader must not take the galaxy with it. This is
   * measurement-adjacent code on the critical path of a 3D scene.
   */
  it('survives a bridge that throws', () => {
    (window as { adConfig?: unknown }).adConfig = () => {
      throw new Error('ad blocker');
    };

    expect(() => {
      configureH5Ads();
    }).not.toThrow();
  });
});

describe('keeping the sound state honest', () => {
  it('tells Google when the player mutes the game', () => {
    const adConfig = vi.fn();
    (window as { adConfig?: unknown }).adConfig = adConfig;
    setMusicEnabled(true);
    configureH5Ads();
    adConfig.mockClear();

    setMusicEnabled(false);
    syncH5Sound();

    expect(adConfig).toHaveBeenCalledWith({ sound: 'off' });
  });

  /** No `preloadAdBreaks` on an update: it is a once-only field. */
  it('sends only the sound field after the first configuration', () => {
    const adConfig = vi.fn();
    (window as { adConfig?: unknown }).adConfig = adConfig;
    setMusicEnabled(true);
    configureH5Ads();
    adConfig.mockClear();

    setMusicEnabled(false);
    syncH5Sound();

    expect(adConfig).toHaveBeenCalled();
    for (const [config] of adConfig.mock.calls) {
      expect(config).not.toHaveProperty('preloadAdBreaks');
      expect(config).toEqual({ sound: 'off' });
    }
  });

  it('says nothing when the sound has not actually changed', () => {
    const adConfig = vi.fn();
    (window as { adConfig?: unknown }).adConfig = adConfig;
    setMusicEnabled(true);
    configureH5Ads();
    adConfig.mockClear();

    syncH5Sound();
    syncH5Sound();

    expect(adConfig).not.toHaveBeenCalled();
  });

  it('stays quiet before the game has configured anything', () => {
    const adConfig = vi.fn();
    (window as { adConfig?: unknown }).adConfig = adConfig;

    setMusicEnabled(false);
    syncH5Sound();

    expect(adConfig).not.toHaveBeenCalled();
  });
});

/**
 * NO PLACEMENT IS REQUESTED YET, and the test is behavioural so it stays a
 * decision rather than drifting into one.
 *
 * Google's rewarded policy requires a reward with no value outside the game.
 * This game's alloy, crystal, deuterium and ships all move between players
 * through clan aid, so none of them can be one, and the owner has deferred the
 * reward design until the H5 application is accepted. Until then the queue Google
 * drains must hold configuration and nothing else: every `adBreak()` entry
 * carries a `type`, and a config entry never does.
 */
describe('placements', () => {
  it('queues configuration and never an ad break', async () => {
    const bridge = await readFile(resolve(webRoot, 'public/h5-ads.js'), 'utf8');
    // The real snippet, over the real window, so this exercises what ships.
    runInNewContext(bridge, { window });

    configureH5Ads();
    setMusicEnabled(!musicEnabled());
    syncH5Sound();

    const queue = (window as { adsbygoogle?: Record<string, unknown>[] }).adsbygoogle ?? [];
    expect(queue.length).toBeGreaterThan(0);
    for (const entry of queue) {
      expect(entry).not.toHaveProperty('type');
      expect(entry).not.toHaveProperty('adViewed');
      expect(entry).not.toHaveProperty('beforeReward');
    }
  });
});
