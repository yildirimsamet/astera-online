import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DiscControls } from '../src/galaxy/DiscControls.js';
import i18n from '../src/i18n/index.js';

/**
 * THE THREE WAYS OFF THE DISC, AS MARKS. Owner instruction.
 *
 * Research and the clan came out of the menu and onto the canvas beside the worlds
 * glyph, because a menu is a place you go when you already know what you want and
 * these are two of the four things a commander does. A row of glyphs on the map is
 * a thing you SEE; a row inside a sheet behind a hamburger is a thing you have to
 * be told about.
 *
 * ORDER IS LEFT TO RIGHT AND IT IS NOT ARBITRARY: research, then the clan, then
 * your worlds — furthest from the thumb to nearest, in the order of how often a
 * session reaches for them.
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
    onOpenWorlds={vi.fn()}
    clanAvailable
    clanWaiting={0}
    {...over}
  />,
);

describe('the controls on the disc', () => {
  it('offers research, the clan, intel and the worlds in a two-by-two grid', () => {
    show();
    expect(screen.getByRole('button', { name: /research/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /clan/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /worlds/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /intel/i })).toBeInTheDocument();
    expect(document.querySelector('[data-disc-controls]')).toHaveClass('grid-cols-2');
    expect(document.querySelectorAll('[data-disc-control]')).toHaveLength(4);
  });

  it('puts them in that order, left to right', () => {
    const view = show();
    const marks = [...view.container.querySelectorAll('[data-disc-control]')]
      .map((element) => element.getAttribute('data-disc-control'));
    expect(marks).toEqual(['research', 'worlds', 'intel', 'clan']);
  });

  it('opens each one', async () => {
    const onOpenResearch = vi.fn();
    const onOpenClan = vi.fn();
    const onOpenWorlds = vi.fn();
    const onOpenIntel = vi.fn();
    show({ onOpenResearch, onOpenClan, onOpenIntel, onOpenWorlds });

    await userEvent.click(screen.getByRole('button', { name: /research/i }));
    await userEvent.click(screen.getByRole('button', { name: /clan/i }));
    await userEvent.click(screen.getByRole('button', { name: /worlds/i }));
    await userEvent.click(screen.getByRole('button', { name: /intel/i }));

    expect(onOpenResearch).toHaveBeenCalledOnce();
    expect(onOpenClan).toHaveBeenCalledOnce();
    expect(onOpenWorlds).toHaveBeenCalledOnce();
    expect(onOpenIntel).toHaveBeenCalledOnce();
  });

  /** The four-mark geometry stays stable on a legacy season, but its clan door cannot fire. */
  it('keeps an unavailable clan in its grid position and disables it', () => {
    show({ clanAvailable: false });
    expect(screen.getByRole('button', { name: /clan/i })).toBeDisabled();
    expect(document.querySelectorAll('[data-disc-control]')).toHaveLength(4);
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
