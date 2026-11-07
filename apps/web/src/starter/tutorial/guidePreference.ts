import { useSyncExternalStore } from 'react';

const changed = 'astera-starter-guide';
const memory = new Set<string>();
const keyOf = (id: string): string => `astera.starter.tutorial.skipped.${id}`;
const subscribe = (notify: () => void): (() => void) => {
  window.addEventListener(changed, notify);
  window.addEventListener('storage', notify);
  return () => { window.removeEventListener(changed, notify); window.removeEventListener('storage', notify); };
};

/** Account-scoped, alongside reading acknowledgements; storage refusal still respects this visit. */
export function useGuidePreference(accountId?: string) {
  const skipped = useSyncExternalStore(subscribe, () => {
    if (!accountId) return false;
    try { return memory.has(accountId) || localStorage.getItem(keyOf(accountId)) === 'true'; } catch { return memory.has(accountId); }
  });
  const skip = (): void => {
    if (!accountId) return;
    try { localStorage.setItem(keyOf(accountId), 'true'); } catch { memory.add(accountId); }
    window.dispatchEvent(new Event(changed));
  };
  return { skipped, skip };
}
