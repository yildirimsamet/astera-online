import { useSyncExternalStore } from 'react';

/**
 * HOW MANY PIXELS THIS DEVICE SPENDS ON THE GALAXY. Owner instruction, raised by
 * players reporting that the phone gets hot.
 *
 * WHAT IS ACTUALLY EXPENSIVE HERE, because the obvious answer is the wrong one.
 * `docs/visual-quality.md`'s D90 baseline is 35 draw calls and 29,576 triangles —
 * nothing, for any phone the game supports. The cost is PER PIXEL, and it is paid
 * several times over: `GalaxyCanvas` renders the scene into a multisampled
 * half-float target, `Bloom` runs a luminance pass and a mipmap chain over it, and
 * a final pass composites the result. Every one of those is a full-screen buffer,
 * and every one of them scales with the SQUARE of the device pixel ratio.
 *
 * So this file has exactly one real dial: the ceiling on that ratio. At 1.5 the
 * whole chain costs 44% less than at 2, and on a 400+ppi phone the difference is
 * hard to find without the two side by side.
 *
 * WHAT IS DELIBERATELY NOT A DIAL:
 *
 *   · BLOOM. Everything bright in this scene is drawn additively, on the
 *     assumption that bloom does the last step (`GalaxyCanvas`, near the
 *     composer). Without it, plumes and stars become flat white shapes with hard
 *     edges. It is also a blur over exactly the bright, high-contrast pixels that
 *     alias when the resolution drops — so it is what makes a lower ratio look
 *     acceptable. Turning it off to save power would spend the saving twice.
 *   · DRAW DISTANCE. It would remove the part that is already free, and hiding
 *     distant worlds hides the information the intel game is played with (D124).
 *
 * PER DEVICE, NOT PER COMMANDER, and it survives a reload — the same scope and the
 * same reasoning as the music switch in `lib/music.ts`, whose store shape this
 * follows. A player who turned the resolution down did it because of the phone in
 * their hand, and that fact does not travel with their account.
 */

export type RenderQuality = 'high' | 'balanced' | 'low';

/** The order they are offered in: most expensive first. */
export const RENDER_QUALITIES = ['high', 'balanced', 'low'] as const;

export interface QualityPreset {
  /**
   * The upper end of the `dpr` clamp handed to the Canvas.
   *
   * A CEILING, NOT A SETTING. It is passed as `[1, cap]`, so a device whose own
   * ratio is already below it is never asked to render ABOVE its screen — which
   * would be pure supersampling, and would make a low preset cost more than a
   * high one on a desktop.
   */
  readonly dprCap: number;
  /**
   * Samples in the composer's own render target.
   *
   * RAISED TO FOUR, NOT LOWERED, and it is the answer to the owner's report that
   * a rock's tail and the hairline on a world's limb came apart into steps once
   * the ratio dropped. Both of those are GEOMETRY — a ribbon of tapering quads and
   * a `ringGeometry` under two per cent of a world across — so both are thin
   * shapes whose coverage of a pixel falls below one. That is precisely and only
   * what multisampling fixes: four coverage samples draw a quarter-covered pixel
   * at a quarter strength instead of dropping it, which turns a dashed line back
   * into a continuous fainter one.
   *
   * IT IS THE CHEAP FIX RATHER THAN THE OBVIOUS ONE. Raising the ratio to 1.75
   * would cost 36% across the WHOLE chain — the scene, the luminance pass, the
   * mipmap chain and the composite — to half-fix it. Multisampling is paid only
   * at edges, and mobile tile-based GPUs resolve it inside tile memory. A
   * post-process pass (SMAA, FXAA) would cost two more full-screen passes and
   * soften the picture everywhere to fix the edges.
   */
  readonly multisampling: number;
}

export const QUALITY_PRESETS: Record<RenderQuality, QualityPreset> = {
  high: { dprCap: 2, multisampling: 4 },
  balanced: { dprCap: 1.5, multisampling: 4 },
  /**
   * The bottom rung still buys two samples. At a ratio of 1 EVERY thin feature is
   * sub-pixel, so this is the rung that needs coverage sampling most — dropping it
   * to save the resolve would be spending the picture on the one preset with the
   * least of it left.
   */
  low: { dprCap: 1, multisampling: 2 },
};

/**
 * THE DEFAULT IS THE MIDDLE ONE, and that is a change of default.
 *
 * Every device rendered at the top of the ladder until now, which is the state the
 * heat complaints came from. The middle rung is the one that costs 44% less and is
 * hard to see; a player who wants the last of the sharpness is one tap from it,
 * and that tap is a cheaper thing to ask for than a hot phone.
 */
const DEFAULT_QUALITY: RenderQuality = 'balanced';

const KEY = 'astera.quality';

const store = (): Storage | null => {
  try {
    // Safari in private browsing throws on ACCESS rather than on write, so even
    // the read is guarded. See `lib/music.ts`, which learned this first.
    return globalThis.localStorage;
  } catch {
    return null;
  }
};

const isRenderQuality = (value: string | null | undefined): value is RenderQuality =>
  value === 'high' || value === 'balanced' || value === 'low';

let current: RenderQuality = ((): RenderQuality => {
  try {
    const raw = store()?.getItem(KEY);
    return isRenderQuality(raw) ? raw : DEFAULT_QUALITY;
  } catch {
    return DEFAULT_QUALITY;
  }
})();

const listeners = new Set<() => void>();

export const renderQuality = (): RenderQuality => current;

export const renderPreset = (): QualityPreset => QUALITY_PRESETS[current];

export function setRenderQuality(next: RenderQuality): void {
  if (next === current) return;
  current = next;
  try {
    store()?.setItem(KEY, next);
  } catch {
    // A read-only store still leaves the control working for this session.
  }
  for (const notify of listeners) notify();
}

const subscribe = (notify: () => void): (() => void) => {
  listeners.add(notify);
  return () => listeners.delete(notify);
};

/** Subscribe a component to the preset. Safe to call from anywhere in the tree. */
export const useRenderQuality = (): RenderQuality =>
  useSyncExternalStore(subscribe, renderQuality, () => DEFAULT_QUALITY);
