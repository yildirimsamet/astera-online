/* global document */
const PRICE_KEYS = new Set([
  'planet-lava', 'planet-ice', 'planet-toxic', 'planet-desert',
  'planet-turkey', 'planet-germany', 'planet-france', 'planet-spain', 'bundle',
]);

/** @param {unknown} value */
function validQuote(value) {
  if (!value || typeof value !== 'object' || !('formatted' in value) || !('currencyCode' in value)) return null;
  return typeof value.formatted === 'string' && value.formatted.length <= 40
    && /^[\p{Sc}\d.,\s\u00a0\u202f]+$/u.test(value.formatted)
    && (value.currencyCode === 'TRY' || value.currencyCode === 'EUR') ? value.formatted : null;
}

/**
 * The server asks Paddle for this visitor's country and checkout currency. The
 * static EUR labels stay visible if that request fails or the visitor has JS off.
 * @param {Document} root
 * @param {typeof fetch} fetcher
 */
export async function hydratePublisherPricing(root = document, fetcher = fetch) {
  const status = root.querySelector('[data-pricing-status]');
  const turkish = root.documentElement.lang === 'tr';
  try {
    const response = await fetcher('/api/skins/pricing', { credentials: 'omit' });
    if (!response.ok) throw new Error('Price preview unavailable');
    /** @type {unknown} */
    const data = await response.json();
    if (!data || typeof data !== 'object' || !('countryCode' in data) || !('prices' in data)
      || typeof data.countryCode !== 'string' || !data.prices || typeof data.prices !== 'object') {
      throw new Error('Invalid price preview');
    }
    let updated = 0;
    for (const element of root.querySelectorAll('[data-paddle-price]')) {
      const key = element.getAttribute('data-paddle-price');
      if (!key || !PRICE_KEYS.has(key) || !(key in data.prices)) continue;
      const formatted = validQuote(data.prices[key]);
      if (!formatted) continue;
      element.textContent = formatted;
      updated += 1;
    }
    const country = data.countryCode === 'TR' ? (turkish ? 'Türkiye' : 'Turkey') : data.countryCode;
    if (status && updated > 0) status.textContent = turkish
      ? `Ülke: ${country}. Fiyatlar konumunuza göre gösterilir; kesin tutar ödeme ekranındadır.`
      : `Country: ${country}. Prices reflect your location; checkout shows the final amount.`;
  } catch {
    if (status) status.textContent = turkish
      ? 'EUR taban fiyatları gösteriliyor. Kesin tutar ödeme ekranındadır.'
      : 'Showing EUR base prices. Checkout shows the final amount.';
  }
}

if (typeof document !== 'undefined' && document.querySelector('[data-paddle-price]')) {
  void hydratePublisherPricing();
}
