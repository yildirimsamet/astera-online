import { useSyncExternalStore } from 'react';
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { ECONOMY_PROFILE } from '@astera/rules';

const EVENT = 'astera:update-required';
let required = false;
let shell: string | undefined;

/**
 * The phone's shell build (Android versionCode), read once at start. An OTA web bundle runs on
 * many shells, so the number cannot be baked into it (OTA F1). A bridge that fails or stalls
 * leaves the shell unnamed rather than holding the game.
 */
export async function readShellBuild(info: () => Promise<{ build: string }> = () => App.getInfo()): Promise<void> {
  shell = undefined;
  if (!Capacitor.isNativePlatform()) return;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const { build } = await Promise.race([info(), new Promise<never>((_resolve, reject) => {
      timer = setTimeout(() => { reject(new Error('App info timed out')); }, 2000);
    })]);
    if (/^[1-9]\d{0,9}$/.test(build)) shell = build;
  } catch { /* stays unnamed */ } finally { clearTimeout(timer); }
}

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
