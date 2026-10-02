import type { PlanetSkinId } from '@astera/rules';

/** Prices shown by the live Paddle catalog. Paddle supplies the formatted total,
 * including tax and currency, so the UI does not re-compute checkout amounts. */
export type Currency = 'TRY' | 'EUR';

export const SKIN_PRICE: Readonly<Record<Currency, number>> = { TRY: 99, EUR: 2.99 };
export const BUNDLE_PRICE: Readonly<Record<Currency, number>> = { TRY: 279, EUR: 8.49 };

/** Currency follows the visitor's country, independent of the selected UI language. */
export const currencyFor = (countryCode: string): Currency =>
  countryCode.toUpperCase() === 'TR' ? 'TRY' : 'EUR';

export function priceText(amount: number, currency: Currency, locale: string): string {
  const whole = currency === 'TRY' && Number.isInteger(amount);
  return new Intl.NumberFormat(locale, {
    style: 'currency', currency,
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: whole ? 0 : 2,
  }).format(amount);
}

export const bundleSaving = (currency: Currency): number =>
  Math.round((1 - BUNDLE_PRICE[currency] / (SKIN_PRICE[currency] * 4)) * 100);

/**
 * THE SHOPIER PAGES, BESIDE PADDLE (owner 2026-09-27: "paddle'a alternatif ek olarak").
 * Shopier charges the lira prices above and knows nothing of the account: the buyer writes
 * the commander in the order note and the owner grants the look from the admin panel.
 */
/** `null` for looks without a TRY checkout: the shop then shows no Shopier press. */
export const SHOPIER_LINKS: Readonly<Record<PlanetSkinId | 'bundle', string | null>> = {
  'planet-lava': 'https://www.shopier.com/asteraonline/51278662',
  'planet-ice': 'https://www.shopier.com/asteraonline/51278677',
  'planet-toxic': 'https://www.shopier.com/asteraonline/51278683',
  'planet-desert': 'https://www.shopier.com/asteraonline/51278652',
  'planet-turkey': 'https://www.shopier.com/asteraonline/51278730',
  'planet-germany': null,
  'planet-france': null,
  'planet-spain': null,
  'planet-japan': null,
  bundle: 'https://www.shopier.com/asteraonline/51278911',
};
