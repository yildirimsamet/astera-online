import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  HULLS,
  RESEARCH_TECH,
  applyMonumentHpDose,
  combatValue,
  monumentCargoCapacity,
  produceMonumentDeuterium,
  recallMonumentShips,
  settleMonumentHold,
  transferCargoCapacity,
  type HpRadiationSource,
  type MonumentShipLot,
  type MobileHullId,
} from '../src/index.js';

// Fixture rates describe arithmetic, not approved production/radiation balance.
const MIN = 60_000;
const position = { x: 0, y: 0, z: 0 };
const lot = (id: string, playerId: string, hull: MobileHullId, over: Partial<MonumentShipLot> = {}): MonumentShipLot => ({
  id, playerId, waveId: `${playerId}-wave`, hull, count: 1,
  damageBp: 0, remainderBp: 0, deuterium: 0, tech: {}, ...over,
});
const pair = (playerId: string, over: Partial<MonumentShipLot> = {}): MonumentShipLot[] => [
  lot(`${playerId}-fighter`, playerId, 'DART', over),
  lot(`${playerId}-cargo`, playerId, 'COURIER'),
];
const emit = (rate: number, over: Partial<HpRadiationSource> = {}): HpRadiationSource => ({
  id: 'cloud', mode: 'EMIT', center: position, radius: 10,
  intensityHpPerMinute: rate, activeFromMs: 0, activeUntilMs: null, ...over,
});
const amountFor = (result: { shares: readonly { playerId: string; deuterium: number }[] }, playerId: string): number =>
  result.shares.find((row) => row.playerId === playerId)?.deuterium ?? 0;
const loadOf = (lots: readonly MonumentShipLot[]): number => lots.reduce((sum, row) => sum + row.deuterium, 0);
const cargo = (lots: readonly MonumentShipLot[], id: string): MonumentShipLot => {
  const found = lots.find((row) => row.id === id);
  if (!found) throw new Error(`missing fixture lot ${id}`);
  return found;
};
const hold = (lots: readonly MonumentShipLot[], minutes: number, sources: readonly HpRadiationSource[] = []) =>
  settleMonumentHold(lots, { fromMs: 0, toMs: minutes * MIN, position, productionPerMinute: 60, sources });

describe('monument fixed production and physical cargo', () => {
  it('pays a fixed total by each owner’s combined alive combat power', () => {
    const lots = [...pair('a', { count: 2 }), ...pair('b')];
    const result = produceMonumentDeuterium(lots, 90);
    expect(amountFor(result, 'a')).toBeCloseTo(60);
    expect(amountFor(result, 'b')).toBeCloseTo(30);
    expect(loadOf(result.lots)).toBeCloseTo(90);
    expect(result.discardedDeuterium).toBe(0);
    expect(cargo(result.lots, 'a-fighter').deuterium).toBe(0);
  });

  it('does not change a player’s share when their combat contribution is split into waves', () => {
    const whole = produceMonumentDeuterium([...pair('a', { count: 2 }), ...pair('b')], 90);
    const split = produceMonumentDeuterium([
      ...pair('a'), lot('a-second', 'a', 'DART', { waveId: 'other-origin' }), ...pair('b'),
    ], 90);
    expect(split.shares).toEqual(whole.shares);
    expect(loadOf(split.lots)).toBeCloseTo(loadOf(whole.lots));
  });

  it('excludes cargo-only owners and fighters without their own free cargo', () => {
    const result = produceMonumentDeuterium([
      lot('cargo-only', 'a', 'ARGOSY'), lot('no-cargo', 'b', 'CITADEL'), ...pair('c'),
    ], 90);
    expect(amountFor(result, 'a')).toBe(0);
    expect(amountFor(result, 'b')).toBe(0);
    expect(amountFor(result, 'c')).toBe(90);
  });

  it('uses combatValue consistently across different hulls', () => {
    const result = produceMonumentDeuterium([...pair('a'), ...pair('b', { hull: 'CITADEL' })], 100);
    const a = combatValue({ DART: 1 });
    const b = combatValue({ CITADEL: 1 });
    expect(amountFor(result, 'a')).toBeCloseTo(100 * a / (a + b));
    expect(amountFor(result, 'b')).toBeCloseTo(100 * b / (a + b));
  });

  it('redistributes a capped owner’s share, including already full owners', () => {
    const cap = transferCargoCapacity({ COURIER: 1 }, {});
    const lots = [...pair('a'), ...pair('b'), ...pair('c')].map((row) => ({
      ...row, deuterium: row.id === 'a-cargo' ? cap - 10 : row.id === 'c-cargo' ? cap : 0,
    }));
    const result = produceMonumentDeuterium(lots, 100);
    expect(amountFor(result, 'a')).toBeCloseTo(10);
    expect(amountFor(result, 'b')).toBeCloseTo(90);
    expect(amountFor(result, 'c')).toBe(0);
    expect(cargo(result.lots, 'a-cargo').deuterium).toBe(cap);
  });

  it('discards only what no eligible owner can physically load', () => {
    const cap = transferCargoCapacity({ COURIER: 1 }, {});
    const result = produceMonumentDeuterium(pair('a'), cap + 20);
    expect(amountFor(result, 'a')).toBe(cap);
    expect(result.discardedDeuterium).toBeCloseTo(20);
    expect(produceMonumentDeuterium([], 30).discardedDeuterium).toBe(30);
    expect(produceMonumentDeuterium([lot('cargo', 'a', 'ATLAS')], 30).discardedDeuterium).toBe(30);
  });

  it('counts only dedicated transports as production cargo, using their wave research', () => {
    expect(monumentCargoCapacity(lot('combat', 'a', 'CITADEL'))).toBe(0);
    expect(monumentCargoCapacity(lot('collector', 'a', 'GARBAGE_COLLECTOR'))).toBe(0);
    const researched = lot('cargo', 'a', 'ATLAS', { count: 2, tech: { CARGO_HOLDS: 4 } });
    expect(monumentCargoCapacity(researched)).toBe(transferCargoCapacity({ ATLAS: 2 }, researched.tech));
    expect(monumentCargoCapacity(researched)).toBeGreaterThan(transferCargoCapacity({ ATLAS: 2 }, {}));
  });

  it('fills different cargo hulls and cohorts toward the same ratio', () => {
    const lots = [lot('fighter', 'a', 'CITADEL'), lot('small', 'a', 'COURIER', { count: 2 }), lot('large', 'a', 'ATLAS')];
    const smallCap = transferCargoCapacity({ COURIER: 2 }, {});
    const largeCap = transferCargoCapacity({ ATLAS: 1 }, {});
    const result = produceMonumentDeuterium(lots, (smallCap + largeCap) * 0.25);
    expect(cargo(result.lots, 'small').deuterium).toBeCloseTo(smallCap * 0.25);
    expect(cargo(result.lots, 'large').deuterium).toBeCloseTo(largeCap * 0.25);
  });

  it('raises an emptier hold first without moving the load of a fuller hold', () => {
    const smallCap = transferCargoCapacity({ COURIER: 1 }, {});
    const largeCap = transferCargoCapacity({ ATLAS: 1 }, {});
    const lots = [lot('fighter', 'a', 'DART'), lot('small', 'a', 'COURIER', { deuterium: smallCap * 0.8 }), lot('large', 'a', 'ATLAS')];
    const early = produceMonumentDeuterium(lots, largeCap * 0.2);
    expect(cargo(early.lots, 'small').deuterium).toBe(smallCap * 0.8);
    expect(cargo(early.lots, 'large').deuterium).toBeCloseTo(largeCap * 0.2);
    const later = produceMonumentDeuterium(lots, largeCap * 0.8 + (smallCap + largeCap) * 0.1);
    expect(cargo(later.lots, 'small').deuterium).toBeCloseTo(smallCap * 0.9);
    expect(cargo(later.lots, 'large').deuterium).toBeCloseTo(largeCap * 0.9);
  });

  it('is deterministic in lot read order, preserves fractional amounts and never mutates input', () => {
    const lots = [...pair('b'), ...pair('a')];
    const snapshot = structuredClone(lots);
    const result = produceMonumentDeuterium(lots, 0.001);
    expect(result).toEqual(produceMonumentDeuterium([...lots].reverse(), 0.001));
    expect(amountFor(result, 'a')).toBeCloseTo(0.0005, 12);
    expect(lots).toEqual(snapshot);
    expect(produceMonumentDeuterium(lots, 0).lots).toEqual(result.lots.map((row) => ({ ...row, deuterium: 0 })));
  });

  it.each([-1, Number.NaN, Number.POSITIVE_INFINITY])('refuses invalid produced amount %s', (amount) => {
    expect(() => produceMonumentDeuterium(pair('a'), amount)).toThrow(RangeError);
  });

  it('refuses malformed physical state even when there is no production', () => {
    const base = lot('cargo', 'a', 'COURIER');
    const invalid = [
      { ...base, count: -1 }, { ...base, count: 1.5 }, { ...base, count: 0 },
      { ...base, damageBp: 10000 }, { ...base, damageBp: -1 }, { ...base, damageBp: 0.5 },
      { ...base, remainderBp: 1 }, { ...base, remainderBp: Number.NaN },
      { ...base, deuterium: -1 }, { ...base, deuterium: Number.POSITIVE_INFINITY },
      { ...base, deuterium: transferCargoCapacity({ COURIER: 1 }, {}) + 1 },
      lot('combat', 'a', 'DART', { deuterium: 1 }),
      { ...base, id: '' }, { ...base, playerId: '' }, { ...base, waveId: '' },
    ];
    for (const row of invalid) expect(() => produceMonumentDeuterium([row], 0)).toThrow(RangeError);
    for (const hull of ['BASTION', 'PROSPECTOR', 'unknown']) {
      const forged = { ...base };
      Reflect.set(forged, 'hull', hull);
      expect(() => produceMonumentDeuterium([forged], 0)).toThrow(RangeError);
    }
    expect(() => produceMonumentDeuterium([base, base], 0)).toThrow(RangeError);
  });
});

describe('physical recall and radiation loss', () => {
  it('splits selected ships with their own exact damage and proportional physical load', () => {
    const lots = [lot('hold', 'a', 'COURIER', { count: 3, deuterium: 300.75, damageBp: 2500, remainderBp: 0.25 }), lot('ally', 'b', 'DART')];
    const result = recallMonumentShips(lots, 'a', [{ lotId: 'hold', count: 1, returnLotId: 'return' }]);
    expect(result.recalled).toEqual([{ ...lots[0], id: 'return', count: 1, deuterium: 100.25 }]);
    expect(cargo(result.remaining, 'hold')).toMatchObject({ count: 2, deuterium: 200.5, damageBp: 2500, remainderBp: 0.25 });
    expect(loadOf(result.remaining) + loadOf(result.recalled)).toBe(loadOf(lots));
    expect(lots[0]?.count).toBe(3);
  });

  it('supports a full recall and empty selection without inventing ships', () => {
    const lots = pair('a');
    expect(recallMonumentShips(lots, 'a', []).recalled).toEqual([]);
    const result = recallMonumentShips(lots, 'a', [{ lotId: 'a-cargo', count: 1, returnLotId: 'return' }]);
    expect(result.remaining.map((row) => row.id)).toEqual(['a-fighter']);
    expect(result.recalled[0]).toMatchObject({ playerId: 'a', hull: 'COURIER', count: 1 });
  });

  it('rejects another owner, nonexistent/repeated lots, over-count and colliding output identities', () => {
    const lots = pair('a');
    const selected = { lotId: 'a-cargo', count: 1, returnLotId: 'return' };
    expect(() => recallMonumentShips(lots, 'b', [selected])).toThrow(RangeError);
    for (const count of [-1, 0, 0.5, 2, Number.NaN]) {
      expect(() => recallMonumentShips(lots, 'a', [{ ...selected, count }])).toThrow(RangeError);
    }
    expect(() => recallMonumentShips(lots, 'a', [{ ...selected, lotId: 'missing' }])).toThrow(RangeError);
    expect(() => recallMonumentShips(lots, 'a', [selected, selected])).toThrow(RangeError);
    expect(() => recallMonumentShips(lots, 'a', [{ ...selected, returnLotId: 'a-fighter' }])).toThrow(RangeError);
    expect(() => recallMonumentShips(lots, 'a', [{ ...selected, returnLotId: '' }])).toThrow(RangeError);
    expect(() => recallMonumentShips(lots, 'a', [selected, { ...selected, lotId: 'a-fighter' }])).toThrow(RangeError);
  });

  it('destroys only the cargo actually carried by a lost ship group', () => {
    const lots = [
      lot('doomed', 'a', 'COURIER', { deuterium: 300, damageBp: 9900, remainderBp: 0.5 }),
      lot('survivor', 'a', 'COURIER', { deuterium: 100 }), lot('fighter', 'a', 'CITADEL'),
    ];
    const result = applyMonumentHpDose(lots, HULLS.COURIER.hp * 0.02);
    expect(result.destroyed.map((row) => row.id)).toEqual(['doomed']);
    expect(result.lostDeuterium).toBe(300);
    expect(cargo(result.lots, 'survivor').deuterium).toBe(100);
    expect(loadOf(result.lots) + result.lostDeuterium).toBe(loadOf(lots));
    expect(cargo(result.lots, 'survivor').damageBp).toBe(200);
    expect(lots[1]?.damageBp).toBe(0);
  });

  it('keeps each wave’s armor and sub-bp damage without healing on a zero dose', () => {
    const lots = [
      lot('plain', 'a', 'DART', { damageBp: 9000, remainderBp: 0.25 }),
      lot('armored', 'a', 'DART', { damageBp: 9000, remainderBp: 0.25, tech: { SHIP_ARMOR: RESEARCH_TECH.weaponMaxLevel } }),
    ];
    const result = applyMonumentHpDose(lots, HULLS.DART.hp * 0.1);
    expect(result.destroyed.map((row) => row.id)).toEqual(['plain']);
    expect(cargo(result.lots, 'armored').damageBp).toBe(9800);
    expect(cargo(result.lots, 'armored').remainderBp).toBeCloseTo(0.25);
    expect(applyMonumentHpDose(lots, 0).lots).toEqual([...lots].reverse());
    expect(() => applyMonumentHpDose(lots, -1)).toThrow(RangeError);
  });
});

describe('lazy HOLD settlement at actual loss thresholds', () => {
  it('settles only elapsed HOLD time and leaves cargo-only control with no production', () => {
    const result = hold(pair('a'), 2);
    expect(result.producedDeuterium).toBe(120);
    expect(amountFor(result, 'a')).toBe(120);
    expect(result.lostDeuterium).toBe(0);
    expect(hold([lot('cargo', 'a', 'COURIER')], 2).discardedDeuterium).toBe(120);
    expect(hold(pair('a'), 0).producedDeuterium).toBe(0);
  });

  it('recomputes owner weights after the first damaged fighter dies', () => {
    const lots = [...pair('a', { damageBp: 5000 }), ...pair('b')];
    const result = hold(lots, 2, [emit(HULLS.DART.hp / 2)]);
    expect(amountFor(result, 'a')).toBeCloseTo(30);
    expect(amountFor(result, 'b')).toBeCloseTo(90);
    expect(result.destroyed.map((row) => row.id)).toEqual(['a-fighter', 'b-fighter']);
    expect(result.lots.map((row) => row.id)).toEqual(['a-cargo', 'b-cargo']);
    expect(result.discardedDeuterium).toBeCloseTo(0);
  });

  it('loses production carried by a dying cargo, then pays only owners who can still load', () => {
    const lots = [
      lot('a-fighter', 'a', 'CITADEL'), lot('a-cargo', 'a', 'COURIER', { damageBp: 5000 }),
      lot('b-fighter', 'b', 'CITADEL'), lot('b-cargo', 'b', 'ATLAS'),
    ];
    const result = hold(lots, 2, [emit(HULLS.COURIER.hp / 2)]);
    expect(result.lostDeuterium).toBeCloseTo(30);
    expect(amountFor(result, 'a')).toBeCloseTo(30);
    expect(amountFor(result, 'b')).toBeCloseTo(90);
    expect(loadOf(result.lots)).toBeCloseTo(90);
    expect(result.destroyed[0]).toMatchObject({ id: 'a-cargo', deuterium: 30 });
    expect(cargo(result.lots, 'a-fighter').count).toBe(1);
  });

  it('redistributes continuously when cargo fills inside a death-bounded interval', () => {
    const cap = transferCargoCapacity({ COURIER: 1 }, {});
    const lots = [...pair('a'), ...pair('b')].map((row) => ({ ...row, deuterium: row.id === 'a-cargo' ? cap - 10 : 0 }));
    const result = hold(lots, 2);
    expect(amountFor(result, 'a')).toBeCloseTo(10);
    expect(amountFor(result, 'b')).toBeCloseTo(110);
    expect(result.discardedDeuterium).toBeCloseTo(0);
  });

  it('handles simultaneous casualties, long absence and never returns a dead cargo', () => {
    const result = hold(pair('a'), 10, [emit(HULLS.DART.hp)]);
    expect(amountFor(result, 'a')).toBeCloseTo(60);
    expect(result.lostDeuterium).toBeCloseTo(60);
    expect(result.discardedDeuterium).toBeCloseTo(540);
    expect(result.lots).toEqual([]);
    const together = hold([
      lot('fighter', 'a', 'DART'), lot('cargo', 'a', 'COURIER', { damageBp: 5000 }),
    ], 2, [emit(HULLS.COURIER.hp / 2)]);
    expect(together.destroyed).toHaveLength(2);
    expect(loadOf(together.lots)).toBe(0);
  });

  it('uses shelter and source history, rather than the end-state cloud', () => {
    const sources = [
      emit(HULLS.DART.hp, { activeFromMs: MIN }),
      emit(0, { id: 'shelter', mode: 'SHELTER', activeFromMs: MIN, activeUntilMs: 2 * MIN }),
    ];
    const result = hold(pair('a'), 3, sources);
    expect(amountFor(result, 'a')).toBeCloseTo(180);
    expect(result.destroyed.map((row) => row.id)).toEqual(['a-fighter']);
    expect(loadOf(result.lots)).toBeCloseTo(180);
  });

  it('rejects reversed/nonfinite/fractional clock, invalid rate, geometry and sources', () => {
    const options = { fromMs: 0, toMs: MIN, position, productionPerMinute: 60, sources: [] };
    for (const over of [{ fromMs: MIN + 1 }, { toMs: Number.NaN }, { toMs: 0.5 }, { productionPerMinute: -1 }, { productionPerMinute: Number.POSITIVE_INFINITY }, { position: { x: Number.NaN, y: 0, z: 0 } }]) {
      expect(() => settleMonumentHold(pair('a'), { ...options, ...over })).toThrow(RangeError);
    }
    expect(() => settleMonumentHold([], { ...options, toMs: 0, sources: [emit(-1)] })).toThrow(RangeError);
  });

  it('matches one settlement after repeated reads across cargo and fighter deaths', () => {
    const original = [...pair('a', { damageBp: 5000 }), ...pair('b')];
    const sources = [emit(HULLS.DART.hp / 2)];
    const once = hold(original, 5, sources);
    let lots = original;
    let lost = 0;
    let discarded = 0;
    const paid = new Map<string, number>();
    for (let fromMs = 0; fromMs < 5 * MIN; fromMs += 1000) {
      const part = settleMonumentHold(lots, { fromMs, toMs: fromMs + 1000, position, sources, productionPerMinute: 60 });
      lots = part.lots;
      lost += part.lostDeuterium;
      discarded += part.discardedDeuterium;
      for (const share of part.shares) paid.set(share.playerId, (paid.get(share.playerId) ?? 0) + share.deuterium);
    }
    expect(lots).toEqual(once.lots);
    expect(lost).toBeCloseTo(once.lostDeuterium, 6);
    expect(discarded).toBeCloseTo(once.discardedDeuterium, 6);
    for (const share of once.shares) expect(paid.get(share.playerId)).toBeCloseTo(share.deuterium, 6);
  });
});

describe('monument conservation properties', () => {
  const propertyOptions = { seed: 20261003, numRuns: 150 };

  it('conserves production and capacity across unequal power, cargo size and arbitrary saturation', () => {
    fc.assert(fc.property(
      fc.integer({ min: 1, max: 30 }), fc.integer({ min: 1, max: 30 }),
      fc.integer({ min: 1, max: 10 }), fc.integer({ min: 0, max: 1000 }),
      fc.integer({ min: 0, max: 100_000 }),
      (aPower, bPower, cargoCount, initial, amount) => {
        const lots = [...pair('a', { count: aPower }), ...pair('b', { count: bPower })].map((row) => ({
          ...row, count: row.id.endsWith('cargo') ? cargoCount : row.count,
          deuterium: row.id === 'a-cargo' ? initial : 0,
        }));
        const result = produceMonumentDeuterium(lots, amount);
        expect(loadOf(result.lots) + result.discardedDeuterium).toBeCloseTo(initial + amount, 6);
        for (const row of result.lots) {
          expect(row.deuterium).toBeGreaterThanOrEqual(0);
          expect(row.deuterium).toBeLessThanOrEqual(monumentCargoCapacity(row));
        }
        expect(result).toEqual(produceMonumentDeuterium([...lots].reverse(), amount));
      },
    ), propertyOptions);
  });

  it('has the same cargo after frequent production settlement as after one allocation', () => {
    fc.assert(fc.property(fc.integer({ min: 1, max: 100_000 }), fc.integer({ min: 1, max: 40 }), (amount, steps) => {
      const initial = [...pair('a', { count: 3 }), ...pair('b')];
      const once = produceMonumentDeuterium(initial, amount);
      let lots = initial;
      let discarded = 0;
      for (let step = 0; step < steps; step++) {
        const part = produceMonumentDeuterium(lots, amount / steps);
        lots = part.lots;
        discarded += part.discardedDeuterium;
      }
      for (const row of once.lots) expect(cargo(lots, row.id).deuterium).toBeCloseTo(row.deuterium, 6);
      expect(discarded).toBeCloseTo(once.discardedDeuterium, 6);
    }), propertyOptions);
  });

  it('preserves ships, damage and all physical load on any valid partial recall', () => {
    fc.assert(fc.property(fc.integer({ min: 1, max: 100 }), fc.integer({ min: 0, max: 9999 }), fc.integer({ min: 0, max: 1000 }), (count, damageBp, fill) => {
      const initial = [lot('cargo', 'a', 'COURIER', { count, damageBp, remainderBp: 0.375, deuterium: fill * count })];
      const taken = Math.ceil(count / 2);
      const result = recallMonumentShips(initial, 'a', [{ lotId: 'cargo', count: taken, returnLotId: 'return' }]);
      const all = [...result.remaining, ...result.recalled];
      expect(all.reduce((sum, row) => sum + row.count, 0)).toBe(count);
      expect(loadOf(all)).toBeCloseTo(loadOf(initial), 6);
      for (const row of all) expect(row).toMatchObject({ damageBp, remainderBp: 0.375, playerId: 'a' });
    }), propertyOptions);
  });
});
