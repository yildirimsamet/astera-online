import { describe, expect, it } from 'vitest';
import {
  GROUND_HULLS,
  HULLS,
  MOBILE_HULLS,
  PROBE,
  PROSPECTOR,
  RESEARCH_MAX_LEVEL,
  RESEARCH_PROJECTS,
  RESEARCH_TECH,
  fleetSpeed,
  fleetTravelExact,
  hullTech,
  researchEffectAt,
} from '../src/index.js';
import type { HullId } from '../src/index.js';

/**
 * D152 — THE FLEET GOT A QUARTER FASTER AND PROPULSION BECAME WORTH BUYING.
 *
 * Two owner instructions, and they are one change: every Fleet V2 hull's authored
 * base speed is lifted by exactly a quarter, and Ship Propulsion — which used to
 * sell +10% across five rungs, a figure no player could feel — now sells a
 * DOUBLING across four.
 *
 * THE TWO CRAFT THAT DID NOT MOVE ARE THE POINT OF STATING THE TABLE HERE. The
 * probe is calibrated against `GALAXY_SPAN` so the distance gradient of looking
 * stays what D121 measured, and the Prospector is calibrated against ROCK speed
 * so a drill keeps aiming ahead of a moving target by the lead D74 measured. Both
 * are the "hull speeds no, the Prospector and the rocks yes" list from D101 read
 * the other way round: a warship factor may never leak into either.
 */

/** The authored table, post-D152: D148's figure x1.25, rounded to a whole unit. */
const D152_SPEED: Readonly<Record<string, number>> = {
  DART: 200, PIKE: 144, RAMPART: 75, WARDEN: 131, COURIER: 181,
  VIPER: 213, TALON: 150, STRONGHOLD: 81, SENTINEL: 138, WAYFARER: 138,
  TEMPEST: 231, BALLISTA: 156, LEVIATHAN: 88, PRAETORIAN: 144, ATLAS: 94,
  NULLIFIER: 119, CATACLYSM: 106, CITADEL: 56,
};

/** What each hull flew before D152, so the quarter is asserted rather than trusted. */
const D148_SPEED: Readonly<Record<string, number>> = {
  DART: 160, PIKE: 115, RAMPART: 60, WARDEN: 105, COURIER: 145,
  VIPER: 170, TALON: 120, STRONGHOLD: 65, SENTINEL: 110, WAYFARER: 110,
  TEMPEST: 185, BALLISTA: 125, LEVIATHAN: 70, PRAETORIAN: 115, ATLAS: 75,
  NULLIFIER: 95, CATACLYSM: 85, CITADEL: 45,
};

describe('D152 base ship speed', () => {
  it('flies every Fleet V2 hull at exactly a quarter more than D148 authored', () => {
    expect(Object.keys(D152_SPEED).sort()).toEqual([...MOBILE_HULLS].sort());

    for (const id of MOBILE_HULLS) {
      expect(HULLS[id].speed, id).toBe(D152_SPEED[id]);
      expect(HULLS[id].speed, `${id} quarter`).toBe(Math.round(D148_SPEED[id]! * 1.25));
      expect(Number.isInteger(HULLS[id].speed), `${id} whole units`).toBe(true);
    }
  });

  /**
   * The probe and the drill took no part in the LIFT, by owner instruction, and each
   * has its own reason: the probe's speed is the whole distance gradient of scouting
   * (D121) and the Prospector's is tied to rock speed rather than to warship speed
   * (D74). The drill is still exactly where it was; the probe went the other way at
   * D153 — see below.
   */
  it('leaves the drill exactly where it was', () => {
    expect(PROSPECTOR.speed).toBe(825);
    expect(HULLS.PROSPECTOR.speed).toBe(PROSPECTOR.speed);
  });

  /** A gun that never leaves the ground has no speed to raise. */
  it('leaves ground defence at zero', () => {
    for (const id of GROUND_HULLS) expect(HULLS[id].speed, id).toBe(0);
  });

  /** The profile ordering the raid tempo is made of survives the lift. */
  it('keeps the authored speed ordering intact', () => {
    expect(HULLS.TEMPEST.speed)
      .toBe(Math.max(...MOBILE_HULLS.filter((id) => HULLS[id].atk > 0)
        .map((id) => HULLS[id].speed)));
    expect(HULLS.DART.speed).toBeGreaterThan(HULLS.PIKE.speed);
    expect(HULLS.PIKE.speed).toBeGreaterThan(HULLS.RAMPART.speed);
    expect(HULLS.COURIER.speed).toBeGreaterThan(HULLS.WAYFARER.speed);
    expect(HULLS.WAYFARER.speed).toBeGreaterThan(HULLS.ATLAS.speed);
    expect(HULLS.PROSPECTOR.speed)
      .toBeGreaterThan(Math.max(...MOBILE_HULLS.map((id) => HULLS[id].speed)));
    expect(PROBE.speed).toBeGreaterThan(HULLS.PROSPECTOR.speed);
  });
});

describe('D152 Ship Propulsion ladder', () => {
  const ladder: readonly [number, number][] = [
    [0, 1], [1, 1.25], [2, 1.5], [3, 1.75], [4, 2],
  ];

  it('sells four rungs and nothing beyond them', () => {
    expect(RESEARCH_TECH.propulsionMaxLevel).toBe(4);
    expect(RESEARCH_MAX_LEVEL.SHIP_PROPULSION).toBe(4);
    expect(RESEARCH_PROJECTS.SHIP_PROPULSION.maxLevel).toBe(4);
    expect(RESEARCH_PROJECTS.SHIP_PROPULSION.prerequisite).toBe('DENSE_FUEL_CELLS');
  });

  it.each(ladder)('multiplies speed by the stated factor at rung %i', (level, factor) => {
    for (const id of MOBILE_HULLS) {
      expect(hullTech({ SHIP_PROPULSION: level }, id).speed, `${id} L${String(level)}`)
        .toBeCloseTo(factor, 12);
    }
  });

  it('doubles and then stops, however many levels are handed to it', () => {
    for (const beyond of [5, 6, 99]) {
      expect(hullTech({ SHIP_PROPULSION: beyond }, 'DART').speed).toBe(2);
      expect(researchEffectAt('SHIP_PROPULSION', beyond)).toBe(2);
    }
  });

  /** Speed is not a combat statistic: the product ceiling stays where D137 put it. */
  it('never touches attack, hull strength or a preserved craft', () => {
    for (const id of MOBILE_HULLS) {
      expect(hullTech({ SHIP_PROPULSION: 4 }, id)).toMatchObject({ atk: 1, hp: 1 });
    }
    for (const id of ['BASTION', 'THORN', 'PROSPECTOR'] as const satisfies readonly HullId[]) {
      expect(hullTech({ SHIP_PROPULSION: 4 }, id), id).toEqual({ atk: 1, hp: 1, speed: 1 });
    }
  });

  /** A fleet still flies at its slowest hull; the research lifts that hull. */
  it('halves the flight of a maxed fleet without erasing its composition', () => {
    const fleet = { DART: 3, CITADEL: 1 };
    expect(fleetSpeed(fleet)).toBe(HULLS.CITADEL.speed);
    expect(fleetSpeed(fleet, { SHIP_PROPULSION: 4 })).toBeCloseTo(HULLS.CITADEL.speed * 2, 12);
    expect(fleetTravelExact(600, fleet, 1, { SHIP_PROPULSION: 4 }))
      .toBeCloseTo(fleetTravelExact(600, fleet) / 2, 12);
    expect(fleetSpeed(fleet, { SHIP_PROPULSION: 4 }))
      .toBeLessThan(fleetSpeed({ DART: 3 }, { SHIP_PROPULSION: 4 }));
  });

  /** Every rung is priced, and each one costs more than the one below it. */
  it('charges a rising price for all four rungs', () => {
    const value = (level: number) => {
      const cost = RESEARCH_PROJECTS.SHIP_PROPULSION.costAt(level);
      return cost.alloy + cost.crystal + cost.deuterium;
    };
    for (let level = 2; level <= 4; level++) {
      expect(value(level), `L${String(level)}`).toBeGreaterThan(value(level - 1));
    }
  });
});

/**
 * THE PROBE FLIES A QUARTER SLOWER. D153, owner instruction.
 *
 * IT IS THE OTHER HALF OF D152. The fleet took +25% and the probe was excluded, so
 * the gap between "how fast can I look" and "how fast can I hit" widened by a
 * quarter in the probe's favour — on top of the ×12 D121 had already given it. A
 * scout that arrives 15× faster than the fastest warship makes looking nearly free
 * in the one currency the intel layer is supposed to charge in: time. Cutting it a
 * quarter and lifting the fleet a quarter closes that from both ends at once.
 *
 * THE CEILING D121 SET IS UNTOUCHED, and it is a ceiling on flatness rather than on
 * speed. The failure it recorded was every probe in the galaxy landing in exactly two
 * minutes, at which point distance stopped meaning anything to a scout; with no fixed
 * launch term the gradient is exactly `GALAXY_SPAN / minSeparation` and no speed
 * anyone picks can move it. A slower probe is a probe that pays MORE for distance,
 * which is the direction that rule wants.
 *
 * AND IT IS STILL THE FASTEST THING IN THE GAME by a wide margin — a scout must
 * outrun anything that can be sent at you, or a warning is worth nothing — and the
 * hour that actually rations scouting (`retargetCooldownMinutes`) still outlasts the
 * widest round trip, which is the relationship that keeps two rules from disagreeing
 * about one control.
 */
describe('D153 probe speed', () => {
  it('flies at exactly three quarters of what it flew before', () => {
    expect(PROBE.speed).toBe(Math.round(4680 * 0.75));
    expect(PROBE.speed).toBe(3510);
  });

  it('still outruns every hull in the game, and the drill', () => {
    expect(PROBE.speed).toBeGreaterThan(PROSPECTOR.speed);
    for (const id of MOBILE_HULLS) {
      expect(PROBE.speed, `a ${HULLS[id].name} outruns a probe`)
        .toBeGreaterThan(HULLS[id].speed);
    }
  });

  /** The cut is on the probe alone. Nothing else in the model reads it. */
  it('moves nothing but the probe', () => {
    expect(PROSPECTOR.speed).toBe(825);
    for (const id of MOBILE_HULLS) expect(HULLS[id].speed, id).toBe(D152_SPEED[id]);
  });
});
