import { useState } from 'react';
import { flushSync } from 'react-dom';
import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { dragStep, nextDetent } from '../../src/lib/sheet.js';
import { Sheet } from '../../src/v2/kit/Sheet.js';
import { Sheet as OldSheet } from '../../src/ui/kit/Sheet.js';

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
  /**
   * A PAGE THAT HEADS ITSELF (M4, the report's hero): the title stays the dialog's name
   * and the header's words stay for a reader, but nothing is drawn twice — the close floats.
   */
  it('keeps its name for a reader when the page draws its own heading', () => {
    render(<Sheet title="Partial victory" eyebrow="Raided Sable" quietTitle onClose={vi.fn()}>body</Sheet>);
    const dialog = screen.getByRole('dialog', { name: 'Partial victory' });
    expect(dialog.querySelector('header h2')).toHaveClass('sr-only');
    expect(dialog.querySelector('header p')).toHaveClass('sr-only');
    expect(screen.getByRole('button', { name: /close/i })).toBeVisible();
  });

  /**
   * THE TOP BAR STAYS ABOVE EVERY PAGE (M5, the mocks): the purse and the bell are read
   * while a page is open, so a page runs from under the top bar (`--v2-top-h`, which the
   * shell publishes) down to the dock, and a full page fills that and no more.
   */
  it('stands under the top bar, and a full page fills only the room below it', () => {
    render(<Sheet title="Fleet" detents={['full']} onClose={vi.fn()}>body</Sheet>);
    const dialog = screen.getByRole('dialog', { name: 'Fleet' });
    expect(dialog.parentElement!.style.top).toBe('var(--v2-top-h, 0px)');
    expect(dialog).toHaveClass('h-full');
    expect(dialog.className).not.toMatch(/h-\[92dvh\]/);
  });

  /** The return story's card (M4): in the middle at every width, and with no handle to pull. */
  it('stands a card in the middle, with nothing to pull', () => {
    render(<Sheet title="While you were away" detents={['fit']} placement="card" onClose={vi.fn()}>body</Sheet>);
    expect(screen.getByRole('dialog', { name: 'While you were away' })).toHaveAttribute('data-placement', 'card');
    expect(screen.queryByRole('button', { name: /expand|collapse/i })).toBeNull();
  });

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
    // The browser's click at the end of a pointer gesture carries `detail` 1.
    fireEvent.click(handle, { detail: 1 });
    expect(screen.getByRole('dialog')).toHaveAttribute('data-detent', 'half');
    fireEvent.click(handle, { detail: 1 });
    expect(screen.getByRole('dialog')).toHaveAttribute('data-detent', 'full');
  });

  it('still answers the handle after a pull that began on the title', async () => {
    render(<Sheet title="Kestrel" onClose={vi.fn()} detents={['peek', 'half', 'full']}>body</Sheet>);
    drag(screen.getByRole('heading', { name: 'Kestrel' }), 600, 500);
    expect(screen.getByRole('dialog')).toHaveAttribute('data-detent', 'half');
    await userEvent.click(screen.getByRole('button', { name: 'Expand' }));
    expect(screen.getByRole('dialog')).toHaveAttribute('data-detent', 'full');
  });

  it('never swallows a keyboard press on the handle', () => {
    render(<Sheet title="Kestrel" onClose={vi.fn()} detents={['peek', 'half', 'full']}>body</Sheet>);
    drag(screen.getByRole('heading', { name: 'Kestrel' }), 600, 500);
    // Enter on a focused button is a click with no pointer behind it (`detail` 0).
    fireEvent.click(screen.getByRole('button', { name: 'Expand' }), { detail: 0 });
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

  /**
   * ONE ESCAPE, ONE SHEET. An item sheet opened over the Base page closed the page
   * with it: every open sheet heard the same key. Only the one on top answers —
   * whichever kit drew it (the fault sheet is still the old one).
   */
  it('closes only the sheet on top on Escape', () => {
    const page = vi.fn();
    const item = vi.fn();
    const fault = vi.fn();
    const { rerender } = render(
      <Sheet title="Base" onClose={page}>
        <Sheet title="Refinery" detents={['fit']} onClose={item}>body</Sheet>
      </Sheet>,
    );
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(item).toHaveBeenCalledOnce();
    expect(page).not.toHaveBeenCalled();

    rerender(
      <Sheet title="Base" onClose={page}>
        <OldSheet title="Refinery outage" onClose={fault}>body</OldSheet>
      </Sheet>,
    );
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(fault).toHaveBeenCalledOnce();
    expect(page).not.toHaveBeenCalled();
  });

  /**
   * The race seen on the phone: the top sheet's listener ran first, React removed it
   * before the next listener ran, and the page below then found itself on top.
   */
  it('does not let the sheet below take the same Escape once the top one is gone', () => {
    const page = vi.fn();
    function Nested() {
      const [open, setOpen] = useState(true);
      return (
        <Sheet title="Base" onClose={page}>
          {open && (
            <Sheet title="Refinery" detents={['fit']} onClose={() => { flushSync(() => { setOpen(false); }); }}>
              body
            </Sheet>
          )}
        </Sheet>
      );
    }
    render(<Nested />);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: 'Refinery' })).toBeNull();
    expect(page).not.toHaveBeenCalled();
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

  /**
   * AS TALL AS WHAT IT HOLDS (owner, 2026-09-24): "Content kadar açılabilir, eğer content
   * sığmazsa sonuna kadar açılır ve scrollable olur." A fit sheet never stands taller than
   * its content, never taller than a page, and scrolls what does not fit; it is modal.
   */
  it('stands as tall as its content at fit, up to a page, and scrolls the rest', () => {
    render(<Sheet title="Refinery" onClose={vi.fn()} detents={['fit']}>body</Sheet>);
    const panel = screen.getByRole('dialog', { name: 'Refinery' });
    expect(panel).toHaveAttribute('data-detent', 'fit');
    // Up to a page: the room under the top bar (M5), never over it.
    expect(panel).toHaveClass('max-h-full');
    expect(panel.className).not.toMatch(/(^|\s)h-\[92dvh\]/);
    expect(panel).toHaveAttribute('aria-modal', 'true');
    expect(document.querySelector('[data-sheet-body]')).toHaveClass('overflow-y-auto');
  });

  it('lets a contained body own its own scrolling', () => {
    const { container, rerender } = render(<Sheet title="Kestrel" onClose={vi.fn()}>body</Sheet>);
    expect(container.querySelector('[data-sheet-body]')).toHaveClass('overflow-y-auto');
    rerender(<Sheet title="Kestrel" onClose={vi.fn()} contained>body</Sheet>);
    expect(container.querySelector('[data-sheet-body]')).toHaveClass('overflow-hidden');
    expect(container.querySelector('[data-sheet-body]')).not.toHaveClass('overflow-y-auto');
  });

  it('offers a way back when it was opened from another surface', async () => {
    const onBack = vi.fn();
    render(<Sheet title="Kestrel" onClose={vi.fn()} onBack={onBack}>body</Sheet>);
    await userEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});

/**
 * E11 · K10: FROM 700 PX, "PAGES IN THE RIGHT COLUMN OR IN THE MIDDLE, 720 PX AT MOST".
 * A page (a tab's, the Fleet, the bell) is a column on the right with the galaxy live
 * beside it; a dialog (an item, a build, the return story) stands in the middle over
 * the dim. Layout itself is CSS; what is held here is which one a sheet is.
 */
describe('the sheet on a wide screen', () => {
  it('is a page, unless it only ever fits its content — then it is a dialog', () => {
    const { unmount } = render(<Sheet title="Fleet" onClose={vi.fn()} detents={['full']}>body</Sheet>);
    expect(screen.getByRole('dialog', { name: 'Fleet' })).toHaveAttribute('data-placement', 'page');
    unmount();
    render(<Sheet title="Refinery" onClose={vi.fn()} detents={['fit']}>body</Sheet>);
    expect(screen.getByRole('dialog', { name: 'Refinery' })).toHaveAttribute('data-placement', 'dialog');
  });

  it('lets a page that fits its content on a phone say it is a page (Intel, Clan)', () => {
    render(<Sheet title="Intel" onClose={vi.fn()} detents={['fit']} placement="page">body</Sheet>);
    expect(screen.getByRole('dialog', { name: 'Intel' })).toHaveAttribute('data-placement', 'page');
  });

  it('lets the galaxy beside a page stay live, and keeps the dim behind a dialog', () => {
    const { container, unmount } = render(<Sheet title="Fleet" onClose={vi.fn()} detents={['full']}>body</Sheet>);
    expect(container.querySelector('[data-scrim]')).toHaveClass('v2-split:hidden');
    unmount();
    const dialog = render(<Sheet title="Refinery" onClose={vi.fn()} detents={['fit']}>body</Sheet>);
    expect(dialog.container.querySelector('[data-scrim]')).not.toHaveClass('v2-split:hidden');
  });
});
