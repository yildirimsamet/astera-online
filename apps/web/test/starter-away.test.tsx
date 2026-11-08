import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Api } from '../src/api/client.js';
import { ApiProvider } from '../src/api/context.js';
import { keys } from '../src/api/keys.js';
import type { ReturnPayload } from '../src/api/schemas.js';
import { vesselSchema } from '../src/api/starterSchemas.js';
import { vesselToPlanetView } from '../src/starter/adapter.js';
import { starterFetch } from '../src/starter/transport.js';
import { AwaySheet } from '../src/v2/hud/AwaySheet.js';
import { urlOf, wireVessel } from './starterVesselFixture.js';

afterEach(cleanup);

const at = new Date('2026-11-05T10:00:00Z');
const story: ReturnPayload = {
  awayMinutes: 90, asOf: at, pending: [], newUnlocks: [],
  entries: [
    { kind: 'fleet_returned', params: { resources: 1200, ships: 6 }, at },
    { kind: 'accrued', params: { alloy: 300, crystal: 90 }, at },
  ],
};

const show = (aboard: boolean) => {
  const client = new QueryClient();
  client.setQueryData(keys.planet, aboard ? vesselToPlanetView(vesselSchema.parse(wireVessel())) : undefined);
  const api = new Api({ fetch: vi.fn() as unknown as typeof globalThis.fetch });
  render(<QueryClientProvider client={client}><ApiProvider api={api}>
    <AwaySheet aboard={aboard} story={story} sightings={[]} care={null} onDismiss={vi.fn()} onAll={vi.fn()} onDoor={vi.fn()} />
  </ApiProvider></QueryClientProvider>);
};

describe('the away card, on a ship', () => {
  it('calls a fleet a fleet: no convoy ever flew here', () => {
    show(true);
    expect(screen.queryByText(/convoy/i)).toBeNull();
    expect(screen.getByText('Fleet home')).toBeTruthy();
    expect(screen.getByText(/1,200 resources · 6 ships/)).toBeTruthy();
  });

  it('sends the player to the ship, not to a base', () => {
    show(true);
    // The fleet is the moment; the works wait under it, one tap away (F5).
    fireEvent.click(screen.getByRole('button', { name: /details/i }));
    expect(screen.queryByText(/Go to the base/)).toBeNull();
    expect(screen.getAllByText(/Go to the ship/).length).toBeGreaterThan(0);
  });

  it('leaves the main story as it was', () => {
    show(false);
    expect(screen.getByText('Convoy prizes delivered')).toBeTruthy();
  });
});

describe('what came home, by kind', () => {
  const split = (entries: ReturnPayload['entries']) => {
    const client = new QueryClient();
    client.setQueryData(keys.planet, vesselToPlanetView(vesselSchema.parse(wireVessel())));
    render(<QueryClientProvider client={client}><ApiProvider api={new Api({ fetch: vi.fn<typeof globalThis.fetch>() })}>
      <AwaySheet aboard story={{ ...story, entries }} sightings={[]} care={null} onDismiss={vi.fn()} onAll={vi.fn()} onDoor={vi.fn()} />
    </ApiProvider></QueryClientProvider>);
  };

  it('names each resource a fleet brought home, not a lump', () => {
    split([{ kind: 'fleet_returned', params: { resources: 1200, ships: 6, alloy: 900, crystal: 300, deuterium: 0 }, at }]);
    expect(screen.getByText('+900 alloy · +300 crystal · 6 ships')).toBeTruthy();
  });

  it('shows the deuterium waiting in the works beside the rest', () => {
    split([{ kind: 'accrued', params: { alloy: 300, crystal: 90, deuterium: 12 }, at }]);
    expect(screen.getByText('+300 alloy · +90 crystal · +12 deuterium')).toBeTruthy();
  });
});

describe('a line with nothing in it', () => {
  it('leaves out a resource the ship cannot make yet', () => {
    const client = new QueryClient();
    client.setQueryData(keys.planet, vesselToPlanetView(vesselSchema.parse(wireVessel())));
    render(<QueryClientProvider client={client}><ApiProvider api={new Api({ fetch: vi.fn() as unknown as typeof globalThis.fetch })}>
      <AwaySheet aboard story={{ ...story, entries: [{ kind: 'accrued', params: { alloy: 500, crystal: 0 }, at }] }} sightings={[]} care={null} onDismiss={vi.fn()} onAll={vi.fn()} onDoor={vi.fn()} />
    </ApiProvider></QueryClientProvider>);
    expect(screen.queryByText(/crystal/)).toBeNull();
    expect(screen.getByText('+500 alloy')).toBeTruthy();
  });
});

describe('the story through the transport', () => {
  it('asks this galaxy, and closes the window there', async () => {
    const base = vi.fn((input: RequestInfo | URL) => { void input; return Promise.resolve(new Response('{}')); });
    const fetch = starterFetch(base, () => true);
    await fetch('/api/session/return');
    await fetch('/api/session/return/seen', { method: 'POST' });
    expect(base.mock.calls.map(call => urlOf(call[0]))).toEqual(['/api/starter/return', '/api/starter/return/seen']);
  });
});
