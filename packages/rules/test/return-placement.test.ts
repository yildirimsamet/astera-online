import { expect, it } from 'vitest';
import { returnPlacement } from '../src/index.js';

const vacancy = (id: string, kind: 'CAPITAL' | 'COLONY', index: number, createdAt = 0) => ({
  id, kind, index, createdAt, departureTransferId: id, x: index * 10, y: index * 20, z: index * 30,
});

it('uses the exact departed addresses for a capital and three colonies across departures', () => {
  const capital = vacancy('A', 'CAPITAL', 42);
  const colonies = [vacancy('B', 'COLONY', 400), vacancy('C', 'COLONY', 401), vacancy('D', 'COLONY', 402)];
  const result = returnPlacement([colonies[2]!, capital, colonies[0]!, colonies[1]!], new Set(), 3);
  expect(result).toEqual({ capital, colonies });
  expect(result?.capital).toBe(capital);
});

it('returns no partial placement when even one of three colony addresses is missing', () => {
  expect(returnPlacement([vacancy('A', 'CAPITAL', 42), vacancy('B', 'COLONY', 400)], new Set(), 3)).toBeNull();
});

it('never substitutes a colony for a capital or an occupied stale vacancy', () => {
  expect(returnPlacement([vacancy('A', 'COLONY', 42)], new Set(), 0)).toBeNull();
  expect(returnPlacement([vacancy('A', 'CAPITAL', 42)], new Set([42]), 0)).toBeNull();
  expect(returnPlacement([], new Set(), 0)).toBeNull();
});

it('chooses oldest vacancies deterministically without changing the input', () => {
  const a = Object.freeze(vacancy('A', 'CAPITAL', 42, 1));
  const b = Object.freeze(vacancy('B', 'CAPITAL', 43, 0));
  const input = Object.freeze([a, b]);
  expect(returnPlacement(input, new Set(), 0)?.capital).toBe(b);
  expect(returnPlacement([b, a], new Set([43]), 0)?.capital).toBe(a);
  expect(input).toEqual([a, b]);
});

it('rejects malformed colony counts', () => {
  expect(() => returnPlacement([], new Set(), -1)).toThrow(RangeError);
  expect(() => returnPlacement([], new Set(), 1.5)).toThrow(RangeError);
});
