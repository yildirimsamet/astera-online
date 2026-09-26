import type { ReactNode } from 'react';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import { RIVAL, radarContactRange, radarRange, telescopeSlots } from '@astera/rules';
import { Api } from '../src/api/client.js';
import { ApiProvider } from '../src/api/context.js';
import { duration, staleness } from '../src/lib/time.js';
import { IntelScreen } from '../src/screens/IntelScreen.js';

/**
 * THE INTEL SHEET — A BOOK OF WHAT YOU WATCH. D4 (owner, 2026-09-24) and E7/K11.
 *
 * Three shelves: WATCH (the Telescope rack, the rivals you marked, and everything you
 * know — live readings with clarity bars, probe readings with their age as grain),
 * REPORTS (probes and battles, the two lists this screen always had) and RADAR (the
 * reach, the day's scans on a timeline, the log).
 *
 * Kept from before, because they were owner-reported faults:
 *
 *   · COVERAGE MEASURES YOUR EYES, NOT THE GALAXY. "Watching 2 of 47" was a progress
 *     bar toward a goal the game does not have; the denominator is the slot count and
 *     the size of the galaxy is the reason a slot is a decision.
 *   · SLOTS BELONG TO A WORLD, WATCHES TO A COMMANDER (D97/D134).
 *   · THE DOUBT IS THE PRODUCT, SO THE DOUBT IS THE PICTURE (D127).
 *   · A NOTIFICATION POINTS AT A SHELF, NOT JUST A ROOM (D121).
 */

const harness = () => {
  const api = new Api({ fetch: vi.fn() as unknown as typeof globalThis.fetch });
  const queries = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queries}>
      <ApiProvider api={api}>{children}</ApiProvider>
    </QueryClientProvider>
  );
  return { wrapper, queries };
};

/** A galaxy with `n` other worlds in it. Only the count is under test. */
const galaxy = (n: number) => ({
  you: { planetId: 'p1', playerId: 'pl1' },
  planets: [
    { id: 'p1', name: 'Home', owner: 'Me', position: { x: 0, y: 0, z: 0 }, coreTier: 2, satellites: [], shielded: false, isSelf: true },
    ...Array.from({ length: n }, (_, i) => ({
      id: `q${String(i)}`,
      name: `World ${String(i)}`,
      owner: 'Someone',
      position: { x: 100 * i, y: 0, z: 0 },
      coreTier: 2,
      satellites: [],
      shielded: false,
      isSelf: false,
    })),
  ],
});

/** One probe report, with the fuzz band the test is actually about. */
const report = (low: number, high: number, over: Record<string, unknown> = {}) => ({
  targetPlanetId: 'q0',
  targetName: 'World 0',
  targetUsername: 'Someone',
  at: new Date(),
  stock: { low, high },
  defence: { low, high },
  fleetSize: { low, high },
  accuracy: 0.8,
  fleetHome: true,
  detected: false,
  ...over,
});

const watch = (slot: number, over: Record<string, unknown> = {}, observerPlanetId = 'p1') => ({
  observerPlanetId,
  slot,
  targetPlanetId: `q${String(slot)}`,
  targetName: `World ${String(slot)}`,
  ownerName: 'Someone',
  assignedAt: new Date().toISOString(),
  reading: { status: 'HOME', staleMinutes: 0, etaMinutes: null, state: 'CLEAR', clarity: 1 },
  ...over,
});

const intel = (
  watching: number,
  probeReports: unknown[] = [],
  /** Which world's sockets these are. A slot number belongs to a world, not a commander. */
  observerPlanetId = 'p1',
  extra: unknown[] = [],
  radarLog: unknown[] = [],
  first: Record<string, unknown> = {},
) => ({
  watching: [
    ...Array.from({ length: watching }, (_, slot) => watch(slot, slot === 0 ? first : {}, observerPlanetId)),
    ...extra,
  ],
  probeReports,
  probeCooldowns: [],
  radarLog,
  probeCost: { alloy: 50, crystal: 50 },
});

const planet = (telescope: number, radar: number) => ({
  planet: {
    id: 'p1',
    name: 'Home',
    position: { x: 0, y: 0, z: 0 },
    alloy: 500, crystal: 120, deuterium: 0, alloyCap: 5000, crystalCap: 1000,
    bufferAlloy: 0, bufferCrystal: 0, bufferDeuterium: 0, bufferAlloyCap: 100, bufferCrystalCap: 100,
    vaultCapacity: { alloy: 100, crystal: 20, deuterium: 0 },
    alloyPerHour: 100, crystalPerHour: 30,
    shield: 0, shieldCap: 0, disruptedUntil: null,
    dominion: 0, wealth: 0,
  },
  buildings: { CORE: 4, REFINERY: 2, EXTRACTOR: 2, VAULT: 1, SHIPYARD: 1 },
  instruments: { TELESCOPE: telescope, RADAR: radar, AEGIS: 0, VEIL: 0 },
  orbit: [],
  fleet: { DART: 10 },
  ground: {},
  flight: { used: 0, total: 3 },
  fleetAway: {},
});

interface Rival { planetId: string; slot: number; owner: string; name: string; lost: boolean }

const show = (opts: {
  telescope: number;
  radar?: number;
  watching: number;
  worlds: number;
  probes?: unknown[];
  onOpenOrbit?: () => void;
  open?: { stop: 'probes' | 'battles'; request: number };
  /** Watches belonging to ANOTHER of the commander's worlds. */
  elsewhere?: unknown[];
  radarLog?: unknown[];
  /** Overrides on the first watch. */
  first?: Record<string, unknown>;
  rivals?: Rival[];
  onFocusRival?: (planetId: string) => void;
  onOpenDossier?: (planetId: string) => void;
}) => {
  const { wrapper: Wrapper, queries } = harness();
  queries.setQueryData(['galaxy'], galaxy(opts.worlds));
  queries.setQueryData(
    ['intel'],
    intel(opts.watching, opts.probes ?? [], 'p1', opts.elsewhere ?? [], opts.radarLog ?? [], opts.first ?? {}),
  );
  queries.setQueryData(['planet'], planet(opts.telescope, opts.radar ?? 0));
  queries.setQueryData(['reports'], { reports: [] });
  render(
    <Wrapper>
      <IntelScreen
        {...(opts.onOpenOrbit ? { onOpenOrbit: opts.onOpenOrbit } : {})}
        {...(opts.open ? { open: opts.open } : {})}
        {...(opts.rivals ? { rivals: opts.rivals } : {})}
        {...(opts.onFocusRival ? { onFocusRival: opts.onFocusRival } : {})}
        {...(opts.onOpenDossier ? { onOpenDossier: opts.onOpenDossier } : {})}
      />
    </Wrapper>,
  );
};

const shelf = async (name: 'Watch' | 'Reports' | 'Radar') => {
  await userEvent.click(screen.getByRole('tab', { name }));
};
const rack = (): HTMLElement => document.querySelector<HTMLElement>('[data-telescope-rack]')!;

describe('three shelves', () => {
  it('opens watched and probed worlds directly from the known list', async () => {
    const focus = vi.fn();
    show({ telescope: 1, watching: 1, worlds: 2, probes: [report(100, 200, { targetPlanetId: 'q1', targetName: 'World 1' })], onOpenDossier: focus });
    await userEvent.click(document.querySelector<HTMLButtonElement>('[data-known="watch"] button')!);
    await userEvent.click(document.querySelector<HTMLButtonElement>('[data-known="probe"] button')!);
    expect(focus.mock.calls).toEqual([['q0'], ['q1']]);
  });
  it('opens on what you are watching, with the reports and the radar a tap away', () => {
    show({ telescope: 1, watching: 0, worlds: 20 });
    expect(screen.getByRole('tablist', { name: 'Intel' })).toBeVisible();
    expect(screen.getByRole('tab', { name: 'Watch' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'Reports' })).toHaveAttribute('aria-selected', 'false');
    expect(screen.getByRole('tab', { name: 'Radar' })).toHaveAttribute('aria-selected', 'false');
  });
});

describe('the watch shelf', () => {
  it('shows every Telescope slot with its target, or idle', () => {
    show({ telescope: 5, watching: 1, worlds: 47 });
    expect(rack().querySelectorAll('[data-slot]')).toHaveLength(telescopeSlots(5));
    expect(within(rack()).getByText('World 0')).toBeInTheDocument();
    expect(within(rack()).getAllByText('Idle')).toHaveLength(telescopeSlots(5) - 1);
  });

  it('counts against the slots you own, never against the galaxy', () => {
    show({ telescope: 3, watching: 1, worlds: 47 });
    expect(telescopeSlots(3)).toBe(2);
    expect(screen.getByText(/watching 1 of your 2 slots/i)).toBeInTheDocument();
    expect(screen.queryByText(/of 47/i)).not.toBeInTheDocument();
  });

  /** The galaxy is context for the decision, not a denominator. */
  it('names the size of the galaxy as the reason to choose, once every slot is spent', () => {
    show({ telescope: 3, watching: 2, worlds: 47 });
    expect(screen.getByText(/every slot you have is watching someone/i)).toBeInTheDocument();
    expect(screen.getByText(/47 worlds out there and 2 eyes to spend/i)).toBeInTheDocument();
  });

  it('says which slots are idle rather than how much of the disc is dark', () => {
    show({ telescope: 5, watching: 1, worlds: 47 });
    expect(telescopeSlots(5)).toBe(3);
    expect(screen.getByText(/2 slots are idle/i)).toBeInTheDocument();
  });

  it('sells the first telescope when there is none', () => {
    show({ telescope: 0, watching: 0, worlds: 47 });
    expect(screen.getByText(/cannot see into a single planet/i)).toBeInTheDocument();
    expect(screen.getByText(/cheapest way to stop that/i)).toBeInTheDocument();
  });

  it('shows the missing capability as an instrument diagram and routes straight to Orbit', async () => {
    const onOpenOrbit = vi.fn();
    show({ telescope: 0, radar: 0, watching: 0, worlds: 47, onOpenOrbit });
    expect(document.querySelector('[data-instrument-diagram="telescope"]')).not.toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Open Orbit' }));
    expect(onOpenOrbit).toHaveBeenCalledOnce();
    await shelf('Radar');
    expect(document.querySelector('[data-instrument-diagram="radar"]')).not.toBeNull();
  });

  /**
   * The next slot is offered only where the next level genuinely buys one. D18 gives
   * slots at L1, L3 and L5, so at L1 the next level buys nothing here and saying
   * otherwise would be the "unchanged before-and-after" D36 forbids.
   */
  it('offers the next slot only on the level that actually adds one', () => {
    show({ telescope: 1, watching: 1, worlds: 47 });
    expect(document.querySelector('[data-slot-next]')).toBeNull();

    cleanup();
    show({ telescope: 2, watching: 1, worlds: 47 });
    expect(document.querySelector('[data-slot-next]')).toHaveTextContent(/telescope l3/i);
  });

  /** "One MORE" than none is not a sentence. With no telescope, sell the first. */
  it('does not offer one more slot to a player who has none', () => {
    show({ telescope: 0, watching: 0, worlds: 47 });
    expect(document.querySelector('[data-slot-next]')).toBeNull();
  });

  it('still says what having no radar costs', () => {
    show({ telescope: 3, watching: 2, worlds: 47, radar: 0 });
    expect(screen.getByText(/with no radar/i)).toBeInTheDocument();
  });
});

describe('slots belong to a world, watches to a commander', () => {
  const colonyWatch = watch(0, { targetPlanetId: 'far', targetName: 'Elsewhere', ownerName: 'Somebody' }, 'colony');

  it('does not let another world’s slot 0 hide this world’s', () => {
    show({ telescope: 1, watching: 1, worlds: 20, elsewhere: [colonyWatch] });
    expect(within(rack()).getByText('World 0')).toBeInTheDocument();
    expect(within(rack()).queryByText('Elsewhere')).not.toBeInTheDocument();
  });

  it('counts only this world’s watches against this world’s sockets', () => {
    show({ telescope: 3, watching: 1, worlds: 20, elsewhere: [colonyWatch] });
    expect(telescopeSlots(3)).toBe(2);
    expect(screen.getByText(/watching 1 of your 2 slots/i)).toBeInTheDocument();
    expect(screen.queryByText(/every slot you have is watching/i)).not.toBeInTheDocument();
  });

  it('still shows an idle socket here when another world has spent its own', () => {
    show({ telescope: 3, watching: 0, worlds: 20, elsewhere: [colonyWatch] });
    expect(within(rack()).getAllByText('Idle')).toHaveLength(2);
  });

  /** What you KNOW is the commander's: the colony's watch is still known. */
  it('lists every world you know, whichever of yours is watching it', () => {
    show({ telescope: 3, watching: 1, worlds: 20, elsewhere: [colonyWatch] });
    const known = document.querySelector<HTMLElement>('[data-known-list]')!;
    expect(known).toHaveTextContent('World 0');
    expect(known).toHaveTextContent('Elsewhere');
  });
});

/** D4: the rivals you marked on the galaxy, where you read what you know about them. */
describe('the rivals you marked', () => {
  const rivals: Rival[] = [
    { planetId: 'q2', slot: 0, owner: 'Vex', name: 'Kestrel', lost: false },
    { planetId: 'q3', slot: 1, owner: 'Vega', name: 'Orin', lost: false },
  ];

  it('lists them by slot and takes you to one', async () => {
    const onFocusRival = vi.fn();
    show({ telescope: 1, watching: 0, worlds: 20, rivals, onFocusRival });
    const marks = within(document.querySelector<HTMLElement>('[data-rivals]')!).getAllByRole('button');
    expect(marks.map((mark) => mark.textContent)).toEqual([
      expect.stringMatching(/1 · Vex/),
      expect.stringMatching(/2 · Vega/),
    ]);
    await userEvent.click(marks[1]!);
    expect(onFocusRival).toHaveBeenCalledWith('q3');
  });

  it('counts the marks against the most there can be', () => {
    show({ telescope: 1, watching: 0, worlds: 20, rivals });
    expect(document.querySelector('[data-rivals]')).toHaveTextContent(`2 / ${String(RIVAL.max)}`);
  });

  it('says how to mark one when there is none', () => {
    show({ telescope: 1, watching: 0, worlds: 20, rivals: [] });
    expect(document.querySelector('[data-rivals]')).toHaveTextContent(/mark/i);
  });

  /** A mark whose commander is off the disc has nowhere to go; it is not a door. */
  it('keeps a lost mark as a name, not a door', () => {
    show({ telescope: 1, watching: 0, worlds: 20, rivals: [{ planetId: 'gone', slot: 0, owner: '', name: '', lost: true }] });
    expect(within(document.querySelector<HTMLElement>('[data-rivals]')!).queryByRole('button', { name: /^1 ·/ })).toBeNull();
  });
});

/** B7 and K11: clarity is the bars (live), age is the grain (a snapshot). */
describe('what you know', () => {
  it('lists a watched world live, with its clarity as bars and never a ship count', () => {
    show({ telescope: 3, watching: 1, worlds: 20 });
    const row = document.querySelector<HTMLElement>('[data-known="watch"]')!;
    expect(row).toHaveTextContent('Someone');
    expect(within(row).getByRole('img', { name: /clarity/i })).toBeInTheDocument();
    // A live reading does not age: its picture carries clarity, never grain.
    expect(row.querySelector('[data-age]')).toHaveAttribute('data-age', 'fresh');
  });

  it('lists a probed world with its age, and grains the picture as it ages', () => {
    const at = new Date(Date.now() - 3 * 60 * 60_000);
    show({
      telescope: 1, watching: 0, worlds: 20,
      probes: [report(100, 400, { at, targetPlanetId: 'q9', targetUsername: 'Nobody', targetName: 'Far' })],
    });
    const row = document.querySelector<HTMLElement>('[data-known="probe"]')!;
    expect(row).toHaveTextContent('Nobody');
    expect(row).toHaveTextContent(staleness(180));
    expect(row.querySelector('[data-age]')).toHaveAttribute('data-age', 'aging');
  });

  it('does not list a world twice when a Telescope already watches it', () => {
    show({ telescope: 3, watching: 1, worlds: 20, probes: [report(100, 400)] });
    expect(document.querySelectorAll('[data-known]')).toHaveLength(1);
  });

  /** E7: an away fleet is an opportunity, and its window is timed only at full clarity. */
  it('opens a window on a fleet that is away, with the time it has', () => {
    show({
      telescope: 3, watching: 1, worlds: 20,
      first: { reading: { status: 'AWAY', staleMinutes: 0, etaMinutes: 72, state: 'FULL', clarity: 1 } },
    });
    expect(document.querySelector('[data-window]')).toHaveTextContent(duration(72));
  });

  it('explains clarity and age one tap deeper', async () => {
    show({ telescope: 3, watching: 1, worlds: 20 });
    const how = screen.getByRole('button', { name: /clarity and age/i });
    expect(how).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(how);
    expect(document.querySelector('[data-known-legend]')).toHaveTextContent(/grain/i);
  });
});

describe('the radar, glanced from the watch shelf', () => {
  const scans = [
    { at: new Date(Date.now() - 60 * 60_000), planetId: 'p1', planetName: 'Home', bearing: 'NW', originPlanetName: 'Kestrel' },
    { at: new Date(Date.now() - 5 * 60 * 60_000), planetId: 'p1', planetName: 'Home', bearing: null, originPlanetName: null },
    { at: new Date(Date.now() - 30 * 60 * 60_000), planetId: 'p1', planetName: 'Home', bearing: null, originPlanetName: null },
  ];

  it('counts the day’s contacts and opens the radar', async () => {
    show({ telescope: 1, watching: 0, worlds: 20, radar: 3, radarLog: scans });
    const glance = screen.getByRole('button', { name: /2 contacts/i });
    await userEvent.click(glance);
    expect(screen.getByRole('tab', { name: 'Radar' })).toHaveAttribute('aria-selected', 'true');
  });

  it('draws nothing to glance at with no radar', () => {
    show({ telescope: 1, watching: 0, worlds: 20, radar: 0 });
    expect(document.querySelector('[data-radar-glance]')).toBeNull();
  });

  it('marks the day’s scans on a timeline and lists every scan', async () => {
    show({ telescope: 1, watching: 0, worlds: 20, radar: 3, radarLog: scans });
    await shelf('Radar');
    const panel = screen.getByRole('tabpanel', { name: 'Radar' });
    expect(panel.querySelectorAll('[data-scan-tick]')).toHaveLength(2);
    expect(panel.querySelectorAll('[data-scan]')).toHaveLength(3);
    // A scan in the last six hours is a live threat to you: red. An older one is not.
    const [fresh, , old] = [...panel.querySelectorAll<HTMLElement>('[data-scan] [data-scan-dot]')];
    expect(fresh).toHaveClass('bg-v2-hostile');
    expect(old).not.toHaveClass('bg-v2-hostile');
  });

  it('opens the named world in a radar report', async () => {
    const focus = vi.fn();
    show({ telescope: 1, watching: 0, worlds: 20, radar: 3, radarLog: scans, onOpenDossier: focus });
    await shelf('Radar');
    await userEvent.click(screen.getAllByRole('button', { name: /Home/ })[0]!);
    expect(focus).toHaveBeenCalledWith('p1');
  });

  it('opens a disclosed Radar 5 origin from its name', async () => {
    const focus = vi.fn();
    show({ telescope: 1, watching: 0, worlds: 20, radar: 5, radarLog: [{ ...scans[0]!, originPlanetId: 'enemy-world' }], onOpenDossier: focus });
    await shelf('Radar');
    await userEvent.click(screen.getByRole('button', { name: /Kestrel/ }));
    expect(focus).toHaveBeenCalledWith('enemy-world');
  });
});

describe('what the radar promises', () => {
  it('states the radar reach and never invents a countdown', async () => {
    show({ telescope: 1, watching: 0, worlds: 20, radar: 5 });
    await shelf('Radar');
    const reach = screen.getByRole('img', {
      name: new RegExp(String(radarContactRange(5)), 'i'),
    });
    expect(reach).toBeInTheDocument();
    expect(screen.queryByText(/minutes before a fleet lands/i)).not.toBeInTheDocument();
  });

  it('draws one ring while the two radar circles are one number', async () => {
    show({ telescope: 1, watching: 0, worlds: 20, radar: 5 });
    await shelf('Radar');
    const sense = document.querySelector<HTMLElement>('[data-ring="sense"]');
    const warn = document.querySelector<HTMLElement>('[data-ring="warn"]');
    expect(warn, 'the radar circle is never undrawn').not.toBeNull();

    if (radarContactRange(5) === radarRange(5)) {
      expect(sense, 'a second identical ring was drawn').toBeNull();
    } else {
      expect(sense).not.toBeNull();
      expect(Number.parseFloat(sense!.style.width))
        .toBeGreaterThan(Number.parseFloat(warn!.style.width));
    }
  });

  it('draws the reach at the first rung too, at its own size', async () => {
    show({ telescope: 1, watching: 0, worlds: 20, radar: 1 });
    await shelf('Radar');
    const small = document.querySelector<HTMLElement>('[data-ring="warn"]');
    expect(small).not.toBeNull();
    const atOne = Number.parseFloat(small!.style.width);

    cleanup();
    show({ telescope: 1, watching: 0, worlds: 20, radar: 5 });
    await shelf('Radar');
    const large = document.querySelector<HTMLElement>('[data-ring="warn"]');
    expect(Number.parseFloat(large!.style.width)).toBeGreaterThan(atOne);
  });

  it('draws nothing at all with no radar', async () => {
    show({ telescope: 1, watching: 0, worlds: 20, radar: 0 });
    await shelf('Radar');
    expect(document.querySelector('[data-radar-reach]')).toBeNull();
  });

  it('says that a slow fleet is seen for longer, because that is the decision', async () => {
    show({ telescope: 1, watching: 0, worlds: 20, radar: 5 });
    await shelf('Radar');
    expect(screen.getByText(/slow, heavy fleet remains inside Radar reach longer/i)).toBeInTheDocument();
  });
});

describe('report tabs', () => {
  it('defaults to probe reports and exposes one active panel', async () => {
    show({ telescope: 1, watching: 0, worlds: 20 });
    await shelf('Reports');
    expect(screen.getByRole('tablist', { name: 'Intel reports' })).toBeVisible();
    expect(screen.getByRole('tab', { name: 'Probe reports' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tabpanel', { name: 'Probe reports' })).toBeVisible();
    expect(screen.queryByRole('tabpanel', { name: 'Battle reports' })).not.toBeInTheDocument();
  });

  it('opens battle reports with one tap and hides the probe panel', async () => {
    show({ telescope: 1, watching: 0, worlds: 20 });
    await shelf('Reports');
    await userEvent.click(screen.getByRole('tab', { name: 'Battle reports' }));
    expect(screen.getByRole('tab', { name: 'Battle reports' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tabpanel', { name: 'Battle reports' })).toBeVisible();
    expect(screen.queryByRole('tabpanel', { name: 'Probe reports' })).not.toBeInTheDocument();
    expect(screen.getByText(/nothing has been fought over yet/i)).toBeVisible();
  });

  it('moves selection and focus with arrow keys', async () => {
    show({ telescope: 1, watching: 0, worlds: 20 });
    await shelf('Reports');
    const probes = screen.getByRole('tab', { name: 'Probe reports' });
    probes.focus();
    await userEvent.keyboard('{ArrowRight}');
    expect(screen.getByRole('tab', { name: 'Battle reports' })).toHaveFocus();
    expect(screen.getByRole('tabpanel', { name: 'Battle reports' })).toBeVisible();
    await userEvent.keyboard('{Home}');
    expect(probes).toHaveFocus();
  });

  it('wraps both arrow directions at the ends of the tablist', async () => {
    show({ telescope: 1, watching: 0, worlds: 20 });
    await shelf('Reports');
    const probes = screen.getByRole('tab', { name: 'Probe reports' });
    const battles = screen.getByRole('tab', { name: 'Battle reports' });
    probes.focus();
    await userEvent.keyboard('{ArrowLeft}');
    expect(battles).toHaveFocus();
    await userEvent.keyboard('{ArrowRight}');
    expect(probes).toHaveFocus();
  });

  it('uses Turkish tab names without case-folding dotted İ', async () => {
    const i18n = (await import('../src/i18n/index.js')).default;
    await i18n.changeLanguage('tr');
    try {
      show({ telescope: 1, watching: 0, worlds: 20 });
      expect(screen.getByRole('tab', { name: 'Gözlem' })).toBeVisible();
      await userEvent.click(screen.getByRole('tab', { name: 'Raporlar' }));
      expect(screen.getByRole('tablist', { name: 'İstihbarat raporları' })).toBeVisible();
      expect(screen.getByRole('tab', { name: 'Sonda raporları' })).toBeVisible();
      expect(screen.getByRole('tab', { name: 'Savaş raporları' })).toBeVisible();
    } finally {
      await i18n.changeLanguage('en');
    }
  });
});

describe('landing on the shelf that was asked for', () => {
  it('opens on the watch shelf when nobody has asked for anything', () => {
    show({ telescope: 1, watching: 0, worlds: 20 });
    expect(screen.getByRole('tabpanel', { name: 'Watch' })).toBeVisible();
  });

  it('opens on the battle reports when the caller named them', () => {
    show({ telescope: 1, watching: 0, worlds: 20, open: { stop: 'battles', request: 1 } });
    expect(screen.getByRole('tab', { name: 'Reports' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tabpanel', { name: 'Battle reports' })).toBeVisible();
    expect(screen.queryByRole('tabpanel', { name: 'Probe reports' })).not.toBeInTheDocument();
  });

  /**
   * THE CASE THE COUNTER EXISTS FOR. A reader lands on battles, moves elsewhere,
   * and a second battle notification arrives. The requested tab has not changed,
   * so only the bumped counter can bring them back.
   */
  it('lands a second request after the reader has moved away', async () => {
    const { wrapper: Wrapper, queries } = harness();
    queries.setQueryData(['galaxy'], galaxy(20));
    queries.setQueryData(['intel'], intel(0));
    queries.setQueryData(['planet'], planet(1, 0));
    queries.setQueryData(['reports'], { reports: [] });
    const view = render(
      <Wrapper>
        <IntelScreen open={{ stop: 'battles', request: 1 }} />
      </Wrapper>,
    );
    expect(screen.getByRole('tabpanel', { name: 'Battle reports' })).toBeVisible();

    await userEvent.click(screen.getByRole('tab', { name: 'Watch' }));
    expect(screen.getByRole('tabpanel', { name: 'Watch' })).toBeVisible();

    view.rerender(
      <Wrapper>
        <IntelScreen open={{ stop: 'battles', request: 2 }} />
      </Wrapper>,
    );
    expect(screen.getByRole('tabpanel', { name: 'Battle reports' })).toBeVisible();
  });

  /** And a re-render that asks for nothing new must not drag the reader back. */
  it('leaves the reader alone when nothing new has been requested', async () => {
    const { wrapper: Wrapper, queries } = harness();
    queries.setQueryData(['galaxy'], galaxy(20));
    queries.setQueryData(['intel'], intel(0));
    queries.setQueryData(['planet'], planet(1, 0));
    queries.setQueryData(['reports'], { reports: [] });
    const view = render(
      <Wrapper>
        <IntelScreen open={{ stop: 'battles', request: 1 }} />
      </Wrapper>,
    );
    await userEvent.click(screen.getByRole('tab', { name: 'Probe reports' }));

    view.rerender(
      <Wrapper>
        <IntelScreen open={{ stop: 'battles', request: 1 }} />
      </Wrapper>,
    );
    expect(screen.getByRole('tabpanel', { name: 'Probe reports' })).toBeVisible();
  });
});

/**
 * THE DOUBT IS THE PRODUCT, SO THE DOUBT IS THE PICTURE. D127, D142 — each reading is
 * the span it is, so a clean probe of a world with its fleet at home is three narrow
 * blocks and a poor one smears across the card.
 */
describe('what a probe brought back', () => {
  const bandWidth = (index: number): number => Number.parseFloat(
    document.querySelectorAll<HTMLElement>('[data-part="band"]')[index]!.style.width,
  );

  it('draws a vague reading wider than a sharp one', async () => {
    show({ telescope: 1, watching: 0, worlds: 20, probes: [report(200, 2000)] });
    await shelf('Reports');
    const vague = bandWidth(0);
    cleanup();

    show({ telescope: 1, watching: 0, worlds: 20, probes: [report(1800, 2000)] });
    await shelf('Reports');
    expect(bandWidth(0)).toBeLessThan(vague);
  });

  it('draws one band per thing the probe read', async () => {
    show({ telescope: 1, watching: 0, worlds: 20, probes: [report(100, 400)] });
    await shelf('Reports');
    expect(document.querySelectorAll('[data-range-band]')).toHaveLength(3);
  });

  it('still carries both ends as digits, under the shape', async () => {
    show({ telescope: 1, watching: 0, worlds: 20, probes: [report(1200, 3400)] });
    await shelf('Reports');
    expect(screen.getAllByText(/1\.2k/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/3\.4k/).length).toBeGreaterThan(0);
  });

  /**
   * Owner, round 2: no grey bars — and teal is YOU (K2), so their reading wears the colour
   * of a world that is not yours: sharp with the fleet home, lighter with it out.
   */
  it('draws their reading in their colour, sharper when the fleet was home', async () => {
    show({ telescope: 1, watching: 0, worlds: 20, probes: [report(100, 400), report(100, 400, { targetPlanetId: 'q5', fleetHome: false })] });
    await shelf('Reports');
    const bands = [...document.querySelectorAll<HTMLElement>('[data-part="band"]')];
    expect(bands[0]).toHaveClass('bg-v2-neutral');
    expect(bands[3]).not.toHaveClass('bg-v2-neutral');
    for (const band of bands) expect(band.className).not.toMatch(/self|bone|grey|gray|white/);
  });

  /**
   * Owner, 2026-09-24: "neye göre sağa, neye göre ortada, neye göre sola yaslanıyor
   * anlaşılmıyor." Each row is a line from zero with YOUR world's same measure on it, in
   * your colour, so the band's place reads as smaller or bigger than yours.
   */
  it('marks your own world on every row, in your colour, and says so', async () => {
    show({ telescope: 1, watching: 0, worlds: 20, probes: [report(100, 400)] });
    await shelf('Reports');
    const marks = [...document.querySelectorAll<HTMLElement>('[data-range-band] [data-you]')];
    expect(marks).toHaveLength(3);
    for (const mark of marks) expect(mark).toHaveClass('bg-v2-self');
    expect(screen.getByRole('img', { name: 'Ships: somewhere between 100 and 400 · yours 10' })).toBeInTheDocument();
    expect(screen.getByText(/the teal line is your world/)).toBeVisible();
  });

  it('puts a reading bigger than yours to the right of your mark', async () => {
    show({ telescope: 1, watching: 0, worlds: 20, probes: [report(100, 400)] });
    await shelf('Reports');
    const ships = [...document.querySelectorAll<HTMLElement>('[data-range-band]')][2]!;
    const you = Number.parseFloat(ships.querySelector<HTMLElement>('[data-you]')!.style.left);
    const start = Number.parseFloat(ships.querySelector<HTMLElement>('[data-part="band"]')!.style.left);
    expect(start).toBeGreaterThan(you);
  });

  it('shows the accuracy as signal strength and says the figure out loud', async () => {
    show({ telescope: 1, watching: 0, worlds: 20, probes: [report(100, 400)] });
    await shelf('Reports');
    expect(screen.getByRole('img', { name: /80%.*accuracy/i })).toBeInTheDocument();
    expect(screen.getByText('80% accuracy · fleet was home')).toBeVisible();
    expect(screen.getByText(/These numbers are estimated ranges/)).toBeVisible();
  });

  it('states a lower accuracy and the fleet-away qualification in visible words', async () => {
    show({ telescope: 1, watching: 0, worlds: 20, probes: [report(100, 400, { accuracy: 0.55, fleetHome: false })] });
    await shelf('Reports');
    expect(screen.getByText('55% accuracy · fleet was out')).toBeVisible();
  });

  it('says when the target caught the probe', async () => {
    show({ telescope: 1, watching: 0, worlds: 20, probes: [report(100, 400, { detected: true })] });
    await shelf('Reports');
    expect(screen.getByText(/they caught it/i)).toBeInTheDocument();
  });

  it('opens the dossier of the world it read', async () => {
    const onOpenDossier = vi.fn();
    show({ telescope: 1, watching: 0, worlds: 20, probes: [report(100, 400)], onOpenDossier });
    await shelf('Reports');
    await userEvent.click(screen.getByRole('button', { name: /open dossier/i }));
    expect(onOpenDossier).toHaveBeenCalledWith('q0');
  });
});
