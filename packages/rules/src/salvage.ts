import { DEBRIS, SALVAGE } from './constants.js';
import { claimDebris } from './galaxy.js';
import { HULLS, fleetEntries } from './hulls.js';
import type { Fleet, Resources } from './types.js';

/**
 * HOW MUCH WRECK THIS FLEET CAN LIFT ON THE WAY HOME. D200.
 *
 * Read off the hull table's profile rather than a name, so the day a second
 * collector exists it lifts without anybody remembering to list it. Pass the
 * SURVIVORS: a collector that died in the fight is part of the wreck, not a
 * hand reaching into it.
 */
export function salvageCapacity(fleet: Fleet): number {
  let room = 0;
  for (const [id, count] of fleetEntries(fleet)) {
    if (HULLS[id].profile === 'COLLECTOR') room += count * SALVAGE.perCollector;
  }
  return room;
}

/** What a battle's wreck becomes once the attacker's collectors have had their go. */
export interface WreckSettlement {
  /** Whole units lifted by the surviving collectors. Flies home with them. */
  salvage: Resources;
  /**
   * What is left in orbit as the ordinary public field, or null when what is left
   * is under `DEBRIS.minimum` — the same floor every field has always answered to.
   */
  field: Resources | null;
}

const NOTHING: Resources = { alloy: 0, crystal: 0, deuterium: 0 };

/**
 * THE ONE STATEMENT OF WHAT A BATTLE LEAVES BEHIND. D200.
 *
 * `wreck` is the field the battle made, priced exactly as every lane has always
 * priced it (`DEBRIS.share` of the non-ground hulls that died). The collectors in
 * `survivors` lift from it FIRST — at the instant the fight resolves, which is the
 * instant their return leg departs — and whatever they leave is the public field.
 * One transaction, no second race: nobody can reach a field before it exists, so
 * "the collector got there first" is not a rule anybody has to adjudicate.
 *
 * THE SPLIT IS `claimDebris`, the Prospector's own arithmetic, so a collector's
 * haul and a harvest of the same field come home in the same proportions — the
 * owner's *"debris'in içindeki maddelerin oranlarına göre"* — floored per column,
 * so nothing is ever lifted that was not there.
 *
 * THE FLOOR IS ON WHAT IS LEFT, NOT ON WHAT WAS MADE. `DEBRIS.minimum` exists so
 * the disc is not littered with fields worth less than the flight to them; a
 * collector is already on the spot, so it takes a scrap no public field would have
 * been drawn for. What it leaves under the floor is no field at all, exactly as a
 * battle with no collector has always left none.
 *
 * With no collector among the survivors the field is the wreck, untouched — every
 * battle without one resolves exactly as it did before the hull existed.
 */
export function settleWreck(wreck: Resources, survivors: Fleet): WreckSettlement {
  const room = salvageCapacity(survivors);
  const salvage = room > 0
    ? claimDebris(wreck.alloy, wreck.crystal, wreck.deuterium, room)
    : { ...NOTHING };
  const left: Resources = {
    alloy: Math.max(0, wreck.alloy - salvage.alloy),
    crystal: Math.max(0, wreck.crystal - salvage.crystal),
    deuterium: Math.max(0, wreck.deuterium - salvage.deuterium),
  };
  const worth = left.alloy + left.crystal + left.deuterium;
  return { salvage, field: worth >= DEBRIS.minimum ? left : null };
}
