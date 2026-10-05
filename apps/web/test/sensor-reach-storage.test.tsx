import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useSensorReach } from '../src/lib/useSensorReach.js';

const telescopeKey = 'astera.sensor-reach.telescope.v1';
const radarKey = 'astera.sensor-reach.radar.v1';

beforeEach(() => { localStorage.clear(); });

describe('remembered sensor ranges', () => {
  it('starts both ranges off without a saved preference', () => {
    const { result } = renderHook(() => [useSensorReach('telescope'), useSensorReach('radar')]);
    expect(result.current.map(([visible]) => visible)).toEqual([false, false]);
  });

  it.each([true, false])('restores an explicitly saved %s preference', (visible) => {
    localStorage.setItem(telescopeKey, String(visible));
    const { result } = renderHook(() => useSensorReach('telescope'));
    expect(result.current[0]).toBe(visible);
  });

  it('remembers each range independently after unmount and remount', () => {
    const first = renderHook(() => [useSensorReach('telescope'), useSensorReach('radar')]);
    act(() => { first.result.current[0]![1]((visible) => !visible); });
    expect(localStorage.getItem(telescopeKey)).toBe('true');
    expect(localStorage.getItem(radarKey)).toBe('false');
    first.unmount();
    const second = renderHook(() => [useSensorReach('telescope'), useSensorReach('radar')]);
    expect(second.result.current.map(([visible]) => visible)).toEqual([true, false]);
    act(() => { second.result.current[0]![1](false); second.result.current[1]![1](true); });
    second.unmount();
    const third = renderHook(() => [useSensorReach('telescope'), useSensorReach('radar')]);
    expect(third.result.current.map(([visible]) => visible)).toEqual([false, true]);
  });

  it.each(['1', 'null', 'TRUE', '{broken'])('ignores invalid saved values (%s)', (value) => {
    localStorage.setItem(telescopeKey, value);
    const { result } = renderHook(() => useSensorReach('telescope'));
    expect(result.current[0]).toBe(false);
    act(() => { result.current[1](true); });
    expect(localStorage.getItem(telescopeKey)).toBe('true');
  });

  it('keeps the controls usable when storage access is blocked', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new DOMException('blocked', 'SecurityError'); });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('full', 'QuotaExceededError'); });
    const { result } = renderHook(() => useSensorReach('radar'));
    expect(result.current[0]).toBe(false);
    act(() => { result.current[1]((visible) => !visible); });
    expect(result.current[0]).toBe(true);
    act(() => { result.current[1](false); });
    expect(result.current[0]).toBe(false);
  });
});
