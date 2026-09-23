import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { dragStep, nextDetent } from '../../src/lib/sheet.js';
import { Sheet } from '../../src/v2/kit/Sheet.js';

/**
 * THE SHEET THAT OPENS OVER THE GALAXY. Spec B3/gestures (docs/ui-v2/gozlemevi.md).
 *
 * Three heights: peek (≤140 px, the context card), half (55%), full (92%). Pull up
 * or tap the handle to open it further, pull down to settle it, and pulling down
 * from its lowest height closes it. The galaxy never unmounts under it, and at
 * peek it is not even dimmed: the card sits beside the world, not over it.
 */

/** jsdom has no PointerEvent; a MouseEvent under the pointer type carries `clientY` the same way. */
const drag = (el: Element, from: number, to: number): void => {
  act(() => {
    el.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, clientY: from }));
    el.dispatchEvent(new MouseEvent('pointerup', { bubbles: true, clientY: to }));
  });
};

describe('where a sheet settles', () => {
  const ALL = ['peek', 'half', 'full'] as const;

  it('steps up one height at a time and stops at the top', () => {
    expect(nextDetent(ALL, 'peek', 'up')).toBe('half');
    expect(nextDetent(ALL, 'half', 'up')).toBe('full');
    expect(nextDetent(ALL, 'full', 'up')).toBe('full');
  });

  it('steps down, and closes below its lowest height', () => {
    expect(nextDetent(ALL, 'full', 'down')).toBe('half');
    expect(nextDetent(ALL, 'half', 'down')).toBe('peek');
    expect(nextDetent(ALL, 'peek', 'down')).toBeNull();
    expect(nextDetent(['half', 'full'], 'half', 'down')).toBeNull();
  });

  it('reads a pull by its distance, not by a twitch', () => {
    expect(dragStep(-60)).toBe('up');
    expect(dragStep(60)).toBe('down');
    expect(dragStep(-20)).toBeNull();
    expect(dragStep(20)).toBeNull();
  });
});

describe('the sheet', () => {
  it('opens at its first height and names itself', () => {
    render(<Sheet title="Kestrel" onClose={vi.fn()} detents={['peek', 'half', 'full']}>body</Sheet>);
    const dialog = screen.getByRole('dialog', { name: 'Kestrel' });
    expect(dialog).toHaveAttribute('data-detent', 'peek');
  });

  it('opens further on a tap of the handle, and comes back down from the top', async () => {
    const onDetentChange = vi.fn();
    render(
      <Sheet title="Kestrel" onClose={vi.fn()} detents={['peek', 'half', 'full']} onDetentChange={onDetentChange}>
        body
      </Sheet>,
    );
    const handle = screen.getByRole('button', { name: 'Expand' });
    await userEvent.click(handle);
    expect(screen.getByRole('dialog')).toHaveAttribute('data-detent', 'half');
    await userEvent.click(handle);
    expect(screen.getByRole('dialog')).toHaveAttribute('data-detent', 'full');
    expect(screen.getByRole('button', { name: 'Collapse' })).toBe(handle);
    await userEvent.click(handle);
    expect(screen.getByRole('dialog')).toHaveAttribute('data-detent', 'half');
    expect(onDetentChange.mock.calls.map(([detent]) => detent as string)).toEqual(['half', 'full', 'half']);
  });

  it('follows a pull on the handle', () => {
    render(<Sheet title="Kestrel" onClose={vi.fn()} detents={['peek', 'half', 'full']}>body</Sheet>);
    const handle = screen.getByRole('button', { name: 'Expand' });
    drag(handle, 600, 500);
    expect(screen.getByRole('dialog')).toHaveAttribute('data-detent', 'half');
    drag(handle, 400, 390);
    expect(screen.getByRole('dialog')).toHaveAttribute('data-detent', 'half');
    drag(handle, 400, 480);
    expect(screen.getByRole('dialog')).toHaveAttribute('data-detent', 'peek');
  });

  it('does not count the click at the end of a pull as a second step', () => {
    render(<Sheet title="Kestrel" onClose={vi.fn()} detents={['peek', 'half', 'full']}>body</Sheet>);
    const handle = screen.getByRole('button', { name: 'Expand' });
    drag(handle, 600, 500);
    fireEvent.click(handle);
    expect(screen.getByRole('dialog')).toHaveAttribute('data-detent', 'half');
    fireEvent.click(handle);
    expect(screen.getByRole('dialog')).toHaveAttribute('data-detent', 'full');
  });

  it('closes when pulled down from its lowest height', () => {
    const onClose = vi.fn();
    render(<Sheet title="Kestrel" onClose={onClose}>body</Sheet>);
    drag(screen.getByRole('button', { name: 'Expand' }), 300, 400);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes on its close control and on Escape', async () => {
    const onClose = vi.fn();
    render(<Sheet title="Kestrel" onClose={onClose}>body</Sheet>);
    await userEvent.click(screen.getByRole('button', { name: 'Close' }));
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('leaves the galaxy undimmed and live at peek, and dims it above', async () => {
    const { container } = render(
      <Sheet title="Kestrel" onClose={vi.fn()} detents={['peek', 'half']}>body</Sheet>,
    );
    expect(container.querySelector('[data-scrim]')).toBeNull();
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-modal', 'false');
    await userEvent.click(screen.getByRole('button', { name: 'Expand' }));
    expect(container.querySelector('[data-scrim]')).not.toBeNull();
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-modal', 'true');
  });

  it('closes on a tap of the dim that began there', () => {
    const onClose = vi.fn();
    const { container } = render(<Sheet title="Kestrel" onClose={onClose}>body</Sheet>);
    const scrim = container.querySelector('[data-scrim]');
    if (!scrim) throw new Error('no scrim');
    // The tail of the tap that opened the sheet lands here; it did not begin here.
    fireEvent.click(scrim, { detail: 1 });
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.pointerDown(scrim);
    fireEvent.click(scrim, { detail: 1 });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('tells its content how open it is', async () => {
    render(
      <Sheet title="Kestrel" onClose={vi.fn()} detents={['peek', 'half']}>
        {(detent) => <p>{detent === 'peek' ? 'card' : 'dossier'}</p>}
      </Sheet>,
    );
    expect(screen.getByText('card')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Expand' }));
    expect(screen.getByText('dossier')).toBeInTheDocument();
  });

  it('offers a way back when it was opened from another surface', async () => {
    const onBack = vi.fn();
    render(<Sheet title="Kestrel" onClose={vi.fn()} onBack={onBack}>body</Sheet>);
    await userEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});
