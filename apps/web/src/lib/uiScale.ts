import { useSyncExternalStore } from 'react';

/**
 * THE INTERFACE SIZE (owner 2026-11-17). Players asked for a larger or a smaller interface;
 * the hierarchy between sizes must survive it, so every size moves by ONE multiplier.
 *
 * HOW: the layout viewport narrows, exactly as the browser's own page zoom does it — a
 * 350 px phone at 110 % lays the page out at 318 px and shows it 1.1 times larger. Text,
 * icons, rows, `dvh`, fixed chrome and the canvases all follow, because to the page this is
 * simply a narrower phone. CSS `zoom` was measured and rejected (2026-11-17): `100dvh`
 * overflowed by the factor, and a canvas's own width and its drawn width parted.
 *
 * WHY BOTH `width` AND `initial-scale`: `width=device-width` beside a scale crops the page
 * (a 350 px layout behind a 318 px window), and Android's WebView may open a page that gives a
 * scale without a width at 980 px. Naming both is read the same everywhere; the width is
 * measured again when the phone turns.
 *
 * WHERE: a touch screen (desktop browsers ignore the viewport line; their own Ctrl + already
 * does this), and the Android app once its shell opens the WebView's wide viewport and reports
 * the phone's font size (`AsteraDisplayPlugin`). A browser that does not follow is caught a
 * moment later and put back, and the setting withdrawn.
 *
 * Remembered per device, like the image quality: a phone and a desktop want different sizes.
 */

export const UI_SCALES = [90, 100, 110, 120, 130] as const;
export type UiScale = (typeof UI_SCALES)[number];

/** The page's own line in `index.html`; 100 % writes it back unchanged. */
const BASE_VIEWPORT = 'width=device-width, initial-scale=1, viewport-fit=cover, interactive-widget=resizes-content';
/** The narrowest layout the screens are checked at (320 px audit, a 350 px phone at 110 %). */
const MIN_LAYOUT_WIDTH = 318;
const KEY = 'astera.uiScale';
/** Long enough for a browser to lay the page out again after the line changes. */
const CHECK_MS = 300;

const isUiScale = (value: number): value is UiScale => (UI_SCALES as readonly number[]).includes(value);

export function viewportFor(scale: UiScale, deviceWidth: number): string {
  if (scale === 100) return BASE_VIEWPORT;
  return `width=${String(Math.round((deviceWidth * 100) / scale))}, initial-scale=${String(scale / 100)}, viewport-fit=cover, interactive-widget=resizes-content`;
}

/** The steps a screen can hold: the layout stays at least 318 px across its narrow side. */
export function scalesFor(narrowSide: number): UiScale[] {
  return UI_SCALES.filter((scale) => scale <= 100 || (narrowSide * 100) / scale >= MIN_LAYOUT_WIDTH);
}

/** The phone's font size (1 = normal) as the nearest allowed step; a tie takes the smaller. */
export function scaleFromFontScale(fontScale: number, allowed: readonly UiScale[]): UiScale {
  if (!Number.isFinite(fontScale) || allowed.length === 0) return 100;
  let best: UiScale = 100;
  for (const scale of allowed) {
    if (Math.abs(scale - fontScale * 100) < Math.abs(best - fontScale * 100) - 1e-9) best = scale;
  }
  return best;
}

const store = (): Storage | null => {
  try {
    // Safari in private browsing throws on ACCESS; see `lib/quality.ts`.
    return globalThis.localStorage;
  } catch {
    return null;
  }
};

const remembered = (): UiScale | null => {
  try {
    const raw = store()?.getItem(KEY);
    const value = raw === null || raw === undefined || raw === '' ? Number.NaN : Number(raw);
    return isUiScale(value) ? value : null;
  } catch {
    return null;
  }
};

export interface UiScaleSetting {
  available: boolean;
  value: UiScale;
  options: readonly UiScale[];
  /** No choice made yet: the value came from the phone's own font size. */
  fromSystem: boolean;
}

export interface UiScaleHost {
  /** The phone's font size, from the app shell. Its presence means the shell can scale. */
  systemFontScale?: () => Promise<number>;
  /** False in an app shell that cannot scale the page (an older Android build). */
  supported?: boolean;
}

let available = false;
let chosen: UiScale | null = null;
let suggested: UiScale | null = null;
let options: readonly UiScale[] = [90, 100];
let applied: UiScale = 100;
let check: ReturnType<typeof setTimeout> | undefined;
const listeners = new Set<() => void>();

const clamp = (value: UiScale): UiScale => [...options].reverse().find((scale) => scale <= value) ?? 100;

const build = (): UiScaleSetting => ({
  available,
  value: available ? clamp(chosen ?? suggested ?? 100) : 100,
  options,
  fromSystem: available && chosen === null && suggested !== null,
});
let snapshot = build();

const notify = (): void => {
  snapshot = build();
  for (const listener of listeners) listener();
};

const metaTag = (): HTMLMetaElement | null => document.querySelector('meta[name="viewport"]');

/** The window's width in device-independent pixels at 100 %, whatever scale is on now. */
const deviceWidth = (): number => {
  const visual = globalThis.visualViewport;
  return Math.round(visual ? visual.width * visual.scale : (window.innerWidth * applied) / 100);
};

const write = (content: string): void => {
  const tag = metaTag();
  if (tag && tag.getAttribute('content') !== content) tag.setAttribute('content', content);
};

function apply(): void {
  const scale = snapshot.value;
  const width = deviceWidth();
  clearTimeout(check);
  write(viewportFor(scale, width));
  applied = scale;
  if (scale === 100) return;
  const expected = Math.round((width * 100) / scale);
  check = setTimeout(() => {
    const visual = globalThis.visualViewport;
    const followed = Math.abs(window.innerWidth - expected) <= 2 && (!visual || Math.abs(visual.scale - scale / 100) < 0.03);
    if (followed) return;
    // The layout did not narrow: the page is cropped or unchanged. Put the line back.
    write(BASE_VIEWPORT);
    applied = 100;
    available = false;
    notify();
  }, CHECK_MS);
}

const onResize = (): void => { if (applied !== 100) apply(); };

export function startUiScale(host: UiScaleHost = {}): () => void {
  // Older engines and test hosts may lack `matchMedia`; they are no touch screen to scale.
  const touch = 'matchMedia' in globalThis && globalThis.matchMedia('(hover: none) and (pointer: coarse)').matches;
  available = host.supported ?? (host.systemFontScale !== undefined || touch);
  options = scalesFor(Math.min(window.screen.width, window.screen.height));
  chosen = remembered();
  suggested = null;
  notify();
  if (!available) return () => undefined;
  apply();
  window.addEventListener('resize', onResize);
  let live = true;
  host.systemFontScale?.().then((fontScale) => {
    if (!live || !available) return;
    suggested = scaleFromFontScale(fontScale, options);
    notify();
    apply();
  }, () => undefined);
  return () => {
    live = false;
    window.removeEventListener('resize', onResize);
    clearTimeout(check);
    write(BASE_VIEWPORT);
    applied = 100;
    available = false;
    notify();
  };
}

export function setUiScale(next: UiScale): void {
  chosen = next;
  try {
    store()?.setItem(KEY, String(next));
  } catch {
    // A read-only store still leaves the control working for this session.
  }
  notify();
  if (available) apply();
}

export const uiScaleSetting = (): UiScaleSetting => snapshot;

const subscribe = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const useUiScaleSetting = (): UiScaleSetting => useSyncExternalStore(subscribe, uiScaleSetting, uiScaleSetting);

/**
 * A canvas's resolution ceiling under the scaled page. One CSS pixel now covers `scale` times
 * the screen it did, so the ceiling moves with it: the 3D picture keeps the same sharpness and
 * the same cost at every size (90 % would otherwise draw 23 % more pixels).
 */
export const scaledDprCap = (cap: number): number => (cap * snapshot.value) / 100;

export const useScaledDprCap = (cap: number): number => (cap * useUiScaleSetting().value) / 100;
