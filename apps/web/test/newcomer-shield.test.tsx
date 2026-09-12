import type { ReactNode } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Api } from '../src/api/client.js';
import { ApiProvider } from '../src/api/context.js';
import { keys } from '../src/api/keys.js';
import i18n from '../src/i18n/index.js';
import { LaunchSheet } from '../src/screens/LaunchSheet.js';
import { NewcomerShield } from '../src/shell/StatusBar.js';
import { ToastProvider } from '../src/ui/Toast.js';
import type { GalaxyPlanet } from '../src/api/schemas.js';
import { planetView } from './fixtures.js';

/**
 * THE FIRST DAY IS SAFE, AND THE PLAYER IS TOLD WHAT SPENDING IT COSTS. D183,
 * owner instruction: *"Kişi kendisi saldırı yapmak isterse uyarı verilir ve kabul
 * ederse kalkanı kalkar."*
 *
 * The server refuses once with `SHIELD_WOULD_DROP` rather than spending the shield
 * silently, and this is the surface that turns that refusal into a decision. D124:
 * a rule the player cannot see is not a usable rule — and a shield spent without
 * being offered is worse than one that was never granted, because the player
 * learns it existed at the moment it is gone.
 *
 * TWO SIDES, TWO DIFFERENT SENTENCES. A shielded TARGET is a refusal (nothing can
 * be sent), while the caller's OWN shield is a price (something can be sent, at a
 * cost). Both belong on this sheet, which is the last screen before a fleet stops
 * being recallable.
 */
const target: GalaxyPlanet = {
  id: 'their-world',
  name: 'Orrery-8',
  owner: 'Sable',
  kind: 'CAPITAL',
  position: { x: 400, y: 0, z: 0 },
  coreTier: 2,
  coreLevel: 6,
  satellites: [],
  shielded: false,
  isSelf: false,
  isOwned: false,
  isCapital: true,
  intel: 'RESOLVED',
  state: { kind: 'NORMAL' },
};

const mine = planetView(
  {
    buildings: { CORE: 6, REFINERY: 2, EXTRACTOR: 2, VAULT: 0, SHIPYARD: 2 },
    fleet: { DART: 20 },
  },
  { deuterium: 50_000 },
);

function show(shieldUntil: Date | null) {
  const api = new Api({ fetch: vi.fn() as unknown as typeof globalThis.fetch });
  const launch = vi.spyOn(api, 'launch').mockResolvedValue({
    missionId: 'm1',
    arriveAt: new Date(Date.now() + 600_000),
    exposureMinutes: 20,
    homeDefenceAfter: 4,
    pending: [],
    planet: mine,
  } as never);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(keys.season, { rivals: [], shieldUntil });

  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>
      <ApiProvider api={api}><ToastProvider>{children}</ToastProvider></ApiProvider>
    </QueryClientProvider>
  );
  render(
    <Wrapper>
      <LaunchSheet
        target={{ kind: 'world', world: target }}
        planet={mine}
        onClose={vi.fn()}
        onLaunched={vi.fn()}
      />
    </Wrapper>,
  );
  return { launch };
}

beforeEach(async () => { await i18n.changeLanguage('en'); });

describe('the first-day shield on the launch sheet', () => {
  const commit = async () => {
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /more dart/i }));
    await user.click(screen.getByRole('button', { name: /^send/i }));
    return user;
  };

  it('says nothing at all to a commander who has no shield', async () => {
    show(null);
    await commit();
    expect(screen.queryByText(/first-day shield/i)).toBeNull();
  });

  /**
   * THE PRICE SITS WITH THE OTHER THING THIS PRESS COSTS. The confirmation step
   * already states that the world is left uncovered; the shield is the second half
   * of the same sentence, and reading them apart is reading half a decision.
   */
  it('states the price beside the confirmation, in the same breath as the exposure', async () => {
    show(new Date(Date.now() + 6 * 3_600_000));
    await commit();
    expect(screen.getByText(/first-day shield/i)).toBeInTheDocument();
  });

  it('sends the acknowledgement only once the commander has confirmed', async () => {
    const { launch } = show(new Date(Date.now() + 6 * 3_600_000));
    const user = await commit();
    expect(launch).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: /launch|commit|confirm/i }));
    await waitFor(() => { expect(launch).toHaveBeenCalled(); });
    // The flag rides the launch that was confirmed, never a launch that was not.
    expect(launch.mock.calls[0]).toContain(true);
  });

  it('sends no acknowledgement when there is no shield to spend', async () => {
    const { launch } = show(null);
    const user = await commit();
    await user.click(screen.getByRole('button', { name: /launch|commit|confirm/i }));
    await waitFor(() => { expect(launch).toHaveBeenCalled(); });
    expect(launch.mock.calls[0]).not.toContain(true);
  });
});

describe('the first-day shield in the permanent HUD', () => {
  const showStatus = (shieldUntil: Date | null) => {
    const api = new Api({ fetch: vi.fn() as unknown as typeof globalThis.fetch });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    client.setQueryData(keys.season, { rivals: [], shieldUntil });
    render(
      <QueryClientProvider client={client}>
        <ApiProvider api={api}><NewcomerShield /></ApiProvider>
      </QueryClientProvider>,
    );
  };

  /**
   * THE GLYPH CARRIES THE NAME; THE COUNTDOWN IS THE FACT. Owner report.
   *
   * The chip used to write "Raid shield" beside a shield icon that already says
   * it, on the row that also holds the works meter, its collect button and the
   * store's own "full" warning — and when that warning appeared the controls ran
   * into each other. What has to survive is the countdown and the sentence a
   * screen reader gets, which is what this asserts.
   */
  it('shows how long the protection has left, and says why in full to a reader', () => {
    showStatus(new Date(Date.now() + 6 * 3_600_000));
    expect(screen.getByText(/5h 59m|6h 00m/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/cannot be raided/i)).toBeInTheDocument();
  });

  /*
    ASSERTED ON THE CHIP ITSELF, not on a word inside it: this used to look for
    "Raid shield", so once that text was dropped the test passed whether or not the
    badge was still on screen.
  */
  it('takes the stale badge away once its timestamp has passed', () => {
    showStatus(new Date(Date.now() - 1));
    expect(screen.queryByLabelText(/cannot be raided/i)).toBeNull();
    expect(document.querySelector('[data-newcomer-shield]')).toBeNull();
  });
});
