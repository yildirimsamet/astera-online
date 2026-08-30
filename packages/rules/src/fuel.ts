import { FUEL } from './constants.js';
import { HULLS, hangarLoad, hullBulk } from './hulls.js';
import type { Fleet, HullId } from './types.js';

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
 *   · MASS is `hangarLoad`, the same `bulk` the Hangar rations. One quantity for
 *     "how big is this fleet" doing both jobs, because two would drift apart at
 *     the first edit and the symptom would be a fleet that fits in a hangar it
 *     cannot afford to move. Ground defence weighs nothing here for the same
 *     reason it takes no hangar room: it never travels.
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
  const mass = hangarLoad(fleet);
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
 * IT IS THE SAME MASS, so it cannot drift from the charge: both are `hullBulk`,
 * which is also the Hangar's unit of room. Ground defence is zero rather than its
 * bulk — a gun never travels, and printing a rate for one would invent a decision
 * that does not exist.
 */
export function hullFuelRate(hull: HullId): number {
  if (HULLS[hull].ground) return 0;
  return (hullBulk(hull) * FUEL.reference) / FUEL.scale;
}
