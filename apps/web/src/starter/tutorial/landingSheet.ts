import { useSyncExternalStore } from 'react';

/**
 * WHERE TO LAND IS BEING CHOSEN (owner phone playtest 2026-11-18, item 24). The landing sheet is the
 * player's own decision: the guide and the advisor say nothing over it.
 */
let open = false;
const listeners = new Set<() => void>();

const watch = (notify: () => void): (() => void) => {
  listeners.add(notify);
  return () => { listeners.delete(notify); };
};

export function setLandingSheet(next: boolean): void {
  if (open === next) return;
  open = next;
  listeners.forEach((notify) => { notify(); });
}

export const landingSheetOpen = (): boolean => open;
export const useLandingSheet = (): boolean => useSyncExternalStore(watch, landingSheetOpen);
