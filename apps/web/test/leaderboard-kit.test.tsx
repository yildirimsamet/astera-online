import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Api } from '../src/api/client.js';
import { ApiProvider } from '../src/api/context.js';
import i18n from '../src/i18n/index.js';
import { LeaderboardScreen } from '../src/screens/LeaderboardScreen.js';
import { RankingScores } from '../src/ui/RankingScores.js';

/**
 * C19 (2026-11-15): the live ladder, its prize board and the Honor/Dominion figures on the game
 * kit. Who ranks where, what each place pays and how the gap is measured are unchanged.
 */
afterEach(async () => { await i18n.changeLanguage('en'); });

/** Nothing of the old v1/v2 utility language is left on the page's own parts. */
const noLegacy = (node: Element) => {
  const own = [node, ...node.querySelectorAll('*')].filter((el) => !el.closest('[role="img"], [data-honor-benefits]'));
  for (const el of own) {
    expect(el.getAttribute('class') ?? '').not.toMatch(/text-v2-|border-v2-|bg-v2-|font-v2-ui|(?<![\w-])(?:name|legend|plate|num)(?![\w-])|text-faint|text-bone|text-dim|text-micro|text-caption|rounded-control|rounded-chip/);
  }
};

const row = (index: number, over: Record<string, unknown> = {}) => ({
  rank: index + 1, playerId: `p-${String(index)}`, username: index === 11 ? 'Me' : `Commander ${String(index)}`, country: 'TR',
  planetId: `planet-${String(index)}`, planetName: `World ${String(index)}`, skinId: null,
  score: 90_000_000 - index * 5_000_000, honor: 90_000_000 - index * 5_000_000, dominion: 2_000 - index * 100, clan: null, ...over,
});

const show = () => {
  const api = new Api({ fetch: vi.fn<typeof globalThis.fetch>() });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const ladder = Array.from({ length: 16 }, (_, index) => row(index));
  client.setQueryData(['leaderboard'], { ranking: 'HONOR', honorEnabled: true, ladder, you: ladder[11],
    honorReward: { rank: 12, honor: 35_000_000, nominal: { alloy: 1750, crystal: 1250, deuterium: 250 },
      reward: { alloy: 820, crystal: 590, deuterium: 118 }, fullThreshold: 61_250_000 } });
  client.setQueryData(['season'], { status: 'live', endsAt: new Date(Date.now() + 86_400_000), seasonReward: null, seasonRewards: null });
  const focus = vi.fn();
  const Wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}><ApiProvider api={api}>{children}</ApiProvider></QueryClientProvider>;
  render(<Wrapper><LeaderboardScreen onFocusPlanet={focus} /></Wrapper>);
  return focus;
};

describe('the Honor and Dominion figures on the kit (C19)', () => {
  it('reads both scores at the kit floor and keeps their marks', () => {
    render(<RankingScores honor={12_000_000} dominion={420} />);
    const scores = document.querySelector('[data-ranking-scores]');
    expect(scores).toHaveClass('gk-scores');
    expect(scores?.querySelector('[data-honor-score] .gk-num')).toHaveTextContent('12');
    expect(scores?.querySelector('[data-dominion-score] svg')).not.toBeNull();
    noLegacy(scores!);
  });
});

describe('the live ladder on the kit (C19)', () => {
  it('switches the race with kit tabs', () => {
    show();
    expect(screen.getByRole('tab', { name: 'Honor', selected: true })).toHaveClass('gk-tab');
    expect(screen.getByRole('tab', { name: 'Dominion' })).toHaveAttribute('aria-selected', 'false');
  });

  it('draws every commander as one ledger line, another’s name a door to their world', () => {
    const focus = show();
    const ladder = screen.getByRole('list', { name: 'Leaderboard' });
    expect(ladder).toHaveClass('gk-ledger');
    const door = within(ladder).getByRole('button', { name: 'Commander 3' });
    expect(door).toHaveClass('gk-lb__door');
    fireEvent.click(door);
    expect(focus).toHaveBeenCalledWith('planet-3');
    const mine = within(ladder).getAllByRole('listitem').find((item) => item.getAttribute('aria-current') === 'true');
    expect(mine?.querySelector('[data-self]')).not.toBeNull();
  });

  // Owner 2026-11-17 (item 4): the prize and the rules moved to their own pages beside the standings.
  it('puts the reader’s place and Honor on one kit plate, the prize in a well on the Rewards page', () => {
    show();
    expect(document.querySelector('[data-honor-mine]')).toHaveClass('gk-well');
    expect(screen.getByRole('searchbox')).toHaveClass('gk-field__input');
    fireEvent.click(screen.getByRole('radio', { name: 'Rewards' }));
    expect(document.querySelector('[data-honor-prize]')).toHaveClass('gk-well');
  });

  // G9 close (2026-11-16): the page sat outside the kit's root, so its copy fell back to the browser's face;
  // and the purse borrowed the report haul's row, which became a three-column grid and stacked "820 / 1,750" on the next art.
  it('speaks in the kit’s type, and sets the purse on its own row', () => {
    show();
    fireEvent.click(screen.getByRole('radio', { name: 'Rewards' }));
    expect(document.querySelector('[data-v2-leaderboard]')).toHaveClass('gk');
    const purse = document.querySelector('[data-honor-prize] .gk-lb__purse');
    expect(purse).not.toBeNull();
    expect(document.querySelector('[data-honor-prize] .gk-haul__row')).toBeNull();
    expect(purse!.querySelectorAll('[data-res]')).toHaveLength(3);
  });

  it('leaves no v1 or v2 utility on the page', () => {
    show();
    noLegacy(document.querySelector('[data-v2-leaderboard]')!);
  });
});
