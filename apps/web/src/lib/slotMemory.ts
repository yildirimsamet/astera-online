import { z } from 'zod';

export const SLOT_MEMORY_KEY = 'astera.slot.dismissed';

/** Longer than any event runs, so a closed one never comes back; short enough that the list stays small. */
const KEEP_MS = 3 * 24 * 60 * 60_000;

/** Only an event is remembered: an attack is still coming after a reload, a suggestion changes with the world. */
const KEPT = 'event:';

const stored = z.record(z.string(), z.unknown());

function load(now: number): Record<string, number> {
  try {
    const raw = localStorage.getItem(SLOT_MEMORY_KEY);
    if (raw === null) return {};
    const parsed = stored.safeParse(JSON.parse(raw));
    if (!parsed.success) return {};
    const kept: Record<string, number> = {};
    for (const [key, at] of Object.entries(parsed.data)) {
      if (key.startsWith(KEPT) && typeof at === 'number' && now - at < KEEP_MS) kept[key] = at;
    }
    return kept;
  } catch {
    return {};
  }
}

/**
 * THE CARDS THE PLAYER CLOSED, ACROSS A RELOAD. Owner, 2026-09-24: a galaxy event card
 * closed once came back on every return to the game. Per device, in `localStorage`,
 * because it is a viewer's convenience; a private window simply forgets.
 */
export function readDismissed(now: number): Set<string> {
  return new Set(Object.keys(load(now)));
}

export function rememberDismissed(keys: readonly string[], now: number): void {
  const next = load(now);
  for (const key of keys) if (key.startsWith(KEPT)) next[key] = now;
  try {
    localStorage.setItem(SLOT_MEMORY_KEY, JSON.stringify(next));
  } catch {
    // Storage blocked or full: the card is still closed for this visit.
  }
}
