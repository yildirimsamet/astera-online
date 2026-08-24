import { describe, expect, it } from 'vitest';
import {
  bearingBetween,
  clarityState,
  detectChance,
  fuzzBand,
  mulberry32,
  probeAccuracy,
  INTEL,
  RADAR_RANGES,
  maxRadarRange,
  nextRadarCheck,
  radarDetectsFleets,
  radarLead,
  radarRange,
  radarRevealsBearing,
  radarRevealsOrigin,
  telescopeReading,
  telescopeSeed,
  travelMinutes,
  HULLS,
} from '../src/index.js';

describe('clarity gradient', () => {
  it('maps the five states', () => {
    expect(clarityState(3)).toBe('FULL');
    expect(clarityState(1)).toBe('CLEAR');
    expect(clarityState(0)).toBe('INTERMITTENT');
    expect(clarityState(-1)).toBe('DEGRADED');
    expect(clarityState(-4)).toBe('BLIND');
  });

  it('gives ETA only at FULL', () => {
    const full = telescopeReading(4, 1, 'AWAY', 0, 25, mulberry32(1));
    const clear = telescopeReading(2, 1, 'AWAY', 0, 25, mulberry32(1));
    expect(full.etaMinutes).toBe(25);
    expect(clear.etaMinutes).toBeNull();
  });

  it('BLIND never leaks the true status', () => {
    for (let i = 0; i < 50; i++) {
      const r = telescopeReading(0, 3, 'AWAY', 0, null, mulberry32(i));
      expect(r.status).toBe('UNKNOWN');
    }
  });

  it('INTERMITTENT is real but possibly stale — the interesting state', () => {
    const stales = Array.from({ length: 40 }, (_, i) =>
      telescopeReading(2, 2, 'HOME', 5, null, mulberry32(i)).staleMinutes,
    );
    expect(new Set(stales).size).toBeGreaterThan(1);
    expect(Math.min(...stales)).toBeGreaterThanOrEqual(0);
  });

  it('DEGRADED mostly reads UNKNOWN', () => {
    const readings = Array.from({ length: 300 }, (_, i) =>
      telescopeReading(1, 2, 'HOME', 0, null, mulberry32(i)),
    );
    const unknown = readings.filter((r) => r.status === 'UNKNOWN').length;
    expect(unknown / readings.length).toBeGreaterThan(0.55);
    expect(unknown / readings.length).toBeLessThan(0.85);
  });
});

describe('refresh-spam resistance', () => {
  /**
   * THE EASIEST WAY TO SHIP A BROKEN INFORMATION GAME: if the roll were fresh per
   * request, a player defeats the entire fog layer by pulling to refresh until
   * INTERMITTENT happens to yield a confirmation.
   */
  it('a reading is identical however many times you ask inside a window', () => {
    const read = (minute: number) =>
      telescopeReading(2, 2, 'HOME', 9, null, telescopeSeed('watch-77', minute));
    const first = read(100);
    for (const m of [100, 101, 105, 109, 119]) {
      expect(read(m)).toEqual(first);
    }
  });

  it('but does change once the window rolls over', () => {
    const a = telescopeReading(2, 2, 'HOME', 9, null, telescopeSeed('watch-77', 100));
    const later = Array.from({ length: 12 }, (_, i) =>
      telescopeReading(2, 2, 'HOME', 9, null, telescopeSeed('watch-77', 140 + i * 20)),
    );
    expect(later.some((r) => r.staleMinutes !== a.staleMinutes)).toBe(true);
  });

  it('different watches roll independently', () => {
    const a = telescopeSeed('watch-a', 100)();
    const b = telescopeSeed('watch-b', 100)();
    expect(a).not.toBe(b);
  });
});

describe('probes', () => {
  it('detection rises with radar and falls with stealth', () => {
    expect(detectChance(5, 0)).toBeGreaterThan(detectChance(1, 0));
    expect(detectChance(3, 5)).toBeLessThan(detectChance(3, 0));
  });

  it('never becomes certain in either direction', () => {
    expect(detectChance(99, 0)).toBeLessThan(1);
    expect(detectChance(0, 99)).toBeGreaterThan(0);
  });

  it('a cheap probe gives a range, an expensive one a number', () => {
    const cheap = fuzzBand(61_000, probeAccuracy(1, 3), mulberry32(7));
    const good = fuzzBand(61_000, probeAccuracy(6, 0), mulberry32(7));
    expect(cheap.high - cheap.low).toBeGreaterThan(good.high - good.low);
  });

  it('bands are ordered and non-negative', () => {
    for (let i = 0; i < 100; i++) {
      const b = fuzzBand(40_000, probeAccuracy(2, 2), mulberry32(i));
      expect(b.low).toBeLessThanOrEqual(b.mid);
      expect(b.mid).toBeLessThanOrEqual(b.high);
      expect(b.low).toBeGreaterThanOrEqual(0);
    }
  });
});

describe('radar', () => {
  it('detects inbound fleets only from L3', () => {
    expect(radarDetectsFleets(2)).toBe(false);
    expect(radarDetectsFleets(3)).toBe(true);
  });

  it('higher radar reaches further', () => {
    expect(radarRange(5)).toBeGreaterThan(radarRange(3));
  });

  it('clamps out-of-range levels', () => {
    expect(radarRange(99)).toBe(radarRange(5));
    expect(radarRange(-3)).toBe(0);
  });

  /**
   * THE REACH IS THE DEFENDER'S; THE NOTICE IS THE ATTACKER'S. D49.
   *
   * This is the whole reason the countdown was replaced. One radar, one origin,
   * one distance — and the minutes of warning fall out of how fast the fleet
   * chose to travel. A Bulwark siege fleet is telegraphed; a Wasp strike is not.
   */
  it('gives a slow fleet more notice than a fast one over the same leg', () => {
    const dist = 800;
    const wasp = travelMinutes(dist, HULLS.WASP.speed);
    const bulwark = travelMinutes(dist, HULLS.BULWARK.speed);
    const reach = radarRange(5);

    expect(radarLead(reach, dist, bulwark)).toBeGreaterThan(radarLead(reach, dist, wasp));

    /**
     * AND THE FAST ONE IS STILL WORTH HAVING — stated as the SHARE of the leg it
     * hands over, not as a count of minutes.
     *
     * This line used to read `toBeGreaterThan(12)`, comparing a maxed radar against
     * the flat twelve-minute countdown D49 retired. That comparison did not survive
     * D63: hull speeds were raised so the widest leg on the disc is fifteen minutes,
     * and twelve minutes of notice on a five-minute flight is arithmetically
     * impossible. The number was a fossil of the old speeds; what it was protecting
     * is the fraction, and the fraction is exactly what `radarLead` computes.
     */
    expect(radarLead(reach, dist, wasp)).toBeCloseTo(Math.min(1, reach / dist) * wasp, 5);
    expect(radarLead(reach, dist, wasp)).toBeGreaterThan(wasp * 0.5);
  });

  /**
   * D9, WHICH SURVIVES THIS CHANGE. "A 40-minute flight must not give 40 minutes
   * of notice." Because the notice is a FRACTION of the flight — `range / dist` —
   * a long leg can never hand over all of itself.
   */
  it('never gives away a whole long flight', () => {
    const dist = 1800;
    const oneWay = travelMinutes(dist, HULLS.WASP.speed);
    expect(radarLead(radarRange(5), dist, oneWay)).toBeLessThan(oneWay * 0.4);
  });

  /** A raid launched from inside the circle is seen from the moment it leaves. */
  it('sees a neighbour inside the circle for its whole flight', () => {
    const dist = 100;
    const oneWay = travelMinutes(dist, HULLS.WASP.speed);
    expect(radarLead(radarRange(5), dist, oneWay)).toBe(oneWay);
  });

  it('gives no notice at all with no reach', () => {
    expect(radarLead(radarRange(2), 800, 30)).toBe(0);
    expect(radarLead(0, 800, 30)).toBe(0);
  });
});

/**
 * THE RUNGS THE WARNING RE-CHECKS AT. D45, in D49's units.
 *
 * A radar warning is scheduled once, at the earliest instant any radar could
 * fire, and the defender's level is read when it runs — so a radar installed or
 * raised mid-flight is worth what it says on the tin. Getting there means hopping
 * down the ladder, and these are the rungs.
 */
describe('the radar ladder', () => {
  const DIST = 900;
  const ONE_WAY = 60;

  /**
   * DERIVED FROM THE TABLE, never restated. `INTEL.radarRange` is sized in warning
   * MINUTES rather than in galaxy share, so it is one of the few intel constants
   * that did NOT take Economy v2's x2.5 unit change — and a test that froze its
   * figures would have to be edited every time the tempo moved, which is exactly
   * how a guard stops guarding.
   */
  it('lists every reach the table sells, widest first, without repeats', () => {
    const fromTable = [...new Set(INTEL.radarRange.filter((r) => r > 0))].sort((a, b) => b - a);
    expect(RADAR_RANGES).toEqual(fromTable);
  });

  /** DERIVED, so a sixth level or a changed figure is picked up rather than copied. */
  it('is derived from the reach table itself', () => {
    for (const range of RADAR_RANGES) {
      expect(INTEL.radarRange).toContain(range);
    }
    expect(maxRadarRange()).toBe(Math.max(...INTEL.radarRange));
  });

  it('nothing is ever scheduled earlier than the widest reach', () => {
    expect(maxRadarRange()).toBe(radarRange(5));
  });

  it('hops to the next rung whose crossing is still ahead', () => {
    const lead = (range: number) => radarLead(range, DIST, ONE_WAY);
    const [widest, middle, narrowest] = RADAR_RANGES as [number, number, number];
    expect(nextRadarCheck(ONE_WAY, DIST, ONE_WAY)).toBe(widest);
    expect(nextRadarCheck(lead(widest), DIST, ONE_WAY)).toBe(middle);
    expect(nextRadarCheck(lead(middle), DIST, ONE_WAY)).toBe(narrowest);
  });

  /**
   * AND THEN STOPS. The hop is what makes a mid-flight upgrade work; a hop with no
   * floor would be a poll, and a poll that never terminates is an event that
   * reschedules itself for the rest of the season.
   */
  it('gives up once the fleet is inside the narrowest reach', () => {
    const narrowest = RADAR_RANGES[RADAR_RANGES.length - 1]!;
    expect(nextRadarCheck(radarLead(narrowest, DIST, ONE_WAY), DIST, ONE_WAY)).toBeNull();
    expect(nextRadarCheck(1, DIST, ONE_WAY)).toBeNull();
    expect(nextRadarCheck(0, DIST, ONE_WAY)).toBeNull();
  });

  it('terminates from any starting point', () => {
    let at: number | null = ONE_WAY;
    for (let hops = 0; at !== null; hops++) {
      const range: number | null = nextRadarCheck(at, DIST, ONE_WAY);
      at = range === null ? null : radarLead(range, DIST, ONE_WAY);
      expect(hops).toBeLessThan(RADAR_RANGES.length + 1);
    }
  });

  /**
   * A LEG SHORTER THAN THE WIDEST REACH STILL TERMINATES.
   *
   * Every rung wider than the leg gives the same answer — the whole flight — so
   * `radarLead(range) < remaining` is false for all of them at launch and the hop
   * has to fall straight through to a narrower one rather than sitting on a rung
   * it can never leave.
   */
  it('terminates on a leg shorter than the widest reach', () => {
    const short = 120;
    let at: number | null = 12;
    for (let hops = 0; at !== null; hops++) {
      const range: number | null = nextRadarCheck(at, short, 12);
      at = range === null ? null : radarLead(range, short, 12);
      expect(hops).toBeLessThan(RADAR_RANGES.length + 1);
    }
  });
});

describe('bearing', () => {
  const origin = { x: 0, y: 0, z: 0 };

  it.each([
    ['east', { x: 100, y: 0, z: 0 }],
    ['south', { x: 0, y: 0, z: 100 }],
    ['west', { x: -100, y: 0, z: 0 }],
    ['north', { x: 0, y: 0, z: -100 }],
    ['south-east', { x: 100, y: 0, z: 100 }],
    ['north-west', { x: -100, y: 0, z: -100 }],
  ])('reads %s correctly', (expected, to) => {
    expect(bearingBetween(origin, to)).toBe(expected);
  });

  it('ignores the vertical axis — the disc is what matters', () => {
    expect(bearingBetween(origin, { x: 100, y: 500, z: 0 })).toBe('east');
    expect(bearingBetween(origin, { x: 100, y: -500, z: 0 })).toBe('east');
  });

  it('is antisymmetric — the opposite direction is four points away', () => {
    const compass = ['east', 'south-east', 'south', 'south-west',
                     'west', 'north-west', 'north', 'north-east'];
    for (let i = 0; i < 8; i++) {
      const angle = (i * Math.PI) / 4;
      const to = { x: Math.cos(angle) * 100, y: 0, z: Math.sin(angle) * 100 };
      const there = compass.indexOf(bearingBetween(origin, to));
      const back = compass.indexOf(bearingBetween(to, origin));
      expect((there + 4) % 8).toBe(back);
    }
  });

  it('never throws on identical positions', () => {
    expect(() => bearingBetween(origin, origin)).not.toThrow();
  });

  it('is stable regardless of distance', () => {
    expect(bearingBetween(origin, { x: 1, y: 0, z: 0 })).toBe(
      bearingBetween(origin, { x: 9999, y: 0, z: 0 }),
    );
  });
});

describe('radar disclosure tiers', () => {
  it('withholds a bearing below L2', () => {
    expect(radarRevealsBearing(1)).toBe(false);
    expect(radarRevealsBearing(2)).toBe(true);
  });

  it('withholds the origin below L5 — that is what L5 is worth paying for', () => {
    for (const level of [0, 1, 2, 3, 4]) expect(radarRevealsOrigin(level)).toBe(false);
    expect(radarRevealsOrigin(5)).toBe(true);
  });

  it('detecting fleets and naming scanners are separate privileges', () => {
    // L3 sees inbound fleets but still cannot name who scanned it.
    expect(radarDetectsFleets(3)).toBe(true);
    expect(radarRevealsOrigin(3)).toBe(false);
  });
});
