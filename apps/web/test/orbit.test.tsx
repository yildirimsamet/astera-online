import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { HULLS, INSTRUMENT_MAX_LEVEL, SATELLITES, satelliteSlots } from '@astera/rules';
import { PlanetScreen } from '../src/screens/PlanetScreen.js';
import { ToastProvider } from '../src/ui/Toast.js';
import type { PlanetView } from '../src/api/schemas.js';
import { planetView } from './fixtures.js';

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
    expect(view.container.querySelector('#row-TELESCOPE [data-lock-state="closed"]'))
      .toHaveTextContent(/an Uplink in orbit/i);
  });

  it('keeps Deuterium in the sheet wallet before its research door opens', () => {
    show({ research: [] });
    expect(screen.getByLabelText('Deuterium')).toHaveTextContent('0');
  });

  it('offers all four satellites and all four instruments, with no ordering', () => {
    show();
    for (const name of ['Uplink', 'Foundry', 'Derrick', 'Beacon']) {
      expect(screen.getByText(name), `${name} is missing`).toBeInTheDocument();
    }
    for (const name of ['Telescope', 'Radar', 'Aegis', 'Veil']) {
      expect(screen.getByText(name), `${name} is missing`).toBeInTheDocument();
    }
  });

  it('uses the owned and next renders as the row subject instead of favicon-sized bullets', () => {
    const view = show({ orbit: ['UPLINK'], instruments: { TELESCOPE: 1 } });
    const row = view.container.querySelector('#row-TELESCOPE');
    expect(row).not.toBeNull();
    expect(row?.querySelectorAll('.size-\\[72px\\]').length).toBeGreaterThanOrEqual(1);
    expect(row?.querySelector('.size-12')).toBeNull();
    for (const image of row?.querySelectorAll('.size-\\[72px\\] img') ?? []) {
      expect(image).toHaveClass('size-16');
    }
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
  it('bands the two kinds apart and states the rule for each', () => {
    show();
    expect(screen.getByText(/^in orbit$/i)).toBeInTheDocument();
    expect(screen.getByText(/^on the planet$/i)).toBeInTheDocument();
    expect(screen.getByText(/each one takes a slot/i)).toBeInTheDocument();
    expect(screen.getByText(/no slot needed/i)).toBeInTheDocument();
  });

  /** Owner request: every card says what it is, in words a child can read. */
  it('tags every card with what it is', () => {
    show();
    for (const tag of [
      'Unlocks Telescope and Radar',
      'More ore every hour',
      'Better mining craft',
      'Faster fleets',
      'Watch other planets',
      'See who is coming',
      'Shield for your planet',
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
      show({ orbit: [] });
      const aegis = screen.getByText('Aegis').closest('div');
      const veil = screen.getByText('Veil').closest('div');
      expect(aegis?.textContent).not.toMatch(/uplink/i);
      expect(veil?.textContent).not.toMatch(/uplink/i);
    });
  });

  /** A satellite is up or it is not. A level on one of these rows is a bug. */
  it('never shows a level on a satellite', () => {
    const view = show({ orbit: ['FOUNDRY'] });
    const row = view.container.querySelector('#row-FOUNDRY');
    expect(row?.textContent).not.toMatch(/\bL[0-9]\b/);
  });

  it('offers a satellite that is already up as done rather than as a purchase', () => {
    const view = show({ orbit: ['BEACON'] });
    expect(screen.getByText(/already in orbit/i)).toBeInTheDocument();
    expect(view.container.querySelector('#row-BEACON [data-progression-state]'))
      .toHaveAttribute('data-progression-state', 'complete');
    expect(view.container.querySelector('#row-BEACON .grayscale')).toBeNull();
    expect(view.container.querySelector('#row-BEACON [data-lock-state="open"]')).toBeInTheDocument();
  });

  it('greys an available unowned satellite without calling it locked', () => {
    const view = show({ orbit: [] });
    const row = view.container.querySelector('#row-BEACON [data-progression-state]');
    expect(row).toHaveAttribute('data-progression-state', 'available-unowned');
    expect(view.container.querySelector('#row-BEACON .grayscale')).toBeInTheDocument();
    expect(view.container.querySelector('#row-BEACON [data-lock-state]')).toBeNull();
  });

  it('adds a lock only when an unowned satellite has a real unmet requirement', () => {
    const view = show({ orbit: ['UPLINK', 'FOUNDRY', 'DERRICK'], orbitSlots: 3 });
    expect(view.container.querySelector('#row-BEACON [data-progression-state]'))
      .toHaveAttribute('data-progression-state', 'locked');
    expect(view.container.querySelector('#row-BEACON [data-lock-state="closed"]')).toBeInTheDocument();
  });

  it('shows a maxed instrument as complete rather than locked', () => {
    const max = INSTRUMENT_MAX_LEVEL.RADAR;
    expect(max).not.toBeNull();
    const view = show({ instruments: { RADAR: max ?? 0 }, orbit: ['UPLINK'] });
    expect(view.container.querySelector('#row-RADAR [data-progression-state]'))
      .toHaveAttribute('data-progression-state', 'complete');
    expect(view.container.querySelector('#row-RADAR [data-lock-state="open"]')).toBeInTheDocument();
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

  it('leads with the hulls that fight, and puts the miner last', () => {
    show({ buildings: { CORE: 9, REFINERY: 3, EXTRACTOR: 3, VAULT: 1, SHIPYARD: 6 } }, 'reach');
    const [warships = -1, support = -1, mining = -1] = bodyOrder(['Warships', 'Support', 'Mining']);
    expect(warships).toBeGreaterThan(-1);
    expect(support).toBeGreaterThan(warships);
    expect(mining).toBeGreaterThan(support);

    const wasp = screen.getByText('Wasp');
    const prospector = screen.getByText('Prospector');
    expect(wasp.compareDocumentPosition(prospector) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('shows the short Frontier before the hulls and names its shared queue', () => {
    show({}, 'reach');
    const [frontier = -1, warships = -1] = bodyOrder(['Frontier projects', 'Warships']);
    expect(frontier).toBeGreaterThan(-1);
    expect(warships).toBeGreaterThan(frontier);
    expect(screen.getByText('Isotope Spectrometry')).toBeInTheDocument();
    expect(screen.getByText('Dense Fuel Cells')).toBeInTheDocument();
    expect(screen.getByText('Gravitic Charges')).toBeInTheDocument();
    expect(screen.getByText(/share Construction and complete on its clock/i)).toBeInTheDocument();
  });

  it('shows completed Frontier projects as complete rather than locked', () => {
    const research = planet().research.map((project) => ({
      ...project,
      discovered: true,
      available: true,
      completed: true,
      completedAt: new Date('2026-08-23T00:00:00.000Z'),
    }));
    const view = show({ research }, 'reach');

    for (const id of ['ISOTOPE_SPECTROMETRY', 'DENSE_FUEL_CELLS', 'GRAVITIC_CHARGES']) {
      expect(view.container.querySelector(`#row-${id} [data-progression-state]`))
        .toHaveAttribute('data-progression-state', 'complete');
      expect(view.container.querySelector(`#row-${id} [data-lock-state="open"]`)).toBeInTheDocument();
    }
  });

  it('names the War act clock after Gravitic Charges instead of claiming Gravitic is missing', () => {
    const research = planet().research.map((project) => project.id === 'GRAVITIC_CHARGES'
      ? {
          ...project,
          discovered: true,
          completed: true,
          completedAt: new Date('2026-08-23T00:00:00.000Z'),
        }
      : project);
    research.push({
      id: 'DEATH_STAR_PROTOCOL',
      cost: { alloy: 7200, crystal: 2400, deuterium: 600 },
      discovered: false,
      completed: false,
      completedAt: null,
      available: false,
      availableAt: new Date('2999-01-01T00:00:00.000Z'),
      prerequisite: 'GRAVITIC_CHARGES',
    });
    const view = show({ research }, 'reach');
    const protocol = view.container.querySelector('#row-DEATH_STAR_PROTOCOL');
    expect(protocol).toHaveTextContent(/War act opens this in/i);
    expect(protocol).not.toHaveTextContent(/Gravitic Charges first/i);
  });

  it('keeps the Runner behind Dense Fuel Cells and shows its Deuterium price when unlocked', () => {
    const locked = show({ buildings: { CORE: 9, REFINERY: 3, EXTRACTOR: 3, VAULT: 1, SHIPYARD: 6 } }, 'reach');
    expect(locked.container.querySelector('#row-RUNNER')).toHaveTextContent('Dense Fuel Cells first');
    locked.unmount();

    const research = planet().research.map((project) => ({
      ...project,
      discovered: true,
      available: true,
      completed: true,
      completedAt: new Date('2026-08-23T00:00:00.000Z'),
    }));
    const unlocked = show({
      buildings: { CORE: 9, REFINERY: 3, EXTRACTOR: 3, VAULT: 1, SHIPYARD: 6 },
      research,
    }, 'reach');
    const runner = unlocked.container.querySelector('#row-RUNNER');
    expect(runner).not.toHaveTextContent('Dense Fuel Cells first');
    expect(runner).toHaveTextContent(String(HULLS.RUNNER.deuterium));
  });

  it('keeps the Breacher behind Gravitic Charges and shows its Deuterium price when unlocked', () => {
    const locked = show({ buildings: { CORE: 9, REFINERY: 3, EXTRACTOR: 3, VAULT: 1, SHIPYARD: 6 } }, 'reach');
    expect(locked.container.querySelector('#row-BREACHER')).toHaveTextContent('Gravitic Charges first');
    locked.unmount();

    const research = planet().research.map((project) => ({
      ...project,
      discovered: true,
      available: true,
      completed: true,
      completedAt: new Date('2026-08-23T00:00:00.000Z'),
    }));
    const unlocked = show({
      buildings: { CORE: 9, REFINERY: 3, EXTRACTOR: 3, VAULT: 1, SHIPYARD: 6 },
      research,
    }, 'reach');
    const breacher = unlocked.container.querySelector('#row-BREACHER');
    expect(breacher).not.toHaveTextContent('Gravitic Charges first');
    expect(breacher).toHaveTextContent(String(HULLS.BREACHER.deuterium));
  });

  it('says a Prospector is aimed at a rock rather than at a person', () => {
    show({ buildings: { CORE: 9, REFINERY: 3, EXTRACTOR: 3, VAULT: 1, SHIPYARD: 6 } }, 'reach');
    expect(screen.getByText(/sent at an asteroid, not at a planet/i)).toBeInTheDocument();
  });

  it('tags every hull with what it is', () => {
    show({ buildings: { CORE: 9, REFINERY: 3, EXTRACTOR: 3, VAULT: 1, SHIPYARD: 6 } }, 'reach');
    for (const tag of ['Cheap, fast attacker', 'Hits the hardest', 'Slow and tough', 'Breaks active shields', 'Carries the loot home', 'Fast strike cargo', 'Mines asteroids']) {
      expect(screen.getByText(tag), `${tag} is missing`).toBeInTheDocument();
    }
  });

  /**
   * D25 removed the Drill satellite; a Prospector is gated by the Shipyard like
   * every other hull. A lock naming anything else here is the old ordering back.
   */
  it('gates a Prospector on the Shipyard and on nothing else', () => {
    show({ buildings: { CORE: 9, REFINERY: 3, EXTRACTOR: 3, VAULT: 1, SHIPYARD: 6 }, orbit: [] }, 'reach');
    expect(screen.queryByText(/needs a drill/i)).toBeNull();
    expect(screen.queryByText(/derrick/i)).toBeNull();
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
  it('asks the Grow question in terms of what the player has, not what the system does', () => {
    show({}, 'grow');
    expect(screen.getByText(/how much ore you make/i)).toBeInTheDocument();
  });

  /**
   * The Aegis is the only shield in the game and it is not on the Defend tab,
   * because D22 keeps every piece of hardware on one surface. That is defensible
   * and it is invisible — so Defend has to say it out loud.
   */
  it('points at the Aegis from Defend, where a player goes looking for a shield', () => {
    show({}, 'defend');
    const pointer = screen.getByText(/a shield is hardware/i);
    expect(pointer).toBeInTheDocument();
    expect(pointer.textContent).toMatch(/aegis/i);
    expect(pointer.textContent).toMatch(/orbit/i);
  });

  it('tags the buildings too, not only the hardware', () => {
    show({}, 'grow');
    for (const tag of ['Unlocks higher levels', 'Makes alloy', 'Makes crystal']) {
      expect(screen.getByText(tag), `${tag} is missing`).toBeInTheDocument();
    }
  });
});
