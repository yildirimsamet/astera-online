import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Api } from '../src/api/client.js';
import { ApiProvider } from '../src/api/context.js';
import { keys } from '../src/api/keys.js';
import i18n from '../src/i18n/index.js';
import { SeasonArchiveScreen } from '../src/screens/SeasonArchiveScreen.js';

/**
 * C21 (2026-11-15): a commander's season record and career on the game kit. What is
 * compared with what, which seasons a career lists and what opens are unchanged.
 */
afterEach(async () => { await i18n.changeLanguage('en'); });

const seasonId = '11111111-1111-4111-8111-111111111111';
const resultId = '22222222-2222-4222-8222-222222222222';
const at = new Date('2026-01-31T00:00:00.000Z');
const noLegacy = (node: Element) => {
  const own = [node, ...node.querySelectorAll('*')].filter((el) => !el.closest('[role="img"]'));
  for (const el of own) {
    expect(el.getAttribute('class') ?? '').not.toMatch(/text-v2-|border-v2-|bg-v2-|font-v2-ui|v2-segmented|(?<![\w-])(?:name|legend|plate|plate-sunk|headline|field|num)(?![\w-])|plate-cut|text-faint|text-bone|text-dim|text-crystal|text-micro|text-caption|text-label|text-figure|text-title|bg-raised|bg-void|rail-soft|divide-/);
  }
};
const resources = (alloy: number) => ({ alloy, crystal: alloy / 2, deuterium: alloy / 10 });
const stats = {
  version: 1 as const,
  competition: {
    battles: 8, attacks: 5, defences: 3, damageDealt: 12_000, damageTaken: 4_000, playerLoot: resources(3_000),
    shipsBuilt: 18, shipsLost: 6, shipsBuiltByHull: { DART: 18 }, shipsLostByHull: { DART: 6 },
  },
  economy: { produced: resources(50_000), productiveSeconds: 72_000 },
  exploration: { asteroidRuns: 7, asteroidMined: resources(50_000), convoyAttempts: 3, convoySuccesses: 2, convoyDelivered: resources(2_000) },
};

const show = (endReason: 'SCHEDULED_END' | 'FORCED_WIPE' = 'SCHEDULED_END') => {
  const api = new Api({ fetch: vi.fn<typeof globalThis.fetch>() });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const season = { seasonId, ordinal: 4, shard: 'EU-1', shardName: 'Vantage', status: 'frozen', startsAt: at, endsAt: at };
  client.setQueryData(keys.seasonArchive, { pages: [{ cycles: [{ ordinal: 4, startsAt: at, endsAt: at, status: 'frozen',
    galaxies: [{ seasonId, shard: 'EU-1', shardName: 'Vantage', status: 'frozen' }] }], nextCursor: null }], pageParams: [undefined] });
  client.setQueryData(keys.archivedLeaderboard(seasonId), {
    season: { ...season, closedAt: at, endReason }, record: null,
    ladder: [{ resultId, rank: 1, commanderName: 'Ace', country: 'TR', dominion: 900, title: 'Sovereign', self: false, reward: null }],
  });
  client.setQueryData(keys.seasonCommanderProfile(resultId), {
    selected: {
      ...season, resultId, closedAt: at, endReason, commanderName: 'Ace', country: 'TR', planetName: 'Aster', rank: 1, commanders: 40,
      honorScore: null, honorRank: null, dominion: 900, title: 'Sovereign',
      recap: { commanderName: 'Ace', planetName: 'Aster', battles: 8, attacks: 5, defences: 3, rival: { commanderName: 'Rival', battles: 4 },
        biggestRaid: { value: 2_500, opponentName: 'Target' }, clan: null },
      stats,
      averages: {
        cohortSize: 40,
        competition: { battles: 4, attacks: 2, defences: 2, damageDealt: 6_000, damageTaken: 5_000, playerLoot: resources(1_000), shipsBuilt: 10, shipsLost: 5 },
        economy: { produced: resources(27_000), productiveSeconds: 36_000 },
        exploration: { asteroidRuns: 3, asteroidMined: resources(27_000), convoyAttempts: 1, convoySuccesses: 1, convoyDelivered: resources(700) },
      },
      reward: null,
    },
    career: {
      completedSeasons: 2, bestRank: 1, championships: 1, podiums: 2, topTen: 2,
      competitionTotals: { seasonsCovered: 2, battles: 12, attacks: 7, defences: 5, damageDealt: 20_000, damageTaken: 9_000 },
      totals: { seasonsCovered: 1, partialSeasons: 0, stats },
      seasons: [{ ...season, resultId, commanderName: 'Ace', rank: 1, dominion: 900, title: 'Sovereign', statsAvailable: true }],
    },
  });
  const Wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}><ApiProvider api={api}>{children}</ApiProvider></QueryClientProvider>;
  render(<Wrapper><SeasonArchiveScreen onFocusPlanet={vi.fn()} initialSeasonId={seasonId} /></Wrapper>);
};

const open = async () => {
  const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name: /Ace/ }));
  return user;
};

describe('a commander’s season record on the kit (C21)', () => {
  it('opens on the kit: a kit way back, the place on a plaque and the two views as kit tabs', async () => {
    show();
    const user = await open();
    expect(screen.getByRole('heading', { name: 'Ace' })).toBeVisible();
    expect(screen.getByText('#1').closest('.gk-stat')).not.toBeNull();
    const views = screen.getByRole('tablist', { name: 'Commander record views' });
    expect(views).toHaveClass('gk-tabs');
    expect(within(views).getByRole('tab', { name: 'Season 4' })).toHaveAttribute('aria-selected', 'true');
    const back = screen.getByRole('button', { name: /Back to season standings/ });
    expect(back).toHaveClass('gk-btn');
    await user.click(back);
    expect(screen.getByRole('list', { name: 'Completed season leaderboard' })).toBeVisible();
  });

  it('compares each figure with the field on kit cards: the figure, the multiple and both bars', async () => {
    show();
    await open();
    const battles = screen.getAllByText('Battles').map((label) => label.closest('[data-compare]')).find(Boolean);
    expect(battles).toHaveClass('gk-well');
    expect(battles).toHaveTextContent('8');
    expect(battles).toHaveTextContent('×2.0');
    expect(battles).toHaveTextContent('Others: 4');
    expect(battles?.querySelector('[data-bar="ahead"]')).not.toBeNull();
    expect(battles?.querySelector('[data-bar="field"]')).not.toBeNull();
    noLegacy(document.querySelector('[data-v2-season-archive]')!);
  });

  it('says a season ended early on a kit banner', async () => {
    show('FORCED_WIPE');
    await open();
    expect(screen.getByText('Season ended early').closest('.gk-banner')).not.toBeNull();
  });

  it('keeps the career on the kit, its seasons a ledger of doors', async () => {
    show();
    const user = await open();
    await user.click(screen.getByRole('tab', { name: 'Overall' }));
    const seasons = screen.getByRole('list', { name: 'Season by season' });
    expect(seasons).toHaveClass('gk-ledger');
    expect(within(seasons).getByRole('button', { name: 'Open Season 4 · EU-1 record' })).toHaveClass('gk-lb__door');
    noLegacy(document.querySelector('[data-v2-season-archive]')!);
  });
});
