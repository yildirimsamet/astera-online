import type { PlanetSkinId } from '@astera/rules';

/**
 * THE SKIN STORE'S TERMS (owner, 2026-09-25). A look is ₺99 or $2.99, the four together about
 * 30% cheaper, and each is bought through a payment link the owner pastes in below; the
 * owner then grants it with the admin tool (`/api/admin/skins/grant`, by commander name).
 */

export type Currency = 'TRY' | 'USD';

export const SKIN_PRICE: Readonly<Record<Currency, number>> = { TRY: 99, USD: 2.99 };

/** The four together. Four apart is ₺396 / $11.96. */
export const BUNDLE_PRICE: Readonly<Record<Currency, number>> = { TRY: 279, USD: 8.49 };

/**
 * EACH LOOK'S PAYMENT LINK, AND THE FOUR TOGETHER. Paste them here (Stripe Payment Link,
 * Shopier, Gumroad…); an empty one is "on sale very soon" on the page, never a dead press.
 * `{commander}` in a link becomes the buyer's commander name, so a paid order names the
 * account to grant — for a Stripe link, end it with `?client_reference_id={commander}`.
 */
export const SKIN_CHECKOUT: Readonly<Record<PlanetSkinId | 'bundle', string>> = {
  'planet-lava': '',
  'planet-ice': '',
  'planet-toxic': '',
  'planet-desert': '',
  bundle: '',
};

/** Lira for a Turkish reader, dollars for everyone else. */
export const currencyFor = (language: string): Currency => (language.startsWith('tr') ? 'TRY' : 'USD');

/** A price the way the reader reads money: whole lira without a fraction, cents where there are any. */
export function priceText(amount: number, currency: Currency, locale: string): string {
  const whole = Number.isInteger(amount);
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: whole ? 0 : 2,
  }).format(amount);
}

/** What the four together save against the four apart, in whole percent. */
export const bundleSaving = (currency: Currency): number =>
  Math.round((1 - BUNDLE_PRICE[currency] / (SKIN_PRICE[currency] * 4)) * 100);

/**
 * The link a Buy press opens, with the buyer's commander where the link asks for it. Null
 * until the owner has pasted one, and for anything that is not https — a page that takes
 * money never opens a script or an unencrypted address.
 */
export function checkoutUrl(template: string, commander: string): string | null {
  const link = template.trim();
  if (!link.startsWith('https://')) return null;
  return link.replaceAll('{commander}', encodeURIComponent(commander));
}
