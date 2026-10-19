import { useSyncExternalStore } from 'react';

const EVENT = 'astera:update-required';
let required = false;

/** A bundled app names its build (Android versionCode) so the API can ask it to update. */
export function buildHeader(): Record<string, string> {
  const build = import.meta.env.VITE_ASTERA_NATIVE_BUILD;
  return build ? { 'x-astera-build': build } : {};
}

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
