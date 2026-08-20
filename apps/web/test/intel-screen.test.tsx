import type { ReactNode } from 'react';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import { radarRange, telescopeSlots } from '@blindspace/rules';
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

const intel = (watching: number) => ({
  watching: Array.from({ length: watching }, (_, slot) => ({
    slot,
    targetPlanetId: `q${String(slot)}`,
    targetName: `World ${String(slot)}`,
    ownerName: 'Someone',
    assignedAt: new Date().toISOString(),
    reading: { status: 'HOME', staleMinutes: 0, etaMinutes: null, state: 'CLEAR', clarity: 1 },
  })),
  probeReports: [],
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

const show = (opts: { telescope: number; radar?: number; watching: number; worlds: number }) => {
  const { wrapper: Wrapper, queries } = harness();
  queries.setQueryData(['galaxy'], galaxy(opts.worlds));
  queries.setQueryData(['intel'], intel(opts.watching));
  queries.setQueryData(['planet'], planet(opts.telescope, opts.radar ?? 0));
  queries.setQueryData(['reports'], { reports: [] });
  render(
    <Wrapper>
      <IntelScreen />
    </Wrapper>,
  );
};

describe('the coverage panel', () => {
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
describe('what the radar promises', () => {
  it('states a reach and never a countdown', () => {
    show({ telescope: 1, watching: 0, worlds: 20, radar: 5 });
    expect(screen.getByText(new RegExp(`${String(radarRange(5))} units out`, 'i'))).toBeInTheDocument();
    expect(screen.queryByText(/minutes before a fleet lands/i)).not.toBeInTheDocument();
  });

  it('says that a slow fleet is seen for longer, because that is the decision', () => {
    show({ telescope: 1, watching: 0, worlds: 20, radar: 5 });
    expect(screen.getByText(/slow, heavy fleet is inside that circle for far longer/i)).toBeInTheDocument();
  });

  /** Below L3 a radar catches probes and nothing else, and must not claim more. */
  it('promises no fleet warning at a level that has none', () => {
    show({ telescope: 1, watching: 0, worlds: 20, radar: 2 });
    expect(screen.getByText(/catches probes\. from l3/i)).toBeInTheDocument();
    expect(screen.queryByText(/units out/i)).not.toBeInTheDocument();
  });
});
