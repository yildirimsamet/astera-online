import { fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Api } from '../src/api/client.js';
import { ApiProvider } from '../src/api/context.js';
import { keys } from '../src/api/keys.js';
import { vesselSchema } from '../src/api/starterSchemas.js';
import i18n from '../src/i18n/index.js';
import { outlineQueues } from '../src/lib/outline.js';
import { MenuPanel } from '../src/shell/MenuPanel.js';
import { Outline } from '../src/v2/hud/Outline.js';
import { vesselToPlanetView } from '../src/starter/adapter.js';
import { wireVessel } from './starterVesselFixture.js';

const show = (aboard: boolean) => {
  const fetch = vi.fn(() => Promise.resolve(new Response('{}', { status: 404, headers: { 'content-type': 'application/json' } })));
  const queries = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
  if (aboard) queries.setQueryData(keys.planet, vesselToPlanetView(vesselSchema.parse(wireVessel())));
  return render(
    <QueryClientProvider client={queries}>
      <ApiProvider api={new Api({ fetch })}>
        <MenuPanel page="home" galaxy="Vantage" shard="EU-1" endsAt={new Date('2099-01-01T00:00:00Z')} onOpen={vi.fn()} onSignOut={vi.fn()} />
      </ApiProvider>
    </QueryClientProvider>,
  );
};

describe('the commander menu', () => {
  beforeEach(async () => { await i18n.changeLanguage('en'); });

  it('has no season clock, ranking, rewards or store aboard a ship', () => {
    const { container } = show(true);
    expect(screen.queryByText(/season ends/i)).toBeNull();
    expect(container.querySelector('[data-tile="leaderboard"]')).toBeNull();
    expect(container.querySelector('[data-tile="rewards"]')).toBeNull();
    expect(screen.queryByRole('button', { name: /shop/i })).toBeNull();
  });

  it('says where a commander serves, not that they lack a clan they cannot join yet', () => {
    show(true);
    expect(screen.queryByText(/no clan/i)).toBeNull();
    expect(screen.getByText('Colony ship')).toBeInTheDocument();
  });

  it('keeps the guide, the community and the settings aboard', () => {
    const { container } = show(true);
    for (const id of ['academy', 'community', 'settings']) {
      expect(container.querySelector(`[data-tile="${id}"]`)).not.toBeNull();
    }
  });

  it('shows all of it to a commander on a planet', () => {
    const { container } = show(false);
    expect(screen.getByText(/season ends/i)).toBeInTheDocument();
    expect(container.querySelector('[data-tile="leaderboard"]')).not.toBeNull();
    expect(container.querySelector('[data-tile="rewards"]')).not.toBeNull();
  });
});

/** Plan F3: the guide turned off on the account comes back from Academy, the help page. */
describe('the guide, turned back on', () => {
  beforeEach(async () => { await i18n.changeLanguage('en'); });
  const academy = (onGuideOn?: () => void) => render(
    <QueryClientProvider client={new QueryClient()}>
      <ApiProvider api={new Api({ fetch: vi.fn(() => Promise.resolve(new Response('{}', { status: 404 }))) })}>
        <MenuPanel page="academy" galaxy="Vantage" shard="EU-1" endsAt={null} onOpen={vi.fn()} onSignOut={vi.fn()} {...(onGuideOn ? { onGuideOn } : {})} />
      </ApiProvider>
    </QueryClientProvider>,
  );

  it('offers the guide back to a commander who turned it off', () => {
    const onGuideOn = vi.fn();
    academy(onGuideOn);
    fireEvent.click(screen.getByRole('button', { name: /walks with you again/i }));
    expect(onGuideOn).toHaveBeenCalledOnce();
  });

  it('says nothing of it while the guide is on', () => {
    academy();
    expect(screen.queryByRole('button', { name: /walks with you again/i })).toBeNull();
  });
});

describe('the desk outline', () => {
  const ship = vesselToPlanetView(vesselSchema.parse(wireVessel()));

  it('lists one repair lane aboard, and neither research nor a shipyard', () => {
    const lanes = outlineQueues([ship], ship, ship.planet.id);
    expect(lanes.map(lane => lane.lane)).toEqual(['repair']);
    expect(lanes[0]!.worldId).toBe(ship.planet.id);
  });

  it('keeps research, construction and the yard on a planet', () => {
    const planet = { ...ship };
    delete planet.vessel;
    expect(outlineQueues([planet], planet, ship.planet.id).map(lane => lane.lane)).toEqual(['research', 'construction', 'yard']);
  });
});

describe('the desk outline, drawn', () => {
  const draw = () => render(<Outline now={0} worlds={[]} flights={[]}
    queues={[{ worldId: 'ship-1', world: 'Me', lane: 'repair', orders: [] }]} onWorld={vi.fn()} onFlight={vi.fn()} onQueue={vi.fn()} />);

  it('shows the repair lane with no world list above it', () => {
    draw();
    expect(screen.getByRole('button', { name: /repair queue/i })).toBeInTheDocument();
  });

  it('says nothing about launching while a ship has nothing to launch', () => {
    draw();
    expect(screen.queryByText(/in the air/i)).toBeNull();
  });
});
