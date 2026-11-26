import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PROBE_DEFENCE } from '@astera/rules';
import { PlanetScreen } from '../src/screens/PlanetScreen.js';
import i18n from '../src/i18n/index.js';
import { ToastProvider } from '../src/ui/Toast.js';
import type { PlanetView } from '../src/api/schemas.js';
import { planetView } from './fixtures.js';

/**
 * THE PROBE DEFENCE BATTERY ON DEFEND. `docs/sonda-bataryasi-plani-2026-11-24.md` §4, W1.
 *
 * Locked shows only what is missing; available is a hold that spends; building shows its
 * clock; ready counts the charges and the next refill; offline says why the world is as if
 * it had no battery.
 */

const install = vi.fn();
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
    useBuildInterceptor: () => ({ mutate: vi.fn(), isPending: false }),
    useInstallProbeBattery: () => ({ mutate: install, isPending: false }),
  };
});

const MIN = 60_000;

const L1 = PROBE_DEFENCE.levels[0];
const L2 = PROBE_DEFENCE.levels[1];

/** Uplink up, Radar 3, purse full. */
const world = (over: Partial<Omit<PlanetView, 'planet'>> = {}, stock: Partial<PlanetView['planet']> = {}): PlanetView =>
  planetView(
    {
      buildings: { CORE: 9, REFINERY: 4, EXTRACTOR: 4, VAULT: 2, SHIPYARD: 3 },
      instruments: { RADAR: PROBE_DEFENCE.requiredRadar },
      orbit: ['UPLINK'],
      ...over,
    },
    {
      alloy: L2.cost.alloy * 3,
      crystal: L2.cost.crystal * 3,
      deuterium: L2.cost.deuterium * 3,
      alloyCap: 900_000,
      crystalCap: 500_000,
      deuteriumCap: 90_000,
      ...stock,
    },
  );

const built = (charges: number, chargedAgoMinutes = 0, level = 1): NonNullable<PlanetView['probeBattery']> => ({
  startedAt: new Date(Date.now() - 90 * MIN),
  readyAt: new Date(Date.now() - 60 * MIN),
  level,
  charges,
  chargedAt: new Date(Date.now() - chargedAgoMinutes * MIN),
  upgradeLevel: null,
  upgradeStartedAt: null,
  upgradeReadyAt: null,
  recentShots: 0,
});

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
const card = (view: View): HTMLElement => {
  const found = view.container.querySelector<HTMLElement>('[data-probe-battery-state]');
  expect(found, 'the probe battery card does not render').not.toBeNull();
  return found!;
};
const state = (view: View) => card(view).getAttribute('data-probe-battery-state');
const hold = (view: View) => card(view).querySelector<HTMLButtonElement>('[data-act] button');

beforeEach(async () => {
  install.mockClear();
  await i18n.changeLanguage('en');
});

describe('before it is built', () => {
  it('is available on a world that meets the rung, and installs on a hold, never a tap', async () => {
    const view = show(world());
    expect(state(view)).toBe('AVAILABLE');
    await userEvent.click(hold(view)!);
    expect(install).not.toHaveBeenCalled();
    hold(view)!.focus();
    await userEvent.keyboard('{Enter}{Enter}');
    expect(install).toHaveBeenCalledOnce();
  });

  it('names the missing Radar rung as the only thing between the world and the battery', () => {
    const view = show(world({ instruments: { RADAR: PROBE_DEFENCE.requiredRadar - 1 } }));
    expect(state(view)).toBe('LOCKED');
    expect(card(view)).toHaveTextContent(new RegExp(`Radar.*${String(PROBE_DEFENCE.requiredRadar)}`, 'i'));
    expect(hold(view)).toBeNull();
  });

  it('reads the effective rung: no Uplink, no battery', () => {
    const view = show(world({ instruments: { RADAR: 5 }, orbit: [] }));
    expect(state(view)).toBe('LOCKED');
    expect(card(view)).toHaveTextContent(/Uplink/i);
  });

  it('cannot be paid for from an empty store', () => {
    const view = show(world({}, { alloy: 0, crystal: 0, deuterium: 0 }));
    expect(hold(view)).toBeDisabled();
  });

  it('says what it does in one line, the rule behind the ⓘ', () => {
    const view = show(world());
    expect(card(view)).toHaveTextContent(/shoots down/i);
  });
});

describe('once it stands', () => {
  it('shows its own clock while it is being built', () => {
    const view = show(world({ probeBattery: { ...built(L1.capacity), readyAt: new Date(Date.now() + 20 * MIN) } }));
    expect(state(view)).toBe('BUILDING');
    expect(hold(view)).toBeNull();
  });

  it('counts ready charges of the level\'s capacity, refilled at the level\'s pace', () => {
    // One stored, refilling for twelve minutes at six a charge: two more have landed.
    const view = show(world({ probeBattery: built(1, 12) }));
    expect(state(view)).toBe('READY');
    expect(card(view).querySelector('[data-stock-counter]')).toHaveTextContent(`3/${String(L1.capacity)}`);
    expect(card(view).querySelector('[data-probe-refill]')).not.toBeNull();
    // Radar 3 holds no level-2 rung: nothing to order yet.
    expect(hold(view)).toBeNull();
  });

  it('shows its level beside its name', () => {
    const view = show(world({ probeBattery: built(L2.capacity, 0, 2) }));
    expect(card(view).querySelector('[data-probe-level]')).toHaveTextContent(/2/);
    expect(card(view).querySelector('[data-stock-counter]')).toHaveTextContent(`${String(L2.capacity)}/${String(L2.capacity)}`);
  });

  it('says how many probes it shot down in the last window', () => {
    const view = show(world({ probeBattery: { ...built(1, 2), recentShots: 2 } }));
    expect(card(view).querySelector('[data-probe-recent]')).toHaveTextContent(/2/);
    expect(card(view).querySelector('[data-probe-recent]')).toHaveTextContent(/shot down/i);
  });

  it('says nothing of shots when there were none', () => {
    const view = show(world({ probeBattery: built(L1.capacity) }));
    expect(card(view).querySelector('[data-probe-recent]')).toBeNull();
  });

  it('a full battery shows no refill clock', () => {
    const view = show(world({ probeBattery: built(L1.capacity) }));
    expect(card(view).querySelector('[data-probe-refill]')).toBeNull();
  });

  it('says plainly that an empty battery leaves the world as if it had none', () => {
    const view = show(world({ probeBattery: built(0, 1) }));
    expect(state(view)).toBe('EMPTY');
    expect(card(view)).toHaveTextContent(/as if/i);
  });

  it.each<[string, Partial<Omit<PlanetView, 'planet'>>, Partial<PlanetView['planet']>]>([
    ['under an EMP', {}, { empUntil: new Date(Date.now() + 60 * MIN) }],
    ['in recovery', {}, { recoveryUntil: new Date(Date.now() + 60 * MIN) }],
    ['without an Uplink', { orbit: [] }, {}],
  ])('goes offline %s', (_label, over, stock) => {
    const view = show(world({ ...over, probeBattery: built(L1.capacity) }, stock));
    expect(state(view)).toBe('OFFLINE');
  });
});

describe('raising its level (owner, 2026-11-24)', () => {
  it('offers the next level on a hold, saying what it brings and what it costs', async () => {
    const view = show(world({ instruments: { RADAR: L2.requiredRadar }, probeBattery: built(L1.capacity) }));
    const offer = card(view).querySelector('[data-probe-upgrade]');
    expect(offer).not.toBeNull();
    expect(offer).toHaveTextContent(new RegExp(String(L2.capacity)));
    hold(view)!.focus();
    await userEvent.keyboard('{Enter}{Enter}');
    expect(install).toHaveBeenCalledOnce();
  });

  it('names the next level\'s Radar rung when the world is short of it', () => {
    const view = show(world({ probeBattery: built(L1.capacity) }));
    expect(hold(view)).toBeNull();
    expect(card(view).querySelector('[data-gate]')).toHaveTextContent(new RegExp(`Radar.*${String(L2.requiredRadar)}`, 'i'));
  });

  it('reads the Radar as the Core caps it: a Core below the next rung is what is missing', () => {
    // Radar 4 under Core 3 works as Radar 3, and the server refuses level 2 (review, 2026-11-24).
    const view = show(world({ buildings: { CORE: 3, REFINERY: 4, EXTRACTOR: 4, VAULT: 2, SHIPYARD: 3 },
      instruments: { RADAR: L2.requiredRadar }, probeBattery: built(L1.capacity) }));
    expect(hold(view)).toBeNull();
    expect(card(view).querySelector('[data-gate]')).toHaveTextContent(new RegExp(`Core.*${String(L2.requiredRadar)}`, 'i'));
  });

  it('says what is missing when the Core caps the Radar below the first rung', () => {
    const view = show(world({ buildings: { CORE: 2, REFINERY: 4, EXTRACTOR: 4, VAULT: 2, SHIPYARD: 3 } }));
    expect(state(view)).toBe('LOCKED');
    expect(card(view).querySelector('[data-gate]')).toHaveTextContent(new RegExp(`Core.*${String(L1.requiredRadar)}`, 'i'));
  });

  it('shows the upgrade\'s clock while it still works at the old level', () => {
    const view = show(world({ instruments: { RADAR: 8 }, probeBattery: {
      ...built(L1.capacity), upgradeLevel: 2, upgradeStartedAt: new Date(Date.now() - 5 * MIN), upgradeReadyAt: new Date(Date.now() + 30 * MIN),
    } }));
    expect(state(view)).toBe('READY');
    expect(card(view).querySelector('[data-probe-upgrading]')).not.toBeNull();
    expect(hold(view)).toBeNull();
  });

  it('offers nothing past the top level', () => {
    const top = PROBE_DEFENCE.levels.length;
    const view = show(world({ instruments: { RADAR: 9 }, probeBattery: built(PROBE_DEFENCE.levels[top - 1]!.capacity, 0, top) }));
    expect(hold(view)).toBeNull();
    expect(card(view).querySelector('[data-gate]')).toBeNull();
  });
});
