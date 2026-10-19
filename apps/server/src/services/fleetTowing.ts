import { fleetEntries, type Fleet } from '@astera/rules';

/** Legacy pirate/convoy rosters keep prizes separately; HP rosters already include them. */
export function rewardFlightFleet(aboard: Fleet, prizes: Fleet | null | undefined, included: boolean): {
  fleet: Fleet; towing?: Fleet;
} {
  const fleet = { ...aboard };
  const towing: Fleet = {};
  for (const [hull, count] of fleetEntries(prizes ?? {})) {
    if (!included) fleet[hull] = (fleet[hull] ?? 0) + count;
    const carried = Math.min(count, fleet[hull] ?? 0);
    if (carried > 0) towing[hull] = carried;
  }
  return { fleet, ...(Object.keys(towing).length ? { towing } : {}) };
}
