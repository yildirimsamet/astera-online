import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { PlanetScreen } from '../src/screens/PlanetScreen.js';
import { ToastProvider } from '../src/ui/Toast.js';
import type { PlanetView } from '../src/api/schemas.js';
import { openAllBands, planetView } from './fixtures.js';
import i18n from '../src/i18n/index.js';

/**
 * WHERE EACH HULL IS, ON ITS OWN ROW. Owner report: the line that read
 * *"3 evde 2 dışarıda"* beside a hull's name had gone.
 *
 * It had, and deliberately: it printed "(Home: 1, Away: 0)" beside every hull
 * while the gain line two rows down said "You have 1 → 2", which is the same fact
 * twice and left the NAME about fifty pixels at 375. The owner wants both halves
 * back, so the fix is the WIDTH rather than the information — one compact line,
 * both figures, and no parentheses or labels spelling out what the numbers are.
 */

const rich = (fleet: Record<string, number>, away: Record<string, number>): PlanetView =>
  planetView(
    {
      buildings: { CORE: 6, REFINERY: 3, EXTRACTOR: 3, VAULT: 1, SHIPYARD: 4, HANGAR: 4 },
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
});
