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
  coreLevel: 6,
  intel: 'RESOLVED' as const,
  state: { kind: 'NORMAL' as const },
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
  deuteriumStock: null,
  defence: { low: 400, high: 700 },
  fleetSize: { low: 8, high: 14 },
});

const intelWith = (reports: IntelView['probeReports'] = []): IntelView => ({
  watching: [],
  probeReports: reports,
  probeCooldowns: [],
  radarLog: [],
  probeCost: { alloy: 50, crystal: 50, deuterium: 0 },
});

const fought = (minutesAgo: number): BattleReport => ({
  id: 'b1',
  at: new Date(NOW - minutesAgo * 60_000),
  grade: 'PARTIAL',
  rounds: [],
  attacking: true,
  opponentName: 'Sable',
  opponentPlanet: 'Grimhold',
  opponentPlanetId: 'p2',
  neutral: false,
  yourPlanet: 'Vantage-3',
  yourLosses: {},
  theirLosses: { WASP: 4 },
  yourFleet: { WASP: 10 },
  lootAlloy: 100,
  lootCrystal: 0,
  lootDeuterium: 0,
  dominion: 400,
  shieldAbsorbed: 0,
  cargoLimited: false,
  defenceSalvage: {},
  disruptedMinutes: 0,
  wreckValue: 0,
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
 * WHETHER YOU ARE ALLOWED TO FIGHT THEM — AND SINCE D127, DEVELOPMENT DOES NOT
 * DECIDE.
 *
 * These used to hold D49's ±2 tier band: the dossier pre-checked it because tier
 * was public and the panel could say WHY a launch was unavailable. D127 made
 * development private and retired the band with it, so there is nothing here to
 * pre-check and no reason to explain. What is left is that the figure still
 * appears as a fact when it has been earned, with no permission attached.
 */
describe('what development still says, now that it decides nothing', () => {
  it('reports the tier as a plain fact, with no band note attached', () => {
    const read = dossier({
      target: target({ coreTier: 4 }),
      planet: mine,
      intel: intelWith(),
      reports: [],
      now: NOW,
    });
    const development = read.facts.find((f) => f.key === 'development');
    expect(development).toBeDefined();
    expect(development?.note).toBeUndefined();
  });

  /** However far apart, the dossier no longer has an opinion about permission. */
  it('says the same thing about a world far above and far below', () => {
    for (const tier of [1, 5, 9]) {
      const read = dossier({
        target: target({ coreTier: tier }),
        planet: mine,
        intel: intelWith(),
        reports: [],
        now: NOW,
      });
      expect(read.facts.find((f) => f.key === 'development')?.note).toBeUndefined();
    }
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

  it('matches battle knowledge by planet id, never by a duplicated or changed name', () => {
    const renamed = target({ id: 'different-id', name: 'Grimhold' });
    const result = read({ target: renamed, reports: [fought(30)] });
    expect(result.facts.some((fact) => fact.key === 'composition')).toBe(false);
    expect(result.gaps.some((gap) => gap.key === 'composition')).toBe(true);
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

/**
 * WHAT THE DOSSIER MAY CLAIM ABOUT A WORLD YOU CANNOT SEE. D127.
 *
 * The provenance machinery — `source` and `ageMinutes` on every line — is the
 * whole reason this file exists: "defence 1,400" invites a player to bet a fleet
 * without asking when it was measured or by what. D127 moved owner, development
 * and orbital hardware behind the fog and this block was left alone, so all three
 * went on being pushed as `public` with a null age in both of the new states.
 *
 *   · UNKNOWN. The payload OMITS these fields and the schema fills the hole with
 *     defaults, so the panel printed `Tier 1` and an empty commander and stamped
 *     them free, live and trustworthy. A Core 18 fortress read as a Tier 1 rock.
 *     That is not a fog leak — it is the opposite, and worse: the map asserting
 *     something false on the surface a player uses to pick a target.
 *   · REMEMBERED. Real facts, but a RECORD. Printing a probe's hours-old reading
 *     with no age is the same lie in a quieter register.
 */
describe('what the dossier claims about a world outside your reach', () => {
  const unknown = () =>
    dossier({
      // Exactly what `planetNodes` sees for an unknown world: the schema's
      // defaults, because the server sends none of these fields at all.
      target: target({ intel: 'UNKNOWN', name: '', owner: '', coreTier: 1, coreLevel: 0 }),
      planet: mine,
      intel: intelWith(),
      reports: [],
      now: NOW,
    });

  it('states nothing at all about an unsurveyed world', () => {
    const read = unknown();
    for (const key of ['owner', 'development', 'hardware']) {
      expect(read.facts.find((f) => f.key === key), key).toBeUndefined();
    }
  });

  /** Never `Tier 1`, which is the schema's default and not a reading. */
  it('never prints a development figure it was not sent', () => {
    expect(JSON.stringify(unknown().facts)).not.toContain('Tier 1');
  });

  /** The absence is a purchase, so it is offered as one. */
  it('turns the absence into a gap a probe closes', () => {
    const gap = unknown().gaps.find((g) => g.key === 'surface');
    expect(gap).toBeDefined();
    expect(gap?.closes).toBe('probe');
  });

  /**
   * A REMEMBERED WORLD'S SURFACE IS A PROBE READING WITH AN AGE ON IT, and the age
   * is the load-bearing half: the target may have built two Core levels and three
   * satellites since, and the record goes on saying what it said.
   */
  it('dates the facts a probe brought back rather than calling them live', () => {
    const seenAt = new Date(NOW - 180 * 60_000);
    const read = dossier({
      target: target({ intel: 'REMEMBERED', seenAt, satellites: ['FOUNDRY'] }),
      planet: mine,
      intel: intelWith(),
      reports: [],
      now: NOW,
    });

    for (const key of ['owner', 'development', 'hardware']) {
      const fact = read.facts.find((f) => f.key === key);
      expect(fact, key).toBeDefined();
      expect(fact?.source, key).toBe('probe');
      expect(fact?.ageMinutes, key).toBeCloseTo(180, 5);
    }
  });

  /**
   * NO CONFIDENCE FIGURE ON A SILHOUETTE. A probe fuzzes stock and defence into
   * bands; the outside of a world is simply seen. Attaching an accuracy would
   * invent a doubt the payload does not have.
   */
  it('claims no accuracy for what the probe simply saw', () => {
    const read = dossier({
      target: target({ intel: 'REMEMBERED', seenAt: new Date(NOW - 60_000) }),
      planet: mine,
      intel: intelWith(),
      reports: [],
      now: NOW,
    });
    expect(read.facts.find((f) => f.key === 'development')?.accuracy).toBeUndefined();
  });

  /** A world you can actually see is untouched: free, live, and no age. */
  it('leaves a resolved world exactly as it was', () => {
    const read = dossier({
      target: target({ satellites: ['FOUNDRY'] }),
      planet: mine,
      intel: intelWith(),
      reports: [],
      now: NOW,
    });
    for (const key of ['owner', 'development', 'hardware']) {
      const fact = read.facts.find((f) => f.key === key);
      expect(fact?.source, key).toBe('public');
      expect(fact?.ageMinutes, key).toBeNull();
    }
    expect(read.gaps.find((g) => g.key === 'surface')).toBeUndefined();
  });
});
