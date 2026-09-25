import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PlanetScreen } from '../src/screens/PlanetScreen.js';
import { ToastProvider } from '../src/ui/Toast.js';
import type { PlanetView } from '../src/api/schemas.js';
import { planetView } from './fixtures.js';
import i18n from '../src/i18n/index.js';
import { AcademyLessonContext } from '../src/onboarding/lessonScope.js';

/**
 * WHERE THE PLANET SHEET PUTS THINGS, AND WHICH TAB IT OPENS ON. D170.
 *
 * Three owner corrections, all about the same failure: the sheet was deciding for
 * the commander. It opened on whichever tab a recommendation engine liked that
 * minute, and it put the two orbital satellites above nineteen hull rows — where
 * they are read first and wanted last.
 */

const rich = (): PlanetView =>
  planetView(
    {
      buildings: { CORE: 6, REFINERY: 3, EXTRACTOR: 3, VAULT: 1, SHIPYARD: 4 },
      orbitSlots: 3,
      fleet: {},
      fleetAway: {},
      score: { wealth: 10_000, dominion: 0 },
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
    useCollect: () => ({ mutate: vi.fn(), isPending: false }),
    useBuild: () => ({ mutate: vi.fn(), isPending: false }),
    useCompleteResearch: () => ({ mutate: vi.fn(), isPending: false }),
    useInstallSatellite: () => ({ mutate: vi.fn(), isPending: false }),
    useRaiseInstrument: () => ({ mutate: vi.fn(), isPending: false }),
    useCancelBuildOrder: () => ({ mutate: vi.fn(), isPending: false }),
    useBuildDeathStar: () => ({ mutate: vi.fn(), isPending: false }),
    useBuildInterceptor: () => ({ mutate: vi.fn(), isPending: false }),
  };
});

const show = (focusGroup?: 'grow' | 'orbit' | 'defend' | 'reach' | 'tactical') => {
  current = rich();
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <PlanetScreen {...(focusGroup === undefined ? {} : { focusGroup })} />
      </ToastProvider>
    </QueryClientProvider>,
  );
};

/** Where a band's heading sits in the document, so two can be compared. */
const positionOf = (label: string): number => {
  const node = screen.getByText(label);
  const all = Array.from(document.querySelectorAll('*'));
  return all.indexOf(node);
};

describe('the fleet tab puts the orbit satellites last', () => {
  /**
   * THE DERRICK AND THE BEACON ARE A FOOTNOTE, NOT AN OPENING. Owner instruction.
   *
   * Two satellite rows sat above the whole hull catalogue, so the first thing a
   * commander read on the tab named "what can I reach" was a pair of purchases
   * they make once a season. They belong beside the Prospector, whose yield the
   * Derrick is there to raise, at the bottom where a reader arrives having already
   * passed what they came for.
   */
  it('draws the orbit band after the mining band', () => {
    show('reach');
    const mining = positionOf(i18n.t('planet.reach.miningBand'));
    const orbit = positionOf(i18n.t('planet.reach.orbitBand'));
    expect(mining).toBeGreaterThan(0);
    expect(orbit).toBeGreaterThan(mining);
  });
});

/**
 * THE TABS' ORDER ON THE BAR (owner, 2026-09-25): "Fleet en sol'a, Tactical 4. sıraya". The
 * bar reads Fleet · Production · Intel · Tactical · Defend. The Academy still REVEALS them in
 * the order a planet is built — a lesson on production shows no fleet tab — and lays what it
 * has revealed out in the bar's own order.
 */
describe('the tab bar', () => {
  const labels = () => screen.getAllByRole('tab').map((tab) => tab.textContent);
  const NAME = {
    reach: 'planet.tabs.reachProblem',
    grow: 'planet.tabs.growProblem',
    orbit: 'planet.tabs.orbitProblem',
    tactical: 'planet.tabs.tacticalProblem',
    defend: 'planet.tabs.defendProblem',
  } as const;
  const name = (id: keyof typeof NAME) => i18n.t(NAME[id]);

  it('reads Fleet, Production, Intel, Tactical, Defend', () => {
    show();
    expect(labels()).toEqual((['reach', 'grow', 'orbit', 'tactical', 'defend'] as const).map(name));
  });

  it('lays out a lesson’s revealed tabs in the bar’s order', () => {
    const client = new QueryClient();
    render(<QueryClientProvider client={client}><ToastProvider>
      <AcademyLessonContext.Provider value="courier"><PlanetScreen focusGroup="reach" /></AcademyLessonContext.Provider>
    </ToastProvider></QueryClientProvider>);
    expect(labels()).toEqual((['reach', 'grow', 'orbit', 'defend'] as const).map(name));
  });
});

/**
 * THE CLOSE IS NEVER UNDER THE CATEGORY BAR (owner, 2026-09-25: "5 tane menü tabı olan
 * section'ın altına inmeye başlayınca [X] gözükmemeye başlıyor"). Pinned to the top, the bar
 * makes room on its right for the page's floating close; where it scrolls with the page it
 * keeps its whole width.
 */
describe('the category bar pinned to the top', () => {
  type Seen = (entries: { boundingClientRect: { top: number }; rootBounds: { top: number } | null }[]) => void;
  let seen: Seen | null = null;
  class Observer {
    constructor(callback: Seen) { seen = callback; }
    observe(): void { /* the test drives it */ }
    disconnect(): void { seen = null; }
  }

  it('makes room for the close only while it is pinned', () => {
    vi.stubGlobal('IntersectionObserver', Observer);
    try {
      show();
      const bar = document.querySelector<HTMLElement>('[data-category-bar]')!;
      expect(bar).not.toHaveAttribute('data-stuck');
      act(() => { seen?.([{ boundingClientRect: { top: -2 }, rootBounds: { top: 0 } }]); });
      expect(bar).toHaveAttribute('data-stuck');
      expect(bar.className).toMatch(/\bpr-8\b/);
      act(() => { seen?.([{ boundingClientRect: { top: 40 }, rootBounds: { top: 0 } }]); });
      expect(bar).not.toHaveAttribute('data-stuck');
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe('the sheet opens on production', () => {
  it('reveals Intel while keeping Production selected for the tab-press lesson', () => {
    const client = new QueryClient();
    render(<QueryClientProvider client={client}><ToastProvider>
      <AcademyLessonContext.Provider value="intel"><PlanetScreen focusGroup="grow" /></AcademyLessonContext.Provider>
    </ToastProvider></QueryClientProvider>);
    expect(screen.getAllByRole('tab')).toHaveLength(2);
    expect(screen.getByRole('tab', { name: i18n.t('planet.tabs.growProblem') })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: i18n.t('planet.tabs.orbitProblem') })).toHaveAttribute('aria-selected', 'false');
  });
  it('reveals the Academy cargo row even if the device previously folded cargo', () => {
    localStorage.setItem('astera.accordion.fleet', '[]');
    const client = new QueryClient();
    const { container } = render(<QueryClientProvider client={client}><ToastProvider>
      <AcademyLessonContext.Provider value="courier"><PlanetScreen focusGroup="reach" /></AcademyLessonContext.Provider>
    </ToastProvider></QueryClientProvider>);
    expect(container.querySelector('#row-COURIER')).not.toBeNull();
    expect(localStorage.getItem('astera.accordion.fleet')).toBe('[]');
    expect(screen.queryByText(i18n.t('planet.reach.orbitBand'))).not.toBeInTheDocument();
    expect(screen.queryByText(i18n.t('planet.reach.family.OFFENSIVE.note'))).not.toBeInTheDocument();
    localStorage.removeItem('astera.accordion.fleet');
  });
  it('does not show later category tabs in the first Academy lesson', () => {
    const client = new QueryClient();
    render(<QueryClientProvider client={client}><ToastProvider>
      <AcademyLessonContext.Provider value="core"><PlanetScreen focusGroup="grow" /></AcademyLessonContext.Provider>
    </ToastProvider></QueryClientProvider>);
    expect(screen.getAllByRole('tab')).toHaveLength(1);
    expect(screen.queryByText(i18n.t('planet.grow.multiplierBand'))).not.toBeInTheDocument();
  });
  /**
   * IT USED TO OPEN WHEREVER A RECOMMENDATION ENGINE POINTED, and the owner's
   * report is the whole case against it: *"bir başka açılıyor bir başka"*. A sheet
   * that opens somewhere different every time cannot be navigated by habit, and
   * habit is the only thing that makes a four-tab sheet cheap to use.
   *
   * An explicit `focusGroup` still wins — that is a caller saying where to go,
   * which is the opposite of the screen guessing.
   */
  it('opens on the production tab when nothing was asked for', () => {
    show();
    expect(screen.getByRole('tab', { name: i18n.t('planet.tabs.growProblem') }))
      .toHaveAttribute('aria-selected', 'true');
  });

  it('still honours a caller that names a tab', () => {
    show('reach');
    expect(screen.getByRole('tab', { name: i18n.t('planet.tabs.reachProblem') }))
      .toHaveAttribute('aria-selected', 'true');
  });
});

describe('what a Death Star strike actually does', () => {
  it('lives only in the Tactical tab and shows its two-charge tally', () => {
    const tactical = show('tactical');
    const forge = tactical.container.querySelector('[data-strategic-state]');
    expect(forge).not.toBeNull();
    expect(forge?.querySelector('[data-tally]')).toHaveAttribute('data-total', '2');
    tactical.unmount();

    const fleet = show('reach');
    expect(fleet.container.querySelector('[data-strategic-state]')).toBeNull();
  });

  it('explains an active EMP on the affected planet without claiming production is stopped', () => {
    current = rich();
    current = { ...current, planet: {
      ...current.planet,
      empUntil: new Date(Date.now() + 60 * 60_000),
    } };
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={client}><ToastProvider>
      <PlanetScreen focusGroup="defend" />
    </ToastProvider></QueryClientProvider>);
    expect(screen.getByText(/EMP.*Aegis|Aegis.*EMP/i)).toBeInTheDocument();
    expect(screen.queryByText(i18n.t('planet.recovery', { duration: '1h' }))).not.toBeInTheDocument();
  });

  /**
   * THE COPY WAS TWO DECISIONS OUT OF DATE. D167 replaced acquisition with a
   * DEADLINE: a strike no longer takes anything and a second strike takes nothing
   * either. It darkens a world for its own recovery window — two hours for a
   * capital, eight for a colony — and a COLONY whose commander lands no ship
   * inside that window is released to NOBODY, neutral again and open to any
   * settler. A capital is never released at all.
   *
   * The old lines promised "a second strike can capture a colony", which is a
   * rule the game stopped having. A weapon this expensive being sold on a
   * mechanic that does not exist is the most costly copy error the sheet can make.
   */
  it('states the deadline rather than a capture', () => {
    show('tactical');
    const hint = screen.getByText(i18n.t('planet.deathStar.dangerHint'));
    expect(hint).toBeInTheDocument();
    for (const forbidden of ['ele geçir', 'capture']) {
      expect(i18n.t('planet.deathStar.dangerHint').toLowerCase()).not.toContain(forbidden);
      expect(i18n.t('planet.deathStar.readyHint').toLowerCase()).not.toContain(forbidden);
    }
  });

  it('states the complete EMP rule directly without a redundant effects panel', () => {
    show('tactical');
    const copy = i18n.t('planet.deathStar.dangerHint');
    expect(copy).toMatch(/Aegis/i);
    expect(copy).toMatch(/1|hour|saat/i);
    expect(copy).toMatch(/savunma|defence/i);
    expect(copy).toMatch(/hasar almaz|cannot .*take damage|invulnerable/i);
    expect(screen.getByText(copy)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /tek darbe ne yapar|what one impact does/i }))
      .not.toBeInTheDocument();
  });
});

/**
 * THE BASE CARRIES PRODUCTION; THE DEFENCE TAB CARRIES WHAT STANDS. E5, the mock's
 * Base: the world, then one production row, then the queues and the tabs. What the
 * hero used to stack under the world — firepower, the defence and shield verdicts,
 * the fleet — opens the tab whose question it answers, so none of it is lost.
 */
describe('the Base and its Defence tab', () => {
  it('draws the production row under the world, and not the defence readings', () => {
    show('grow');
    expect(screen.getByTestId('planet-rates')).toBeInTheDocument();
    expect(screen.queryByTestId('planet-firepower')).toBeNull();
  });

  /**
   * E5: "iki sütun kartlar (render ≥74 px …)" on every tab, not only Production — a
   * list of ten a commander compares is half the scroll at two to a row.
   */
  it.each(['grow', 'orbit', 'defend', 'reach'] as const)('lays the %s tab out as cards, two to a row', (tab) => {
    show(tab);
    const rows = [...screen.getByRole('tabpanel').querySelectorAll('[id^="row-"]')];
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(row.querySelector('[data-layout]'), row.id).toHaveAttribute('data-layout', 'card');
      expect(row.parentElement, row.id).toHaveClass('grid-cols-2');
    }
  });

  /** D108's rack became the world's own ring (E5): the sockets are drawn once, above every tab. */
  it('draws the orbit on the world, not as a rack over the tabs', () => {
    show('grow');
    expect(document.querySelectorAll('[data-orbit-slot]').length).toBeGreaterThan(0);
    expect(screen.queryByRole('region', { name: 'Orbit network' })).toBeNull();
  });

  /** The band already names the ground; its room bar under it does not say it a second time. */
  it('names the ground band once', () => {
    show('defend');
    expect(screen.getAllByText(i18n.t('planet.defend.groundBand').trim())).toHaveLength(1);
  });

  it('leads the Defence tab with firepower, the line, the shield and what a raid can take', () => {
    show('defend');
    for (const id of ['planet-firepower', 'planet-defence', 'planet-shield', 'planet-exposed']) {
      expect(screen.getByTestId(id), id).toBeInTheDocument();
    }
  });
});
