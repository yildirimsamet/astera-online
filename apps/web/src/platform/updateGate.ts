import { useSyncExternalStore } from 'react';
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { ECONOMY_PROFILE } from '@astera/rules';

const EVENT = 'astera:update-required';
let required = false;
let shell: string | undefined;
let reading = 0;

/**
 * The phone's shell build (Android versionCode), read once at start. An OTA web bundle runs on
 * many shells, so the number cannot be baked into it (OTA F1). A bridge that fails leaves the
 * shell unnamed; one that stalls does not hold the game, and names the shell when it answers, so
 * the server's build gate applies from then on.
 */
export async function readShellBuild(info: () => Promise<{ build: string }> = () => App.getInfo()): Promise<void> {
  shell = undefined;
  const read = ++reading;
  if (!Capacitor.isNativePlatform()) return;
  const named = info().then(({ build }) => {
    if (read === reading && /^[1-9]\d{0,9}$/.test(build)) shell = build;
  }, () => undefined);
  let timer: ReturnType<typeof setTimeout> | undefined;
  await Promise.race([named, new Promise<void>(resolve => { timer = setTimeout(resolve, 2000); })]);
  clearTimeout(timer);
}

/** The shell build read at start, or undefined on the web and where the bridge did not answer. */
export const shellBuild = (): string | undefined => shell;

/** Every client declares its compiled rules and web commit; the app also names its shell. */
export function buildHeader(): Record<string, string> {
  const web = import.meta.env.VITE_ASTERA_RELEASE;
  return { 'x-astera-rules': ECONOMY_PROFILE.id, ...(web ? { 'x-astera-web': web } : {}), ...(shell ? { 'x-astera-build': shell } : {}) };
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
