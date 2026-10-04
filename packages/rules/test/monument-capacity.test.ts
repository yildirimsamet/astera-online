import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  MONUMENT_CAPACITY,
  MOBILE_HULLS,
  hangarCapacity,
  hullBulk,
  recallMonumentShips,
  selectMonumentHold,
  type MobileHullId,
  type MonumentShipLot,
} from '../src/index.js';

const lot = (id: string, playerId: string, hull: MobileHullId, count: number, over: Partial<MonumentShipLot> = {}): MonumentShipLot => ({
  id, playerId, waveId: `${playerId}-wave`, hull, count,
  damageBp: 0, remainderBp: 0, deuterium: 0, tech: {}, ...over,
});
const held = (selection: ReturnType<typeof selectMonumentHold>, id: string): number =>
  selection.choices.find((row) => row.lotId === id)?.holdCount ?? 0;

describe('monument HOLD capacity', () => {
  it('uses the approved level-ten planet hangar bulk, rather than ship count', () => {
    expect(MONUMENT_CAPACITY).toBe(7270);
    expect(MONUMENT_CAPACITY).toBe(hangarCapacity(10));
    const row = lot('fleet', 'a', 'CITADEL', 1000);
    const selection = selectMonumentHold([row]);
    expect(held(selection, row.id)).toBe(Math.floor(MONUMENT_CAPACITY / hullBulk(row.hull)));
    expect(selection.usedCapacity).toBe(held(selection, row.id) * hullBulk(row.hull));
    expect(selection.usedCapacity).toBeLessThanOrEqual(MONUMENT_CAPACITY);
  });

  it('keeps every ship exactly at or below capacity and returns all at zero', () => {
    const lots = [lot('a', 'a', 'DART', 2), lot('b', 'a', 'COURIER', 1)];
    const bulk = hullBulk('DART') * 2 + hullBulk('COURIER');
    const selection = selectMonumentHold(lots, bulk);
    expect(selection.choices).toEqual([{ lotId: 'a', holdCount: 2, returnCount: 0 }, { lotId: 'b', holdCount: 1, returnCount: 0 }]);
    expect(selection.freeCapacity).toBe(0);
    expect(selectMonumentHold(lots, 0).choices.every((row) => row.holdCount === 0)).toBe(true);
    expect(selectMonumentHold([], 5)).toEqual({ choices: [], usedCapacity: 0, freeCapacity: 5 });
  });

  it('gives surviving higher tiers priority over stronger or more numerous lower tiers', () => {
    const lots = [lot('low', 'a', 'DART', 100), lot('high', 'b', 'CITADEL', 2)];
    const selection = selectMonumentHold(lots, hullBulk('CITADEL') * 2);
    expect(held(selection, 'high')).toBe(2);
    expect(held(selection, 'low')).toBe(0);
  });

  it('can retain high tier cargo ahead of lower tier fighters without a hidden combat quota', () => {
    const lots = [lot('low', 'a', 'DART', 100), lot('high', 'a', 'ARGOSY', 1)];
    const selection = selectMonumentHold(lots, hullBulk('ARGOSY'));
    expect(held(selection, 'high')).toBe(1);
    expect(held(selection, 'low')).toBe(0);
  });

  it('may return all lower tier cargo when higher tier fighters fill the monument', () => {
    const lots = [lot('cargo', 'a', 'ATLAS', 2), lot('combat', 'a', 'CITADEL', 2)];
    const selection = selectMonumentHold(lots, hullBulk('CITADEL') * 2);
    expect(held(selection, 'combat')).toBe(2);
    expect(held(selection, 'cargo')).toBe(0);
  });

  it('lets a smaller lower tier hull use space that no remaining higher tier ship fits', () => {
    const lots = [lot('high', 'a', 'CITADEL', 2), lot('low', 'a', 'DART', 10)];
    const selection = selectMonumentHold(lots, hullBulk('CITADEL') + hullBulk('DART') * 2);
    expect(held(selection, 'high')).toBe(1);
    expect(held(selection, 'low')).toBe(2);
    expect(selection.freeCapacity).toBe(0);
  });

  it('shares an oversubscribed tier by owner combat power across their entire surviving fleet', () => {
    const lots = [lot('a-t1', 'a', 'DART', 10), lot('a-t4', 'a', 'ARGOSY', 10), lot('b-t1', 'b', 'DART', 30), lot('b-t4', 'b', 'ARGOSY', 10)];
    const selection = selectMonumentHold(lots, hullBulk('ARGOSY') * 8);
    expect(held(selection, 'a-t4')).toBe(2);
    expect(held(selection, 'b-t4')).toBe(6);
    expect(held(selection, 'a-t1') + held(selection, 'b-t1')).toBe(0);
  });

  it('does not inflate the same owner’s quota when their fleet is split into many waves', () => {
    const original = [lot('a', 'a', 'DART', 30), lot('b', 'b', 'DART', 10)];
    const split = [lot('a1', 'a', 'DART', 10), lot('a2', 'a', 'DART', 20, { waveId: 'other' }), original[1]!];
    const capacity = hullBulk('DART') * 20;
    const whole = selectMonumentHold(original, capacity);
    const result = selectMonumentHold(split, capacity);
    expect(held(result, 'a1') + held(result, 'a2')).toBe(held(whole, 'a'));
    expect(held(result, 'b')).toBe(held(whole, 'b'));
  });

  it('redistributes quota that an owner cannot use within the contested tier', () => {
    const lots = [lot('a-low', 'a', 'DART', 100), lot('a-high', 'a', 'ARGOSY', 1), lot('b-low', 'b', 'DART', 1), lot('b-high', 'b', 'ARGOSY', 10)];
    const selection = selectMonumentHold(lots, hullBulk('ARGOSY') * 4);
    expect(held(selection, 'a-high')).toBe(1);
    expect(held(selection, 'b-high')).toBe(3);
  });

  it('handles unequal indivisible hull sizes and deterministic remainder ties', () => {
    const lots = [lot('a', 'a', 'DART', 1), lot('b', 'b', 'DART', 1)];
    expect(held(selectMonumentHold(lots, hullBulk('DART')), 'a')).toBe(1);
    expect(held(selectMonumentHold(lots, hullBulk('DART')), 'b')).toBe(0);
    const mixed = [lot('small', 'a', 'CITADEL', 10), lot('large', 'b', 'ARGOSY', 10), lot('b-power', 'b', 'DART', 100)];
    const result = selectMonumentHold(mixed, 73);
    expect(result.usedCapacity).toBeLessThanOrEqual(73);
    expect(result.freeCapacity).toBeLessThan(hullBulk('DART'));
    expect(result).toEqual(selectMonumentHold([...mixed].reverse(), 73));
  });

  it('keeps less damaged equivalent hulls first, preserving fractional health in the comparison', () => {
    const lots = [
      lot('worn', 'a', 'DART', 2, { damageBp: 5000 }),
      lot('fraction', 'a', 'DART', 2, { remainderBp: 0.25 }), lot('healthy', 'a', 'DART', 2),
    ];
    const selection = selectMonumentHold(lots, hullBulk('DART') * 3);
    expect(held(selection, 'healthy')).toBe(2);
    expect(held(selection, 'fraction')).toBe(1);
    expect(held(selection, 'worn')).toBe(0);
  });

  it('uses stable lot identity for equivalent states, with no input mutation', () => {
    const lots = [lot('z', 'a', 'COURIER', 2), lot('a', 'a', 'COURIER', 2)];
    const snapshot = structuredClone(lots);
    const selection = selectMonumentHold(lots, hullBulk('COURIER') * 3);
    expect(held(selection, 'a')).toBe(2);
    expect(held(selection, 'z')).toBe(1);
    expect(lots).toEqual(snapshot);
  });

  it('returns a count decision that can physically split loaded ships without load loss', () => {
    const lots = [lot('cargo', 'a', 'ARGOSY', 3, { deuterium: 900.75, damageBp: 4500, remainderBp: 0.5 })];
    const selection = selectMonumentHold(lots, hullBulk('ARGOSY') * 2);
    const returning = selection.choices.map((row) => ({ lotId: row.lotId, count: row.returnCount, returnLotId: 'return' }));
    const physical = recallMonumentShips(lots, 'a', returning);
    expect(physical.remaining[0]).toMatchObject({ count: 2, deuterium: 600.5, damageBp: 4500, remainderBp: 0.5 });
    expect(physical.recalled[0]).toMatchObject({ count: 1, deuterium: 300.25 });
  });

  it.each([-1, 0.5, Number.NaN, Number.POSITIVE_INFINITY, Number.MAX_SAFE_INTEGER + 1])('rejects invalid capacity %s', (capacity) => {
    expect(() => selectMonumentHold([], capacity)).toThrow(RangeError);
  });

  it('validates lots before a zero-capacity selection', () => {
    expect(() => selectMonumentHold([lot('bad', 'a', 'DART', -1)], 0)).toThrow(RangeError);
  });

  it('conserves every ship and never leaves room for a remaining ship after deterministic selection', () => {
    fc.assert(fc.property(
      fc.array(fc.record({ hull: fc.constantFrom(...MOBILE_HULLS), count: fc.integer({ min: 1, max: 100 }), owner: fc.integer({ min: 0, max: 4 }), damage: fc.integer({ min: 0, max: 9999 }) }), { maxLength: 25 }),
      fc.integer({ min: 0, max: MONUMENT_CAPACITY }),
      (generated, capacity) => {
        const lots = generated.map((row, i) => lot(String(i), String(row.owner), row.hull, row.count, { damageBp: row.damage }));
        const result = selectMonumentHold(lots, capacity);
        let bulk = 0;
        for (const row of result.choices) {
          const source = lots.find((candidate) => candidate.id === row.lotId)!;
          expect(row.holdCount + row.returnCount).toBe(source.count);
          expect(Number.isSafeInteger(row.holdCount)).toBe(true);
          expect(row.holdCount).toBeGreaterThanOrEqual(0);
          bulk += row.holdCount * hullBulk(source.hull);
          if (row.returnCount > 0) expect(result.freeCapacity).toBeLessThan(hullBulk(source.hull));
        }
        expect(result.usedCapacity).toBe(bulk);
        expect(result.freeCapacity).toBe(capacity - bulk);
        expect(result.usedCapacity).toBeLessThanOrEqual(capacity);
        expect(result).toEqual(selectMonumentHold([...lots].reverse(), capacity));
      },
    ), { seed: 20261003, numRuns: 150 });
  });
});
