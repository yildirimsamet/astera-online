import type { ReactNode } from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import { Api } from '../../src/api/client.js';
import { ApiProvider } from '../../src/api/context.js';
import type { GalaxyPlanet, PirateContact } from '../../src/api/schemas.js';
import { LaunchSheet } from '../../src/screens/LaunchSheet.js';
import { ToastProvider } from '../../src/ui/Toast.js';
import { planetView } from '../fixtures.js';

/**
 * THE LAUNCH, IN THE ONE ANATOMY. Spec B14, E3 (docs/ui-v2/gozlemevi.md).
 *
 * Head (verb and target), the force ruler, the flight in figures, the pace, the
 * ships, and under them the price — what stays home, and whether it can be turned —
 * written BEFORE the button, which is held rather than tapped (K4). There is no
 * second screen: the confirmation step is gone, its lines are always on the sheet.
 */

const world: GalaxyPlanet = {
  id: 'p2',
  name: 'Tharsis',
  owner: 'Sable',
  position: { x: 120, y: 0, z: 80 },
  coreTier: 2,
  coreLevel: 6,
  intel: 'RESOLVED' as const,
  state: { kind: 'NORMAL' as const },
  satellites: [],
  shielded: false,
  isSelf: false,
};

const pirate: PirateContact = {
  id: 'pirate-1',
  callsign: 'VEX7',
  zone: 'IDENTIFIED',
  at: { x: 400, y: 0, z: 0 },
  expiresInMinutes: 180,
  reachMinutes: 12,
  reach: [{ hull: 'DART', minutes: 12, distance: 900, at: { x: 900, y: 0, z: 0 } }],
  level: 2,
  fleet: { VIPER: 3, COURIER: 1 },
  damageMult: 0.65,
  mass: 'MEDIUM',
};

const calls: { url: string; body: Record<string, unknown> }[] = [];
const wrapper = ({ children }: { children: ReactNode }) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const fetch = vi.fn((url: string, init?: RequestInit) => {
    const body = typeof init?.body === 'string' ? init.body : '{}';
    calls.push({ url, body: JSON.parse(body) as Record<string, unknown> });
    return Promise.resolve(new Response('{}', { status: 500 }));
  });
  const api = new Api({ fetch: fetch as unknown as typeof globalThis.fetch });
  return (
    <QueryClientProvider client={client}>
      <ApiProvider api={api}>
        <ToastProvider>{children}</ToastProvider>
      </ApiProvider>
    </QueryClientProvider>
  );
};

const holding = planetView({ fleet: { DART: 12 } }, { deuterium: 500_000 });
const open = (target: 'world' | 'pirate') => render(
  <LaunchSheet
    planet={holding}
    target={target === 'world' ? { kind: 'world', world } : { kind: 'pirate', pirate }}
    onClose={vi.fn()}
    onLaunched={vi.fn()}
  />,
  { wrapper },
);

const pick = async (count: string): Promise<void> => {
  await userEvent.type(screen.getByRole('textbox', { name: /dart quantity/i }), count);
};

const commitControl = () => screen.getByRole('button', { name: /^launch|^choose a fleet/i });

describe('the launch composer', () => {
  it('holds the commit, and says why it cannot yet', async () => {
    open('world');
    expect(commitControl()).toHaveTextContent('Choose a fleet');
    await pick('2');
    expect(commitControl()).toHaveTextContent('Launch 2 ships');
    expect(document.querySelector('[data-launch-commit]')).not.toBeNull();
  });

  it('commits on the hold, with no second screen', async () => {
    calls.length = 0;
    open('world');
    await pick('2');
    const button = commitControl();
    fireEvent.keyDown(button, { key: 'Enter' });
    fireEvent.keyDown(button, { key: 'Enter' });
    await vi.waitFor(() => { expect(calls.some((c) => c.url.includes('/api/fleet/launch'))).toBe(true); });
    expect(screen.queryByRole('button', { name: /^back$/i })).toBeNull();
  });

  it('writes the price before the button once ships are picked, not before', async () => {
    open('world');
    expect(document.querySelector('[data-launch-warning]')).toBeNull();
    await pick('2');
    const warning = document.querySelector('[data-launch-warning]');
    expect(warning).toHaveTextContent(/10 units/);
    expect(document.querySelector('[data-launch-recall]')).toHaveTextContent(/recalled once while in flight/i);
  });

  /* K8 made a raid at a world recallable; the price line may not say otherwise. */
  it('never calls a raid at a world unrecallable, and still says so of a pirate raid', async () => {
    open('world');
    await pick('2');
    expect(screen.queryByText(/cannot be recalled|no recall/i)).toBeNull();
  });

  it('says a pirate raid cannot be turned, on the price line and on the button', async () => {
    open('pirate');
    await pick('2');
    expect(document.querySelector('[data-launch-warning]')).toHaveTextContent(/no recall/i);
    expect(commitControl()).toHaveTextContent(/no recall/i);
    expect(document.querySelector('[data-launch-recall]')).toBeNull();
  });

  it('states the flight in figures: the leg, the landing, the exposure, the hold and the bays', async () => {
    open('world');
    await pick('2');
    const grid = document.querySelector<HTMLElement>('[data-launch-figures]')!;
    for (const label of [/one way/i, /exposed/i, /cargo/i, /flight bays/i]) {
      expect(within(grid).getByText(label)).toBeInTheDocument();
    }
    expect(within(grid).getByText(/^at /)).toBeInTheDocument();
  });

  /* Owner correction D183: the tank travels with the force it buys, inside the sticky ruler. */
  it('keeps the tank inside the force ruler', async () => {
    open('world');
    await pick('2');
    const ruler = document.querySelector<HTMLElement>('[data-force-ruler]')!;
    expect(ruler.querySelector('[data-launch-meters]')).not.toBeNull();
  });
});
