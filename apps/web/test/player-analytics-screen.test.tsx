import { act, renderHook } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { useAnalyticsScreen } from '../src/lib/playerAnalytics/useAnalyticsScreen.js';
import { ANALYTICS_READY_EVENT } from '../src/lib/playerAnalytics/runtime.js';
const observer = vi.hoisted(() => ({ observe: vi.fn(), syncAnalyticsIdentity: vi.fn() }));
vi.mock('../src/lib/playerAnalytics/runtime.js', () => ({ ...observer, ANALYTICS_READY_EVENT: 'astera:analytics-ready' }));
beforeEach(() => { vi.clearAllMocks(); });
it('records state on transition and permission start, distinguishing rehearsal and replay', () => {
  const token = () => 'token';
  const view = renderHook(({ phase, replay }) => useAnalyticsScreen(phase, 'A', token, 'fleet', replay),
    { initialProps: { phase: 'ready', replay: false } });
  expect(observer.observe).not.toHaveBeenCalledWith('game_ready', {}, 'live');
  act(() => { view.result.current(); });
  expect(observer.observe).toHaveBeenCalledWith('game_ready', {}, 'live');
  expect(observer.observe).toHaveBeenCalledWith('surface_visible', { surface: 'fleet' }, 'live');
  observer.observe.mockClear(); view.rerender({ phase: 'rehearsing', replay: false });
  expect(observer.observe).not.toHaveBeenCalledWith('game_ready', {}, 'live');
  view.rerender({ phase: 'ready', replay: true });
  expect(observer.observe).toHaveBeenCalledWith('load_phase', { phase: 'ready' }, 'replay');
  observer.observe.mockClear(); act(() => { window.dispatchEvent(new Event(ANALYTICS_READY_EVENT)); });
  expect(observer.observe).toHaveBeenCalled();
});

it('does not count opening another panel as entering the game again', () => {
  const token = () => 'token';
  const view = renderHook(({ surface }) => useAnalyticsScreen('ready', 'A', token, surface, false), { initialProps: { surface: 'fleet' } });
  observer.observe.mockClear(); view.rerender({ surface: 'base' });
  expect(observer.observe).not.toHaveBeenCalledWith('game_ready', {}, 'live');
});

it('records a fresh game presentation after returning from a long background gap', () => {
  let now = 1_800_000_000_000; vi.spyOn(Date, 'now').mockImplementation(() => now);
  const visibility = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
  const view = renderHook(() => useAnalyticsScreen('ready', 'A', () => 'token', null, false));
  act(() => { view.result.current(); }); observer.observe.mockClear();
  visibility.mockReturnValue('hidden'); act(() => { document.dispatchEvent(new Event('visibilitychange')); });
  now += 31 * 60_000; visibility.mockReturnValue('visible');
  act(() => { document.dispatchEvent(new Event('visibilitychange')); });
  expect(observer.observe).toHaveBeenCalledWith('game_ready', {}, 'live');
});

it('does not announce a visible game when an observation scope is granted in the background', () => {
  const view = renderHook(() => useAnalyticsScreen('ready', 'A', () => 'token', null, false));
  act(() => { view.result.current(); }); observer.observe.mockClear();
  const state = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
  act(() => { document.dispatchEvent(new Event('visibilitychange')); window.dispatchEvent(new Event(ANALYTICS_READY_EVENT)); });
  expect(observer.observe.mock.calls.filter(([name]) => name === 'game_ready' || name === 'surface_visible')).toHaveLength(0);
  state.mockReturnValue('visible');
  act(() => { document.dispatchEvent(new Event('visibilitychange')); });
  expect(observer.observe).toHaveBeenCalledWith('game_ready', {}, 'live');
});
