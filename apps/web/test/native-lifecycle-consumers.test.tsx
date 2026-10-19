import { Capacitor } from '@capacitor/core';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { Api, ApiError } from '../src/api/client.js';
import { ApiProvider } from '../src/api/context.js';
import { RESUME_RESYNC_MS, useEventStream } from '../src/session/useEventStream.js';
import { setMusicEnabled, useAmbientMusic } from '../src/lib/music.js';
import { useAmbientFrames } from '../src/galaxy/frames.js';
import { setEffectsEnabled, useSoundEffects } from '../src/lib/sound.js';
import { useSession } from '../src/session/useSession.js';

const native = vi.hoisted(() => ({
  listener: null as ((state: { isActive: boolean }) => void) | null,
  remove: vi.fn<() => Promise<void>>(),
  addListener: vi.fn(),
  getState: vi.fn(),
}));
vi.mock('@capacitor/app', () => ({ App: native }));
const network = vi.hoisted(() => ({
  listener: null as ((value: unknown) => void) | null,
  addListener: vi.fn(), getStatus: vi.fn(), remove: vi.fn<() => Promise<void>>(),
}));
vi.mock('@capacitor/network', () => ({ Network: network }));
const renderer = vi.hoisted(() => ({ invalidate: vi.fn() }));
vi.mock('@react-three/fiber', () => ({
  useThree: (select: (state: { invalidate: typeof renderer.invalidate }) => unknown) => select(renderer),
}));

beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(true);
  vi.spyOn(Capacitor, 'getPlatform').mockReturnValue('android');
  vi.spyOn(Capacitor, 'isPluginAvailable').mockReturnValue(true);
  native.listener = null;
  window.sessionStorage.clear();
  native.remove.mockReset().mockResolvedValue(undefined);
  native.addListener.mockReset().mockImplementation((event: string, listener: (state: { isActive: boolean }) => void) => {
    if (event === 'appStateChange') native.listener = listener;
    return Promise.resolve({ remove: native.remove });
  });
  native.getState.mockReset().mockResolvedValue({ isActive: true });
  network.listener = null;
  network.remove.mockReset().mockResolvedValue(undefined);
  network.addListener.mockReset().mockImplementation((_event: string, listener: (value: unknown) => void) => {
    network.listener = listener;
    return Promise.resolve({ remove: network.remove });
  });
  network.getStatus.mockReset().mockResolvedValue({ connected: true, connectionType: 'wifi' });
});
afterEach(() => {
  cleanup();
  Reflect.deleteProperty(document, 'visibilityState');
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

async function mount() {
  const api = new Api({ authTransport: null });
  vi.spyOn(api, 'stream').mockImplementation((_handler, signal, onOpen) => {
    onOpen?.();
    return new Promise<void>(resolve => { signal.addEventListener('abort', () => { resolve(); }, { once: true }); });
  });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const refresh = vi.spyOn(client, 'invalidateQueries').mockResolvedValue(undefined);
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>
    <ApiProvider api={api}>{children}</ApiProvider>
  </QueryClientProvider>;
  const view = renderHook(() => { useEventStream(true); }, { wrapper });
  await act(async () => { await Promise.resolve(); });
  refresh.mockClear();
  return { ...view, refresh };
}
const state = (isActive: boolean) => { native.listener?.({ isActive }); };
const visibility = (value: 'hidden' | 'visible') => {
  Object.defineProperty(document, 'visibilityState', { configurable: true, value });
  document.dispatchEvent(new Event('visibilitychange'));
};

it('resyncs a long native absence even when the WebView reports visible throughout', async () => {
  const { refresh } = await mount();
  act(() => { state(false); vi.advanceTimersByTime(RESUME_RESYNC_MS + 1); state(true); vi.advanceTimersByTime(1); });
  expect(refresh.mock.calls.some(([filters]) => filters?.queryKey?.[0] === 'planet')).toBe(true);
});

it('waits for native foreground when DOM visibility returns first', async () => {
  const { refresh } = await mount();
  act(() => { state(false); visibility('hidden'); vi.advanceTimersByTime(RESUME_RESYNC_MS + 1); visibility('visible'); vi.advanceTimersByTime(1); });
  expect(refresh).not.toHaveBeenCalled();
  act(() => { state(true); vi.advanceTimersByTime(1); });
  expect(refresh.mock.calls.some(([filters]) => filters?.queryKey?.[0] === 'planet')).toBe(true);
});

it('coalesces native and DOM resume into one existing catch-up pass', async () => {
  const { refresh } = await mount();
  act(() => {
    state(false); visibility('hidden'); vi.advanceTimersByTime(RESUME_RESYNC_MS + 1);
    state(true); visibility('visible'); state(true); vi.advanceTimersByTime(1);
  });
  expect(refresh.mock.calls.filter(([filters]) => filters?.queryKey?.[0] === 'planet')).toHaveLength(1);
});

it('keeps short native switches below the existing expensive resync threshold', async () => {
  const { refresh } = await mount();
  act(() => { state(false); vi.advanceTimersByTime(1000); state(true); vi.advanceTimersByTime(1); });
  expect(refresh).not.toHaveBeenCalled();
});

it('pauses and resumes the actual score on native activity while DOM stays visible', async () => {
  const play = vi.spyOn(window.HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
  const pause = vi.spyOn(window.HTMLMediaElement.prototype, 'pause').mockImplementation(() => undefined);
  vi.spyOn(window.HTMLMediaElement.prototype, 'load').mockImplementation(() => undefined);
  setMusicEnabled(true);
  renderHook(() => { useAmbientMusic(); });
  await act(async () => { await Promise.resolve(); await Promise.resolve(); });
  expect(play).toHaveBeenCalledOnce();
  play.mockClear(); pause.mockClear();
  act(() => { state(false); });
  expect(pause).toHaveBeenCalledOnce();
  act(() => { state(true); });
  expect(play).toHaveBeenCalledOnce();
});

it('stops buying ambient render frames in native background and resumes without duplicate loops', async () => {
  renderer.invalidate.mockClear();
  const view = renderHook(() => { useAmbientFrames(); });
  await act(async () => { await Promise.resolve(); await Promise.resolve(); });
  act(() => { vi.advanceTimersByTime(100); });
  expect(renderer.invalidate).toHaveBeenCalled();
  renderer.invalidate.mockClear();
  act(() => { state(false); vi.advanceTimersByTime(100); });
  expect(renderer.invalidate).not.toHaveBeenCalled();
  act(() => { state(true); state(true); vi.advanceTimersByTime(100); });
  expect(renderer.invalidate).toHaveBeenCalled();
  view.unmount(); renderer.invalidate.mockClear();
  act(() => { state(true); vi.advanceTimersByTime(100); });
  expect(renderer.invalidate).not.toHaveBeenCalled();
});

it('does not unlock or preload sound effects just because native foreground becomes known', async () => {
  const context = vi.fn(function () { throw new Error('Audio must wait for a gesture'); });
  vi.stubGlobal('AudioContext', context);
  setEffectsEnabled(true);
  renderHook(() => { useSoundEffects(); });
  await act(async () => { await Promise.resolve(); await Promise.resolve(); });
  expect(context).not.toHaveBeenCalled();
});

it('recovers a failed cold start on native foreground without retrying the initial state snapshot', async () => {
  const api = new Api({ authTransport: null });
  const restore = vi.spyOn(api, 'restore').mockRejectedValueOnce(new ApiError('UNREACHABLE', 'offline', 503)).mockResolvedValue(true);
  vi.spyOn(api, 'me').mockResolvedValue({ accountId: 'pilot', username: 'pilot', displayName: 'Pilot', country: 'TR', isAdmin: false, placement: null });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>
    <ApiProvider api={api}>{children}</ApiProvider>
  </QueryClientProvider>;
  const { result } = renderHook(() => useSession(), { wrapper });
  await act(async () => { await Promise.resolve(); await Promise.resolve(); });
  expect(result.current.session.phase).toBe('blocked');
  expect(restore).toHaveBeenCalledOnce();
  await act(async () => { state(false); state(true); await Promise.resolve(); });
  expect(result.current.session.phase).toBe('servers');
  expect(restore).toHaveBeenCalledTimes(2);
});

it('recognizes the first real foreground after a cold start in native background', async () => {
  native.getState.mockResolvedValue({ isActive: false });
  const api = new Api({ authTransport: null });
  const restore = vi.spyOn(api, 'restore').mockRejectedValueOnce(new ApiError('UNREACHABLE', 'offline', 503)).mockResolvedValue(true);
  vi.spyOn(api, 'me').mockResolvedValue({ accountId: 'pilot', username: 'pilot', displayName: 'Pilot', country: 'TR', isAdmin: false, placement: null });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>
    <ApiProvider api={api}>{children}</ApiProvider>
  </QueryClientProvider>;
  const { result } = renderHook(() => useSession(), { wrapper });
  await act(async () => { await Promise.resolve(); await Promise.resolve(); });
  expect(result.current.session.phase).toBe('blocked');
  await act(async () => { state(true); await Promise.resolve(); });
  expect(result.current.session.phase).toBe('servers');
  expect(restore).toHaveBeenCalledTimes(2);
});

async function failedNativeColdStart(status = 503) {
  const api = new Api({ authTransport: null });
  const restore = vi.spyOn(api, 'restore').mockRejectedValueOnce(new ApiError('UNREACHABLE', 'offline', status)).mockResolvedValue(true);
  vi.spyOn(api, 'me').mockResolvedValue({ accountId: 'pilot', username: 'pilot', displayName: 'Pilot', country: 'TR', isAdmin: false, placement: null });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>
    <ApiProvider api={api}>{children}</ApiProvider>
  </QueryClientProvider>;
  const view = renderHook(() => useSession(), { wrapper });
  await act(async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); });
  return { ...view, restore };
}

it('recovers the real WebView failure when navigator stays online and no DOM online event arrives', async () => {
  network.getStatus.mockResolvedValue({ connected: false, connectionType: 'none' });
  const { result, restore } = await failedNativeColdStart();
  expect(result.current.session.phase).toBe('blocked');
  await act(async () => { network.listener?.({ connected: true, connectionType: 'wifi' }); await Promise.resolve(); });
  expect(result.current.session.phase).toBe('servers');
  expect(restore).toHaveBeenCalledTimes(2);
});

it('keeps native offline authoritative over a stale navigator on foreground', async () => {
  network.getStatus.mockResolvedValue({ connected: false, connectionType: 'none' });
  const { result, restore } = await failedNativeColdStart();
  await act(async () => { state(false); state(true); await Promise.resolve(); });
  expect(result.current.session.phase).toBe('blocked');
  expect(restore).toHaveBeenCalledOnce();
  await act(async () => { network.listener?.({ connected: true, connectionType: 'wifi' }); await Promise.resolve(); });
  expect(result.current.session.phase).toBe('servers');
});

it('accepts real native connectivity even when navigator remains offline', async () => {
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
  network.getStatus.mockResolvedValue({ connected: false, connectionType: 'none' });
  const { result } = await failedNativeColdStart();
  await act(async () => { network.listener?.({ connected: true, connectionType: 'cellular' }); await Promise.resolve(); });
  expect(result.current.session.phase).toBe('servers');
});

it('does not retry a failed cold start merely because the native online baseline arrived', async () => {
  const { result, restore } = await failedNativeColdStart();
  expect(result.current.session.phase).toBe('blocked');
  expect(restore).toHaveBeenCalledOnce();
});

it.each([401, 403, 429])('does not turn native connectivity into auth retry for %s', async status => {
  network.getStatus.mockResolvedValue({ connected: false, connectionType: 'none' });
  const { restore } = await failedNativeColdStart(status);
  await act(async () => { network.listener?.({ connected: true, connectionType: 'wifi' }); await Promise.resolve(); });
  expect(restore).toHaveBeenCalledOnce();
});

it('defers a native network recovery while backgrounded until the real foreground return', async () => {
  network.getStatus.mockResolvedValue({ connected: false, connectionType: 'none' });
  const { result, restore } = await failedNativeColdStart();
  await act(async () => { state(false); network.listener?.({ connected: true, connectionType: 'wifi' }); await Promise.resolve(); });
  expect(restore).toHaveBeenCalledOnce();
  await act(async () => { state(true); await Promise.resolve(); });
  expect(result.current.session.phase).toBe('servers');
  expect(restore).toHaveBeenCalledTimes(2);
});

it('resyncs once on native reconnection without requiring any DOM online event', async () => {
  network.getStatus.mockResolvedValue({ connected: false, connectionType: 'none' });
  const { refresh } = await mount();
  act(() => {
    network.listener?.({ connected: true, connectionType: 'wifi' });
    network.listener?.({ connected: true, connectionType: 'wifi' });
    window.dispatchEvent(new Event('online'));
    vi.advanceTimersByTime(1);
  });
  expect(refresh.mock.calls.filter(([filters]) => filters?.queryKey?.[0] === 'planet')).toHaveLength(1);
});

it('resyncs on native connectivity alone before a duplicate browser online signal', async () => {
  network.getStatus.mockResolvedValue({ connected: false, connectionType: 'none' });
  const { refresh } = await mount();
  act(() => { network.listener?.({ connected: true, connectionType: 'wifi' }); vi.advanceTimersByTime(1); });
  expect(refresh.mock.calls.filter(([filters]) => filters?.queryKey?.[0] === 'planet')).toHaveLength(1);
  act(() => { window.dispatchEvent(new Event('online')); vi.advanceTimersByTime(300); });
  expect(refresh.mock.calls.filter(([filters]) => filters?.queryKey?.[0] === 'planet')).toHaveLength(1);
});

it('drops a queued resync if connectivity disappears before its callback runs', async () => {
  network.getStatus.mockResolvedValue({ connected: false, connectionType: 'none' });
  const { refresh } = await mount();
  act(() => {
    network.listener?.({ connected: true, connectionType: 'wifi' });
    network.listener?.({ connected: false, connectionType: 'none' });
    vi.advanceTimersByTime(1);
  });
  expect(refresh).not.toHaveBeenCalled();
});

it('retains a background network return for the next short foreground switch', async () => {
  network.getStatus.mockResolvedValue({ connected: false, connectionType: 'none' });
  const { refresh } = await mount();
  act(() => { state(false); network.listener?.({ connected: true, connectionType: 'wifi' }); vi.advanceTimersByTime(1); });
  expect(refresh).not.toHaveBeenCalled();
  act(() => { state(true); vi.advanceTimersByTime(1); });
  expect(refresh.mock.calls.filter(([filters]) => filters?.queryKey?.[0] === 'planet')).toHaveLength(1);
});

it('retains a network return when native background wins the queued resync race', async () => {
  network.getStatus.mockResolvedValue({ connected: false, connectionType: 'none' });
  const { refresh } = await mount();
  act(() => { network.listener?.({ connected: true, connectionType: 'wifi' }); state(false); vi.advanceTimersByTime(1); });
  expect(refresh).not.toHaveBeenCalled();
  act(() => { state(true); vi.advanceTimersByTime(1); });
  expect(refresh.mock.calls.filter(([filters]) => filters?.queryKey?.[0] === 'planet')).toHaveLength(1);
});
