import { describe, expect, it } from 'vitest';
import {
  computeLoot,
  emptyLedger,
  bookBattle,
  dominion,
  fleetCount,
  fleetPower,
  fleetValue,
  mulberry32,
  resolveCombat,
} from '../src/index.js';

const rng = () => mulberry32(12345);
const flat = () => () => 0.5;

describe('counter cycle', () => {
  it('Wasps break Bastions cheaply — the anti-turtle tool', () => {
    const r = resolveCombat({ WASP: 60 }, { BASTION: 4 }, 0, flat());
    expect(r.grade).toBe('DECISIVE');
    // The defence still gets one round of fire in; the point is the exchange rate.
    expect(fleetValue(r.attackerLosses)).toBeLessThan(fleetValue(r.defenderLosses) / 5);
  });

  it('a lone Bastion cannot even scratch a Wasp swarm', () => {
    // 34 ATK x 0.625 into Skirmishers = 21 damage, under a Wasp's 24 HP.
    const r = resolveCombat({ WASP: 26 }, { BASTION: 1 }, 0, flat());
    expect(fleetCount(r.attackerLosses)).toBe(0);
  });

  it('Lances lose badly into Bastions', () => {
    const wasps = resolveCombat({ WASP: 60 }, { BASTION: 4 }, 0, flat());
    const lances = resolveCombat({ LANCE: 17 }, { BASTION: 4 }, 0, flat());
    // Roughly equal alloy spent, wildly different outcome.
    expect(fleetValue(lances.attackerLosses)).toBeGreaterThan(
      fleetValue(wasps.attackerLosses),
    );
  });
});

describe('grading uses value, not power', () => {
  /**
   * REGRESSION: grading once used Sum(count x ATK x HP). 26 Wasps (power 8.7) and
   * 1 Bastion (power 8.8) read as equal under that metric while the Wasps
   * annihilate it, so every fight involving a counter was mis-scored.
   */
  it('power says these are equal; combat says otherwise', () => {
    expect(fleetPower({ WASP: 26 })).toBeCloseTo(fleetPower({ BASTION: 1 }), 0);
    const r = resolveCombat({ WASP: 26 }, { BASTION: 1 }, 0, flat());
    expect(r.grade).toBe('DECISIVE');
    expect(fleetCount(r.attackerLosses)).toBe(0);
  });
});

describe('support hulls', () => {
  /**
   * REGRESSION: Haulers (80 HP, taking 1.6x from everything) died in round one,
   * so attackers arrived with no cargo and raiding could not pay for itself.
   */
  it('survive while escorted', () => {
    const r = resolveCombat({ WASP: 80, HAULER: 10 }, { BASTION: 2 }, 0, flat());
    expect(r.attackerLosses.HAULER ?? 0).toBe(0);
  });

  it('are exposed once the escort is gone', () => {
    const r = resolveCombat({ HAULER: 10 }, { BASTION: 6 }, 0, flat());
    expect(r.attackerLosses.HAULER ?? 0).toBeGreaterThan(0);
  });

  it('contribute no damage', () => {
    const escorted = resolveCombat({ WASP: 30, HAULER: 20 }, { BASTION: 3 }, 0, flat());
    const alone = resolveCombat({ WASP: 30 }, { BASTION: 3 }, 0, flat());
    expect(escorted.defenderLossValue).toBe(alone.defenderLossValue);
  });
});

describe('shields', () => {
  it('absorb the whole assault when large enough', () => {
    const r = resolveCombat({ WASP: 20 }, { BASTION: 2 }, 100_000, flat());
    expect(r.grade).toBe('REPELLED');
    expect(fleetCount(r.defenderLosses)).toBe(0);
    expect(r.shieldLeft).toBeGreaterThan(0);
  });
});

describe('defence salvage', () => {
  it('rebuilds 60% of destroyed turrets', () => {
    const r = resolveCombat({ WASP: 200 }, { BASTION: 10 }, 0, flat());
    expect(r.defenderLosses.BASTION).toBe(10);
    expect(r.defenceSalvage.BASTION).toBe(6);
  });

  it('excludes salvaged units from scored value', () => {
    const r = resolveCombat({ WASP: 200 }, { BASTION: 10 }, 0, flat());
    expect(r.defenderLossValue).toBeLessThan(fleetValue(r.defenderLosses));
    expect(r.defenderLossValue).toBeGreaterThanOrEqual(0);
  });

  it('never salvages mobile hulls', () => {
    const r = resolveCombat({ WASP: 200 }, { WASP: 10 }, 0, flat());
    expect(r.defenceSalvage.WASP).toBeUndefined();
  });
});

describe('outcome grades', () => {
  it('produces all three across a spread of matchups', () => {
    const grades = new Set([
      resolveCombat({ WASP: 400 }, { BASTION: 2 }, 0, rng()).grade,
      resolveCombat({ WASP: 46 }, { BASTION: 4 }, 0, rng()).grade,
      resolveCombat({ WASP: 5 }, { BASTION: 10 }, 0, rng()).grade,
    ]);
    expect(grades.has('DECISIVE')).toBe(true);
    expect(grades.has('REPELLED')).toBe(true);
  });

  it('is low-variance — intel must beat luck', () => {
    const results = Array.from({ length: 200 }, (_, i) =>
      resolveCombat({ WASP: 60 }, { BASTION: 3 }, 0, mulberry32(i)),
    );
    const losses = results.map((r) => fleetCount(r.attackerLosses));
    const spread = Math.max(...losses) - Math.min(...losses);
    const mean = losses.reduce((a, b) => a + b, 0) / losses.length;
    expect(spread).toBeLessThan(Math.max(4, mean * 0.6));
  });
});

describe('loot', () => {
  const stock = { alloy: 60_000, crystal: 8_000 };

  it('takes half of what is above the vault floor', () => {
    const loot = computeLoot(stock, 10_000, 'DECISIVE', 1_000_000);
    expect(loot.alloy).toBe(25_000);
  });

  it('never exceeds cargo', () => {
    const loot = computeLoot(stock, 0, 'DECISIVE', 900);
    expect(loot.alloy + loot.crystal).toBeLessThanOrEqual(900);
  });

  it('cannot touch anything below the vault floor', () => {
    expect(computeLoot({ alloy: 500, crystal: 100 }, 5_000, 'DECISIVE', 99_999)).toEqual({
      alloy: 0,
      crystal: 0,
    });
  });

  it('the 50% rule IS the repeat-raid decay', () => {
    let alloy = 80_000;
    const taken: number[] = [];
    for (let i = 0; i < 3; i++) {
      const loot = computeLoot({ alloy, crystal: 0 }, 0, 'DECISIVE', 1_000_000);
      taken.push(loot.alloy);
      alloy -= loot.alloy;
    }
    expect(taken[1]!).toBeCloseTo(taken[0]! / 2, 0);
    expect(taken[2]!).toBeCloseTo(taken[0]! / 4, 0);
  });

  it('a repelled raid takes nothing', () => {
    expect(computeLoot(stock, 0, 'REPELLED', 99_999)).toEqual({ alloy: 0, crystal: 0 });
  });
});

describe('dominion', () => {
  it('sums to exactly zero across a battle', () => {
    const atk = emptyLedger();
    const def = emptyLedger();
    const r = resolveCombat({ WASP: 90, HAULER: 6 }, { BASTION: 4, WASP: 20 }, 0, rng());
    bookBattle(atk, def, 12_000, r);
    expect(dominion(atk) + dominion(def)).toBe(0);
  });

  it('rewards a defender who repels an attack', () => {
    const atk = emptyLedger();
    const def = emptyLedger();
    const r = resolveCombat({ WASP: 8 }, { BASTION: 12 }, 0, rng());
    bookBattle(atk, def, 0, r);
    expect(dominion(def)).toBeGreaterThan(0);
    expect(dominion(atk)).toBeLessThan(0);
  });

  it('is zero for a player who never fights', () => {
    expect(dominion(emptyLedger())).toBe(0);
  });
});
