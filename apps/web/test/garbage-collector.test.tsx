import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MOBILE_HULLS, SALVAGE } from '@astera/rules';
import { Api } from '../src/api/client.js';
import { ApiProvider } from '../src/api/context.js';
import type { GalaxyPlanet, NotificationView } from '../src/api/schemas.js';
import { rankRow, STAR } from '../src/galaxy/rank.js';
import { hullLabel } from '../src/i18n/names.js';
import { compact } from '../src/lib/format.js';
import { describeNotification } from '../src/lib/notifications.js';
import { familyGroups } from '../src/lib/roster.js';
import { LaunchSheet } from '../src/screens/LaunchSheet.js';
import { StatStrip } from '../src/ui/Action.js';
import { ToastProvider } from '../src/ui/Toast.js';
import { planetView } from './fixtures.js';

const AT = new Date('2026-09-11T12:00:00.000Z');

const news = (kind: string, payload: Record<string, unknown>): NotificationView => ({
  id: 'n1',
  kind,
  refId: 'r1',
  payload,
  seen: false,
  at: AT,
});

const lifted = { salvageAlloy: 9_000, salvageCrystal: 5_000, salvageDeuterium: 1_000 };

beforeEach(async () => {
  const i18n = (await import('../src/i18n/index.js')).default;
  await i18n.changeLanguage('en');
});

/**
 * THE GARBAGE COLLECTOR ON THE SCREENS A PLAYER MEETS IT ON. D200.
 *
 * A hull that fires nothing and carries nothing has one number worth printing —
 * how much wreck it lifts — and every surface that shows the hull or its haul has
 * to say it, or the ship reads as fifteen thousand spent on a hull with no stats.
 */
describe('the Garbage Collector in the catalogue', () => {
  it('lives in the Special band, after the Nullifier', () => {
    const special = familyGroups(MOBILE_HULLS).find((group) => group.family === 'SPECIALIST');
    expect(special?.hulls).toEqual(['NULLIFIER', 'GARBAGE_COLLECTOR']);
  });

  /**
   * THE BADGE ANSWERS "IS THIS COMING FOR ME", and a hull that fires nothing is
   * not. It flies behind the line the way a transport does, so it wears the
   * transport's mark — never the Special family's sword, which it would wear if the
   * glyph were read off the family alone.
   */
  it('wears a support crate with three stars, never a sword', () => {
    expect(rankRow('GARBAGE_COLLECTOR')).toEqual(['crate', STAR, STAR, STAR]);
    expect(rankRow('NULLIFIER')).toEqual(['sword', STAR, STAR, STAR]);
  });

  it('has a name in both languages', async () => {
    expect(hullLabel('GARBAGE_COLLECTOR')).toBe('Garbage Collector');
    const i18n = (await import('../src/i18n/index.js')).default;
    await i18n.changeLanguage('tr');
    expect(hullLabel('GARBAGE_COLLECTOR')).toBe('Hurdacı');
  });

  it('prints what it lifts where a hold would read nothing', () => {
    render(
      <StatStrip atk={0} hp={540} speed={151} cargo={0} fuel={1.9} salvage={SALVAGE.perCollector} size="card" />,
    );
    expect(screen.getByText('Salvage')).toBeVisible();
    expect(screen.getByText(compact(SALVAGE.perCollector))).toBeVisible();
    expect(screen.queryByText('Cargo')).not.toBeInTheDocument();
  });

  it('leaves every other hull’s hold exactly where it was', () => {
    render(<StatStrip atk={21} hp={77} speed={202} cargo={30} fuel={0.7} size="card" />);
    expect(screen.getByText('Cargo')).toBeVisible();
    expect(screen.queryByText('Salvage')).not.toBeInTheDocument();
  });
});

describe('what the Garbage Collector brought home, in Signals', () => {
  it('names the salvage in the raid result, apart from the loot', () => {
    const line = describeNotification(news('raid_result', {
      grade: 'DECISIVE', targetUsername: 'Sable', targetPlanetName: 'Tharsis',
      lootAlloy: 400, lootCrystal: 100, lootDeuterium: 0, unitsLost: 3, shipsHome: 40,
      ...lifted,
    }), AT.getTime());
    expect(line).toMatch(/15k salvage/);
  });

  it('says nothing about salvage when no collector lifted anything', () => {
    const line = describeNotification(news('raid_result', {
      grade: 'DECISIVE', targetUsername: 'Sable', targetPlanetName: 'Tharsis',
      lootAlloy: 400, lootCrystal: 100, lootDeuterium: 0, unitsLost: 3, shipsHome: 40,
    }), AT.getTime());
    expect(line).not.toMatch(/salvage/i);
  });

  it('counts the salvage among what landed when the raid comes home', () => {
    const line = describeNotification(news('fleet_returned', {
      trip: 'raid', ships: 40, fromUsername: 'Sable', fromPlanetName: 'Tharsis',
      lootAlloy: 400, lootCrystal: 100, lootDeuterium: 0, ...lifted,
    }), AT.getTime());
    expect(line).toMatch(/15k salvage/);
  });

  it('comes home with salvage even when the hold came home empty', () => {
    const line = describeNotification(news('fleet_returned', {
      trip: 'raid', ships: 12, lootAlloy: 0, lootCrystal: 0, lootDeuterium: 0, ...lifted,
    }), AT.getTime());
    expect(line).toMatch(/15k salvage/);
    expect(line).not.toMatch(/empty-handed/i);
  });

  it('counts it on a pirate homecoming too', () => {
    const line = describeNotification(news('fleet_returned', {
      trip: 'pirate', ships: 30, lootAlloy: 800, lootCrystal: 200, lootDeuterium: 0, ...lifted,
    }), AT.getTime());
    expect(line).toMatch(/15k salvage/);
  });
});

describe('the Garbage Collector on the launch sheet', () => {
  const target: GalaxyPlanet = {
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

  const wrapper = ({ children }: { children: ReactNode }) => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const api = new Api({ fetch: vi.fn() as unknown as typeof globalThis.fetch });
    return (
      <QueryClientProvider client={client}>
        <ApiProvider api={api}>
          <ToastProvider>{children}</ToastProvider>
        </ApiProvider>
      </QueryClientProvider>
    );
  };

  const openAllBands = async (user: ReturnType<typeof userEvent.setup>) => {
    for (const band of screen.queryAllByRole('button', { expanded: false })) {
      await user.click(band);
    }
  };

  it('states how much wreck the chosen collectors can lift, before anything is committed', async () => {
    render(
      <LaunchSheet
        target={{ kind: 'world', world: target }}
        planet={planetView({ fleet: { DART: 10, GARBAGE_COLLECTOR: 3 } })}
        onClose={vi.fn()}
        onLaunched={vi.fn()}
      />,
      { wrapper },
    );
    const user = userEvent.setup();
    await openAllBands(user);
    expect(screen.queryByTestId('launch-salvage')).not.toBeInTheDocument();

    await user.type(screen.getByRole('textbox', { name: /dart quantity/i }), '5');
    await user.type(screen.getByRole('textbox', { name: /garbage collector quantity/i }), '2');
    const line = screen.getByTestId('launch-salvage');
    expect(within(line).getByText(new RegExp(compact(2 * SALVAGE.perCollector)))).toBeVisible();
  });
});
