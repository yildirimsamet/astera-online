import { useSyncExternalStore } from 'react';

/**
 * A SMALL FPS READOUT. Owner request, 2026-09-19.
 *
 * It counts the frames the galaxy actually DRAWS in the last second. The disc
 * renders on demand (D53), so a still scene reads 24–30 by design, a moving camera
 * or a battle reads higher — the readout says how hard the phone is working, which
 * is what a player choosing an image quality wants to see.
 *
 * Off by default, and remembered per device like the image quality beside it.
 */

const KEY = 'astera.fps';
const WINDOW_MS = 1000;

const store = (): Storage | null => {
  try {
    // Safari in private browsing throws on ACCESS; see `lib/quality.ts`.
    return globalThis.localStorage;
  } catch {
    return null;
  }
};

let enabled = ((): boolean => {
  try {
    return store()?.getItem(KEY) === 'on';
  } catch {
    return false;
  }
})();

const listeners = new Set<() => void>();

export const fpsMeterEnabled = (): boolean => enabled;

export function setFpsMeterEnabled(next: boolean): void {
  if (next === enabled) return;
  enabled = next;
  try {
    store()?.setItem(KEY, next ? 'on' : 'off');
  } catch {
    // A read-only store still leaves the switch working for this session.
  }
  for (const notify of listeners) notify();
}

const subscribe = (notify: () => void): (() => void) => {
  listeners.add(notify);
  return () => listeners.delete(notify);
};

export const useFpsMeterEnabled = (): boolean =>
  useSyncExternalStore(subscribe, fpsMeterEnabled, () => false);

/** Frames drawn, timestamped, and how many fall inside the last second. */
export interface FpsMeter {
  frame: (atMs: number) => void;
  read: (nowMs: number) => number;
}

export function createFpsMeter(): FpsMeter {
  const stamps: number[] = [];
  const prune = (nowMs: number): void => {
    while (stamps.length > 0 && (stamps[0] ?? 0) <= nowMs - WINDOW_MS) stamps.shift();
  };
  return {
    frame(atMs) {
      stamps.push(atMs);
      prune(atMs);
    },
    read(nowMs) {
      prune(nowMs);
      return stamps.length;
    },
  };
}

/**
 * The galaxy's own meter: the canvas marks every frame it draws while the readout
 * is on, and the readout in the corner reads it. One shared instance, because the
 * two sit on either side of the `<Canvas>` boundary.
 */
export const galaxyFrames: FpsMeter = createFpsMeter();
