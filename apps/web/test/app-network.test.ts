import { Capacitor } from '@capacitor/core';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { isNetworkOnline, watchNetworkStatus } from '../src/platform/network.js';

const native = vi.hoisted(() => ({
  listener: null as ((value: unknown) => void) | null,
  addListener: vi.fn(), getStatus: vi.fn(), remove: vi.fn<() => Promise<void>>(),
}));
vi.mock('@capacitor/network', () => ({ Network: native }));
const stops: (() => void)[] = [];
const flush = async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); };
const watch = (fn = vi.fn()) => { stops.push(watchNetworkStatus(fn)); return fn; };
const online = (connected: boolean) => { native.listener?.({ connected, connectionType: connected ? 'wifi' : 'none' }); };
beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(true);
  vi.spyOn(Capacitor, 'getPlatform').mockReturnValue('android');
  vi.spyOn(Capacitor, 'isPluginAvailable').mockReturnValue(true);
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
  native.listener = null;
  native.remove.mockReset().mockResolvedValue(undefined);
  native.addListener.mockReset().mockImplementation((_event: string, listener: (value: unknown) => void) => {
    native.listener = listener;
    return Promise.resolve({ remove: native.remove });
  });
  native.getStatus.mockReset().mockResolvedValue({ connected: false, connectionType: 'none' });
});
afterEach(async () => {
  stops.splice(0).forEach(stop => { stop(); });
  await flush();
  vi.restoreAllMocks(); vi.useRealTimers();
});

it.each(['android', 'ios'])('uses native connectivity over stale DOM state on %s', async platform => {
  vi.mocked(Capacitor.getPlatform).mockReturnValue(platform);
  const changed = watch(); await flush();
  expect(isNetworkOnline()).toBe(false);
  changed.mockClear();
  online(true); online(true);
  expect(isNetworkOnline()).toBe(true); expect(changed).toHaveBeenCalledOnce();
});

it('keeps a known native offline state through spurious DOM online events', async () => {
  const changed = watch(); await flush(); changed.mockClear();
  window.dispatchEvent(new Event('online'));
  expect(isNetworkOnline()).toBe(false); expect(changed).not.toHaveBeenCalled();
});

it('accepts native connectivity when the browser still reports offline', async () => {
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
  watch(); await flush(); online(true);
  expect(isNetworkOnline()).toBe(true);
});

it.each(['web', 'unsupported', 'missing-plugin'])('retains browser events without invoking native code for %s', async kind => {
  if (kind === 'web') vi.mocked(Capacitor.isNativePlatform).mockReturnValue(false);
  if (kind === 'unsupported') vi.mocked(Capacitor.getPlatform).mockReturnValue('future');
  if (kind === 'missing-plugin') vi.mocked(Capacitor.isPluginAvailable).mockReturnValue(false);
  const changed = watch(); await flush();
  window.dispatchEvent(new Event('online'));
  expect(changed).toHaveBeenCalledOnce();
  expect(native.getStatus).not.toHaveBeenCalled(); expect(native.addListener).not.toHaveBeenCalled();
});

it('does not invent a return when an already-online initial snapshot arrives', async () => {
  native.getStatus.mockResolvedValue({ connected: true, connectionType: 'wifi' });
  const changed = watch(); await flush();
  expect(isNetworkOnline()).toBe(true); expect(changed).not.toHaveBeenCalled();
});

it('shares one native listener with independent equal-callback lifetimes', async () => {
  const changed = vi.fn(); watch(changed); watch(changed); await flush();
  expect(native.addListener).toHaveBeenCalledOnce();
  expect(native.addListener).toHaveBeenCalledWith('networkStatusChange', expect.any(Function));
  stops.pop()?.(); await flush(); expect(native.remove).not.toHaveBeenCalled();
  changed.mockClear(); online(true); expect(changed).toHaveBeenCalledOnce();
  stops.pop()?.(); await flush(); expect(native.remove).toHaveBeenCalledOnce();
});

it('ignores an old initial snapshot after a newer connectivity event', async () => {
  let resolve: ((value: unknown) => void) | undefined;
  native.getStatus.mockImplementation(() => new Promise(done => { resolve = done; }));
  watch(); await flush(); online(false);
  resolve?.({ connected: true, connectionType: 'wifi' }); await flush();
  expect(isNetworkOnline()).toBe(false);
});

it('cleans up a late handle and ignores callbacks from disposed subscribers', async () => {
  let resolve: ((value: { remove: typeof native.remove }) => void) | undefined;
  native.addListener.mockImplementationOnce((_event: string, listener: (value: unknown) => void) => {
    native.listener = listener; return new Promise(done => { resolve = done; });
  });
  watch(); const stale = native.listener; stops.pop()?.();
  native.getStatus.mockResolvedValue({ connected: true, connectionType: 'wifi' });
  watch(); await flush(); stale?.({ connected: false, connectionType: 'none' });
  resolve?.({ remove: native.remove }); await flush();
  expect(isNetworkOnline()).toBe(true); expect(native.remove).toHaveBeenCalledOnce();
});

it.each(['registration', 'read', 'malformed', 'hung'])('retains browser fallback after %s failure', async kind => {
  if (kind === 'registration') native.addListener.mockRejectedValueOnce(new Error('bridge gone'));
  if (kind === 'read') native.getStatus.mockRejectedValueOnce(new Error('bridge gone'));
  if (kind === 'malformed') native.getStatus.mockResolvedValueOnce({ connected: 'yes', connectionType: 'wifi' });
  if (kind === 'hung') native.getStatus.mockImplementationOnce(() => new Promise(() => undefined));
  watch(); await flush(); vi.advanceTimersByTime(3000); await flush();
  expect(isNetworkOnline()).toBe(true);
});

it('ignores malformed native events and expired initial reads', async () => {
  let resolve: ((value: unknown) => void) | undefined;
  native.getStatus.mockImplementation(() => new Promise(done => { resolve = done; }));
  watch(); await flush(); vi.advanceTimersByTime(3000);
  resolve?.({ connected: false, connectionType: 'none' }); await flush();
  expect(isNetworkOnline()).toBe(true);
  online(false); native.listener?.({ connected: true, connectionType: 'invented' });
  expect(isNetworkOnline()).toBe(false);
});

it('does not lose a synchronous native callback during subscription setup', async () => {
  native.addListener.mockImplementationOnce((_event: string, listener: (value: unknown) => void) => {
    listener({ connected: false, connectionType: 'none' }); return Promise.resolve({ remove: native.remove });
  });
  const changed = watch(); await flush();
  expect(isNetworkOnline()).toBe(false); expect(changed).toHaveBeenCalledOnce();
});
