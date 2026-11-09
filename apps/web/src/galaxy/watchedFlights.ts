import { JUMP_FLIGHT, starterGalaxyCentre, toWorld, watchedStop, type Vec3, type VesselHull } from '@astera/rules';
import type { Point } from './jumpCamera.js';

/** A jump somebody else is making, as a watcher draws it: from the berth to the main galaxy's rim. */
export interface WatchedFlight { key: string; hull: VesselHull; from: Point; stop: Point; at: number }

/** Rows older than this are not drawn at all; the flight itself is over well before. */
const KEEP_MS = 60_000;
const moved = (p: Vec3, by: Vec3): Vec3 => ({ x: p.x + by.x, y: p.y + by.y, z: p.z + by.z });
const back = (p: Vec3, by: Vec3): Vec3 => ({ x: p.x - by.x, y: p.y - by.y, z: p.z - by.z });

/** The neighbours who left, in their galaxy's frame; `offset` is the main galaxy's centre there. */
export function departuresWatched(rows: readonly { name: string; at: Date; x: number; y: number; z: number; hull: VesselHull }[], offset: Vec3, now: number): WatchedFlight[] {
  return rows.flatMap(row => {
    if (now - row.at.getTime() > KEEP_MS) return [];
    const berth = { x: row.x, y: row.y, z: row.z };
    const stop = moved(watchedStop(back(berth, offset)), offset);
    return [{ key: `${row.name}:${String(row.at.getTime())}`, hull: row.hull, from: toWorld(berth), stop: toWorld(stop), at: row.at.getTime() }];
  });
}

/** The newcomers coming in, in the main galaxy's frame. */
export function inboundWatched(rows: readonly { hull: VesselHull; ordinal: number; at: Date; x: number; y: number; z: number }[], now: number): WatchedFlight[] {
  return rows.flatMap((row, index) => {
    if (now - row.at.getTime() > KEEP_MS) return [];
    const berth = moved({ x: row.x, y: row.y, z: row.z }, starterGalaxyCentre(row.ordinal));
    return [{ key: `${String(row.ordinal)}:${String(row.at.getTime())}:${String(index)}`, hull: row.hull, from: toWorld(berth), stop: toWorld(watchedStop(berth)), at: row.at.getTime() }];
  });
}

/** Two berths closer than this, in world units, are one: the board keeps the ship's own coordinates. */
const SAME_BERTH = 0.01;

/** The parked ships, without those flying off in the sky: one ship is never drawn twice. */
export function withoutLeaving<T extends { position: readonly number[] }>(ships: readonly T[], flights: readonly WatchedFlight[]): readonly T[] {
  if (flights.length === 0) return ships;
  return ships.filter(ship => !flights.some(flight =>
    Math.hypot(ship.position[0]! - flight.from[0], ship.position[1]! - flight.from[1], ship.position[2]! - flight.from[2]) < SAME_BERTH));
}

/** The ids of the parked ships flying off: their names leave the berth with them. */
export function leavingIds(ships: readonly { id: string; position: readonly number[] }[], flights: readonly WatchedFlight[]): ReadonlySet<string> {
  const staying = new Set(withoutLeaving(ships, flights));
  return new Set(ships.filter(ship => !staying.has(ship)).map(ship => ship.id));
}

/** Seconds into the flight, or null while it is not in the sky. */
export function watchSeconds(flight: WatchedFlight, now: number): number | null {
  const s = (now - flight.at) / 1000;
  return s >= 0 && s < JUMP_FLIGHT.gone ? s : null;
}
