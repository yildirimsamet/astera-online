import { STARTER, starterGalaxyCentre } from '@astera/rules';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Api } from '../src/api/client.js';
import { ApiProvider } from '../src/api/context.js';
import { keys } from '../src/api/keys.js';
import { beamsNow, starterGlowDirections } from '../src/galaxy/mainSky.js';
import { readsForShardEvent } from '../src/session/shardEvents.js';
import { DepartureBoard } from '../src/starter/DepartureBoard.js';
import { MainGalaxyRow } from '../src/starter/MainGalaxyRow.js';

afterEach(cleanup);

const NOW = Date.UTC(2026, 10, 5, 12);
const row = (name: string, minutesAgo: number) => ({ name, country: 'DE', at: new Date(NOW - minutesAgo * 60_000), x: 10, y: 0, z: -5 });

const wrap = (node: React.ReactNode, answer: unknown) => {
  const fetch = vi.fn(() => Promise.resolve(new Response(JSON.stringify(answer), { status: 200, headers: { 'content-type': 'application/json' } })));
  return <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <ApiProvider api={new Api({ fetch: fetch as unknown as typeof globalThis.fetch })}>{node}</ApiProvider>
  </QueryClientProvider>;
};

describe('somebody leaves', () => {
  it('refreshes the board, the map and what the panel offers', () => {
    const reads = readsForShardEvent('shard:departure');
    expect(reads).toContainEqual(keys.departures);
    expect(reads).toContainEqual(keys.galaxy);
    expect(reads).toContainEqual(keys.migration);
  });

  it('lets the main galaxy watch a newcomer come in, and nothing else', () => {
    expect(readsForShardEvent('shard:inbound')).toEqual([keys.inbound]);
  });

  it('draws the streak for ten minutes and then lets it go', () => {
    expect(beamsNow([row('A', 2), row('B', 9), row('C', 11)], NOW).map(beam => beam.name)).toEqual(['A', 'B']);
  });

  it('dims it as it ages', () => {
    const [fresh, old] = beamsNow([row('A', 0), row('B', 9)], NOW);
    expect(fresh!.strength).toBeGreaterThan(old!.strength);
    expect(old!.strength).toBeGreaterThan(0);
  });
});

describe('the board', () => {
  it('lists who left, with flag and how long ago', async () => {
    render(wrap(<DepartureBoard now={NOW} />, { departures: [{ name: 'Vex', country: 'DE', at: new Date(NOW - 3_600_000).toISOString(), x: 0, y: 0, z: 0, hull: 'SPINE' }] }));
    expect(await screen.findByText('Vex')).toBeInTheDocument();
    expect(screen.getByTestId('departure-board')).toHaveTextContent(/1h/u);
  });

  it('says plainly that nobody has left yet', async () => {
    render(wrap(<DepartureBoard now={NOW} />, { departures: [] }));
    expect(await screen.findByTestId('departure-empty')).toBeInTheDocument();
  });
});

describe('the main galaxy, tapped from a ship', () => {
  const sky = { server: 'Vantage', worlds: 412, seasonEndsAt: new Date(NOW + 10 * 86_400_000) };

  const road = { repair: 0.4, fuel: 30 };

  it('reads its name, its worlds and the days left, and offers no way there but the ship', () => {
    const open = vi.fn();
    render(<MainGalaxyRow sky={sky} now={NOW} jumpReady={false} road={road} onOpenShip={open} onClose={vi.fn()} />);
    const body = screen.getByTestId('main-galaxy-row');
    expect(body).toHaveTextContent('Vantage');
    expect(body).toHaveTextContent('412');
    expect(body).toHaveTextContent('10');
    expect(body).toHaveTextContent(/drive/iu);
    expect(screen.getAllByRole('button')).toHaveLength(2);
    fireEvent.click(screen.getByTestId('main-galaxy-go'));
    expect(open).toHaveBeenCalledTimes(1);
  });

  /** Owner 2026-11-06: the card read as a season notice. It is the story: where the player is going. */
  it('tells where the journey really starts, and how far the ship is from it', () => {
    render(<MainGalaxyRow sky={sky} now={NOW} jumpReady={false} road={road} onOpenShip={vi.fn()} onClose={vi.fn()} />);
    const body = screen.getByTestId('main-galaxy-row');
    expect(body).toHaveTextContent(/real journey/iu);
    expect(body).toHaveTextContent('40%');
    expect(body).toHaveTextContent(`30/${String(STARTER.fuelForJump)}`);
  });

  it('says the season is being awaited when none is live', () => {
    render(<MainGalaxyRow sky={{ server: 'Vantage', worlds: 0, seasonEndsAt: null }} now={NOW} jumpReady={false} road={{ repair: 0, fuel: 0 }} onOpenShip={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByTestId('main-galaxy-row')).toHaveTextContent(/new season/iu);
  });
});

describe('where you came from, from the main galaxy', () => {
  it('reads no data: the same places for everyone, and only the first few', () => {
    const glow = starterGlowDirections();
    expect(glow.length).toBeGreaterThan(2);
    expect(glow.length).toBeLessThanOrEqual(STARTER.capacity);
  });

  it('stands in the direction each galaxy really is', () => {
    const [first] = starterGlowDirections();
    const centre = starterGalaxyCentre(1);
    const size = Math.hypot(centre.x, centre.y, centre.z);
    expect(first![0]).toBeCloseTo(centre.x / size, 5);
    expect(first![1]).toBeCloseTo(centre.y / size, 5);
    expect(first![2]).toBeCloseTo(centre.z / size, 5);
  });
});
