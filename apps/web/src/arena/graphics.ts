/**
 * THE ARENA'S GRAPHICS CHOICE (owner 2026-10-22: the resolution kept changing under the
 * player). Like the galaxy's (`lib/quality.ts`): Yüksek, Dengeli, Düşük — each a fixed
 * sharpness that never moves — plus Otomatik, the frame-rate governor (`resolution.ts`),
 * which starts sharp and steps down on a phone that cannot keep up. Dengeli by default.
 *
 * Per device, not per commander, and it survives a reload: the phone in the hand is why
 * a player picks it. Its own key, because the arena's frame is not the galaxy's.
 */
export type ArenaGraphicsChoice = 'high' | 'balanced' | 'low' | 'auto';

export const ARENA_GRAPHICS = ['high', 'balanced', 'low', 'auto'] as const;

export interface ArenaGraphics {
  /** Pixel ratio the frame renders at (never above the screen's own). */
  ratio: number;
  /** Multisampling in the composer's target. */
  samples: number;
  /** Otomatik: the governor may step the ratio down. */
  adaptive: boolean;
  /** Düşük: the lighter engine flames too. */
  light: boolean;
}

const KEY = 'astera.arenaGraphics';
const DEFAULT: ArenaGraphicsChoice = 'balanced';
const CAP: Record<ArenaGraphicsChoice, number> = { high: 2, balanced: 1.5, low: 1, auto: 2 };

export function graphicsFor(choice: ArenaGraphicsChoice, deviceRatio: number): ArenaGraphics {
  return {
    ratio: Math.min(deviceRatio > 0 ? deviceRatio : 1, CAP[choice]),
    samples: choice === 'low' ? 2 : 4,
    adaptive: choice === 'auto',
    light: choice === 'low',
  };
}

const known = (value: string | null | undefined): value is ArenaGraphicsChoice =>
  (ARENA_GRAPHICS as readonly string[]).includes(value ?? '');

let current: ArenaGraphicsChoice = ((): ArenaGraphicsChoice => {
  try {
    const raw = globalThis.localStorage.getItem(KEY);
    return known(raw) ? raw : DEFAULT;
  } catch {
    return DEFAULT;
  }
})();
const listeners = new Set<(choice: ArenaGraphicsChoice) => void>();

export const arenaGraphics = (): ArenaGraphicsChoice => current;

export function setArenaGraphics(next: ArenaGraphicsChoice): void {
  if (next === current) return;
  current = next;
  try { globalThis.localStorage.setItem(KEY, next); } catch { /* still applies for this session */ }
  for (const listener of listeners) listener(next);
}

export function onArenaGraphics(listener: (choice: ArenaGraphicsChoice) => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
