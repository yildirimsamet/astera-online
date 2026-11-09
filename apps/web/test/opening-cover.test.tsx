import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { JUMP_OPEN_GRACE_MS, useOpeningCover } from '../src/lib/openingCover.js';

describe('the galaxy opening cover', () => {
  afterEach(() => { vi.useRealTimers(); });
  it('opens once and stays open through later data refetches', () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(
      ({ ready }) => useOpeningCover(ready),
      { initialProps: { ready: false } },
    );
    expect(result.current).toBe(true);
    rerender({ ready: true });
    expect(result.current).toBe(false);
    rerender({ ready: false });
    expect(result.current).toBe(false);
  });

  it('covers a restored session until assets and the first frame are ready', () => {
    const { result } = renderHook(() => useOpeningCover(false));
    expect(result.current).toBe(true);
  });

  it('opens a cached launch immediately without waiting for animation', () => {
    const { result } = renderHook(() => useOpeningCover(true));
    expect(result.current).toBe(false);
  });

  it('opens by the hard deadline even when the canvas never signals ready', () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useOpeningCover(false));
    act(() => { vi.advanceTimersByTime(6_999); });
    expect(result.current).toBe(true);
    act(() => { vi.advanceTimersByTime(1); });
    expect(result.current).toBe(false);
  });

  // Owner 2026-11-09: after a jump the player waited out the whole deadline on the flight's last frame
  // while every texture of the galaxy went up again. The view they land on opens soon after its data.
  it('opens a short grace after its data when it was reached by a jump', () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(
      ({ settled }) => useOpeningCover(false, 7_000, settled ? JUMP_OPEN_GRACE_MS : null),
      { initialProps: { settled: false } },
    );
    act(() => { vi.advanceTimersByTime(2_000); });
    expect(result.current).toBe(true);
    rerender({ settled: true });
    act(() => { vi.advanceTimersByTime(JUMP_OPEN_GRACE_MS - 1); });
    expect(result.current).toBe(true);
    act(() => { vi.advanceTimersByTime(1); });
    expect(result.current).toBe(false);
    expect(JUMP_OPEN_GRACE_MS).toBeLessThanOrEqual(2_000);
  });
});
