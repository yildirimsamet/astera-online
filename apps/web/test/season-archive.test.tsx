import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Api } from '../src/api/client.js';
import { ApiProvider } from '../src/api/context.js';
import { keys } from '../src/api/keys.js';
import i18n from '../src/i18n/index.js';
import { SeasonArchiveScreen } from '../src/screens/SeasonArchiveScreen.js';
import { ToastProvider } from '../src/ui/Toast.js';

const seasonId = '11111111-1111-4111-8111-111111111111';
const resultId = '22222222-2222-4222-8222-222222222222';
const startsAt = new Date('2026-01-01T00:00:00.000Z');
const endsAt = new Date('2026-01-31T00:00:00.000Z');

const stats = {
  version: 1 as const,
  competition: {
    battles: 8,
    attacks: 5,
    defences: 3,
    damageDealt: 12_000,
    damageTaken: 4_000,
    playerLoot: { alloy: 3_000, crystal: 900, deuterium: 40 },
    shipsBuilt: 18,
    shipsLost: 6,
    shipsBuiltByHull: { DART: 18 },
    shipsLostByHull: { DART: 6 },
  },
  economy: {
    produced: { alloy: 50_000, crystal: 18_000, deuterium: 400 },
    productiveSeconds: 72_000,
  },
  exploration: {
    asteroidRuns: 7,
    asteroidMined: { alloy: 50_000, crystal: 12_000, deuterium: 500 },
    convoyAttempts: 3,
    convoySuccesses: 2,
    convoyDelivered: { alloy: 2_000, crystal: 700, deuterium: 30 },
  },
};

const rewardProgram = {
  version: 1,
  minimumDominion: 1,
  tiers: [
    [2_000, 1_500, 300], [1_750, 1_250, 250], [1_500, 1_000, 200],
    [1_250, 750, 150], [1_000, 500, 100], [750, 250, 50],
    [600, 175, 25], [450, 150, 15], [250, 75, 10], [200, 50, 5],
  ].map(([alloy, crystal, deuterium], index) => ({
    place: index + 1,
    alloy: alloy!,
    crystal: crystal!,
    deuterium: deuterium!,
  })),
};

async function show({ legacy = false, archiveFailure = false, noRewards = false } = {}) {
  await i18n.changeLanguage('en');
  const fetch = vi.fn();
  if (archiveFailure) fetch.mockRejectedValue(new Error('offline'));
  const api = new Api({ fetch: fetch as unknown as typeof globalThis.fetch });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(keys.leaderboard, {
    ladder: [
      { rank: 1, playerId: 'live-other', username: 'Live Rival', score: 20 },
      { rank: 2, playerId: 'live-self', username: 'Live Self', score: 0 },
    ],
    you: { rank: 2, playerId: 'live-self', username: 'Live Self', score: 0 },
  });
  client.setQueryData(keys.season, {
    seasonId, shard: 'EU-1', shardName: 'Orion', seed: 1, status: 'live',
    startsAt, endsAt, playerCap: 300, players: 40,
    seasonRewards: noRewards ? null : rewardProgram,
  });
  if (!archiveFailure) {
    client.setQueryData(keys.seasonArchive, {
      pages: [{
        cycles: [{
          ordinal: 1,
          startsAt,
          endsAt,
          status: 'frozen',
          galaxies: [{ seasonId, shard: 'EU-1', shardName: 'Orion', status: 'frozen' }],
        }],
        nextCursor: null,
      }],
      pageParams: [undefined],
    });
  }
  client.setQueryData(keys.archivedLeaderboard(seasonId), {
    season: { seasonId, ordinal: 1, shard: 'EU-1', shardName: 'Orion', status: 'frozen', startsAt, endsAt },
    ladder: [{
      resultId,
      rank: 1,
      commanderName: 'Archive Ace',
      dominion: 12_500,
      title: 'Sovereign of Orion',
      self: false,
      reward: null,
    }],
  });
  client.setQueryData(keys.seasonCommanderProfile(resultId), {
    selected: {
      resultId,
      seasonId,
      ordinal: 1,
      shard: 'EU-1',
      shardName: 'Orion',
      status: 'frozen',
      startsAt,
      endsAt,
      commanderName: 'Archive Ace',
      planetName: 'Aster Prime',
      rank: 1,
      dominion: 12_500,
      title: 'Sovereign of Orion',
      recap: {
        commanderName: 'Archive Ace',
        planetName: 'Aster Prime',
        battles: 8,
        attacks: 5,
        defences: 3,
        rival: null,
        biggestRaid: null,
        clan: null,
      },
      stats: legacy ? null : stats,
      averages: legacy ? null : {
        cohortSize: 20,
        competition: {
          battles: 4,
          attacks: 2,
          defences: 2,
          damageDealt: 6_000,
          damageTaken: 5_000,
          playerLoot: { alloy: 1_000, crystal: 300, deuterium: 10 },
          shipsBuilt: 10,
          shipsLost: 5,
        },
        economy: {
          produced: { alloy: 27_000, crystal: 9_000, deuterium: 200 },
          productiveSeconds: 36_000,
        },
        exploration: {
          asteroidRuns: 3,
          asteroidMined: { alloy: 27_000, crystal: 7_000, deuterium: 200 },
          convoyAttempts: 1,
          convoySuccesses: 0.5,
          convoyDelivered: { alloy: 700, crystal: 200, deuterium: 10 },
        },
      },
      reward: null,
    },
    career: {
      completedSeasons: 1,
      bestRank: 1,
      championships: 1,
      podiums: 1,
      topTen: 1,
      totals: legacy ? null : { seasonsCovered: 1, stats },
      seasons: [{
        resultId,
        seasonId,
        ordinal: 1,
        shard: 'EU-1',
        shardName: 'Orion',
        status: 'frozen',
        startsAt,
        endsAt,
        commanderName: 'Archive Ace',
        rank: 1,
        dominion: 12_500,
        title: 'Sovereign of Orion',
        statsAvailable: !legacy,
      }],
    },
  });

  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>
      <ApiProvider api={api}><ToastProvider>{children}</ToastProvider></ApiProvider>
    </QueryClientProvider>
  );
  const onFocusPlanet = vi.fn();
  render(<Wrapper><SeasonArchiveScreen onFocusPlanet={onFocusPlanet} /></Wrapper>);
  return { onFocusPlanet };
}

afterEach(async () => {
  window.localStorage.clear();
  await i18n.changeLanguage('en');
});

describe('season archive surface', () => {
  it('keeps the live leaderboard rows non-inspectable', async () => {
    const { onFocusPlanet } = await show();
    expect(screen.getByRole('button', { name: 'Live season' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('Live Rival')).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Live Rival' })).not.toBeInTheDocument();
    expect(onFocusPlanet).not.toHaveBeenCalled();
  });

  it('opens completed rows and compares sealed stats to the cohort average', async () => {
    await show();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /Season 1 · EU-1/i }));
    await user.click(screen.getByRole('button', { name: /Archive Ace/i }));

    expect(screen.getByRole('heading', { name: 'Archive Ace' })).toBeVisible();
    expect(screen.getByText('#1')).toBeVisible();
    expect(screen.getByText('+12,500')).toBeVisible();
    expect(screen.getByText('Attacks')).toBeVisible();
    expect(screen.getByText('Defences')).toBeVisible();
    expect(screen.getByText('Damage taken')).toBeVisible();
    expect(screen.getByText('Convoy attempts')).toBeVisible();
    expect(screen.getByText('Ships built by type')).toBeVisible();
    expect(screen.getAllByText('Dart').length).toBeGreaterThan(0);
    expect(screen.getAllByText('50,000')).toHaveLength(2);
    expect(screen.getAllByText(/Others: 27,000/)).toHaveLength(2);
    expect(screen.getByText(/20 commanders/)).toBeVisible();
    expect(screen.getByText('20h 00m')).toBeVisible();

    await user.click(screen.getByRole('tab', { name: 'Overall' }));
    expect(screen.getByText('Completed seasons')).toBeVisible();
    expect(screen.getAllByText('1').length).toBeGreaterThan(0);
    await user.click(screen.getByRole('button', { name: 'Open Season 1 · EU-1 record' }));
    expect(screen.getByRole('tab', { name: 'Season 1' })).toHaveAttribute('aria-selected', 'true');
  });

  /**
   * THE QUESTION THE WHOLE FEATURE EXISTS TO ANSWER, ASKED MID-SEASON.
   *
   * A commander in week two is not asking what they did — they are asking why
   * they should keep playing when the galaxy is about to be wiped. The prize for
   * the first ten places is that answer, and it was reachable nowhere: sealed at
   * freeze, paid silently on the next join. It now sits directly above the ladder
   * it is paid for, and it names the reader's OWN standing rather than making
   * them find themselves in a table.
   */
  it('shows what the season is being played for, and where the reader stands', async () => {
    await show();
    const user = userEvent.setup();

    expect(screen.getByText('End of season prize')).toBeVisible();
    const table = screen.getByRole('button', { name: /prize by place/i });
    expect(table).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('Rank 10')).not.toBeInTheDocument();
    await user.click(table);
    expect(table).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Rank 1')).toBeVisible();
    expect(screen.getByText('Rank 10')).toBeVisible();
    const prizeList = screen.getByRole('list', { name: 'Prize by place' });
    expect(prizeList.children).toHaveLength(10);
    expect(prizeList).toHaveClass('md:grid-cols-2');
    for (const row of Array.from(prizeList.children).slice(0, 3)) {
      const medal = row.querySelector('svg');
      expect(medal).toHaveAttribute('width', '16');
      expect(medal).toHaveAttribute('height', '16');
    }
    // The reader's own prize, in full, on their standing card.
    expect(screen.getAllByText('1,750').length).toBeGreaterThan(0);
    expect(screen.getAllByRole('img', { name: 'alloy' }).length).toBeGreaterThan(0);
    // And the reader's own position, said as a position.
    expect(screen.getByText('Rank 2 · you are winning this')).toBeVisible();
    expect(screen.getByText(/lands the moment you found your world/)).toBeVisible();
  });

  /** A galaxy whose cycle predates the program promises nothing, and shows nothing. */
  it('offers no prize when the cycle was opened without a program', async () => {
    await show({ noRewards: true });
    expect(screen.queryByText('End of season prize')).not.toBeInTheDocument();
  });

  it('says historical telemetry is unavailable instead of inventing zeroes', async () => {
    await show({ legacy: true });
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /Season 1 · EU-1/i }));
    await user.click(screen.getByRole('button', { name: /Archive Ace/i }));

    expect(screen.getByText(/No detailed record was kept for this season/)).toBeVisible();
    expect(screen.queryByText('Others: 0')).not.toBeInTheDocument();
  });

  it('keeps the live leaderboard usable when the archive index cannot be reached', async () => {
    await show({ archiveFailure: true });

    expect(screen.getByText('Live Rival')).toBeVisible();
    expect(await screen.findByText('Could not reach season records.')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeVisible();
  });
});
