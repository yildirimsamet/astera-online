import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  FIELD_WAKE_GRACE_MS,
  keys,
  useAsteroidFieldWake,
} from '../src/api/queries.js';
import { resetClock, serverNow } from '../src/lib/clock.js';

function Harness({ at }: { at: Date | null | undefined }) {
  useAsteroidFieldWake(at);
  return null;
}

describe('server-timed asteroid discovery wakeup', () => {
  let client: QueryClient;
  let invalidated: readonly (readonly unknown[])[];

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-01T12:00:00.000Z'));
    resetClock();
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    invalidated = [];
    vi.spyOn(client, 'invalidateQueries').mockImplementation((filters?: unknown) => {
      const key = (filters as { queryKey?: readonly unknown[] } | undefined)?.queryKey;
      if (key) invalidated = [...invalidated, key];
      return Promise.resolve();
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    resetClock();
    vi.restoreAllMocks();
  });

  const mount = (at: Date | null | undefined) => render(
    <QueryClientProvider client={client}>
      <Harness at={at} />
    </QueryClientProvider>,
  );

  it('does not ask early', () => {
    mount(new Date(Date.now() + 30_000));
    vi.advanceTimersByTime(30_000 + FIELD_WAKE_GRACE_MS - 1);
    expect(invalidated).toEqual([]);
  });

  it('invalidates only the caller-specific field immediately after the earned instant', () => {
    mount(new Date(Date.now() + 30_000));
    vi.advanceTimersByTime(30_000 + FIELD_WAKE_GRACE_MS);
    expect(invalidated).toEqual([keys.miningField]);
  });

  it('uses server time when the phone clock is wrong', () => {
    resetClock(120_000);
    mount(new Date(serverNow() + 30_000));
    vi.advanceTimersByTime(30_000 + FIELD_WAKE_GRACE_MS - 1);
    expect(invalidated).toEqual([]);
    vi.advanceTimersByTime(1);
    expect(invalidated).toEqual([keys.miningField]);
  });

  it('arms nothing when the server has no future change', () => {
    mount(null);
    vi.advanceTimersByTime(24 * 60 * 60 * 1_000);
    expect(invalidated).toEqual([]);
  });

  it('repairs a response whose change instant is already past exactly once', () => {
    mount(new Date(Date.now() - 5_000));
    vi.runAllTimers();
    expect(invalidated).toEqual([keys.miningField]);
  });

  it('cancels the old wake when a fresher response names a different instant', () => {
    const view = mount(new Date(Date.now() + 10_000));
    view.rerender(
      <QueryClientProvider client={client}>
        <Harness at={new Date(Date.now() + 60_000)} />
      </QueryClientProvider>,
    );
    vi.advanceTimersByTime(10_000 + FIELD_WAKE_GRACE_MS);
    expect(invalidated).toEqual([]);
    vi.advanceTimersByTime(50_000);
    expect(invalidated).toEqual([keys.miningField]);
  });

  it('does not leave a timer behind after unmount', () => {
    const view = mount(new Date(Date.now() + 10_000));
    view.unmount();
    vi.runAllTimers();
    expect(invalidated).toEqual([]);
  });
});
