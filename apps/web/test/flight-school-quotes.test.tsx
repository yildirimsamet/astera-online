import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SchoolPresentationContext } from '../src/onboarding/flightSchool/presentation.js';
import { useOrderDuration } from '../src/ui/Action.js';
import { duration } from '../src/lib/time.js';

describe('training order quotes', () => {
  it('quotes the same three seconds that the exercise actually charges in time', () => {
    const { result } = renderHook(() => useOrderDuration(12), { wrapper: ({ children }) =>
      <SchoolPresentationContext.Provider value={{ orderSeconds: 3, legSeconds: 6.5 }}>{children}</SchoolPresentationContext.Provider> });
    expect(result.current).toBe(duration(3 / 60));
  });
  it('preserves ordinary production quotes outside the exercise', () => {
    expect(renderHook(() => useOrderDuration(12)).result.current).toBe(duration(12));
  });
});
