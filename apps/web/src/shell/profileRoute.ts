import { useSyncExternalStore } from 'react';

const PROFILE = '/profile';
const notify = (): void => { window.dispatchEvent(new PopStateEvent('popstate')); };
const subscribe = (listener: () => void): (() => void) => {
  window.addEventListener('popstate', listener);
  return () => { window.removeEventListener('popstate', listener); };
};

/** An authenticated page with a stable URL, including direct visits and browser Back. */
export function useProfileRoute(): boolean {
  return useSyncExternalStore(subscribe, () => window.location.pathname === PROFILE);
}

export function openProfile(): void {
  if (window.location.pathname === PROFILE) return;
  window.history.pushState({ asteraProfile: true }, '', `${PROFILE}${window.location.search}`);
  notify();
}

/** Selecting another game page replaces the profile URL without leaving that page. */
export function dismissProfile(): void {
  if (window.location.pathname !== PROFILE) return;
  window.history.replaceState(null, '', `/${window.location.search}`);
  notify();
}

export function leaveProfile(): void {
  const state: unknown = window.history.state;
  if (typeof state === 'object' && state !== null && 'asteraProfile' in state && state.asteraProfile === true) {
    window.history.back();
    return;
  }
  dismissProfile();
}
