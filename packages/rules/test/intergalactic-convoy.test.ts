import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  GALAXY,
  GALAXY_EVENTS,
  HULLS,
  INTERGALACTIC_CONVOY,
  MOBILE_HULLS,
  TRAVEL,
  alloyRate,
  combatValue,
  convoyEngagementEndsAt,
  convoyFormationSlots,
  convoyProductionCap,
  crystalRate,
  deuteriumRate,
  fleetCargo,
  fleetPace,
  fleetSpeedMult,
  generateGalaxy,
  intergalacticConvoyPosition,
  intergalacticConvoyQuoteIsFresh,
  intergalacticConvoyRewardPool,
  intergalacticConvoyReturnProfile,
  intergalacticConvoySpec,
  interceptIntergalacticConvoy,
  interceptLinearTransit,
  isConvoyEngaging,
  missionFuel,
  missionFuelForDistances,
  productionMult,
  quoteIntergalacticConvoyReward,
  rollIntergalacticConvoyAward,
  seededFrom,
  type Fleet,
  type IntergalacticConvoyEffect,
  type Rng,
  type Vec3,
} from '../src/index.js';

const effect: IntergalacticConvoyEffect =
  GALAXY_EVENTS.definitions.INTERGALACTIC_CONVOY.windows[0]?.effect
  ?? (() => { throw new Error('missing convoy definition'); })();

const sequenceRng = (...values: number[]): Rng => {
  let index = 0;
  return () => values[index++] ?? 0;
};

const expectFiniteVec = (value: Vec3): void => {
  expect(Number.isFinite(value.x)).toBe(true);
  expect(Number.isFinite(value.y)).toBe(true);
  expect(Number.isFinite(value.z)).toBe(true);
};

describe('the Intergalactic Convoy route', () => {
  const occurrence = {
    sequence: 7,
    startsAtMinute: 1_000,
    endsAtMinute: 1_000 + INTERGALACTIC_CONVOY.durationMinutes,
    effect,
  };

  it('crosses antipodal bounds in two hours and its centre at minute sixty', () => {
    const spec = intergalacticConvoySpec(occurrence, sequenceRng(0, 0.5));
    expect(spec.from).toEqual({ x: -GALAXY.radius, y: -0, z: -0 });
    expect(spec.to).toEqual({ x: GALAXY.radius, y: 0, z: 0 });
    expect(spec.speed).toBe((2 * GALAXY.radius) / INTERGALACTIC_CONVOY.durationMinutes);
    expect(intergalacticConvoyPosition(spec, occurrence.startsAtMinute)).toEqual(spec.from);
    expect(intergalacticConvoyPosition(spec, occurrence.startsAtMinute + 60))
      .toEqual({ x: 0, y: 0, z: 0 });
    expect(intergalacticConvoyPosition(spec, occurrence.endsAtMinute)).toEqual(spec.to);
  });

  it('freezes the route-v1 draw order in a golden fixture', () => {
    const spec = intergalacticConvoySpec(occurrence, seededFrom('convoy-route-golden'));
    expect(spec.from.x).toBeCloseTo(-1_665.6306719810273, 10);
    expect(spec.from.y).toBeCloseTo(279.33606649129274, 10);
    expect(spec.from.z).toBeCloseTo(1_071.282328106463, 10);
    expect(spec.to).toEqual({ x: -spec.from.x, y: -spec.from.y, z: -spec.from.z });
  });

  it('draws isotropic unit directions without leaving the galaxy sphere', () => {
    const rng = seededFrom('convoy-isotropy');
    const sample = Array.from({ length: 50_000 }, (_, sequence) =>
      intergalacticConvoySpec({ ...occurrence, sequence }, rng).direction);
    const mean = sample.reduce((sum, point) => ({
      x: sum.x + point.x / sample.length,
      y: sum.y + point.y / sample.length,
      z: sum.z + point.z / sample.length,
    }), { x: 0, y: 0, z: 0 });
    const meanZSquared = sample.reduce((sum, point) => sum + point.z ** 2, 0) / sample.length;
    expect(Math.abs(mean.x)).toBeLessThan(0.01);
    expect(Math.abs(mean.y)).toBeLessThan(0.01);
    expect(Math.abs(mean.z)).toBeLessThan(0.01);
    expect(meanZSquared).toBeCloseTo(1 / 3, 2);
    for (const direction of sample) {
      expectFiniteVec(direction);
      expect(Math.hypot(direction.x, direction.y, direction.z)).toBeCloseTo(1, 12);
    }
  });

  it('fails closed for a corrupt version, duration or random draw', () => {
    expect(() => intergalacticConvoySpec({
      ...occurrence,
      effect: { ...effect, routeVersion: 2 as 1 },
    }, sequenceRng(0, 0))).toThrow(/route version/i);
    expect(() => intergalacticConvoySpec({
      ...occurrence,
      endsAtMinute: occurrence.endsAtMinute - 1,
    }, sequenceRng(0, 0))).toThrow(/duration/i);
    expect(() => intergalacticConvoySpec(occurrence, sequenceRng(Number.NaN, 0)))
      .toThrow(/random/i);
  });
});

describe('the authored convoy formation', () => {
  it('is a centred double row containing every mobile hull exactly once, low tier first', () => {
    const slots = convoyFormationSlots(1);
    expect(slots).toHaveLength(22);
    expect(slots.map(({ rank, hull }) => [rank, hull])).toEqual([
      [1, 'DART'], [1, 'PIKE'], [2, 'RAMPART'], [2, 'WARDEN'],
      [3, 'COURIER'], [3, 'VIPER'], [4, 'TALON'], [4, 'STRONGHOLD'],
      [5, 'SENTINEL'], [5, 'WAYFARER'], [6, 'TEMPEST'], [6, 'BALLISTA'],
      [7, 'LEVIATHAN'], [7, 'PRAETORIAN'], [8, 'ATLAS'], [8, 'NULLIFIER'],
      [9, 'GARBAGE_COLLECTOR'], [9, 'CATACLYSM'], [10, 'CORSAIR'], [10, 'CITADEL'],
      [11, 'PALADIN'], [11, 'ARGOSY'],
    ]);
    expect(new Set(slots.map(({ hull }) => hull)).size).toBe(MOBILE_HULLS.length);
    expect([...new Set(slots.map(({ hull }) => hull))].sort()).toEqual([...MOBILE_HULLS].sort());
    expect(slots[0]?.localPosition.z).toBeGreaterThan(slots[20]?.localPosition.z ?? Infinity);
    expect(slots[0]!.localPosition.z).toBeCloseTo(-slots[20]!.localPosition.z, 12);
    expect(intergalacticConvoyRewardPool(1)).toEqual([
      'DART', 'COURIER', 'VIPER', 'WAYFARER', 'TEMPEST', 'ATLAS', 'CORSAIR', 'ARGOSY',
    ]);
  });

  it('spaces each neighbouring rank for its authored hull footprint', () => {
    expect(INTERGALACTIC_CONVOY.formation.rankGaps).toEqual([
      22, 28, 34, 34, 41, 54, 56, 68, 76, 72,
    ]);
    expect(INTERGALACTIC_CONVOY.formation.lateralSpacing).toBe(64);
    const leftLane = convoyFormationSlots(1).filter(({ column }) => column === -1);
    expect(leftLane.slice(1).map((slot, index) => (
      leftLane[index]!.localPosition.z - slot.localPosition.z
    ))).toEqual(INTERGALACTIC_CONVOY.formation.rankGaps);
  });

  /**
   * FEATURE GEOMETRY, NOT AN ECONOMY SIMULATION. The convoy's income remains
   * excluded from ARR/VFR; this only proves the owner's two-hour fairness claim
   * against every shipped world slot and an isotropic route sample.
   */
  it('is reachable at opening from all 300 world slots by representative tier fleets', () => {
    const worlds = generateGalaxy(4_512, 300).slots;
    const fleets: Fleet[] = [
      { RAMPART: 1 },
      { STRONGHOLD: 1 },
      { LEVIATHAN: 1 },
      { CITADEL: 1 },
    ];
    let slowestArrival = 0;
    for (let route = 0; route < 64; route += 1) {
      const draws = [(route * 0.618_033_988_75) % 1, (route + 0.5) / 64];
      let draw = 0;
      const spec = intergalacticConvoySpec({
        sequence: route,
        startsAtMinute: 0,
        endsAtMinute: INTERGALACTIC_CONVOY.durationMinutes,
        effect,
      }, () => draws[draw++]!);
      for (const fleet of fleets) {
        const pace = fleetPace(fleet, { boost: fleetSpeedMult([]), tech: {} })
          / TRAVEL.distanceFactor;
        for (const origin of worlds) {
          const hit = interceptIntergalacticConvoy({
            origin,
            spec,
            departAtMinute: 0,
            fleetUnitsPerMinute: pace,
          });
          expect(hit).not.toBeNull();
          slowestArrival = Math.max(slowestArrival, hit?.arrivesAtMinute ?? Infinity);
        }
      }
    }
    expect(slowestArrival).toBeLessThanOrEqual(60.5);
  });

  it('does not silently reinterpret an unknown persisted version', () => {
    expect(() => convoyFormationSlots(2)).toThrow(/formation version/i);
    expect(() => intergalacticConvoyRewardPool(2)).toThrow(/reward pool version/i);
  });
});

describe('linear transit interception', () => {
  const solve = (targetAtQuoteTime: Vec3, targetVelocity: Vec3, speed: number) =>
    interceptLinearTransit({
      origin: { x: 0, y: 0, z: 0 },
      targetAtQuoteTime,
      targetVelocity,
      fleetUnitsPerMinute: speed,
      minMeetMinute: 0,
      maxMeetMinute: 100,
    });

  it('chooses the earliest root for approaching, receding and pass-through targets', () => {
    expect(solve({ x: 10, y: 0, z: 0 }, { x: -1, y: 0, z: 0 }, 2)?.meetsAtMinute)
      .toBeCloseTo(10 / 3, 12);
    expect(solve({ x: 10, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }, 2)?.meetsAtMinute)
      .toBeCloseTo(10, 12);
    expect(solve({ x: 10, y: 0, z: 0 }, { x: -2, y: 0, z: 0 }, 1)?.meetsAtMinute)
      .toBeCloseTo(10 / 3, 12);
  });

  it('handles tangent and already-there meetings', () => {
    const tangent = solve({ x: 3, y: 4, z: 0 }, { x: -1, y: 0, z: 0 }, 0.8);
    expect(tangent?.meetsAtMinute).toBeCloseTo(25 / 3, 10);
    expect(tangent?.at).toEqual(expect.objectContaining({ y: 4, z: 0 }));
    expect(solve({ x: 0, y: 0, z: 0 }, { x: 5, y: 5, z: 5 }, 1))
      .toEqual({ meetsAtMinute: 0, at: { x: 0, y: 0, z: 0 } });
  });

  it('rejects an unreachable target, invalid pace and roots beyond the event horizon', () => {
    expect(solve({ x: 10, y: 0, z: 0 }, { x: 2, y: 0, z: 0 }, 1)).toBeNull();
    expect(solve({ x: 10, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, 0)).toBeNull();
    expect(solve({ x: Number.NaN, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, 1)).toBeNull();
    expect(interceptLinearTransit({
      origin: { x: 0, y: 0, z: 0 },
      targetAtQuoteTime: { x: 10, y: 0, z: 0 },
      targetVelocity: { x: 0, y: 0, z: 0 },
      fleetUnitsPerMinute: 1,
      minMeetMinute: 0,
      maxMeetMinute: 9.999,
    })).toBeNull();
  });

  it('satisfies the distance equation and requested horizon for broad finite inputs', () => {
    fc.assert(fc.property(
      fc.record({
        targetX: fc.double({ min: -4_000, max: 4_000, noNaN: true, noDefaultInfinity: true }),
        targetY: fc.double({ min: -4_000, max: 4_000, noNaN: true, noDefaultInfinity: true }),
        velocityX: fc.double({ min: -100, max: 100, noNaN: true, noDefaultInfinity: true }),
        velocityY: fc.double({ min: -100, max: 100, noNaN: true, noDefaultInfinity: true }),
        speed: fc.double({ min: 0.01, max: 200, noNaN: true, noDefaultInfinity: true }),
        horizon: fc.double({ min: 0, max: 240, noNaN: true, noDefaultInfinity: true }),
      }),
      ({ targetX, targetY, velocityX, velocityY, speed, horizon }) => {
        const result = interceptLinearTransit({
          origin: { x: 0, y: 0, z: 0 },
          targetAtQuoteTime: { x: targetX, y: targetY, z: 0 },
          targetVelocity: { x: velocityX, y: velocityY, z: 0 },
          fleetUnitsPerMinute: speed,
          minMeetMinute: 0,
          maxMeetMinute: horizon,
        });
        if (result === null) return;
        expect(result.meetsAtMinute).toBeGreaterThanOrEqual(0);
        expect(result.meetsAtMinute).toBeLessThanOrEqual(horizon);
        expect(Math.hypot(result.at.x, result.at.y, result.at.z))
          .toBeCloseTo(speed * result.meetsAtMinute, 7);
      },
    ), { numRuns: 5_000 });
  });

  it('reserves the full five-second engagement inside the half-open event window', () => {
    const latest = 10 - INTERGALACTIC_CONVOY.engagementSeconds / 60;
    expect(interceptLinearTransit({
      origin: { x: 0, y: 0, z: 0 },
      targetAtQuoteTime: { x: latest, y: 0, z: 0 },
      targetVelocity: { x: 0, y: 0, z: 0 },
      fleetUnitsPerMinute: 1,
      minMeetMinute: 0,
      maxMeetMinute: latest,
    })?.meetsAtMinute).toBeCloseTo(latest, 12);
    expect(interceptLinearTransit({
      origin: { x: 0, y: 0, z: 0 },
      targetAtQuoteTime: { x: latest + 0.001, y: 0, z: 0 },
      targetVelocity: { x: 0, y: 0, z: 0 },
      fleetUnitsPerMinute: 1,
      minMeetMinute: 0,
      maxMeetMinute: latest,
    })).toBeNull();
  });

  it('returns the moving five-second segment and refuses a late launch', () => {
    const startsAtMinute = 500;
    const spec = intergalacticConvoySpec({
      sequence: 1,
      startsAtMinute,
      endsAtMinute: startsAtMinute + INTERGALACTIC_CONVOY.durationMinutes,
      effect,
    }, sequenceRng(0, 0.5));
    const result = interceptIntergalacticConvoy({
      origin: spec.from,
      spec,
      departAtMinute: startsAtMinute,
      fleetUnitsPerMinute: 100,
    });
    expect(result?.intercept).toEqual(spec.from);
    expect(result?.engagementEndsAtMinute).toBe(
      startsAtMinute + INTERGALACTIC_CONVOY.engagementSeconds / 60,
    );
    expect((result?.engagementEnd.x ?? 0) - spec.from.x)
      .toBeCloseTo(spec.speed * INTERGALACTIC_CONVOY.engagementSeconds / 60, 10);
    const tooLate = spec.expiresAt - INTERGALACTIC_CONVOY.engagementSeconds / 60 + 0.001;
    expect(interceptIntergalacticConvoy({
      origin: intergalacticConvoyPosition(spec, tooLate),
      spec,
      departAtMinute: tooLate,
      fleetUnitsPerMinute: 100,
    })).toBeNull();
  });
});

describe('the five-second convoy engagement clock', () => {
  it('does not change the existing ten-second combat contract', () => {
    const arrivesAt = 50_000;
    expect(convoyEngagementEndsAt(arrivesAt)).toBe(arrivesAt + 5_000);
    expect(isConvoyEngaging(arrivesAt, arrivesAt)).toBe(true);
    expect(isConvoyEngaging(arrivesAt, arrivesAt + 4_999)).toBe(true);
    expect(isConvoyEngaging(arrivesAt, arrivesAt + 5_000)).toBe(false);
  });
});

describe('the immutable convoy reward quote', () => {
  it('derives two hours of production from the launch snapshot, including Foundry', () => {
    const buildings = {
      CORE: 1, REFINERY: 4, EXTRACTOR: 3, VAULT: 0, SHIPYARD: 1, DEUTERIUM_PLANT: 2,
    } as const;
    const orbit = ['FOUNDRY'] as const;
    expect(effect.resourceCapHours).toBe(2);
    expect(convoyProductionCap({ buildings, orbit, effect })).toEqual({
      alloy: Math.floor(alloyRate(4) * productionMult(orbit) * 2),
      crystal: Math.floor(crystalRate(3) * productionMult(orbit) * 2),
      deuterium: Math.floor(deuteriumRate(2) * productionMult(orbit) * 2),
    });
  });

  it('uses combat-only firepower, independent quality thresholds and a proportional cargo clamp', () => {
    const quote = quoteIntergalacticConvoyReward({
      productionCap: { alloy: 360, crystal: 240, deuterium: 120 },
      fleet: { DART: 1, COURIER: 1 },
      launchTech: {},
      effect,
    });
    expect(quote.firepower).toBe(360);
    expect(quote.resourceQualityFactor).toBe(0.5);
    expect(quote.shipQualityFactor).toBeCloseTo(360 / 5_780, 12);
    expect(quote.rawResourceReward).toEqual({ alloy: 180, crystal: 120, deuterium: 60 });
    expect(quote.cargo).toBe(fleetCargo({ DART: 1, COURIER: 1 }, {}));
    expect(quote.resourceReward).toEqual(quote.rawResourceReward);

    const cramped = quoteIntergalacticConvoyReward({
      productionCap: { alloy: 360, crystal: 240, deuterium: 120 },
      fleet: { DART: 1 },
      launchTech: {},
      effect,
    });
    const capacity = fleetCargo({ DART: 1 }, {});
    expect(cramped.resourceReward).toEqual({ alloy: Math.floor(capacity / 2),
      crystal: Math.floor(capacity / 3), deuterium: Math.floor(capacity / 6) });
    expect(cramped.resourceReward.alloy + cramped.resourceReward.crystal
      + cramped.resourceReward.deuterium).toBeLessThanOrEqual(cramped.cargo);
  });

  it('never makes the ship chance cheap on a zero-production world', () => {
    const quote = quoteIntergalacticConvoyReward({
      productionCap: { alloy: 0, crystal: 0, deuterium: 0 },
      fleet: { DART: 1, ARGOSY: 1 },
      launchTech: {},
      effect,
    });
    expect(quote.resourceQualityFactor).toBe(1);
    expect(quote.resourceReward).toEqual({ alloy: 0, crystal: 0, deuterium: 0 });
    expect(quote.shipQualityFactor).toBeCloseTo(combatValue({ DART: 1 }) / 5_780, 12);
    expect(quote.shipDropChance).toBeCloseTo(0.15 * quote.shipQualityFactor, 12);
    expect(quote.maxTier).toBe(4);
  });

  it('rejects empty, cargo-only, ground, mining, fractional and unsafe fleets and corrupt caps', () => {
    expect(() => quoteIntergalacticConvoyReward({
      productionCap: { alloy: 1, crystal: 1, deuterium: 1 }, fleet: {}, launchTech: {}, effect,
    })).toThrow(/mobile/i);
    expect(() => quoteIntergalacticConvoyReward({
      productionCap: { alloy: 1, crystal: 1, deuterium: 1 },
      fleet: { COURIER: 1 }, launchTech: {}, effect,
    })).toThrow(/firepower/i);
    for (const fleet of [
      { BASTION: 1 }, { PROSPECTOR: 1 }, { DART: 0.5 }, { DART: Number.MAX_SAFE_INTEGER + 1 },
      { UNKNOWN: 1 },
    ]) {
      expect(() => quoteIntergalacticConvoyReward({
        productionCap: { alloy: 1, crystal: 1, deuterium: 1 },
        fleet,
        launchTech: {},
        effect,
      })).toThrow();
    }
    expect(() => quoteIntergalacticConvoyReward({
      productionCap: { alloy: Number.NaN, crystal: 1, deuterium: 1 },
      fleet: { DART: 1 }, launchTech: {}, effect,
    })).toThrow(/production cap/i);
  });

  it('preserves resource and cargo invariants across broad integer inputs', () => {
    fc.assert(fc.property(
      fc.record({
        alloy: fc.integer({ min: 0, max: 1_000_000 }),
        crystal: fc.integer({ min: 0, max: 1_000_000 }),
        deuterium: fc.integer({ min: 0, max: 1_000_000 }),
        darts: fc.integer({ min: 1, max: 1_000 }),
        couriers: fc.integer({ min: 0, max: 100 }),
      }),
      ({ alloy, crystal, deuterium, darts, couriers }) => {
        const productionCap = { alloy, crystal, deuterium };
        const quote = quoteIntergalacticConvoyReward({
          productionCap,
          fleet: { DART: darts, ...(couriers > 0 ? { COURIER: couriers } : {}) },
          launchTech: {},
          effect,
        });
        const total = quote.resourceReward.alloy + quote.resourceReward.crystal
          + quote.resourceReward.deuterium;
        expect(quote.resourceReward.alloy).toBeGreaterThanOrEqual(0);
        expect(quote.resourceReward.alloy).toBeLessThanOrEqual(alloy);
        expect(quote.resourceReward.crystal).toBeLessThanOrEqual(crystal);
        expect(quote.resourceReward.deuterium).toBeLessThanOrEqual(deuterium);
        expect(total).toBeLessThanOrEqual(quote.cargo);
      },
    ), { numRuns: 2_000 });
  });
});

describe('the versioned ship prize roll', () => {
  it('caps eligibility at every mobile hull tier, including an unarmed carrier', () => {
    const awarded = rollIntergalacticConvoyAward({
      fleet: { DART: 1, ARGOSY: 1 },
      shipQualityFactor: 1,
      effect,
      rng: sequenceRng(0, 0, 0.999, 0.999),
    });
    expect(awarded).toEqual({ ARGOSY: 1 });
  });

  it('is deterministic and never draws outside the frozen eight-hull pool', () => {
    const draw = () => rollIntergalacticConvoyAward({
      fleet: { CATACLYSM: 1, ARGOSY: 1 },
      shipQualityFactor: 1,
      effect,
      rng: seededFrom('convoy-award-fixture'),
    });
    expect(draw()).toEqual(draw());
    const rewardPool = new Set<string>(intergalacticConvoyRewardPool(1));
    for (let index = 0; index < 10_000; index += 1) {
      const award = rollIntergalacticConvoyAward({
        fleet: { CATACLYSM: 1, ARGOSY: 1 },
        shipQualityFactor: 1,
        effect,
        rng: seededFrom('convoy-award', index),
      });
      expect(Object.keys(award).every((id) => rewardPool.has(id))).toBe(true);
      expect(Object.values(award).reduce((sum, count) => sum + count, 0))
        .toBeLessThanOrEqual(3);
    }
  });

  it('holds the 100k full-quality drop, count and tier distributions', () => {
    const rng = seededFrom('convoy-award-distribution');
    let drops = 0;
    const counts = [0, 0, 0];
    const tiers = [0, 0, 0, 0];
    let awardedTotal = 0;
    for (let draw = 0; draw < 100_000; draw += 1) {
      const award = rollIntergalacticConvoyAward({
        fleet: { CATACLYSM: 1, ARGOSY: 1 }, shipQualityFactor: 1, effect, rng,
      });
      const count = Object.values(award).reduce((sum, value) => sum + value, 0);
      if (count === 0) continue;
      drops += 1;
      counts[count - 1] = (counts[count - 1] ?? 0) + 1;
      for (const [id, amount] of Object.entries(award)) {
        const tier = HULLS[id as keyof typeof HULLS].tier;
        if (tier === null) throw new Error(`reward hull ${id} has no tier`);
        tiers[tier - 1] = (tiers[tier - 1] ?? 0) + amount;
        awardedTotal += amount;
      }
    }
    expect(drops / 100_000).toBeCloseTo(0.15, 2);
    expect(counts.map((count) => count / drops)).toEqual([
      expect.closeTo(0.80, 2), expect.closeTo(0.17, 2), expect.closeTo(0.03, 2),
    ]);
    const tierShares = tiers.map((count) => count / awardedTotal);
    for (const [index, expected] of [0.55, 0.27, 0.13, 0.05].entries()) {
      expect(Math.abs((tierShares[index] ?? 0) - expected)).toBeLessThan(0.012);
    }
  });
});

describe('the frozen unequal return trip', () => {
  it('charges each real leg and preserves the old symmetric contract exactly', () => {
    const fleet: Fleet = { DART: 3, COURIER: 1 };
    expect(missionFuelForDistances(fleet, [600, 600])).toBe(missionFuel(fleet, 600, 2));
    expect(missionFuelForDistances(fleet, [400, 900])).toBe(
      missionFuel(fleet, 400, 1) + missionFuel(fleet, 900, 1),
    );
  });

  it('tows awarded hulls without changing cargo, pace, fuel or the visible in-flight roster', () => {
    const fleet: Fleet = { DART: 3, COURIER: 1 };
    const awardedFleet: Fleet = { ARGOSY: 3 };
    const profile = intergalacticConvoyReturnProfile({
      fleet,
      awardedFleet,
      launchTech: {},
      flightModifiers: { boost: 1, tech: {} },
      outboundDistance: 400,
      returnDistance: 900,
    });
    expect(profile.visibleFleet).toEqual(fleet);
    expect(profile.deliveredFleet).toEqual({ DART: 3, COURIER: 1, ARGOSY: 3 });
    expect(profile.cargo).toBe(fleetCargo(fleet, {}));
    expect(profile.pace).toBe(fleetPace(fleet, { boost: 1, tech: {} }));
    expect(profile.fuel).toBe(missionFuelForDistances(fleet, [400, 900]));
  });
});

describe('convoy quote freshness', () => {
  const serverNowMs = 100_000;
  const base = {
    quotedAtMs: serverNowMs - 10_000,
    quotedFlightSeconds: 30,
    quotedArriveAtMs: serverNowMs + 20_000,
    serverNowMs,
    actualFlightSeconds: 30,
    actualArriveAtMs: serverNowMs + 20_000,
  };

  it('refuses a quote older than the authored age, or one from the future', () => {
    expect(intergalacticConvoyQuoteIsFresh(base)).toBe(true);
    expect(intergalacticConvoyQuoteIsFresh({
      ...base, quotedAtMs: serverNowMs - INTERGALACTIC_CONVOY.maxQuoteAgeSeconds * 1_000 - 1,
    })).toBe(false);
    expect(intergalacticConvoyQuoteIsFresh({
      ...base, quotedAtMs: serverNowMs + 1,
    })).toBe(false);
  });

  /**
   * THE DELAY ITSELF IS NOT STALENESS. D201.
   *
   * A rendezvous with a moving target is pinned in absolute time, so hesitating
   * `d` seconds shortens the flight by very nearly `d`. Judging that as drift made
   * the guard a reaction-time test and refused the median confirmation.
   */
  it('forgives the drift the elapsed delay already explains', () => {
    for (const ageSeconds of [0, 5, 20, 44]) {
      const quotedAtMs = serverNowMs - ageSeconds * 1_000;
      expect(intergalacticConvoyQuoteIsFresh({
        ...base,
        quotedAtMs,
        quotedArriveAtMs: quotedAtMs + 30_000,
        // The whole delay came off the remaining flight: the same meeting, later departure.
        actualFlightSeconds: 30 - ageSeconds,
        actualArriveAtMs: quotedAtMs + 30_000,
      }), `a ${String(ageSeconds)}s pause must not be stale`).toBe(true);
    }
  });

  it('still refuses a trip that changed beyond what the delay explains', () => {
    const surplus = INTERGALACTIC_CONVOY.quoteToleranceSeconds + 10 + 1;
    expect(intergalacticConvoyQuoteIsFresh({
      ...base, actualFlightSeconds: 30 + surplus,
    })).toBe(false);
    expect(intergalacticConvoyQuoteIsFresh({
      ...base, actualArriveAtMs: base.actualArriveAtMs + surplus * 1_000,
    })).toBe(false);
  });
});
