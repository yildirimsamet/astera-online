import { HULLS, MOBILE_HULLS, type HullFamily, type MobileHullId } from '@astera/rules';

/**
 * HOW A LIST OF SHIPS IS GROUPED, WHEREVER ONE IS SHOWN. Owner instruction.
 *
 * The shipyard catalogue and the sheet a fleet is committed on ask a player the
 * same question — which of these hulls do I want — and they used to answer it in
 * two different shapes: four authored bands on the tab, a flat tier-ordered list
 * in the picker. So the roles the whole of combat is decided by were taught on the
 * screen where nothing is at stake and withheld on the one screen where the
 * decision cannot be taken back.
 *
 * THE ORDER IS AUTHORED HERE AND NOWHERE ELSE. Two copies of it is a family that
 * gets moved on one surface and stays put on the other, which is worse than no
 * grouping at all: a player who has learnt the shipyard would be reading the
 * picker's bands off a memory that is now wrong.
 *
 * PRESERVED IS NOT A FLEET FAMILY. The two ground guns never leave and the drill
 * is not a warship; neither belongs in a band beside hulls that can be aimed at
 * something. Both surfaces handle them separately, and the type says so rather
 * than leaving it to a filter each caller writes again.
 */
export type FleetFamily = Exclude<HullFamily, 'PRESERVED'>;

/**
 * Offensive, Defensive, Special, Cargo.
 *
 * What a commander looks for first comes first: the two bands that decide a fight,
 * then the narrow answer to a problem they have already seen, then the hold that
 * only matters once the fight is won. Rows stay tier-ascending INSIDE a band, so
 * the cheap expression of a tactic sits above the researched one and the counter
 * class beneath both is never split up.
 */
export const FLEET_FAMILY_ORDER: readonly FleetFamily[] = [
  'OFFENSIVE',
  'DEFENSIVE',
  'SPECIALIST',
  'CARGO',
];

const of = (family: FleetFamily): readonly MobileHullId[] =>
  MOBILE_HULLS.filter((id) => HULLS[id].family === family);

/**
 * Every mobile hull of one family, in catalogue (tier-ascending) order.
 *
 * WRITTEN OUT RATHER THAN BUILT FROM THE ORDER ABOVE. A `fromEntries` over the
 * order needs a cast to become a `Record`, and a cast here would silently accept
 * a fifth family added to the union and never listed — exactly the drift this
 * module exists to prevent. Four keys spelled out means the compiler is the thing
 * that notices.
 */
export const HULLS_BY_FAMILY: Readonly<Record<FleetFamily, readonly MobileHullId[]>> = {
  OFFENSIVE: of('OFFENSIVE'),
  DEFENSIVE: of('DEFENSIVE'),
  SPECIALIST: of('SPECIALIST'),
  CARGO: of('CARGO'),
};

/** One band: what these hulls are for, and which of them the caller is showing. */
export interface FleetFamilyGroup {
  family: FleetFamily;
  hulls: readonly MobileHullId[];
}

/**
 * Group a selection of hulls into the roster's bands, dropping the empty ones.
 *
 * A caller passes what it actually has to show — the whole catalogue on the
 * shipyard tab, only the craft standing on the world in a launch picker — and
 * gets back bands with rows under them. An empty band is never returned: a
 * heading over nothing tells the player they own a kind of ship they do not.
 */
export function familyGroups(
  hulls: readonly MobileHullId[],
): FleetFamilyGroup[] {
  const offered = new Set(hulls);
  const groups: FleetFamilyGroup[] = [];
  for (const family of FLEET_FAMILY_ORDER) {
    const rows = HULLS_BY_FAMILY[family].filter((id) => offered.has(id));
    if (rows.length > 0) groups.push({ family, hulls: rows });
  }
  return groups;
}
