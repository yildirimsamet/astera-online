import { useSyncExternalStore } from 'react';

/**
 * A LAUNCH IS BEING PLANNED (owner play-through 2026-11-18). The launch sheet opens inside the galaxy
 * and the guide lives above it: planning an attack from a probe report is having read the report.
 */
let open = false;
const listeners = new Set<() => void>();

const watch = (notify: () => void): (() => void) => {
  listeners.add(notify);
  return () => { listeners.delete(notify); };
};

export function setLaunchSheet(next: boolean): void {
  if (open === next) return;
  open = next;
  listeners.forEach((notify) => { notify(); });
}

export const useLaunchSheet = (): boolean => useSyncExternalStore(watch, () => open);
