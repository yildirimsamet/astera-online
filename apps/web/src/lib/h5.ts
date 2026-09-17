import type { HtmlTagDescriptor } from 'vite';
import { musicEnabled, subscribeMusic } from './music.js';

/**
 * H5 GAMES ADS — THE CONFIGURATION HALF, WHICH IS THE HALF THAT SHIPS.
 *
 * Google's Ad Placement API has two functions. `adConfig()` tells Google what
 * kind of game this is so it can preload and filter creatives; `adBreak()`
 * declares a place where an ad COULD show. This file is the first one only, and
 * that is a deliberate line rather than an unfinished edge:
 *
 *   · `adConfig()` is what Google's own integration guide asks a publisher to
 *     call on start-up, it fetches nothing on its own, and it is the thing that
 *     makes the integration real and inspectable on the deployed page.
 *   · `adBreak()` is a PLACEMENT, and a rewarded placement needs a reward. This
 *     game's alloy, crystal, deuterium and ships all move between players
 *     through clan aid, so under Google's rewarded policy — "rewards must not
 *     have value outside of your app… must not be saleable or exchangeable" —
 *     none of them can be one. The reward design is an owner decision deferred
 *     until the H5 application is accepted, and a placement written against an
 *     undecided reward would be exactly the silent placeholder this project
 *     bans. `test/h5-ads.test.ts` holds that line.
 *
 * THE GLOBALS ARE NOT OURS. `public/h5-ads.js` defines `adBreak` and `adConfig`
 * as Google publishes them, and it only ships in a built page — see
 * `lib/adsense.ts`. Everything here is therefore optional at runtime: on a dev
 * server, in a test browser and behind an ad blocker the bridge is simply
 * absent, and every function below turns into a no-op rather than a crash.
 *
 * SOUND IS NOT A DETAIL. Google selects creatives partly on whether the game can
 * play audio, and its guidance is to call `adConfig()` AS SOON AS the sound
 * state changes so it has the most time to fetch a suitable one. That is why
 * this module subscribes to the music switch instead of reading it once.
 */

/** Where the built page loads Google's snippet from. */
export const H5_BRIDGE_SRC = '/h5-ads.js';

/** The fields `adConfig()` accepts. Google rejects anything else. */
interface AdConfig {
  /** Once only, and ignored after the first `adBreak()`. `auto` leaves it to Google. */
  preloadAdBreaks?: 'on' | 'auto';
  sound?: 'on' | 'off';
  /** Fires when the API has initialised and any preloading has finished. */
  onReady?: () => void;
}

declare global {
  interface Window {
    /**
     * THE LOADER'S OWN QUEUE, and the reason it is declared here rather than
     * left implicit: `public/h5-ads.js` is hand-written browser JavaScript that
     * this workspace typechecks and lints like the rest of the client, and
     * without a declaration every line of it is an unsafe `any`.
     */
    adsbygoogle?: unknown[];
    /** Defined by `public/h5-ads.js`; pushes onto the queue above. */
    adConfig?: (config: AdConfig) => void;
    adBreak?: (placement: Record<string, unknown>) => void;
  }
}

/** The one tag that turns the AdSense loader into an H5 games integration. */
export function h5BridgeHeadTag(): HtmlTagDescriptor {
  return {
    tag: 'script',
    // NOT async and NOT defer. It defines two globals and pushes nothing; the
    // app may call `adConfig()` on its first frame and the globals have to be
    // there by then. It is four lines — there is no parse cost to defer.
    attrs: { src: H5_BRIDGE_SRC },
    injectTo: 'head',
  };
}

/** Whether Google's bridge actually loaded on this page. */
export const h5BridgeReady = (): boolean => typeof window.adConfig === 'function';

/**
 * What was last declared, so an update never re-sends a once-only field and
 * never repeats a value Google already holds.
 */
let configured = false;
let declaredSound: 'on' | 'off' | null = null;

const currentSound = (): 'on' | 'off' => (musicEnabled() ? 'on' : 'off');

/**
 * Hand the config to Google, swallowing anything it throws.
 *
 * This runs on the critical path of a page whose first job is compiling a 3D
 * scene. An ad blocker that stubs `adConfig` with a thrower, or a loader that
 * half-initialised, must cost a missing ad and never a missing galaxy.
 */
function declare(config: AdConfig): void {
  try {
    window.adConfig?.(config);
  } catch {
    // An unreachable ad API is a lost ad, never a lost session.
  }
}

/**
 * Declare the game's configuration, once per page load.
 *
 * `preloadAdBreaks: 'auto'` is Google's own default and it is passed explicitly
 * so the value is stated somewhere a reader can find it: with no placements yet
 * there is nothing to preload FOR, and leaving the decision to Google is the
 * only honest answer until a placement exists.
 */
export function configureH5Ads(): void {
  if (configured || !h5BridgeReady()) return;
  configured = true;
  declaredSound = currentSound();
  declare({ preloadAdBreaks: 'auto', sound: declaredSound });
  subscribeMusic(syncH5Sound);
}

/**
 * Re-declare the sound state after the player has changed it.
 *
 * Only the changed field: `preloadAdBreaks` may be set once and a second value
 * is ignored, so repeating it would be noise in the queue rather than an error.
 */
export function syncH5Sound(): void {
  if (!configured || !h5BridgeReady()) return;
  const sound = currentSound();
  if (sound === declaredSound) return;
  declaredSound = sound;
  declare({ sound });
}

/** Module state is per page load in production; a test suite needs it per test. */
export function resetH5AdsForTests(): void {
  configured = false;
  declaredSound = null;
}
