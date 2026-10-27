import type { ReactNode } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import { Api } from '../src/api/client.js';
import { ApiProvider } from '../src/api/context.js';
import type { GalaxyPlanet, PirateContact } from '../src/api/schemas.js';
import { keys } from '../src/api/keys.js';
import { LaunchSheet } from '../src/screens/LaunchSheet.js';
import { ToastProvider } from '../src/ui/Toast.js';
import { planetView } from './fixtures.js';

/**
 * THE ESCORT SWITCH REACHES THE SERVER (Y9), on a world raid and on a pirate raid.
 * Asserted on the wire: a sheet that shows the bonus and forgets to send `admiral` flies alone.
 */
const world: GalaxyPlanet = {
  id: 'p2', name: 'Kestrel', owner: 'Rival', position: { x: 1200, y: 0, z: 0 }, coreTier: 1, coreLevel: 4,
  intel: 'RESOLVED', state: { kind: 'NORMAL' }, satellites: [], shielded: false, isSelf: false,
};
const pirate = (over: Partial<PirateContact> = {}): PirateContact => ({
  id: 'pirate-1', callsign: 'VEX7', zone: 'IDENTIFIED', at: { x: 400, y: 0, z: 0 }, expiresInMinutes: 180, reachMinutes: 12,
  reach: [{ hull: 'DART', minutes: 12, distance: 900, at: { x: 900, y: 0, z: 0 } }],
  escortReach: [{ hull: 'DART', minutes: 11, distance: 880, at: { x: 880, y: 0, z: 0 } }],
  level: 2, fleet: { VIPER: 3, COURIER: 1 }, damageMult: 0.65, mass: 'MEDIUM', ...over,
});

function setup(ship: 'kilavuz' | 'muhafiz' = 'kilavuz', launched: unknown = null) {
  const calls: { url: string; body: Record<string, unknown> }[] = [];
  const fetchMock = vi.fn((url: string, init?: RequestInit) => {
    calls.push({ url, body: JSON.parse(typeof init?.body === 'string' ? init.body : '{}') as Record<string, unknown> });
    if (launched !== null && url.includes('/api/fleet/launch')) return Promise.resolve(new Response(JSON.stringify(launched), { status: 200, headers: { 'content-type': 'application/json' } }));
    return Promise.resolve(new Response('{}', { status: 500, headers: { 'content-type': 'application/json' } }));
  });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
  client.setQueryData(keys.commanderShip, { capitalPlanetId: '00000000-0000-4000-8000-000000000001', rulesetVersion: 19,
    ship: { class: ship, level: 1, status: 'ready', readyAt: null } });
  const api = new Api({ fetch: fetchMock as unknown as typeof globalThis.fetch });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}><ApiProvider api={api}><ToastProvider>{children}</ToastProvider></ApiProvider></QueryClientProvider>
  );
  const sent = async (path: string) => {
    const commit = screen.getByRole('button', { name: /^launch/i });
    fireEvent.keyDown(commit, { key: 'Enter' });
    fireEvent.keyDown(commit, { key: 'Enter' });
    await vi.waitFor(() => { expect(calls.some(c => c.url.includes(path))).toBe(true); });
    return calls.find(c => c.url.includes(path))!.body;
  };
  return { wrapper, sent };
}

describe('the escort on the launch sheet (Y9)', () => {
  it('sends the escort with a world raid', async () => {
    const { wrapper, sent } = setup();
    render(<LaunchSheet target={{ kind: 'world', world }} planet={planetView({ fleet: { DART: 20 } }, { deuterium: 50_000 })}
      onClose={vi.fn()} onLaunched={vi.fn()} />, { wrapper });
    const user = userEvent.setup();
    await user.type(screen.getByRole('textbox', { name: /dart quantity/i }), '5');
    await user.click(screen.getByRole('switch', { name: /commander ship escorts/i }));
    expect((await sent('/api/fleet/launch')).admiral).toBe(true);
  });

  it('quotes a Kılavuz-led pirate meeting from the escorted table and sends it with the escort', async () => {
    const { wrapper, sent } = setup();
    render(<LaunchSheet target={{ kind: 'pirate', pirate: pirate() }} planet={planetView({ fleet: { DART: 20 } }, { deuterium: 500_000 })}
      onClose={vi.fn()} onLaunched={vi.fn()} />, { wrapper });
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /max.*dart/i }));
    expect(screen.getByText('12m 00s')).toBeInTheDocument();
    await user.click(screen.getByRole('switch', { name: /commander ship escorts/i }));
    expect(screen.getByText('11m 00s')).toBeInTheDocument();
    const body = await sent('/api/pirates/raid');
    expect(body).toMatchObject({ admiral: true, quotedMinutes: 11 });
  });

  it('keeps the plain pirate meeting for a class that does not change the road', async () => {
    const { wrapper, sent } = setup('muhafiz');
    render(<LaunchSheet target={{ kind: 'pirate', pirate: pirate({ escortReach: undefined }) }}
      planet={planetView({ fleet: { DART: 20 } }, { deuterium: 500_000 })} onClose={vi.fn()} onLaunched={vi.fn()} />, { wrapper });
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /max.*dart/i }));
    await user.click(screen.getByRole('switch', { name: /commander ship escorts/i }));
    expect(screen.getByText('12m 00s')).toBeInTheDocument();
    expect(await sent('/api/pirates/raid')).toMatchObject({ admiral: true, quotedMinutes: 12 });
  });

  /** F24: after an escorted wave the switch stayed on, so the sheet asked a price for a ship already gone (409 ADMIRAL_AWAY). */
  it('turns the escort off once the wave is away', async () => {
    const home = planetView({ fleet: { DART: 20 } }, { deuterium: 50_000 });
    const { wrapper, sent } = setup('kilavuz', { missionId: 'm1', arriveAt: new Date().toISOString(), exposureMinutes: 10, homeDefenceAfter: 0, pending: [], planet: home });
    render(<LaunchSheet target={{ kind: 'world', world }} planet={home} onClose={vi.fn()} onLaunched={vi.fn()} />, { wrapper });
    const user = userEvent.setup();
    await user.type(screen.getByRole('textbox', { name: /dart quantity/i }), '5');
    await user.click(screen.getByRole('switch', { name: /commander ship escorts/i }));
    expect((await sent('/api/fleet/launch')).admiral).toBe(true);
    await vi.waitFor(() => { expect(screen.getByRole('switch', { name: /commander ship escorts/i })).toHaveAttribute('aria-checked', 'false'); });
  });
});
