import { groundLoad, groundSlots, hangarCapacity, hangarLoad } from '@astera/rules';
import type { PlanetView } from '../api/schemas.js';
import { projectedQueueState } from './predict.js';

/** A world's room, part by part, in room units. */
export interface RoomParts {
  total: number;
  /** Standing on this world. */
  home: number;
  /** Out flying: a ship holds its Hangar room for the whole round trip. */
  away: number;
  /** Paid for and waiting in the yard. */
  queued: number;
}

/**
 * WHERE A WORLD'S ROOM HAS GONE: the Hangar for what flies, the ground for the guns.
 *
 * The yard projection is what the server checks an order against — everything owned,
 * home or away, plus every earlier yard order — so the whole is its load; home and away
 * are read off the payload and the queue is what is left.
 */
export function roomParts(view: PlanetView, ground: boolean): RoomParts {
  const load = ground ? groundLoad : hangarLoad;
  const total = ground
    ? view.capacity?.ground ?? groundSlots(view.buildings.CORE ?? 0)
    : view.capacity?.hangar ?? hangarCapacity(view.buildings.HANGAR ?? 0);
  const home = load(ground ? view.ground : view.fleet);
  const away = ground ? 0 : load(view.fleetAway);
  const used = load(projectedQueueState(view, 'YARD').units);
  return { total, home, away, queued: Math.max(0, used - home - away) };
}
