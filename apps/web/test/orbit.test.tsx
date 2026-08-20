import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SATELLITES, satelliteSlots } from '@astera/rules';
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
const planet = (over: Partial<Omit<PlanetView, 'planet'>> = {}): PlanetView =>
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
    useInstallSatellite: () => ({ mutate: vi.fn(), isPending: false }),
    useRaiseInstrument: () => ({ mutate: vi.fn(), isPending: false }),
  };
});

let current: PlanetView = planet();
let focus: 'orbit' | 'reach' | 'defend' | 'grow' = 'orbit';

const show = (over: Partial<Omit<PlanetView, 'planet'>> = {}, tab: 'orbit' | 'reach' | 'defend' | 'grow' = 'orbit') => {
  current = planet(over);
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
  it('offers all four satellites and all four instruments, with no ordering', () => {
    show();
    for (const name of ['Uplink', 'Foundry', 'Derrick', 'Beacon']) {
      expect(screen.getByText(name), `${name} is missing`).toBeInTheDocument();
    }
    for (const name of ['Telescope', 'Radar', 'Aegis', 'Veil']) {
      expect(screen.getByText(name), `${name} is missing`).toBeInTheDocument();
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
    show({ orbit: ['FOUNDRY'] });
    const row = screen.getByText('Foundry').closest('div');
    expect(row?.textContent).not.toMatch(/\bL[0-9]\b/);
  });

  it('offers a satellite that is already up as done rather than as a purchase', () => {
    show({ orbit: ['BEACON'] });
    expect(screen.getByText(/already in orbit/i)).toBeInTheDocument();
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

    const [wasp = -1, prospector = -1] = bodyOrder(['Wasp', 'Prospector']);
    expect(wasp).toBeGreaterThan(-1);
    expect(prospector).toBeGreaterThan(wasp);
  });

  it('says a Prospector is aimed at a rock rather than at a person', () => {
    show({ buildings: { CORE: 9, REFINERY: 3, EXTRACTOR: 3, VAULT: 1, SHIPYARD: 6 } }, 'reach');
    expect(screen.getByText(/sent at an asteroid, not at a planet/i)).toBeInTheDocument();
  });

  it('tags every hull with what it is', () => {
    show({ buildings: { CORE: 9, REFINERY: 3, EXTRACTOR: 3, VAULT: 1, SHIPYARD: 6 } }, 'reach');
    for (const tag of ['Cheap, fast attacker', 'Hits the hardest', 'Slow and tough', 'Carries the loot home', 'Mines asteroids']) {
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
