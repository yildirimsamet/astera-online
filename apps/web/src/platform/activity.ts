import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { z } from 'zod';
import { runtime } from './runtime.js';

const appState = z.object({ isActive: z.boolean() });
const listeners = new Set<() => void>();
let mode: 'idle' | 'pending' | 'ready' | 'fallback' = 'idle';
let nativeActive = false;
let lastActive = false;
let stopNative: (() => void) | undefined;

const nativeAvailable = () => (runtime() === 'android' || runtime() === 'ios') && Capacitor.isPluginAvailable('App');

/** A known inactive app differs from a native state that has not arrived yet. */
export function isAppActivityKnown(): boolean {
  return mode !== 'pending' && (mode !== 'idle' || !nativeAvailable());
}

/** No account data: OS activity and document visibility must both permit foreground work. */
export function isAppActive(): boolean {
  if (typeof document === 'undefined') return true;
  if (document.visibilityState !== 'visible' || document.hidden) return false;
  if (mode === 'pending' || mode === 'idle' && nativeAvailable()) return false;
  return mode !== 'ready' || nativeActive;
}

function publish(force = false): void {
  const active = isAppActive();
  if (!force && active === lastActive) return;
  lastActive = active;
  for (const listener of [...listeners]) listener();
}

// Preserve browser event semantics; native + DOM duplicates share one transition.
const onVisibility = () => { publish(mode === 'fallback'); };

function startNative(): () => void {
  mode = 'pending';
  let live = true;
  let revision = 0;
  let initialExpired = false;
  const fallback = (): void => {
    if (!live) return;
    clearTimeout(timer);
    initialExpired = true;
    if (mode !== 'ready') {
      mode = 'fallback';
      publish(true);
    }
  };
  // An optional lifecycle bridge must not hold focus/audio forever when it hangs.
  const timer = setTimeout(fallback, 3000);
  const accept = (value: unknown): boolean => {
    const parsed = appState.safeParse(value);
    if (!live || !parsed.success) return false;
    const initial = mode === 'pending';
    clearTimeout(timer);
    nativeActive = parsed.data.isActive;
    mode = 'ready';
    publish(initial);
    return true;
  };
  const registration = App.addListener('appStateChange', value => {
    if (accept(value)) revision++;
  });
  const initialReadAllowed = () => live && !initialExpired;
  void registration.then(async () => {
    if (!initialReadAllowed() || revision > 0) return;
    const version = revision;
    const state = await App.getState();
    if (initialReadAllowed() && version === revision && !accept(state)) fallback();
  }).catch(fallback);
  return () => {
    live = false;
    clearTimeout(timer);
    mode = 'idle';
    nativeActive = false;
    void registration.then(handle => handle.remove()).catch(() => { /* The bridge may already be gone. */ });
  };
}

/** One shared subscription. Teardown never removes another plugin consumer's listeners. */
export function watchAppActivity(listener: () => void): () => void {
  const first = listeners.size === 0;
  const ownListener = () => { listener(); };
  if (first) lastActive = isAppActive();
  listeners.add(ownListener);
  if (first) {
    document.addEventListener('visibilitychange', onVisibility);
    if (nativeAvailable()) stopNative = startNative();
    else mode = 'fallback';
  }
  return () => {
    listeners.delete(ownListener);
    if (listeners.size > 0) return;
    document.removeEventListener('visibilitychange', onVisibility);
    stopNative?.();
    stopNative = undefined;
    mode = 'idle';
  };
}
