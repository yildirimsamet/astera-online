import { useSyncExternalStore } from 'react';

/**
 * A ROCK'S SHEET IS OPEN (owner playtest 2026-11-08). The galaxy knows what is focused and the guide
 * lives above it, and the guide's next line is about that sheet: find a rock, then send a Prospector.
 */
let open = false;
const listeners = new Set<() => void>();

const watch = (notify: () => void): (() => void) => {
  listeners.add(notify);
  return () => { listeners.delete(notify); };
};

export function setRockSheet(next: boolean): void {
  if (open === next) return;
  open = next;
  listeners.forEach((notify) => { notify(); });
}

export const useRockSheet = (): boolean => useSyncExternalStore(watch, () => open);
