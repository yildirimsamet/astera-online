import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Sheet } from '../src/ui/kit/index.js';

/**
 * A DISMISS CONTROL ANSWERS ONLY THE GESTURE THAT BEGAN ON IT.
 *
 * Tapping a world on the disc opened the planet sheet and it shut itself again —
 * on a phone first, then on a desktop as the machine got faster. The trace:
 *
 *     pointerdown → canvas          the finger lands on the world
 *     pointerup   → canvas
 *     SHEET OPEN                    React mounts the sheet ~98ms later
 *     touchend    → canvas
 *     click       → button[scrim]   the browser dispatches the tap's click NOW,
 *     sheet gone                    and the scrim is what is under the finger
 *
 * A synthesised click goes to whatever occupies the point at DISPATCH time, so the
 * scrim was closing a sheet on the tail of the gesture that asked for it. Opening
 * the same sheet from a DOM control never failed, because there the click is
 * consumed by the button that was pressed.
 *
 * The first case below is the regression. The rest are the behaviour it must not
 * have cost: the scrim still dismisses, and so do the glyph and Escape.
 */
const show = (onClose: () => void) =>
  render(<Sheet title="Your planet" onClose={onClose}>Body</Sheet>);

const scrimOf = (view: ReturnType<typeof render>): HTMLElement => {
  const scrim = view.container.querySelector<HTMLElement>('button[aria-hidden="true"]');
  if (!scrim) throw new Error('no scrim');
  return scrim;
};

describe('the sheet survives the gesture that opened it', () => {
  it('ignores a click whose press landed somewhere else', () => {
    const onClose = vi.fn();
    const view = show(onClose);
    // Exactly what the browser does after a tap on the canvas: no pointerdown on
    // the scrim, because the scrim did not exist when the finger went down.
    // `detail: 1` marks it as a POINTER click — jsdom defaults to 0, which is the
    // keyboard signature the guard is supposed to let through.
    fireEvent.click(scrimOf(view), { detail: 1 });
    expect(onClose).not.toHaveBeenCalled();
  });

  it('still dismisses when the press begins on the scrim', () => {
    const onClose = vi.fn();
    const view = show(onClose);
    const scrim = scrimOf(view);
    fireEvent.pointerDown(scrim);
    fireEvent.click(scrim, { detail: 1 });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not leave the scrim armed for a later stray click', () => {
    const onClose = vi.fn();
    const view = show(onClose);
    const scrim = scrimOf(view);
    fireEvent.pointerDown(scrim);
    fireEvent.click(scrim, { detail: 1 });
    // A second click with no fresh press — the next tap-through from anywhere.
    fireEvent.click(scrim, { detail: 1 });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('keeps the glyph close, which is the deliberate way out', async () => {
    const onClose = vi.fn();
    show(onClose);
    await userEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('keeps Escape', () => {
    const onClose = vi.fn();
    show(onClose);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
