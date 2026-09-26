import { describe, expect, it } from 'vitest';
import { COUNTRY_CODES, isCountryCode } from '../src/index.js';

describe('ISO country codes', () => {
  it('publishes every ISO 3166-1 alpha-2 country exactly once in stable order', () => {
    expect(COUNTRY_CODES).toHaveLength(249);
    expect(COUNTRY_CODES).toEqual([...new Set(COUNTRY_CODES)].sort());
    expect(COUNTRY_CODES).toContain('TR');
    expect(COUNTRY_CODES).toContain('DE');
    expect(COUNTRY_CODES).toContain('US');
  });

  it('accepts only an authored uppercase country code', () => {
    expect(isCountryCode('TR')).toBe(true);
    expect(isCountryCode('tr')).toBe(false);
    expect(isCountryCode('XX')).toBe(false);
    expect(isCountryCode(null)).toBe(false);
  });
});
