import type { ReactNode } from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import { radarContactRange, radarRange, telescopeSlots } from '@astera/rules';
import { Api } from '../src/api/client.js';
import { ApiProvider } from '../src/api/context.js';
import { IntelScreen } from '../src/screens/IntelScreen.js';

/**
 * COVERAGE MEASURES YOUR EYES, NOT THE GALAXY. Owner-reported bug.
 *
 * The panel that leads the intel centre used to read "Watching 2 of 47" against
 * every other world in the galaxy, and drew a forty-seven-cell bar with two cells
 * lit. That is a progress bar toward a goal the game does not have and could not
 * offer: a Telescope tops out at three slots (D18, capped by D36), so the number
 * on the right was unreachable by a factor of fifteen and the bar could never
 * pass 6%. It told the player they were failing at something nobody had asked
 * them to do — on the screen the whole product is supposed to live on.
 *
 * The denominator is now the slot count. The size of the galaxy still appears,
 * but where it belongs: as the REASON a slot is a decision, not as a target.
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

const intel = (
  watching: number,
  probeReports: unknown[] = [],
  /** Which world's sockets these are. A slot number belongs to a world, not a commander. */
  observerPlanetId = 'p1',
  extra: unknown[] = [],
) => ({
  watching: [...Array.from({ length: watching }, (_, slot) => ({
    observerPlanetId,
    slot,
    targetPlanetId: `q${String(slot)}`,
    targetName: `World ${String(slot)}`,
    ownerName: 'Someone',
    assignedAt: new Date().toISOString(),
    reading: { status: 'HOME', staleMinutes: 0, etaMinutes: null, state: 'CLEAR', clarity: 1 },
  })), ...extra],
  probeReports,
  probeCooldowns: [],
  radarLog: [],
  probeCost: { alloy: 50, crystal: 50 },
});

const planet = (telescope: number, radar: number) => ({
  planet: {
    id: 'p1',
    name: 'Home',
    position: { x: 0, y: 0, z: 0 },
    alloy: 500, crystal: 120, alloyCap: 5000, crystalCap: 1000,
    bufferAlloy: 0, bufferCrystal: 0, bufferAlloyCap: 100, bufferCrystalCap: 100,
    alloyPerHour: 100, crystalPerHour: 30,
    shield: 0, shieldCap: 0, disruptedUntil: null,
    dominion: 0, wealth: 0,
  },
  buildings: { CORE: 4, REFINERY: 2, EXTRACTOR: 2, VAULT: 1, SHIPYARD: 1 },
  instruments: { TELESCOPE: telescope, RADAR: radar, AEGIS: 0, VEIL: 0 },
  orbit: [],
  fleet: {},
  ground: {},
  flight: { used: 0, total: 3 },
  fleetAway: {},
});

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
}) => {
  const { wrapper: Wrapper, queries } = harness();
  queries.setQueryData(['galaxy'], galaxy(opts.worlds));
  queries.setQueryData(
    ['intel'],
    intel(opts.watching, opts.probes ?? [], 'p1', opts.elsewhere ?? []),
  );
  queries.setQueryData(['planet'], planet(opts.telescope, opts.radar ?? 0));
  queries.setQueryData(['reports'], { reports: [] });
  render(
    <Wrapper>
      <IntelScreen
        {...(opts.onOpenOrbit ? { onOpenOrbit: opts.onOpenOrbit } : {})}
        {...(opts.open ? { open: opts.open } : {})}
      />
    </Wrapper>,
  );
};

describe('the coverage panel', () => {
  it('shows every Telescope slot with its number, target, and empty state', () => {
    show({ telescope: 5, watching: 1, worlds: 47 });
    expect(screen.getByText('Slot 1')).toBeInTheDocument();
    expect(screen.getByText('Slot 2')).toBeInTheDocument();
    expect(screen.getByText('Slot 3')).toBeInTheDocument();
    expect(screen.getByText('World 0')).toBeInTheDocument();
    expect(screen.getAllByText('Idle')).toHaveLength(2);
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
    expect(document.querySelector('[data-instrument-diagram="radar"]')).not.toBeNull();
    await userEvent.click(screen.getAllByRole('button', { name: 'Open Orbit' })[0]!);
    expect(onOpenOrbit).toHaveBeenCalledOnce();
  });

  /**
   * The upsell is offered only where the next level genuinely buys a slot. D18
   * gives slots at L1, L3 and L5, so at L1 the next level buys nothing here and
   * saying otherwise would be the "unchanged before-and-after" D36 forbids.
   */
  it('offers the next slot only on the level that actually adds one', () => {
    show({ telescope: 1, watching: 1, worlds: 47 });
    expect(screen.queryByText(/would watch one more/i)).not.toBeInTheDocument();

    show({ telescope: 2, watching: 1, worlds: 47 });
    expect(screen.getByText(/telescope l3 would watch one more/i)).toBeInTheDocument();
  });

  /** "One MORE" than none is not a sentence. With no telescope, sell the first. */
  it('does not offer one more slot to a player who has none', () => {
    show({ telescope: 0, watching: 0, worlds: 47 });
    expect(screen.queryByText(/would watch one more/i)).not.toBeInTheDocument();
  });

  it('still says what having no radar costs', () => {
    show({ telescope: 3, watching: 2, worlds: 47, radar: 0 });
    expect(screen.getByText(/with no radar/i)).toBeInTheDocument();
  });
});

/**
 * WHAT THE RADAR SELLS, IN THE UNIT IT IS ACTUALLY SOLD IN. D49.
 *
 * The note under "Who is looking at you" used to promise a fixed number of
 * minutes, and that figure was never a property of the radar: the same twelve
 * minutes caught a Wasp fleet 460 units out and a Bulwark fleet 210. A reach is
 * the thing the defender owns; the warning it buys is what the ATTACKER decides,
 * by choosing what to fly.
 */
/**
 * TWO SCOPES ON ONE SCREEN. D97/D134.
 *
 * A telescope SLOT belongs to a world — the numbering restarts on each one — while
 * the watch list is the commander's. This screen read one for the denominator and
 * the other for the numerator, and the results were all wrong in different ways: a
 * colony's slot 0 collided with the capital's and hid one of the two watches, the
 * tally printed "3 of 1", and coverage then called that full.
 */
describe('slots belong to a world, watches to a commander', () => {
  const colonyWatch = {
    observerPlanetId: 'colony',
    slot: 0,
    targetPlanetId: 'far',
    targetName: 'Elsewhere',
    ownerName: 'Somebody',
    reading: { status: 'HOME', staleMinutes: 0, etaMinutes: null, state: 'CLEAR', clarity: 1 },
  };

  it('does not let another world’s slot 0 hide this world’s', () => {
    show({ telescope: 1, watching: 1, worlds: 20, elsewhere: [colonyWatch] });
    // The active world's own watch is the one on the rack.
    expect(screen.getByText('World 0')).toBeInTheDocument();
    expect(screen.queryByText('Elsewhere')).not.toBeInTheDocument();
  });

  /**
   * The tally used to read "2 of 2" here — one watch from this world plus one from
   * a colony, against this world's two sockets — and coverage then called it full.
   */
  it('counts only this world’s watches against this world’s sockets', () => {
    show({ telescope: 3, watching: 1, worlds: 20, elsewhere: [colonyWatch] });
    expect(telescopeSlots(3)).toBe(2);
    expect(screen.getByText(/watching 1 of your 2 slots/i)).toBeInTheDocument();
    expect(screen.queryByText(/every slot you have is watching/i)).not.toBeInTheDocument();
  });

  it('still shows an idle socket here when another world has spent its own', () => {
    show({ telescope: 3, watching: 0, worlds: 20, elsewhere: [colonyWatch] });
    expect(telescopeSlots(3)).toBe(2);
    expect(screen.getAllByText('Idle')).toHaveLength(2);
  });
});

describe('what the radar promises', () => {
  /**
   * THE REACH IS DRAWN, AND THE FIGURE CAME WITH IT. D142.
   *
   * The sentence that carried the raw units is a circle at its true fraction of
   * the disc, which is the only form in which those numbers say anything about a
   * commander's own neighbourhood. The reading survives in full as the diagram's
   * accessible name — the assertion moved from the prose to the picture.
   *
   * IT READS THE TABLES RATHER THAN NAMING FIGURES, so the day the two circles are
   * split again this keeps testing the same thing.
   */
  it('states the radar reach and never invents a countdown', () => {
    show({ telescope: 1, watching: 0, worlds: 20, radar: 5 });
    const reach = screen.getByRole('img', {
      name: new RegExp(String(radarContactRange(5)), 'i'),
    });
    expect(reach).toBeInTheDocument();
    expect(screen.queryByText(/minutes before a fleet lands/i)).not.toBeInTheDocument();
  });

  /**
   * ONE CIRCLE WHILE THE TWO ARE MERGED, TWO WHEN THEY ARE NOT.
   *
   * Drawing two identical rings with two captions describing different things
   * would be the interface inventing a distinction the rules no longer make. The
   * surface reads the figures, so it is already correct on the day they split.
   */
  it('draws one ring while the two radar circles are one number', () => {
    show({ telescope: 1, watching: 0, worlds: 20, radar: 5 });
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

  /**
   * EVERY RUNG THAT DRAWS A CIRCLE SHOWS ITS CIRCLE.
   *
   * L1 and L2 used to reach nothing and the screen said so in a sentence. They
   * reach now — the zeroes were inherited from the pre-D49 minutes ladder — so
   * what the screen owes them is the same picture, at their own smaller radius.
   */
  it('draws the reach at the first rung too, at its own size', () => {
    show({ telescope: 1, watching: 0, worlds: 20, radar: 1 });
    const small = document.querySelector<HTMLElement>('[data-ring="warn"]');
    expect(small).not.toBeNull();
    const atOne = Number.parseFloat(small!.style.width);

    cleanup();
    show({ telescope: 1, watching: 0, worlds: 20, radar: 5 });
    const large = document.querySelector<HTMLElement>('[data-ring="warn"]');
    expect(Number.parseFloat(large!.style.width))
      .toBeGreaterThan(atOne);
  });

  /** With no radar at all there is no circle to draw and nothing to promise. */
  it('draws nothing at all with no radar', () => {
    show({ telescope: 1, watching: 0, worlds: 20, radar: 0 });
    expect(document.querySelector('[data-radar-reach]')).toBeNull();
  });

  /**
   * THE HALF THE PICTURE CANNOT CARRY STAYS AS A SENTENCE. The rings are fixed;
   * how long a fleet sits inside them is the attacker's choice, and no circle
   * can draw that.
   */
  it('says that a slow fleet is seen for longer, because that is the decision', () => {
    show({ telescope: 1, watching: 0, worlds: 20, radar: 5 });
    expect(screen.getByText(/slow, heavy fleet remains inside Radar reach longer/i)).toBeInTheDocument();
  });

});

describe('report tabs', () => {
  it('defaults to probe reports and exposes one active panel', () => {
    show({ telescope: 1, watching: 0, worlds: 20 });
    expect(screen.getByRole('tablist', { name: 'Intel reports' })).toBeVisible();
    expect(screen.getByRole('tab', { name: 'Probe reports' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tabpanel', { name: 'Probe reports' })).toBeVisible();
    expect(screen.queryByRole('tabpanel', { name: 'Battle reports' })).not.toBeInTheDocument();
  });

  it('opens battle reports with one tap and hides the probe panel', async () => {
    show({ telescope: 1, watching: 0, worlds: 20 });
    await userEvent.click(screen.getByRole('tab', { name: 'Battle reports' }));
    expect(screen.getByRole('tab', { name: 'Battle reports' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tabpanel', { name: 'Battle reports' })).toBeVisible();
    expect(screen.queryByRole('tabpanel', { name: 'Probe reports' })).not.toBeInTheDocument();
    expect(screen.getByText(/nothing has been fought over yet/i)).toBeVisible();
  });

  it('moves selection and focus with arrow keys', async () => {
    show({ telescope: 1, watching: 0, worlds: 20 });
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
    show({ telescope: 1, watching: 0, worlds: 20 });
    expect(screen.getByRole('tablist', { name: 'İstihbarat raporları' })).toBeVisible();
    expect(screen.getByRole('tab', { name: 'Sonda raporları' })).toBeVisible();
    expect(screen.getByRole('tab', { name: 'Savaş raporları' })).toBeVisible();
  });
});

/**
 * A NOTIFICATION POINTS AT A SHELF, NOT JUST A ROOM. D121.
 *
 * The Intel centre holds two lists and every reading-shaped notification opened
 * it on the PROBE list — so "you were raided" landed the reader beside the battle
 * report rather than on it. `Signals` names the shelf now; this is the end of that
 * wire, and the counter is what makes a SECOND notification still land after the
 * reader has moved off the tab the first one opened.
 */
describe('landing on the shelf that was asked for', () => {
  it('opens on the probe list when nobody has asked for anything', () => {
    show({ telescope: 1, watching: 0, worlds: 20 });
    expect(screen.getByRole('tabpanel', { name: 'Probe reports' })).toBeVisible();
  });

  it('opens on the battle reports when the caller named them', () => {
    show({ telescope: 1, watching: 0, worlds: 20, open: { stop: 'battles', request: 1 } });
    expect(screen.getByRole('tabpanel', { name: 'Battle reports' })).toBeVisible();
    expect(screen.queryByRole('tabpanel', { name: 'Probe reports' })).not.toBeInTheDocument();
  });

  /**
   * THE CASE THE COUNTER EXISTS FOR. A reader lands on battles, moves to probes,
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

    await userEvent.click(screen.getByRole('tab', { name: 'Probe reports' }));
    expect(screen.getByRole('tabpanel', { name: 'Probe reports' })).toBeVisible();

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
 * THE DOUBT IS THE PRODUCT, SO THE DOUBT IS THE PICTURE. D127, D142.
 *
 * A probe report is the one number in the game that is deliberately NOT a number:
 * it is a silhouette, fuzzed at the look and stale from the moment it lands. The
 * screen printed it as `1.2k–3.4k` under a grey label — six figures a reader has
 * to pair up, subtract and then weigh, for the fact the entire information layer
 * is sold on.
 *
 * Each reading is now the span it actually is, so a clean probe of a world with
 * its fleet at home is three narrow blocks and a poor one smears across the card.
 * That comparison is the whole product of raising a Telescope, and it was nowhere
 * on screen.
 */
describe('what a probe brought back', () => {
  const bandWidth = (index: number): number => Number.parseFloat(
    document.querySelectorAll<HTMLElement>('[data-part="band"]')[index]!.style.width,
  );

  it('draws a vague reading wider than a sharp one', () => {
    show({ telescope: 1, watching: 0, worlds: 20, probes: [report(200, 2000)] });
    const vague = bandWidth(0);
    cleanup();

    show({ telescope: 1, watching: 0, worlds: 20, probes: [report(1800, 2000)] });
    expect(bandWidth(0)).toBeLessThan(vague);
  });

  it('draws one band per thing the probe read', () => {
    show({ telescope: 1, watching: 0, worlds: 20, probes: [report(100, 400)] });
    expect(document.querySelectorAll('[data-range-band]')).toHaveLength(3);
  });

  it('still carries both ends as digits, under the shape', () => {
    show({ telescope: 1, watching: 0, worlds: 20, probes: [report(1200, 3400)] });
    expect(screen.getAllByText(/1\.2k/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/3\.4k/).length).toBeGreaterThan(0);
  });

  /**
   * HOW GOOD THE READ WAS, IN THE SAME BARS THE TELESCOPE USES. A percentage is a
   * figure about a figure; signal bars are already this game's word for "what is
   * this reading worth". The percentage stays as the accessible name, which is
   * the only form a screen reader can take.
   */
  it('shows the accuracy as signal strength and says the figure out loud', () => {
    show({ telescope: 1, watching: 0, worlds: 20, probes: [report(100, 400)] });
    expect(screen.getByRole('img', { name: /80%.*accuracy/i })).toBeInTheDocument();
  });

  /** Being caught is the cost of looking, and it stays in threat red. */
  it('says when the target caught the probe', () => {
    show({
      telescope: 1, watching: 0, worlds: 20,
      probes: [report(100, 400, { detected: true })],
    });
    expect(screen.getByText(/they caught it/i)).toBeInTheDocument();
  });
});
