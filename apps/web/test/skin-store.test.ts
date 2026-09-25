import { describe, expect, it } from 'vitest';
import {
  BUNDLE_PRICE,
  SKIN_PRICE,
  bundleSaving,
  checkoutUrl,
  currencyFor,
  priceText,
} from '../src/lib/skinStore.js';

/**
 * THE STORE'S NUMBERS (owner, 2026-09-25): ₺99 / $2.99 a look, the four together about 30%
 * cheaper, and each purchase through a payment link the owner pastes in — the buyer's
 * commander carried on it, so the look is granted to the right account.
 */
describe('the skin store', () => {
  it('charges a Turkish reader in lira and everyone else in dollars', () => {
    expect(currencyFor('tr')).toBe('TRY');
    for (const language of ['en', 'de', 'fr', 'es']) expect(currencyFor(language)).toBe('USD');
  });

  it('prices a look at ₺99 or $2.99, and prints it the way each reader reads money', () => {
    expect(SKIN_PRICE).toEqual({ TRY: 99, USD: 2.99 });
    expect(priceText(99, 'TRY', 'tr-TR')).toBe('₺99');
    expect(priceText(2.99, 'USD', 'en-US')).toBe('$2.99');
  });

  it('sells the four together for less than the four apart, and says by how much', () => {
    for (const currency of ['TRY', 'USD'] as const) {
      expect(BUNDLE_PRICE[currency]).toBeLessThan(SKIN_PRICE[currency] * 4);
      const saving = bundleSaving(currency);
      expect(saving).toBe(Math.round((1 - BUNDLE_PRICE[currency] / (SKIN_PRICE[currency] * 4)) * 100));
      expect(saving).toBeGreaterThanOrEqual(25);
    }
  });

  it('opens nothing until the owner has pasted a link', () => {
    expect(checkoutUrl('', 'Samet')).toBeNull();
    expect(checkoutUrl('   ', 'Samet')).toBeNull();
  });

  it('carries the buyer’s commander on the link, encoded, where the link asks for it', () => {
    expect(checkoutUrl('https://buy.example.com/lava?client_reference_id={commander}', 'Sam Et&1'))
      .toBe('https://buy.example.com/lava?client_reference_id=Sam%20Et%261');
    expect(checkoutUrl('https://shop.example.com/lava', 'Samet')).toBe('https://shop.example.com/lava');
  });

  it('never opens a link that is not https', () => {
    expect(checkoutUrl('javascript:alert(1)', 'Samet')).toBeNull();
    expect(checkoutUrl('http://shop.example.com/lava', 'Samet')).toBeNull();
  });
});
