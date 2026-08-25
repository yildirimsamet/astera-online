import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  ALL_HULLS,
  MOBILE_HULLS,
  MULTI_WORLD,
  DEBRIS,
  DISRUPTION,
  ECON,
  GALAXY,
  SEASON,
  HULLS,
  INSTRUMENT_COST_MULT,
  INSTRUMENT_IDS,
  INTEL,
  PROBE,
  PROSPECTOR,
  SATELLITES,
  SATELLITE_IDS,
  SHIELD,
  START,
  PLANET_START,
  TRAVEL,
  alloyRate,
  asteroidActive,
  asteroidPosition,
  claimDebris,
  claimOre,
  collectorCap,
  crystalRate,
  debrisRemaining,
  defenceMinutes,
  distance,
  interceptAsteroid,
  investedInInstrument,
  investedInSatellite,
  prospectorSpeed,
  instrumentCost,
  satelliteCost,
  satelliteSlots,
  storageCap,
  telescopeCooldownHours,
  telescopeRange,
  telescopeSlots,
  upgradeCost,
  withinTelescopeRange,
  bookBattle,
  computeLoot,
  dominion,
  emptyLedger,
  fleetCargo,
  fleetCount,
  generateGalaxy,
  median,
  mulberry32,
  resolveCombat,
  prospectorTravelExact,
  travelExact,
  travelMinutes,
  type Fleet,
} from '../src/index.js';

/** Small random fleets, biased towards mixes that actually occur in play. */
const arbFleet = fc
  .record({
    WASP: fc.integer({ min: 0, max: 300 }),
    LANCE: fc.integer({ min: 0, max: 60 }),
    BULWARK: fc.integer({ min: 0, max: 20 }),
    BREACHER: fc.integer({ min: 0, max: 20 }),
    HAULER: fc.integer({ min: 0, max: 40 }),
    RUNNER: fc.integer({ min: 0, max: 20 }),
  })
  .filter((f) => f.WASP + f.LANCE + f.BULWARK + f.BREACHER + f.HAULER + f.RUNNER > 0);

const arbDefence = fc.record({
  WASP: fc.integer({ min: 0, max: 200 }),
  BULWARK: fc.integer({ min: 0, max: 15 }),
  BREACHER: fc.integer({ min: 0, max: 10 }),
  BASTION: fc.integer({ min: 0, max: 25 }),
});

describe('combat invariants — must hold for ALL inputs', () => {
  it('never produces a negative unit count', () => {
    fc.assert(
      fc.property(arbFleet, arbDefence, fc.integer({ min: 0, max: 40_000 }), fc.nat(), (a, d, shield, seed) => {
        const r = resolveCombat(a, d, shield, mulberry32(seed));
        for (const id of ALL_HULLS) {
          expect(r.attackerSurvivors[id] ?? 0).toBeGreaterThanOrEqual(0);
          expect(r.defenderSurvivors[id] ?? 0).toBeGreaterThanOrEqual(0);
        }
      }),
      { numRuns: 300 },
    );
  });

  it('never creates units out of nothing', () => {
    fc.assert(
      fc.property(arbFleet, arbDefence, fc.nat(), (a, d, seed) => {
        const r = resolveCombat(a, d, 0, mulberry32(seed));
        for (const id of ALL_HULLS) {
          expect(r.attackerSurvivors[id] ?? 0).toBeLessThanOrEqual((a as Fleet)[id] ?? 0);
          expect(r.defenderSurvivors[id] ?? 0).toBeLessThanOrEqual((d as Fleet)[id] ?? 0);
        }
      }),
      { numRuns: 300 },
    );
  });

  it('never reports negative destroyed value, even with salvage', () => {
    fc.assert(
      fc.property(arbFleet, arbDefence, fc.nat(), (a, d, seed) => {
        const r = resolveCombat(a, d, 0, mulberry32(seed));
        expect(r.defenderLossValue).toBeGreaterThanOrEqual(0);
        expect(r.attackerLossValue).toBeGreaterThanOrEqual(0);
      }),
      { numRuns: 300 },
    );
  });

  it('DECISIVE implies the defence is actually gone', () => {
    fc.assert(
      fc.property(arbFleet, arbDefence, fc.nat(), (a, d, seed) => {
        const r = resolveCombat(a, d, 0, mulberry32(seed));
        if (r.grade === 'DECISIVE') expect(fleetCount(r.defenderSurvivors)).toBe(0);
      }),
      { numRuns: 300 },
    );
  });

  it('resolves in at most three rounds', () => {
    fc.assert(
      fc.property(arbFleet, arbDefence, fc.nat(), (a, d, seed) => {
        const r = resolveCombat(a, d, 0, mulberry32(seed));
        expect(r.rounds.length).toBeLessThanOrEqual(3);
      }),
      { numRuns: 200 },
    );
  });

  it('is deterministic for a given seed', () => {
    fc.assert(
      fc.property(arbFleet, arbDefence, fc.nat(), (a, d, seed) => {
        const one = resolveCombat(a, d, 0, mulberry32(seed));
        const two = resolveCombat(a, d, 0, mulberry32(seed));
        expect(two).toEqual(one);
      }),
      { numRuns: 200 },
    );
  });
});

describe('dominion is zero-sum for ALL battles', () => {
  it('holds across arbitrary fleets and loot', () => {
    fc.assert(
      fc.property(
        arbFleet,
        arbDefence,
        fc.integer({ min: 0, max: 200_000 }),
        fc.nat(),
        (a, d, loot, seed) => {
          const atk = emptyLedger();
          const def = emptyLedger();
          bookBattle(atk, def, loot, resolveCombat(a, d, 0, mulberry32(seed)));
          expect(dominion(atk) + dominion(def)).toBe(0);
        },
      ),
      { numRuns: 400 },
    );
  });
});

describe('loot invariants', () => {
  it('never exceeds cargo, never exceeds what is available', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 500_000 }),
        fc.integer({ min: 0, max: 500_000 }),
        fc.integer({ min: 0, max: 200_000 }),
        fc.integer({ min: 0, max: 200_000 }),
        fc.integer({ min: 0, max: 100_000 }),
        fc.integer({ min: 0, max: 200_000 }),
        fc.constantFrom('DECISIVE' as const, 'PARTIAL' as const, 'REPELLED' as const),
        (alloy, crystal, bufA, bufC, floor, cargo, grade) => {
          const stock = { alloy, crystal, deuterium: 0 };
          const buffer = { alloy: bufA, crystal: bufC, deuterium: 0 };
          const loot = computeLoot(
            stock,
            buffer,
            { alloy: floor, crystal: floor, deuterium: 0 },
            grade,
            cargo,
          );

          expect(loot.alloy + loot.crystal).toBeLessThanOrEqual(cargo);
          expect(loot.alloy).toBeGreaterThanOrEqual(0);
          expect(loot.crystal).toBeGreaterThanOrEqual(0);

          // Neither column may be over-drawn: the caller debits each separately,
          // and a loot line larger than the pile it came from is a negative
          // balance waiting to be written.
          expect(loot.fromStock.alloy).toBeLessThanOrEqual(Math.max(0, alloy - floor));
          expect(loot.fromStock.crystal).toBeLessThanOrEqual(Math.max(0, crystal - floor));
          expect(loot.fromBuffer.alloy).toBeLessThanOrEqual(bufA);
          expect(loot.fromBuffer.crystal).toBeLessThanOrEqual(bufC);

          expect(loot.fromStock.alloy + loot.fromBuffer.alloy).toBe(loot.alloy);
          expect(loot.fromStock.crystal + loot.fromBuffer.crystal).toBe(loot.crystal);
        },
      ),
      { numRuns: 500 },
    );
  });

  it('a fleet can never carry more than its hulls allow', () => {
    fc.assert(
      fc.property(arbFleet, (f) => {
        const big = { alloy: 1e9, crystal: 1e9, deuterium: 0 };
        const loot = computeLoot(
          big,
          big,
          { alloy: 0, crystal: 0, deuterium: 0 },
          'DECISIVE',
          fleetCargo(f),
        );
        expect(loot.alloy + loot.crystal).toBeLessThanOrEqual(fleetCargo(f));
      }),
      { numRuns: 200 },
    );
  });
});

describe('travel', () => {
  it('is monotonic in distance and never instant', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 4000 }), fc.integer({ min: 1, max: 60 }), (d, s) => {
        // The launch overhead, read from the rule rather than written out. It was
        // the literal 3 until D63 moved it, at which point this asserted a figure
        // the game no longer had — the invariant is "never instant", not "never
        // under three minutes".
        expect(travelMinutes(d, s)).toBeGreaterThanOrEqual(TRAVEL.baseMinutes);
        expect(travelMinutes(d + 100, s)).toBeGreaterThanOrEqual(travelMinutes(d, s));
      }),
      { numRuns: 300 },
    );
  });

  it('an immobile fleet cannot travel', () => {
    expect(travelMinutes(100, 0)).toBe(Infinity);
  });
});

describe('galaxy generation', () => {
  it('is deterministic — same seed, same galaxy', () => {
    fc.assert(
      fc.property(fc.nat(), (seed) => {
        expect(generateGalaxy(seed, 40)).toEqual(generateGalaxy(seed, 40));
      }),
      { numRuns: 30 },
    );
  });

  it('keeps every planet inside the disc', () => {
    const g = generateGalaxy(99, 200);
    for (const s of g.slots) {
      expect(Math.hypot(s.x, s.z)).toBeLessThanOrEqual(GALAXY.radius + 1);
      expect(Math.abs(s.y)).toBeLessThanOrEqual(GALAXY.thickness + 1);
    }
  });

  it('produces the requested number of slots', () => {
    expect(generateGalaxy(4, 200).slots).toHaveLength(200);
  });

  /**
   * The client regenerates the field locally and the server resolves mining
   * against it. If the two disagree by so much as one rock, a player mines an
   * asteroid they cannot see — so the field must not depend on how many planet
   * slots the shard happens to have.
   */
  it('generates the same asteroid field whatever the shard cap', () => {
    expect(generateGalaxy(31, 120).asteroids).toEqual(generateGalaxy(31, 200).asteroids);
  });
});

/**
 * ASTEROIDS AND INTERCEPTION — D19.
 *
 * The interception is the one piece of new maths in the game, and it is the kind
 * that fails silently: a craft aimed a few units wrong still flies, still arrives,
 * and just quietly never meets the rock. These hold the meeting itself rather than
 * the algebra that produces it.
 */
describe('the asteroid field', () => {
  const spec = generateGalaxy(7, 40);
  const rocks = spec.asteroids;

  it('spawns rocks at the owner-set fifteen-percent-higher rate', () => {
    expect(GALAXY.asteroidSpawnPerHour).toBe(10.35);
  });

  it('adds the higher rate as a new lane without squeezing established spawn times', () => {
    const span = SEASON.days * 24 * 60;
    const baseCount = Math.round((9 * span) / 60);
    const totalCount = Math.round((GALAXY.asteroidSpawnPerHour * span) / 60);
    const baseInterval = span / baseCount;
    const extraInterval = span / (totalCount - baseCount);

    expect(rocks).toHaveLength(totalCount);
    for (const index of [0, 1, Math.floor(baseCount / 2), baseCount - 1]) {
      expect(rocks[index]?.appearsAt).toBeGreaterThanOrEqual(index * baseInterval);
      expect(rocks[index]?.appearsAt).toBeLessThan((index + 1) * baseInterval);
    }
    for (const laneIndex of [0, 1, totalCount - baseCount - 1]) {
      const rock = rocks[baseCount + laneIndex];
      expect(rock?.index).toBe(baseCount + laneIndex);
      expect(rock?.appearsAt).toBeGreaterThanOrEqual(laneIndex * extraInterval);
      expect(rock?.appearsAt).toBeLessThan((laneIndex + 1) * extraInterval);
    }
  });

  /**
   * HOW BUSY THE SKY IS, AND NOTHING WAS HOLDING IT.
   *
   * `asteroidSpawnPerHour` was raised 15% by owner decision and the suite would not
   * have noticed either the change or a revert of it: every other test here is a
   * property of an individual rock, and none of them counts the field.
   *
   * The number that matters to a player is not the spawn RATE, it is how many rocks
   * are in the disc when they open the game. That is the rate times the mean life,
   * and pinning it that way is what makes this a test rather than a restatement of
   * the constant: it fails if the rate moves, if the lifetimes move, or — the case
   * a mean alone would miss — if `generateAsteroids` ever stopped spreading spawns
   * evenly across the season and started clumping them.
   *
   * Sampled across five seeds and most of a season, skipping the ramp at either
   * end where the field is filling and draining.
   */
  it('holds a steady population, and never empties the sky', () => {
    const span = SEASON.days * 24 * 60;
    const meanLife = ((GALAXY.asteroidLifeHoursMin + GALAXY.asteroidLifeHoursMax) / 2) * 60;
    const expected = (GALAXY.asteroidSpawnPerHour / 60) * meanLife;

    const populations: number[] = [];
    for (const seed of [7, 42, 99, 4242, 5150]) {
      const field = generateGalaxy(seed, 50).asteroids;
      for (let t = span * 0.05; t < span * 0.95; t += span / 200) {
        populations.push(field.filter((a) => asteroidActive(a, t)).length);
      }
    }

    const mean = populations.reduce((a, b) => a + b, 0) / populations.length;
    expect(mean).toBeCloseTo(expected, 0);

    /**
     * AND EVERY SAMPLE IS A SKY WORTH LOOKING AT. A disc that empties — even for
     * one stretch of one seed — is the failure a mean cannot show, and it is what
     * clumped spawns would produce.
     */
    expect(Math.min(...populations), 'the disc emptied at some point in the season').toBeGreaterThan(0);
    /**
     * THE BAND IS DERIVED, NOT FROZEN. Steady-state population is spawn rate times
     * mean lifetime, so it moves whenever either does — and both took a transform
     * in Economy v2 (spawn x1.20, life x0.833, which is why the sky is the same
     * size and only the turnover is faster). Generous either side: this guards
     * against a field that has quietly become a swarm or a desert, not against
     * ordinary variance.
     */
    expect(Math.min(...populations)).toBeGreaterThanOrEqual(Math.floor(expected * 0.4));
    expect(Math.max(...populations)).toBeLessThanOrEqual(Math.ceil(expected * 1.9));
  });

  it('spawns a level distribution that adds up', () => {
    const sum = GALAXY.asteroidLevelWeights.reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1, 6);
  });

  it('gives every rock ore, a finite life and an orbit inside the disc', () => {
    for (const a of rocks.slice(0, 200)) {
      expect(a.ore).toBeGreaterThan(0);
      expect(a.expiresAt).toBeGreaterThan(a.appearsAt);
      expect(a.speed).toBeGreaterThanOrEqual(GALAXY.asteroidSpeedMin);
      expect(a.speed).toBeLessThanOrEqual(GALAXY.asteroidSpeedMax);
      expect(a.radius).toBeGreaterThanOrEqual(GALAXY.asteroidOrbitMin);
      expect(a.radius).toBeLessThanOrEqual(GALAXY.asteroidOrbitMax);
      // The revolution time has to agree with the speed it was given, or the
      // rendered motion and the solver would disagree about where it is.
      expect((2 * Math.PI * a.radius) / a.period).toBeCloseTo(a.speed, 6);
    }
  });

  /**
   * THE REASON THE ORBIT CAME BACK. A rock has to be visibly moving — the field
   * looked frozen when speeds were capped so a straight-line intercept could be
   * solved in closed form.
   */
  it('moves fast enough to be seen moving', () => {
    for (const a of rocks.slice(0, 50)) {
      // Rendered world units per minute, at the client's scale of 50 game units
      // to one world unit. A planet is 0.5 to 1.24 world units across.
      expect(a.speed / 50).toBeGreaterThan(1);
    }
  });

  it('stays on its orbit, at the radius it was given', () => {
    const a = rocks[3]!;
    for (const t of [a.appearsAt, a.appearsAt + 7, a.expiresAt - 1]) {
      const at = asteroidPosition(a, t);
      expect(Math.hypot(at.x, at.z)).toBeCloseTo(a.radius, 6);
      expect(at.y).toBe(a.y);
    }
  });

  it('comes back round — one period later it is where it started', () => {
    const a = rocks[5]!;
    const start = asteroidPosition(a, a.appearsAt);
    const later = asteroidPosition(a, a.appearsAt + a.period);
    expect(distance(start, later)).toBeLessThan(1e-6);
  });

  it('is only in the disc between appearing and expiring', () => {
    const a = rocks[5]!;
    expect(asteroidActive(a, a.appearsAt - 1)).toBe(false);
    expect(asteroidActive(a, a.appearsAt)).toBe(true);
    expect(asteroidActive(a, a.expiresAt)).toBe(false);
  });

  it('lifts every craft with a Derrick, and the ship card agrees', () => {
    expect(prospectorSpeed([])).toBe(PROSPECTOR.speed);
    expect(prospectorSpeed(['DERRICK'])).toBe(PROSPECTOR.speed * SATELLITES.DERRICK.speed);
    // The ship card duplicates the live figure so a card has something honest to
    // print. If they drift, one of the two screens is lying.
    expect(HULLS.PROSPECTOR.speed).toBe(PROSPECTOR.speed);
    expect(PROSPECTOR.max).toBe(2);
  });

  /**
   * THE DRILL CHASES ROCKS, NOT WARSHIPS, and that is why it is the fastest thing
   * on the disc. It has to aim ahead of a moving target; a craft slower than the
   * band it hunts can still meet a rock on a later revolution, but the lead angle
   * becomes unreadable — which is what D74 was called in to fix.
   */
  it('outruns the rocks it has to intercept', () => {
    expect(PROSPECTOR.speed).toBeGreaterThan(GALAXY.asteroidSpeedMax);
  });

  /**
   * ONE MEETING, AND NO SCAN CAN STEP OVER IT. D40.
   *
   * `interceptAsteroid` walks forward in fixed steps looking for a sign change, so
   * its correctness depends on the intercept function not wobbling between two
   * samples. It cannot, at any speed above `distanceFactor x asteroidSpeedMax`:
   * the distance term can then move the flight estimate by less than a minute per
   * minute, so `f` falls monotonically and the first crossing is the only one.
   * Below that threshold — which is where the old 62 sat — the guarantee is gone
   * and the solver is relying on the step being fine enough.
   */
  it('deliberately relies on the circular solver below the monotonic-root threshold', () => {
    expect(prospectorSpeed([])).toBeLessThan(
      TRAVEL.distanceFactor * GALAXY.asteroidSpeedMax,
    );
  });

  /**
   * THE PROPERTY THAT MATTERS. A rock FASTER than the craft must still be
   * meetable — that is the entire reason the orbit came back, and the thing a
   * straight-line path could not give.
   *
   * Asserted at a speed no craft in the game has, deliberately. D40 lifted the
   * Prospector clear above the whole speed band, so this can no longer be reached
   * through `prospectorSpeed` — but it is a property of the SOLVER, not of the
   * Prospector, and deleting it would take the safety net out from under any
   * future craft that flies slower than a rock.
   */
  it('can be met even by a craft slower than the rock', () => {
    const rock = rocks[4]!;
    const crawling = rock.speed * 0.4;
    const hit = interceptAsteroid({ x: 0, y: 0, z: 0 }, crawling, rock, rock.appearsAt + 1);
    expect(hit).not.toBeNull();
    expect(distance(asteroidPosition(rock, hit!.meetsAtMinutes), hit!.at)).toBeLessThan(1e-6);
  });

  /**
   * THE LEAD ANGLE THE PLAYER ACTUALLY WATCHES. D40, and the reason the speed moved.
   *
   * A squadron flies to where the rock WILL BE, so the aim point is always ahead of
   * the rock on its orbit — that is D19 working. What broke was HOW FAR ahead: at
   * the old speed the median meeting was more than a full revolution away, which
   * reads as a craft setting off in an unrelated direction. Held to under half a
   * lap here, which is a lead shot rather than a lap of waiting.
   */
  /**
   * THE LAUNCH OVERHEAD IS THE LEAD, and that is why it has its own figure. D48.
   *
   * A fixed delay before a craft covers any ground is a fixed head start for the
   * rock, and no amount of hull speed shrinks it. At `TRAVEL.baseMinutes` the
   * overhead was 68% of a mining flight and a rock covered 660 units during it —
   * 85% of the whole lead. Held far below the warship figure, or the aim point
   * drifts back to somewhere unrelated whatever the drill's speed is.
   */
  it("gives a mining craft a launch overhead far below a warship's", () => {
    expect(PROSPECTOR.launchMinutes).toBeLessThan(TRAVEL.baseMinutes / 4);
    expect(PROSPECTOR.launchMinutes).toBeGreaterThan(0);
  });

  /** And the overhead is a minority of a typical mining flight, not the bulk of it. */
  it('spends most of a mining flight actually travelling', () => {
    const shares: number[] = [];
    for (const planet of spec.slots.slice(0, 8)) {
      for (const rock of rocks.slice(0, 120)) {
        const hit = interceptAsteroid(planet, prospectorSpeed([]), rock, rock.appearsAt + 1);
        if (hit) shares.push(PROSPECTOR.launchMinutes / hit.flightMinutes);
      }
    }
    expect(shares.length).toBeGreaterThan(200);
    expect(median(shares)).toBeLessThan(0.5);
  });

  it('keeps the live reference field below one revolution of lead', () => {
    const laps: number[] = [];
    for (const planet of spec.slots.slice(0, 8)) {
      for (const rock of rocks.slice(0, 120)) {
        const now = rock.appearsAt + 1;
        const hit = interceptAsteroid(planet, prospectorSpeed([]), rock, now);
        if (hit) laps.push(hit.flightMinutes / rock.period);
      }
    }
    expect(laps.length).toBeGreaterThan(200);
    /**
     * A FIFTH OF A LAP AT THE MEDIAN after D74 halved the craft speed.
     *
     * Half a revolution was the band the speed change alone could reach; it still
     * put the aim point most of a planet-width from the rock a player had just
     * tapped, and the owner reported it as the craft going somewhere unrelated.
     * Cutting the launch overhead is what brought it to a lead the eye reads as
     * aiming ahead of a moving target: measured over 3,756 launches on the live
     * seed, the current median is 0.186 revolutions — about 67 degrees.
     */
    expect(median(laps)).toBeLessThan(0.2);

    /**
     * AND THE WORST CASE IS STILL UNDER ONE LAP.
     *
     * A median alone can hide a tail, and the tail is what a player actually
     * complains about — one rock sent somewhere baffling is the memory that
     * sticks. D74 trades the old half-lap ceiling for the requested slower craft;
     * the generated-field sweep below locks the new measured ceiling.
     */
    expect(Math.max(...laps)).toBeLessThan(1);
  });

  /**
   * THE CEILINGS HERE ARE MEASURED, NOT CHOSEN — so a change to the FIELD re-locks
   * them even when it changes nothing about a craft.
   *
   * Raising `asteroidSpawnPerHour` now appends a deterministic lane rather than
   * squeezing the established lane. Existing rocks retain their `appearsAt`; this
   * sweep additionally covers the new indices and therefore still re-measures the
   * field rather than assuming added density cannot expose a reachability edge.
   *
   * The properties that are actually design rules all still hold, and with room:
   * across 500,000 intercepts (two speeds × five seeds × every slot × 200 rocks ×
   * five moments of each rock's life) there are ZERO unreachable rocks, and the
   * worst case is still comfortably inside one revolution — 0.9895 laps plain and
   * 0.6742 with a Derrick.
   *
   * So the Derrick ceiling moves from 0.67 to just above its new measured maximum.
   * The figures are written down so the next reader can tell a re-lock from a
   * regression: anything materially past these is the solver or the field changing
   * shape, not a sample moving.
   */
  it('keeps every generated rock reachable across the five gate seeds', () => {
    for (const [speed, maxFlight, maxLaps] of [
      // measured max: 7.196 min, 0.9895 laps
      [prospectorSpeed([]), 8, 1.01],
      // measured max: 4.847 min, 0.6742 laps
      [prospectorSpeed(['DERRICK']), 5, 0.68],
    ] as const) {
      for (const seed of [42, 7, 99, 4242, 1337]) {
        const generated = generateGalaxy(seed, 50);
        for (const planet of generated.slots) {
          for (const rock of generated.asteroids.slice(0, 200)) {
            for (const when of [0, 0.25, 0.5, 0.75, 0.9]) {
              const now = rock.appearsAt + 1 + (rock.expiresAt - rock.appearsAt - 1) * when;
              const hit = interceptAsteroid(planet, speed, rock, now);
              expect(hit, `seed ${String(seed)} rock ${String(rock.index)} at ${String(when)}`).not.toBeNull();
              expect(hit!.flightMinutes).toBeLessThan(maxFlight);
              expect(hit!.flightMinutes / rock.period).toBeLessThan(maxLaps);
              expect(hit!.flightMinutes * 2).toBeLessThan(maxFlight * 2);
            }
          }
        }
      }
    }
  });

  it('always finds a meeting, and the two are actually in the same place', () => {
    fc.assert(
      fc.property(
        fc.nat({ max: rocks.length - 1 }),
        fc.nat({ max: spec.slots.length - 1 }),
        fc.double({ min: 0, max: 0.9, noNaN: true }),
        fc.boolean(),
        (rockIndex, slotIndex, when, derrick) => {
          const a = rocks[rockIndex]!;
          const planet = spec.slots[slotIndex]!;
          const speed = prospectorSpeed(derrick ? ['DERRICK'] : []);
          const now = a.appearsAt + (a.expiresAt - a.appearsAt) * when;

          const hit = interceptAsteroid(planet, speed, a, now);
          if (!hit) {
            // The only acceptable refusal is a rock with too little life left for
            // any crossing of the disc to reach it.
            const widest = 2 * GALAXY.radius;
            expect(a.expiresAt - now).toBeLessThan(
              PROSPECTOR.launchMinutes + (widest * TRAVEL.distanceFactor) / speed + 1,
            );
            return;
          }

          // The rock is still there when the craft arrives.
          expect(hit.meetsAtMinutes).toBeLessThan(a.expiresAt);
          // A MINING craft's overhead, not a warship's — see `prospectorTravelExact`.
          expect(hit.flightMinutes).toBeGreaterThanOrEqual(PROSPECTOR.launchMinutes);

          /**
           * THE CRAFT ARRIVES WHEN THE ROCK DOES, TO THE SECOND.
           *
           * This used to allow a whole minute of slack, and the slack was hiding a
           * real fault: the solver worked in continuous time while the tolerance
           * compared it against the ROUNDED travel rule, so a craft could be given
           * a flight up to a minute out of step with the meeting it was solving
           * for — and it sat at the intercept point waiting for a rock that had not
           * arrived. Both now read `travelExact`, so they agree by construction.
           */
          const flown = prospectorTravelExact(distance(planet, hit.at), speed);
          expect(Math.abs(flown - hit.flightMinutes)).toBeLessThan(1e-9);

          // And the aim point is where the rock will be, not where it is.
          const truth = asteroidPosition(a, hit.meetsAtMinutes);
          expect(distance(truth, hit.at)).toBeLessThan(1e-6);
        },
      ),
      { numRuns: 400 },
    );
  });

  it('refuses a rock that has already left', () => {
    const a = rocks[0]!;
    expect(interceptAsteroid({ x: 0, y: 0, z: 0 }, 80, a, a.expiresAt + 1)).toBeNull();
  });

  it('refuses a rock with no life left to fly to', () => {
    const a = rocks[0]!;
    expect(interceptAsteroid({ x: 0, y: 0, z: 0 }, 80, a, a.expiresAt - 1)).toBeNull();
  });

  it('refuses a craft with no speed rather than aiming at nothing', () => {
    const a = rocks[0]!;
    expect(interceptAsteroid({ x: 0, y: 0, z: 0 }, 0, a, a.appearsAt + 1)).toBeNull();
  });

  /**
   * THE MEETING IS THE NEAREST ONE, NOT MERELY A VALID ONE.
   *
   * The owner's rule: a craft goes to the closest point at which it and the rock
   * can actually be in the same place, and takes exactly as long as that trip
   * takes. A solver that returned a later crossing would send a craft the long way
   * round an orbit for no reason a player could see.
   */
  it('finds the earliest meeting there is, not a later one', () => {
    const rock = rocks[11]!;
    const speed = prospectorSpeed(['DERRICK']);
    const planet = spec.slots[3]!;
    const now = rock.appearsAt + 2;
    const hit = interceptAsteroid(planet, speed, rock, now);
    expect(hit).not.toBeNull();

    // Sweep every earlier moment: none of them can be reached in time.
    for (let t = 0.05; t < hit!.flightMinutes - 0.05; t += 0.05) {
      const reachable = prospectorTravelExact(
        distance(planet, asteroidPosition(rock, now + t)),
        speed,
      );
      expect(reachable, `t=${t.toFixed(2)} should be unreachable`).toBeGreaterThan(t);
    }
  });

  /** And it never claims a trip shorter than launch and landing themselves cost. */
  it('never returns a flight shorter than the overhead', () => {
    for (const rock of rocks.slice(0, 60)) {
      const hit = interceptAsteroid(spec.slots[0]!, prospectorSpeed(['DERRICK']), rock, rock.appearsAt + 1);
      if (hit) expect(hit.flightMinutes).toBeGreaterThanOrEqual(PROSPECTOR.launchMinutes);
    }
  });
});

describe('ore claims', () => {
  it('never takes more than the hold or more than is there', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 20_000 }),
        fc.integer({ min: 0, max: 6_000 }),
        fc.double({ min: 0, max: 1, noNaN: true }),
        (remaining, hold, share) => {
          const claim = claimOre(remaining, hold, share, 0);
          expect(claim.taken).toBeLessThanOrEqual(hold);
          expect(claim.taken).toBeLessThanOrEqual(remaining);
          expect(claim.remaining).toBe(remaining - claim.taken);
          expect(claim.alloy + claim.crystal).toBe(claim.taken);
          expect(claim.alloy).toBeGreaterThanOrEqual(0);
          expect(claim.crystal).toBeGreaterThanOrEqual(0);
        },
      ),
      { numRuns: 400 },
    );
  });

  /** The race, stated as an invariant: two craft can never take more than exists. */
  it('a queue of craft can never take more ore than the rock had', () => {
    let remaining = 3_400;
    let total = 0;
    for (let i = 0; i < 10; i++) {
      const claim = claimOre(remaining, 900, 0.4, 0);
      total += claim.taken;
      remaining = claim.remaining;
    }
    expect(total).toBe(3_400);
    expect(remaining).toBe(0);
  });
});

/**
 * THE TELESCOPE'S THREE GATES — D18.
 *
 * Each one has to reward levelling, and none may go backwards: a player who pays
 * for L4 and gets a shorter reach than they had at L3 has been robbed by a typo in
 * a table.
 */
describe('telescope gates', () => {
  const levels = [1, 2, 3, 4, 5, 6, 9];

  it('never gives less reach, fewer slots or a longer wait for more level', () => {
    for (let i = 1; i < levels.length; i++) {
      const lo = levels[i - 1]!;
      const hi = levels[i]!;
      expect(telescopeRange(hi)).toBeGreaterThanOrEqual(telescopeRange(lo));
      expect(telescopeSlots(hi)).toBeGreaterThanOrEqual(telescopeSlots(lo));
      expect(telescopeCooldownHours(hi)).toBeLessThanOrEqual(telescopeCooldownHours(lo));
    }
  });

  it('has no telescope at level zero', () => {
    expect(telescopeSlots(0)).toBe(0);
    expect(telescopeRange(0)).toBe(0);
  });

  it('reaches the whole disc at the top of the table', () => {
    const acrossTheGalaxy = GALAXY.radius * 2;
    expect(withinTelescopeRange(5, acrossTheGalaxy)).toBe(true);
    expect(withinTelescopeRange(1, acrossTheGalaxy)).toBe(false);
  });
});

/**
 * D16. The buffer must not out-hold the store, or the works become the safer
 * place to keep everything and the loot table stops mattering.
 */
describe('the collector sits in front of storage, not instead of it', () => {
  it('holds less than the store it feeds', () => {
    // From 1, because `base x L x growth^L` produces nothing at 0 and a planet is
    // never created below it. Checked at Vault 0, the tightest the store ever is.
    for (const level of [1, 3, 7, 12, 18]) {
      expect(collectorCap(alloyRate(level))).toBeLessThan(storageCap(alloyRate(level), 0));
      expect(collectorCap(crystalRate(level))).toBeLessThan(storageCap(crystalRate(level), 0));
    }
  });
});

/**
 * THE SCARCE RESOURCE HAS TO BE SPENDABLE.
 *
 * Crystal is the gate on everything interesting, which only works if a player is
 * ever short of it. It shipped the other way round: income was 33% of alloy
 * income while upgrades charged 22% and the first three levels charged nothing,
 * so crystal filled its twelve-hour store overnight and wasted from then on. The
 * symptom in play is a resource bar that only ever goes up and a second currency
 * nobody thinks about.
 *
 * These hold the shape of the fix rather than the exact numbers, so the curve can
 * be retuned by playtest without the guard becoming a rewrite.
 */
describe('crystal is a constraint, not a souvenir', () => {
  const incomeShare = (level: number): number => crystalRate(level) / alloyRate(level);
  const costShare = (level: number): number => {
    const cost = upgradeCost(level);
    return cost.crystal / cost.alloy;
  };

  it('charges crystal at roughly the rate crystal arrives', () => {
    /**
     * The band, and why it is not centred on 1.0.
     *
     * Spending crystal as fast as it arrives leaves nothing in the store, and a
     * store with nothing in it is nothing to raid — the simulator showed exactly
     * that at parity: raid returns fell under their floor on seed 7 and the
     * informed archetype dropped off the top of the ladder, because selective
     * raiding pays a fixed scouting cost against a shrinking prize.
     *
     * So crystal is charged at about four fifths of the rate it arrives: enough
     * that it is always being spent, little enough that a raid still finds
     * something worth the trip. Below 0.6 it piles up unspendably; above 1.0 it
     * becomes the only bottleneck and alloy stops mattering.
     */
    // From 1: the income SHARE is `crystalRate / alloyRate`, and both are zero at
    // level 0 under `base x L x growth^L`.
    const levels = Array.from({ length: 12 }, (_, i) => Math.max(1, ECON.crystalCostFromLevel) + i);
    for (const level of levels) {
      const ratio = costShare(level) / incomeShare(level);
      expect(ratio, `level ${String(level)} charges ${costShare(level).toFixed(2)}`).toBeGreaterThan(0.6);
      expect(ratio, `level ${String(level)} charges ${costShare(level).toFixed(2)}`).toBeLessThan(1);
    }
  });

  /**
   * The opening is where a dead resource does the most damage: it is the first
   * thing a new player learns about the economy. A store that fills before it has
   * anything to buy teaches them the number does not matter.
   */
  it('finds crystal something to buy before the store can fill', () => {
    const hoursToFirstSink = (() => {
      // Crystal earned by the time the player can afford the first upgrade that
      // charges any, assuming they spend nothing else on the way.
      const level = ECON.crystalCostFromLevel;
      const alloyNeeded = Array.from({ length: level + 1 }, (_, l) => upgradeCost(l).alloy).reduce(
        (a, b) => a + b,
        0,
      );
      return alloyNeeded / alloyRate(1);
    })();
    // At Vault 0 — the tightest the store ever is, and the hardest this passes.
    const hoursToFillStore = storageCap(crystalRate(1), 0) / crystalRate(1);
    expect(hoursToFirstSink).toBeLessThan(hoursToFillStore);
  });
});

/**
 * THE OPENING GRANT IS ARITHMETIC, NOT A ROUND NUMBER. D22.
 *
 * `START` exists to pay for exactly one opening — Core, Refinery and Extractor to
 * L2, and two Wasps — so it must never drift away from what those things cost. Any
 * price change that is not matched here silently either strands a new commander
 * mid-opening or hands them a surplus they did not decide anything to get.
 */
describe('the opening grant', () => {
  /** Core, Refinery and Extractor each go 1 → 2, so three of the same step. */
  const OPENING_UPGRADES = 3;
  const OPENING_WASPS = 2;
  const step = upgradeCost(1);

  it('pays for the whole opening, to the unit', () => {
    expect(START.alloy).toBe(OPENING_UPGRADES * step.alloy + OPENING_WASPS * HULLS.WASP.alloy);
    expect(START.crystal).toBe(
      OPENING_UPGRADES * step.crystal + OPENING_WASPS * HULLS.WASP.crystal,
    );
  });

  /**
   * And no further. The grant is a budget with nothing spare in it — the first
   * real decision in the game is which part of the opening to do first, and a
   * surplus would delete that decision before the player met it.
   */
  it('leaves nothing over for a third Wasp', () => {
    const spent = OPENING_UPGRADES * step.alloy + OPENING_WASPS * HULLS.WASP.alloy;
    expect(START.alloy - spent).toBeLessThan(HULLS.WASP.alloy);
  });

  /**
   * THE OPENING MUST BE ABLE TO END WITH SOMETHING IN THE AIR. D28, D29.
   *
   * Every bay is dark when a planet is created, and a session that cannot fill one
   * breaks Design Law #1 at the exact moment a player is deciding whether to come
   * back. The three upgrades are MANDATORY — the Core ceiling refuses any other
   * first move — and they consume all the crystal, so the cheapest flight in the
   * game (a probe, 50 alloy and 50 crystal) is out of reach at t=0.
   *
   * What the grant does fund is two Wasps, and sending them IS a flight. This
   * asserts the property the opening actually rests on: after the mandatory
   * upgrades, what remains must still buy something that can leave the ground.
   */
  it('still buys a craft after the upgrades the Core ceiling forces', () => {
    const mandatory = OPENING_UPGRADES * step.alloy;
    expect(START.alloy - mandatory).toBeGreaterThanOrEqual(HULLS.WASP.alloy);
    // And crystal really is what binds — worth stating, because it is why a probe
    // is not the answer and why enlarging the grant is the tempting wrong fix.
    expect(START.crystal - OPENING_UPGRADES * step.crystal).toBeLessThan(PROBE.crystal);
  });

  /** No warships arrive with the planet — the first fleet is bought, not given. */
  it('is the only thing a new commander is handed', () => {
    expect(START.alloy).toBeGreaterThan(0);
    expect(START.crystal).toBeGreaterThan(0);
    // A grant that could not even buy the first Core level would strand a player
    // with no move at all, which is the one failure mode worth a guard.
    expect(START.alloy).toBeGreaterThanOrEqual(upgradeCost(1).alloy);
  });
});

/**
 * THE INFORMATION LAYER'S PRICE, RELATIVE TO THE ECONOMY'S. D30.
 *
 * These do not assert that the current ratio is RIGHT — it is measured to be too
 * cheap, and the fix is measured to break the game (see `INSTRUMENT_LEVEL_WORTH`).
 * They assert the two things that must stay true whatever that constant becomes,
 * so the next attempt cannot quietly break either while moving it.
 */
describe('what the information layer costs', () => {
  const tot = (r: { alloy: number; crystal: number }): number => r.alloy + r.crystal;
  const fourAtMax = INSTRUMENT_IDS.reduce((sum, id) => sum + investedInInstrument(id, 5), 0);

  /**
   * THE DOOR STAYS OPEN IN THE FIRST HOUR. D22 priced the first rung so that a
   * brand-new commander can reach the fog layer at all, and every candidate curve
   * must leave `upgradeCost(0)` alone — the moment the entry price moves, the
   * cheapest way to make instruments matter becomes the one that locks beginners
   * out of them.
   */
  it('a first-level instrument stays reachable from the opening grant', () => {
    for (const id of INSTRUMENT_IDS) {
      const first = tot(instrumentCost(id, 0));
      expect(first, `${id} L1 is out of reach at t=0`).toBeLessThanOrEqual(START.alloy);
    }
    // And the cheapest of them by a wide margin, so "look" is never the expensive
    // first move for someone who has just arrived.
    const dearest = Math.max(...INSTRUMENT_IDS.map((id) => tot(instrumentCost(id, 0))));
    expect(dearest).toBeLessThan(tot(upgradeCost(1)) * 3);
  });

  /**
   * THE LADDER MUST STAY A LADDER. Whatever the curve, a higher rung must cost
   * more than a lower one — a flat or inverted ladder would make levelling a
   * telescope free at the top, which is the failure this whole area is about.
   */
  it('every rung costs more than the one below it', () => {
    for (const id of INSTRUMENT_IDS) {
      for (let l = 1; l < 5; l++) {
        expect(tot(instrumentCost(id, l)), `${id} L${String(l)}`).toBeGreaterThan(
          tot(instrumentCost(id, l - 1)),
        );
      }
    }
  });

  /**
   * THE MEASUREMENT THAT MADE D30 A DECISION RATHER THAN A TODO.
   *
   * Owning the whole information layer at maximum currently costs less than one
   * building step at the level a season actually reaches. That is recorded here as
   * a fact rather than asserted as correct: if somebody moves the curve, this is
   * the number that tells them how far they moved it.
   */
  /**
   * COSTS ABOUT ONE LATE BUILDING STEP, WHICH IS A REAL TRADE. Economy v2 raised
   * `INSTRUMENT_LEVEL_WORTH` from 1 to 2 for exactly this: at 1 the whole
   * information layer was bought out by day two, which makes the fog uniform, which
   * makes it decoration.
   *
   * The band is what matters, not the anchor. Below a quarter of a step the layer
   * is free; above two steps it stops competing with production at all and D30's
   * measured failure comes back — dearer instruments push wealth into the OTHER
   * un-losable holding and drop ARR through its floor.
   */
  it('costs about one late building step — a real trade, not a formality', () => {
    const lateStep = tot(upgradeCost(14));
    expect(fourAtMax).toBeLessThan(lateStep * 2);
    expect(fourAtMax).toBeGreaterThan(lateStep / 4);
  });
});

/**
 * INSTRUMENTS ARE PRICED; SATELLITES ARE RATIONED. D22, split by D25.
 *
 * The four ground instruments are gated by price alone — any of them, in any
 * order — so the multiplier is the only thing making a choice between them cost
 * anything. The four orbit satellites are gated by SLOTS, which the Command Core
 * opens at levels 1, 3, 5 and 9, and each is bought once at a flat price.
 */
describe('instrument pricing carries the choice between them', () => {
  it('makes every instrument dearer than a building at the same level', () => {
    for (const id of INSTRUMENT_IDS) {
      for (const level of [0, 1, 3, 5]) {
        const base = upgradeCost(level);
        const kit = instrumentCost(id, level);
        expect(kit.alloy, `${id} L${String(level)}`).toBeGreaterThan(base.alloy);
        expect(kit.crystal, `${id} L${String(level)}`).toBeGreaterThanOrEqual(base.crystal);
      }
    }
  });

  it('makes the Telescope the dearest thing a planet can build', () => {
    for (const id of INSTRUMENT_IDS) {
      if (id === 'TELESCOPE') continue;
      expect(INSTRUMENT_COST_MULT.TELESCOPE).toBeGreaterThan(INSTRUMENT_COST_MULT[id]);
      expect(instrumentCost('TELESCOPE', 2).alloy).toBeGreaterThan(instrumentCost(id, 2).alloy);
    }
  });

  it('never gets cheaper as it goes up', () => {
    for (const id of INSTRUMENT_IDS) {
      for (let level = 0; level < 8; level++) {
        expect(instrumentCost(id, level + 1).alloy).toBeGreaterThan(
          instrumentCost(id, level).alloy,
        );
      }
    }
  });

  /**
   * Wealth reads what was actually spent. Valuing a Telescope as a building would
   * under-report a scout's holdings by two thirds — and the rank floor is computed
   * from Wealth, so that is an attack rule quietly reading the wrong number.
   */
  it('values an installed instrument at what it cost', () => {
    expect(investedInInstrument('TELESCOPE', 0)).toBe(0);
    for (const id of INSTRUMENT_IDS) {
      const sum = [0, 1, 2].reduce((total, level) => {
        const c = instrumentCost(id, level);
        return total + c.alloy + c.crystal;
      }, 0);
      expect(investedInInstrument(id, 3)).toBe(sum);
    }
  });
});

/**
 * THE ORBIT, AND THE SLOTS THAT RATION IT. D25.
 *
 * Four satellites and four slots would be a checklist rather than a choice, and the
 * thing that stops it being one is WHEN the slots arrive: the fourth is a Core 9
 * planet, which is most of a season away. For the part of the game anybody actually
 * plays, a world runs one, two or three of them and which ones is who it is.
 */
describe('satellites in orbit', () => {
  it('opens a slot at Core 1, 3, 5 and 9, and nowhere else', () => {
    const at = (core: number): number => satelliteSlots(core);
    expect(at(0)).toBe(0);
    expect([at(1), at(2)]).toEqual([1, 1]);
    expect([at(3), at(4)]).toEqual([2, 2]);
    expect([at(5), at(6), at(7), at(8)]).toEqual([3, 3, 3, 3]);
    expect([at(9), at(20)]).toEqual([4, 4]);
  });

  it('never takes a slot away as the Core goes up', () => {
    for (let core = 0; core < 30; core += 1) {
      expect(satelliteSlots(core + 1)).toBeGreaterThanOrEqual(satelliteSlots(core));
    }
  });

  /** The set has to fit, or one of the four could never be built by anybody. */
  it('has room for every satellite that exists, eventually', () => {
    expect(satelliteSlots(9)).toBe(SATELLITE_IDS.length);
  });

  /**
   * And not before the late game. If the whole set fitted early there would be no
   * choice at all — which is the failure this decision exists to avoid.
   */
  it('cannot hold the whole set until the Core is deep', () => {
    expect(satelliteSlots(4)).toBeLessThan(SATELLITE_IDS.length);
    expect(satelliteSlots(8)).toBeLessThan(SATELLITE_IDS.length);
  });

  it('charges one flat price, because it is bought once', () => {
    for (const id of SATELLITE_IDS) {
      const price = satelliteCost(id);
      expect(price.alloy).toBeGreaterThan(0);
      expect(price.crystal).toBeGreaterThan(0);
      expect(investedInSatellite(id)).toBe(price.alloy + price.crystal);
    }
  });

  /**
   * A satellite's whole value arrives with the purchase, so its price has to be a
   * real commitment — around what a mid Core level costs, not pocket change.
   */
  it('prices the three multipliers as commitments', () => {
    for (const id of SATELLITE_IDS) {
      if (id === 'UPLINK') continue;
      expect(satelliteCost(id).alloy).toBeGreaterThan(upgradeCost(4).alloy);
    }
  });

  /**
   * THE THREE THAT CHANGE A NUMBER ARE COMMITMENTS. THE UPLINK IS A DOOR.
   *
   * Every satellite used to be asserted expensive here, and D25's Uplink breaks
   * that on purpose. The other three each multiply something a planet already has,
   * so they must cost more than a mid-game building or the slot decision is free.
   * The Uplink multiplies nothing: it is the only way to reach the Telescope and the
   * Radar, and a door priced like a commitment is a fog layer most of the galaxy
   * never opens. It stays reachable inside the opening, and what it really costs is
   * the SLOT.
   */
  it('keeps the Uplink reachable, because it is the door to the fog layer', () => {
    expect(satelliteCost('UPLINK').alloy).toBeLessThan(satelliteCost('FOUNDRY').alloy);
    /**
     * Measured against `PLANET_START`, which is what a commander is actually
     * holding, not against `START`, which is only the arithmetic of the opening
     * sequence. The two differ by `OPENING_BONUS` and the difference is the whole
     * point of that cushion — it is what makes the first real decision affordable.
     */
    expect(satelliteCost('UPLINK').alloy).toBeLessThan(PLANET_START.alloy);
  });

  /** Each one changes a DIFFERENT number. Four bonuses to the same stat is one choice. */
  it('gives every satellite its own job', () => {
    expect(SATELLITES.FOUNDRY.production).toBeGreaterThan(1);
    expect(SATELLITES.DERRICK.hold).toBeGreaterThan(1);
    expect(SATELLITES.DERRICK.speed).toBeGreaterThan(1);
    expect(SATELLITES.BEACON.speed).toBeGreaterThan(1);
    // The Uplink buys a capability rather than a multiplier, so it has no number.
    expect(Object.keys(SATELLITES.UPLINK).sort()).toEqual(['alloy', 'crystal']);
  });
});

/**
 * WRECKAGE. D32.
 *
 * The properties that make debris safe to have at all. The mechanic it is modelled
 * on — OGame's debris field — is the good half of that game's aftermath; the half
 * that emptied its PvP layer is the expedition, and the only thing separating them
 * is that wreckage is made of destroyed ships. These hold that line.
 */
describe('debris fields', () => {
  it('fades to exactly nothing at the end of its life', () => {
    expect(debrisRemaining(1000, 0, 0)).toBe(1000);
    expect(debrisRemaining(1000, 0, DEBRIS.decayMinutes / 2)).toBeCloseTo(500, 5);
    expect(debrisRemaining(1000, 0, DEBRIS.decayMinutes)).toBe(0);
    // And stays at nothing rather than going negative for a late arrival.
    expect(debrisRemaining(1000, 0, DEBRIS.decayMinutes * 3)).toBe(0);
  });

  it('never grows, at any age', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 500_000 }),
        fc.integer({ min: 0, max: 500_000 }),
        fc.nat({ max: 600 }),
        fc.nat({ max: 600 }),
        (initial, taken, a, b) => {
          const [early, late] = a <= b ? [a, b] : [b, a];
          expect(debrisRemaining(initial, taken, late)).toBeLessThanOrEqual(
            debrisRemaining(initial, taken, early) + 1e-6,
          );
        },
      ),
      { numRuns: 300 },
    );
  });

  it('what has already been carried off is never available again', () => {
    const initial = 10_000;
    const half = debrisRemaining(initial, 0, 0) / 2;
    expect(debrisRemaining(initial, half, 0)).toBeCloseTo(half, 5);
    // Taking everything leaves nothing, whatever the clock says.
    expect(debrisRemaining(initial, initial, 0)).toBe(0);
  });

  /**
   * A harvest may never take more than is there, and the split follows what the
   * field is actually made of — a crystal-heavy wreck comes home crystal-heavy.
   */
  it('a claim is bounded by the hold and by what is left', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 100_000 }),
        fc.integer({ min: 0, max: 100_000 }),
        fc.integer({ min: 0, max: 100_000 }),
        (alloy, crystal, hold) => {
          const c = claimDebris(alloy, crystal, 0, hold);
          expect(c.alloy + c.crystal).toBeLessThanOrEqual(hold);
          expect(c.alloy).toBeLessThanOrEqual(alloy);
          expect(c.crystal).toBeLessThanOrEqual(crystal);
          expect(c.alloy).toBeGreaterThanOrEqual(0);
          expect(c.crystal).toBeGreaterThanOrEqual(0);
        },
      ),
      { numRuns: 400 },
    );
  });

  /**
   * THE PROPERTY THAT KEEPS IT FROM BECOMING AN EXPEDITION.
   *
   * A field is a share of what was destroyed, so it can never be worth more than
   * the fleets that died to make it. If this ever inverts, harvesting pays better
   * than the fight that produced it and the loop runs on wreckage instead of war.
   */
  it('is always worth less than the fleets that died for it', () => {
    expect(DEBRIS.share).toBeGreaterThan(0);
    expect(DEBRIS.share).toBeLessThan(1);
  });
});

/**
 * THE TEMPO INVARIANTS. D63.
 *
 * Half the constants in this game are not values, they are RATIOS wearing a
 * value's clothes. A shield's regen is only meaningful against how often a raid
 * can land; a disruption only against what that raid cost to mount; a wreck
 * field's life only against how long it takes to fly there. Every one was chosen
 * against forty-minute flights, and when hull speeds went up 9.46× every one
 * quietly became something else — a shield that never came back, a punishment
 * fifteen times the effort, a "race" nobody had to hurry for.
 *
 * NONE OF IT FAILED A TEST, because the tests asserted the values. These assert
 * the ratios instead. The bands are deliberately wide: a tuning pass should move
 * any of these numbers without a fight, and only a pass that FORGETS one should
 * hear about it.
 */
describe('the tempo — every ratio a hull speed is measured against', () => {
  /**
   * THE ANCHOR IS THE NEIGHBOURHOOD, NOT THE MEAN PAIR, and getting that wrong is
   * what this block exists to stop.
   *
   * Every ratio below used to be counted against the mean distance between two
   * random worlds. That was a fair proxy at fifty planets, where the tenth-nearest
   * world was 510 units away and the mean pair 938. At three hundred and fifty it
   * is not: the tenth-nearest is 510 and the mean pair is 2,275, because the disc
   * did not change and the crowd did. **Nobody raids a random pair.** They raid
   * somebody in their own neighbourhood, chosen off a telescope and inside the
   * tier band, so that is what a "typical leg" has to mean.
   *
   * Defined as the median distance to a commander's 10th-to-25th nearest world, it
   * is also population-independent by construction — the same sentence stays true
   * at 200 seats and at 500.
   */
  const spec = generateGalaxy(1, MULTI_WORLD.capitalSlots);
  const neighbourLegs: number[] = [];
  for (const from of spec.slots) {
    const sorted = spec.slots
      .filter((to) => to.index !== from.index)
      .map((to) => distance(from, to))
      .sort((a, b) => a - b);
    neighbourLegs.push((sorted[9]! + sorted[24]!) / 2);
  }
  neighbourLegs.sort((a, b) => a - b);
  const typicalLeg = neighbourLegs[Math.floor(neighbourLegs.length / 2)]!;

  const allLegs: number[] = [];
  for (let i = 0; i < spec.slots.length; i++) {
    for (let j = i + 1; j < spec.slots.length; j++) {
      allLegs.push(distance(spec.slots[i]!, spec.slots[j]!));
    }
  }
  const furthest = Math.max(...allLegs);

  /** A typical raid, out and back. The unit everything below is counted in. */
  const roundTrip = 2 * travelMinutes(typicalLeg, HULLS.WASP.speed);

  /**
   * THE OWNER'S CHOSEN TEMPO, and the one number the rest of the block hangs on.
   * Long enough that a launch outlives a short session — Design Law #6 — and short
   * enough that six to eight fit in an evening.
   */
  it('lands a neighbourhood raid inside the chosen window', () => {
    expect(roundTrip).toBeGreaterThanOrEqual(10);
    expect(roundTrip).toBeLessThanOrEqual(20);
  });

  it('keeps a heavy raid on a neighbour inside a single sitting', () => {
    const heavy = 2 * travelMinutes(typicalLeg, HULLS.BULWARK.speed);
    expect(heavy).toBeGreaterThan(roundTrip);
    expect(heavy).toBeLessThanOrEqual(45);
  });

  /**
   * ...and a siege on the far rim is a real expedition. That asymmetry is what
   * makes distance mean something: surprise is bought with speed, and reach is
   * bought with hours of being undefended.
   */
  it('makes a cross-disc siege an expedition, not an errand', () => {
    const widest = travelMinutes(furthest, HULLS.BULWARK.speed);
    expect(widest).toBeGreaterThan(45);
    expect(widest).toBeLessThan(150);
  });

  it('leaves the launch overhead a minority of a typical flight', () => {
    // It was 50% the day the speeds landed, which is most of why hull choice
    // stopped reading as a decision about time.
    expect(TRAVEL.baseMinutes / travelMinutes(typicalLeg, HULLS.WASP.speed)).toBeLessThan(0.4);
    expect(TRAVEL.baseMinutes).toBeGreaterThan(0);
  });

  it('keeps hull choice a real difference in arrival time', () => {
    // A ratio, not a gap. At this tempo the gap is minutes, and that is the point.
    expect(
      travelExact(typicalLeg, HULLS.BULWARK.speed) / travelExact(typicalLeg, HULLS.WASP.speed),
    ).toBeGreaterThan(1.3);
  });

  /**
   * THE RADAR STILL SELLS THE WINDOW TO ARM. This is the surviving half of D4's
   * argument against build timers, and Economy v2 owes it a proof: construction is
   * no longer instant, so a warning is only worth anything if a gun fits inside it.
   */
  it('fits a ground gun inside the narrowest radar warning it sells', () => {
    const oneWay = travelExact(typicalLeg, HULLS.WASP.speed);
    const firstRung = INTEL.radarRange.findIndex((r) => r > 0);
    const notice = Math.min(oneWay, (oneWay * INTEL.radarRange[firstRung]!) / typicalLeg);
    const gun = defenceMinutes(HULLS.THORN, 0);
    expect(gun).toBeLessThan(notice / 2);
  });

  it('gives a stripped shield back within a plausible number of raids', () => {
    // At 5% an hour this was a hundred, so the shield sat permanently at zero and
    // the live shard showed it: two planets in thirty-nine had one at all.
    const raidsPerRegen = ((1 / SHIELD.regenPerHour) * 60) / roundTrip;
    expect(raidsPerRegen).toBeLessThan(40);
    expect(raidsPerRegen).toBeGreaterThan(3);
  });

  it('prices disruption against what the raid cost to mount', () => {
    // 15× the day the speeds landed: raiding stopped being rewarding and became
    // disproportionately efficient.
    const perEffort = DISRUPTION.decisiveMinutes / roundTrip;
    expect(perEffort).toBeLessThan(9);
    expect(perEffort).toBeGreaterThan(1);
    expect(DISRUPTION.partialMinutes).toBeLessThan(DISRUPTION.decisiveMinutes);
    expect(DISRUPTION.maxPendingMinutes).toBeGreaterThanOrEqual(DISRUPTION.decisiveMinutes);
  });

  it('keeps a wreck field a race rather than a landmark', () => {
    // Thirty legs of life meant every player in the galaxy could reach it several
    // times over, which is the opposite of a race.
    const legsOfLife = DEBRIS.decayMinutes / travelMinutes(typicalLeg, HULLS.WASP.speed);
    expect(legsOfLife).toBeLessThan(12);
    expect(legsOfLife).toBeGreaterThan(1.5);
  });

  it('keeps re-aiming a telescope a commitment rather than a season', () => {
    // Thirty round trips meant picking one target and watching the galaxy turn
    // over completely before being allowed to look anywhere else.
    const trips = (INTEL.telescopeCooldownHours[5]! * 60) / roundTrip;
    expect(trips).toBeLessThan(20);
    expect(trips).toBeGreaterThan(1);
  });

  /**
   * A probe outruns everything that can be sent AT somebody. The Prospector is
   * faster still and is deliberately not in this list — it is not in `MOBILE_HULLS`
   * either, because it chases rocks rather than commanders.
   */
  it('keeps a probe the fastest thing a commander can send at somebody', () => {
    for (const id of MOBILE_HULLS) {
      expect(PROBE.speed, `a ${HULLS[id].name} outruns a probe`).toBeGreaterThan(HULLS[id].speed);
    }
  });
});
