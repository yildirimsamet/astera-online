import { testEnv } from './helpers.js';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { polarPricingForIp, productIdsFor } from '../src/services/polar.js';

afterEach(() => { vi.unstubAllGlobals(); });

describe('Polar country pricing', () => {
  it('can quote and identify ship products after configuration without inventing prices for the other ships', async () => {
    const productId = 'f372f658-e927-4051-b758-e5fa10d09f5f';
    const env = testEnv({ POLAR_COSMETIC_PRODUCTS: JSON.stringify({ 'ship-shark': { productId, eurAmount: 599, tryAmount: 19900 } }) });
    const quote = await polarPricingForIp('127.0.0.1', env);
    expect(quote.prices['ship-shark']).toMatchObject({ currencyCode: 'EUR', amount: 599 });
    expect(quote.prices['ship-red-dragon']).toBeUndefined();
    expect(productIdsFor(env)['ship-shark']).toBe(productId);
  });
  it('quotes only configured new cosmetic products and keeps existing offers available', async () => {
    const env = testEnv({ POLAR_COSMETIC_PRODUCTS: JSON.stringify({ 'ring-aurora': {
      productId: 'f372f658-e927-4051-b758-e5fa10d09f5f', eurAmount: 499, tryAmount: 14900,
    } }) });
    const quote = await polarPricingForIp('127.0.0.1', env);
    expect(quote.prices['ring-aurora']).toEqual({ currencyCode: 'EUR', formatted: '€4.99', amount: 499 });
    expect(quote.prices['engine-aurora']).toBeUndefined();
    expect(quote.prices['planet-lava']).toBeDefined();
    expect(() => testEnv({ POLAR_COSMETIC_PRODUCTS: '{invalid' })).toThrow();
    expect(() => testEnv({ POLAR_COSMETIC_PRODUCTS: JSON.stringify({ 'flag-vanguard': { productId: 'f372f658-e927-4051-b758-e5fa10d09f5f', eurAmount: 99 } }) })).toThrow();
  });

  it('shows TRY in Turkey only for products that have a TRY price', async () => {
    const lookup = vi.fn(() => Promise.resolve(new Response(JSON.stringify({ ip: '198.51.100.1', country: 'TR' }))));
    vi.stubGlobal('fetch', lookup);
    const quote = await polarPricingForIp('198.51.100.1');
    expect(quote.countryCode).toBe('TR');
    expect(quote.prices['planet-lava']).toEqual({ currencyCode: 'TRY', formatted: '₺99', amount: 9900 });
    for (const country of ['germany', 'france', 'spain', 'japan'] as const) {
      expect(quote.prices[`planet-${country}`]).toEqual({ currencyCode: 'EUR', formatted: '€2.99', amount: 299 });
    }
    expect(quote.prices.bundle).toEqual({ currencyCode: 'TRY', formatted: '₺279', amount: 27900 });
    expect(lookup).toHaveBeenCalledWith('https://api.country.is/198.51.100.1', expect.any(Object));
  });

  it('shows EUR outside Turkey regardless of language and rejects failed lookups', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response(JSON.stringify({ ip: '203.0.113.1', country: 'DE' })))));
    const quote = await polarPricingForIp('203.0.113.1');
    expect(quote.prices['planet-lava']).toEqual({ currencyCode: 'EUR', formatted: '€2.99', amount: 299 });
    expect(quote.prices.bundle).toEqual({ currencyCode: 'EUR', formatted: '€8.49', amount: 849 });
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response('{}', { status: 503 }))));
    await expect(polarPricingForIp('192.0.2.1')).rejects.toMatchObject({ code: 'POLAR_PRICING_UNAVAILABLE' });
  });

  it('lets a local sandbox checkout use EUR without sending a loopback address to geolocation', async () => {
    const lookup = vi.fn();
    vi.stubGlobal('fetch', lookup);
    const quote = await polarPricingForIp('127.0.0.1');
    expect(quote.countryCode).toBe('ZZ');
    expect(quote.prices.bundle).toMatchObject({ currencyCode: 'EUR', amount: 849 });
    expect(lookup).not.toHaveBeenCalled();
  });
});
