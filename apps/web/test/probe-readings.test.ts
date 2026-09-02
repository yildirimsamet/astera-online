import { describe, expect, it } from 'vitest';
import type { GalaxyPlanet, IntelView, ProbeReport } from '../src/api/schemas.js';
import { dossier } from '../src/lib/dossier.js';
import { planetView } from './fixtures.js';

/**
 * WHAT A PROBE BRINGS HOME, AND WHETHER ANY OF IT REACHES THE PLAYER.
 *
 * Four readings were taken on every probe flight and shown nowhere. Two never
 * left the server — `resolveProbe` wrote them into the report's silhouette and no
 * route ever put them on the wire. Two reached the client, were parsed by the
 * schema, and were read by no surface at all.
 *
 * That is the most expensive class of bug this project can have: a commander pays
 * alloy, a flight bay, a round trip and the risk of being caught, and the game
 * declines to tell them what they bought. `CLAUDE.md` forbids one of them in as
 * many words — "combat-relevant doctrine must be probe-visible" (D137) — and
 * another is the entire argument for the strategic weapon being an intelligence
 * decision rather than a purchase (T10).
 *
 * These hold each reading against the surface that has to print it.
 */
const NOW = new Date('2026-08-23T12:00:00.000Z').getTime();

const target = (over: Partial<GalaxyPlanet> = {}): GalaxyPlanet => ({
  id: 'them', name: 'Orrery-8', owner: 'Sable', position: { x: 100, y: 0, z: 0 },
  coreTier: 2, coreLevel: 6, satellites: [], shielded: false, isSelf: false,
  intel: 'RESOLVED', state: { kind: 'NORMAL' }, ...over,
});

const report = (over: Partial<ProbeReport> = {}): ProbeReport => ({
  targetPlanetId: 'them', targetName: 'Orrery-8', targetUsername: 'Sable',
  at: new Date(NOW - 30 * 60_000), accuracy: 0.8, detected: false,
  stock: { low: 100, high: 200 }, deuteriumStock: null,
  defence: { low: 20, high: 50 },
  fleetSize: { low: 2, high: 5 }, fleetHome: true,
  ...over,
});

const intelWith = (r: ProbeReport | null): IntelView => ({
  watching: [], radarLog: [], probeCooldowns: [],
  probeCost: { alloy: 25, crystal: 25, deuterium: 0 },
  probeReports: r ? [r] : [],
});

const read = (r: ProbeReport | null, world = target()) =>
  dossier({
    target: world,
    planet: planetView({ buildings: { CORE: 4, REFINERY: 2, EXTRACTOR: 2, VAULT: 1, SHIPYARD: 1 } }),
    intel: intelWith(r),
    reports: [],
    now: NOW,
  });

const fact = (r: ProbeReport | null, key: string) =>
  read(r).facts.find((f) => f.key === key);

describe('what a probe brings home', () => {
  /** T9 · D137. A 25% multiplier nobody can see is a rule that does not exist. */
  describe('combat doctrine', () => {
    it('names every doctrine the probe found, with its level', () => {
      const found = fact(report({ doctrines: { SHIP_POWER: 2, STARSHIP_ENGINEERING: 1 } }), 'doctrines');
      expect(found).toBeDefined();
      expect(found!.value).toMatch(/2/);
      expect(found!.value).toMatch(/1/);
      expect(found!.source).toBe('probe');
    });

    /**
     * AND AN EMPTY READING IS NOT A MISSING ONE. The probe looked and found none —
     * a real, useful fact — while an absent field means the reading was never
     * taken at all. Printing the first for the second would invent knowledge.
     */
    it('says so when the probe looked and found none', () => {
      const found = fact(report({ doctrines: {} }), 'doctrines');
      expect(found).toBeDefined();
      expect(found!.value).toMatch(/none/i);
    });

    it('says nothing at all when the reading was never taken', () => {
      expect(fact(report(), 'doctrines')).toBeUndefined();
    });
  });

  /** T10. Without this a Death Star is 33,000 resources spent blind. */
  describe('strategic defence', () => {
    it('reports a loaded interceptor charge', () => {
      const found = fact(report({ interceptor: true }), 'interceptor');
      expect(found).toBeDefined();
      expect(found!.value).toMatch(/loaded/i);
      expect(found!.note).toMatch(/destroyed/i);
    });

    it('reports an empty tube as its own answer', () => {
      const found = fact(report({ interceptor: false }), 'interceptor');
      expect(found).toBeDefined();
      expect(found!.value).toMatch(/no charge/i);
    });

    it('says nothing when the reading was never taken', () => {
      expect(fact(report(), 'interceptor')).toBeUndefined();
    });
  });

  /** D105/D106. A weapon on the pad is the loudest thing a probe can find. */
  describe('the weapon on their pad', () => {
    it('flags a finished strategic weapon as an opportunity', () => {
      const found = fact(report({ deathStar: 'READY' }), 'strategic');
      expect(found).toBeDefined();
      expect(found!.opportunity).toBe(true);
    });

    it('separates one under construction from one that is ready', () => {
      expect(fact(report({ deathStar: 'BUILDING' }), 'strategic')?.value)
        .not.toBe(fact(report({ deathStar: 'READY' }), 'strategic')?.value);
    });

    it('stays silent when there is nothing on the pad', () => {
      expect(fact(report({ deathStar: 'NONE' }), 'strategic')).toBeUndefined();
    });
  });

  /** The fuel reading, gated behind Isotope Spectrometry and shown nowhere. */
  describe('deuterium', () => {
    it('prints the band when the probe could read it', () => {
      const found = fact(report({ deuteriumStock: { low: 400, high: 900 } }), 'deuterium');
      expect(found).toBeDefined();
      expect(found!.value).toMatch(/400/);
      expect(found!.value).toMatch(/900/);
      expect(found!.accuracy).toBe(0.8);
    });

    it('says nothing when the commander cannot read isotopes', () => {
      expect(fact(report({ deuteriumStock: null }), 'deuterium')).toBeUndefined();
    });
  });

  /**
   * AND EVERY ONE OF THEM CARRIES ITS AGE.
   *
   * All four are frozen at the look. A panel that printed them without the age
   * would present a record as a reading, which is the map asserting something it
   * cannot know — the fog hides, it never lies.
   */
  it('dates every reading it prints', () => {
    const full = read(report({
      doctrines: { SHIP_POWER: 1 },
      interceptor: true,
      deathStar: 'READY',
      deuteriumStock: { low: 1, high: 2 },
    }));
    for (const key of ['doctrines', 'interceptor', 'strategic', 'deuterium']) {
      const found = full.facts.find((f) => f.key === key);
      expect(found, key).toBeDefined();
      expect(found!.ageMinutes, key).toBeCloseTo(30, 0);
    }
  });
});

/**
 * THE MAP AND THE PANEL MUST NOT DISAGREE ABOUT WHETHER YOU HAVE LOOKED.
 *
 * The report history is capped; the map's memory of probed worlds is not. Past
 * the cap the galaxy drew a REMEMBERED silhouette with a "seen 3h ago" stamp
 * while the panel beside it offered "nobody has ever looked closely". One surface,
 * two answers, about one world.
 */
describe('a world the map remembers', () => {
  it('does not claim nobody has ever looked', () => {
    const gap = read(null, target({ intel: 'REMEMBERED', seenAt: new Date(NOW - 3 * 3_600_000) }))
      .gaps.find((g) => g.key === 'stock');
    expect(gap).toBeDefined();
    expect(gap!.missing).toMatch(/aged out/i);
    expect(gap!.missing).not.toMatch(/ever looked/i);
  });

  it('still says so for a world nobody has probed', () => {
    const gap = read(null, target({ intel: 'UNKNOWN' })).gaps.find((g) => g.key === 'stock');
    expect(gap!.missing).toMatch(/ever looked/i);
  });
});
