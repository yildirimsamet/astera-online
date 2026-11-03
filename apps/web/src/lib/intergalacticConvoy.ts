import { MOBILE_HULLS, combatValue, partitionCombatFleet } from '@astera/rules';
import { flightModifiers, planIntergalacticConvoyRoute } from './navigation.js';
import type { ActiveGalaxyEvent, PlanetView } from '../api/schemas.js';

export type IntergalacticConvoyEvent = Extract<
  ActiveGalaxyEvent,
  { kind: 'INTERGALACTIC_CONVOY' }
>;

/** The one public convoy whose half-open occurrence window contains `now`. */
export function activeIntergalacticConvoy(
  events: readonly ActiveGalaxyEvent[] | undefined,
  now: number,
): IntergalacticConvoyEvent | null {
  for (const event of events ?? []) {
    if (event.kind === 'INTERGALACTIC_CONVOY'
      && event.startsAt.getTime() <= now
      && now < event.endsAt.getTime()) {
      return event;
    }
  }
  return null;
}

/** Discovery uses the selectable fleet and actual departure instant, like the strike sheet. */
export function convoyOpportunity(
  convoy: IntergalacticConvoyEvent | null,
  home: PlanetView | undefined,
  seasonStart: Date | undefined,
  now: number,
): { hasCombatCraft: boolean; reachMinutes: number | null } {
  if (!convoy || !home || !seasonStart) return { hasCombatCraft: false, reachMinutes: null };
  const ready = home.fleetCombatReady ?? partitionCombatFleet(home.fleet, home.fleetDamage).eligible;
  const armed = MOBILE_HULLS.filter(hull => (ready[hull] ?? 0) > 0 && combatValue({ [hull]: 1 }) > 0);
  const mods = flightModifiers(home);
  const departAtMinute = (now - seasonStart.getTime()) / 60000;
  let reachMinutes: number | null = null;
  for (const hull of armed) {
    const route = planIntergalacticConvoyRoute(home.planet.position, convoy, departAtMinute,
      { [hull]: 1 }, ready, home.ground, mods);
    if (route && (reachMinutes === null || route.oneWayMinutes < reachMinutes)) reachMinutes = route.oneWayMinutes;
  }
  return { hasCombatCraft: armed.length > 0, reachMinutes };
}
