import { admiralApplies, admiralBonuses, type AdmiralBonuses, type ShipClass } from '@astera/rules/arena';
import type { CommanderShipView } from '../api/commanderShipSchemas.js';

/**
 * THE COMMANDER SHIP AS A RAID ESCORT (Y9, owner 2026-10-25, doc 22 "Amiral savaşmaz").
 *
 * It never fires and is never hit; it lends its class bonus and goes to repair when the battle is
 * lost. The launch sheet offers it only in a season that carries escorts and only when there is a
 * ship; a ship that is busy is shown with what keeps it home, so the player knows when it can fly.
 */
export type Escort =
  | { kind: 'ready'; ship: ShipClass; level: number; bonuses: AdmiralBonuses }
  | { kind: 'busy'; ship: ShipClass; level: number; reason: 'repair' | 'service' | 'yarik' | 'admiral'; until: number | null };

export function escortOf(view: CommanderShipView | undefined, now: number): Escort | null {
  const ship = view?.ship;
  if (!view || !ship || !(view.admiral ?? admiralApplies(view.rulesetVersion))) return null;
  const base = { ship: ship.class, level: ship.level };
  if (ship.status === 'yarik' || ship.status === 'admiral') return { kind: 'busy', ...base, reason: ship.status, until: null };
  const until = ship.readyAt === null ? null : Date.parse(ship.readyAt);
  if (until !== null && until > now) return { kind: 'busy', ...base, reason: ship.status === 'service' ? 'service' : 'repair', until };
  return { kind: 'ready', ...base, bonuses: admiralBonuses(ship.class, ship.level) };
}

/**
 * The route as the server flies it with an escort (`launchAttack`, `launchPirateRaid`): both legs
 * shorter, fuel rounded up. A pirate meeting the server already `solved` at the escorted speed
 * (`escortReach`) keeps its outbound minutes; only the way home shortens.
 */
export function escortRoute<R extends { oneWayMinutes: number; exposureMinutes: number; fuel: number }>(route: R, bonuses: AdmiralBonuses | null, solved = false): R {
  if (!bonuses) return route;
  const oneWayMinutes = solved ? route.oneWayMinutes : route.oneWayMinutes * bonuses.time;
  return { ...route, oneWayMinutes, exposureMinutes: oneWayMinutes + (route.exposureMinutes - route.oneWayMinutes) * bonuses.time,
    fuel: Math.ceil(route.fuel * bonuses.fuel) };
}
