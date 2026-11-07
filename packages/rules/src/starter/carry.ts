import type { DamageLots } from '../damage.js';
import { fleetEntries, fleetValue } from '../hulls.js';
import type { Fleet, Resources } from '../types.js';
import { STARTER } from './constants.js';

export interface VesselHoldings extends Resources {
  fleet: Fleet;
  damage: DamageLots;
}

export interface MigrationCargo extends Resources {
  fleet: Fleet;
}

/**
 * WHAT THE HOLD TAKES DOWN, on top of the standard first-season package. Plan §3.8.
 *
 * The ceiling is what keeps a second account from feeding the first through this galaxy. Only sound
 * ships go, the most valuable first: the rest of the fleet stays with the ship, and the ship is
 * spent. The confirmation screen shows this list before anything happens.
 */
export function migrationCargo(holdings: VesselHoldings): MigrationCargo {
  const healthy = fleetEntries(holdings.fleet).map(([hull, count]) => ({
    hull,
    count: count - holdings.damage.reduce((sum, lot) => sum + (lot.hull === hull ? lot.count : 0), 0),
    value: fleetValue({ [hull]: 1 }),
  }));
  healthy.sort((a, b) => b.value - a.value);

  const fleet: Fleet = {};
  let room: number = STARTER.carry.ships;
  for (const { hull, count } of healthy) {
    const taken = Math.min(room, Math.max(0, count));
    if (taken > 0) fleet[hull] = taken;
    room -= taken;
  }
  return {
    alloy: Math.floor(Math.min(holdings.alloy, STARTER.carry.alloy)),
    crystal: Math.floor(Math.min(holdings.crystal, STARTER.carry.crystal)),
    deuterium: Math.floor(Math.min(holdings.deuterium, STARTER.carry.deuterium)),
    fleet,
  };
}
