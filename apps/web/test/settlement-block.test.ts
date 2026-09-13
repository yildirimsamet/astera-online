import { describe, expect, it } from 'vitest';
import { MULTI_WORLD } from '@astera/rules';
import { settlementBlock, type SettlementBlockInput } from '../src/lib/colonization.js';

/**
 * D209 — OWNER INSTRUCTION: when a commander cannot found a colony, the control
 * says WHY above itself. One pure statement of the first unmet requirement, read
 * by both the disabled label and the note, so the two can never name different
 * reasons.
 */
const ready: SettlementBlockInput = {
  originRecovering: false,
  colonies: { colonies: 0, reservations: 0, capacity: 1, capitalCore: 9 },
  flight: { used: 0, total: 3 },
  couriers: MULTI_WORLD.settlement.transports,
  stock: { alloy: 50_000, crystal: 50_000, deuterium: 50_000 },
  fuel: 40,
  canArrive: true,
};

describe('settlementBlock', () => {
  it('is null when every requirement is met', () => {
    expect(settlementBlock(ready)).toBeNull();
  });

  it('names the Core the first colony opens at and the Core standing now', () => {
    expect(settlementBlock({
      ...ready,
      colonies: { colonies: 0, reservations: 0, capacity: 0, capitalCore: 4 },
    })).toEqual({ code: 'COLONY_CORE', requiredCore: 9, currentCore: 4 });
  });

  it('counts a colony already flying when naming the next threshold', () => {
    expect(settlementBlock({
      ...ready,
      colonies: { colonies: 1, reservations: 1, capacity: 2, capitalCore: 12 },
    })).toEqual({ code: 'COLONY_CORE', requiredCore: 15, currentCore: 12 });
  });

  it('says the ceiling has been reached once every slot the game has is taken', () => {
    expect(settlementBlock({
      ...ready,
      colonies: { colonies: 3, reservations: 0, capacity: 3, capitalCore: 20 },
    })).toEqual({ code: 'COLONY_MAX', max: 3 });
  });

  it('puts a recovering origin ahead of everything else', () => {
    expect(settlementBlock({
      ...ready,
      originRecovering: true,
      colonies: { colonies: 0, reservations: 0, capacity: 0, capitalCore: 1 },
    })).toEqual({ code: 'RECOVERING' });
  });

  it('walks the remaining requirements in the order the launch refuses them', () => {
    expect(settlementBlock({ ...ready, flight: { used: 3, total: 3 } })).toEqual({ code: 'FLIGHT_BAY' });
    expect(settlementBlock({ ...ready, couriers: 1 }))
      .toEqual({ code: 'COURIER', need: MULTI_WORLD.settlement.transports, have: 1 });
    expect(settlementBlock({ ...ready, stock: { ...ready.stock, alloy: 10 } }))
      .toEqual({ code: 'ALLOY', need: MULTI_WORLD.settlement.charge.alloy, have: 10 });
    expect(settlementBlock({ ...ready, stock: { ...ready.stock, crystal: 10 } }))
      .toEqual({ code: 'CRYSTAL', need: MULTI_WORLD.settlement.charge.crystal, have: 10 });
    expect(settlementBlock({ ...ready, stock: { ...ready.stock, deuterium: 10 } }))
      .toEqual({ code: 'FUEL', need: MULTI_WORLD.settlement.charge.deuterium + 40, have: 10 });
    expect(settlementBlock({ ...ready, canArrive: false })).toEqual({ code: 'TOO_LATE' });
  });

  it('reports the slot before a bay, a bay before a Courier and a Courier before ore', () => {
    expect(settlementBlock({
      ...ready,
      colonies: { colonies: 0, reservations: 0, capacity: 0, capitalCore: 5 },
      flight: { used: 3, total: 3 },
      couriers: 0,
      stock: { alloy: 0, crystal: 0, deuterium: 0 },
    })?.code).toBe('COLONY_CORE');
    expect(settlementBlock({
      ...ready, flight: { used: 3, total: 3 }, couriers: 0, stock: { alloy: 0, crystal: 0, deuterium: 0 },
    })?.code).toBe('FLIGHT_BAY');
    expect(settlementBlock({ ...ready, couriers: 0, stock: { alloy: 0, crystal: 0, deuterium: 0 } })?.code)
      .toBe('COURIER');
  });
});
