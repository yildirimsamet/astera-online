import { afterEach, expect, it, vi } from 'vitest';
import { AnalyticsRecorder } from '../src/services/analyticsRecorder.js';
afterEach(() => { vi.useRealTimers(); });
it('does not retain an unbounded backlog or propagate a delivery failure to gameplay', async () => {
  vi.useFakeTimers(); const failure = vi.fn();
  let release: (() => void) | undefined;
  const recorder = new AnalyticsRecorder(() => new Promise<void>(resolve => { release = resolve; }), failure);
  for (let i = 0; i < 1000; i++) recorder.wake();
  expect(recorder.pending).toBeLessThanOrEqual(1);
  await vi.advanceTimersByTimeAsync(0); release?.(); await vi.advanceTimersByTimeAsync(0); await recorder.close();
  const broken = new AnalyticsRecorder(() => Promise.reject(new Error('analytics down')), failure);
  expect(() => { broken.wake(); }).not.toThrow(); await vi.advanceTimersByTimeAsync(0);
  expect(failure).toHaveBeenCalledOnce(); await broken.close();
});
it('does not prevent server shutdown when optional database work never settles', async () => {
  vi.useFakeTimers();
  const failed = vi.fn(), recorder = new AnalyticsRecorder(() => new Promise<void>(() => undefined), failed);
  recorder.wake(); await vi.advanceTimersByTimeAsync(0);
  const finished = vi.fn(), stopping = recorder.close().then(finished);
  await vi.advanceTimersByTimeAsync(5000);
  expect(finished).toHaveBeenCalledOnce(); expect(failed).toHaveBeenCalledOnce();
  await stopping;
});
