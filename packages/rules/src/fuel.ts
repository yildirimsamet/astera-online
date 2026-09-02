import { FUEL } from './constants.js';
import { HULLS, fleetEntries, hullBulk } from './hulls.js';
import type { Fleet, HullId } from './types.js';

/**
 * THE MASS A FUEL CHARGE IS MEASURED IN. T6 · D153.
 *
 * Hangar room, times the tier's own thirst rung. `FUEL.tierMass` states why the
 * multiplier is here rather than folded into `bulk`: room and thirst are two jobs,
 * and one number doing both would re-rate every hull against the Hangar the next
 * time fuel moved.
 *
 * ZERO FOR A GROUND HULL rather than its bulk, for the same reason it takes no
 * hangar room: a gun never travels. A hull with no tier — the Prospector — is at the
 * bottom rung, and burns nothing in practice because a mining run is not charged
 * (D136).
 */
export function hullFuelMass(hull: HullId): number {
  const spec = HULLS[hull];
  if (spec.ground) return 0;
  return hullBulk(hull) * (spec.tier === null ? 1 : FUEL.tierMass[spec.tier]);
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
