import { createHmac, timingSafeEqual } from 'node:crypto';
import type { Env } from '../env.js';

const API = 'https://api.shopier.com/v1';

/** Sales open only with the flag, both secrets and at least one mapped product. */
export function shopierReady(env: Env): boolean {
  return env.SHOPIER_CHECKOUT_ENABLED
    && env.SHOPIER_ACCESS_TOKEN.trim().length > 0
    && env.SHOPIER_WEBHOOK_TOKEN.trim().length > 0
    && Object.keys(env.SHOPIER_PRODUCTS).length > 0;
}

/** Shopier serves every product at its bare ID; the shop name in the path is optional. */
export const shopierProductUrl = (productId: string): string => `https://www.shopier.com/${productId}`;

/**
 * Shopier's own PHP and Python handlers compute HMAC-SHA256 of the raw body with the
 * subscription's token and compare its hex digest. Base64 is the same HMAC in another
 * spelling, so also accepting it admits nothing forged.
 */
export function verifyShopierSignature(rawBody: string, signature: string | undefined, token: string): boolean {
  if (!signature || !token) return false;
  const digest = createHmac('sha256', token).update(rawBody).digest();
  const given = signature.trim();
  for (const expected of [digest.toString('hex'), digest.toString('base64')]) {
    const a = Buffer.from(expected);
    const b = Buffer.from(expected.length === 64 ? given.toLowerCase() : given);
    if (a.length === b.length && timingSafeEqual(a, b)) return true;
  }
  return false;
}

/** A digital delivery closes the order; Shopier pays out only closed orders. */
export async function closeShopierOrder(env: Env, orderId: string): Promise<boolean> {
  try {
    const response = await fetch(`${API}/orders/${orderId}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${env.SHOPIER_ACCESS_TOKEN}`, Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ fulfillments: { productType: 'digital', note: 'Astera Online hesabına otomatik tanımlandı.' } }),
      signal: AbortSignal.timeout(3000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

/** The 50 most recent orders, newest first, as Shopier returns them. */
export async function listShopierOrders(env: Env): Promise<unknown> {
  const response = await fetch(`${API}/orders?limit=50`, {
    headers: { Authorization: `Bearer ${env.SHOPIER_ACCESS_TOKEN}`, Accept: 'application/json' },
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error(`Shopier order list failed: ${response.status}`);
  return response.json();
}
