import { missionFuel, fuelMass } from './fuel.js';
import { fleetEntries } from './hulls.js';
import { normalizeMonumentLots, type MonumentShipLot } from './monument.js';
import type { Fleet, HullId } from './types.js';

export interface MonumentFuelReserves {
  perShip: Partial<Record<HullId, number>>;
  total: number;
}

/** Per-ship rounding ensures any selection can make even its own separate return. */
export function monumentFuelReserves(fleet: Fleet, maximumDistance: number): MonumentFuelReserves {
  if (!Number.isFinite(maximumDistance) || maximumDistance < 0) throw new RangeError('Invalid fuel reserve distance');
  const perShip: MonumentFuelReserves['perShip'] = {};
  let total = 0;
  for (const [hull, count] of fleetEntries(fleet)) {
    perShip[hull] = missionFuel({ [hull]: 1 }, maximumDistance, 1);
    total += perShip[hull] * count;
  }
  if (!Number.isSafeInteger(total)) throw new RangeError('Fuel reserve exceeds safe range');
  return { perShip, total };
}

/** Actual return price is rounded once for this departure, as ordinary mission fuel is. */
export function priceMonumentReturn(lots: readonly MonumentShipLot[], actualDistance: number): {
  lots: MonumentShipLot[]; fuel: number; refund: number;
} {
  if (!Number.isFinite(actualDistance) || actualDistance < 0) throw new RangeError('Invalid return distance');
  const rows = normalizeMonumentLots(lots);
  const funded = rows.filter(lot => (lot.returnFuelReserve ?? 0) > 0);
  const fleet: Fleet = {};
  for (const lot of funded) fleet[lot.hull] = (fleet[lot.hull] ?? 0) + lot.count;
  const fuel = missionFuel(fleet, actualDistance, 1);
  const reserve = funded.reduce((sum, lot) => sum + (lot.returnFuelReserve ?? 0), 0);
  if (fuel > reserve + 1e-7) throw new RangeError('Return exceeds reserved fuel');
  // Allocate the one integer invoice within each cohort's prepaid capacity.
  // Saturated cohorts drop out, so rounding cannot create a negative refund.
  let remaining = fuel;
  let mass = fuelMass(fleet);
  const charges = new Map<string, number>();
  const ordered = [...funded].sort((a, b) => (a.returnFuelReserve ?? 0) / fuelMass({ [a.hull]: a.count })
    - (b.returnFuelReserve ?? 0) / fuelMass({ [b.hull]: b.count }) || a.id.localeCompare(b.id));
  for (let i = 0; i < ordered.length; i++) {
    const lot = ordered[i]!;
    const weight = fuelMass({ [lot.hull]: lot.count });
    const charge = Math.min(lot.returnFuelReserve ?? 0, i === ordered.length - 1 ? remaining : remaining * weight / mass);
    charges.set(lot.id, charge);
    remaining = Math.max(0, remaining - charge);
    mass -= weight;
  }
  if (remaining > 1e-7) throw new RangeError('Return invoice could not be allocated');
  const result = rows.map(lot => ({ ...lot, returnFuelReserve: 0,
    fuelRefund: (lot.fuelRefund ?? 0) + Math.max(0, (lot.returnFuelReserve ?? 0) - (charges.get(lot.id) ?? 0)) }));
  return { lots: result, fuel, refund: result.reduce((sum, lot) => sum + lot.fuelRefund, 0) };
}
