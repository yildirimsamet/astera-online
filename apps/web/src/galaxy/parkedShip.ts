import type { ShipClass } from '@astera/rules/arena';
import type { CommanderShipView } from '../api/commanderShipSchemas.js';

/**
 * THE COMMANDER SHIP BESIDE ITS CAPITAL (KG-A20, plan 14 §13, doc 22).
 *
 * Only the asking commander's own ship, only at its own capital, and only while it is home: a ship
 * in the Rift or out with a fleet is not drawn. Everything here comes from the server's reply; the
 * client invents no position or state of its own, it only reads the repair clock it was given.
 *
 * The same language as the satellites: a live ship circles its world, a ship under repair or
 * service stands still at one place, the way dormant hardware holds its phase.
 */
export interface ParkedShip {
  planetId: string; ship: ShipClass; level: number; docked: boolean;
  /** While docked: what keeps it there, and until when (ms). */
  reason: 'repair' | 'service' | null; until: number | null;
}

export function parkedShip(view: CommanderShipView | undefined, now: number): ParkedShip | null {
  const ship = view?.ship;
  if (!view || !ship || ship.status === 'yarik' || ship.status === 'admiral') return null;
  const until = ship.readyAt === null ? null : Date.parse(ship.readyAt);
  const docked = until !== null && until > now;
  return { planetId: view.capitalPlanetId, ship: ship.class, level: ship.level, docked,
    reason: docked ? ship.status === 'service' ? 'service' : 'repair' : null, until: docked ? until : null };
}

/** The ship flying home alone after its fleet (Y9): the server's way, until it lands. */
export interface HomewardShip {
  ship: ShipClass; level: number;
  path: { from: { x: number; y: number; z: number }; to: { x: number; y: number; z: number }; departAt: Date; arriveAt: Date };
}

export function homewardShip(view: CommanderShipView | undefined, now: number): HomewardShip | null {
  const ship = view?.ship; const way = view?.homeward;
  if (!ship || !way) return null;
  const arriveAt = Date.parse(way.arriveAt);
  if (arriveAt <= now) return null;
  return { ship: ship.class, level: ship.level, path: { from: way.from, to: way.to, departAt: new Date(way.departAt), arriveAt: new Date(arriveAt) } };
}

/** When to ask again: at the end of the repair or the lone flight home, bounded so a wrong clock costs little. */
export function refreshAfter(view: CommanderShipView | undefined, now: number): number {
  const ends = [view?.ship?.readyAt, view?.homeward?.arriveAt].flatMap(at => at ? [Date.parse(at) - now] : []);
  return Math.min(60_000, Math.max(5_000, Math.min(Number.POSITIVE_INFINITY, ...ends)));
}

/**
 * The orbit, in planet radii. Home frames a world about 1.75 radii either side on a 350 px phone
 * (measured), so a wider orbit spent most of its circuit off screen; this one stays in view and
 * passes behind the world. Slower than the satellites, and the largest thing beside it.
 */
export const PARK = { radius: 1.7, tilt: 0.22, period: 72, length: 0.7, dockedPhase: 0.7 } as const;

export interface ParkPose { x: number; y: number; z: number; yaw: number }

/** Where the ship is `seconds` into the scene's clock; its nose (+Z) along its travel. */
export function parkPose(planet: { position: readonly [number, number, number]; radius: number }, seconds: number, docked: boolean): ParkPose {
  const angle = docked ? PARK.dockedPhase : PARK.dockedPhase + (seconds / PARK.period) * Math.PI * 2;
  const r = planet.radius * PARK.radius;
  const [px, py, pz] = planet.position;
  // Velocity along the angle is (-sin, ·, cos): the heading of +Z turned by yaw is atan2(vx, vz).
  return { x: px + Math.cos(angle) * r, y: py + Math.sin(angle) * r * PARK.tilt, z: pz + Math.sin(angle) * r, yaw: Math.atan2(-Math.sin(angle), Math.cos(angle)) };
}
