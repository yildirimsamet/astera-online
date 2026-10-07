import { describe, expect, it } from 'vitest';
import {
  FUEL,
  MISSION_PACES,
  TRAVEL,
  UNAIDED,
  allowedPaces,
  exposureMinutes,
  fleetPace,
  fleetTravelExact,
  isMissionPace,
  missionFuel,
  missionPaceOf,
  pacesForMinutes,
} from '../src/index.js';
import type { Fleet } from '../src/types.js';

/**
 * WHY A COMMANDER MAY CHOOSE HOW FAST TO FLY. Owner decision, 2026-09-21, and GWAYNE's request
 * before it: *"Filonun hızını yavaşlatabilmeliyiz."*
 *
 * Recall protects the commander AT THE SCREEN. Pace protects the one who is ASLEEP OR AT WORK —
 * and that is the target audience. A fleet told to take nine hours is a fleet that is not standing
 * in the hangar when the raid lands.
 *
 * IT CHANGES THE CLOCK AND NOTHING ELSE. Not fuel: `missionFuel` is mass × distance and has no
 * tempo term, and giving it one would be the global fuel cut this plan already measured and
 * killed — an attacker would simply fly slow and pay less, and distance would stop being
 * protection.
 */
describe('the pace a commander may choose', () => {
  const wing: Fleet = { DART: 40 };

  it('offers full speed and a descending ladder below it', () => {
    expect(MISSION_PACES[0]).toBe(1);
    expect([...MISSION_PACES].sort((a, b) => b - a)).toEqual([...MISSION_PACES]);
    expect(new Set(MISSION_PACES).size).toBe(MISSION_PACES.length);
    for (const pace of MISSION_PACES) expect(pace).toBeGreaterThan(0);
  });

  it('knows a pace it did not author', () => {
    expect(isMissionPace(1)).toBe(true);
    expect(isMissionPace(0.37)).toBe(false);
    expect(isMissionPace(2)).toBe(false);
  });

  it('flies at full speed when no pace was chosen', () => {
    expect(fleetPace(wing, UNAIDED)).toBe(fleetPace(wing, { ...UNAIDED, pace: 1 }));
  });

  it('halving the pace doubles the flight', () => {
    const full = fleetTravelExact(500, wing, UNAIDED);
    const half = fleetTravelExact(500, wing, { ...UNAIDED, pace: 0.5 });
    expect(half).toBeCloseTo(full * 2, 9);
  });

  /** The owner's constraint, and the one this whole item is allowed to touch: time, not money. */
  it('costs exactly the same fuel however slowly it is flown', () => {
    expect(missionFuel(wing, 500, 2)).toBe(missionFuel(wing, 500, 2));
    // There is no pace argument to pass: the signature itself is the guarantee.
    expect(missionFuel.length).toBe(3);
  });
});

describe('how slow a flight may be told to go', () => {
  const wing: Fleet = { DART: 40 };
  /** A hop short enough that every rung of the ladder still lands inside the cap. */
  const shortHop = 1;

  it('allows every pace on a flight that stays inside the cap', () => {
    expect(allowedPaces(shortHop, wing, UNAIDED)).toEqual([...MISSION_PACES]);
  });

  /**
   * A FLEET PARKED IN SPACE IS AN UNTOUCHABLE FLEET. Without a ceiling the slowest rung turns any
   * distance into indefinite safety, which is not fleetsave — it is removing the fleet from the
   * game while keeping it.
   */
  it('refuses a pace that would leave the fleet in the air past the cap', () => {
    const far = 20_000;
    const paces = allowedPaces(far, wing, UNAIDED);
    for (const pace of paces) {
      expect(fleetTravelExact(far, wing, { ...UNAIDED, pace }))
        .toBeLessThanOrEqual(TRAVEL.pacedFlightCapMinutes);
    }
    expect(paces.length).toBeLessThan(MISSION_PACES.length);
  });

  /**
   * AND THE CAP NEVER FORBIDS A FLIGHT THAT IS LEGAL TODAY. Some crossings of a thousand-seat
   * galaxy already run past twelve hours at full speed; refusing those would be this item
   * deleting an existing journey rather than adding a choice.
   */
  it('always allows full speed, however long that flight already is', () => {
    const crossGalaxy = 400_000;
    expect(fleetTravelExact(crossGalaxy, wing, UNAIDED))
      .toBeGreaterThan(TRAVEL.pacedFlightCapMinutes);
    expect(allowedPaces(crossGalaxy, wing, UNAIDED)).toEqual([1]);
  });

  it('refuses a wing that cannot move at all', () => {
    expect(allowedPaces(100, { BASTION: 5 }, UNAIDED)).toEqual([]);
  });
});

/**
 * THE SAME LADDER FOR A LEG THAT IS ALREADY TIMED. Review 2026-09-22, finding #2.
 *
 * A joint clan strike has no single fleet to hand `allowedPaces`: it flies at its slowest wave,
 * each wave on its own owner's propulsion, lifted by the staging Beacon. The server times that
 * leg itself and the leader's screen is handed the minutes — so the rung rule has to be stateable
 * on minutes alone, and it must never disagree with the fleet form of the same flight.
 */
describe('how slow an already-timed leg may be told to go', () => {
  const wing: Fleet = { DART: 40 };

  it('agrees with the fleet form on every flight it is given', () => {
    for (const dist of [1, 500, 5_000, 20_000, 60_000, 400_000]) {
      const full = fleetTravelExact(dist, wing, UNAIDED);
      expect(pacesForMinutes(full), `distance ${String(dist)}`)
        .toEqual(allowedPaces(dist, wing, UNAIDED));
    }
  });

  it('keeps full speed however long the leg already is', () => {
    expect(pacesForMinutes(TRAVEL.pacedFlightCapMinutes * 3)).toEqual([1]);
  });

  it('offers nothing for a leg that cannot be flown', () => {
    expect(pacesForMinutes(Infinity)).toEqual([]);
    expect(pacesForMinutes(Number.NaN)).toEqual([]);
  });
});

/**
 * WHAT IT COSTS TO MOVE A FLEET BETWEEN YOUR OWN WORLDS. Owner decision, 2026-09-21: half.
 *
 * THE DISCOUNT IS ON THE LANE, NEVER ON THE SPEED. A global cut was measured and killed — it
 * breaks distance-as-protection and inflates every merchant price with it — so the one flight
 * that gets cheaper is the one that reaches nobody else: a commander moving their own ships
 * between their own worlds. An attack pays the undiscounted rate at every pace.
 *
 * HALF RATHER THAN FREE. A nightly fleetsave has to be affordable or the whole mobility package
 * is a control nobody can use; free would take the decision out of it and make parking the fleet
 * in the air the default with no cost at all.
 */
describe('the lane a flight is flown in', () => {
  const wing: Fleet = { DART: 40 };

  it('charges an attack the undiscounted rate', () => {
    expect(missionFuel(wing, 500, 2, 'HOSTILE')).toBe(missionFuel(wing, 500, 2));
  });

  it('halves the charge on a move between the commander’s own worlds', () => {
    const full = missionFuel(wing, 500, 1, 'HOSTILE');
    const home = missionFuel(wing, 500, 1, 'HOMEWARD');
    expect(home).toBeLessThan(full);
    expect(home / full).toBeCloseTo(FUEL.laneShare.HOMEWARD, 2);
  });

  /** Rounded up per leg, like every other launch: the shortest hop still costs a drop. */
  it('still charges something for the shortest homeward hop', () => {
    expect(missionFuel(wing, 0.001, 1, 'HOMEWARD')).toBeGreaterThan(0);
  });

  it('leaves the pace out of the price in either lane', () => {
    for (const lane of ['HOSTILE', 'HOMEWARD'] as const) {
      expect(missionFuel(wing, 500, 2, lane)).toBe(missionFuel(wing, 500, 2, lane));
    }
    // Three required parameters: the lane is the only thing that was added, and it is optional.
    expect(missionFuel.length).toBe(3);
  });
});

/**
 * HOW LONG THE WORLD STANDS SHORT OF ITS GARRISON.
 *
 * The exposure figure is the headline the raid sheet is built around: "home defence after launch,
 * and for how long". Since 2026-10-06 a paced flight comes home at its own pace (owner: "Bacakların
 * eşit yarı yarıya bölünmesi lazım"), so it is `oneWay * 2` at every pace again.
 */
describe('how long a launch leaves home short', () => {
  const wing: Fleet = { DART: 40 };

  it('is still both legs of an unpaced flight', () => {
    const oneWay = fleetTravelExact(500, wing, UNAIDED);
    expect(exposureMinutes(oneWay)).toBe(oneWay * 2);
  });

  /** Owner decision, 2026-10-06: a paced flight comes home at its pace — two equal legs. */
  it('is both legs of a paced flight too', () => {
    const slow = fleetTravelExact(500, wing, { ...UNAIDED, pace: 0.25 });
    expect(exposureMinutes(slow)).toBeCloseTo(2 * slow, 9);
    expect(exposureMinutes(slow)).toBeCloseTo(4 * exposureMinutes(fleetTravelExact(500, wing, UNAIDED)), 9);
  });
});

/** A stored `missions.pace` read back as a rung; anything off the ladder flies at full speed. */
describe('a stored pace read back', () => {
  it('keeps every rung and falls back to full speed for anything else', () => {
    for (const pace of MISSION_PACES) expect(missionPaceOf(pace)).toBe(pace);
    expect(missionPaceOf(0.37)).toBe(1);
    expect(missionPaceOf(null)).toBe(1);
    expect(missionPaceOf(undefined)).toBe(1);
    expect(missionPaceOf(Number.NaN)).toBe(1);
  });
});
