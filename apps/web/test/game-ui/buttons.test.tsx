import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GameButton, GameHold } from '../../src/game-ui/index.js';
import { HOLD_MS } from '../../src/v2/kit/useHoldPress.js';

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); });

const press = (element: HTMLElement): void => {
  fireEvent.pointerDown(element, { button: 0 });
  fireEvent.pointerUp(element);
  fireEvent.click(element, { detail: 1 });
};

describe('the game button', () => {
  it('answers a press that began on it', () => {
    const onPress = vi.fn();
    render(<GameButton onPress={onPress}>Upgrade</GameButton>);
    press(screen.getByRole('button', { name: /Upgrade/ }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('says why it cannot be pressed instead of doing nothing', () => {
    const onPress = vi.fn();
    render(<GameButton onPress={onPress} disabledReason="Needs 1,200 alloy">Upgrade</GameButton>);
    const button = screen.getByRole('button', { name: /Needs 1,200 alloy/ });
    expect(button).toBeDisabled();
    press(button);
    expect(onPress).not.toHaveBeenCalled();
  });

  it('is busy, not pressable, while its action is pending', () => {
    const onPress = vi.fn();
    render(<GameButton onPress={onPress} pending>Upgrade</GameButton>);
    const button = screen.getByRole('button', { name: /Upgrade/ });
    expect(button).toHaveAttribute('aria-busy', 'true');
    press(button);
    expect(onPress).not.toHaveBeenCalled();
  });
});

describe('the hold action', () => {
  it('commits after a held press and shows its detail', () => {
    const onCommit = vi.fn();
    render(<GameHold label="Attack" detail="39 ships" onCommit={onCommit} />);
    const button = screen.getByRole('button', { name: /Attack/ });
    expect(button).toHaveTextContent('39 ships');
    fireEvent.pointerDown(button, { button: 0 });
    act(() => { vi.advanceTimersByTime(HOLD_MS); });
    expect(onCommit).toHaveBeenCalledTimes(1);
  });

  it.each([
    // owner 2026-11-12, standard 2.6: what can be undone 0.6 s, what spends 1 s, what is final 1.5 s
    ['reversible', 600], ['spends', 1000], ['final', 1500],
  ] as const)('holds a %s action for %i ms', (weight, ms) => {
    const onCommit = vi.fn();
    render(<GameHold label="Leave" detail="cannot be undone" weight={weight} onCommit={onCommit} />);
    const button = screen.getByRole('button', { name: /Leave/ });
    expect(button.style.getPropertyValue('--gk-hold-ms')).toBe(`${String(ms)}ms`);
    fireEvent.pointerDown(button, { button: 0 });
    act(() => { vi.advanceTimersByTime(ms - 1); });
    expect(onCommit).not.toHaveBeenCalled();
    act(() => { vi.advanceTimersByTime(1); });
    expect(onCommit).toHaveBeenCalledTimes(1);
  });

  it('holds for the lightest weight when none is named, as the v2 hold button does', () => {
    render(<GameHold label="Attack" onCommit={() => undefined} />);
    expect(screen.getByRole('button', { name: /Attack/ }).style.getPropertyValue('--gk-hold-ms')).toBe(`${String(HOLD_MS)}ms`);
  });

  it('commits nothing on a tap and refuses with a reason', () => {
    const onCommit = vi.fn();
    const { rerender } = render(<GameHold label="Attack" detail="39 ships" onCommit={onCommit} />);
    press(screen.getByRole('button', { name: /Attack/ }));
    expect(onCommit).not.toHaveBeenCalled();
    rerender(<GameHold label="Attack" detail="39 ships" onCommit={onCommit} disabledReason="No free flight bay" />);
    expect(screen.getByRole('button', { name: /No free flight bay/ })).toBeDisabled();
  });
});
