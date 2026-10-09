import { describe, expect, it } from 'vitest';
import { monumentProbeSurvives } from '../src/monumentProbe.js';

describe('monument probe arrival survival', () => {
  it('loses seventy-five percent of the random interval and survives its upper quarter', () => {
    expect(monumentProbeSurvives(0)).toBe(false);
    expect(monumentProbeSurvives(0.75 - Number.EPSILON)).toBe(false);
    expect(monumentProbeSurvives(0.75)).toBe(true);
    expect(monumentProbeSurvives(0.8)).toBe(true);
    expect(monumentProbeSurvives(1 - Number.EPSILON)).toBe(true);
    expect(Array.from({ length: 1000 }, (_, i) => monumentProbeSurvives(i / 1000)).filter(Boolean)).toHaveLength(250);
  });
  it.each([-1, 1, NaN, Infinity, -Infinity])('refuses an invalid RNG draw %s', (draw) => {
    expect(() => monumentProbeSurvives(draw)).toThrow(RangeError);
  });
});
