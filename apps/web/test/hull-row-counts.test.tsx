import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { PlanetScreen } from '../src/screens/PlanetScreen.js';
import { ToastProvider } from '../src/ui/Toast.js';
import type { PlanetView } from '../src/api/schemas.js';
import { openAllBands, planetView } from './fixtures.js';
import i18n from '../src/i18n/index.js';
import { UpgradeRow } from '../src/ui/UpgradeRow.js';

/**
 * WHERE EACH HULL IS, ON ITS OWN ROW. Owner report: the line that read
 * *"3 evde 2 dışarıda"* beside a hull's name had gone.
 *
 * It had, and deliberately: it printed "(Home: 1, Away: 0)" beside every hull
 * while the gain line two rows down said "You have 1 → 2", which is the same fact
 * twice and left the NAME about fifty pixels at 350. The owner wants both halves
 * back, so the fix is the WIDTH rather than the information — one compact line,
 * both figures, and no parentheses or labels spelling out what the numbers are.
 */

const rich = (fleet: Record<string, number>, away: Record<string, number>): PlanetView =>
  planetView(
    {
      buildings: { CORE: 6, REFINERY: 3, EXTRACTOR: 3, VAULT: 1, SHIPYARD: 4 },
      orbitSlots: 3,
      fleet,
      fleetAway: away,
      score: { wealth: 10_000, dominion: 0 },
    },
    { alloy: 900_000, crystal: 400_000, alloyCap: 2_000_000, crystalCap: 900_000 },
  );

let current: PlanetView = rich({}, {});

vi.mock('../src/api/queries.js', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('../src/api/queries.js');
  return {
    ...actual,
    usePlanet: () => ({ data: current, dataUpdatedAt: Date.now(), isPending: false, refetch: vi.fn() }),
    useGalaxy: () => ({ data: undefined }),
    useIntel: () => ({ data: undefined }),
    usePending: () => ({ data: undefined }),
    useReports: () => ({ data: undefined }),
    useUpgrade: () => ({ mutate: vi.fn(), isPending: false }),
    useBuild: () => ({ mutate: vi.fn(), isPending: false }),
    useCompleteResearch: () => ({ mutate: vi.fn(), isPending: false }),
    useInstallSatellite: () => ({ mutate: vi.fn(), isPending: false }),
    useRaiseInstrument: () => ({ mutate: vi.fn(), isPending: false }),
    useCancelBuildOrder: () => ({ mutate: vi.fn(), isPending: false }),
    useBuildDeathStar: () => ({ mutate: vi.fn(), isPending: false }),
    useBuildInterceptor: () => ({ mutate: vi.fn(), isPending: false }),
  };
});

const show = async (fleet: Record<string, number>, away: Record<string, number> = {}) => {
  current = rich(fleet, away);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const view = render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <PlanetScreen focusGroup="reach" />
      </ToastProvider>
    </QueryClientProvider>,
  );
  await openAllBands(screen, userEvent.setup());
  return view;
};

const rowFor = (view: ReturnType<typeof render>, hull: string) =>
  view.container.querySelector<HTMLElement>(`[data-hull-id="${hull}"]`)!;

describe('a hull row says where its craft are', () => {
  it('states home and away together', async () => {
    const view = await show({ DART: 3 }, { DART: 2 });
    expect(within(rowFor(view, 'DART')).getByTestId('hull-where'))
      .toHaveTextContent(i18n.t('planet.reach.hullLocationCounts', { home: 3, away: 2 }));
  });

  /** Zero out is a real answer — "everything I own is here" is worth reading. */
  it('says zero away rather than going silent', async () => {
    const view = await show({ DART: 5 }, {});
    expect(within(rowFor(view, 'DART')).getByTestId('hull-where'))
      .toHaveTextContent(i18n.t('planet.reach.hullLocationCounts', { home: 5, away: 0 }));
  });

  it('counts craft that are entirely away', async () => {
    const view = await show({}, { DART: 4 });
    expect(within(rowFor(view, 'DART')).getByTestId('hull-where'))
      .toHaveTextContent(i18n.t('planet.reach.hullLocationCounts', { home: 0, away: 4 }));
  });

  /**
   * IT STAYS SHORT. `visual-design.md` budgets a full-width row at ~241px for text
   * after the socket, padding and chevron, and this line shares that with the
   * hull's name. Labels spelled out in words are what cost the name its width the
   * first time round.
   */
  it('is short enough to leave the name its width', () => {
    expect(i18n.t('planet.reach.hullLocationCounts', { home: 12, away: 12 }).length)
      .toBeLessThanOrEqual(14);
  });

  /**
   * THE NAME LINE ANSWERS "WHAT IS IT" AND "WHERE IS IT" TOGETHER. Owner
   * instruction: *"Dart (Lv1) - 3 in 4 out"*.
   *
   * Both halves used to sit on the SUPPORT line under the name, beside the class
   * chip and the flavour tag — so a commander scanning a banded list read four
   * hull names down the first line and had to drop to a second, dimmer line for
   * the two facts that decide anything. Identity and holding are one glance.
   *
   * A HULL HAS NO LEVEL, SO THE TIER TAKES THE SLOT the numeral occupies on a
   * building row. It is the same fact the rank badge draws on the disc and the
   * same one `FLEET_V2_ASSET_MANIFEST` sizes the model by; the row was the only
   * surface in the game that never stated it.
   */
  it('states the tier and the holding on the name line', async () => {
    const view = await show({ DART: 3 }, { DART: 4 });
    const line = rowFor(view, 'DART').querySelector<HTMLElement>('[data-row-line="name"]')!;
    expect(line).toHaveTextContent(i18n.t('planet.reach.hullTier', { tier: 1 }));
    expect(line).toHaveTextContent(i18n.t('planet.reach.hullLocationCounts', { home: 3, away: 4 }));
  });

  it('gives each tier its own mark', async () => {
    const view = await show({ DART: 1, VIPER: 1, TEMPEST: 1, CATACLYSM: 1 }, {});
    for (const [hull, tier] of [['DART', 1], ['VIPER', 2], ['TEMPEST', 3], ['CATACLYSM', 4]] as const) {
      expect(rowFor(view, hull).querySelector<HTMLElement>('[data-row-line="name"]'), hull)
        .toHaveTextContent(i18n.t('planet.reach.hullTier', { tier }));
    }
  });

  /**
   * A GUN AND A PROSPECTOR HAVE NO TIER, and an empty mark is worse than none.
   * Asserted on the component, because the two guns and the Prospector are not in
   * the `reach` group this file renders — a fixture that had to pull in another
   * band to prove a negative would be testing the band, not the mark.
   */
  it('draws no tier mark on a hull that has none', () => {
    const view = render(
      <UpgradeRow
        name="Thorn"
        nameAside="2 in · 0 out"
        role="ground gun"
        cost={{ alloy: 600, crystal: 150 }}
        held={{ alloy: 900, crystal: 900 }}
        verb="build"
        onAct={() => undefined}
        onOpen={() => undefined}
      />,
    );
    expect(view.queryByTestId('hull-tier')).toBeNull();
    expect(view.getByTestId('hull-where')).toHaveTextContent('2 in · 0 out');
  });
});
