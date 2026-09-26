import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useOpeningCover } from '../src/lib/openingCover.js';

describe('the galaxy opening cover', () => {
  it('opens once and stays open through later data refetches', () => {
    const { result, rerender } = renderHook(
      ({ ready }) => useOpeningCover(ready, false),
      { initialProps: { ready: false } },
    );
    expect(result.current).toBe(true);
    rerender({ ready: true });
    expect(result.current).toBe(false);
    rerender({ ready: false });
    expect(result.current).toBe(false);
  });

  it('starts uncovered when resuming a previously opened galaxy', () => {
    const { result } = renderHook(() => useOpeningCover(false, true));
    expect(result.current).toBe(false);
  });
});
