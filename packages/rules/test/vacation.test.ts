import { describe, expect, it } from 'vitest';
import { deuteriumRate, vacationCost, vacationDaysAvailable, vacationPayment } from '../src/index.js';

describe('vacation rules', () => {
  it('prices every world by its Core rounded to the next even level', () => {
    const quote = vacationCost(2, [
      { id: 'home', coreLevel: 17, capital: true },
      { id: 'a', coreLevel: 12, capital: false },
      { id: 'b', coreLevel: 15, capital: false },
    ]);
    expect(quote.worlds.map(w => [w.referenceLevel, w.hours])).toEqual([[18, 24], [12, 12], [16, 12]]);
    expect(quote.total).toBe(Math.ceil(deuteriumRate(18) * 24 + deuteriumRate(12) * 12 + deuteriumRate(16) * 12));
    expect(vacationCost(1, [{ id: 'home', coreLevel: 12, capital: true }]).total).toBe(Math.ceil(deuteriumRate(12) * 12));
  });
  it.each([0, 8, 1.5, NaN, Infinity])('refuses invalid duration %s', days => {
    expect(() => vacationCost(days, [{ id: 'home', coreLevel: 1, capital: true }])).toThrow();
  });
  it('requires exactly one capital and unique worlds', () => {
    expect(() => vacationCost(1, [])).toThrow();
    expect(() => vacationCost(1, [{ id: 'a', coreLevel: 1, capital: false }])).toThrow();
    expect(() => vacationCost(1, [{ id: 'a', coreLevel: 1, capital: true }, { id: 'a', coreLevel: 1, capital: false }])).toThrow();
  });
  it('uses the capital store then its buffer, without needing free store capacity', () => {
    expect(vacationPayment(100, 70, 50)).toEqual({ store: 70, buffer: 30 });
    expect(vacationPayment(100, 0, 100)).toEqual({ store: 0, buffer: 100 });
    expect(vacationPayment(100, 101, 999)).toEqual({ store: 100, buffer: 0 });
    expect(vacationPayment(100, 30, 69)).toBeNull();
  });
  it('keeps the last 24 hours of the season open, including the exact boundary', () => {
    const day = 86_400_000;
    expect(vacationDaysAvailable(0, 2 * day)).toBe(1);
    expect(vacationDaysAvailable(1, 2 * day)).toBe(0);
    expect(vacationDaysAvailable(0, 3 * day)).toBe(2);
    expect(vacationDaysAvailable(0, day)).toBe(0);
    expect(vacationDaysAvailable(0, 20 * day)).toBe(7);
    expect(vacationDaysAvailable(0, 10 * day, 8.5 * day)).toBe(1);
  });
});
