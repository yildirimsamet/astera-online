import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ANTI_STRATEGIC } from '@astera/rules';
import { PlanetScreen } from '../src/screens/PlanetScreen.js';
import { STRATEGIC_ART } from '../src/ui/assets.js';
import i18n from '../src/i18n/index.js';
import { ToastProvider } from '../src/ui/Toast.js';
import type { PlanetView } from '../src/api/schemas.js';
import { planetView } from './fixtures.js';

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
 * three counts — the research, an EFFECTIVE Radar rung, and an operational world —
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
    useBuild: () => ({ mutate: vi.fn(), isPending: false }),
    useCompleteResearch: () => ({ mutate: vi.fn(), isPending: false }),
    useInstallSatellite: () => ({ mutate: vi.fn(), isPending: false }),
    useRaiseInstrument: () => ({ mutate: vi.fn(), isPending: false }),
    useCancelBuildOrder: () => ({ mutate: vi.fn(), isPending: false }),
    useBuildDeathStar: () => ({ mutate: vi.fn(), isPending: false }),
    useBuildInterceptor: () => ({ mutate: build, isPending: false }),
  };
});

/** A world that meets every requirement: the grid held, an Uplink up, Radar 3. */
const armed = (
  over: Partial<Omit<PlanetView, 'planet'>> = {},
  stock: Partial<PlanetView['planet']> = {},
): PlanetView => {
  const base = planetView();
  return planetView(
    {
      buildings: { CORE: 9, REFINERY: 4, EXTRACTOR: 4, VAULT: 2, SHIPYARD: 3, HANGAR: 1 },
      instruments: { RADAR: ANTI_STRATEGIC.requiredRadar },
      orbit: ['UPLINK'],
      research: base.research.map((project) => project.id === ANTI_STRATEGIC.requiredResearch
        ? { ...project, level: 1, discovered: true, completed: true, available: false }
        : project),
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

const button = (view: View): HTMLButtonElement | null =>
  block(view).querySelector<HTMLButtonElement>('button');

beforeEach(async () => {
  build.mockClear();
  await i18n.changeLanguage('en');
});

describe('where it lives', () => {
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

  it('names the research when the commander does not hold it', () => {
    const base = planetView();
    const view = show(armed({ research: base.research }));
    expect(stateOf(view)).toBe('LOCKED');
    expect(block(view)).toHaveTextContent(/Interception Grid/i);
    expect(button(view)).toBeDisabled();
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

  /** One charge is the ceiling, and a loaded world says so rather than offering a second. */
  it('offers no second charge on a loaded world', () => {
    expect(ANTI_STRATEGIC.maxCharges).toBe(1);
    const view = show(armed({
      interceptor: { id: 'a1', status: 'READY', readyAt: null, remainingSeconds: 0 },
    }));
    expect(stateOf(view)).toBe('READY');
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
 * The Runner is gated on Dense Fuel Cells and the Breacher on Gravitic Charges,
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
        buildings: { CORE: 9, REFINERY: 4, EXTRACTOR: 4, VAULT: 2, SHIPYARD: 6, HANGAR: 2 },
        research: base.research,
      },
      { alloy: 500_000, crystal: 200_000, deuterium: 50_000 },
    );
  };

  const showReach = (onOpenResearch?: () => void) => {
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
    const opener = view.container
      .querySelector<HTMLElement>(`#row-${hull} [data-open-item]`);
    expect(opener, `${hull} does not open`).not.toBeNull();
    await userEvent.click(opener!);
    const lock = view.baseElement
      .querySelector<HTMLElement>('[data-build-sheet] [data-lock-state="closed"]');
    expect(lock, `${hull} states no requirement`).not.toBeNull();
    return lock!;
  };

  it("sends the Runner's fix to the research surface", async () => {
    const onOpenResearch = vi.fn();
    const view = showReach(onOpenResearch);
    await userEvent.click(await fixFrom(view, 'RUNNER'));
    expect(onOpenResearch).toHaveBeenCalledOnce();
  });

  it("sends the Breacher's fix to the same place", async () => {
    const onOpenResearch = vi.fn();
    const view = showReach(onOpenResearch);
    await userEvent.click(await fixFrom(view, 'BREACHER'));
    expect(onOpenResearch).toHaveBeenCalledOnce();
  });

  /** With no host to take it, the reason still stands and only the jump is gone. */
  it('still states the requirement with nowhere to send it', () => {
    const view = showReach();
    expect(view.container.querySelector('#row-RUNNER'))
      .toHaveTextContent(/Dense Fuel Cells first/i);
  });
});
