import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DiscControls } from '../src/galaxy/DiscControls.js';
import i18n from '../src/i18n/index.js';

/**
 * THE FIVE MARKS ON THE DISC. Owner instruction, D163.
 *
 * Research, the clan and intel came out of the menu and onto the canvas, because a
 * menu is a place you go when you already know what you want and these are things a
 * commander DOES. A row of glyphs on the map is a thing you SEE; a row inside a
 * sheet behind a hamburger is a thing you have to be told about.
 *
 * D163 SPLIT THE PLANET GLYPH IN TWO, and that is the whole change here. It used to
 * open the worlds sheet, while "zoom in on the active planet" was a text button
 * INSIDE that sheet — so the most-used camera move in the game cost two taps and a
 * read, and the glyph that looks exactly like "go to my planet" did not do it. Now
 * the planet glyph IS that camera move, and the sheet it used to open — the
 * transfer sheet — has a mark of its own.
 *
 * THE FOUR EXISTING MARKS DO NOT MOVE. A control that changes position between
 * sessions has to be re-found every time, so the new one is appended rather than
 * inserted, and the order lives in this test as well as in the component.
 *
 * EACH ONE CARRIES ITS OWN SIGNAL. The clan glyph takes a dot when something is
 * waiting, which is the same badge language the menu row it replaced used, and the
 * only text on any of them is the accessible name.
 */

beforeEach(async () => {
  await i18n.changeLanguage('en');
});

const show = (over: Partial<Parameters<typeof DiscControls>[0]> = {}) => render(
  <DiscControls
    onOpenResearch={vi.fn()}
    onOpenClan={vi.fn()}
    onOpenIntel={vi.fn()}
    onGoHome={vi.fn()}
    onOpenTransfer={vi.fn()}
    clanAvailable
    clanWaiting={0}
    {...over}
  />,
);

describe('the controls on the disc', () => {
  it('offers research, the planet, intel, the clan and the transfer in one grid', () => {
    show();
    expect(screen.getByRole('button', { name: /research/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /clan/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /active planet/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /intel/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /transfer/i })).toBeInTheDocument();
    expect(document.querySelector('[data-disc-controls]')).toHaveClass('grid-cols-2');
    expect(document.querySelectorAll('[data-disc-control]')).toHaveLength(5);
  });

  it('puts them in that order, and leaves the first four where they were', () => {
    const view = show();
    const marks = [...view.container.querySelectorAll('[data-disc-control]')]
      .map((element) => element.getAttribute('data-disc-control'));
    expect(marks).toEqual(['research', 'home', 'intel', 'clan', 'transfer']);
  });

  it('fires each one', async () => {
    const onOpenResearch = vi.fn();
    const onOpenClan = vi.fn();
    const onGoHome = vi.fn();
    const onOpenIntel = vi.fn();
    const onOpenTransfer = vi.fn();
    show({ onOpenResearch, onOpenClan, onOpenIntel, onGoHome, onOpenTransfer });

    await userEvent.click(screen.getByRole('button', { name: /research/i }));
    await userEvent.click(screen.getByRole('button', { name: /clan/i }));
    await userEvent.click(screen.getByRole('button', { name: /active planet/i }));
    await userEvent.click(screen.getByRole('button', { name: /intel/i }));
    await userEvent.click(screen.getByRole('button', { name: /transfer/i }));

    expect(onOpenResearch).toHaveBeenCalledOnce();
    expect(onOpenClan).toHaveBeenCalledOnce();
    expect(onGoHome).toHaveBeenCalledOnce();
    expect(onOpenIntel).toHaveBeenCalledOnce();
    expect(onOpenTransfer).toHaveBeenCalledOnce();
  });

  /**
   * A COMMANDER WITH ONE WORLD HAS NOWHERE TO TRANSFER TO, so the mark is drawn in
   * its place and disabled rather than appearing later — a grid that changes shape
   * once a colony is founded is a grid the hand has to learn twice.
   */
  it('disables the transfer mark for a commander with a single world', () => {
    show({ canTransfer: false });
    expect(screen.getByRole('button', { name: /transfer/i })).toBeDisabled();
    expect(document.querySelectorAll('[data-disc-control]')).toHaveLength(5);
  });

  /** The geometry stays stable on a legacy season, but its clan door cannot fire. */
  it('keeps an unavailable clan in its grid position and disables it', () => {
    show({ clanAvailable: false });
    expect(screen.getByRole('button', { name: /clan/i })).toBeDisabled();
    expect(document.querySelectorAll('[data-disc-control]')).toHaveLength(5);
  });

  it('marks the clan glyph when something is waiting', () => {
    const view = show({ clanWaiting: 3 });
    expect(view.container.querySelector('[data-disc-control="clan"] [data-waiting]'))
      .toBeInTheDocument();
  });

  it('leaves the glyph unmarked when nothing is', () => {
    const view = show({ clanWaiting: 0 });
    expect(view.container.querySelector('[data-disc-control="clan"] [data-waiting]')).toBeNull();
  });

  /** A mark is a picture; the words exist for a screen reader, not on the map. */
  it('shows no visible label on the disc', () => {
    const view = show();
    expect(view.container.textContent.trim()).toBe('');
  });
});
