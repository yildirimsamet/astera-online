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
