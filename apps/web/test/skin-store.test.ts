import { describe, expect, it } from 'vitest';
import {
  BUNDLE_PRICE,
  SKIN_PRICE,
  bundleSaving,
  currencyFor,
  priceText,
} from '../src/lib/skinStore.js';

/**
 * The live Paddle catalog: country based currency, with three country skins
 * deliberately remaining in euros for Turkish visitors.
 */
describe('the skin store', () => {
  it('uses the visitor country, not interface language, for the currency', () => {
    expect(currencyFor('TR')).toBe('TRY');
    for (const country of ['DE', 'FR', 'ES', 'US']) expect(currencyFor(country)).toBe('EUR');
  });

  it('formats the live base and Turkish override prices', () => {
    expect(SKIN_PRICE).toEqual({ TRY: 99, EUR: 2.99 });
    expect(priceText(99, 'TRY', 'tr-TR')).toBe('₺99');
    expect(priceText(2.99, 'EUR', 'en-US')).toBe('€2.99');
  });

  it('sells the four together for less than the four apart, and says by how much', () => {
    for (const currency of ['TRY', 'EUR'] as const) {
      expect(BUNDLE_PRICE[currency]).toBeLessThan(SKIN_PRICE[currency] * 4);
      const saving = bundleSaving(currency);
      expect(saving).toBe(Math.round((1 - BUNDLE_PRICE[currency] / (SKIN_PRICE[currency] * 4)) * 100));
      expect(saving).toBeGreaterThanOrEqual(25);
    }
  });

});
