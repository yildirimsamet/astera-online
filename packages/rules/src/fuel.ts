import { FUEL, SALVAGE } from './constants.js';
import { HULLS, fleetEntries, hullRoundTrip } from './hulls.js';
import type { Fleet, HullId } from './types.js';

/**
 * THE MASS A FUEL CHARGE IS MEASURED IN. T6 · D153 · D195.
 *
 * A FIXED FRACTION OF WHAT THE HULL COST, TILTED BY HOW FAST IT FLIES. D195
 * replaced D153's `bulk x tierMass` with this because the tier ladder had inverted
 * the thing it was meant to protect: measured across the catalogue, power per unit
 * of fuel ran 13.4 / 10.6 / 8.2 / 10.6 from tier 1 to tier 4, so the entry hull was
 * the efficient one and every rung above it was a penalty. `FUEL.perValue` states
 * the whole argument.
 *
 * PRICE, because that is the one number that already carries everything a hull is —
 * D148 prices the catalogue at `atk x hp / value^2`, so charging fuel against value
 * charges it against POWER without fuel ever reading a combat stat. The relation
 * cannot invert: a hull that is worth more to field costs more to fly, at every
 * rung, with no tier left to sit on.
 *
 * TIMES `pivotRoundTrip / referenceRoundTrip`, which is the owner's second rule —
 * a fast hull drinks more, a slow one less. It is the SAME number the hold is
 * derived from in `profileHull`, deliberately: one statement of "how fast is this
 * thing" feeding both, because two tables would drift the first time either moved.
 *
 * CEILED, NEVER ROUNDED, and never below one. `missionFuel` already ceils per leg,
 * so this is the same promise one level down: no hull is ever free to move, and
 * rounding never hands the cheap end of a tier a discount the dear end pays for.
 *
 * ZERO FOR A GROUND HULL. A gun never travels, so it has no thirst whatever it
 * weighs on the ground. A hull with no reference trip — the Prospector — sits at the
 * pivot, and burns nothing in practice because a mining run is not charged (D136).
 */
export function hullFuelMass(hull: HullId): number {
  const spec = HULLS[hull];
  if (spec.ground) return 0;
  // The Garbage Collector's thirst is the owner's, not its price's. D200.
  if (spec.profile === 'COLLECTOR') return SALVAGE.fuelMass;
  const value = spec.alloy + spec.crystal + spec.deuterium;
  const thirst = FUEL.pivotRoundTrip / (hullRoundTrip(hull) ?? FUEL.pivotRoundTrip);
  return Math.max(1, Math.ceil(value * FUEL.perValue * thirst));
}

/**
 * WHAT THIS FLEET WEIGHS TO A FUEL PUMP. T6 · D153.
 *
 * The counterpart to `hangarLoad`, and deliberately a separate function from it for
 * the reason that file already states about `hangarLoad`/`groundLoad`: a caller
 * passing the wrong quantity is exactly the failure this code base has shipped
 * before. Here the split is in the name — room is `hangarLoad`, thirst is this.
 */
export function fuelMass(fleet: Fleet): number {
  let mass = 0;
  for (const [id, count] of fleetEntries(fleet)) mass += count * hullFuelMass(id);
  return mass;
}

/**
 * WHAT IT COSTS TO PUT THIS FLEET IN THE AIR. T6.
 *
 * ONE FUNCTION, READ BY THREE PROCESSES. The server charges it, the launch screen
 * quotes it before anything is committed, and the simulator spends it. A second
 * copy would disagree the first time either moved, and the symptom would be a
 * screen promising a launch the server then refuses.
 *
 * MASS × DISTANCE, PER LEG, AND NOTHING ELSE.
 *
 *   · MASS is `fuelMass`: the same `bulk` the Hangar rations, times the hull tier's
 *     thirst rung (D153). Room and thirst are derived from one number so they can
 *     never disagree about how big a fleet is, and kept separate so a fuel change
 *     cannot silently re-rate the Hangar — `FUEL.tierMass` states the whole
 *     argument. Ground defence weighs nothing here for the same reason it takes no
 *     hangar room: it never travels.
 *
 *   · DISTANCE, because that is the axis the game already charges on. D125 and
 *     D126 made distance an INFORMATION cost — how far you can see, how late the
 *     warning comes. This makes the same axis an economic one, which is the
 *     consistent version of the same idea rather than a new tax.
 *
 *   · NOT SPEED. A Bulwark already pays for being slow by being slow: longer in
 *     the air, longer out of position, longer visible to everyone watching.
 *     Charging it again for the same property taxes one decision twice, and the
 *     hull table is priced at equal-budget power precisely so that no second axis
 *     can quietly re-rate it.
 *
 * ROUNDED UP PER LEG, so the shortest hop still costs a drop. A free launch is a
 * launch with no decision in it.
 *
 * FULL FUEL OR NO LAUNCH — owner instruction. A one-way budget is not a cheaper
 * raid, it is a stranded fleet, and P3 already says a launched fleet cannot be
 * recalled. The caller passes the legs the mission will actually fly and pays for
 * all of them before it leaves.
 */
export function missionFuel(fleet: Fleet, distance: number, legs: 1 | 2): number {
  const mass = fuelMass(fleet);
  if (mass <= 0) return 0;
  const span = Math.max(0, distance);
  return Math.ceil((mass * span) / FUEL.scale) * legs;
}

/**
 * Fuel for a mission whose outbound and return legs do not have the same length.
 *
 * A moving target is met at one point and left five seconds later at another, so
 * multiplying one distance by two would charge for a journey the fleet never
 * flies. Each real leg is rounded independently, preserving `missionFuel(f, d, 2)`
 * exactly when both distances are `d`.
 */
export function missionFuelForDistances(
  fleet: Fleet,
  distances: readonly number[],
): number {
  if (distances.some((span) => !Number.isFinite(span) || span < 0)) {
    throw new RangeError('mission distances must be finite and non-negative');
  }
  const mass = fuelMass(fleet);
  if (!Number.isSafeInteger(mass) || mass < 0) {
    throw new RangeError('fleet fuel mass must be a non-negative safe integer');
  }
  if (mass === 0) return 0;
  const fuel = distances.reduce(
    (total, span) => total + Math.ceil((mass * span) / FUEL.scale),
    0,
  );
  if (!Number.isSafeInteger(fuel) || fuel < 0) {
    throw new RangeError('mission fuel must be a non-negative safe integer');
  }
  return fuel;
}

/**
 * WHAT ONE OF THESE COSTS TO MOVE. Owner report — the ship card was silent on it.
 *
 * The craft sheet answers "what IS this hull" in four numbers, and since T6 a
 * fifth decides whether a fleet can be moved at all. It was in no screen in the
 * game: a commander could see that a Bulwark is slow and heavy in a hangar and had
 * no way to learn, short of packing one and reading the launch sheet, that it also
 * costs twelve Wasps' worth of deuterium to fly anywhere.
 *
 * A RATE, NOT A CHARGE. `missionFuel` rounds UP once per leg for the whole fleet,
 * so no column of these can be added into what the server takes — and that is the
 * point. This is the COMPARISON between hulls, quoted over `FUEL.reference` so the
 * table reads on one scale; the launch and transfer screens quote the charge
 * itself, off `missionFuel`, against the tank it comes out of.
 *
 * IT IS THE SAME MASS, so it cannot drift from the charge: both are `hullFuelMass`.
 * Ground defence is zero rather than its bulk — a gun never travels, and printing a
 * rate for one would invent a decision that does not exist.
 */
export function hullFuelRate(hull: HullId): number {
  return (hullFuelMass(hull) * FUEL.reference) / FUEL.scale;
}
