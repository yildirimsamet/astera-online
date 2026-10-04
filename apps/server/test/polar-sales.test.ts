import { createHmac, randomBytes, randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { pino } from 'pino';
import { z } from 'zod';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildApp } from '../src/app.js';
import { TokenService } from '../src/auth/tokens.js';
import { cosmeticEntitlements, polarSkinOrders } from '../src/db/schema.js';
import { seedWorld, testDb, testEnv, type Fixture } from './helpers.js';

const secret = `whsec_${randomBytes(32).toString('base64')}`;
const products = {
  POLAR_PRODUCT_LAVA: 'f372f658-e927-4051-b758-e5fa10d09f5f',
  POLAR_PRODUCT_ICE: 'fc685168-53ef-4309-bff8-1dc87c6eeb5a',
  POLAR_PRODUCT_TOXIC: '96a964b1-105f-4592-a236-4b118b512359',
  POLAR_PRODUCT_DESERT: '519098ee-2d23-4494-b07e-d11eda7a4b8b',
  POLAR_PRODUCT_TURKEY: '375d09b0-3c33-4800-ba8b-8582eefa5d1f',
  POLAR_PRODUCT_GERMANY: 'f557093b-eba9-499c-9788-a41c35eb3ad9',
  POLAR_PRODUCT_FRANCE: '468d0d5e-1b7b-42cc-9a50-8951292f177e',
  POLAR_PRODUCT_SPAIN: '2851d8bb-6017-4fc3-a3b3-3eae0ea85314',
  POLAR_PRODUCT_JAPAN: '45e05baf-b244-4b89-920b-26a582774b70',
  POLAR_PRODUCT_BUNDLE: '9840aaf4-7e11-4aba-8234-6ab4f9379dcb',
};

afterAll(async () => { const { close } = await testDb(); await close(); });

describe('Polar skin sales', () => {
  let fixture: Fixture;
  let app: ReturnType<typeof buildApp>['app'];
  let close: () => Promise<void>;
  let authorization: string;
  const checkoutId = randomUUID();
  let nextCheckoutId: string;
  let checkoutCalls: unknown[];

  beforeEach(async () => {
    fixture = await seedWorld(1);
    nextCheckoutId = checkoutId;
    checkoutCalls = [];
    vi.stubGlobal('fetch', vi.fn((url: string, init?: RequestInit) => {
      if (url === 'https://api.country.is/198.51.100.1') {
        return Promise.resolve(new Response(JSON.stringify({ ip: '198.51.100.1', country: 'TR' })));
      }
      if (url !== 'https://sandbox-api.polar.sh/v1/checkouts/') throw new Error(`Unexpected URL: ${url}`);
      if (typeof init?.body !== 'string') throw new Error('Expected JSON checkout body');
      const checkoutBody = z.object({ currency: z.string(), products: z.array(z.string()) })
        .passthrough().parse(JSON.parse(init.body));
      checkoutCalls.push(checkoutBody);
      const amount = checkoutBody.products[0] === products.POLAR_PRODUCT_BUNDLE ? 27900 : 9900;
      return Promise.resolve(new Response(JSON.stringify({ id: nextCheckoutId, url: `https://sandbox.polar.sh/checkout/${nextCheckoutId}`,
        expires_at: '2027-01-01T00:00:00Z', currency: 'try', total_amount: amount }), { status: 201 }));
    }));
    const built = buildApp({ env: testEnv({ ...products, POLAR_ENV: 'sandbox', POLAR_CHECKOUT_ENABLED: 'true',
      POLAR_ACCESS_TOKEN: 'polar_oat_test', POLAR_WEBHOOK_SECRET: secret,
      POLAR_RETURN_URL: 'http://localhost:5173/' }), db: fixture.db,
      clock: fixture.clock, logger: pino({ level: 'silent' }) });
    app = built.app;
    close = built.close;
    await app.ready();
    authorization = `Bearer ${await new TokenService('test-secret-that-is-long-enough', 15, 30)
      .issueAccess(fixture.accountIds[0]!)}`;
  });
  afterEach(async () => { vi.unstubAllGlobals(); await close(); });

  async function purchase(itemId: string) {
    return app.inject({ method: 'POST', url: '/api/skins/polar-purchase', remoteAddress: '198.51.100.1',
      headers: { authorization }, payload: { itemId } });
  }
  async function owned(): Promise<string[]> {
    const response = await app.inject({ method: 'GET', url: '/api/skins', headers: { authorization } });
    return z.object({ ownedSkinIds: z.array(z.string()) }).parse(response.json()).ownedSkinIds;
  }
  async function webhook(type: string, data: object, webhookId = randomUUID(), valid = true) {
    const payload = JSON.stringify({ type, timestamp: new Date().toISOString(), data });
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = createHmac('sha256', Buffer.from(secret.slice(6), 'base64'))
      .update(`${webhookId}.${timestamp}.${payload}`).digest('base64');
    return app.inject({ method: 'POST', url: '/api/polar/webhook', payload,
      headers: { 'content-type': 'application/json', 'webhook-id': webhookId,
        'webhook-timestamp': String(timestamp), 'webhook-signature': valid ? `v1,${signature}` : 'v1,invalid' } });
  }
  function paid(localId: string, itemId: string, orderId = randomUUID()) {
    const productId = products[`POLAR_PRODUCT_${itemId.toUpperCase().replace('PLANET-', '')}` as keyof typeof products];
    return { id: orderId, status: 'paid', paid: true, product_id: productId,
      checkout_id: checkoutId, metadata: { astera_order_id: localId },
      total_amount: 9900, refunded_amount: 0, customer: { external_id: fixture.accountIds[0] } };
  }

  it('quotes TRY in Turkey and leaves EUR only products in EUR', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/skins/polar-pricing', remoteAddress: '198.51.100.1' });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ countryCode: 'TR', prices: {
      'planet-lava': { formatted: '₺99', currencyCode: 'TRY', amount: 9900 },
      'planet-germany': { formatted: '€2.99', currencyCode: 'EUR', amount: 299 },
    } });
  });

  it('requires auth, creates one checkout for an item and grants only after a valid signed paid order', async () => {
    expect((await app.inject({ method: 'POST', url: '/api/skins/polar-purchase', payload: { itemId: 'planet-lava' } })).statusCode).toBe(401);
    const response = await purchase('planet-lava');
    expect(response.statusCode, response.body).toBe(200);
    expect(response.json()).toMatchObject({ checkoutId, url: `https://sandbox.polar.sh/checkout/${checkoutId}` });
    expect(await owned()).toEqual([]);
    expect((await purchase('planet-lava')).statusCode).toBe(200);
    expect(checkoutCalls).toHaveLength(1);
    expect(checkoutCalls[0]).toMatchObject({ products: [products.POLAR_PRODUCT_LAVA],
      external_customer_id: fixture.accountIds[0], customer_ip_address: '198.51.100.1', currency: 'try' });
    const [intent] = await fixture.db.select().from(polarSkinOrders).where(eq(polarSkinOrders.checkoutId, checkoutId));
    expect(intent?.status).toBe('PENDING');
    const data = paid(intent!.id, 'planet-lava');
    expect((await webhook('order.paid', data, randomUUID(), false)).statusCode).toBe(401);
    expect(await owned()).toEqual([]);
    const eventId = randomUUID();
    expect((await webhook('order.paid', data, eventId)).statusCode).toBe(200);
    expect((await webhook('order.paid', data, eventId)).statusCode).toBe(200);
    expect(await owned()).toEqual(['planet-lava']);
    const rights = await fixture.db.select().from(cosmeticEntitlements)
      .where(eq(cosmeticEntitlements.accountId, fixture.accountIds[0]!));
    expect(rights).toHaveLength(1);
    expect(rights[0]).toMatchObject({ source: 'POLAR', orderRef: `${data.id}:planet-lava` });
  });

  it('rejects a mismatched product and blocks a single elemental checkout during a pending bundle', async () => {
    expect((await purchase('bundle')).statusCode).toBe(200);
    expect((await purchase('planet-lava')).statusCode).toBe(409);
    const [intent] = await fixture.db.select().from(polarSkinOrders)
      .where(eq(polarSkinOrders.checkoutId, checkoutId));
    expect((await webhook('order.paid', { ...paid(intent!.id, 'bundle'), product_id: products.POLAR_PRODUCT_LAVA })).statusCode).toBe(200);
    expect(await owned()).toEqual([]);
    expect((await webhook('order.paid', paid(intent!.id, 'bundle'))).statusCode).toBe(200);
    expect(new Set(await owned())).toEqual(new Set(['planet-lava', 'planet-ice', 'planet-toxic', 'planet-desert']));
  });

  it('starts a new checkout when the previous pending session has expired', async () => {
    expect((await purchase('planet-lava')).statusCode).toBe(200);
    await fixture.db.update(polarSkinOrders).set({ expiresAt: new Date(Date.now() - 1000) })
      .where(eq(polarSkinOrders.checkoutId, checkoutId));
    nextCheckoutId = randomUUID();
    const replacement = await purchase('planet-lava');
    expect(replacement.statusCode).toBe(200);
    expect(replacement.json()).toMatchObject({ checkoutId: nextCheckoutId });
    expect(checkoutCalls).toHaveLength(2);
    const orders = await fixture.db.select({ status: polarSkinOrders.status })
      .from(polarSkinOrders).where(eq(polarSkinOrders.accountId, fixture.accountIds[0]!));
    expect(orders.map(order => order.status)).toEqual(['FAILED', 'PENDING']);
  });

  it('reverses only fully refunded Polar rights and keeps a pre-payment reversal from granting', async () => {
    expect((await purchase('planet-ice')).statusCode).toBe(200);
    const [intent] = await fixture.db.select().from(polarSkinOrders)
      .where(eq(polarSkinOrders.checkoutId, checkoutId));
    const data = paid(intent!.id, 'planet-ice');
    expect((await webhook('order.paid', data)).statusCode).toBe(200);
    expect((await webhook('order.refunded', { ...data, status: 'partially_refunded',
      refunded_amount: 100, refunded_tax_amount: 20 })).statusCode).toBe(200);
    expect(await owned()).toEqual(['planet-ice']);
    expect((await webhook('order.refunded', { ...data, status: 'refunded',
      refunded_amount: 8250, refunded_tax_amount: 1650 })).statusCode).toBe(200);
    expect(await owned()).toEqual([]);
    expect((await webhook('order.paid', data)).statusCode).toBe(200);
    expect(await owned()).toEqual([]);
  });

  it('does not revoke a paid skin for a refund that names a different Polar order', async () => {
    expect((await purchase('planet-lava')).statusCode).toBe(200);
    const [intent] = await fixture.db.select().from(polarSkinOrders)
      .where(eq(polarSkinOrders.checkoutId, checkoutId));
    const data = paid(intent!.id, 'planet-lava');
    expect((await webhook('order.paid', data)).statusCode).toBe(200);
    expect((await webhook('order.refunded', { ...data, id: randomUUID(), status: 'refunded',
      refunded_amount: 8250, refunded_tax_amount: 1650 })).statusCode).toBe(200);
    expect(await owned()).toEqual(['planet-lava']);
    const [orderAfter] = await fixture.db.select().from(polarSkinOrders).where(eq(polarSkinOrders.id, intent!.id));
    expect(orderAfter?.status).toBe('COMPLETED');
  });

  it('does not grant if a full refund arrives before the paid event', async () => {
    expect((await purchase('planet-ice')).statusCode).toBe(200);
    const [intent] = await fixture.db.select().from(polarSkinOrders)
      .where(eq(polarSkinOrders.checkoutId, checkoutId));
    const data = paid(intent!.id, 'planet-ice');
    expect((await webhook('order.refunded', { ...data, status: 'refunded',
      refunded_amount: 8250, refunded_tax_amount: 1650 })).statusCode).toBe(200);
    expect((await webhook('order.paid', data)).statusCode).toBe(200);
    expect(await owned()).toEqual([]);
  });
});
