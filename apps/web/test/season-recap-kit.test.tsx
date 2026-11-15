import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { playSound } from '../src/lib/sound.js';
import type * as Sound from '../src/lib/sound.js';
import { SeasonRecap, type SeasonResult } from '../src/screens/SeasonRecap.js';
import { NextSeason } from '../src/ui/NextSeason.js';

/**
 * C18 (2026-11-15): the season's last screen and the wait for the next galaxy, on the game kit.
 * Which title, rank and story a commander is given is unchanged; only how the moment lands.
 */
vi.mock('../src/lib/sound.js', async (load) => ({ ...await load<typeof Sound>(), playSound: vi.fn() }));

const result = (over: Partial<SeasonResult> = {}): SeasonResult => ({
  seasonId: 'season-86', accountId: 'account-7', finalRank: 7, dominion: 184, damageDealt: 12_450, damageTaken: 8_200,
  rivalName: 'Vantage', biggestRaid: 4_800, title: 'Commander',
  recap: {
    commanderName: 'İzci', planetName: 'Kestrel-12', battles: 9, attacks: 6, defences: 3,
    rival: { commanderName: 'Vantage', battles: 4 }, biggestRaid: { value: 4_800, opponentName: 'Rook' },
    clan: { tag: 'NOVA', name: 'Nova Pact', finalRank: 3, dominion: 900, topThree: true },
  },
  createdAt: new Date('2026-08-22T18:00:00Z'),
  ...over,
});
afterEach(() => { window.localStorage.clear(); vi.mocked(playSound).mockClear(); });

/** Nothing of the old plate language is left: the screen is drawn by the kit alone. */
const noLegacy = (node: Element) => {
  for (const el of [node, ...node.querySelectorAll('*')]) {
    expect(el.getAttribute('class') ?? '').not.toMatch(/\bplate\b|\blegend\b|\bslab\b|\breadout\b|\bsocket\b|\bchip\b|text-bone|text-dim|text-faint|text-crystal|bg-raised|bg-void|rounded-control|text-v2-|border-v2-/);
  }
};

describe('the season recap on the kit (C18)', () => {
  it('draws the whole record with the kit: a round close, the title as display type, the figures in wells', () => {
    render(<SeasonRecap result={result()} galaxy="Vantage" players={50} onClose={vi.fn()} />);
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveClass('gk');
    expect(screen.getByRole('button', { name: 'Close' })).toHaveClass('gk-round');
    expect(screen.getByRole('heading', { level: 1 })).toHaveClass('gk-display');
    expect(dialog.querySelectorAll('[data-recap-figures] .gk-num')).toHaveLength(3);
    noLegacy(dialog);
  });

  it('leaves on the screen’s one orange move, and remembers it was read', () => {
    const onClose = vi.fn();
    const value = result();
    render(<SeasonRecap result={value} galaxy="Vantage" onClose={onClose} />);
    const explore = screen.getByRole('button', { name: 'Explore the final galaxy' });
    expect(explore).toHaveClass('gk-btn', 'gk-btn--action');
    fireEvent.click(explore);
    expect(onClose).toHaveBeenCalledOnce();
    expect(window.localStorage.getItem(`astera:season-recap:${value.accountId}:${value.seasonId}`)).toBe('seen');
  });

  it('lights a podium place with rays and the rank-up sound, once', () => {
    const { rerender } = render(<SeasonRecap result={result({ finalRank: 2 })} galaxy="Vantage" onClose={vi.fn()} />);
    expect(document.querySelector('.gk-recap .gk-rays')).not.toBeNull();
    rerender(<SeasonRecap result={result({ finalRank: 2 })} galaxy="Vantage" onClose={vi.fn()} />);
    expect(vi.mocked(playSound).mock.calls.filter(([cue]) => cue === 'rankup')).toHaveLength(1);
  });

  it('keeps a seventh place without rays, and answers it with a quieter sound', () => {
    render(<SeasonRecap result={result()} galaxy="Vantage" onClose={vi.fn()} />);
    expect(document.querySelector('.gk-recap .gk-rays')).toBeNull();
    expect(vi.mocked(playSound)).not.toHaveBeenCalledWith('rankup');
  });

  it('wears the clan’s place as an emblem and a podium seal', () => {
    render(<SeasonRecap result={result()} galaxy="Vantage" onClose={vi.fn()} />);
    const clan = screen.getByRole('region', { name: 'Your clan record' });
    expect(clan.querySelector('.gk-emblem-tile')).not.toBeNull();
    expect(clan).toHaveTextContent('#3');
  });
});

describe('the wait for the next galaxy on the kit (C18)', () => {
  it('is a kit banner that says how long, and why', () => {
    render(<NextSeason endsAt={new Date(Date.now() - 60_000)} />);
    const status = screen.getByRole('status');
    expect(status).toHaveClass('gk-banner');
    expect(status).toHaveTextContent(/frozen/i);
    noLegacy(status);
  });
});
