import { randomUUID } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createPolarCheckoutSession } from '../src/services/polar.js';
import { testEnv } from './helpers.js';

const products = {
  POLAR_PRODUCT_LAVA: 'f372f658-e927-4051-b758-e5fa10d09f5f',
  POLAR_PRODUCT_ICE: 'fc685168-53ef-4309-bff8-1dc87c6eeb5a',
  POLAR_PRODUCT_TOXIC: '96a964b1-105f-4592-a236-4b118b512359',
  POLAR_PRODUCT_DESERT: '519098ee-2d23-4494-b07e-d11eda7a4b8b',
  POLAR_PRODUCT_TURKEY: '375d09b0-3c33-4800-ba8b-8582eefa5d1f',
  POLAR_PRODUCT_GERMANY: 'f557093b-eba9-499c-9788-a41c35eb3ad9',
  POLAR_PRODUCT_FRANCE: '468d0d5e-1b7b-42cc-9a50-8951292f177e',
  POLAR_PRODUCT_SPAIN: '2851d8bb-6017-4fc3-a3b3-3eae0ea85314',
  POLAR_PRODUCT_JAPAN: '0ec62d42-711e-4f7b-90ed-ef92d07a8bdb',
  POLAR_PRODUCT_BUNDLE: '9840aaf4-7e11-4aba-8234-6ab4f9379dcb',
};
const env = () => testEnv({ POLAR_ENV: 'sandbox', POLAR_CHECKOUT_ENABLED: 'true',
  POLAR_ACCESS_TOKEN: 'polar_oat_test', POLAR_WEBHOOK_SECRET: 'whsec_test',
  POLAR_RETURN_URL: 'http://localhost:5173/', ...products });
const parseBody = (body: unknown): unknown => {
  if (typeof body !== 'string') throw new Error('Expected JSON request body');
  return JSON.parse(body) as unknown;
};

afterEach(() => { vi.unstubAllGlobals(); });

describe('Polar checkout API boundary', () => {
  it('creates a sandbox checkout for one mapped item, binding account, local order and visitor IP', async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    const checkoutId = randomUUID();
    vi.stubGlobal('fetch', vi.fn((url: string, init: RequestInit) => {
      calls.push({ url, init });
      return Promise.resolve(new Response(JSON.stringify({ id: checkoutId, url: `https://sandbox.polar.sh/checkout/${checkoutId}`,
        expires_at: '2026-10-01T00:00:00Z', currency: 'try', total_amount: 9900 }), { status: 201 }));
    }));
    const accountId = randomUUID();
    const orderId = randomUUID();
    const result = await createPolarCheckoutSession(env(), {
      accountId, orderId, itemId: 'planet-lava', ip: '198.51.100.1', currency: 'TRY', expectedAmount: 9900,
    });
    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe('https://sandbox-api.polar.sh/v1/checkouts/');
    expect(calls[0]?.init.headers).toMatchObject({ Authorization: 'Bearer polar_oat_test' });
    expect(parseBody(calls[0]?.init.body)).toMatchObject({
      products: [products.POLAR_PRODUCT_LAVA], external_customer_id: accountId,
      customer_ip_address: '198.51.100.1', metadata: { astera_order_id: orderId },
      allow_discount_codes: false,
      currency: 'try',
      success_url: 'http://localhost:5173/', return_url: 'http://localhost:5173/',
    });
    expect(result).toMatchObject({ checkoutId, currency: 'TRY', totalAmount: 9900 });
  });

  it('sends the Japan product to Polar in EUR at the country price', async () => {
    const checkoutId = randomUUID();
    const calls: unknown[] = [];
    vi.stubGlobal('fetch', vi.fn((_url: string, init: RequestInit) => {
      calls.push(parseBody(init.body));
      return Promise.resolve(new Response(JSON.stringify({ id: checkoutId,
        url: `https://sandbox.polar.sh/checkout/${checkoutId}`,
        expires_at: '2026-10-01T00:00:00Z', currency: 'eur', total_amount: 299 }), { status: 201 }));
    }));
    await createPolarCheckoutSession(env(), {
      accountId: randomUUID(), orderId: randomUUID(), itemId: 'planet-japan',
      ip: '127.0.0.1', currency: 'EUR', expectedAmount: 299,
    });
    expect(calls[0]).toMatchObject({ products: [products.POLAR_PRODUCT_JAPAN], currency: 'eur' });
  });

  it('uses the live API only for production and refuses a checkout URL outside Polar', async () => {
    const seen: string[] = [];
    vi.stubGlobal('fetch', vi.fn((url: string) => {
      seen.push(url);
      return Promise.resolve(new Response(JSON.stringify({ id: randomUUID(), url: 'https://attacker.example/checkout',
        expires_at: '2026-10-01T00:00:00Z', currency: 'eur', total_amount: 299 }), { status: 201 }));
    }));
    await expect(createPolarCheckoutSession(testEnv({ ...products, POLAR_ENV: 'production',
      POLAR_CHECKOUT_ENABLED: 'true', POLAR_ACCESS_TOKEN: 'polar_oat_test',
      POLAR_WEBHOOK_SECRET: 'whsec_test', POLAR_RETURN_URL: 'https://asteraonline.space/' }), {
      accountId: randomUUID(), orderId: randomUUID(), itemId: 'planet-spain', ip: '203.0.113.1',
      currency: 'EUR', expectedAmount: 299,
    })).rejects.toMatchObject({ code: 'POLAR_UNAVAILABLE' });
    expect(seen).toEqual(['https://api.polar.sh/v1/checkouts/']);
  });

  it('fails closed on incomplete configuration and does not call Polar', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    await expect(createPolarCheckoutSession(testEnv(), {
      accountId: randomUUID(), orderId: randomUUID(), itemId: 'planet-ice', ip: '203.0.113.1',
      currency: 'EUR', expectedAmount: 299,
    })).rejects.toMatchObject({ code: 'SKIN_SHOP_CLOSED' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('does not send a loopback customer IP to Polar in local sandbox tests', async () => {
    const calls: unknown[] = [];
    vi.stubGlobal('fetch', vi.fn((_url: string, init: RequestInit) => {
      calls.push(parseBody(init.body));
      return Promise.resolve(new Response(JSON.stringify({ id: randomUUID(), url: 'https://sandbox.polar.sh/checkout/test',
        expires_at: '2026-10-01T00:00:00Z', currency: 'eur', total_amount: 299 }), { status: 201 }));
    }));
    await createPolarCheckoutSession(env(), { accountId: randomUUID(), orderId: randomUUID(),
      itemId: 'planet-lava', ip: '127.0.0.1', currency: 'EUR', expectedAmount: 299 });
    expect(calls[0]).not.toHaveProperty('customer_ip_address');
  });
});
