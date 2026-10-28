import { useSyncExternalStore } from 'react';
import { ECONOMY_PROFILE } from '@astera/rules';

const EVENT = 'astera:update-required';
let required = false;

/** Every client declares its compiled rules; bundled apps also name their versionCode. */
export function buildHeader(): Record<string, string> {
  const build = import.meta.env.VITE_ASTERA_NATIVE_BUILD;
  return { 'x-astera-rules': ECONOMY_PROFILE.id, ...(build ? { 'x-astera-build': build } : {}) };
}

/** Refresh the browser bundle; a query invalidation cannot replace compiled rules. */
export function reloadWebApp(): void { window.location.reload(); }

/** Once the API has refused this build, nothing else on screen can work: stays for the process. */
export function reportUpdateRequired(): void {
  if (required) return;
  required = true;
  window.dispatchEvent(new Event(EVENT));
}

const subscribe = (listener: () => void): (() => void) => {
  window.addEventListener(EVENT, listener);
  return () => { window.removeEventListener(EVENT, listener); };
};

export const useUpdateRequired = (): boolean => useSyncExternalStore(subscribe, () => required, () => false);
