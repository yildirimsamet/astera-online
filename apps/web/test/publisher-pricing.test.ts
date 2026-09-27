import { describe, expect, it, vi } from 'vitest';
import { hydratePublisherPricing } from '../public/publisher-pricing.js';

const markup = `<!doctype html><html lang="tr"><body>
  <span data-paddle-price="planet-lava">€2.99</span>
  <span data-paddle-price="planet-germany">€2.99</span>
  <strong data-paddle-price="bundle">€8.49</strong>
  <p data-pricing-status>Konum fiyatı yükleniyor.</p>
</body></html>`;

const page = (): Document => new DOMParser().parseFromString(markup, 'text/html');

describe('publisher pricing from the live catalog', () => {
  it('shows the Turkish and EUR offer prices returned for a Turkish visitor', async () => {
    const document = page();
    const fetcher = vi.fn(() => Promise.resolve(new Response(JSON.stringify({
      countryCode: 'TR', prices: {
        'planet-lava': { formatted: '₺99,00', currencyCode: 'TRY' },
        'planet-germany': { formatted: '€2.99', currencyCode: 'EUR' },
        bundle: { formatted: '₺279,00', currencyCode: 'TRY' },
      },
    }), { status: 200 })));

    await hydratePublisherPricing(document, fetcher);

    expect(fetcher).toHaveBeenCalledWith('/api/skins/pricing', { credentials: 'omit' });
    expect(document.querySelector('[data-paddle-price="planet-lava"]')?.textContent).toBe('₺99,00');
    expect(document.querySelector('[data-paddle-price="planet-germany"]')?.textContent).toBe('€2.99');
    expect(document.querySelector('[data-paddle-price="bundle"]')?.textContent).toBe('₺279,00');
    expect(document.querySelector('[data-pricing-status]')?.textContent).toMatch(/türkiye/i);
  });

  it('keeps the base prices and explains the fallback when live pricing is unavailable', async () => {
    const document = page();
    await hydratePublisherPricing(document, vi.fn(() => Promise.resolve(new Response('', { status: 503 }))));

    expect(document.querySelector('[data-paddle-price="planet-lava"]')?.textContent).toBe('€2.99');
    expect(document.querySelector('[data-pricing-status]')?.textContent).toMatch(/EUR|euro/i);
  });

  it('ignores malformed price data instead of writing it into the page', async () => {
    const document = page();
    await hydratePublisherPricing(document, vi.fn(() => Promise.resolve(new Response(JSON.stringify({
      countryCode: 'TR', prices: { 'planet-lava': { formatted: '<script>bad</script>', currencyCode: 'TRY' } },
    }), { status: 200 }))));

    expect(document.querySelector('[data-paddle-price="planet-lava"]')?.textContent).toBe('€2.99');
  });
});
