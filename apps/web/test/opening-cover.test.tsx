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
    act(() => { vi.advanceTimersByTime(19_999); });
    expect(result.current).toBe(true);
    act(() => { vi.advanceTimersByTime(1); });
    expect(result.current).toBe(false);
  });
});
