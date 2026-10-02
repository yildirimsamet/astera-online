import type { Env } from '../env.js';
import { isIP } from 'node:net';
import { z } from 'zod';
import { GameError } from './planet.js';

export function productIdsFor(env: Env) {
  return {
    'planet-lava': env.POLAR_PRODUCT_LAVA,
    'planet-ice': env.POLAR_PRODUCT_ICE,
    'planet-toxic': env.POLAR_PRODUCT_TOXIC,
    'planet-desert': env.POLAR_PRODUCT_DESERT,
    'planet-turkey': env.POLAR_PRODUCT_TURKEY,
    'planet-germany': env.POLAR_PRODUCT_GERMANY,
    'planet-france': env.POLAR_PRODUCT_FRANCE,
    'planet-spain': env.POLAR_PRODUCT_SPAIN,
    'planet-japan': env.POLAR_PRODUCT_JAPAN,
    bundle: env.POLAR_PRODUCT_BUNDLE,
  } as const;
}

export function polarReady(env: Env): boolean {
  return env.POLAR_CHECKOUT_ENABLED
    && env.POLAR_ACCESS_TOKEN.trim().length > 0
    && env.POLAR_WEBHOOK_SECRET.trim().length > 0
    && Object.values(productIdsFor(env)).every(id => id.length > 0);
}

export type PolarItemId = keyof ReturnType<typeof productIdsFor>;

const euroPrices: Record<PolarItemId, number> = {
  'planet-lava': 299, 'planet-ice': 299, 'planet-toxic': 299, 'planet-desert': 299,
  'planet-turkey': 299, 'planet-germany': 299, 'planet-france': 299,
  'planet-spain': 299, 'planet-japan': 299, bundle: 849,
};
const liraPrices: Partial<Record<PolarItemId, number>> = {
  'planet-lava': 9900, 'planet-ice': 9900, 'planet-toxic': 9900,
  'planet-desert': 9900, 'planet-turkey': 9900, bundle: 27900,
};
const countryCache = new Map<string, { countryCode: string; expiresAt: number }>();
const countryResponse = z.object({ country: z.string().length(2) });

/** Resolve the visitor's country on the server; checkout uses the same currency as the quote. */
export async function polarPricingForIp(ip: string) {
  if (!isIP(ip)) throw new GameError('POLAR_PRICING_UNAVAILABLE', 'Location unavailable', 502);
  const cached = countryCache.get(ip);
  let countryCode = ip === '127.0.0.1' || ip === '::1' ? 'ZZ'
    : cached && cached.expiresAt > Date.now() ? cached.countryCode : undefined;
  if (!countryCode) {
    try {
      const response = await fetch(`https://api.country.is/${encodeURIComponent(ip)}`, {
        signal: AbortSignal.timeout(3000),
      });
      if (!response.ok) throw new Error('Country lookup failed');
      countryCode = countryResponse.parse(await response.json()).country.toUpperCase();
      if (countryCache.size >= 1000) countryCache.delete(countryCache.keys().next().value!);
      countryCache.set(ip, { countryCode, expiresAt: Date.now() + 60 * 60 * 1000 });
    } catch {
      throw new GameError('POLAR_PRICING_UNAVAILABLE', 'Location unavailable', 502);
    }
  }
  const prices = {} as Record<PolarItemId, { currencyCode: 'EUR' | 'TRY'; formatted: string; amount: number }>;
  for (const itemId of Object.keys(euroPrices) as PolarItemId[]) {
    const lira = countryCode === 'TR' ? liraPrices[itemId] : undefined;
    prices[itemId] = lira === undefined
      ? { currencyCode: 'EUR', formatted: `€${(euroPrices[itemId] / 100).toFixed(2)}`, amount: euroPrices[itemId] }
      : { currencyCode: 'TRY', formatted: `₺${lira / 100}`, amount: lira };
  }
  return { countryCode, prices };
}

const checkoutResponse = z.object({
  id: z.string().uuid(),
  url: z.string().url().refine(value => {
    const url = new URL(value);
    return url.protocol === 'https:' && (url.hostname === 'polar.sh' || url.hostname.endsWith('.polar.sh'));
  }),
  expires_at: z.string().datetime(),
  currency: z.string().length(3),
  total_amount: z.number().int().nonnegative(),
});

/** Create only a hosted checkout. No skin is granted until a verified order.paid webhook. */
export async function createPolarCheckoutSession(env: Env, input: {
  accountId: string;
  orderId: string;
  itemId: PolarItemId;
  ip: string;
  currency: 'EUR' | 'TRY';
  expectedAmount: number;
}) {
  if (!polarReady(env)) throw new GameError('SKIN_SHOP_CLOSED', 'Skin sales are not available yet', 503);
  const base = env.POLAR_ENV === 'sandbox' ? 'https://sandbox-api.polar.sh' : 'https://api.polar.sh';
  try {
    const response = await fetch(`${base}/v1/checkouts/`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.POLAR_ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        products: [productIdsFor(env)[input.itemId]],
        currency: input.currency.toLowerCase(),
        external_customer_id: input.accountId,
        ...(input.ip === '127.0.0.1' || input.ip === '::1' ? {} : { customer_ip_address: input.ip }),
        metadata: { astera_order_id: input.orderId },
        allow_discount_codes: false,
        success_url: env.POLAR_RETURN_URL,
        return_url: env.POLAR_RETURN_URL,
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) throw new Error('Polar checkout request failed');
    const parsed = checkoutResponse.parse(await response.json());
    if (parsed.currency.toUpperCase() !== input.currency || parsed.total_amount !== input.expectedAmount) {
      throw new Error('Polar checkout price does not match the displayed price');
    }
    return { checkoutId: parsed.id, url: parsed.url, expiresAt: new Date(parsed.expires_at),
      currency: parsed.currency.toUpperCase(), totalAmount: parsed.total_amount };
  } catch {
    throw new GameError('POLAR_UNAVAILABLE', 'Payment service unavailable', 502);
  }
}
