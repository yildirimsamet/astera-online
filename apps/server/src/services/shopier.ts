import { createHmac, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import type { Env } from '../env.js';

const API = 'https://api.shopier.com/v1';

/** Sales open only with the flag, both secrets, at least one price and the image folder. */
export function shopierReady(env: Env): boolean {
  return env.SHOPIER_CHECKOUT_ENABLED
    && env.SHOPIER_ACCESS_TOKEN.trim().length > 0
    && env.SHOPIER_WEBHOOK_TOKENS.length > 0
    && Object.keys(env.SHOPIER_PRICES).length > 0
    && env.SHOPIER_IMAGE_BASE_URL.length > 0;
}

/**
 * Shopier signs the raw body with HMAC-SHA256 and sends the hex digest (live, 2026-10-29).
 * Every subscription has its own token, so a delivery may match any of them. Base64 is the
 * same HMAC in another spelling, so also accepting it admits nothing forged.
 */
export function verifyShopierSignature(rawBody: string, signature: string | undefined, tokens: readonly string[]): boolean {
  if (!signature) return false;
  const given = signature.trim();
  return tokens.some(token => {
    const digest = createHmac('sha256', token).update(rawBody).digest();
    return [digest.toString('hex'), digest.toString('base64')].some(expected => {
      const a = Buffer.from(expected);
      const b = Buffer.from(expected.length === 64 ? given.toLowerCase() : given);
      return a.length === b.length && timingSafeEqual(a, b);
    });
  });
}

const headers = (env: Env) => ({ Authorization: `Bearer ${env.SHOPIER_ACCESS_TOKEN}`, Accept: 'application/json' });
const createdProduct = z.object({ id: z.string().regex(/^\d{1,20}$/), url: z.string().url() }).passthrough();

/**
 * A hidden (`customListing`), digital product with one in stock: it sells once, never shows
 * in the shop, and only its link opens it. Stage 0 showed the link works the moment it exists.
 */
export async function createShopierProduct(env: Env, product: { title: string; description: string; amount: number; imageUrl: string }) {
  const response = await fetch(`${API}/products`, {
    method: 'POST',
    headers: { ...headers(env), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: product.title,
      description: product.description,
      type: 'digital',
      media: [{ type: 'image', url: product.imageUrl, placement: 1 }],
      priceData: { currency: 'TRY', price: (product.amount / 100).toFixed(2) },
      shippingPayer: 'sellerPays',
      stockQuantity: 1,
      customListing: true,
    }),
    signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) throw new Error(`Shopier product create failed: ${response.status}`);
  const created = createdProduct.parse(await response.json());
  return { productId: created.id, url: created.url };
}

/** True once the product is gone; a product already deleted (404) is gone too. */
export async function deleteShopierProduct(env: Env, productId: string): Promise<boolean> {
  try {
    const response = await fetch(`${API}/products/${productId}`, { method: 'DELETE', headers: headers(env), signal: AbortSignal.timeout(3000) });
    return response.ok || response.status === 404;
  } catch {
    return false;
  }
}

/** A digital delivery closes the order; Shopier pays out only closed orders. */
export async function closeShopierOrder(env: Env, orderId: string): Promise<boolean> {
  try {
    const response = await fetch(`${API}/orders/${orderId}`, {
      method: 'PUT',
      headers: { ...headers(env), 'Content-Type': 'application/json' },
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
  const response = await fetch(`${API}/orders?limit=50`, { headers: headers(env), signal: AbortSignal.timeout(8000) });
  if (!response.ok) throw new Error(`Shopier order list failed: ${response.status}`);
  return response.json();
}
