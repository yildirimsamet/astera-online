import { useSyncExternalStore } from 'react';

/**
 * A WORLD OR A ROCK IS OPEN IN THE GALAXY'S FOCUS CARD (owner phone playtest 2026-11-19): the player is
 * acting on it. What comes up meanwhile waits: the guide keeps the step in hand, and no scene takes the
 * camera from it.
 */
let open = false;
const listeners = new Set<() => void>();

const watch = (notify: () => void): (() => void) => {
  listeners.add(notify);
  return () => { listeners.delete(notify); };
};

export function setTargetSheet(next: boolean): void {
  if (open === next) return;
  open = next;
  listeners.forEach((notify) => { notify(); });
}

export const useTargetSheet = (): boolean => useSyncExternalStore(watch, () => open);
