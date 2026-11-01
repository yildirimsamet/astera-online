import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SensorReachContext, useSensorReach } from '../src/lib/useSensorReach.js';
describe('training sight presentation', () => {
  it('opens teaching layers without changing live-game preferences', () => {
    localStorage.setItem('astera.sensor-reach.telescope.v1', 'false');
    const setter = vi.fn();
    const { result } = renderHook(() => useSensorReach('telescope'), { wrapper: ({ children }) =>
      <SensorReachContext.Provider value={{ telescope: [true, setter], radar: [false, setter] }}>{children}</SensorReachContext.Provider> });
    expect(result.current[0]).toBe(true);
    expect(localStorage.getItem('astera.sensor-reach.telescope.v1')).toBe('false');
  });
});
