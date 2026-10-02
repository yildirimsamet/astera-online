import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ANTI_STRATEGIC, HULLS } from '@astera/rules';
import { PlanetScreen } from '../src/screens/PlanetScreen.js';
import { STRATEGIC_ART } from '../src/ui/assets.js';
import i18n from '../src/i18n/index.js';
import { ToastProvider } from '../src/ui/Toast.js';
import type { PlanetView } from '../src/api/schemas.js';
import { openAllBands, planetView } from './fixtures.js';

/**
 * THE ONE CONTROL THAT LOADS AN INTERCEPTION CHARGE. T10, given a door in T12.
 *
 * T10 shipped `buildInterceptor` complete and tested, and shipped no route, no
 * client method and no button — so the Interception Grid was research that
 * authorised nothing. This is the counter it authorises.
 *
 * IT LIVES ON DEFEND AND NOT ON REACH, and that is the whole reading of what it
 * is. The weapon is on Reach because building one is an offensive project; a
 * charge is hardware that sits on YOUR world and fires along YOUR radar circle. A
 * player looking for "what stops a Death Star" looks where the Aegis and the guns
 * are.
 *
 * ITS REQUIREMENTS ARE STATED AND NOT DISCOVERED. `buildInterceptor` refuses on
 * three counts — a full pad, an EFFECTIVE Radar rung, and an operational world —
 * and the effective rung is the subtle one: a Radar 5 with no Uplink draws no
 * circle at all, so a grid installed there could never fire and its owner would
 * have no way of learning why.
 */

const build = vi.fn();
let current: PlanetView = planetView();

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
    useCollect: () => ({ mutate: vi.fn(), isPending: false }),
    useBuild: () => ({ mutate: vi.fn(), isPending: false }),
    useCompleteResearch: () => ({ mutate: vi.fn(), isPending: false }),
    useInstallSatellite: () => ({ mutate: vi.fn(), isPending: false }),
    useRaiseInstrument: () => ({ mutate: vi.fn(), isPending: false }),
    useCancelBuildOrder: () => ({ mutate: vi.fn(), isPending: false }),
    useBuildDeathStar: () => ({ mutate: vi.fn(), isPending: false }),
    useBuildInterceptor: () => ({ mutate: build, isPending: false }),
  };
});

/** The commander's Interception Grid, held. */
const withGrid = (): PlanetView['research'] =>
  planetView().research.map((project) => project.id === 'INTERCEPTION_GRID'
    ? { ...project, level: 1, discovered: true, completed: true, available: false }
    : project);

/** A world that meets every requirement: an Uplink up and Radar 3. No research needed. */
const armed = (
  over: Partial<Omit<PlanetView, 'planet'>> = {},
  stock: Partial<PlanetView['planet']> = {},
): PlanetView => {
  return planetView(
    {
      buildings: { CORE: 9, REFINERY: 4, EXTRACTOR: 4, VAULT: 2, SHIPYARD: 3 },
      instruments: { RADAR: ANTI_STRATEGIC.requiredRadar },
      orbit: ['UPLINK'],
      ...over,
    },
    {
      alloy: ANTI_STRATEGIC.cost.alloy * 3,
      crystal: ANTI_STRATEGIC.cost.crystal * 3,
      deuterium: ANTI_STRATEGIC.cost.deuterium * 3 + 100,
      alloyCap: 900_000,
      crystalCap: 500_000,
      deuteriumCap: 90_000,
      ...stock,
    },
  );
};

const show = (view: PlanetView) => {
  current = view;
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <PlanetScreen focusGroup="defend" />
      </ToastProvider>
    </QueryClientProvider>,
  );
};

type View = ReturnType<typeof render>;

const block = (view: View): HTMLElement => {
  const found = view.container.querySelector<HTMLElement>('[data-interceptor-state]');
  expect(found, 'the interceptor control does not render').not.toBeNull();
  return found!;
};

const stateOf = (view: View): string | null =>
  block(view).getAttribute('data-interceptor-state');

/** The commit. The requirement chips above it are doors, and buttons too. */
const button = (view: View): HTMLButtonElement | null =>
  block(view).querySelector<HTMLButtonElement>('[data-act] button');

beforeEach(async () => {
  build.mockClear();
  await i18n.changeLanguage('en');
});

describe('where it lives', () => {
  it('keeps the battery visible in Defend', () => {
    expect(block(show(armed()))).not.toHaveClass('hidden');
  });

  it('is on Defend, beside the shield and the guns', () => {
    expect(stateOf(show(armed()))).not.toBeNull();
  });

  it('is not on Reach with the weapon it answers', () => {
    current = armed();
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const view = render(
      <QueryClientProvider client={client}>
        <ToastProvider>
          <PlanetScreen focusGroup="reach" />
        </ToastProvider>
      </QueryClientProvider>,
    );
    expect(view.container.querySelector('[data-interceptor-state]')).toBeNull();
  });

  it('uses the commissioned anti-strategic battery menu render', () => {
    const view = show(armed());
    const art = block(view).querySelector<HTMLImageElement>('img[data-interceptor-art]');

    expect(STRATEGIC_ART.interceptor).toBe(
      '/assets/images/general/anti-strategic-battery.png',
    );
    expect(art).not.toBeNull();
    expect(art).toHaveAttribute('src', STRATEGIC_ART.interceptor);
  });
});

describe('what it says it needs', () => {
  it('reads as available when every requirement is met', () => {
    expect(stateOf(show(armed()))).toBe('AVAILABLE');
  });

  it('does not require the retired research', () => {
    const base = planetView();
    const view = show(armed({ research: base.research }));
    expect(stateOf(view)).toBe('AVAILABLE');
    expect(button(view)).toBeEnabled();
  });

  it('names the Radar rung when it is too low', () => {
    const view = show(armed({ instruments: { RADAR: ANTI_STRATEGIC.requiredRadar - 1 } }));
    expect(stateOf(view)).toBe('LOCKED');
    expect(block(view))
      .toHaveTextContent(new RegExp(`Radar.*${String(ANTI_STRATEGIC.requiredRadar)}`, 'i'));
    expect(button(view)).toBeDisabled();
  });

  /**
   * THE SUBTLE ONE. An Uplink gates the Radar, so a Radar 5 without one has an
   * effective rung of zero and draws no circle. The server checks the EFFECTIVE
   * level; a screen that checked the installed level would sell a charge that
   * could never fire.
   */
  it('refuses a high Radar with no Uplink holding it up', () => {
    const view = show(armed({ instruments: { RADAR: 5 }, orbit: [] }));
    expect(stateOf(view)).toBe('LOCKED');
    expect(block(view)).toHaveTextContent(/Uplink/i);
    expect(button(view)).toBeDisabled();
  });

  it('refuses a world still in recovery', () => {
    const view = show(armed({}, {
      recoveryUntil: new Date(Date.now() + 3_600_000),
    }));
    expect(button(view)).toBeDisabled();
  });

  it('refuses when the charge cannot be paid for', () => {
    const view = show(armed({}, { alloy: 0, crystal: 0, deuterium: 0 }));
    expect(button(view)).toBeDisabled();
  });
});

describe('the charge itself', () => {
  it('loads one when pressed', async () => {
    const view = show(armed());
    await userEvent.click(button(view)!);
    expect(build).toHaveBeenCalledOnce();
  });

  it('shows a charge under construction with its own clock', () => {
    const view = show(armed({
      interceptor: {
        id: 'a1',
        status: 'BUILDING',
        readyAt: new Date(Date.now() + 20 * 60_000),
        remainingSeconds: 20 * 60,
      },
    }));
    expect(stateOf(view)).toBe('BUILDING');
  });

  it('shows one of two charges in a Tally and offers the second, with no research', () => {
    expect(ANTI_STRATEGIC.charges.base).toBe(2);
    const view = show(armed({
      interceptor: { id: 'a1', status: 'READY', readyAt: null, remainingSeconds: 0 },
      interceptors: [{ id: 'a1', status: 'READY', readyAt: null, remainingSeconds: 0 }],
    }));
    expect(stateOf(view)).toBe('READY');
    expect(block(view).querySelector('[data-tally]')).toHaveAttribute('data-used', '1');
    expect(block(view).querySelector('[data-tally]')).toHaveAttribute('data-total', '2');
    expect(button(view)).toBeEnabled();
  });

  /**
   * WHY A COLONY WANTS ONE. Owner, 2026-10-01: every Death Star that lands costs a colony
   * 20 loyalty and takes it at 20 or less — the battery is what stands between the two.
   * A capital has no loyalty, so its battery says nothing of the kind.
   */
  it('tells a colony what every weapon that lands costs it', () => {
    const view = show(armed({}, { kind: 'COLONY' }));
    expect(block(view)).toHaveTextContent(/20 loyalty/i);
  });

  it('says nothing about loyalty on a capital', () => {
    const view = show(armed({}, { kind: 'CAPITAL' }));
    expect(block(view)).not.toHaveTextContent(/loyalty/i);
  });

  /** A pad holds two to four now, so the headline counts what is loaded rather than saying "one". */
  it('counts the loaded charges in its headline', () => {
    const two = [
      { id: 'a1', status: 'READY' as const, readyAt: null, remainingSeconds: 0 },
      { id: 'a2', status: 'READY' as const, readyAt: null, remainingSeconds: 0 },
    ];
    const view = show(armed({ interceptor: two[0]!, interceptors: two }));
    expect(block(view)).toHaveTextContent(/Charges loaded: 2/);
    expect(block(view)).not.toHaveTextContent(/One charge loaded/);
  });

  /** Owner, 2026-10-01: the Interception Grid takes the pad from two to four. */
  it('holds four once the Grid is researched', () => {
    const two = [
      { id: 'a1', status: 'READY' as const, readyAt: null, remainingSeconds: 0 },
      { id: 'a2', status: 'READY' as const, readyAt: null, remainingSeconds: 0 },
    ];
    const view = show(armed({ research: withGrid(), interceptor: two[0]!, interceptors: two }));
    expect(block(view).querySelector('[data-tally]')).toHaveAttribute('data-total', '4');
    expect(button(view)).toBeEnabled();
  });

  /** A full pad at two names the research that makes it four, and opens it. */
  it('points a full pad at the Interception Grid', async () => {
    const two = [
      { id: 'a1', status: 'READY' as const, readyAt: null, remainingSeconds: 0 },
      { id: 'a2', status: 'READY' as const, readyAt: null, remainingSeconds: 0 },
    ];
    current = armed({ interceptor: two[0]!, interceptors: two });
    const onOpenResearch = vi.fn();
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const view = render(
      <QueryClientProvider client={client}>
        <ToastProvider>
          <PlanetScreen focusGroup="defend" onOpenResearch={onOpenResearch} />
        </ToastProvider>
      </QueryClientProvider>,
    );
    expect(button(view)).toBeNull();
    const next = within(block(view)).getByRole('button', { name: /interception grid/i });
    expect(next).toHaveTextContent('4');
    await userEvent.click(next);
    expect(onOpenResearch).toHaveBeenCalledWith('INTERCEPTION_GRID');
  });

  /**
   * A LOADED CHARGE IS NOT RADAR PROTECTION WHEN ITS RING HAS GONE DARK.
   *
   * Core loss can disable the Uplink slot and therefore zero the effective Radar.
   * The charge remains stored, but calling the battery simply "Ready" tells the
   * commander to trust a circle this world no longer has.
   */
  /** D3 (owner, round 2): charges are a tally — loaded, loading, empty. */
  it('draws its charges as loaded and loading cells', () => {
    const view = show(armed({
      interceptors: [
        { id: 'a1', status: 'READY', readyAt: null, remainingSeconds: 0 },
        { id: 'a2', status: 'BUILDING', readyAt: new Date(Date.now() + 10 * 60_000), remainingSeconds: 30 * 60 },
      ],
    }));
    expect([...block(view).querySelectorAll<HTMLElement>('[data-tally] [data-cell]')].map((cell) => cell.dataset.cell))
      .toEqual(['ready', 'loading']);
    expect(block(view).querySelector('[data-charge-progress]')).toHaveClass('bg-v2-self');
  });

  it('sends a Radar too low to be trusted to the Radar', async () => {
    const view = show(armed({ instruments: { RADAR: ANTI_STRATEGIC.requiredRadar - 1 } }));
    // jsdom has no layout; the screen scrolls the row it points at into view.
    Element.prototype.scrollIntoView = vi.fn();
    const doors = within(block(view)).getByRole('list');
    await userEvent.click(within(doors).getByRole('button', { name: new RegExp(`radar l${String(ANTI_STRATEGIC.requiredRadar)}`, 'i') }));
    expect(screen.getByRole('tab', { name: 'Intel' })).toHaveAttribute('aria-selected', 'true');
  });

  it('marks a loaded charge as lacking Radar protection when its Uplink is inactive', () => {
    const view = show(armed({
      instruments: { RADAR: 5 },
      orbit: [],
      interceptor: { id: 'a1', status: 'READY', readyAt: null, remainingSeconds: 0 },
    }));

    expect(stateOf(view)).toBe('NO_RADAR');
    expect(block(view)).toHaveTextContent(/Radar ring is offline/i);
    expect(block(view)).toHaveTextContent(/Uplink/i);
    expect(button(view)).toBeNull();
  });

  /**
   * THE FIELD THIS READS IS NOT THE WEAPON'S. T12 split `strategic` in two after
   * finding that a charge started later reported itself as the Death Star. A world
   * with a Death Star ready and no charge must still offer one.
   */
  it('does not read a ready Death Star as a loaded charge', () => {
    const view = show(armed({
      strategic: { id: 'w1', status: 'READY', readyAt: null, remainingSeconds: 0 },
    }));
    expect(stateOf(view)).toBe('AVAILABLE');
    expect(button(view)).toBeEnabled();
  });
});

describe('in Turkish', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('tr');
  });

  it('states the control and its requirements without English', () => {
    const view = show(armed({ instruments: { RADAR: 0 } }));
    expect(block(view).textContent).not.toMatch(/Research the|Raise the Radar/i);
    expect(block(view).textContent.trim().length).toBeGreaterThan(0);
  });
});

/**
 * THE HULL GATES THAT POINTED AT ROWS THAT LEFT. T12.
 *
 * The Tempest is gated on Starship Engineering and Ship Power, while the Nullifier
 * is gated on Starship Engineering and Ship Propulsion,
 * and both refusals offer to take the player to the research that would open
 * them. That worked through `TAB_OF` while the cards were on this sheet. They are
 * not any more, so the jump had to move with them — unfixed it fell through to
 * `'grow'` and left the player on the Command Core wondering what happened.
 */
describe('a hull gated on research', () => {
  const gated = () => {
    const base = planetView();
    return planetView(
      {
        buildings: { CORE: 9, REFINERY: 4, EXTRACTOR: 4, VAULT: 2, SHIPYARD: 6 },
        research: base.research,
      },
      { alloy: 500_000, crystal: 200_000, deuterium: 50_000 },
    );
  };

  const showReach = (onOpenResearch?: (project: string) => void) => {
    current = gated();
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(
      <QueryClientProvider client={client}>
        <ToastProvider>
          <PlanetScreen focusGroup="reach" {...(onOpenResearch ? { onOpenResearch } : {})} />
        </ToastProvider>
      </QueryClientProvider>,
    );
  };

  /**
   * The commitment lives in the build sheet, not on the compact row (D109) — so
   * the lock that carries the fix is in there too. This is the same path a player
   * takes: press the row, read the sheet, press the requirement.
   */
  const fixFrom = async (view: View, hull: string): Promise<HTMLElement> => {
    // The Fleet tab's families fold; the Nullifier is behind the Specialist band.
    await openAllBands(screen, userEvent.setup());
    const opener = view.container
      .querySelector<HTMLElement>(`#row-${hull} [data-open-item]`);
    expect(opener, `${hull} does not open`).not.toBeNull();
    await userEvent.click(opener!);
    const lock = view.baseElement
      .querySelector<HTMLElement>('[data-build-sheet] [data-lock-state="closed"]');
    expect(lock, `${hull} states no requirement`).not.toBeNull();
    return lock!;
  };

  it("sends the Tempest's fix to the research surface", async () => {
    const onOpenResearch = vi.fn();
    const view = showReach(onOpenResearch);
    await userEvent.click(await fixFrom(view, 'TEMPEST'));
    expect(onOpenResearch).toHaveBeenCalledOnce();
    // The door says which project, so the research map opens on it rather than on its default.
    expect(HULLS.TEMPEST.requiredResearch.map((need) => need.project)).toContain(onOpenResearch.mock.calls[0]?.[0]);
  });

  it("sends the Nullifier's fix to the same place", async () => {
    const onOpenResearch = vi.fn();
    const view = showReach(onOpenResearch);
    await userEvent.click(await fixFrom(view, 'NULLIFIER'));
    expect(onOpenResearch).toHaveBeenCalledOnce();
    expect(HULLS.NULLIFIER.requiredResearch.map((need) => need.project)).toContain(onOpenResearch.mock.calls[0]?.[0]);
  });

  /** With no host to take it, the reason still stands and only the jump is gone. */
  it('still states the requirement with nowhere to send it', () => {
    const view = showReach();
    expect(view.container.querySelector('#row-TEMPEST'))
      .toHaveTextContent(/Starship Engineering I/i);
  });
});
