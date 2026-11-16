import { act, render, renderHook, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HomeBeaconMark, useBeaconPulse } from '../src/galaxy/HomeBeacon.js';
import i18n from '../src/i18n/index.js';

/**
 * THE HOME BUTTON ANSWERS (owner review 2026-11-16, item 12: "hiçbir şey yapmayan ev butonu").
 * When the camera already stood at home, the press changed nothing a player could see. Now every
 * press lights a beacon on the home world — rings that open out and "You are here" — for a moment,
 * whether the camera had to fly or not.
 */

beforeEach(async () => { await i18n.changeLanguage('en'); vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); });

describe('the beacon’s moment', () => {
  it('stays dark until the first press', () => {
    const { result } = renderHook(() => useBeaconPulse(0));
    expect(result.current).toBe(false);
  });

  it('lights on a press and goes dark after its moment', () => {
    const { result, rerender } = renderHook(({ signal }) => useBeaconPulse(signal), { initialProps: { signal: 0 } });
    rerender({ signal: 1 });
    expect(result.current).toBe(true);
    act(() => { vi.advanceTimersByTime(2_500); });
    expect(result.current).toBe(false);
  });

  it('starts its moment again on a second press while still lit', () => {
    const { result, rerender } = renderHook(({ signal }) => useBeaconPulse(signal), { initialProps: { signal: 1 } });
    act(() => { vi.advanceTimersByTime(2_000); });
    rerender({ signal: 2 });
    act(() => { vi.advanceTimersByTime(1_000); });
    expect(result.current).toBe(true);
  });
});

describe('the mark', () => {
  it('says where the player is', () => {
    render(<HomeBeaconMark />);
    expect(screen.getByText('You are here')).toBeInTheDocument();
    expect(document.querySelector('[data-home-beacon]')).not.toBeNull();
  });
});
