import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Api } from '../src/api/client.js';
import { ApiProvider } from '../src/api/context.js';
import { leaderboardSchema } from '../src/api/schemas.js';
import i18n from '../src/i18n/index.js';
import { LeaderboardScreen } from '../src/screens/LeaderboardScreen.js';

const row = (playerId: string, rank: number, score: number) => ({ playerId, username: playerId, rank, score, country: 'TR' });
function show(ranking: 'HONOR' | 'DOMINION', rows: ReturnType<typeof row>[], withProgram = true) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
  client.setQueryData(['leaderboard'], leaderboardSchema.parse({ ranking, honorEnabled: true, ladder: rows, you: null }));
  client.setQueryData(['season'], { status: 'live', endsAt: new Date(Date.now() + 86_400_000),
    seasonRewards: withProgram ? { version: 1, minimumDominion: 1, tiers: [
      { place: 1, alloy: 1000, crystal: 750, deuterium: 150 },
      { place: 2, alloy: 875, crystal: 625, deuterium: 125 },
    ] } : null });
  render(<QueryClientProvider client={client}><ApiProvider api={new Api({ fetch: vi.fn<typeof fetch>() })}>
    <LeaderboardScreen onFocusPlanet={vi.fn()} />
  </ApiProvider></QueryClientProvider>);
}
const prize = (name: string) => within(screen.getByText(name).closest('li')!).getByRole('group', { name: 'Current season prize' });

beforeEach(async () => { localStorage.clear(); await i18n.changeLanguage('en'); });

describe('season prizes at the point of competition', () => {
  it('lets a spectator inspect all ten full Honor prizes, even without a personal estimate or Dominion program', () => {
    show('HONOR', [row('leader', 1, 200_000_000)], false);
    expect(screen.getByText(/Full packages.*Honor.*ties/i)).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: /prize by place/i }));
    const tiers = screen.getByRole('list', { name: 'Prize by place' });
    expect(tiers.children).toHaveLength(10);
    expect(tiers.children[0]).toHaveTextContent('2,000');
    expect(tiers.children[0]).toHaveTextContent('1,500');
    expect(tiers.children[0]).toHaveTextContent('300');
    expect(tiers.children[9]).toHaveTextContent('200');
    expect(tiers.children[9]).toHaveTextContent('50');
    expect(tiers.children[9]).toHaveTextContent('4');
    expect(screen.getByText('Join this galaxy to enter the standings.')).toBeVisible();
  });

  it('keeps ranking tabs and Honor prizes visible when a galaxy has no commanders', () => {
    show('HONOR', [], false);
    expect(screen.getByRole('button', { name: 'Honor', pressed: true })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Dominion' })).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: /prize by place/i }));
    expect(screen.getByRole('list', { name: 'Prize by place' }).children).toHaveLength(10);
    expect(screen.getByText('No commanders have joined this galaxy yet.')).toBeVisible();
    expect(screen.queryByRole('list', { name: 'Leaderboard' })).toBeNull();
  });

  it('shows a full Honor prize and the score-capped package on rival rows', () => {
    show('HONOR', [row('leader', 1, 200_000_000), row('capped', 2, 1_234_567)]);
    expect(prize('leader')).toHaveTextContent('2,000');
    expect(prize('leader')).toHaveTextContent('1,500');
    expect(prize('leader')).toHaveTextContent('300');
    expect(prize('capped')).toHaveTextContent('35');
    expect(prize('capped')).toHaveTextContent('25');
    expect(prize('capped')).toHaveTextContent('5');
  });

  it('pools tied Honor places before filtering a search', () => {
    show('HONOR', [row('Alpha', 1, 200_000_000), row('Beta', 1, 200_000_000)]);
    expect(prize('Alpha')).toHaveTextContent('1,875');
    expect(prize('Beta')).toHaveTextContent('1,375');
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'Alpha' } });
    expect(prize('Alpha')).toHaveTextContent('1,875');
    expect(prize('Alpha')).toHaveTextContent('275');
  });

  it('does not promise resources for zero or negative Honor or unpaid places', () => {
    const rows = Array.from({ length: 10 }, (_, i) => row(`paid-${i}`, i + 1, (200 - i) * 1_000_000));
    show('HONOR', [...rows, row('outside', 11, 1_000_000), row('zero', 12, 0), row('negative', 13, -1)]);
    for (const name of ['outside', 'zero', 'negative']) {
      expect(screen.getByText(name).closest('li')).toHaveTextContent('No prize');
    }
  });

  it('shows the Dominion package for the public place and respects the minimum score', () => {
    show('DOMINION', [row('leader', 1, 900), row('unqualified', 2, 0), row('outside', 3, -1)]);
    expect(prize('leader')).toHaveTextContent('1,000');
    expect(prize('leader')).toHaveTextContent('750');
    expect(prize('leader')).toHaveTextContent('150');
    expect(screen.getByText('unqualified').closest('li')).toHaveTextContent('No prize');
    expect(screen.getByText('outside').closest('li')).toHaveTextContent('No prize');
  });

  it('does not invent Dominion prizes on a season without a reward program', () => {
    show('DOMINION', [row('leader', 1, 900)], false);
    expect(screen.queryByRole('group', { name: 'Current season prize' })).toBeNull();
    expect(screen.queryByText('No prize')).toBeNull();
  });
});
