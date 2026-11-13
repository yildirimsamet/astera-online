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

/**
 * WHAT THE JUMP WOULD TAKE DOWN, BEFORE THE CEILING (plan 2026-11-13 §5.2). The store, the works, what
 * work in progress pays back in full when the jump calls it off, and the ready crates the jump opens
 * before it counts. The panel, the return reminder and the ship's own screens all read the hold here.
 */
export function jumpHold(
  ship: Resources & { bufferAlloy: number; bufferCrystal: number; bufferDeuterium: number },
  orders: readonly { cost: Resources }[],
  crates: readonly Pick<Resources, 'alloy' | 'crystal'>[],
): Resources {
  const sum = (pick: (r: Resources) => number) => orders.reduce((total, order) => total + pick(order.cost), 0);
  return {
    alloy: ship.alloy + ship.bufferAlloy + sum(r => r.alloy) + crates.reduce((total, crate) => total + crate.alloy, 0),
    crystal: ship.crystal + ship.bufferCrystal + sum(r => r.crystal) + crates.reduce((total, crate) => total + crate.crystal, 0),
    deuterium: ship.deuterium + ship.bufferDeuterium + sum(r => r.deuterium),
  };
}

/**
 * NOTHING MORE WOULD GO DOWN WITH IT (plan 2026-11-13 §5.2–5.3): alloy and crystal at their ceiling.
 * Deuterium is left out: its ceiling is small and the flights spend it, so it would never stay full.
 */
export const holdIsFull = (cargo: Pick<MigrationCargo, 'alloy' | 'crystal'>): boolean =>
  cargo.alloy >= STARTER.carry.alloy && cargo.crystal >= STARTER.carry.crystal;
