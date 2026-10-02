import { describe, expect, it, vi } from 'vitest';
import { hydratePublisherPricing } from '../public/publisher-pricing.js';

const markup = `<!doctype html><html lang="tr"><body>
  <span data-offer-price="planet-lava">€2.99</span>
  <span data-offer-price="planet-germany">€2.99</span>
  <span data-offer-price="planet-japan">€2.99</span>
  <strong data-offer-price="bundle">€8.49</strong>
  <p data-pricing-status>Konum fiyatı yükleniyor.</p>
</body></html>`;

const page = (): Document => new DOMParser().parseFromString(markup, 'text/html');

describe('publisher pricing from the live catalog', () => {
  it('shows the Turkish and EUR offer prices returned for a Turkish visitor', async () => {
    const document = page();
    const fetcher = vi.fn(() => Promise.resolve(new Response(JSON.stringify({
      countryCode: 'TR', prices: {
        'planet-lava': { formatted: '₺99', currencyCode: 'TRY' },
        'planet-germany': { formatted: '€2.99', currencyCode: 'EUR' },
        'planet-japan': { formatted: '€2.99', currencyCode: 'EUR' },
        bundle: { formatted: '₺279', currencyCode: 'TRY' },
      },
    }), { status: 200 })));

    await hydratePublisherPricing(document, fetcher);

    expect(fetcher).toHaveBeenCalledWith('/api/skins/polar-pricing', { credentials: 'omit' });
    expect(document.querySelector('[data-offer-price="planet-lava"]')?.textContent).toBe('₺99');
    expect(document.querySelector('[data-offer-price="planet-germany"]')?.textContent).toBe('€2.99');
    expect(document.querySelector('[data-offer-price="planet-japan"]')?.textContent).toBe('€2.99');
    expect(document.querySelector('[data-offer-price="bundle"]')?.textContent).toBe('₺279');
    expect(document.querySelector('[data-pricing-status]')?.textContent).toMatch(/türkiye/i);
  });

  it('keeps the base prices and explains the fallback when live pricing is unavailable', async () => {
    const document = page();
    await hydratePublisherPricing(document, vi.fn(() => Promise.resolve(new Response('', { status: 503 }))));

    expect(document.querySelector('[data-offer-price="planet-lava"]')?.textContent).toBe('€2.99');
    expect(document.querySelector('[data-pricing-status]')?.textContent).toMatch(/EUR|euro/i);
  });

  it('ignores malformed price data instead of writing it into the page', async () => {
    const document = page();
    await hydratePublisherPricing(document, vi.fn(() => Promise.resolve(new Response(JSON.stringify({
      countryCode: 'TR', prices: { 'planet-lava': { formatted: '<script>bad</script>', currencyCode: 'TRY' } },
    }), { status: 200 }))));

    expect(document.querySelector('[data-offer-price="planet-lava"]')?.textContent).toBe('€2.99');
  });

  it('explains local or unknown country pricing without displaying ZZ as a country', async () => {
    const document = page();
    await hydratePublisherPricing(document, vi.fn(() => Promise.resolve(new Response(JSON.stringify({
      countryCode: 'ZZ', prices: { 'planet-lava': { formatted: '€2.99', currencyCode: 'EUR' } },
    }), { status: 200 }))));
    expect(document.querySelector('[data-pricing-status]')?.textContent).toMatch(/EUR taban fiyatları/i);
    expect(document.querySelector('[data-pricing-status]')?.textContent).not.toContain('ZZ');
  });
});
