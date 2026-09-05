import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { HULLS } from '@astera/rules';
import { PlanetScreen } from '../src/screens/PlanetScreen.js';
import { ToastProvider } from '../src/ui/Toast.js';
import type { PlanetView } from '../src/api/schemas.js';
import { openAllBands, planetView } from './fixtures.js';

/**
 * THE SHIPYARD TEACHES THE CYCLE; THE LAUNCH SHEET ONLY HAS TO REMIND. D124.
 *
 * A hull is chosen for good HERE and committed under a clock elsewhere, so this is
 * where a commander has the attention to learn what a Lance is. Before this the tab
 * grouped hulls by FAMILY — Offensive · Defensive · Special · Cargo — which is a
 * purchasing taxonomy running at right angles to the combat one, and it implied the
 * exact inverse of the rule: Pike is Offensive, Rampart is Defensive, and the
 * Rampart beats the Pike.
 *
 * Both surfaces are checked here: the ROW carries the class so a list can be
 * scanned by role, and the SHEET one tap deeper carries the whole cycle — the
 * progressive disclosure that keeps a wiki off the screen.
 */

const rich = (over: Partial<Omit<PlanetView, 'planet'>> = {}): PlanetView =>
  planetView(
    {
      buildings: { CORE: 6, REFINERY: 3, EXTRACTOR: 3, VAULT: 1, SHIPYARD: 4, HANGAR: 4 },
      orbitSlots: 3,
      fleet: {},
      fleetAway: {},
      score: { wealth: 10_000, dominion: 0 },
      ...over,
    },
    { alloy: 900_000, crystal: 400_000, alloyCap: 2_000_000, crystalCap: 900_000 },
  );

let current: PlanetView = rich();

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

const show = (focusGroup: 'grow' | 'orbit' | 'defend' | 'reach' = 'reach') => {
  current = rich();
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <PlanetScreen focusGroup={focusGroup} />
      </ToastProvider>
    </QueryClientProvider>,
  );
};

const rowFor = (view: ReturnType<typeof render>, hull: string) =>
  view.container.querySelector<HTMLElement>(`[data-hull-id="${hull}"]`);

describe('the class on a shipyard row', () => {
  it('marks a hull with the role it fights as', () => {
    const view = show();
    const pike = rowFor(view, 'PIKE');
    expect(pike).not.toBeNull();
    expect(pike!.querySelector('[data-class]')).toHaveAttribute('data-class', 'LANCE');
  });

  /**
   * THE ROW SAYS SOMETHING ITS BAND DOES NOT, and this is the pair that proves it:
   * two hulls in opposite shipyard families whose combat relation runs the other
   * way. If these two ever read the same, the chip has stopped earning its space.
   */
  it('separates hulls the family bands put together and vice versa', async () => {
    const view = show();
    // Rampart is behind the Defensive band, which the tab folds shut on arrival.
    await openAllBands(screen, userEvent.setup());
    const dart = rowFor(view, 'DART')!.querySelector('[data-class]');
    const pike = rowFor(view, 'PIKE')!.querySelector('[data-class]');
    const rampart = rowFor(view, 'RAMPART')!.querySelector('[data-class]');

    // Dart and Pike share a family and fight as opposites.
    expect(HULLS.DART.family).toBe(HULLS.PIKE.family);
    expect(dart).toHaveAttribute('data-class', 'SKIRMISHER');
    expect(pike).toHaveAttribute('data-class', 'LANCE');

    // Rampart is in the OTHER family and is what beats the Pike.
    expect(HULLS.RAMPART.family).not.toBe(HULLS.PIKE.family);
    expect(rampart).toHaveAttribute('data-class', 'BULWARK');
  });
});

describe('the whole cycle, one tap deeper', () => {
  it('draws all three rungs on a hull sheet, with this hull lit', async () => {
    const view = show();
    await userEvent.click(screen.getByRole('button', { name: /about pike/i }));

    const sheet = view.container.querySelector('[data-counter-cycle]');
    expect(sheet, 'the build sheet draws no counter cycle').not.toBeNull();
    expect(sheet!.querySelector('[data-rung="LANCE"]')).toHaveAttribute('data-current', 'true');
    expect(sheet!.querySelector('[data-rung="SKIRMISHER"]')).not.toBeNull();
    expect(sheet!.querySelector('[data-rung="BULWARK"]')).not.toBeNull();
  });

  it('names what this hull beats and what beats it', async () => {
    show();
    await userEvent.click(screen.getByRole('button', { name: /about pike/i }));
    // A Lance punishes Skirmishers and breaks against Bulwarks.
    expect(screen.getByTestId('counter-strong')).toHaveTextContent(/skirmisher/i);
    expect(screen.getByTestId('counter-weak')).toHaveTextContent(/bulwark/i);
  });

  /** The batch's yard time, on the sheet where the batch size is chosen. */
  it('quotes how long the order will take', async () => {
    show();
    await userEvent.click(screen.getByRole('button', { name: /about pike/i }));
    expect(screen.getByTestId('build-sheet-time')).toBeInTheDocument();
  });
});
