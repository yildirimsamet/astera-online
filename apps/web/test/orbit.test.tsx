import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import {
  BUILDING_IDS, FLEET_V2_HULLS, HULLS, INSTRUMENT_IDS, INSTRUMENT_MAX_LEVEL, RESEARCH_PROJECT_IDS,
  SATELLITES, SATELLITE_IDS, satelliteSlots,
} from '@astera/rules';
import { PlanetScreen } from '../src/screens/PlanetScreen.js';
import { ToastProvider } from '../src/ui/Toast.js';
import type { PlanetView } from '../src/api/schemas.js';
import { openAllBands, planetView } from './fixtures.js';

/**
 * THE ORBIT SURFACE — TWO KINDS OF HARDWARE, AND THE DIFFERENCE IS THE POINT. D25.
 *
 * This screen used to list five things that all behaved the same way and all
 * competed for the same slots, and the owner's verdict on it was that it was a
 * muddle. What replaced it has to keep two rules legible at a glance, and both of
 * them are the sort of thing that quietly stops being true:
 *
 *   · A SATELLITE COSTS A SLOT AND AN INSTRUMENT DOES NOT. If the slot meter ever
 *     starts counting instruments, the identity choice the whole system exists for
 *     silently becomes a checklist again.
 *   · THE UPLINK IS THE ONLY GATE. The Telescope and the Radar hang off it; nothing
 *     else gates anything. A gate that appears somewhere else is an ordering nobody
 *     imposed, which is exactly what D25 removed.
 */

/** A developed planet: three orbit slots open and enough stock to fill them. */
const planet = (
  over: Partial<Omit<PlanetView, 'planet'>> = {},
  stock: Partial<PlanetView['planet']> = {},
): PlanetView =>
  planetView(
    {
      buildings: { CORE: 6, REFINERY: 3, EXTRACTOR: 3, VAULT: 1, SHIPYARD: 1 },
      orbitSlots: 3,
      fleet: {},
      score: { wealth: 10_000, dominion: 0 },
      ...over,
    },
    {
      alloy: 500_000,
      crystal: 200_000,
      alloyCap: 900_000,
      crystalCap: 400_000,
      alloyPerHour: 400,
      crystalPerHour: 120,
      bufferAlloyCap: 4000,
      bufferCrystalCap: 1200,
      ...stock,
    },
  );

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

let current: PlanetView = planet();
let focus: 'orbit' | 'reach' | 'defend' | 'grow' = 'orbit';

const show = (
  over: Partial<Omit<PlanetView, 'planet'>> = {},
  tab: 'orbit' | 'reach' | 'defend' | 'grow' = 'orbit',
  stock: Partial<PlanetView['planet']> = {},
) => {
  current = planet(over, stock);
  focus = tab;
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <PlanetScreen focusGroup={focus} />
      </ToastProvider>
    </QueryClientProvider>,
  );
};

describe('the orbit surface', () => {
  it('distinguishes owned hardware from effects disabled by Core damage or a lost Uplink', () => {
    const view = show({
      buildings: { CORE: 2, REFINERY: 2, EXTRACTOR: 2, VAULT: 0, SHIPYARD: 0 },
      orbit: ['FOUNDRY', 'UPLINK'],
      effectiveOrbit: ['FOUNDRY'],
      orbitSlots: 1,
      instruments: { TELESCOPE: 3 },
      effectiveInstruments: { TELESCOPE: 0 },
    }, 'orbit');
    expect(screen.getByText(/owned, but inactive until the Command Core/i)).toBeInTheDocument();
    expect(screen.getByText(/L3 owned, but inactive until an Uplink/i)).toBeInTheDocument();
    expect(view.container.querySelector('#row-TELESCOPE [data-progression-state="locked"]'))
      .toBeInTheDocument();
  });

  it('keeps Deuterium in the sheet wallet before its research door opens', () => {
    show({ research: [] });
    expect(screen.getByLabelText('Deuterium')).toHaveTextContent('0');
  });

  it('places every item under the outcome a player is looking for', async () => {
    show();
    for (const name of ['Uplink', 'Telescope', 'Radar', 'Veil']) {
      expect(screen.getByRole('heading', { name }), `${name} is missing from Intel`).toBeInTheDocument();
    }
    expect(screen.queryByRole('heading', { name: 'Aegis' })).toBeNull();
    await userEvent.click(screen.getByRole('tab', { name: 'Defend' }));
    expect(screen.getByRole('heading', { name: 'Aegis' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('tab', { name: 'Production' }));
    expect(screen.getByRole('heading', { name: 'Foundry' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('tab', { name: 'Fleet' }));
    expect(screen.getByRole('heading', { name: 'Derrick' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Beacon' })).toBeInTheDocument();
  });

  it('uses one compact render and leaves the future ladder to the sheet', () => {
    const view = show({ orbit: ['UPLINK'], instruments: { TELESCOPE: 1 } });
    const row = view.container.querySelector('#row-TELESCOPE');
    expect(row).not.toBeNull();
    expect(row?.querySelector('[data-art] img')).not.toBeNull();
    expect(row?.querySelectorAll('[data-art]').length).toBe(1);
  });

  /**
   * The whole rationing system, in one assertion. If this starts counting the four
   * instruments, an Aegis costs a slot again and D25 has been undone.
   */
  it('counts only what is in orbit against the slots', () => {
    show({ orbit: ['UPLINK', 'FOUNDRY'], instruments: { AEGIS: 3, VEIL: 2 } });
    expect(screen.getByText('2/3')).toBeInTheDocument();
  });

  it('names the occupant of every orbit slot and leaves open capacity visible', () => {
    show({ orbit: ['UPLINK', 'FOUNDRY'], orbitSlots: 3 });
    const rack = screen.getByLabelText('Orbit slots');
    expect(rack).toHaveTextContent('Uplink');
    expect(rack).toHaveTextContent('Foundry');
    expect(rack).toHaveTextContent('Empty');
  });

  it('shows the live Aegis charge, capacity and recovery rate', () => {
    show(
      { instruments: { AEGIS: 3 } },
      'orbit',
      { shield: 80, shieldMax: 120, shieldPerHour: 48 },
    );
    expect(screen.getByText('80 / 120')).toBeInTheDocument();
    expect(screen.getByRole('meter', { name: 'Aegis shield charge' })).toHaveAttribute('aria-valuenow', '67');
    expect(screen.getByText(/\+48\/h/i)).toBeInTheDocument();
  });

  it('shows exactly which resources the Vault currently protects', () => {
    show({}, 'defend', {
      vaultFloor: 720,
      vaultProtected: { alloy: 600, crystal: 120, deuterium: 0 },
      vaultCapacity: { alloy: 800, crystal: 160, deuterium: 0 },
    });
    expect(screen.getByLabelText('600 alloy safe')).toBeInTheDocument();
    expect(screen.getByLabelText('120 crystal safe')).toBeInTheDocument();
    expect(screen.getByLabelText('0 deuterium safe')).toBeInTheDocument();
  });

  it('names the Core level that opens the next slot, rather than only refusing', () => {
    show({ buildings: { CORE: 1, REFINERY: 3, EXTRACTOR: 3, VAULT: 1, SHIPYARD: 1 }, orbitSlots: 1 });
    expect(screen.getByText(/\+1 at Core L3/i)).toBeInTheDocument();
  });

  it('says the orbit is full instead of leaving the player to discover it', () => {
    show({ orbit: ['UPLINK', 'FOUNDRY', 'DERRICK'], orbitSlots: 3 });
    expect(screen.getByText(/orbit is full/i)).toBeInTheDocument();
  });

  /**
   * The two halves obey different rules — one costs a slot, one does not — and a
   * player has to be able to tell which is which before choosing. That was carried
   * by a paragraph between the cards, which is a paragraph nobody reads.
   */
  it('separates the network gate from the levelled intel instruments', () => {
    show();
    expect(screen.getByText(/^connection$/i)).toBeInTheDocument();
    expect(screen.getByText(/^planet instruments$/i)).toBeInTheDocument();
    expect(screen.getByText(/spends one socket/i)).toBeInTheDocument();
    expect(screen.getByText(/never consume an orbit socket/i)).toBeInTheDocument();
  });

  /** Owner request: every card says what it is, in words a child can read. */
  it('tags every Intel card with what it is', () => {
    show();
    for (const tag of [
      'Unlocks Telescope and Radar',
      'Resolve distant movement',
      'Distinguish threats to you',
      'Hide from telescopes',
    ]) {
      expect(screen.getByText(tag), `${tag} is missing`).toBeInTheDocument();
    }
  });

  describe('the one gate in the system', () => {
    it('locks the Telescope and the Radar behind an Uplink', () => {
      show({ orbit: [] });
      expect(screen.getAllByText(/an uplink in orbit/i).length).toBe(2);
    });

    it('opens them the moment one is up, and gates nothing else', () => {
      show({ orbit: ['UPLINK'] });
      expect(screen.queryByText(/an uplink in orbit/i)).toBeNull();
    });

    /**
     * The Aegis and the Veil stand on their own. They were behind the same list as
     * the seeing instruments before D25, and an Uplink requirement leaking onto
     * them would put back the ordering the split removed.
     */
    it('never gates the Aegis or the Veil on anything in orbit', () => {
      const defence = show({ orbit: [] }, 'defend');
      const aegis = screen.getByText('Aegis').closest('div');
      expect(aegis?.textContent).not.toMatch(/uplink/i);
      defence.unmount();
      show({ orbit: [] }, 'orbit');
      const veil = screen.getByText('Veil').closest('div');
      expect(veil?.textContent).not.toMatch(/uplink/i);
    });
  });

  /** A satellite is up or it is not. A level on one of these rows is a bug. */
  it('never shows a level on a satellite', () => {
    const view = show({ orbit: ['FOUNDRY'] }, 'grow');
    const row = view.container.querySelector('#row-FOUNDRY');
    expect(row?.textContent).not.toMatch(/\bL[0-9]\b/);
  });

  it('offers a satellite that is already up as done rather than as a purchase', () => {
    const view = show({ orbit: ['BEACON'] }, 'reach');
    expect(screen.getByText(/already in orbit/i)).toBeInTheDocument();
    expect(view.container.querySelector('#row-BEACON [data-progression-state]'))
      .toHaveAttribute('data-progression-state', 'complete');
    expect(view.container.querySelector('#row-BEACON .grayscale')).toBeNull();
    expect(view.container.querySelector('#row-BEACON [data-open-item]')).toBeInTheDocument();
  });

  it('greys an available unowned satellite without calling it locked', () => {
    const view = show({ orbit: [] }, 'reach');
    const row = view.container.querySelector('#row-BEACON [data-progression-state]');
    expect(row).toHaveAttribute('data-progression-state', 'available-unowned');
    expect(view.container.querySelector('#row-BEACON .grayscale')).toBeInTheDocument();
    expect(view.container.querySelector('#row-BEACON [data-open-item]')).toBeInTheDocument();
  });

  it('adds a lock only when an unowned satellite has a real unmet requirement', () => {
    const view = show({ orbit: ['UPLINK', 'FOUNDRY', 'DERRICK'], orbitSlots: 3 }, 'reach');
    expect(view.container.querySelector('#row-BEACON [data-progression-state]'))
      .toHaveAttribute('data-progression-state', 'locked');
    expect(view.container.querySelector('#row-BEACON')).toHaveTextContent(/free orbit slot/i);
  });

  it('shows a maxed instrument as complete rather than locked', () => {
    const max = INSTRUMENT_MAX_LEVEL.RADAR;
    expect(max).not.toBeNull();
    const view = show({ instruments: { RADAR: max ?? 0 }, orbit: ['UPLINK'] });
    expect(view.container.querySelector('#row-RADAR [data-progression-state]'))
      .toHaveAttribute('data-progression-state', 'complete');
    expect(view.container.querySelector('#row-RADAR [data-open-item]')).toBeInTheDocument();
  });
});

/**
 * The client's slot arithmetic must agree with the server's, because the meter is
 * what a player plans against and the endpoint is what refuses them.
 */
describe('the slot ladder the meter draws', () => {
  it('matches the rules at every Core level it claims to', () => {
    for (const [core, slots] of [[1, 1], [2, 1], [3, 2], [4, 2], [5, 3], [8, 3], [9, 4], [20, 4]] as const) {
      expect(satelliteSlots(core), `Core ${String(core)}`).toBe(slots);
    }
  });

  it('never opens more slots than there are satellites to fill them', () => {
    expect(satelliteSlots(99)).toBe(Object.keys(SATELLITES).length);
  });
});

/**
 * WHAT YOU CAN SEND, GROUPED BY WHAT IT DOES.
 *
 * The Prospector led this list, so the first thing a player met under "what can you
 * send" was a craft that never fights and cannot be aimed at a planet. Ordering on
 * a purchase screen teaches, whether or not anybody intended it to.
 */
describe('the reach surface', () => {
  const bodyOrder = (names: readonly string[]): number[] =>
    names.map((n) => document.body.textContent.indexOf(n));

  /**
   * THE BANDS FOLD NOW, so this opens them before counting. What it asserts is
   * unchanged and is the thing that matters: folding a band is not trimming it —
   * every hull in the catalogue still has exactly one row, in its own family, in
   * tier order, with the miner last.
   */
  it('groups all eighteen ships by family and tier, then puts the preserved miner last', async () => {
    show({ buildings: { CORE: 9, REFINERY: 3, EXTRACTOR: 3, VAULT: 1, SHIPYARD: 6 } }, 'reach');
    await openAllBands(screen, userEvent.setup());
    const [offensive = -1, defensive = -1, specialist = -1, cargo = -1, mining = -1] =
      bodyOrder(['Offensive hulls', 'Defensive hulls', 'Specialist hulls', 'Cargo hulls', 'Mining']);
    expect(offensive).toBeGreaterThan(-1);
    expect(defensive).toBeGreaterThan(offensive);
    expect(specialist).toBeGreaterThan(defensive);
    expect(cargo).toBeGreaterThan(specialist);
    expect(mining).toBeGreaterThan(cargo);

    for (const id of FLEET_V2_HULLS) {
      const item = document.querySelector(`[data-hull-id="${id}"]`);
      expect(item, id).not.toBeNull();
      expect(item).toHaveAttribute('data-hull-family', HULLS[id].family);
      expect(item).toHaveAttribute('data-hull-tier', String(HULLS[id].tier));
    }
    expect(document.querySelectorAll('[data-hull-id]')).toHaveLength(FLEET_V2_HULLS.length);

    const dart = screen.getByText('Dart');
    const prospector = screen.getByText('Prospector');
    expect(dart.compareDocumentPosition(prospector) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  /**
   * RESEARCH IS NOT HERE ANY MORE, AND NOT PARTLY HERE. T12.
   *
   * This tab used to carry a "Frontier research" band with four project cards on
   * it, and the assertions for those moved to `research-panel.test.tsx` with the
   * cards. What has to stay behind is proof that nothing was left: a half-moved
   * feature is two doors onto one thing, and the one on this screen would be the
   * one missing eleven of the fifteen projects.
   *
   * Walked across all four tabs, not just this one, because the row ids are global
   * and a stray card would be as wrong under `grow` as under `reach`.
   */
  it('carries no research row on any tab', () => {
    for (const tab of ['grow', 'orbit', 'defend', 'reach'] as const) {
      const view = show({}, tab);
      for (const id of RESEARCH_PROJECT_IDS) {
        expect(view.container.querySelector(`#row-${id}`), `${tab}/${id}`).toBeNull();
      }
      expect(view.container.textContent).not.toContain('Frontier research');
      view.unmount();
    }
  });

  it('keeps Tier 3 rows visible and routes each lock to its first missing catalog requirement', async () => {
    const locked = show({ buildings: { CORE: 9, REFINERY: 3, EXTRACTOR: 3, VAULT: 1, SHIPYARD: 6 } }, 'reach');
    await openAllBands(screen, userEvent.setup());
    expect(locked.container.querySelector('#row-WAYFARER [data-progression-state="locked"]')).toBeNull();
    expect(locked.container.querySelector('#row-TEMPEST')).toHaveTextContent('Starship Engineering I');
    expect(locked.container.querySelector('#row-ATLAS')).toHaveTextContent('Starship Engineering I');
    expect(locked.container.querySelector('#row-NULLIFIER')).toHaveTextContent('Starship Engineering I');
    locked.unmount();

    const engineeringOnly = planet().research.map((project) => ({
      ...project, level: project.id === 'STARSHIP_ENGINEERING' ? 1 : project.level,
    }));
    const nextGate = show({
      buildings: { CORE: 9, REFINERY: 3, EXTRACTOR: 3, VAULT: 1, SHIPYARD: 6 },
      research: engineeringOnly,
    }, 'reach');
    await openAllBands(screen, userEvent.setup());
    expect(nextGate.container.querySelector('#row-TEMPEST')).toHaveTextContent('Ship Power II');
    expect(nextGate.container.querySelector('#row-ATLAS')).toHaveTextContent('Ship Propulsion II');
    expect(nextGate.container.querySelector('#row-NULLIFIER')).toHaveTextContent('Gravitic Charges I');
  });

  it('says a Prospector is aimed at a rock rather than at a person', () => {
    show({ buildings: { CORE: 9, REFINERY: 3, EXTRACTOR: 3, VAULT: 1, SHIPYARD: 6 } }, 'reach');
    expect(screen.getByText(/only to revealed asteroids or debris fields/i)).toBeInTheDocument();
  });

  it('tags every Fleet V2 hull with what it is', async () => {
    show({ buildings: { CORE: 9, REFINERY: 3, EXTRACTOR: 3, VAULT: 1, SHIPYARD: 6 } }, 'reach');
    await openAllBands(screen, userEvent.setup());
    for (const id of FLEET_V2_HULLS) {
      expect(document.querySelector(`[data-hull-id="${id}"]`), id)
        .toHaveTextContent(HULLS[id].tier === 4 ? /capital/i : /./);
    }
  });

  /**
   * D25 removed the Drill satellite; a Prospector is gated by the Shipyard like
   * every other hull. A lock naming anything else here is the old ordering back.
   */
  it('gates a Prospector on the Shipyard and on nothing else', () => {
    show({ buildings: { CORE: 9, REFINERY: 3, EXTRACTOR: 3, VAULT: 1, SHIPYARD: 6 }, orbit: [] }, 'reach');
    expect(screen.queryByText(/needs a drill/i)).toBeNull();
    expect(screen.getByRole('heading', { name: 'Derrick' })).toBeInTheDocument();
    expect(screen.getByText(/only to revealed asteroids or debris fields/i)).toBeInTheDocument();
  });
});

/**
 * WOULD A TWELVE-YEAR-OLD KNOW WHERE TO LOOK? Owner's test, taken literally.
 *
 * Two failures this catches. A heading question that names a mechanism instead of
 * a worry, and a tab that is missing a whole third of its own subject because the
 * thing lives somewhere else for a good reason nobody wrote down.
 */
describe('finding things', () => {
  it('explains Production in plain language', () => {
    show({}, 'grow');
    expect(screen.getByText(/grow your resources/i)).toBeInTheDocument();
  });

  it('puts the Aegis itself under Defend, where a player looks for a shield', () => {
    show({}, 'defend');
    expect(screen.getByRole('heading', { name: 'Aegis' })).toBeInTheDocument();
    expect(screen.getByText('Shield for your planet')).toBeInTheDocument();
    expect(screen.queryByText(/under Orbit/i)).toBeNull();
  });

  it('tags the buildings too, not only the hardware', () => {
    show({}, 'grow');
    for (const tag of ['Unlocks higher levels', 'Makes alloy', 'Makes crystal']) {
      expect(screen.getByText(tag), `${tag} is missing`).toBeInTheDocument();
    }
  });
});

describe('the compact row and sheet grammar', () => {
  it('opens every item kind before it offers a commitment', async () => {
    const user = userEvent.setup();
    const cases = [
      ['grow', 'Command Core'],
      ['grow', 'Foundry'],
      ['orbit', 'Telescope'],
      ['defend', 'Aegis'],
      ['defend', 'Thorn'],
      ['reach', 'Dart'],
    ] as const;

    for (const [tab, name] of cases) {
      const view = show({}, tab);
      const row = screen.getByRole('heading', { name }).closest('[id^="row-"]');
      expect(row).not.toBeNull();
      if (!(row instanceof HTMLElement)) throw new Error(`${name} row must render`);
      expect(within(row).queryByRole('button', { name: /^(raise|build|research|install)$/i })).toBeNull();
      await user.click(within(row).getByRole('button', { name: new RegExp(`about ${name}`, 'i') }));
      expect(screen.getByRole('dialog', { name })).toBeInTheDocument();
      view.unmount();
    }
  });
});

/**
 * THE BUILDING THE WHOLE FUEL ECONOMY RUNS ON, AND THE ROW IT NEVER HAD.
 *
 * T5 added the Deuterium Refinery: a building id, art, English and Turkish name,
 * tag and role, a server upgrade path with its own research ceiling, and an economy
 * that produces from it. What it never got was a card. Four buildings render under
 * Production and it is not one of them, so nothing on any screen could raise it.
 *
 * That is not a cosmetic gap. T6 makes every launch burn deuterium and D135 states
 * that "the Refinery is deuterium's floor" — the only steady source. Without a way
 * to build one, a commander has the opening grant and whatever they can mine off
 * isotope rocks behind a Frontier project, and then the fleet stops flying.
 *
 * The Core gate and the research ceiling are BOTH stated, because the server checks
 * both: `RESEARCH_CEILING` was a refusal the interface had no sentence for.
 */
describe('the Deuterium Refinery', () => {
  const rung = (level: number) => planet().research.map((project) =>
    project.id === 'DEUTERIUM_SYNTHESIS'
      ? { ...project, level, completed: level >= (project.maxLevel ?? 5), discovered: true }
      : project);

  it('has a row, under Production with the other producers', () => {
    const view = show({ research: rung(1) }, 'grow');
    expect(view.container.querySelector('#row-DEUTERIUM_PLANT')).toBeInTheDocument();
  });

  it('is buyable once a rung of Deuterium Synthesis is held', () => {
    const view = show({ research: rung(1) }, 'grow');
    expect(view.container.querySelector('#row-DEUTERIUM_PLANT [data-progression-state]'))
      .not.toHaveAttribute('data-progression-state', 'locked');
  });

  /**
   * `plantCeiling(0)` is zero, so a commander who has not started the ladder cannot
   * have a Refinery at all — and the card has to say which ladder, not just "no".
   */
  it('names the research when no rung is held', () => {
    const view = show({ research: rung(0) }, 'grow');
    const row = view.container.querySelector('#row-DEUTERIUM_PLANT');
    expect(row).toHaveTextContent(/Deuterium Synthesis/i);
    expect(row?.querySelector('[data-progression-state]'))
      .toHaveAttribute('data-progression-state', 'locked');
  });

  it('names it again at the ceiling of the rung actually held', () => {
    const view = show({
      research: rung(1),
      buildings: { CORE: 9, REFINERY: 3, EXTRACTOR: 3, VAULT: 1, SHIPYARD: 1, DEUTERIUM_PLANT: 3 },
    }, 'grow');
    expect(view.container.querySelector('#row-DEUTERIUM_PLANT'))
      .toHaveTextContent(/Deuterium Synthesis/i);
  });

  it('takes the Core gate like every other building', () => {
    const view = show({
      research: rung(5),
      buildings: { CORE: 2, REFINERY: 1, EXTRACTOR: 1, VAULT: 0, SHIPYARD: 0, DEUTERIUM_PLANT: 2 },
    }, 'grow');
    expect(view.container.querySelector('#row-DEUTERIUM_PLANT')).toHaveTextContent(/Core/i);
  });

  it('can be pointed at from another tab', async () => {
    const { TAB_OF } = await import('../src/screens/PlanetScreen.js');
    expect(TAB_OF.DEUTERIUM_PLANT).toBe('grow');
  });
});

/**
 * EVERYTHING THE SERVER SELLS HAS A CONTROL THAT SELLS IT.
 *
 * Written after finding the Deuterium Refinery — a building with an id, art, two
 * languages, a server upgrade path and an economy, and no card anywhere — and after
 * eleven research ladders had shipped the same way. The pattern is always the same:
 * a new id goes into the enum, every table that is keyed by the enum is filled in
 * because TypeScript demands it, and the one place that is a hand-written LIST of
 * rows is not, because nothing demands it.
 *
 * So this walks the enums. A twelfth thing added without a row fails here rather
 * than in a player's session.
 */
describe('nothing is sold without a control', () => {
  /**
   * `async` because the Fleet tab's families fold: one band is open on arrival and
   * a sweep that did not open the rest would only ever see a quarter of the
   * catalogue and call the other three quarters missing.
   */
  const rowsAcrossEveryTab = async (): Promise<Set<string>> => {
    const found = new Set<string>();
    for (const tab of ['grow', 'orbit', 'defend', 'reach'] as const) {
      const view = show({
        buildings: { CORE: 14, REFINERY: 6, EXTRACTOR: 6, VAULT: 3, SHIPYARD: 8 },
        orbit: ['UPLINK'],
        orbitSlots: 4,
      }, tab);
      await openAllBands(screen, userEvent.setup());
      for (const element of view.container.querySelectorAll('[id^="row-"]')) {
        found.add(element.id.slice('row-'.length));
      }
      view.unmount();
    }
    return found;
  };

  it('gives every building a row', async () => {
    const rendered = await rowsAcrossEveryTab();
    const missing = BUILDING_IDS.filter((id) => !rendered.has(id));
    expect(missing).toEqual([]);
  });

  it('gives every hull a row', async () => {
    const rendered = await rowsAcrossEveryTab();
    const missing = Object.keys(HULLS).filter((id) => !rendered.has(id));
    expect(missing).toEqual([]);
  });

  it('gives every instrument and satellite a row', async () => {
    const rendered = await rowsAcrossEveryTab();
    const missing = [...INSTRUMENT_IDS, ...SATELLITE_IDS].filter((id) => !rendered.has(id));
    expect(missing).toEqual([]);
  });

  /** And every row it draws is a thing that exists, not a leftover id. */
  it('draws no row for something the rules do not have', async () => {
    const known = new Set<string>([
      ...BUILDING_IDS, ...Object.keys(HULLS), ...INSTRUMENT_IDS, ...SATELLITE_IDS,
      ...RESEARCH_PROJECT_IDS,
    ]);
    expect([...(await rowsAcrossEveryTab())].filter((id) => !known.has(id))).toEqual([]);
  });
});
