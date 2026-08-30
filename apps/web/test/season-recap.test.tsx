import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, renderHook, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import i18n from '../src/i18n/index.js';
import {
  SeasonRecap,
  seasonRecapShowsPrimaryAction,
  seasonRecapKey,
  seasonRecapSeen,
  useSeasonRecapOpening,
  type SeasonResult,
} from '../src/screens/SeasonRecap.js';

const result = (over: Partial<SeasonResult> = {}): SeasonResult => ({
  seasonId: 'season-86',
  accountId: 'account-7',
  finalRank: 2,
  dominion: 184,
  damageDealt: 12_450,
  damageTaken: 8_200,
  rivalName: 'Vantage',
  biggestRaid: 4_800,
  // Compatibility prose from D85 must not leak untranslated onto the surface.
  title: 'Vanguard',
  recap: {
    commanderName: 'İzci',
    planetName: 'Kestrel-12',
    battles: 9,
    attacks: 6,
    defences: 3,
    rival: { commanderName: 'Vantage', battles: 4 },
    biggestRaid: { value: 4_800, opponentName: 'Rook' },
  },
  createdAt: new Date('2026-08-22T18:00:00Z'),
  ...over,
});

afterEach(async () => {
  window.localStorage.clear();
  await i18n.changeLanguage('en');
});

describe('the personal season ending', () => {
  it('keeps Explore only during the frozen season afterglow, not over a live successor', () => {
    expect(seasonRecapShowsPrimaryAction({ status: 'live', result: null })).toBe(false);
    expect(seasonRecapShowsPrimaryAction({ status: 'frozen', result: result() })).toBe(true);
  });

  it('turns the final score into a record of real conflict', () => {
    render(<SeasonRecap result={result()} galaxy="Vantage" players={50} onClose={vi.fn()} />);

    expect(screen.getByRole('heading', { name: 'Vanguard' })).toBeInTheDocument();
    expect(screen.getByText('Rank 2 of 50')).toBeInTheDocument();
    expect(screen.getByText('+184')).toBeInTheDocument();
    expect(screen.getByText('Vantage · 4 battles')).toBeInTheDocument();
    expect(screen.getByText('4,800 taken from Rook')).toBeInTheDocument();
  });

  it('localises the visible title instead of printing stored English prose', async () => {
    await i18n.changeLanguage('tr');
    render(<SeasonRecap result={result()} galaxy="Vantage" players={50} onClose={vi.fn()} />);

    expect(screen.getByRole('heading', { name: 'Öncü' })).toBeInTheDocument();
    expect(screen.getByText('50 komutan arasında 2. sıra')).toBeInTheDocument();
    expect(screen.queryByText('Vanguard')).not.toBeInTheDocument();
  });

  it('does not invent a rival or a raid for a commander who never fought', () => {
    const quiet = result({
      finalRank: 41,
      dominion: 0,
      rivalName: null,
      biggestRaid: 0,
      recap: {
        commanderName: 'İzci',
        planetName: 'Kestrel-12',
        battles: 0,
        attacks: 0,
        defences: 0,
        rival: null,
        biggestRaid: null,
      },
    });
    render(<SeasonRecap result={quiet} galaxy="Vantage" players={50} onClose={vi.fn()} />);

    expect(screen.getByText('A quiet frontier')).toBeInTheDocument();
    expect(screen.queryByText('Your rival')).not.toBeInTheDocument();
    expect(screen.queryByText('Biggest raid')).not.toBeInTheDocument();
  });

  it('acknowledges this account and season only when the commander leaves the recap', async () => {
    const value = result();
    const onClose = vi.fn();
    render(<SeasonRecap result={value} galaxy="Vantage" players={50} onClose={onClose} />);

    expect(seasonRecapSeen(value)).toBe(false);
    await userEvent.setup().click(screen.getByRole('button', { name: 'Explore the final galaxy' }));
    expect(window.localStorage.getItem(seasonRecapKey(value))).toBe('seen');
    expect(seasonRecapSeen(value)).toBe(true);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('hides the galaxy action when this is a past record over an already-live new season', () => {
    render(
      <SeasonRecap
        result={result()}
        galaxy="Vantage"
        players={50}
        showPrimaryAction={false}
        onClose={vi.fn()}
      />,
    );

    expect(screen.queryByRole('button', { name: 'Explore the final galaxy' })).not.toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Close' })).toHaveLength(1);
  });

  it('gives the always-available close control a visible surface and keyboard focus state', () => {
    render(<SeasonRecap result={result()} galaxy="Vantage" players={50} onClose={vi.fn()} />);

    const close = screen.getByRole('button', { name: 'Close' });
    expect(close).toHaveClass('border-line', 'bg-raised', 'text-bone', 'focus-visible:ring-2');
  });

  it('opens once when the live season freezes and stays quiet after acknowledgement', async () => {
    const value = result();
    const onOpen = vi.fn();
    const { rerender } = renderHook(
      ({ status }) => {
        useSeasonRecapOpening(status, value, onOpen);
      },
      { initialProps: { status: 'live' } },
    );

    expect(onOpen).not.toHaveBeenCalled();
    rerender({ status: 'frozen' });
    await waitFor(() => {
      expect(onOpen).toHaveBeenCalledOnce();
    });
    rerender({ status: 'frozen' });
    expect(onOpen).toHaveBeenCalledOnce();

    window.localStorage.setItem(seasonRecapKey(value), 'seen');
    const seenOpen = vi.fn();
    renderHook(() => {
      useSeasonRecapOpening('frozen', value, seenOpen);
    });
    expect(seenOpen).not.toHaveBeenCalled();
  });
});
