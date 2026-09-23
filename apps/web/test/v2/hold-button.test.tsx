import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HOLD_MS, HoldButton } from '../../src/v2/kit/HoldButton.js';

/**
 * PRESS AND HOLD TO SPEND. Spec B9 (docs/ui-v2/gozlemevi.md), decision K4.
 *
 * A launch spends fuel the moment it leaves, and a tap on a small target sent fleets
 * nobody meant to send. Holding for 0.6 s is one gesture that cannot happen by
 * accident, and it replaces a second confirmation sheet. The press has to begin on
 * the button (the ghost-click rule `useOwnPress` exists for), a keyboard can hold
 * Space, and Enter turns the button into an inline two-step confirm for anyone who
 * cannot hold.
 */

const setup = (props: Partial<Parameters<typeof HoldButton>[0]> = {}) => {
  const onCommit = vi.fn();
  render(<HoldButton label="Launch 74 ships" onCommit={onCommit} {...props} />);
  return { onCommit, button: screen.getByRole('button') };
};

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); });

describe('the hold-to-commit button', () => {
  it('commits only after an unbroken hold', () => {
    const { onCommit, button } = setup();
    fireEvent.pointerDown(button, { button: 0 });
    act(() => { vi.advanceTimersByTime(HOLD_MS - 1); });
    expect(onCommit).not.toHaveBeenCalled();
    act(() => { vi.advanceTimersByTime(1); });
    expect(onCommit).toHaveBeenCalledTimes(1);
  });

  it('shows the hold filling while it is held', () => {
    const { button } = setup();
    fireEvent.pointerDown(button, { button: 0 });
    expect(button).toHaveAttribute('data-holding');
    fireEvent.pointerUp(button);
    expect(button).not.toHaveAttribute('data-holding');
  });

  it('cancels when released early', () => {
    const { onCommit, button } = setup();
    fireEvent.pointerDown(button, { button: 0 });
    act(() => { vi.advanceTimersByTime(HOLD_MS / 2); });
    fireEvent.pointerUp(button);
    act(() => { vi.advanceTimersByTime(HOLD_MS * 2); });
    expect(onCommit).not.toHaveBeenCalled();
  });

  /**
   * A TAP IS NOT A HOLD, AND THE BUTTON SAYS SO. Seen on the gallery: nothing on
   * the face told a player to hold, so a tap would simply do nothing. The ring on
   * the face says it before; a release that came too soon says it after.
   */
  it('shows a ring on its face that fills with the hold', () => {
    const { button } = setup();
    expect(button.querySelector('[data-hold-ring]')).not.toBeNull();
  });

  it('tells a player who let go too soon to hold, then goes back to its label', () => {
    const { button } = setup();
    fireEvent.pointerDown(button, { button: 0 });
    act(() => { vi.advanceTimersByTime(150); });
    fireEvent.pointerUp(button);
    expect(button).toHaveTextContent('Hold to confirm');
    act(() => { vi.advanceTimersByTime(2_000); });
    expect(button).toHaveTextContent('Launch 74 ships');
  });

  it('says nothing after a hold that went through', () => {
    const { button } = setup();
    fireEvent.pointerDown(button, { button: 0 });
    act(() => { vi.advanceTimersByTime(HOLD_MS); });
    fireEvent.pointerUp(button);
    expect(button).toHaveTextContent('Launch 74 ships');
  });

  it('cancels when the finger slides off', () => {
    const { onCommit, button } = setup();
    fireEvent.pointerDown(button, { button: 0 });
    fireEvent.pointerLeave(button);
    act(() => { vi.advanceTimersByTime(HOLD_MS * 2); });
    expect(onCommit).not.toHaveBeenCalled();
  });

  it('ignores a click that did not begin on it', () => {
    const { onCommit, button } = setup();
    fireEvent.click(button, { detail: 1 });
    act(() => { vi.advanceTimersByTime(HOLD_MS * 2); });
    expect(onCommit).not.toHaveBeenCalled();
  });

  it('can be held with the space bar', () => {
    const { onCommit, button } = setup();
    fireEvent.keyDown(button, { key: ' ' });
    act(() => { vi.advanceTimersByTime(HOLD_MS); });
    expect(onCommit).toHaveBeenCalledTimes(1);
  });

  it('cancels a space hold released early', () => {
    const { onCommit, button } = setup();
    fireEvent.keyDown(button, { key: ' ' });
    act(() => { vi.advanceTimersByTime(HOLD_MS / 2); });
    fireEvent.keyUp(button, { key: ' ' });
    act(() => { vi.advanceTimersByTime(HOLD_MS); });
    expect(onCommit).not.toHaveBeenCalled();
  });

  it('turns Enter into an inline two-step confirm', () => {
    const { onCommit, button } = setup();
    fireEvent.keyDown(button, { key: 'Enter' });
    expect(onCommit).not.toHaveBeenCalled();
    expect(button).toHaveTextContent('Launch 74 ships · sure?');
    fireEvent.keyDown(button, { key: 'Enter' });
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(button).toHaveTextContent('Launch 74 ships');
  });

  it('forgets an unanswered confirm', () => {
    const { onCommit, button } = setup();
    fireEvent.keyDown(button, { key: 'Enter' });
    act(() => { vi.advanceTimersByTime(4_000); });
    expect(button).not.toHaveTextContent('sure?');
    fireEvent.keyDown(button, { key: 'Enter' });
    expect(onCommit).not.toHaveBeenCalled();
  });

  it('commits only once however long it is held', () => {
    const { onCommit, button } = setup();
    fireEvent.pointerDown(button, { button: 0 });
    act(() => { vi.advanceTimersByTime(HOLD_MS * 5); });
    expect(onCommit).toHaveBeenCalledTimes(1);
  });

  it('prints the reason instead of arming when it cannot commit', () => {
    const { onCommit, button } = setup({ disabledReason: 'Shielded for 4h' });
    expect(button).toBeDisabled();
    expect(button).toHaveTextContent('Shielded for 4h');
    fireEvent.pointerDown(button, { button: 0 });
    act(() => { vi.advanceTimersByTime(HOLD_MS * 2); });
    expect(onCommit).not.toHaveBeenCalled();
  });

  it('tells a screen reader how to use it', () => {
    const { button } = setup();
    expect(button).toHaveAccessibleDescription('Press and hold, or press Enter twice to confirm');
  });
});
