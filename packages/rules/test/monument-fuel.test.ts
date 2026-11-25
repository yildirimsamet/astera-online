import { describe, expect, it } from 'vitest';
import { missionFuel, monumentFuelReserves, priceMonumentReturn, recallMonumentShips, splitMonumentBattleSurvivors,
  type MonumentShipLot } from '../src/index.js';

const lot: MonumentShipLot = { id: 'a', playerId: 'p', waveId: 'w', hull: 'COURIER', count: 10,
  damageBp: 0, remainderBp: 0, deuterium: 100, tech: {}, returnFuelReserve: 1000, fuelRefund: 20 };

describe('per-cohort monument fuel escrow', () => {
  it('reserves enough for each ship to return separately from the farthest allowed point', () => {
    const fleet = { COURIER: 10, CITADEL: 2 };
    const budget = monumentFuelReserves(fleet, 10_500);
    expect(budget.total).toBeGreaterThanOrEqual(missionFuel(fleet, 10_500, 1));
    expect(budget.perShip.COURIER).toBe(missionFuel({ COURIER: 1 }, 10_500, 1));
    expect(budget.total).toBe(10 * budget.perShip.COURIER! + 2 * budget.perShip.CITADEL!);
  });
  it('splits escrow and pending refunds with the actual recalled ships, conserving every fraction', () => {
    const split = recallMonumentShips([lot], 'p', [{ lotId: 'a', count: 3, returnLotId: 'r' }]);
    expect(split.recalled[0]).toMatchObject({ count: 3, returnFuelReserve: 300, fuelRefund: 6 });
    expect(split.remaining[0]).toMatchObject({ count: 7, returnFuelReserve: 700, fuelRefund: 14 });
  });
  it('burns only the true return charge and carries the unspent amount until landing', () => {
    const result = priceMonumentReturn([lot], 800);
    expect(result.fuel).toBe(missionFuel({ COURIER: 10 }, 800, 1));
    expect(result.lots[0]!.returnFuelReserve).toBe(0);
    expect(result.refund).toBeCloseTo(1020 - result.fuel, 10);
    expect(result.lots[0]!.fuelRefund).toBeCloseTo(result.refund, 10);
  });
  it('keeps the legacy prepaid right without a new charge or refund', () => {
    const legacy = { ...lot, returnFuelReserve: 0, fuelRefund: 0 };
    expect(priceMonumentReturn([legacy], 10_500)).toMatchObject({ fuel: 0, refund: 0 });
  });
  it('burns lost ships’ escrow instead of moving it to the survivors', () => {
    const survivors = splitMonumentBattleSurvivors(lot, { survivors: 7, damage: [] }, ['after']).lots;
    expect(survivors[0]).toMatchObject({ returnFuelReserve: 700, fuelRefund: 14 });
    const result = priceMonumentReturn(survivors, 1000);
    expect(result.refund).toBeCloseTo(714 - result.fuel, 10);
  });
  it('refuses an invalid distance or insufficient reserve without mutating physical lots', () => {
    expect(() => priceMonumentReturn([lot], Infinity)).toThrow();
    expect(() => priceMonumentReturn([{ ...lot, returnFuelReserve: 1 }], 10_500)).toThrow();
    expect(lot.returnFuelReserve).toBe(1000);
  });
  it('applies +25% Honor fuel surcharge consistently to reserves and returns without refunding the surcharge', () => {
    const fleet = { COURIER: 10, CITADEL: 2 };
    const base = monumentFuelReserves(fleet, 10_500);
    const taxed = monumentFuelReserves(fleet, 10_500, 25);
    expect(taxed.perShip.COURIER).toBe(Math.ceil(base.perShip.COURIER! * 1.25));
    expect(taxed.total).toBe(10 * taxed.perShip.COURIER! + 2 * taxed.perShip.CITADEL!);
    const reserve = 10 * taxed.perShip.COURIER!;
    const taxedLot: MonumentShipLot = {
      ...lot,
      returnFuelReserve: reserve,
      fuelRefund: 0,
    };
    const ret = priceMonumentReturn([taxedLot], 10_500, 25);
    const expectedFuel = Math.ceil(missionFuel({ COURIER: 10 }, 10_500, 1) * 1.25);
    expect(ret.fuel).toBe(expectedFuel);
    expect(ret.fuel).toBeLessThanOrEqual(reserve);
    expect(ret.refund).toBeCloseTo(reserve - expectedFuel, 10);
  });
});
