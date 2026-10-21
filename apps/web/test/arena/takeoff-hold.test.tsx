import { act, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LandKey, TAKEOFF_HOLD_MS } from '../../src/arena/Controls.js';
import { createHudStore } from '../../src/arena/store.js';

/** Owner 2026-10-21: the take-off hold was too long — 70 % shorter (550 → 165 ms), still a hold, not a tap. */
afterEach(() => { vi.useRealTimers(); });

describe('take-off hold', () => {
  it('lifts off after 165 ms held, and not on a shorter press', () => {
    vi.useFakeTimers();
    expect(TAKEOFF_HOLD_MS).toBe(165);
    const onTakeOff = vi.fn();
    const status = { ...createHudStore().getSnapshot(), landed: true };
    const view = render(<LandKey status={status} onLand={() => undefined} onCancel={() => undefined} onTakeOff={onTakeOff} />);
    const key = view.getByRole('button');
    fireEvent.pointerDown(key); act(() => { vi.advanceTimersByTime(120); }); fireEvent.pointerUp(key);
    act(() => { vi.advanceTimersByTime(500); });
    expect(onTakeOff).not.toHaveBeenCalled();
    fireEvent.pointerDown(key); act(() => { vi.advanceTimersByTime(170); });
    expect(onTakeOff).toHaveBeenCalledTimes(1);
  });
});
