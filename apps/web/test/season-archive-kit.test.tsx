import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Api } from '../src/api/client.js';
import { ApiProvider } from '../src/api/context.js';
import { keys } from '../src/api/keys.js';
import i18n from '../src/i18n/index.js';
import { SeasonArchiveScreen } from '../src/screens/SeasonArchiveScreen.js';

/**
 * C20 (2026-11-15): the season strip, a finished season's ladder and the galaxy's record on the
 * game kit. Which seasons are listed, how a past ladder sorts and what opens are unchanged.
 */
afterEach(async () => { await i18n.changeLanguage('en'); });

const seasonId = '11111111-1111-4111-8111-111111111111';
const at = new Date('2026-01-31T00:00:00.000Z');
const noLegacy = (node: Element) => {
  const own = [node, ...node.querySelectorAll('*')].filter((el) => !el.closest('[role="img"]'));
  for (const el of own) {
    expect(el.getAttribute('class') ?? '').not.toMatch(/text-v2-|border-v2-|bg-v2-|font-v2-ui|v2-segmented|(?<![\w-])(?:name|legend|plate|field|num)(?![\w-])|plate-cut|text-faint|text-bone|text-dim|text-crystal|text-micro|text-caption|text-label|bg-raised|bg-void|rail-soft/);
  }
};

const show = () => {
  const api = new Api({ fetch: vi.fn<typeof globalThis.fetch>() });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(keys.seasonArchive, { pages: [{ cycles: [{ ordinal: 11, startsAt: at, endsAt: at, status: 'frozen',
    galaxies: [{ seasonId, shard: 'EU-1', shardName: 'Vantage', status: 'frozen' }] }], nextCursor: null }], pageParams: [undefined] });
  client.setQueryData(keys.archivedLeaderboard(seasonId), {
    season: { seasonId, ordinal: 11, shard: 'EU-1', shardName: 'Vantage', status: 'frozen', startsAt: at, endsAt: at, closedAt: at, endReason: 'SCHEDULED_END' },
    record: { version: 1, champion: { commanderName: 'Ace', dominion: 420 }, clanPodium: [{ rank: 1, name: 'Nova Pact', tag: 'NOVA', dominion: 900 }],
      biggestBattle: null, sharpestDominionSwing: null, mostContestedWorld: { planetName: 'Tharsis', events: 14 } },
    ladder: [1, 2, 3, 4].map((rank) => ({ resultId: `22222222-2222-4222-8222-00000000000${String(rank)}`, rank, commanderName: rank === 1 ? 'Ace' : `Commander ${String(rank)}`,
      country: 'TR', dominion: 500 - rank * 50, title: 'Frontier Hand', self: rank === 2, reward: null })),
  });
  const Wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}><ApiProvider api={api}>{children}</ApiProvider></QueryClientProvider>;
  render(<Wrapper><SeasonArchiveScreen onFocusPlanet={vi.fn()} initialSeasonId={seasonId} /></Wrapper>);
};

describe('the season archive on the kit (C20)', () => {
  it('picks a season with kit chips on one strip', () => {
    show();
    const strip = screen.getByRole('navigation', { name: 'Season records' });
    const past = within(strip).getByRole('button', { name: /Season 11 · EU-1/ });
    expect(past).toHaveClass('gk-hit');
    expect(past).toHaveAttribute('aria-pressed', 'true');
  });

  it('draws a past ladder as kit ledger lines, each a door to the commander’s record', () => {
    show();
    const ladder = screen.getByRole('list', { name: 'Completed season leaderboard' });
    expect(ladder).toHaveClass('gk-ledger');
    const row = within(ladder).getByRole('button', { name: /Commander 3/ });
    expect(row).toHaveClass('gk-lb__row');
    const mine = within(ladder).getAllByRole('listitem').find((item) => item.getAttribute('aria-current') === 'true');
    expect(mine?.querySelector('[data-self]')).not.toBeNull();
  });

  it('keeps the galaxy record in a kit well and the page free of old utilities', () => {
    show();
    expect(screen.getByRole('region', { name: 'Galaxy Record' })).toHaveClass('gk-well');
    expect(screen.getByRole('searchbox')).toHaveClass('gk-field__input');
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'Ace' } });
    noLegacy(document.querySelector('[data-v2-season-archive]')!);
  });
});
