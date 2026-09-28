import { afterEach, describe, expect, it, vi } from 'vitest';
import { polarPricingForIp } from '../src/services/polar.js';

afterEach(() => { vi.unstubAllGlobals(); });

describe('Polar country pricing', () => {
  it('shows TRY in Turkey only for products that have a TRY price', async () => {
    const lookup = vi.fn(() => Promise.resolve(new Response(JSON.stringify({ ip: '198.51.100.1', country: 'TR' }))));
    vi.stubGlobal('fetch', lookup);
    const quote = await polarPricingForIp('198.51.100.1');
    expect(quote.countryCode).toBe('TR');
    expect(quote.prices['planet-lava']).toEqual({ currencyCode: 'TRY', formatted: '₺99', amount: 9900 });
    expect(quote.prices['planet-germany']).toEqual({ currencyCode: 'EUR', formatted: '€2.99', amount: 299 });
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
