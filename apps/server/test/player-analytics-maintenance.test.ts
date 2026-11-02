import { afterEach, expect, it, vi } from 'vitest';
import { startAnalyticsMaintenance } from '../src/services/analyticsMaintenance.js';
afterEach(() => { vi.useRealTimers(); });
it('cleans at startup and hourly even when collection is disabled, without overlap', async () => {
  vi.useFakeTimers();
  let release: (() => void) | undefined;
  const sweep = vi.fn(() => new Promise<void>(resolve => { release = resolve; }));
  const failed = vi.fn();
  const stop = startAnalyticsMaintenance(sweep, failed);
  expect(sweep).toHaveBeenCalledOnce();
  await vi.advanceTimersByTimeAsync(3_600_000); expect(sweep).toHaveBeenCalledOnce();
  release?.(); await vi.advanceTimersByTimeAsync(3_600_000); expect(sweep).toHaveBeenCalledTimes(2);
  const stopping = stop(); release?.(); await stopping;
  await vi.advanceTimersByTimeAsync(3_600_000); expect(sweep).toHaveBeenCalledTimes(2);
});
it('handles an unavailable analytics database without an unhandled rejection', async () => {
  vi.useFakeTimers(); const failed = vi.fn();
  const stop = startAnalyticsMaintenance(() => Promise.reject(new Error('unavailable')), failed);
  await vi.advanceTimersByTimeAsync(0); expect(failed).toHaveBeenCalledOnce(); await stop();
});
it('bounds shutdown even if a maintenance database call never returns', async () => {
  vi.useFakeTimers(); const failed = vi.fn();
  const stop = startAnalyticsMaintenance(() => new Promise<void>(() => undefined), failed);
  const finished = vi.fn(), stopping = stop().then(finished);
  await vi.advanceTimersByTimeAsync(5000);
  expect(finished).toHaveBeenCalledOnce(); expect(failed).toHaveBeenCalledOnce(); await stopping;
});
