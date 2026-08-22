import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { dossier, headline } from '../src/lib/dossier.js';
import { ActionButton } from '../src/ui/Action.js';
import type {
  BattleReport,
  GalaxyPlanet,
  IntelView,
  PlanetView,
} from '../src/api/schemas.js';
import { planetView } from './fixtures.js';

/**
 * WHAT THE INTERFACE IS ALLOWED TO CLAIM ABOUT WHAT YOU KNOW.
 *
 * Two separate bugs, both of the same kind: a surface stating something the player
 * can see is false, on the screens they use to decide where to send a fleet.
 *
 *   · The focus rail said "Never looked" for any world with no live telescope
 *     reading — including one probed an hour ago and one fought last night.
 *   · The action button printed the SHORTFALL beside a resource icon, which is how
 *     every price in the game is drawn, so "50 alloy short" read as "costs 50".
 */

const NOW = new Date('2026-04-01T12:00:00.000Z').getTime();

const target = (over: Partial<GalaxyPlanet> = {}): GalaxyPlanet => ({
  id: 'p2',
  name: 'Grimhold',
  owner: 'Sable',
  position: { x: 200, y: 0, z: 0 },
  coreTier: 2,
  satellites: [],
  shielded: false,
  isSelf: false,
  ...over,
});

const mine: PlanetView = planetView(
  { buildings: { CORE: 4, REFINERY: 2, EXTRACTOR: 2, VAULT: 1, SHIPYARD: 1 } },
  {
    alloy: 1000,
    crystal: 200,
    alloyCap: 5000,
    crystalCap: 1000,
    alloyPerHour: 200,
    crystalPerHour: 60,
  },
);

const probeReport = (minutesAgo: number): NonNullable<IntelView>['probeReports'][number] => ({
  targetPlanetId: 'p2',
  targetName: 'Grimhold',
  targetUsername: 'İzci',
  at: new Date(NOW - minutesAgo * 60_000),
  accuracy: 0.7,
  detected: false,
  fleetHome: true,
  stock: { low: 1000, high: 1600 },
  defence: { low: 400, high: 700 },
  fleetSize: { low: 8, high: 14 },
});

const intelWith = (reports: IntelView['probeReports'] = []): IntelView => ({
  watching: [],
  probeReports: reports,
  radarLog: [],
  probeCost: { alloy: 50, crystal: 50 },
});

const fought = (minutesAgo: number): BattleReport => ({
  id: 'b1',
  at: new Date(NOW - minutesAgo * 60_000),
  grade: 'PARTIAL',
  rounds: [],
  attacking: true,
  opponentName: 'Sable',
  opponentPlanet: 'Grimhold',
  yourLosses: {},
  theirLosses: { WASP: 4 },
  lootAlloy: 100,
  lootCrystal: 0,
  dominion: 400,
});

const read = (over: {
  target?: GalaxyPlanet;
  intel?: IntelView;
  reports?: BattleReport[];
}) =>
  dossier({
    target: over.target ?? target(),
    planet: mine,
    intel: over.intel ?? intelWith(),
    reports: over.reports ?? [],
    now: NOW,
  });

/**
 * THE ONE RULE A PLAYER CAN READ OFF THE MAP. D49.
 *
 * Whether a launch will be accepted is decided by development tier, and tier is
 * public on every world for free. That is the whole reason the band replaced a
 * Wealth ratio, and it is only worth anything if the dossier actually says so —
 * otherwise it is the same invisible rule with a different formula behind it.
 */
describe('whether you are allowed to fight them', () => {
  // The fixture's own Core is 4, which is tier 2. Reach is tier 1 to 4.
  it('says a world inside the band is inside it, and names your own tier', () => {
    const read = dossier({
      target: target({ coreTier: 4 }),
      planet: mine,
      intel: intelWith(),
      reports: [],
      now: NOW,
    });
    expect(read.inBand).toBe(true);
    expect(read.band).toEqual({ low: 1, high: 4 });
    expect(read.facts.find((f) => f.key === 'development')?.note).toContain('Tier 2');
  });

  it('refuses the step past the band and says which tiers are reachable', () => {
    const read = dossier({
      target: target({ coreTier: 5 }),
      planet: mine,
      intel: intelWith(),
      reports: [],
      now: NOW,
    });
    expect(read.inBand).toBe(false);
    expect(read.facts.find((f) => f.key === 'development')?.note).toContain('Tier 1 to 4');
  });

  /** Symmetric: a world far below is as unreachable as one far above. */
  it('is out of band downward as well as upward', () => {
    const big = planetView(
      { buildings: { CORE: 16, REFINERY: 2, EXTRACTOR: 2, VAULT: 1, SHIPYARD: 1 } },
      { alloy: 1000, crystal: 200, alloyCap: 5000, crystalCap: 1000, alloyPerHour: 200, crystalPerHour: 60 },
    );
    const read = dossier({
      target: target({ coreTier: 1 }),
      planet: big,
      intel: intelWith(),
      reports: [],
      now: NOW,
    });
    expect(read.inBand).toBe(false);
    expect(read.band).toEqual({ low: 4, high: 8 });
  });

  /**
   * The band is stated even when everything else about the world is unknown.
   * It is public, and it is the first thing that decides whether the rest matters.
   */
  it('states it on a world nothing has ever looked at', () => {
    const read = dossier({
      target: target({ coreTier: 9 }),
      planet: mine,
      intel: intelWith(),
      reports: [],
      now: NOW,
    });
    expect(headline(read, target({ coreTier: 9 }))).toEqual({ kind: 'none' });
    expect(read.facts.find((f) => f.key === 'development')?.note).toContain('Out of reach');
  });
});

describe('the headline on a world you have selected', () => {
  it('leads with the fleet reading when a telescope is on it', () => {
    const away = target({ fleet: { status: 'AWAY', clarity: 'CLEAR', staleMinutes: 2, etaMinutes: 30 } });
    expect(headline(read({ target: away }), away)).toEqual({ kind: 'fleet-away' });

    const home = target({ fleet: { status: 'HOME', clarity: 'FULL', staleMinutes: 0, etaMinutes: null } });
    expect(headline(read({ target: home }), home)).toEqual({ kind: 'fleet-home' });
  });

  /**
   * UNKNOWN is a reading, not an absence: you looked and their Veil beat your
   * Telescope. Collapsing it into "no intel" would tell a player they had never
   * checked when in fact they had, and paid for it.
   */
  it('calls a veiled reading veiled rather than nothing', () => {
    const veiled = target({
      fleet: { status: 'UNKNOWN', clarity: 'BLIND', staleMinutes: 0, etaMinutes: null },
    });
    expect(headline(read({ target: veiled }), veiled)).toEqual({ kind: 'veiled' });
  });

  /**
   * THE BUG THIS WAS WRITTEN FOR. A probed world with no live telescope slot on it
   * used to read "Never looked", which is exactly backwards: a probe is the most
   * deliberate looking in the game and it costs a round trip.
   */
  it('never claims nothing has looked at a world that has been probed', () => {
    const t = target();
    const known = headline(read({ target: t, intel: intelWith([probeReport(45)]) }), t);
    expect(known.kind).toBe('probed');
    if (known.kind !== 'probed') throw new Error('expected probed');
    expect(known.ageMinutes).toBeCloseTo(45, 5);
  });

  /** A battle report is the most accurate intel in the game. It counts too. */
  it('falls back to a fight when there is no probe', () => {
    const t = target();
    const known = headline(read({ target: t, reports: [fought(600)] }), t);
    expect(known.kind).toBe('fought');
  });

  it('prefers the more precise source when both exist', () => {
    const t = target();
    const known = headline(
      read({ target: t, intel: intelWith([probeReport(20)]), reports: [fought(600)] }),
      t,
    );
    expect(known.kind).toBe('probed');
  });

  /** And says so plainly when it really is true. */
  it('reports genuine ignorance as ignorance', () => {
    const t = target();
    expect(headline(read({ target: t }), t)).toEqual({ kind: 'none' });
  });
});

describe('the action button when you cannot afford it', () => {
  const short = () =>
    render(
      <ActionButton
        verb="raise"
        cost={{ alloy: 900, crystal: 300 }}
        held={{ alloy: 850, crystal: 300 }}
        onAct={vi.fn()}
      />,
    );

  /**
   * THE FIGURE ON THIS BUTTON IS A DEFICIT, AND EVERY OTHER PLACE those two marks
   * appear together they mean a price. Without a word saying which, a player fifty
   * alloy short reads "50 alloy" and concludes the upgrade is cheap and the button
   * is broken. Owner's note, and it is the whole reason this state was redesigned.
   */
  it('says the number is a shortfall rather than a price', () => {
    short();
    expect(screen.getByText(/short/i)).toBeInTheDocument();
  });

  it('signs the figure, so it reads as a deficit even at a glance', () => {
    short();
    expect(screen.getByRole('button').textContent).toContain('−');
  });

  it('spells the whole thing out for anyone who cannot see the icons', () => {
    short();
    expect(screen.getByRole('button')).toHaveAccessibleName(/short — needs 50 more alloy/i);
  });

  it('names only the resource that is actually short', () => {
    short();
    // Crystal is covered exactly, so it must not appear in the deficit at all.
    expect(screen.getByRole('button')).toHaveAccessibleName(/^(?!.*crystal).*$/i);
  });

  it('is not pressable, because there is nothing it could do', () => {
    short();
    expect(screen.getByRole('button')).toBeDisabled();
  });

  /** And the affordable state still says what it does, in a verb. */
  it('reads as the act itself once it can be afforded', () => {
    render(
      <ActionButton
        verb="raise"
        cost={{ alloy: 100, crystal: 0 }}
        held={{ alloy: 900, crystal: 0 }}
        onAct={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: /raise/i })).toBeEnabled();
    expect(screen.queryByText(/short/i)).not.toBeInTheDocument();
  });
});
