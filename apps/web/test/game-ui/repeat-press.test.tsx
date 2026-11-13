import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { REPEAT_START_MS, repeatInterval } from '../../src/game-ui/logic.js';
import { useRepeatPress } from '../../src/game-ui/useRepeatPress.js';

/**
 * TAP FOR ONE, HOLD FOR MANY. A ship card sits in a scrolling list, so a finger that
 * lands on it and then scrolls must add nothing: a tap counts on release, a hold
 * starts repeating only after a pause, and a gesture the browser takes for a scroll
 * (pointercancel) counts nothing at all.
 */

function Probe({ onStep, enabled = true }: { onStep: (n: number) => void; enabled?: boolean }) {
  const press = useRepeatPress(onStep, enabled);
  return <button type="button" {...press}>add</button>;
}

const setup = (enabled = true) => {
  const onStep = vi.fn();
  render(<Probe onStep={onStep} enabled={enabled} />);
  return { onStep, button: screen.getByRole('button') };
};

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); });

describe('the repeat press', () => {
  it('stops repeating once it can no longer step, though the finger stays down', () => {
    const onStep = vi.fn();
    const { rerender } = render(<Probe onStep={onStep} />);
    fireEvent.pointerDown(screen.getByRole('button'), { button: 0 });
    act(() => { vi.advanceTimersByTime(REPEAT_START_MS + 500); });
    const steps = onStep.mock.calls.length;
    expect(steps).toBeGreaterThan(1);
    rerender(<Probe onStep={onStep} enabled={false} />);
    act(() => { vi.advanceTimersByTime(2_000); });
    expect(onStep).toHaveBeenCalledTimes(steps);
  });

  it('adds one on a tap, counted on release', () => {
    const { onStep, button } = setup();
    fireEvent.pointerDown(button, { button: 0 });
    expect(onStep).not.toHaveBeenCalled();
    fireEvent.pointerUp(button);
    expect(onStep).toHaveBeenCalledTimes(1);
    expect(onStep).toHaveBeenCalledWith(1);
  });

  it('repeats while held, faster as it goes, and adds nothing more on release', () => {
    const { onStep, button } = setup();
    fireEvent.pointerDown(button, { button: 0 });
    act(() => { vi.advanceTimersByTime(REPEAT_START_MS); });
    expect(onStep).toHaveBeenCalledTimes(1);
    act(() => { vi.advanceTimersByTime(repeatInterval(0)); });
    act(() => { vi.advanceTimersByTime(repeatInterval(1)); });
    expect(onStep).toHaveBeenCalledTimes(3);
    fireEvent.pointerUp(button);
    act(() => { vi.advanceTimersByTime(2_000); });
    expect(onStep).toHaveBeenCalledTimes(3);
  });

  it('counts nothing when the browser takes the gesture for a scroll', () => {
    const { onStep, button } = setup();
    fireEvent.pointerDown(button, { button: 0 });
    fireEvent.pointerCancel(button);
    act(() => { vi.advanceTimersByTime(2_000); });
    fireEvent.pointerUp(button);
    expect(onStep).not.toHaveBeenCalled();
  });

  it('ignores the secondary button and a disabled control', () => {
    const { onStep, button } = setup();
    // jsdom's fireEvent drops `button` on pointer events; a MouseEvent of the same type keeps it.
    fireEvent(button, new MouseEvent('pointerdown', { bubbles: true, button: 2 }));
    fireEvent.pointerUp(button);
    expect(onStep).not.toHaveBeenCalled();
  });

  it('does nothing while disabled', () => {
    const { onStep, button } = setup(false);
    fireEvent.pointerDown(button, { button: 0 });
    act(() => { vi.advanceTimersByTime(2_000); });
    fireEvent.pointerUp(button);
    expect(onStep).not.toHaveBeenCalled();
  });

  it('adds one for a keyboard activation, and ignores the click a pointer tap also fires', () => {
    const { onStep, button } = setup();
    fireEvent.click(button, { detail: 0 });
    expect(onStep).toHaveBeenCalledTimes(1);
    expect(onStep).toHaveBeenCalledWith(1);
    fireEvent.click(button, { detail: 1 });
    expect(onStep).toHaveBeenCalledTimes(1);
  });
});
