import { describe, expect, it, vi } from 'vitest';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { readFileSync } from 'node:fs';
import { z } from 'zod';
import { COSMETICS } from '@astera/rules';
import { hydratePublisherPricing } from '../public/publisher-pricing.js';

/** Only offers with a live provider product are published; catalogued items without one show as coming soon. */
const onSale = new Set(Object.keys(z.record(z.string(), z.unknown())
  .parse(JSON.parse(readFileSync(resolve(process.cwd(), '../../config/polar-cosmetics.production.json'), 'utf8')))));

const markup = `<!doctype html><html lang="tr"><body>
  <span data-offer-price="planet-lava">€2.99</span>
  <span data-offer-price="planet-germany">€2.99</span>
  <span data-offer-price="planet-japan">€2.99</span>
  <strong data-offer-price="bundle">€8.49</strong>
  <p data-pricing-status>Konum fiyatı yükleniyor.</p>
</body></html>`;

const page = (): Document => new DOMParser().parseFromString(markup, 'text/html');

describe('publisher pricing from the live catalog', () => {
  it('hydrates every new paid cosmetic while ignoring included flags and unknown products', async () => {
    const paid = COSMETICS.filter(item => item.category !== 'PLANET' && !item.free);
    const document = new DOMParser().parseFromString(`<html lang="tr"><body>${
      [...paid.map(item => item.id), 'flag-vanguard', 'unknown-offer'].map(id => `<span data-offer-price="${id}">base</span>`).join('')
    }</body></html>`, 'text/html');
    const prices = Object.fromEntries([...paid.map(item => item.id), 'flag-vanguard', 'unknown-offer']
      .map(id => [id, { formatted: '₺49', currencyCode: 'TRY' }]));
    await hydratePublisherPricing(document, vi.fn(() => Promise.resolve(new Response(JSON.stringify({ countryCode: 'TR', prices })))));
    for (const item of paid) expect(document.querySelector(`[data-offer-price="${item.id}"]`)?.textContent).toBe('₺49');
    expect(document.querySelector('[data-offer-price="flag-vanguard"]')?.textContent).toBe('base');
    expect(document.querySelector('[data-offer-price="unknown-offer"]')?.textContent).toBe('base');
  });

  it.each(['pricing.html', 'fiyatlar.html'])('publishes every paid cosmetic with its EUR fallback in %s', async filename => {
    const markup = await readFile(resolve(process.cwd(), 'public', filename), 'utf8');
    const document = new DOMParser().parseFromString(markup, 'text/html');
    const published = COSMETICS.filter(item => item.category !== 'PLANET' && !item.free && onSale.has(item.id));
    expect(published).toHaveLength(20);
    for (const item of published) {
      const amount = item.category === 'SHIP' || item.category === 'PROBE' ? '3.99' : item.category === 'ENGINE' ? '2.49' : '1.99';
      expect(document.querySelector(`[data-offer-price="${item.id}"]`)?.textContent).toContain(amount);
    }
  });

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
