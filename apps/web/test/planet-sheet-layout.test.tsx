import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DEATH_STAR } from '@astera/rules';
import { PlanetScreen } from '../src/screens/PlanetScreen.js';
import { ToastProvider } from '../src/ui/Toast.js';
import type { PlanetView } from '../src/api/schemas.js';
import { planetView } from './fixtures.js';
import i18n from '../src/i18n/index.js';
import { AcademyLessonContext } from '../src/onboarding/lessonScope.js';
import { hitsToTakeLoyalColony } from '../src/lib/strategic.js';

/** The Death Star's one description, with the figures the card passes it. */
const deathStarHint = (): string => i18n.t('planet.deathStar.hint', {
  loss: DEATH_STAR.colonyLoyaltyLoss,
  hits: hitsToTakeLoyalColony,
});

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
 * THE TABS' ORDER ON THE BAR (owner, 2026-09-25, corrected the same day): Production · Intel ·
 * Defend · Tactical · Fleet. The Academy still REVEALS them in the order a planet is built — a
 * lesson on production shows no fleet tab — and lays what it has revealed out in the bar's order.
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

  it('reads Production, Intel, Defend, Tactical, Fleet', () => {
    show();
    expect(labels()).toEqual((['grow', 'orbit', 'defend', 'tactical', 'reach'] as const).map(name));
  });

  it('lays out a lesson’s revealed tabs in the bar’s order', () => {
    const client = new QueryClient();
    render(<QueryClientProvider client={client}><ToastProvider>
      <AcademyLessonContext.Provider value="courier"><PlanetScreen focusGroup="reach" /></AcademyLessonContext.Provider>
    </ToastProvider></QueryClientProvider>);
    expect(labels()).toEqual((['grow', 'orbit', 'defend', 'reach'] as const).map(name));
  });
});

/**
 * The close has its own stable Sheet header row. The category bar keeps its width
 * while the page scrolls, so it never shifts to make room for the close.
 */
describe('the category bar pinned to the top', () => {
  it('keeps its full width without a scroll-dependent close-button gap', () => {
    show();
    const bar = document.querySelector<HTMLElement>('[data-category-bar]')!;
    expect(bar).toHaveClass('sticky', 'top-0');
    expect(bar).not.toHaveAttribute('data-stuck');
    expect(bar.className).not.toMatch(/\bpr-8\b/);
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
  // One weapon per world until the Stockpile is researched (owner, 2026-10-01).
  it('lives only in the Tactical tab and shows its one-weapon tally', () => {
    const tactical = show('tactical');
    const forge = tactical.container.querySelector('[data-strategic-state]');
    expect(forge).not.toBeNull();
    expect(forge?.querySelector('[data-tally]')).toHaveAttribute('data-total', '1');
    tactical.unmount();

    const fleet = show('reach');
    expect(fleet.container.querySelector('[data-strategic-state]')).toBeNull();
  });

  it('uses the same image-and-body production layout and a labelled stock counter', () => {
    const view = show('tactical');
    const forge = view.container.querySelector('[data-strategic-state]');
    expect(forge).toHaveClass('tactical-production');
    expect(forge?.querySelector('.tactical-production__scene img')).toHaveAttribute('src', '/assets/images/atmosphere/strategic-v2.webp');
    expect(forge?.querySelector('.tactical-production__body')).not.toBeNull();
    expect(forge?.querySelector('[data-stock-counter]')).toHaveTextContent('Stock 0/1');
    expect(screen.getByRole('heading', { name: 'Death Star' })).toBeInTheDocument();
  });

  it.each([0, 1])('shows mixed ready and paused inventory without hiding captured stock at Stockpile %s', level => {
    const world = rich();
    current = { ...world, deathStars: [
      { id: 'ready', status: 'READY', readyAt: null, remainingSeconds: 0 },
      { id: 'paused', status: 'PAUSED', readyAt: null, remainingSeconds: 60 },
    ], research: world.research.map(project => project.id === 'STRATEGIC_STOCKPILE' ? { ...project, level } : project) };
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const view = render(<QueryClientProvider client={client}><ToastProvider><PlanetScreen focusGroup="tactical" /></ToastProvider></QueryClientProvider>);
    const forge = view.container.querySelector('[data-strategic-state]');
    expect(forge?.querySelector('[data-stock-counter]')).toHaveTextContent(`Stock 2/${String(level + 1)}`);
    expect([...forge!.querySelectorAll('[data-cell]')].map(cell => cell.getAttribute('data-cell'))).toEqual(['ready', 'paused']);
    expect(forge).toHaveTextContent('Paused: 1');
    expect(forge).not.toHaveTextContent('Building: 1');
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
    expect(screen.getByText(deathStarHint())).toBeInTheDocument();
    for (const forbidden of ['ele geçir', 'capture']) {
      expect(deathStarHint().toLowerCase()).not.toContain(forbidden);
    }
  });

  /**
   * ONE PLAIN DESCRIPTION. Owner, 2026-10-15: *"Ölüm yıldızının açıklaması sadeleşsin ve
   * kafa karıştırıcı ifadeler kaldırılsın ayrıca: Sadakati 100 olan bir koloniye 5 tane
   * ard arda atarsanız, koloni düşer yazısı eklensin."* The threshold sentence ("at 20 or
   * less it secedes") and "ground defences take no damage" are what read as riddles; the
   * worked example and "they sit the fight out" say the same rules plainly.
   */
  it('states the EMP rule plainly, with the five-hit example and the fault', async () => {
    show('tactical');
    for (const language of ['en', 'tr'] as const) {
      await i18n.changeLanguage(language);
      const copy = deathStarHint();
      expect(copy).toMatch(/Aegis/);
      expect(copy).toMatch(/1 (hour|saat)/i);
      expect(copy).toMatch(/ground defences|yer savunmaları/i);
      expect(copy).toMatch(/fault|arıza/i);
      expect(copy).toContain(String(Math.ceil(100 / DEATH_STAR.colonyLoyaltyLoss)));
      expect(copy).toContain(String(DEATH_STAR.colonyLoyaltyLoss));
      expect(copy).not.toMatch(/hasar almaz|take damage|or less|veya altında|kopar|secede/i);
    }
    await i18n.changeLanguage('en');
    expect(screen.getByText(deathStarHint())).toBeInTheDocument();
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
