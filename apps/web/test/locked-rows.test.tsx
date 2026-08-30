import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PlanetScreen } from '../src/screens/PlanetScreen.js';
import i18n from '../src/i18n/index.js';
import { ToastProvider } from '../src/ui/Toast.js';
import type { PlanetView } from '../src/api/schemas.js';
import { planetView } from './fixtures.js';

/**
 * A SHUT DOOR SAYS WHY, AND SAYS WHERE. Owner instruction.
 *
 * `docs/interface.md` I1 has said "a requirement is a door, not an alarm" since it
 * was written, and every row was supposed to carry a reason. This walks the whole
 * planet sheet instead of trusting that: every row, every tab, on a world that has
 * almost nothing — which is the state a real player is in for their first hour, and
 * the state in which nearly everything is locked.
 *
 * TWO THINGS ARE ASSERTED AND THEY ARE DIFFERENT. A reason is a sentence; a FIX is
 * a way to get to the thing that would close it. A row may honestly have no fix —
 * an act clock is not something you can go and build — but a row whose reason names
 * another PART OF THE GAME must be able to take you there, or the player is told
 * what to do and left to find it.
 */

vi.mock('../src/api/queries.js', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('../src/api/queries.js');
  return {
    ...actual,
    usePlanet: () => ({ data: current, dataUpdatedAt: Date.now(), isPending: false }),
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

/** A world on its first morning: everything is shut and everything must say so. */
let current: PlanetView = planetView();

const TABS = ['grow', 'orbit', 'defend', 'reach'] as const;

interface Shut {
  tab: string;
  id: string;
  reason: string;
  fix: boolean;
}

const sweep = (): Shut[] => {
  const shut: Shut[] = [];
  for (const tab of TABS) {
    current = planetView(
      { buildings: { CORE: 1, REFINERY: 1, EXTRACTOR: 1, VAULT: 0, SHIPYARD: 0, HANGAR: 0 } },
      { alloy: 0, crystal: 0, deuterium: 0 },
    );
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const view = render(
      <QueryClientProvider client={client}>
        <ToastProvider>
          <PlanetScreen focusGroup={tab} />
        </ToastProvider>
      </QueryClientProvider>,
    );
    for (const row of view.container.querySelectorAll('[id^="row-"]')) {
      const state = row.querySelector('[data-progression-state]')
        ?.getAttribute('data-progression-state');
      if (state !== 'locked') continue;
      shut.push({
        tab,
        id: row.id.slice('row-'.length),
        reason: row.querySelector('[data-blocked-reason]')?.textContent.trim() ?? '',
        fix: row.querySelector('[data-has-fix]') !== null,
      });
    }
    view.unmount();
  }
  return shut;
};

beforeEach(async () => {
  // jsdom has no layout, so no `scrollIntoView`; the screen calls it unguarded to
  // put the thing it just pointed at in front of the player.
  Element.prototype.scrollIntoView = vi.fn();
  await i18n.changeLanguage('en');
});

describe('every locked row on the planet sheet', () => {
  it('locks something, or this test is measuring nothing', () => {
    expect(sweep().length).toBeGreaterThan(3);
  });

  it('states a reason on every one of them', () => {
    const silent = sweep().filter((row) => row.reason.length === 0);
    expect(silent.map((row) => `${row.tab}/${row.id}`)).toEqual([]);
  });

  /**
   * The reason names another part of the game — a Core level, a Shipyard, a
   * research project — so there has to be a way to go there. Only a clock has no
   * fix, and a clock says "in 3h", which is the shape excluded here.
   */
  it('offers a way to the thing that would open it', () => {
    const stranded = sweep().filter((row) => !row.fix && !/\bin\b|opens/i.test(row.reason));
    expect(stranded.map((row) => `${row.tab}/${row.id}: ${row.reason}`)).toEqual([]);
  });
});

/**
 * AND PRESSING IT GOES THERE. The half a sweep cannot check: that the arrow on the
 * sentence is wired to the thing the sentence names.
 */
describe('pressing the reason', () => {
  const openTab = (tab: 'grow' | 'orbit' | 'defend' | 'reach', view: PlanetView) => {
    current = view;
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(
      <QueryClientProvider client={client}>
        <ToastProvider>
          <PlanetScreen focusGroup={tab} />
        </ToastProvider>
      </QueryClientProvider>,
    );
  };

  const bare = planetView(
    { buildings: { CORE: 1, REFINERY: 1, EXTRACTOR: 1, VAULT: 0, SHIPYARD: 0, HANGAR: 0 } },
    { alloy: 0, crystal: 0, deuterium: 0 },
  );

  it('takes a Shipyard-gated hull to the Shipyard', async () => {
    const { default: userEvent } = await import('@testing-library/user-event');
    const view = openTab('reach', bare);
    const fix = view.container.querySelector<HTMLElement>('#row-HAULER [data-has-fix]');
    expect(fix).not.toBeNull();
    await userEvent.click(fix!);

    // The Shipyard is on this same tab, so it is scrolled to and lit rather than
    // opened: a highlighted row is how this screen says "here it is".
    expect(view.container.querySelector('#row-SHIPYARD')).toBeInTheDocument();
  });

  it('takes a Core-gated building to the Core', async () => {
    const { default: userEvent } = await import('@testing-library/user-event');
    const view = openTab('grow', bare);
    const fix = view.container.querySelector<HTMLElement>('#row-REFINERY [data-has-fix]');
    expect(fix).not.toBeNull();
    await userEvent.click(fix!);

    expect(view.container.querySelector('#row-CORE')).toBeInTheDocument();
  });

  /** The research surface is not this screen, so the host is asked to open it. */
  it('hands a research gate to the host', async () => {
    const { default: userEvent } = await import('@testing-library/user-event');
    const onOpenResearch = vi.fn();
    current = bare;
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const view = render(
      <QueryClientProvider client={client}>
        <ToastProvider>
          <PlanetScreen focusGroup="reach" onOpenResearch={onOpenResearch} />
        </ToastProvider>
      </QueryClientProvider>,
    );
    const fix = view.container.querySelector<HTMLElement>('#row-RUNNER [data-has-fix]');
    expect(fix).not.toBeNull();
    await userEvent.click(fix!);

    expect(onOpenResearch).toHaveBeenCalledOnce();
  });

  /** And it does NOT open the detail sheet on the way, which the row press does. */
  it('does not open the sheet underneath it', async () => {
    const { default: userEvent } = await import('@testing-library/user-event');
    const view = openTab('grow', bare);
    await userEvent.click(view.container.querySelector<HTMLElement>('#row-REFINERY [data-has-fix]')!);

    expect(view.baseElement.querySelector('[data-item-sheet]')).toBeNull();
  });
});
