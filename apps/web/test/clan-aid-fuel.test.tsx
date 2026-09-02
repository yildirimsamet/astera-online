import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { distance, missionFuel } from '@astera/rules';
import { Api } from '../src/api/client.js';
import { ApiProvider } from '../src/api/context.js';
import { WorldProvider } from '../src/api/world.js';
import { keys } from '../src/api/keys.js';
import { planetsSchema } from '../src/api/schemas.js';
import i18n from '../src/i18n/index.js';
import { ClanScreen } from '../src/screens/ClanScreen.js';
import { planetView } from './fixtures.js';

/**
 * A GIFT COSTS THE SENDER A FLIGHT, AND THIS FORM NEVER SAID SO. T6.
 *
 * `launchClanAid` charges one leg at launch and refuses `INSUFFICIENT_FUEL` when
 * the tank cannot cover it. `quoteClanAid` was given a `fuel` figure and a
 * `hasFuel` verdict for exactly that reason — the plan named the failure by name:
 * *"the aid quote lies: it says send this, and the launch refuses it"*.
 *
 * The client then ignored both fields. A commander packed three Couriers, pressed
 * Check, read a quote that said the flight fits and the receiver has room, pressed
 * Send — and got a refusal with nothing on the screen that could have predicted
 * it, and no figure saying how much deuterium was missing.
 *
 * DRAWN LIVE, off `missionFuel` against the origin's own store, so the cost is
 * visible while the fleet is being packed rather than after a round trip. Same
 * function, same shape and same reasoning as the transfer sheet next door.
 */

const past = new Date(Date.now() - 60 * 60 * 1_000);
const AWAY = { x: 1_500, y: 0, z: 0 };
const HOME = { x: 0, y: 0, z: 0 };

const home = {
  state: 'MEMBER' as const,
  clan: {
    id: 'clan-orbit',
    name: 'Orbit Wardens',
    tag: 'ORB',
    description: 'Watch the rim. Bring everyone home.',
    recruiting: true,
    score: 840,
    role: 'LEADER' as const,
    matureAt: past,
    mature: true,
    aidEnabled: true,
  },
  members: [
    {
      playerId: 'player-me', username: 'Vantage', role: 'LEADER' as const, slot: 0,
      joinedAt: past, matureAt: past, mature: true, aidEnabled: true, lastActiveAt: past,
      activeRecently: true,
    },
    {
      playerId: 'player-ada', username: 'Ada', role: 'MEMBER' as const, slot: 1,
      joinedAt: past, matureAt: past, mature: true, aidEnabled: true, lastActiveAt: past,
      activeRecently: true,
    },
  ],
  requests: [],
};

const quote = {
  clanId: 'clan-orbit',
  canLand: true,
  withinAllowance: true,
  bay: { used: 0, total: 3, available: true },
  cargoCapacity: 4_000,
  value: { alloy: 0, crystal: 0, deuterium: 0 },
  remaining: { alloy: 9_000, crystal: 4_000, deuterium: 900 },
  nextReleaseAt: null,
  arriveAt: new Date(Date.now() + 20 * 60_000),
  possibleReturnAt: new Date(Date.now() + 40 * 60_000),
  canFinishBeforeSeasonEnd: true,
  travelMinutes: 20,
};

function show(deuterium: number) {
  const api = new Api({ fetch: vi.fn() as unknown as typeof globalThis.fetch });
  vi.spyOn(api, 'clanHome').mockResolvedValue(home);
  const world = planetView({ fleet: { COURIER: 4 } }, { deuterium, alloy: 9_000, crystal: 4_000 });
  /*
    THROUGH THE SCHEMA, so this fixture is the payload `/api/planets` actually
    sends rather than a hand-shaped object that resembles it — the same reason
    `fixtures.ts` exists at all.
  */
  const planets = planetsSchema.parse({
    playerId: 'player-me',
    seasonId: 'season-1',
    capitalPlanetId: world.planet.id,
    planets: [world],
  });
  vi.spyOn(api, 'planets').mockResolvedValue(planets);

  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  client.setQueryData(keys.clanHome, home);
  client.setQueryData(keys.planets, planets);
  client.setQueryData(keys.clanAid, { transfers: [] });
  client.setQueryData(keys.clanBadge, {
    available: true,
    membership: {
      clanId: 'clan-orbit', name: 'Orbit Wardens', tag: 'ORB',
      role: 'LEADER', matureAt: past, mature: true,
    },
    attention: false,
    attentionCount: 0,
    clanChatUnread: 0,
  });
  client.setQueryData(keys.galaxy, {
    you: {
      planetId: world.planet.id,
      playerId: 'player-me',
      capitalPlanetId: world.planet.id,
      planetIds: [world.planet.id],
    },
    clanPresence: {
      clan: { id: 'clan-orbit', name: 'Orbit Wardens', tag: 'ORB' },
      members: [
        {
          playerId: 'player-me', username: 'Vantage',
          worlds: [{ planetId: world.planet.id, name: world.planet.name, position: HOME }],
        },
        {
          playerId: 'player-ada', username: 'Ada',
          worlds: [{ planetId: 'planet-ada', name: 'Lantern', position: AWAY }],
        },
      ],
    },
    planets: [
      {
        id: world.planet.id, name: world.planet.name, owner: 'Vantage', position: HOME,
        coreTier: 3, satellites: [], shielded: false, isSelf: true,
        controller: { kind: 'PLAYER' as const, playerId: 'player-me', displayName: 'Vantage' },
      },
      {
        id: 'planet-ada', position: AWAY, intel: 'UNKNOWN' as const,
        isSelf: false, isOwned: false,
      },
    ],
  });

  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>
      <ApiProvider api={api}>
        <WorldProvider>{children}</WorldProvider>
      </ApiProvider>
    </QueryClientProvider>
  );
  render(<Wrapper><ClanScreen /></Wrapper>);
  return { api };
}

/** One Courier, from the fixture world to the clanmate's rim world. */
const oneCourier = missionFuel({ COURIER: 1 }, distance(HOME, AWAY), 1);
const returningCourier = missionFuel({ COURIER: 1 }, distance(HOME, AWAY), 2);

async function packOneCourier(): Promise<void> {
  const user = userEvent.setup();
  await user.click(await screen.findByRole('tab', { name: 'Aid' }));
  await user.click(await screen.findByRole('button', { name: /send more courier/i }));
}

afterEach(async () => {
  vi.restoreAllMocks();
  await i18n.changeLanguage('en');
});

describe('the fuel a clan gift burns', () => {
  it('draws the flight against the tank while the convoy is packed', async () => {
    show(5_000);
    await packOneCourier();

    const bar = document.querySelector('[data-aid-fuel] [data-spend-bar]');
    expect(bar, 'the aid form never says what the flight burns').not.toBeNull();
    expect(bar).toHaveAttribute('data-short', 'false');
    expect(oneCourier).toBeGreaterThan(0);
  });

  it('quotes two fuel legs once the Courier is carrying resources home again', async () => {
    show(5_000);
    await packOneCourier();
    const alloy = screen.getByRole('spinbutton', { name: 'Alloy' });
    await userEvent.setup().clear(alloy);
    await userEvent.setup().type(alloy, '100');

    const fuel = document.querySelector('[data-aid-fuel] [role="img"]');
    expect(fuel?.getAttribute('aria-label')).toContain(`${String(returningCourier)} spent`);
    expect(returningCourier).toBe(oneCourier * 2);
  });

  it('runs past the end of a tank that cannot cover it, and names the gap', async () => {
    show(0);
    await packOneCourier();

    const bar = document.querySelector('[data-aid-fuel] [data-spend-bar]');
    expect(bar).toHaveAttribute('data-short', 'true');
    expect(document.querySelector('[data-aid-fuel] [data-spend-short]')).toBeInTheDocument();
  });

  /**
   * AND THE COMMITMENT IS REFUSED BEFORE IT IS TAKEN. A quote that says "fits,
   * ready, room" over a control the server will refuse is worse than no quote.
   */
  it('will not send a gift the origin cannot fly', async () => {
    const { api } = show(0);
    vi.spyOn(api, 'quoteClanAid').mockResolvedValue(quote);
    await packOneCourier();

    await userEvent.setup().click(screen.getByRole('button', { name: 'Check flight' }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /send — no recall/i })).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: /send — no recall/i })).toBeDisabled();
  });

  it('sends it once the tank covers the leg', async () => {
    const { api } = show(5_000);
    vi.spyOn(api, 'quoteClanAid').mockResolvedValue(quote);
    await packOneCourier();

    await userEvent.setup().click(screen.getByRole('button', { name: 'Check flight' }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /send — no recall/i })).toBeEnabled();
    });
  });
});
