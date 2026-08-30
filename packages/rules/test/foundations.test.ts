import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  ABUSE,
  ALL_HULLS,
  BUILDING_IDS,
  DEBRIS,
  DISRUPTION,
  GROUND_HULLS,
  INSTRUMENT_IDS,
  HULLS,
  MOBILE_HULLS,
  NO_LOOT,
  SATELLITES,
  SATELLITE_IDS,
  SHIELD,
  canAttack,
  coreTier,
  countOf,
  debrisAlive,
  disruptionMinutes,
  drillHoldMult,
  drillSpeedMult,
  fleetDiff,
  fleetHp,
  fleetSpeed,
  fleetSpeedMult,
  fleetTravelExact,
  fleetTravelMinutes,
  gradeMultiplier,
  hasSatellite,
  hashSeed,
  instrumentEntries,
  interpolatePosition,
  investedInBuilding,
  isSatellite,
  neighboursWithin,
  productionMult,
  seededFrom,
  seeingUnlocked,
  shieldHp,
  upgradeCost,
  type Fleet,
  type Grade,
  type SatelliteSet,
} from '../src/index.js';

/**
 * THE RULES NOTHING WAS CHECKING.
 *
 * `packages/rules` is the single source of truth: the server decides outcomes with
 * it, the simulator measures balance with it, and the client predicts with it. A
 * wrong number here is wrong in all three places at once and looks like three
 * separate bugs.
 *
 * A sweep of every export against every test in the repo found the functions
 * below had no direct assertion anywhere — including `canAttack`, which decides
 * who is allowed to attack whom, and `seeingUnlocked`, which is the one gate in
 * the whole hardware system. They were being exercised only through code that
 * happened to call them, so a change in either could pass the entire suite.
 */

/* ── who may attack whom ────────────────────────────────────── */

/**
 * THE TIER BAND IS THE ONLY THING BETWEEN A NEW COMMANDER AND A DEVELOPED ONE.
 *
 * D14 removed the newcomer grace period and handed the whole casual-farming
 * problem to this function and to the vault floor. `KNOWN RISKS` still calls
 * casual-player farming the open design problem, so the rule that limits it is
 * about as load-bearing as a rule gets.
 *
 * D49 changed WHAT it measures — development tier rather than a Wealth ratio —
 * and the properties below are the ones that must hold whatever it measures:
 * symmetry, the exact boundary, and the order the refusals are reported in.
 */
describe('canAttack', () => {
  const party = (playerId: string, coreLevel: number) => ({ playerId, coreLevel });

  it('refuses to let anyone attack themselves', () => {
    expect(canAttack(party('a', 5), party('a', 5), 0)).toEqual({
      ok: false,
      reason: 'SELF',
    });
  });

  /** D127 retired the band; development is private, so it may not gate a launch. */
  it('allows a fight at any development distance', () => {
    const me = party('a', 2);
    expect(canAttack(me, party('b', 9), 0).ok).toBe(true);
    expect(canAttack(me, party('b', 10), 0).ok).toBe(true);
    expect(canAttack(me, party('b', 45), 0).ok).toBe(true);
  });

  /**
   * PERMISSION IS STILL SYMMETRIC, and D127 kept that by removing the band rather
   * than narrowing it. `rankFloor` protected the small from the large and let
   * anyone punch up without limit — an asymmetry the band fixed and its absence
   * preserves: nobody's development decides whether anybody may fight them.
   */
  it('is symmetric — if they cannot hit you, you cannot hit them', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 30 }),
        fc.integer({ min: 1, max: 30 }),
        (mine, theirs) => {
          expect(canAttack(party('a', mine), party('b', theirs), 0).ok).toBe(
            canAttack(party('b', theirs), party('a', mine), 0).ok,
          );
        },
      ),
      { numRuns: 300 },
    );
  });

  /**
   * DEVELOPMENT NO LONGER GATES A FIGHT AT ALL. D127.
   *
   * The ±2 tier band went with the public tier it was defined on: with development
   * private it could only have become a refusal at the gate, after a fleet was
   * packed — the exact failure D49 replaced a wealth ratio for. What protects a
   * small commander now is that nobody can SEE they are small, plus the bash limit.
   */
  it('lets any two worlds fight, however far apart their development', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 60 }), fc.integer({ min: 1, max: 60 }), (a, b) => {
        expect(canAttack(party('a', a), party('b', b), 0).ok).toBe(true);
      }),
      { numRuns: 400 },
    );
  });

  it('refuses once the bash limit is reached, and allows the hit before it', () => {
    const a = party('a', 5);
    const b = party('b', 5);
    expect(canAttack(a, b, ABUSE.bashLimit - 1).ok).toBe(true);
    expect(canAttack(a, b, ABUSE.bashLimit)).toMatchObject({ reason: 'BASH_LIMIT' });
    expect(canAttack(a, b, ABUSE.bashLimit + 5)).toMatchObject({ reason: 'BASH_LIMIT' });
  });

  /**
   * TWO REASONS REMAIN, AND SELF COMES FIRST. Order matters because the reason is
   * shown to the player: being told the wrong one sends them to find a different
   * target and get refused again.
   */
  it('reports self before the bash limit when both apply', () => {
    expect(canAttack(party('a', 30), party('a', 30), ABUSE.bashLimit)).toMatchObject({
      reason: 'SELF',
    });
  });

  /**
   * WHAT IS LEFT PROTECTING A NEW COMMANDER, STATED AS A TEST. D127.
   *
   * Not the band any more — the bash limit, and the fact that a raider cannot see
   * who is small. This holds the first half; the second is enforced by the galaxy
   * payload and tested there.
   */
  it('still lets a finished commander reach a fresh one, and still caps the farming', () => {
    const fresh = party('b', 1);
    const finished = party('a', 30);
    expect(canAttack(finished, fresh, 0).ok).toBe(true);
    expect(canAttack(finished, fresh, ABUSE.bashLimit).ok).toBe(false);
    expect(canAttack(finished, fresh, ABUSE.bashLimit).reason).toBe('BASH_LIMIT');
  });

  /** Core level is never zero in play, but the tier floor must not be either. */
  it('floors the tier at 1, so a level of zero is still a real tier', () => {
    expect(coreTier(0)).toBe(1);
    expect(coreTier(1)).toBe(1);
  });
});

/* ── what a fight is worth ──────────────────────────────────── */

describe('loot grading', () => {
  it('pays nothing for a repelled attack', () => {
    expect(gradeMultiplier('REPELLED')).toBe(0);
  });

  it('pays strictly more for a decisive win than a partial one', () => {
    expect(gradeMultiplier('DECISIVE')).toBeGreaterThan(gradeMultiplier('PARTIAL'));
    expect(gradeMultiplier('PARTIAL')).toBeGreaterThan(0);
  });

  /** Never more than everything: a multiplier above 1 would invent resources. */
  it('never awards more than the pile it is applied to', () => {
    for (const g of ['DECISIVE', 'PARTIAL', 'REPELLED'] as Grade[]) {
      expect(gradeMultiplier(g)).toBeLessThanOrEqual(1);
      expect(gradeMultiplier(g)).toBeGreaterThanOrEqual(0);
    }
  });

  /** `NO_LOOT` is the shared empty result, and it must actually be empty. */
  it('has an empty result that is empty in every pile', () => {
    expect(NO_LOOT.alloy + NO_LOOT.crystal).toBe(0);
    expect(NO_LOOT.fromStock.alloy + NO_LOOT.fromStock.crystal).toBe(0);
    expect(NO_LOOT.fromBuffer.alloy + NO_LOOT.fromBuffer.crystal).toBe(0);
  });
});

describe('disruption', () => {
  it('lasts longest after a decisive loss and not at all after a repel', () => {
    expect(disruptionMinutes('DECISIVE')).toBe(DISRUPTION.decisiveMinutes);
    expect(disruptionMinutes('PARTIAL')).toBe(DISRUPTION.partialMinutes);
    expect(disruptionMinutes('REPELLED')).toBe(0);
    expect(DISRUPTION.maxPendingMinutes).toBeGreaterThanOrEqual(DISRUPTION.decisiveMinutes);
    expect(disruptionMinutes('DECISIVE')).toBeGreaterThan(disruptionMinutes('PARTIAL'));
  });
});

/* ── hardware ───────────────────────────────────────────────── */

/**
 * D25. Four satellites, each with exactly one job, and `hasSatellite` is the only
 * thing that decides whether that job happens. Each of these multipliers reads a
 * DIFFERENT satellite, and a copy-paste between them is silent — a Derrick that
 * quietly sped up war fleets would look like a balance drift, not a bug.
 */
describe('what each satellite does, and only that', () => {
  const none: SatelliteSet = [];
  const all: SatelliteSet = ['FOUNDRY', 'UPLINK', 'DERRICK', 'BEACON'];

  it('does nothing at all with an empty orbit', () => {
    expect(productionMult(none)).toBe(1);
    expect(drillHoldMult(none)).toBe(1);
    expect(drillSpeedMult(none)).toBe(1);
    expect(fleetSpeedMult(none)).toBe(1);
    expect(seeingUnlocked(none)).toBe(false);
  });

  it('reads exactly the satellite it belongs to', () => {
    // The FOUNDRY raises production and touches nothing else.
    expect(productionMult(['FOUNDRY'])).toBe(SATELLITES.FOUNDRY.production);
    expect(drillHoldMult(['FOUNDRY'])).toBe(1);
    expect(fleetSpeedMult(['FOUNDRY'])).toBe(1);
    expect(seeingUnlocked(['FOUNDRY'])).toBe(false);

    // The DERRICK services mining craft — hold AND speed — and nothing else.
    expect(drillHoldMult(['DERRICK'])).toBe(SATELLITES.DERRICK.hold);
    expect(drillSpeedMult(['DERRICK'])).toBe(SATELLITES.DERRICK.speed);
    expect(productionMult(['DERRICK'])).toBe(1);
    expect(fleetSpeedMult(['DERRICK'])).toBe(1);

    // The BEACON speeds WAR fleets, and must not speed a Prospector.
    expect(fleetSpeedMult(['BEACON'])).toBe(SATELLITES.BEACON.speed);
    expect(drillSpeedMult(['BEACON'])).toBe(1);
    expect(productionMult(['BEACON'])).toBe(1);

    // The UPLINK is a door and nothing more: it changes no number anywhere.
    expect(seeingUnlocked(['UPLINK'])).toBe(true);
    expect(productionMult(['UPLINK'])).toBe(1);
    expect(drillHoldMult(['UPLINK'])).toBe(1);
    expect(drillSpeedMult(['UPLINK'])).toBe(1);
    expect(fleetSpeedMult(['UPLINK'])).toBe(1);
  });

  it('stacks nothing — a full orbit is each effect once', () => {
    expect(productionMult(all)).toBe(SATELLITES.FOUNDRY.production);
    expect(drillHoldMult(all)).toBe(SATELLITES.DERRICK.hold);
    expect(fleetSpeedMult(all)).toBe(SATELLITES.BEACON.speed);
    expect(seeingUnlocked(all)).toBe(true);
  });

  it('recognises membership and nothing else', () => {
    expect(hasSatellite(['UPLINK'], 'UPLINK')).toBe(true);
    expect(hasSatellite(['UPLINK'], 'BEACON')).toBe(false);
    expect(hasSatellite([], 'UPLINK')).toBe(false);
  });

  /**
   * THE TWO ID SPACES ARE DISJOINT, AND `isSatellite` IS WHAT SORTS THEM.
   *
   * D25 split hardware into ground instruments with levels and orbit satellites
   * without, and both still share one database table told apart by id. Anything
   * holding "a piece of hardware the player wants" asks here which one it got — so
   * an id that answered wrong would install a Telescope into an orbit slot.
   *
   * Asserted over EVERY id in both lists rather than a couple of samples: a new
   * satellite added to the enum and missed by `SATELLITE_IDS` is exactly the shape
   * of mistake this catches, and one sample would not.
   */
  it('sorts every id into exactly the right space', () => {
    for (const id of SATELLITE_IDS) expect(isSatellite(id), id).toBe(true);
    for (const id of INSTRUMENT_IDS) expect(isSatellite(id), id).toBe(false);
    // And the spaces do not overlap, which is what makes the question answerable.
    const sats = new Set<string>(SATELLITE_IDS);
    for (const id of INSTRUMENT_IDS) expect(sats.has(id), `${id} is on both lists`).toBe(false);
  });
});

/* ── the shield curve ───────────────────────────────────────── */

describe('shieldHp', () => {
  it('is nothing without an Aegis, at zero and below', () => {
    expect(shieldHp(0)).toBe(0);
    expect(shieldHp(-1)).toBe(0);
  });

  it('starts at the base and grows by the multiplier', () => {
    expect(shieldHp(1)).toBe(Math.round(SHIELD.base * SHIELD.mult));
    expect(shieldHp(2)).toBe(Math.round(SHIELD.base * SHIELD.mult ** 2));
  });

  it('is strictly increasing, so a level is never wasted', () => {
    for (let l = 1; l < 12; l++) {
      expect(shieldHp(l + 1)).toBeGreaterThan(shieldHp(l));
    }
  });

  /**
   * D22, and the reason `SHIELD.base` is 40 rather than 700: a first-level Aegis
   * must not absorb a raiding fleet. Two thirds of the galaxy holds a shield now
   * that satellites are unrationed, so a wall at level one ends raiding outright.
   */
  it('a first-level shield is worth well under a small raiding fleet', () => {
    const tenWasps = 10 * HULLS.WASP.hp;
    expect(shieldHp(1)).toBeLessThan(tenWasps);
  });
});

/* ── fleets ─────────────────────────────────────────────────── */

describe('fleet arithmetic', () => {
  it('counts a hull that is absent as zero rather than undefined', () => {
    expect(countOf({}, 'WASP')).toBe(0);
    expect(countOf({ WASP: 3 }, 'LANCE')).toBe(0);
    expect(countOf({ WASP: 3 }, 'WASP')).toBe(3);
  });

  it('adds hit points across every hull, ground included', () => {
    expect(fleetHp({})).toBe(0);
    expect(fleetHp({ WASP: 2 })).toBe(2 * HULLS.WASP.hp);
    expect(fleetHp({ WASP: 2, BASTION: 1 })).toBe(2 * HULLS.WASP.hp + HULLS.BASTION.hp);
  });

  /**
   * A FLEET TRAVELS AT ITS SLOWEST SHIP. If this ever returned an average, every
   * raid with a Hauler in it would arrive before its cargo and the exposure figure
   * the launch sheet promises would be a lie.
   */
  it('travels at the speed of its slowest mobile hull', () => {
    expect(fleetSpeed({ WASP: 1 })).toBe(HULLS.WASP.speed);
    const mixed = fleetSpeed({ WASP: 1, HAULER: 1 });
    expect(mixed).toBe(Math.min(HULLS.WASP.speed, HULLS.HAULER.speed));
    expect(mixed).toBeLessThanOrEqual(HULLS.WASP.speed);
  });

  it('cannot travel at all with nothing in it, or with only ground units', () => {
    expect(fleetSpeed({})).toBe(0);
    for (const id of GROUND_HULLS) expect(fleetSpeed({ [id]: 5 })).toBe(0);
  });

  /**
   * A hull present at zero must not pin the speed. `fleetEntries` skips zeroes and
   * so must this — otherwise cancelling a Hauler out of a launch would leave the
   * fleet crawling at Hauler speed.
   */
  it('ignores a hull listed at zero', () => {
    expect(fleetSpeed({ WASP: 2, HAULER: 0 })).toBe(HULLS.WASP.speed);
  });

  it('keeps the exact fleet instant separate from the rounded display quote', () => {
    const exact = fleetTravelExact(500, { WASP: 2 });
    expect(exact).not.toBe(Math.ceil(exact));
    expect(fleetTravelMinutes(500, { WASP: 2 })).toBe(Math.ceil(exact));
  });

  it('reports losses as before minus after, never a negative', () => {
    expect(fleetDiff({ WASP: 10 }, { WASP: 4 })).toEqual({ WASP: 6 });
    expect(fleetDiff({ WASP: 10 }, {})).toEqual({ WASP: 10 });
    // Survivors cannot exceed the starting fleet, but if they somehow did, a
    // negative loss would credit the attacker with ships that never existed.
    expect(fleetDiff({ WASP: 4 }, { WASP: 10 })).toEqual({});
    expect(fleetDiff({}, {})).toEqual({});
  });

  it('never reports a loss for a hull that was not there', () => {
    fc.assert(
      fc.property(fc.nat({ max: 50 }), fc.nat({ max: 50 }), (before, after) => {
        const d = fleetDiff({ WASP: before }, { WASP: after });
        expect(d.LANCE).toBeUndefined();
        expect(d.WASP ?? 0).toBeLessThanOrEqual(before);
      }),
      { numRuns: 200 },
    );
  });

  /**
   * THE HULL LISTS PARTITION THE GAME, and nothing else checks it.
   *
   * `MOBILE_HULLS` and `GROUND_HULLS` are both hand-maintained against `HULLS`.
   * D27 added a ground hull, and a list that misses a hull is silent: a Thorn left
   * out of `GROUND_HULLS` would earn no salvage and leave wreckage it should not.
   */
  it('every hull is mobile, ground, or the Prospector — exactly one', () => {
    const mobile = new Set<string>(MOBILE_HULLS);
    const ground = new Set<string>(GROUND_HULLS);
    for (const id of ALL_HULLS) {
      const lists = [mobile.has(id), ground.has(id), id === 'PROSPECTOR'].filter(Boolean).length;
      expect(lists, `${id} is on ${String(lists)} lists, not one`).toBe(1);
    }
    expect(mobile.size + ground.size + 1).toBe(ALL_HULLS.length);
  });

  it('agrees with each hull\'s own ground flag', () => {
    for (const id of ALL_HULLS) {
      expect(GROUND_HULLS.includes(id as never), id).toBe(HULLS[id].ground);
    }
    for (const id of MOBILE_HULLS) expect(HULLS[id].ground).toBe(false);
  });

  /** A ground hull that could move would leave the planet it exists to defend. */
  it('gives every ground hull a speed of zero, and every mobile one a real speed', () => {
    for (const id of GROUND_HULLS) expect(HULLS[id].speed).toBe(0);
    for (const id of MOBILE_HULLS) expect(HULLS[id].speed).toBeGreaterThan(0);
  });
});

/* ── the instrument kit ─────────────────────────────────────── */

describe('instrumentEntries', () => {
  it('skips what is not owned, including a level explicitly at zero', () => {
    expect(instrumentEntries({})).toEqual([]);
    expect(instrumentEntries({ TELESCOPE: 0 })).toEqual([]);
    expect(instrumentEntries({ TELESCOPE: 2 })).toEqual([['TELESCOPE', 2]]);
  });

  it('is ordered by the canonical list, not by insertion', () => {
    const a = instrumentEntries({ VEIL: 1, TELESCOPE: 1 }).map(([id]) => id);
    const b = instrumentEntries({ TELESCOPE: 1, VEIL: 1 }).map(([id]) => id);
    expect(a).toEqual(b);
  });
});

/* ── what a building has cost so far ────────────────────────── */

describe('investedInBuilding', () => {
  it('is nothing at level zero', () => {
    expect(investedInBuilding(0)).toBe(0);
  });

  /**
   * The sum of every rung climbed, NOT the price of the current one. It feeds
   * `wealth()`, which sets the rank floor — so an off-by-one here silently changes
   * who is allowed to attack whom.
   */
  it('is the sum of every level paid for', () => {
    for (const level of [1, 2, 5, 9]) {
      let expected = 0;
      for (let l = 0; l < level; l++) {
        const c = upgradeCost(l);
        expected += c.alloy + c.crystal;
      }
      expect(investedInBuilding(level)).toBe(expected);
    }
  });

  it('grows with every level', () => {
    for (let l = 0; l < 12; l++) {
      expect(investedInBuilding(l + 1)).toBeGreaterThan(investedInBuilding(l));
    }
  });

  it('names every building exactly once', () => {
    expect(new Set(BUILDING_IDS).size).toBe(BUILDING_IDS.length);
  });
});

/* ── where a craft is right now ─────────────────────────────── */

/**
 * A5: nothing is stored that a formula and a clock can derive. Every moving object
 * on the disc is drawn from this, on the client, every frame. A craft that
 * overshoots its target or snaps backwards is this function.
 */
describe('interpolatePosition', () => {
  const a = { x: 0, y: 0, z: 0 };
  const b = { x: 100, y: 40, z: -20 };

  it('is at the origin at departure and the target on arrival', () => {
    expect(interpolatePosition(a, b, 0, 10, 0)).toEqual(a);
    expect(interpolatePosition(a, b, 0, 10, 10)).toEqual(b);
  });

  it('is exactly halfway at the midpoint', () => {
    expect(interpolatePosition(a, b, 0, 10, 5)).toEqual({ x: 50, y: 20, z: -10 });
  });

  /** A clock that has run past arrival, or a stale client, must not overshoot. */
  it('clamps at both ends rather than running past', () => {
    expect(interpolatePosition(a, b, 0, 10, -50)).toEqual(a);
    expect(interpolatePosition(a, b, 0, 10, 999)).toEqual(b);
  });

  /**
   * A zero-length flight resolves to ARRIVED, not to a division by zero. It
   * happens: two planets can be generated close enough that a fast fleet's
   * rounded travel time is a single tick.
   */
  it('resolves an instant flight to the target instead of dividing by zero', () => {
    expect(interpolatePosition(a, b, 5, 5, 5)).toEqual(b);
    expect(interpolatePosition(a, b, 5, 4, 5)).toEqual(b);
  });

  it('never leaves the segment between the two ends', () => {
    fc.assert(
      fc.property(fc.integer({ min: -1000, max: 5000 }), (now) => {
        const p = interpolatePosition(a, b, 0, 1000, now);
        expect(p.x).toBeGreaterThanOrEqual(0);
        expect(p.x).toBeLessThanOrEqual(100);
      }),
      { numRuns: 300 },
    );
  });
});

/* ── seeded randomness ──────────────────────────────────────── */

/**
 * THE EASIEST WAY TO SHIP A BROKEN INFORMATION GAME, per `CLAUDE.md`.
 *
 * Telescope reads are seeded per `(watchId, timeWindow)`. If the seeding were not
 * stable, a player would defeat the entire fog layer by pulling to refresh; if it
 * did not vary with the window, a reading would never change at all.
 */
describe('seeded randomness', () => {
  it('gives the same seed for the same parts, every time', () => {
    expect(hashSeed('watch-1', 42)).toBe(hashSeed('watch-1', 42));
    expect(hashSeed('a', 'b', 'c')).toBe(hashSeed('a', 'b', 'c'));
  });

  it('gives a different seed when any part changes', () => {
    expect(hashSeed('watch-1', 42)).not.toBe(hashSeed('watch-1', 43));
    expect(hashSeed('watch-1', 42)).not.toBe(hashSeed('watch-2', 42));
  });

  /**
   * The parts are hashed as a SEQUENCE, not concatenated. Without the per-part
   * mix, `('ab','c')` and `('a','bc')` would collide — and window boundaries are
   * exactly where adjacent ids and numbers meet.
   */
  it('does not collide on parts that concatenate to the same string', () => {
    expect(hashSeed('ab', 'c')).not.toBe(hashSeed('a', 'bc'));
    expect(hashSeed('1', '23')).not.toBe(hashSeed('12', '3'));
  });

  it('is always a usable 32-bit seed', () => {
    fc.assert(
      fc.property(fc.string(), fc.integer(), (s, n) => {
        const h = hashSeed(s, n);
        expect(Number.isInteger(h)).toBe(true);
        expect(h).toBeGreaterThanOrEqual(0);
        expect(h).toBeLessThanOrEqual(0xffffffff);
      }),
      { numRuns: 300 },
    );
  });

  it('replays an identical stream from identical parts', () => {
    const draw = (): number[] => {
      const rng = seededFrom('mission-7', 3);
      return [rng(), rng(), rng(), rng()];
    };
    expect(draw()).toEqual(draw());
  });

  it('produces a different stream from different parts', () => {
    const a = seededFrom('mission-7', 3);
    const b = seededFrom('mission-7', 4);
    expect([a(), a(), a()]).not.toEqual([b(), b(), b()]);
  });

  it('stays inside [0, 1)', () => {
    const rng = seededFrom('spread', 1);
    for (let i = 0; i < 2000; i++) {
      const v = rng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

/* ── the neighbourhood ──────────────────────────────────────── */

describe('neighboursWithin', () => {
  const slot = (index: number, x: number) => ({ index, x, y: 0, z: 0 });
  const slots = [slot(0, 0), slot(1, 10), slot(2, 25), slot(3, 100)];

  it('never returns the planet itself', () => {
    expect(neighboursWithin(slots[0]!, slots, 1000).map((s) => s.index)).not.toContain(0);
  });

  it('returns nearest first', () => {
    expect(neighboursWithin(slots[0]!, slots, 1000).map((s) => s.index)).toEqual([1, 2, 3]);
  });

  it('includes a neighbour exactly at the limit and excludes the next one', () => {
    expect(neighboursWithin(slots[0]!, slots, 25).map((s) => s.index)).toEqual([1, 2]);
    expect(neighboursWithin(slots[0]!, slots, 24.9).map((s) => s.index)).toEqual([1]);
  });

  it('returns nothing when nobody is in reach', () => {
    expect(neighboursWithin(slots[0]!, slots, 0)).toEqual([]);
    expect(neighboursWithin(slots[0]!, [slots[0]!], 1000)).toEqual([]);
  });
});

/* ── is there anything left of it ───────────────────────────── */

/**
 * HOW MUCH A BATTLE LEAVES BEHIND. D32, re-cut by the owner.
 *
 * A quarter of everything destroyed was too much: fields came out worth more than
 * the raid that made them, which is the expedition failure the whole mechanic is
 * built to avoid. Thirty per cent of the value of every non-ground hull destroyed
 * on BOTH sides.
 */
describe('what a battle leaves behind', () => {
  /**
   * 0.30, which is OGame's own default and triple what this game shipped. A
   * partly-refunded loss is a loss people will take, and that is what makes
   * commanders throw fleets at each other in the last days instead of hoarding.
   */
  it('returns a documented share of what was destroyed', () => {
    expect(DEBRIS.share).toBeCloseTo(0.30, 6);
  });

  /**
   * THE PROPERTY THAT KEEPS IT FROM BECOMING AN EXPEDITION, restated as an
   * inequality rather than a number so it survives the next re-cut: a field can
   * never be worth more than the fleets that died to make it, or the loop starts
   * running on salvage instead of on war.
   */
  it('is always worth strictly less than the fleets that died for it', () => {
    expect(DEBRIS.share).toBeGreaterThan(0);
    expect(DEBRIS.share).toBeLessThan(1);
  });

  /** A field still has to be worth flying at, or the mechanic is decoration. */
  it('leaves something worth a trip out of a real battle', () => {
    // Twenty Wasps and six Bastions is an ordinary raid; the Bastions are ground
    // and contribute nothing, which is exactly why the minimum matters.
    const destroyed = 20 * (HULLS.WASP.alloy + HULLS.WASP.crystal);
    expect(destroyed * DEBRIS.share).toBeGreaterThan(DEBRIS.minimum);
  });
});

describe('debrisAlive', () => {
  it('is true for a fresh field and false for an empty one', () => {
    expect(debrisAlive(1000, 500, 0, 0, 0, 0, 0)).toBe(true);
    expect(debrisAlive(0, 0, 0, 0, 0, 0, 0)).toBe(false);
  });

  it('is false once everything has been carried off', () => {
    expect(debrisAlive(1000, 500, 0, 1000, 500, 0, 0)).toBe(false);
  });

  /** Agrees with the launch check: a field worth under a unit is not worth a trip. */
  it('is false for a residue too small to be worth flying to', () => {
    expect(debrisAlive(1000, 0, 0, 999.6, 0, 0, 0)).toBe(false);
    expect(debrisAlive(1000, 0, 0, 990, 0, 0, 0)).toBe(true);
  });

  it('is false once the field has outlived its decay', () => {
    expect(debrisAlive(100_000, 50_000, 0, 0, 0, 0, 10_000)).toBe(false);
  });
});

/* ── one shared shape check ─────────────────────────────────── */

describe('the fleet type', () => {
  /**
   * Every helper here takes a `Fleet` and must tolerate the same two degenerate
   * shapes: empty, and a hull explicitly at zero. They arrive from real payloads —
   * a launch form with every field cleared sends the second.
   */
  it('handles an empty fleet and an all-zero fleet identically', () => {
    const empty: Fleet = {};
    const zeroed: Fleet = Object.fromEntries(ALL_HULLS.map((id) => [id, 0]));
    expect(fleetHp(zeroed)).toBe(fleetHp(empty));
    expect(fleetSpeed(zeroed)).toBe(fleetSpeed(empty));
    expect(fleetDiff(zeroed, empty)).toEqual(fleetDiff(empty, empty));
  });
});
