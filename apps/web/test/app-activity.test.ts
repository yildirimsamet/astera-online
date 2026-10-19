import { Capacitor } from '@capacitor/core';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { isAppActive, watchAppActivity } from '../src/platform/activity.js';

const native = vi.hoisted(() => {
  const state: { listener: ((value: unknown) => void) | null } = { listener: null };
  return { state, addListener: vi.fn(), getState: vi.fn(), remove: vi.fn<() => Promise<void>>() };
});
vi.mock('@capacitor/app', () => ({ App: native }));
const stops: (() => void)[] = [];
const flush = async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); };
const watch = (fn = vi.fn()) => { stops.push(watchAppActivity(fn)); return fn; };
const visibility = (value: 'hidden' | 'visible') => {
  Object.defineProperty(document, 'visibilityState', { configurable: true, value });
  document.dispatchEvent(new Event('visibilitychange'));
};
beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(true);
  vi.spyOn(Capacitor, 'getPlatform').mockReturnValue('android');
  vi.spyOn(Capacitor, 'isPluginAvailable').mockReturnValue(true);
  native.state.listener = null;
  native.remove.mockReset().mockResolvedValue(undefined);
  native.addListener.mockReset().mockImplementation((_event: string, listener: (value: unknown) => void) => {
    native.state.listener = listener;
    return Promise.resolve({ remove: native.remove });
  });
  native.getState.mockReset().mockResolvedValue({ isActive: true });
});
afterEach(async () => {
  stops.splice(0).forEach(stop => { stop(); });
  await flush();
  Reflect.deleteProperty(document, 'visibilityState');
  vi.restoreAllMocks();
  vi.useRealTimers();
});

it.each(['android', 'ios'])('waits for real activity on %s and combines both visibility signals', async platform => {
  vi.mocked(Capacitor.getPlatform).mockReturnValue(platform);
  expect(isAppActive()).toBe(false);
  const changed = watch();
  await flush();
  expect(isAppActive()).toBe(true);
  changed.mockClear();
  native.state.listener?.({ isActive: false });
  visibility('hidden'); visibility('visible');
  expect(isAppActive()).toBe(false);
  expect(changed).toHaveBeenCalledTimes(1);
  native.state.listener?.({ isActive: true });
  expect(isAppActive()).toBe(true);
  expect(changed).toHaveBeenCalledTimes(2);
});

it.each(['web', 'unsupported-native', 'missing-plugin'])('retains DOM behavior without native calls for %s', async kind => {
  if (kind === 'web') vi.mocked(Capacitor.isNativePlatform).mockReturnValue(false);
  if (kind === 'unsupported-native') vi.mocked(Capacitor.getPlatform).mockReturnValue('future');
  if (kind === 'missing-plugin') vi.mocked(Capacitor.isPluginAvailable).mockReturnValue(false);
  const changed = watch();
  await flush();
  expect(isAppActive()).toBe(true);
  visibility('hidden'); expect(isAppActive()).toBe(false);
  visibility('visible'); expect(isAppActive()).toBe(true);
  expect(changed).toHaveBeenCalledTimes(2);
  expect(native.addListener).not.toHaveBeenCalled(); expect(native.getState).not.toHaveBeenCalled();
});

it('shares one listener and removes only its own handle after the last subscriber', async () => {
  watch(); watch(); await flush();
  expect(native.addListener).toHaveBeenCalledTimes(1);
  stops.pop()?.(); await flush(); expect(native.remove).not.toHaveBeenCalled();
  stops.pop()?.(); await flush(); expect(native.remove).toHaveBeenCalledOnce();
});

it('ignores a stale initial read after a newer native event', async () => {
  let resolve: ((value: { isActive: boolean }) => void) | undefined;
  native.getState.mockImplementation(() => new Promise(done => { resolve = done; }));
  watch(); await flush();
  native.state.listener?.({ isActive: false });
  resolve?.({ isActive: true }); await flush();
  expect(isAppActive()).toBe(false);
});

it('removes a late registration and never applies its stale callback to a new subscription', async () => {
  let resolve: ((value: { remove: typeof native.remove }) => void) | undefined;
  native.addListener.mockImplementationOnce((_event: string, listener: (value: unknown) => void) => {
    native.state.listener = listener;
    return new Promise(done => { resolve = done; });
  });
  watch(); const stale = native.state.listener;
  stops.pop()?.();
  watch(); await flush();
  stale?.({ isActive: false });
  expect(isAppActive()).toBe(true);
  resolve?.({ remove: native.remove }); await flush();
  expect(native.remove).toHaveBeenCalledOnce();
});

it.each(['registration', 'initial-read', 'malformed', 'hung'])('falls back to DOM for %s failure instead of freezing the app', async kind => {
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  if (kind === 'registration') native.addListener.mockRejectedValueOnce(new Error('bridge gone'));
  if (kind === 'initial-read') native.getState.mockRejectedValueOnce(new Error('bridge gone'));
  if (kind === 'malformed') native.getState.mockResolvedValueOnce({ isActive: 'yes' });
  if (kind === 'hung') native.getState.mockImplementationOnce(() => new Promise(() => undefined));
  watch(); await flush();
  vi.advanceTimersByTime(3000); await flush();
  expect(isAppActive()).toBe(true);
  native.state.listener?.({ isActive: false });
  if (kind !== 'registration') expect(isAppActive()).toBe(false);
});

it('ignores malformed events and keeps native foreground behind a hidden document', async () => {
  watch(); await flush();
  native.state.listener?.({ isActive: false });
  native.state.listener?.({ isActive: 'true' });
  expect(isAppActive()).toBe(false);
  visibility('hidden'); native.state.listener?.({ isActive: true });
  expect(isAppActive()).toBe(false);
});

it('does not lose a native state delivered during listener registration', async () => {
  native.addListener.mockImplementationOnce((_event: string, listener: (value: unknown) => void) => {
    listener({ isActive: true });
    return Promise.resolve({ remove: native.remove });
  });
  const changed = watch(); await flush();
  expect(changed).toHaveBeenCalledOnce();
  expect(isAppActive()).toBe(true);
});

it('keeps separate subscription lifetimes even when callbacks have the same identity', async () => {
  const changed = vi.fn();
  watch(changed); watch(changed); await flush();
  stops.pop()?.(); await flush();
  expect(native.remove).not.toHaveBeenCalled();
  native.state.listener?.({ isActive: false });
  expect(isAppActive()).toBe(false);
});

it('does not let an expired initial read replace its DOM fallback', async () => {
  let resolve: ((value: { isActive: boolean }) => void) | undefined;
  native.getState.mockImplementationOnce(() => new Promise(done => { resolve = done; }));
  watch(); await flush(); vi.advanceTimersByTime(3000);
  expect(isAppActive()).toBe(true);
  resolve?.({ isActive: false }); await flush();
  expect(isAppActive()).toBe(true);
});
