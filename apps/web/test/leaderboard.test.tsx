import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Api } from '../src/api/client.js';
import { ApiProvider } from '../src/api/context.js';
import i18n from '../src/i18n/index.js';
import { LeaderboardScreen } from '../src/screens/LeaderboardScreen.js';
import { planetArt } from '../src/ui/assets.js';
import { ToastProvider } from '../src/ui/Toast.js';

const rows = Array.from({ length: 100 }, (_, index) => ({
  rank: index + 1,
  playerId: `player-${String(index)}`,
  username: index === 42 ? 'İzci' : `Commander ${String(index)}`,
  planetId: index === 1 ? undefined : `planet-${String(index)}`,
  planetName: index === 1 ? undefined : `World ${String(index)}`,
  coreTier: index === 1 ? undefined : (index % 4) + 1,
  score: 50 - index,
  clan: index === 0 ? { id: 'clan-war', name: 'War Fleet', tag: 'WAR' } : null,
}));

async function show(language = 'en') {
  await i18n.changeLanguage(language);
  const api = new Api({ fetch: vi.fn() as unknown as typeof globalThis.fetch });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(['leaderboard'], { ladder: rows, you: rows[42] });
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>
      <ApiProvider api={api}><ToastProvider>{children}</ToastProvider></ApiProvider>
    </QueryClientProvider>
  );
  const onFocusPlanet = vi.fn();
  render(<Wrapper><LeaderboardScreen onFocusPlanet={onFocusPlanet} /></Wrapper>);
  return onFocusPlanet;
}

afterEach(async () => {
  await i18n.changeLanguage('en');
});

describe('the Dominion leaderboard', () => {
  it('renders a hundred rows with identity, planet, tier and score', async () => {
    await show();
    const ladder = screen.getByRole('list', { name: 'Leaderboard' });
    expect(screen.getAllByRole('listitem')).toHaveLength(100);
    expect(within(ladder).getByText('İzci')).toBeInTheDocument();
    expect(screen.getByText(/World 42 · Tier 3/)).toBeInTheDocument();
    expect(within(ladder).getByText('+8')).toBeInTheDocument();
  });

  it('highlights the caller and seeds its sigil from planetId', async () => {
    await show();
    const ladder = screen.getByRole('list', { name: 'Leaderboard' });
    const mine = within(ladder).getByText('İzci').closest('li');
    expect(mine).toHaveAttribute('aria-current', 'true');
    expect(mine?.querySelector('img')).toHaveAttribute('src', planetArt('planet-42'));
  });

  it('pins one rival above and below a commander who is deep in the ladder', async () => {
    await show();
    const nearby = screen.getByRole('region', { name: 'Your closest rivals' });

    expect(within(nearby).getByText('Commander 41')).toBeVisible();
    expect(within(nearby).getByText('İzci')).toBeVisible();
    expect(within(nearby).getByText('Commander 43')).toBeVisible();
    expect(within(nearby).queryByText('Commander 40')).toBeNull();
    expect(within(nearby).getByText('You')).toBeVisible();
  });

  it('hides the nearby-rival strip while searching so results stay unambiguous', async () => {
    await show();
    await userEvent.setup().type(screen.getByRole('searchbox'), 'World 12');

    expect(screen.queryByRole('region', { name: 'Your closest rivals' })).toBeNull();
  });

  it('routes another commander name to the existing Galaxy focus', async () => {
    const onFocusPlanet = await show();
    const commander = screen.getByRole('button', { name: '[WAR] Commander 0' });
    expect(commander).toHaveClass('name', 'underline');
    await userEvent.setup().click(commander);
    expect(onFocusPlanet).toHaveBeenCalledWith('planet-0');
    expect(screen.queryByRole('button', { name: 'İzci' })).not.toBeInTheDocument();
  });

  it('renders an UNKNOWN commander without a link or underline', async () => {
    const onFocusPlanet = await show();
    const commander = screen.getByText('Commander 1');
    expect(commander).toBeVisible();
    expect(commander).not.toHaveClass('underline');
    expect(screen.queryByText('World 1')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Commander 1' })).not.toBeInTheDocument();
    expect(onFocusPlanet).not.toHaveBeenCalled();
  });

  it('leads a clan commander identity with its tag', async () => {
    await show();
    const identity = screen.getByRole('button', { name: '[WAR] Commander 0' });
    expect(identity.textContent).toBe('[WAR]Commander 0');
    expect(identity.firstElementChild).toHaveTextContent('[WAR]');
  });

  it('localises the panel in Turkish without folding dotted İ', async () => {
    await show('tr');
    const ladder = screen.getByRole('list', { name: 'Liderlik tablosu' });
    expect(ladder).toBeInTheDocument();
    expect(within(ladder).getByText('İzci')).toBeInTheDocument();
    expect(screen.getByText(/World 42 · 3\. kademe/)).toBeInTheDocument();

    const user = userEvent.setup();
    await user.type(screen.getByRole('searchbox'), 'izci');
    expect(screen.getAllByRole('listitem')).toHaveLength(1);
    expect(screen.getByText('İzci')).toBeVisible();
  });

  it('searches commander, planet and clan identity without changing authoritative ranks', async () => {
    await show();
    const search = screen.getByRole('searchbox', { name: /search commanders/i });
    const user = userEvent.setup();

    await user.type(search, 'World 12');
    expect(screen.getAllByRole('listitem')).toHaveLength(1);
    expect(screen.getByText('Commander 12')).toBeVisible();
    expect(screen.getByText('13')).toBeVisible();

    await user.clear(search);
    await user.type(search, 'war fleet');
    expect(screen.getAllByRole('listitem')).toHaveLength(1);
    expect(screen.getByRole('button', { name: '[WAR] Commander 0' })).toBeVisible();
  });

  it('states when a leaderboard search has no result', async () => {
    await show();
    await userEvent.setup().type(screen.getByRole('searchbox'), 'nobody-here');
    expect(screen.queryByRole('list')).toBeNull();
    expect(screen.getByText(/no commander, planet or clan matches/i)).toBeVisible();
  });
});
