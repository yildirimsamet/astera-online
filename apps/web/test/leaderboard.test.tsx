import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Api } from '../src/api/client.js';
import { ApiProvider } from '../src/api/context.js';
import i18n from '../src/i18n/index.js';
import { LeaderboardScreen } from '../src/screens/LeaderboardScreen.js';
import { planetArt } from '../src/ui/assets.js';

const rows = Array.from({ length: 100 }, (_, index) => ({
  rank: index + 1,
  playerId: `player-${String(index)}`,
  username: index === 42 ? 'İzci' : `Commander ${String(index)}`,
  planetId: `planet-${String(index)}`,
  planetName: `World ${String(index)}`,
  coreTier: (index % 4) + 1,
  score: 50 - index,
}));

async function show(language = 'en') {
  await i18n.changeLanguage(language);
  const api = new Api({ fetch: vi.fn() as unknown as typeof globalThis.fetch });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(['leaderboard'], { ladder: rows, you: rows[42] });
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}><ApiProvider api={api}>{children}</ApiProvider></QueryClientProvider>
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
    expect(screen.getAllByRole('listitem')).toHaveLength(100);
    expect(screen.getByText('İzci')).toBeInTheDocument();
    expect(screen.getByText(/World 42 · Tier 3/)).toBeInTheDocument();
    expect(screen.getByText('+8')).toBeInTheDocument();
  });

  it('highlights the caller and seeds its sigil from planetId', async () => {
    await show();
    const mine = screen.getByText('İzci').closest('li');
    expect(mine).toHaveAttribute('aria-current', 'true');
    expect(mine?.querySelector('img')).toHaveAttribute('src', planetArt('planet-42'));
  });

  it('routes another commander name to the existing Galaxy focus', async () => {
    const onFocusPlanet = await show();
    const commander = screen.getByRole('button', { name: 'Commander 0' });
    expect(commander).toHaveClass('font-bold');
    await userEvent.setup().click(commander);
    expect(onFocusPlanet).toHaveBeenCalledWith('planet-0');
    expect(screen.queryByRole('button', { name: 'İzci' })).not.toBeInTheDocument();
  });

  it('localises the panel in Turkish without folding dotted İ', async () => {
    await show('tr');
    expect(screen.getByRole('list', { name: 'Liderlik tablosu' })).toBeInTheDocument();
    expect(screen.getByText('İzci')).toBeInTheDocument();
    expect(screen.getByText(/World 42 · 3\. kademe/)).toBeInTheDocument();
  });
});
