import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useOpeningCover } from '../src/lib/openingCover.js';

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
    expect(result.current).toBe(true);
    act(() => { vi.advanceTimersByTime(450); });
    expect(result.current).toBe(false);
    rerender({ ready: false });
    expect(result.current).toBe(false);
  });

  it('covers a restored session until assets and the first frame are ready', () => {
    const { result } = renderHook(() => useOpeningCover(false));
    expect(result.current).toBe(true);
  });

  it('keeps a cached launch visible long enough to register', () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useOpeningCover(true));
    act(() => { vi.advanceTimersByTime(449); });
    expect(result.current).toBe(true);
    act(() => { vi.advanceTimersByTime(1); });
    expect(result.current).toBe(false);
  });

  it('opens by five seconds even when the canvas never signals ready', () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useOpeningCover(false));
    act(() => { vi.advanceTimersByTime(4_999); });
    expect(result.current).toBe(true);
    act(() => { vi.advanceTimersByTime(1); });
    expect(result.current).toBe(false);
  });
});
