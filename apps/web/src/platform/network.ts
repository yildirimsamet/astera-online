import { Capacitor } from '@capacitor/core';
import { Network } from '@capacitor/network';
import { z } from 'zod';
import { runtime } from './runtime.js';

const statusSchema = z.object({ connected: z.boolean(), connectionType: z.enum(['wifi', 'cellular', 'none', 'unknown']) });
const listeners = new Set<() => void>();
let nativeConnected: boolean | undefined;
let lastOnline = true;
let stopNative: (() => void) | undefined;

/** WebView navigator.onLine can stay true even while every internet transport is off. */
export const isNetworkOnline = (): boolean => nativeConnected ?? (typeof navigator === 'undefined' || navigator.onLine);

function publish(force = false): void {
  const online = isNetworkOnline();
  if (!force && online === lastOnline) return;
  lastOnline = online;
  for (const listener of [...listeners]) listener();
}
const onBrowser = () => { publish(nativeConnected === undefined); };

function startNative(): () => void {
  let live = true;
  let initialAllowed = true;
  let revision = 0;
  // Optional bridge readiness is bounded; fallback already uses the browser.
  const timer = setTimeout(() => { initialAllowed = false; }, 3000);
  const closeInitial = () => { initialAllowed = false; clearTimeout(timer); };
  const accept = (value: unknown): boolean => {
    const status = statusSchema.safeParse(value);
    if (!live || !status.success) return false;
    nativeConnected = status.data.connected;
    publish();
    return true;
  };
  const registration = Network.addListener('networkStatusChange', value => {
    if (accept(value)) { revision++; closeInitial(); }
  });
  const canRead = () => live && initialAllowed;
  void registration.then(async () => {
    if (!canRead() || revision > 0) return;
    const version = revision;
    const status = await Network.getStatus();
    if (canRead() && revision === version) accept(status);
    closeInitial();
  }).catch(closeInitial);
  return () => {
    live = false;
    closeInitial();
    nativeConnected = undefined;
    void registration.then(handle => handle.remove()).catch(() => { /* The bridge may already be gone. */ });
  };
}

/** One shared native subscription; browser online events retain their existing retry semantics. */
export function watchNetworkStatus(listener: () => void): () => void {
  const first = listeners.size === 0;
  const own = () => { listener(); };
  if (first) lastOnline = isNetworkOnline();
  listeners.add(own);
  if (first) {
    window.addEventListener('online', onBrowser);
    window.addEventListener('offline', onBrowser);
    if ((runtime() === 'android' || runtime() === 'ios') && Capacitor.isPluginAvailable('Network')) stopNative = startNative();
  }
  return () => {
    listeners.delete(own);
    if (listeners.size > 0) return;
    window.removeEventListener('online', onBrowser);
    window.removeEventListener('offline', onBrowser);
    stopNative?.(); stopNative = undefined;
  };
}
