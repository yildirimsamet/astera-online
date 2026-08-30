import { describe, expect, it } from 'vitest';
import {
  HULLS,
  GALAXY,
  SENSOR,
  bearingBetween,
  clarityState,
  massClass,
  radarRevealsComposition,
  radarRevealsSize,
  sensorReach,
  sensorZone,
  sensorSphere,
  telescopeRange,
  telescopeWatchRange,
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
  radarContactRange,
  radarRange,
  radarSensesIntent,
  radarRevealsBearing,
  radarRevealsOrigin,
  sensorLeadOnVisualLeg,
  surfaceStandoff,
  orbitStandoff,
  visualLeg,
  worldRadius,
  telescopeReading,
  telescopeSeed,
  travelMinutes,
} from '../src/index.js';

describe('clarity gradient', () => {
  /**
   * THE TABLE STATES ITS OWN CEILING, AND IT USED TO END AT `Infinity`.
   *
   * The cap and the ladder were two statements of one limit and they drifted: the
   * L4 rung sat at 1,525 under a cap of 1,800, so the last rung of a five-rung
   * ladder bought 275 units. They are one number now, and this holds them there.
   */
  it('ends at a real distance rather than at infinity', () => {
    expect(Number.isFinite(telescopeRange(5))).toBe(true);
    expect(telescopeRange(5)).toBe(SENSOR.maxRadius);
    expect(telescopeWatchRange(5)).toBe(SENSOR.maxRadius);
    expect(telescopeWatchRange(99)).toBe(SENSOR.maxRadius);
  });

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
  /**
   * EVERY RUNG THAT DRAWS A CIRCLE DETECTS FLEETS IN IT.
   *
   * L1 and L2 used to reach nothing — a zero inherited verbatim from the pre-D49
   * ladder, where fleet warning began at L3 — so the first two rungs of the
   * instrument sold a slightly better probe-catch roll and a compass bearing, for
   * 1,100 alloy. Under the three-zone model the radar circle is what makes the
   * galaxy visible at all, so a rung with no radius is a rung with no product.
   *
   * Only level 0 detects nothing, which is what "you have not bought one" means.
   */
  it('detects fleets on every rung that has a circle', () => {
    expect(radarDetectsFleets(0)).toBe(false);
    for (let level = 1; level <= 5; level += 1) {
      expect(radarDetectsFleets(level), `radar ${String(level)}`).toBe(true);
    }
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
   * D9 IS SUSPENDED WHILE THE TWO RADAR CIRCLES ARE MERGED, AND THIS SAYS SO.
   *
   * D9 is "a 40-minute flight must not give 40 minutes of notice", and the thing
   * that enforced it was the SPLIT: a wide clockless circle said "something is
   * coming" and a tight one carried the clock, so notice stayed a small fraction
   * of any real leg. The owner merged the two temporarily while the visibility
   * engine is rebuilt, which means the clock now fires at the detection radius and
   * a raid inside 2,200 units hands over its whole flight.
   *
   * This test is deliberately written to FAIL LOUDLY if the merge is ever
   * forgotten: it asserts the suspension rather than the invariant, and names what
   * has to change to restore it. Splitting `INTEL.radarContactRange` back to a
   * tighter ladder is the whole fix, and then this becomes an inequality again.
   */
  it('hands over a whole neighbourhood flight while the two circles are merged', () => {
    expect(
      radarContactRange(5),
      'the circles are no longer merged — restore the D9 assertion below',
    ).toBe(radarRange(5));

    const dist = 1800;
    const oneWay = travelMinutes(dist, HULLS.WASP.speed);
    // What D9 asks for, and what the merge currently gives instead.
    expect(radarLead(radarRange(5), dist, oneWay)).toBe(oneWay);
  });

  /** A raid launched from inside the circle is seen from the moment it leaves. */
  it('sees a neighbour inside the circle for its whole flight', () => {
    const dist = 100;
    const oneWay = travelMinutes(dist, HULLS.WASP.speed);
    expect(radarLead(radarRange(5), dist, oneWay)).toBe(oneWay);
  });

  it('gives no notice at all with no reach', () => {
    expect(radarLead(radarRange(0), 800, 30)).toBe(0);
    expect(radarLead(0, 800, 30)).toBe(0);
  });

  it('crosses the shell where the rendered craft crosses it, not at the world centre distance', () => {
    const from = { x: 0, y: 0, z: 0 };
    const oneWay = 12;
    // A reach the leg is genuinely longer than, or there is no crossing to find.
    const range = radarRange(3);
    const to = { x: range * 2, y: 0, z: 0 };
    const start = surfaceStandoff(worldRadius(4));
    const end = orbitStandoff(worldRadius(4));
    const lead = sensorLeadOnVisualLeg(range, from, to, start, end, oneWay);
    const leg = visualLeg(from, to, start, end);
    const remainingShare = lead / oneWay;
    const crossingX = leg.to.x - (leg.to.x - leg.from.x) * remainingShare;

    expect(Math.abs(to.x - crossingX)).toBeCloseTo(range, 8);
    expect(lead).toBeLessThan(radarLead(range, to.x, oneWay));
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

  /**
   * WALKS INWARD AND TERMINATES, whatever the ladder looks like.
   *
   * It used to name three rungs by hand. The ladder has five now, and on a leg
   * shorter than the widest circle SEVERAL rungs saturate to the same lead — the
   * walk correctly skips them in one hop rather than re-arming for an instant it
   * has already passed. What has to hold is the shape: strictly inward, and it
   * stops.
   */
  it('hops inward until there is nothing left to buy', () => {
    let remaining = ONE_WAY;
    let previous = Infinity;
    for (let guard = 0; guard <= RADAR_RANGES.length; guard += 1) {
      const next = nextRadarCheck(remaining, DIST, ONE_WAY);
      if (next === null) return;
      expect(next, 'the walk must move inward').toBeLessThan(previous);
      previous = next;
      remaining = radarLead(next, DIST, ONE_WAY);
    }
    throw new Error('nextRadarCheck never gave up');
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

describe('what the disc itself discloses — D123', () => {
  describe('the silhouette', () => {
    it('reads a scout party as light and a committed fleet as heavy', () => {
      expect(massClass({ WASP: 1 })).toBe('LIGHT');
      expect(massClass({ BULWARK: 40 })).toBe('HEAVY');
    });

    it('steps exactly where the constants say, and nowhere else', () => {
      const perWasp = HULLS.WASP.alloy + HULLS.WASP.crystal + HULLS.WASP.deuterium;
      const justUnder = Math.floor((SENSOR.massMedium - 1) / perWasp);
      const justOver = Math.ceil(SENSOR.massMedium / perWasp);

      expect(massClass({ WASP: justUnder })).toBe('LIGHT');
      expect(massClass({ WASP: justOver })).toBe('MEDIUM');
    });

    it('measures value, not hull count — six Bulwarks are not six Wasps', () => {
      expect(massClass({ WASP: 6 })).toBe('LIGHT');
      expect(massClass({ BULWARK: 6 })).toBe('MEDIUM');
    });

    /**
     * AN EMPTY FLEET IS LIGHT, NOT UNKNOWN. A probe and a return leg that lost
     * everything both come out at the bottom of the scale, and a stranger is not
     * supposed to be able to tell those apart.
     */
    it('never refuses to answer', () => {
      expect(massClass({})).toBe('LIGHT');
    });
  });

  describe('the sensor horizon', () => {
    /**
     * THE LADDER, RUNG BY RUNG, BECAUSE A PERSON CHOSE THESE NUMBERS.
     *
     * Every other assertion here is a SHAPE — monotonic, floored, capped, radar
     * outside telescope — and a shape cannot tell you that a rung moved. These six
     * pairs are an owner instruction, so they are written down where a change to
     * either table has to walk past them.
     *
     * The identifying column is `sensorReach`, not the raw table: what a commander
     * actually sees is the ladder AFTER the free floor and the D126 ceiling, and
     * that is the figure every screen quotes.
     */
    it('is the ladder the owner set, rung by rung', () => {
      expect([0, 1, 2, 3, 4, 5].map(sensorReach))
        .toEqual([750, 950, 1150, 1250, 1450, 1600]);
      expect([0, 1, 2, 3, 4, 5].map(radarContactRange))
        .toEqual([0, 1200, 1450, 1700, 1900, 2200]);
    });

    it('gives a commander with no telescope a live neighbourhood', () => {
      expect(SENSOR.baseRadius).toBe(750);
      expect(sensorReach(0)).toBe(SENSOR.baseRadius);
    });

    /**
     * AND EVERY TELESCOPE RUNG WIDENS THE DISC IT IS SOLD AGAINST. Found in review.
     *
     * `telescopeRange[1]` was 500 against a floor of 500, so Telescope 1 bought a
     * watch slot and not one unit of live sight — a rung whose headline product
     * was a no-op. Asserted on `sensorReach` rather than on the table, because the
     * floor is what made the old rung dead.
     */
    it('never sells a rung that buys no sight', () => {
      for (const level of [1, 2, 3, 4, 5]) {
        expect(sensorReach(level)).toBeGreaterThan(sensorReach(level - 1));
      }
    });

    it('never shrinks as the instrument grows', () => {
      const ladder = [0, 1, 2, 3, 4, 5].map(sensorReach);
      expect(ladder).toEqual([...ladder].sort((a, b) => a - b));
    });

    /**
     * THE FLOOR IS LOAD-BEARING. `INTEL.telescopeRange` was never scaled by D101 —
     * its old docblock said "the disc has radius 1000" against the 2,000-unit
     * sphere now — so the lower rungs reach less far than the naked eye and the
     * ladder would otherwise open on a dead disc.
     */
    it('is the floor until the instrument beats it', () => {
      for (const level of [0, 1, 2, 3, 4, 5]) {
        expect(sensorReach(level)).toBeGreaterThanOrEqual(SENSOR.baseRadius);
        expect(sensorReach(level)).toBe(
          Math.min(SENSOR.maxRadius, Math.max(SENSOR.baseRadius, telescopeRange(level))),
        );
      }
    });

    /**
     * THE ONE THING IT MAY NEVER DO. D126.
     *
     * The fog never fully lifts: no amount of Telescope identifies the whole disc.
     * The ceiling is 80% of the galaxy's radius, so even a commander at the exact
     * centre of the sphere leaves a real outer shell they cannot resolve.
     *
     * IT IS THE IDENTIFYING CIRCLE ONLY. The Radar reaches further by design — a
     * mote you cannot name is not omniscience — and is capped by its own table.
     */
    it('never identifies everywhere, however much is paid', () => {
      expect(sensorReach(99)).toBe(SENSOR.maxRadius);
      expect(sensorReach(99)).toBeLessThan(GALAXY.radius);
    });
  });

  /**
   * THE THREE ZONES — the whole visibility model, tested where it lives.
   *
   * This replaces the departure-shroud suite. The shroud deleted a craft for the
   * first stretch of its leg from EVERYBODY at every instrument level, which
   * contradicted the model these tests now state: what a commander sees is decided
   * by where the craft IS relative to their own circles, and by nothing else.
   */
  describe('the three sensor zones', () => {
    const at = (x: number) => ({ x, y: 0, z: 0 });
    // Telescope 3 identifies to 1,250; Radar 3 detects to 1,700.
    const post = sensorSphere(at(0), 3, 3, 'home');

    it('identifies inside the telescope circle', () => {
      expect(sensorZone([post], at(sensorReach(3) - 1))).toBe('IDENTIFIED');
      expect(sensorZone([post], at(0))).toBe('IDENTIFIED');
    });

    it('gives a question mark between the two circles', () => {
      expect(sensorZone([post], at(sensorReach(3) + 1))).toBe('CONTACT');
      expect(sensorZone([post], at(radarContactRange(3) - 1))).toBe('CONTACT');
    });

    it('shows nothing at all beyond the radar circle', () => {
      expect(sensorZone([post], at(radarContactRange(3) + 1))).toBe('NONE');
      expect(sensorZone([post], at(9_999))).toBe('NONE');
    });

    /**
     * A CRAFT BORN INSIDE THE CIRCLE IS VISIBLE FROM ITS FIRST INSTANT.
     *
     * The regression this file exists to hold. A fleet leaving a world 300 units
     * from a maxed Telescope used to be invisible for the first 35% of its flight,
     * because the shroud was measured from the craft's own origin and ignored the
     * observer entirely. Nothing about where a craft STARTED may enter this answer.
     */
    it('sees a craft the instant it launches inside the circle', () => {
      const neighbour = at(300);
      expect(sensorZone([post], neighbour)).toBe('IDENTIFIED');
    });

    /** Four worlds are four pairs of circles, and the best answer wins. */
    it('takes the best answer across every world a commander holds', () => {
      const far = sensorSphere(at(4_000), 5, 5, 'colony');
      expect(sensorZone([post, far], at(4_000))).toBe('IDENTIFIED');
      expect(sensorZone([post, far], at(4_000 + sensorReach(5) + 1))).toBe('CONTACT');
    });

    /**
     * YOU CANNOT FAIL TO DETECT WHAT YOU ARE LOOKING STRAIGHT AT.
     *
     * The tables put the radar outside the telescope at every level, but a
     * commander may hold a Telescope 5 beside a Radar 1 — and then the identifying
     * circle is the wider of the two. Testing identification first is what stops
     * that world resolving nothing.
     */
    it('identifies inside the telescope even when the radar is narrower', () => {
      const lopsided = sensorSphere(at(0), 5, 1, 'home');
      expect(lopsided.identify).toBeGreaterThan(lopsided.detect);
      expect(sensorZone([lopsided], at(lopsided.identify - 1))).toBe('IDENTIFIED');
      expect(sensorZone([lopsided], at(lopsided.identify + 1))).toBe('NONE');
    });

    it('sees nothing at all with no worlds', () => {
      expect(sensorZone([], at(0))).toBe('NONE');
    });
  });

  /**
   * THE OWNER'S LADDER RULE, HELD AS AN ASSERTION.
   *
   * "At the same level the radar must always cover more than the telescope." It
   * was not true before — Radar 4 reached 1,500 against a Telescope 4 that saw
   * 1,525 — and nothing said so, because the two tables sat in different blocks of
   * the same file and no test compared them.
   */
  describe('the two ladders against each other', () => {
    it('puts the radar outside the telescope at every level it exists', () => {
      for (let level = 1; level <= 5; level += 1) {
        expect(
          radarContactRange(level),
          `radar ${String(level)} must out-reach telescope ${String(level)}`,
        ).toBeGreaterThan(telescopeRange(level));
      }
    });

    it('gives every radar rung a reach to sell', () => {
      for (let level = 1; level <= 5; level += 1) {
        expect(radarContactRange(level)).toBeGreaterThan(radarContactRange(level - 1));
      }
    });

    it('gives every telescope rung a reach to sell, and ends at a number', () => {
      for (let level = 1; level <= 5; level += 1) {
        expect(telescopeRange(level)).toBeGreaterThan(telescopeRange(level - 1));
      }
      expect(Number.isFinite(telescopeRange(5))).toBe(true);
      expect(telescopeRange(5)).toBe(SENSOR.maxRadius);
    });
  });

  describe('the radar ladder', () => {
    it('sells the size at L4 and the roster at L5, and neither below', () => {
      for (const level of [0, 1, 2, 3]) {
        expect(radarRevealsSize(level)).toBe(false);
        expect(radarRevealsComposition(level)).toBe(false);
      }
      expect(radarRevealsSize(4)).toBe(true);
      expect(radarRevealsComposition(4)).toBe(false);
      expect(radarRevealsComposition(5)).toBe(true);
    });

    /** Every rung must buy something, or the level above it is a paid no-op. */
    it('has a distinct product on every rung it charges for', () => {
      const rung = (level: number) => [
        radarDetectsFleets(level),
        radarRevealsBearing(level),
        radarRevealsSize(level),
        radarRevealsComposition(level),
      ].join('/');
      const rungs = [1, 2, 3, 4, 5].map(rung);
      // Reach alone separates 1 from 3, so the reach is part of the rung.
      const withReach = rungs.map((flags, index) => `${flags}@${String(radarContactRange(index + 1))}`);
      expect(new Set(withReach).size).toBe(withReach.length);
    });
  });

  /**
   * THE LONG CIRCLE, AND THE FACT THAT IT IS A CIRCLE. D126.
   *
   * `radarSensesIntent` takes a REACH and a DISTANCE, and that signature is the
   * fix rather than a detail. It used to take a level, so its one caller could not
   * use it — the caller held a precomputed reach — and restated the rule inline
   * instead, against `mission.distance`, the LENGTH OF THE LEG. Two opposite bugs
   * in one expression: a neighbour's raid flagged from the instant it launched,
   * which is what D9 forbids, and a distant raid never flagged at all, not even
   * standing over the world.
   */
  describe('the radar’s long circle', () => {
    it('opens at the first rung and is shut only with no instrument', () => {
      expect(radarContactRange(0)).toBe(0);
      for (const level of [1, 2, 3, 4, 5]) {
        expect(radarContactRange(level)).toBeGreaterThan(0);
      }
    });

    /**
     * MERGED FOR NOW, AND THIS HOLDS THE MERGE VISIBLE.
     *
     * The two circles answer two questions — "something is coming" and "it lands
     * in fourteen minutes" — and the split is what kept notice a small fraction of
     * any real leg (D9). The owner merged them temporarily while the visibility
     * engine is rebuilt: one circle is one thing to draw, explain and test.
     *
     * When they are split again this becomes `toBeGreaterThan` and the D9 test
     * above becomes an inequality. Both are written to fail the moment the tables
     * move, so neither can be forgotten.
     */
    it('is the same circle as the timed warning while the two are merged', () => {
      for (const level of [1, 2, 3, 4, 5]) {
        expect(radarContactRange(level)).toBe(radarRange(level));
      }
    });

    it('never shrinks as the instrument grows', () => {
      const ladder = [0, 1, 2, 3, 4, 5].map(radarContactRange);
      expect(ladder).toEqual([...ladder].sort((a, b) => a - b));
    });

    /** A radius of zero senses nothing, including a craft standing on the world. */
    it('senses nothing at all when the circle is shut', () => {
      expect(radarSensesIntent(0, 0)).toBe(false);
      expect(radarSensesIntent(0, 1)).toBe(false);
    });

    /** Inclusive at the rim, so a craft exactly on the boundary is inside it. */
    it('includes its own rim and nothing past it', () => {
      const reach = radarContactRange(3);
      expect(radarSensesIntent(reach, reach - 1)).toBe(true);
      expect(radarSensesIntent(reach, reach)).toBe(true);
      expect(radarSensesIntent(reach, reach + 1)).toBe(false);
    });

    /**
     * AND IT HAS NO OPINION ABOUT THE LEG. The distance it is given is how far the
     * craft IS, so the same leg answers differently as the craft crosses the disc.
     * That is the property the shipped version did not have.
     */
    it('answers where the craft is, not how far it has to fly', () => {
      const reach = radarContactRange(3);
      const leg = reach * 3;
      // Launched from beyond the circle, so nothing at the start of the leg…
      expect(radarSensesIntent(reach, leg)).toBe(false);
      // …and everything once it is close, on that same leg.
      expect(radarSensesIntent(reach, leg * 0.1)).toBe(true);
    });
  });
});
