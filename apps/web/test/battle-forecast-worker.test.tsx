import { ControlledWorker } from './forecastWorker.js';
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { forecastLines, forecastLoss } from '@astera/rules';
import { useBattleForecast } from '../src/lib/useBattleForecast.js';
import { calculateBattleForecast, type BattleForecastRequest, type BattleForecastResult } from '../src/lib/battleForecast.js';

const request: BattleForecastRequest = { wing: { DART: 17 },
  input: { attackerTech: {}, defenderTech: {}, shield: { low: 0, high: 0 }, unarmed: { low: 0, high: 0 }, wall: { kind: 'EXACT', fleet: { DART: 17 } } },
  power: { low: 17 * 300, high: 17 * 300 } };
const result: BattleForecastResult = { lines: { clears: { low: 1, high: 2 }, breaks: { low: 3, high: 4 } }, loss: { low: .1, high: .2 } };
afterEach(() => { vi.unstubAllGlobals(); ControlledWorker.instances = []; });
const firstWorker = async () => {
  await waitFor(() => { expect(ControlledWorker.instances).toHaveLength(1); });
  return ControlledWorker.instances[0]!;
};

describe('combat forecasts run away from the browser render thread', () => {
  it('uses exactly the shared six-round engine for lines and losses', () => {
    expect(calculateBattleForecast(request)).toEqual({ lines: forecastLines(request.wing, request.input),
      loss: forecastLoss(request.wing, request.power, request.input) });
  });
  it('has a synchronous fallback where workers are unavailable', () => {
    vi.stubGlobal('Worker', undefined);
    const { result: view } = renderHook(() => useBattleForecast(request));
    expect(view.current).toMatchObject({ ...calculateBattleForecast(request), pending: false, error: false });
  });
  it('does not launch a worker without a reading', () => {
    vi.stubGlobal('Worker', ControlledWorker);
    const { result: view } = renderHook(() => useBattleForecast(null));
    expect(view.current).toEqual({ lines: null, loss: null, pending: false, error: false });
    expect(ControlledWorker.instances).toHaveLength(0);
  });
  it('returns immediately, sends exact wounds and shows the completed result', async () => {
    vi.stubGlobal('Worker', ControlledWorker);
    const wounded = { ...request, input: { ...request.input, attackerDamage: [{ hull: 'DART' as const, count: 1, damageBp: 7000, remainderBp: .5 }] } };
    const { result: view, unmount } = renderHook(() => useBattleForecast(wounded));
    expect(view.current).toEqual({ lines: null, loss: null, pending: true, error: false });
    const worker = await firstWorker();
    expect(worker.postMessage).toHaveBeenCalledWith(wounded);
    act(() => { worker.complete(); });
    expect(view.current).toEqual({ ...result, pending: false, error: false });
    unmount();
    expect(worker.terminate).toHaveBeenCalled();
  });
  it('cancels changed inputs, hides stale numbers and ignores a late reply', async () => {
    vi.stubGlobal('Worker', ControlledWorker);
    const { result: view, rerender } = renderHook(({ input }) => useBattleForecast(input), { initialProps: { input: request } });
    const old = await firstWorker();
    act(() => { old.complete(); });
    const next = { ...request, wing: { CORSAIR: 1000 } };
    rerender({ input: next });
    expect(view.current.lines).toBeNull();
    expect(view.current.pending).toBe(true);
    expect(old.terminate).toHaveBeenCalled();
    await waitFor(() => { expect(ControlledWorker.instances).toHaveLength(2); });
    act(() => { old.complete(); });
    expect(view.current.lines).toBeNull();
    act(() => { ControlledWorker.instances[1]!.complete(); });
    expect(view.current.lines).toEqual(result.lines);
  });
  it('reports worker failure without inventing a prediction', async () => {
    vi.stubGlobal('Worker', ControlledWorker);
    const { result: view } = renderHook(() => useBattleForecast(request));
    const worker = await firstWorker();
    act(() => { worker.onerror?.(new Event('error', { cancelable: true })); });
    expect(view.current).toEqual({ lines: null, loss: null, pending: false, error: true });
  });
  it('reports worker construction failure and does not hang pending forever', async () => {
    vi.stubGlobal('Worker', vi.fn(function blockedWorker() { throw new Error('blocked'); }));
    const { result: view } = renderHook(() => useBattleForecast(request));
    await waitFor(() => { expect(view.current.error).toBe(true); });
    expect(view.current.pending).toBe(false);
  });
});


it('keeps a pending or finished forecast across equivalent refreshed API objects', async () => {
  vi.stubGlobal('Worker', ControlledWorker);
  const { result: view, rerender } = renderHook(({ input }) => useBattleForecast(input), { initialProps: { input: request } });
  const worker = await firstWorker();
  rerender({ input: structuredClone(request) });
  await act(async () => { await Promise.resolve(); });
  expect(ControlledWorker.instances).toHaveLength(1);
  act(() => { worker.complete(); });
  expect(view.current.pending).toBe(false);
  rerender({ input: structuredClone(request) });
  expect(view.current.lines).toEqual(result.lines);
  await act(async () => { await Promise.resolve(); });
  expect(ControlledWorker.instances).toHaveLength(1);
});
