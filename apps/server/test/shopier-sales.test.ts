import { createHmac, randomBytes, randomUUID } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { pino } from 'pino';
import { z } from 'zod';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildApp } from '../src/app.js';
import { TokenService } from '../src/auth/tokens.js';
import { loadEnv } from '../src/env.js';
import { accounts, cosmeticEntitlements, planets, shopierCheckouts, shopierOrders } from '../src/db/schema.js';
import { sweepShopierCheckouts } from '../src/services/shopierSales.js';
import { seedWorld, testDb, testEnv, type Fixture } from './helpers.js';
import type * as Bus from '../src/stream/bus.js';

// A pass-through spy: the real notification still goes out; the test only records it.
const published = vi.hoisted(() => [] as { shard: string; kind: string }[]);
vi.mock('../src/stream/bus.js', async (importOriginal) => {
  const actual = await importOriginal<typeof Bus>();
  return { ...actual, publishShard: (...args: Parameters<typeof Bus.publishShard>) => {
    published.push({ shard: args[1], kind: args[2] });
    return actual.publishShard(...args);
  } };
});

const DONATION = '51278360';
const HOUR = 3_600_000;
// Shopier signs each subscription with its own token (Stage 0, 2026-10-29).
const orderToken = randomBytes(24).toString('hex');
const refundToken = randomBytes(24).toString('hex');
const prices = { 'planet-lava': 9900, 'planet-ice': 9900, bundle: 27900, 'ring-aurora': 4900, 'ring-helios': 4900,
  'ring-saturn': 4900, 'engine-aurora': 4900 };
const IMAGES = 'https://asteraonline.space/assets/images/shopier';

afterAll(async () => { const { close } = await testDb(); await close(); });

interface ApiCall { method: string; url: string; body: unknown }

describe('Shopier sales', () => {
  let fixture: Fixture;
  let app: ReturnType<typeof buildApp>['app'];
  let close: () => Promise<void>;
  let admin: { authorization: string };
  let player: { authorization: string };
  let playerUsername: string;
  let adminUsername: string;
  let calls: ApiCall[];
  let createStatus: number;
  let deleteStatus: number;
  let closeStatus: number;
  let remoteOrders: unknown[];
  let orderSeq: number;
  let productSeq: number;
  let envOver: Record<string, string>;

  const settings = (over: Record<string, string> = {}) => ({ ADMIN_USERNAMES: adminUsername, SHOPIER_CHECKOUT_ENABLED: 'true',
    SHOPIER_ACCESS_TOKEN: 'shopier-pat', SHOPIER_WEBHOOK_TOKENS: `${orderToken},${refundToken}`,
    SHOPIER_PRICES: JSON.stringify(prices), SHOPIER_IMAGE_BASE_URL: IMAGES, ...over });

  async function start(over: Record<string, string> = {}) {
    envOver = over;
    const built = buildApp({ env: testEnv(settings(over)), db: fixture.db, clock: fixture.clock, logger: pino({ level: 'silent' }) });
    app = built.app;
    close = built.close;
    await app.ready();
  }

  beforeEach(async () => {
    fixture = await seedWorld(2);
    const names = await fixture.db.select({ id: accounts.id, username: accounts.username }).from(accounts);
    adminUsername = names.find(row => row.id === fixture.accountIds[0])!.username;
    playerUsername = names.find(row => row.id === fixture.accountIds[1])!.username;
    calls = [];
    createStatus = 200;
    deleteStatus = 200;
    closeStatus = 200;
    remoteOrders = [];
    orderSeq = 900_000_000 + Math.floor(Math.random() * 1000) * 1000;
    productSeq = 60_000_000 + Math.floor(Math.random() * 1000) * 1000;
    vi.stubGlobal('fetch', vi.fn((url: string, init?: RequestInit) => {
      const method = init?.method ?? 'GET';
      calls.push({ method, url, body: typeof init?.body === 'string' ? JSON.parse(init.body) : undefined });
      const headers = new Headers(init?.headers);
      if (headers.get('authorization') !== 'Bearer shopier-pat') throw new Error('Missing Shopier token');
      if (method === 'POST' && url === 'https://api.shopier.com/v1/products') {
        if (createStatus !== 200) return Promise.resolve(new Response('{"error":"x"}', { status: createStatus }));
        const id = String(productSeq++);
        return Promise.resolve(new Response(JSON.stringify({ id, url: `https://www.shopier.com/${id}`, stockQuantity: 1 }), { status: 200 }));
      }
      if (method === 'DELETE' && /^https:\/\/api\.shopier\.com\/v1\/products\/\d+$/.test(url)) {
        return Promise.resolve(new Response(deleteStatus === 404 ? '{"error":"notFound"}' : '{}', { status: deleteStatus }));
      }
      if (method === 'PUT' && /^https:\/\/api\.shopier\.com\/v1\/orders\/\d+$/.test(url)) {
        return Promise.resolve(new Response(JSON.stringify({}), { status: closeStatus }));
      }
      if (method === 'GET' && url.startsWith('https://api.shopier.com/v1/orders?')) {
        return Promise.resolve(new Response(JSON.stringify(remoteOrders), { status: 200 }));
      }
      throw new Error(`Unexpected request: ${method} ${url}`);
    }));
    const tokens = new TokenService('test-secret-that-is-long-enough', 15, 30);
    admin = { authorization: `Bearer ${await tokens.issueAccess(fixture.accountIds[0]!)}` };
    player = { authorization: `Bearer ${await tokens.issueAccess(fixture.accountIds[1]!)}` };
    await start();
  });
  afterEach(async () => { vi.unstubAllGlobals(); vi.restoreAllMocks(); await close(); });

  const closes = () => calls.filter(call => call.method === 'PUT');
  const creates = () => calls.filter(call => call.method === 'POST' && call.url.endsWith('/products'));
  const deletes = () => calls.filter(call => call.method === 'DELETE').map(call => call.url.split('/').pop());
  const sweep = () => sweepShopierCheckouts(fixture.db, loadEnv({ DATABASE_URL: 'postgres://test', JWT_SECRET: 'test-secret-that-is-long-enough',
    ...settings(envOver) }), fixture.clock.now());

  async function checkoutFor(itemId: string, auth = player) {
    return app.inject({ method: 'POST', url: '/api/skins/shopier-checkout', headers: auth, payload: { itemId } });
  }
  /** Opens (or reopens) this commander's own product and returns its Shopier ID. */
  async function opened(itemId: string): Promise<string> {
    const response = await checkoutFor(itemId);
    expect(response.statusCode, response.body).toBe(200);
    return z.object({ url: z.string() }).parse(response.json()).url.split('/').pop()!;
  }
  async function checkoutRows() {
    return fixture.db.select().from(shopierCheckouts).where(eq(shopierCheckouts.accountId, fixture.accountIds[1]!));
  }
  async function checkoutOf(productId: string) {
    const [found] = await fixture.db.select().from(shopierCheckouts).where(eq(shopierCheckouts.productId, productId));
    return found;
  }
  const lira = (kurus: number) => (kurus / 100).toFixed(2);
  function order(productId: string, amount = 9900, over: Record<string, unknown> = {}) {
    return {
      id: String(orderSeq++), status: 'unfulfilled', paymentStatus: 'paid', installments: false,
      dateCreated: '2026-10-29T14:09:15+0300', currency: 'TRY', paymentMethod: 'debitCard',
      totals: { subtotal: lira(amount), shipping: '0.00', discount: '0.00', total: lira(amount) }, discounts: [],
      shippingInfo: { firstName: '', lastName: '', nationalId: '', email: '', phone: '', company: '', address: '',
        district: '', city: '', state: '', postcode: '', country: 'Türkiye' },
      billingInfo: {}, note: '',
      lineItems: [{ productId, title: 'Astera Online · Gezegen görünümü', type: 'digital', selection: [], options: [],
        quantity: 1, price: lira(amount), total: lira(amount) }],
      fulfillments: [], returns: [], refunds: [], ...over,
    };
  }
  async function webhook(event: string, body: object, options: { id?: string; token?: string; signature?: string | null } = {}) {
    const payload = JSON.stringify(body);
    const signature = options.signature !== undefined ? options.signature
      : createHmac('sha256', options.token ?? (event.startsWith('refund') ? refundToken : orderToken)).update(payload).digest('hex');
    const headers: Record<string, string> = { 'content-type': 'application/json', 'user-agent': 'Shopier', 'shopier-event': event,
      'shopier-webhook-id': options.id ?? randomUUID(), 'shopier-timestamp': String(Math.floor(Date.now() / 1000)),
      'shopier-account-id': '88059e360366f18b', 'shopier-api-version': 'v1' };
    if (signature !== null) headers['shopier-signature'] = signature;
    return app.inject({ method: 'POST', url: '/api/shopier/webhook', payload, headers });
  }
  async function owned(auth = player): Promise<string[]> {
    const response = await app.inject({ method: 'GET', url: '/api/skins', headers: auth });
    return z.object({ ownedCosmeticIds: z.array(z.string()) }).parse(response.json()).ownedCosmeticIds.sort();
  }
  async function row(orderId: string) {
    const [found] = await fixture.db.select().from(shopierOrders).where(eq(shopierOrders.orderId, orderId));
    return found;
  }
  async function shopierRights() {
    return fixture.db.select().from(cosmeticEntitlements).where(eq(cosmeticEntitlements.source, 'SHOPIER'));
  }
  async function manual(accountIndex: number, cosmeticId: string) {
    await fixture.db.insert(cosmeticEntitlements).values({ accountId: fixture.accountIds[accountIndex]!, cosmeticId,
      source: 'MANUAL', orderRef: `manual-${cosmeticId}-${randomUUID()}` });
  }

  describe('the commander\'s own Shopier product', () => {
    it('publishes only configured prices, and nothing while closed', async () => {
      const open = await app.inject({ method: 'GET', url: '/api/skins/shopier-shop' });
      expect(open.json()).toEqual({ enabled: true, prices });
      await close();
      await start({ SHOPIER_CHECKOUT_ENABLED: 'false' });
      expect((await app.inject({ method: 'GET', url: '/api/skins/shopier-shop' })).json()).toEqual({ enabled: false, prices: {} });
      expect((await checkoutFor('planet-lava')).statusCode).toBe(503);
      expect(creates()).toEqual([]);
    });

    it('requires a commander, a known item and a lira price', async () => {
      expect((await app.inject({ method: 'POST', url: '/api/skins/shopier-checkout', payload: { itemId: 'planet-lava' } })).statusCode).toBe(401);
      expect((await checkoutFor('planet-mars')).statusCode).toBe(400);
      const missing = await checkoutFor('planet-toxic');
      expect(missing.statusCode).toBe(404);
      expect(missing.json()).toMatchObject({ error: 'SHOPIER_PRODUCT_MISSING' });
      expect(creates()).toEqual([]);
    });

    it('opens a hidden, digital, single-stock product at the server\'s price and image', async () => {
      const response = await checkoutFor('planet-lava');
      expect(response.statusCode, response.body).toBe(200);
      const body = response.json<{ url: string; amount: number; currency: string; expiresAt: string }>();
      const productId = body.url.split('/').pop()!;
      expect(body).toEqual({ url: `https://www.shopier.com/${productId}`, amount: 9900, currency: 'TRY',
        expiresAt: new Date(fixture.clock.now().getTime() + 48 * HOUR).toISOString() });
      expect(creates()).toHaveLength(1);
      expect(creates()[0]!.body).toEqual({
        title: 'Astera Online · Gezegen görünümü',
        description: expect.stringContaining('Astera Online') as string,
        type: 'digital',
        media: [{ type: 'image', url: `${IMAGES}/planet-lava.jpg`, placement: 1 }],
        priceData: { currency: 'TRY', price: '99.00' },
        shippingPayer: 'sellerPays',
        stockQuantity: 1,
        customListing: true,
      });
      expect(await checkoutOf(productId)).toMatchObject({ accountId: fixture.accountIds[1], itemId: 'planet-lava', amount: 9900,
        status: 'OPEN', url: body.url });
    });

    it('names a ring, a ship trail and the set by what they are', async () => {
      await opened('ring-aurora');
      await opened('engine-aurora');
      await opened('bundle');
      expect(creates().map(call => z.object({ title: z.string() }).parse(call.body).title)).toEqual([
        'Astera Online · Gezegen halkası görünümü', 'Astera Online · Motor alevi görünümü', 'Astera Online · 4\'lü gezegen görünümü paketi']);
      expect(z.object({ media: z.array(z.object({ url: z.string() })) }).parse(creates()[2]!.body).media[0]!.url).toBe(`${IMAGES}/bundle.jpg`);
    });

    it('gives the same product back on a later press and restarts its 48 hours', async () => {
      const first = await opened('planet-lava');
      fixture.clock.advance(10 * 60);
      expect(await opened('planet-lava')).toBe(first);
      expect(creates()).toHaveLength(1);
      expect((await checkoutOf(first))?.expiresAt).toEqual(new Date(fixture.clock.now().getTime() + 48 * HOUR));
    });

    it('opens one product for concurrent presses', async () => {
      const ids = await Promise.all(Array.from({ length: 6 }, () => checkoutFor('planet-lava')));
      const ok = ids.filter(response => response.statusCode === 200).map(response => response.json<{ url: string }>().url);
      expect(new Set(ok).size).toBe(1);
      for (const response of ids) expect([200, 409]).toContain(response.statusCode);
      expect(creates()).toHaveLength(1);
      expect(await checkoutRows()).toHaveLength(1);
    });

    it('closes an overlapping open product: the set replaces its looks and a look replaces the set', async () => {
      const lava = await opened('planet-lava');
      const ring = await opened('ring-aurora');
      const set = await opened('bundle');
      expect((await checkoutOf(lava))?.status).toBe('CANCELLED');
      expect((await checkoutOf(ring))?.status).toBe('OPEN');
      const ice = await opened('planet-ice');
      expect((await checkoutOf(set))?.status).toBe('CANCELLED');
      expect((await checkoutOf(ice))?.status).toBe('OPEN');
    });

    it('refuses a look, or a set, the commander already owns in part', async () => {
      await manual(1, 'planet-lava');
      expect((await checkoutFor('planet-lava')).json()).toMatchObject({ error: 'SKIN_ALREADY_OWNED' });
      expect((await checkoutFor('bundle')).statusCode).toBe(409);
      expect((await checkoutFor('ring-aurora')).statusCode).toBe(200);
      expect(creates()).toHaveLength(1);
    });

    it('reports a Shopier failure and tries afresh on the next press', async () => {
      createStatus = 500;
      const failed = await checkoutFor('planet-lava');
      expect(failed.statusCode).toBe(502);
      expect(failed.json()).toMatchObject({ error: 'SHOPIER_UNAVAILABLE' });
      expect(await checkoutRows()).toMatchObject([{ status: 'FAILED', productId: null }]);
      createStatus = 200;
      await opened('planet-lava');
      expect((await checkoutRows()).map(entry => entry.status).sort()).toEqual(['FAILED', 'OPEN']);
    });

    it('waits on a press still reaching Shopier, and abandons it after a minute', async () => {
      await fixture.db.insert(shopierCheckouts).values({ accountId: fixture.accountIds[1]!, itemId: 'planet-lava', amount: 9900,
        status: 'PENDING', createdAt: fixture.clock.now(), expiresAt: new Date(fixture.clock.now().getTime() + 48 * HOUR) });
      expect((await checkoutFor('planet-lava')).json()).toMatchObject({ error: 'SKIN_CHECKOUT_STARTING' });
      fixture.clock.advance(2);
      await opened('planet-lava');
      expect((await checkoutRows()).map(entry => entry.status).sort()).toEqual(['FAILED', 'OPEN']);
    });

    it('keeps at most five open products per commander, closing the oldest', async () => {
      for (const itemId of ['planet-lava', 'planet-ice', 'ring-aurora', 'ring-helios', 'ring-saturn']) {
        await opened(itemId);
        fixture.clock.advance(1);
      }
      await opened('engine-aurora');
      const rows = await checkoutRows();
      expect(rows.filter(entry => entry.status === 'OPEN')).toHaveLength(5);
      expect(rows.find(entry => entry.itemId === 'planet-lava')?.status).toBe('CANCELLED');
    });

    it('opens at most twelve products an hour for one commander', async () => {
      // The set and a look replace each other, so every press would otherwise open a product.
      for (let press = 0; press < 12; press++) await opened(press % 2 === 0 ? 'bundle' : 'planet-lava');
      const refused = await checkoutFor('bundle');
      expect(refused.statusCode).toBe(429);
      expect(refused.json()).toMatchObject({ error: 'SHOPIER_CHECKOUT_LIMIT' });
      expect(creates()).toHaveLength(12);
      fixture.clock.advance(61);
      expect((await checkoutFor('bundle')).statusCode).toBe(200);
    });

    it('opens a new product when the price has changed since the last press', async () => {
      const old = await opened('planet-lava');
      await close();
      await start({ SHOPIER_PRICES: JSON.stringify({ ...prices, 'planet-lava': 7900 }) });
      const fresh = await opened('planet-lava');
      expect(fresh).not.toBe(old);
      expect((await checkoutOf(old))?.status).toBe('CANCELLED');
      expect(await checkoutOf(fresh)).toMatchObject({ status: 'OPEN', amount: 7900 });
    });
  });

  describe('webhook delivery', () => {
    it('refuses unsigned or wrongly signed events and answers 503 without tokens', async () => {
      const body = order(await opened('planet-lava'));
      expect((await webhook('order.created', body, { signature: null })).statusCode).toBe(401);
      expect((await webhook('order.created', body, { signature: 'deadbeef' })).statusCode).toBe(401);
      expect((await webhook('order.created', body, { token: 'another-token' })).statusCode).toBe(401);
      expect(await owned()).toEqual([]);
      await close();
      await start({ SHOPIER_WEBHOOK_TOKENS: '' });
      expect((await webhook('order.created', body)).statusCode).toBe(503);
    });

    it('accepts any subscription\'s own token', async () => {
      const body = order(await opened('planet-lava'));
      expect((await webhook('order.created', body, { token: refundToken })).statusCode).toBe(200);
      expect(await owned()).toEqual(['planet-lava']);
    });

    it('grants a paid order of the commander\'s product without any note, and closes it once', async () => {
      const productId = await opened('planet-lava');
      const body = order(productId);
      const response = await webhook('order.created', body);
      expect(response.statusCode, response.body).toBe(200);
      expect(await owned()).toEqual(['planet-lava']);
      expect(await shopierRights()).toMatchObject([{ accountId: fixture.accountIds[1], cosmeticId: 'planet-lava',
        source: 'SHOPIER', orderRef: `${body.id}:planet-lava` }]);
      const checkout = await checkoutOf(productId);
      expect(checkout).toMatchObject({ status: 'PAID', orderId: body.id, paidAt: expect.any(Date) as Date });
      expect(await row(body.id)).toMatchObject({ status: 'MATCHED', reason: null, itemId: 'planet-lava',
        accountId: fixture.accountIds[1], checkoutId: checkout!.id, closedAt: expect.any(Date) as Date });
      expect(closes()).toEqual([{ method: 'PUT', url: `https://api.shopier.com/v1/orders/${body.id}`,
        body: { fulfillments: { productType: 'digital', note: expect.any(String) as string } } }]);
      expect((await checkoutFor('planet-lava')).statusCode).toBe(409);
    });

    it('delivers even when the product had expired or been replaced: the buyer paid', async () => {
      const lava = await opened('planet-lava');
      fixture.clock.advance(49 * 60);
      await sweep();
      expect((await checkoutOf(lava))?.status).toBe('EXPIRED');
      const ring = await opened('ring-aurora');
      await fixture.db.update(shopierCheckouts).set({ status: 'CANCELLED' }).where(eq(shopierCheckouts.productId, ring));
      await webhook('order.created', order(lava));
      await webhook('order.created', order(ring, 4900));
      expect(await owned()).toEqual(['planet-lava', 'ring-aurora']);
    });

    it('processes a redelivery or a second event for the same order only once', async () => {
      const body = order(await opened('planet-lava'));
      const id = randomUUID();
      expect((await webhook('order.created', body, { id })).statusCode).toBe(200);
      expect((await webhook('order.created', body, { id })).statusCode).toBe(200);
      expect((await webhook('order.created', body)).statusCode).toBe(200);
      expect(await shopierRights()).toHaveLength(1);
      expect(closes()).toHaveLength(1);
    });

    it('grants the whole set, or only its missing looks', async () => {
      const set = await opened('bundle');
      await manual(1, 'planet-ice');
      expect((await webhook('order.created', order(set, 27900))).statusCode).toBe(200);
      expect(await owned()).toEqual(['planet-desert', 'planet-ice', 'planet-lava', 'planet-toxic']);
      expect((await shopierRights()).map(right => right.cosmeticId).sort())
        .toEqual(['planet-desert', 'planet-lava', 'planet-toxic']);
    });

    it('keeps the delivery when closing the order on Shopier fails', async () => {
      closeStatus = 500;
      const body = order(await opened('planet-lava'));
      expect((await webhook('order.created', body)).statusCode).toBe(200);
      expect(await owned()).toEqual(['planet-lava']);
      expect(await row(body.id)).toMatchObject({ status: 'MATCHED', closedAt: null });
    });

    it('queues an authentic order it cannot read instead of losing it', async () => {
      const productId = await opened('planet-lava');
      const body = { ...order(productId, 9900, { note: 'not' }), lineItems: [{ productId, quantity: '1' }] };
      expect((await webhook('order.created', body)).statusCode).toBe(200);
      expect(await owned()).toEqual([]);
      expect(await row(body.id)).toMatchObject({ status: 'UNMATCHED', reason: 'UNREADABLE', note: 'not', total: '99.00', currency: 'TRY' });
      expect(closes()).toEqual([]);
    });

    it('ignores unknown events and malformed orders without granting', async () => {
      expect((await webhook('product.created', { id: '1', title: 'x' })).statusCode).toBe(200);
      expect((await webhook('order.created', { id: 'not-a-number', lineItems: 'nope' })).statusCode).toBe(200);
      expect(await shopierRights()).toEqual([]);
      expect(closes()).toEqual([]);
    });
  });

  describe('orders no product binds', () => {
    async function expectQueued(body: ReturnType<typeof order>, reason: string) {
      const response = await webhook('order.created', body);
      expect(response.statusCode, response.body).toBe(200);
      expect(await row(body.id)).toMatchObject({ status: 'UNMATCHED', reason });
    }

    it('queues a support card or any product the game did not open', async () => {
      await expectQueued(order(DONATION, 49900, { note: playerUsername }), 'UNKNOWN_PRODUCT');
      expect(await row(String(orderSeq - 1))).toMatchObject({ itemId: null, accountId: null, note: playerUsername });
    });

    it('queues carts, quantities, other currencies, discounts and unpaid orders', async () => {
      const productId = await opened('planet-lava');
      const line = { productId, title: 'Lav', type: 'digital', quantity: 1, price: '99.00', total: '99.00' };
      await expectQueued(order(productId, 9900, { lineItems: [line, { ...line, productId: DONATION }] }), 'MULTI_ITEM');
      await expectQueued(order(productId, 9900, { lineItems: [{ ...line, quantity: 2, total: '198.00' }],
        totals: { subtotal: '198.00', shipping: '0.00', discount: '0.00', total: '198.00' } }), 'MULTI_ITEM');
      await expectQueued(order(productId, 9900, { currency: 'USD' }), 'AMOUNT_MISMATCH');
      await expectQueued(order(productId, 9900, { totals: { subtotal: '99.00', shipping: '0.00', discount: '20.00', total: '79.00' } }), 'AMOUNT_MISMATCH');
      await expectQueued(order(productId, 9900, { paymentStatus: 'unpaid' }), 'NOT_PAID');
      expect(await owned()).toEqual([]);
      expect(closes()).toEqual([]);
      // Paid in the wrong currency still spent the product's one unit of stock.
      expect((await checkoutOf(productId))?.status).toBe('PAID');
    });

    it('marks a product sold by a paid order it cannot deliver, so the next press opens a fresh one', async () => {
      const sold = await opened('planet-lava');
      await expectQueued(order(sold, 9900, { currency: 'USD' }), 'AMOUNT_MISMATCH');
      expect((await checkoutOf(sold))?.status).toBe('PAID');
      expect(await opened('planet-lava')).not.toBe(sold);
      expect(creates()).toHaveLength(2);
    });

    it('queues a product whose commander is gone, and a look paid for twice', async () => {
      const gone = await opened('planet-lava');
      await fixture.db.update(shopierCheckouts).set({ accountId: null }).where(eq(shopierCheckouts.productId, gone));
      await expectQueued(order(gone), 'ACCOUNT_MISSING');
      const ring = await opened('ring-aurora');
      await manual(1, 'ring-aurora');
      await expectQueued(order(ring, 4900), 'ALREADY_OWNED');
      expect(await row(String(orderSeq - 1))).toMatchObject({ itemId: 'ring-aurora', accountId: fixture.accountIds[1] });
      expect(await shopierRights()).toEqual([]);
    });
  });

  describe('refunds', () => {
    const refund = (orderId: string, over: Record<string, unknown> = {}) => ({ id: randomUUID(), type: 'full',
      status: 'succeeded', orderId, dateCreated: '2026-10-29T15:00:00+0300', currency: 'TRY', total: '99.00', note: '', ...over });

    it('removes only this order\'s rights and the worn planet look after a full refund', async () => {
      await manual(1, 'planet-turkey');
      const body = order(await opened('planet-lava'));
      await webhook('order.created', body);
      expect((await app.inject({ method: 'POST', url: `/api/skins/planets/${fixture.planetIds[1]}`, headers: player,
        payload: { skinId: 'planet-lava' } })).statusCode).toBe(200);
      await webhook('refund.updated', refund(body.id, { type: 'partial', total: '10.00' }));
      await webhook('refund.updated', refund(body.id, { status: 'failed' }));
      expect(await owned()).toEqual(['planet-lava', 'planet-turkey']);
      const full = refund(body.id);
      expect((await webhook('refund.updated', full)).statusCode).toBe(200);
      expect((await webhook('refund.updated', full)).statusCode).toBe(200);
      expect(await owned()).toEqual(['planet-turkey']);
      const [world] = await fixture.db.select({ skin: planets.equippedSkinId }).from(planets).where(eq(planets.id, fixture.planetIds[1]!));
      expect(world?.skin).toBeNull();
      expect(await row(body.id)).toMatchObject({ status: 'REFUNDED' });
    });

    it('tells every galaxy the commander is in to redraw after a ring is refunded', async () => {
      const body = order(await opened('ring-aurora'), 4900);
      await webhook('order.created', body);
      expect((await app.inject({ method: 'POST', url: '/api/cosmetics/equip', headers: player,
        payload: { category: 'RING', cosmeticId: 'ring-aurora' } })).statusCode).toBe(200);
      published.length = 0;
      await webhook('refund.updated', refund(body.id, { total: '49.00' }));
      expect(await owned()).toEqual([]);
      expect(published).toContainEqual({ shard: fixture.seasonId, kind: 'world' });
    });

    it('remembers a refund that arrives before its order', async () => {
      const body = order(await opened('planet-lava'));
      await webhook('refund.updated', refund(body.id));
      await webhook('order.created', body);
      expect(await owned()).toEqual([]);
      expect(await row(body.id)).toMatchObject({ status: 'REFUNDED' });
      expect(closes()).toEqual([]);
    });
  });

  describe('clean-up of products nobody needs any more', () => {
    it('expires a product unpaid for 48 hours and deletes it, but keeps a fresh one', async () => {
      const old = await opened('planet-lava');
      fixture.clock.advance(47 * 60);
      const fresh = await opened('ring-aurora');
      fixture.clock.advance(2 * 60);
      await sweep();
      expect(await checkoutOf(old)).toMatchObject({ status: 'EXPIRED', removedAt: expect.any(Date) as Date });
      expect(await checkoutOf(fresh)).toMatchObject({ status: 'OPEN', removedAt: null });
      expect(deletes()).toEqual([old]);
      expect((await checkoutFor('planet-lava')).statusCode).toBe(200);
      expect(creates()).toHaveLength(3);
    });

    it('closes an open product whose look arrived another way, whose commander left, or whose price moved', async () => {
      const lava = await opened('planet-lava');
      const ring = await opened('ring-aurora');
      const ice = await opened('planet-ice');
      await manual(1, 'planet-lava');
      await fixture.db.update(shopierCheckouts).set({ accountId: null }).where(eq(shopierCheckouts.productId, ring));
      envOver = { SHOPIER_PRICES: JSON.stringify({ ...prices, 'planet-ice': 12900 }) };
      await sweep();
      for (const productId of [lava, ring, ice]) {
        expect(await checkoutOf(productId)).toMatchObject({ status: 'CANCELLED', removedAt: expect.any(Date) as Date });
      }
      expect(deletes().sort()).toEqual([lava, ring, ice].sort());
    });

    it('deletes paid, replaced and failed products once; a missing one counts as gone and an error retries', async () => {
      const paid = await opened('planet-lava');
      await webhook('order.created', order(paid));
      const replaced = await opened('ring-aurora');
      await opened('ring-helios');
      await fixture.db.update(shopierCheckouts).set({ status: 'CANCELLED' }).where(eq(shopierCheckouts.productId, replaced));
      deleteStatus = 500;
      await sweep();
      expect((await checkoutOf(paid))?.removedAt).toBeNull();
      deleteStatus = 404;
      await sweep();
      expect(await checkoutOf(paid)).toMatchObject({ status: 'PAID', removedAt: expect.any(Date) as Date });
      expect((await checkoutOf(replaced))?.removedAt).toEqual(expect.any(Date));
      const before = deletes().length;
      await sweep();
      expect(deletes()).toHaveLength(before);
      expect(await owned()).toEqual(['planet-lava']);
    });

    it('deletes at most twenty products a round', async () => {
      await fixture.db.insert(shopierCheckouts).values(Array.from({ length: 25 }, (_, index) => ({
        accountId: fixture.accountIds[1]!, itemId: 'planet-lava', amount: 9900, status: 'EXPIRED' as const,
        productId: String(70_000_000 + index), url: `https://www.shopier.com/${70_000_000 + index}`,
        createdAt: fixture.clock.now(), expiresAt: fixture.clock.now() })));
      await sweep();
      expect(deletes()).toHaveLength(20);
      await sweep();
      expect(deletes()).toHaveLength(25);
    });

    it('does nothing without a Shopier token', async () => {
      await opened('planet-lava');
      fixture.clock.advance(49 * 60);
      envOver = { SHOPIER_ACCESS_TOKEN: '' };
      expect(await sweep()).toEqual({ expired: 0, cancelled: 0, removed: 0 });
      expect(deletes()).toEqual([]);
    });
  });

  describe('operator queue', () => {
    const post = (path: string, payload: object = {}, auth = admin) =>
      app.inject({ method: 'POST', url: `/api/admin/shopier/${path}`, headers: auth, payload });
    const unopened = (over: Record<string, unknown> = {}) => order(DONATION, 9900, over);

    it('is closed to players', async () => {
      expect((await app.inject({ method: 'GET', url: '/api/admin/shopier/orders', headers: player })).statusCode).toBe(403);
      for (const path of ['orders/1/grant', 'orders/1/dismiss', 'orders/1/revoke', 'sync']) {
        expect((await post(path, { username: playerUsername }, player)).statusCode).toBe(403);
      }
    });

    it('lists queued orders with their reason and note, newest first', async () => {
      const first = unopened({ note: 'destek' });
      const productId = await opened('planet-lava');
      const second = order(productId, 9900, { currency: 'USD' });
      await webhook('order.created', first);
      await webhook('order.created', second);
      const response = await app.inject({ method: 'GET', url: '/api/admin/shopier/orders', headers: admin });
      expect(response.statusCode).toBe(200);
      const listed = z.object({ orders: z.array(z.record(z.unknown())) }).parse(response.json()).orders;
      expect(listed).toMatchObject([
        { orderId: second.id, status: 'UNMATCHED', reason: 'AMOUNT_MISMATCH', itemId: 'planet-lava', username: playerUsername, total: '99.00' },
        { orderId: first.id, status: 'UNMATCHED', reason: 'UNKNOWN_PRODUCT', itemId: null, note: 'destek' },
      ]);
      expect(listed[0]).not.toHaveProperty('code');
    });

    it('keeps every waiting order in view however many deliveries came after it', async () => {
      const waiting = unopened({ note: 'eski' });
      await webhook('order.created', waiting);
      await fixture.db.update(shopierOrders).set({ receivedAt: new Date(Date.now() - 86_400_000) })
        .where(eq(shopierOrders.orderId, waiting.id));
      await fixture.db.insert(shopierOrders).values(Array.from({ length: 120 }, (_, index) => ({
        orderId: String(800_000_000 + index), status: 'MATCHED' as const, total: '99.00', currency: 'TRY' })));
      const response = await app.inject({ method: 'GET', url: '/api/admin/shopier/orders', headers: admin });
      const orders = z.object({ orders: z.array(z.object({ orderId: z.string(), status: z.string() })) }).parse(response.json()).orders;
      expect(orders.find(entry => entry.orderId === waiting.id)).toMatchObject({ status: 'UNMATCHED' });
      expect(orders.filter(entry => entry.status !== 'UNMATCHED')).toHaveLength(50);
    });

    it('grants a queued order of a known look to the named commander once and closes it', async () => {
      const productId = await opened('planet-lava');
      await fixture.db.update(shopierCheckouts).set({ accountId: null }).where(eq(shopierCheckouts.productId, productId));
      const body = order(productId);
      await webhook('order.created', body);
      expect((await post(`orders/${body.id}/grant`, { username: 'nobody_here' })).statusCode).toBe(404);
      const granted = await post(`orders/${body.id}/grant`, { username: playerUsername.toUpperCase() });
      expect(granted.statusCode, granted.body).toBe(200);
      expect(await owned()).toEqual(['planet-lava']);
      expect(await row(body.id)).toMatchObject({ status: 'RESOLVED', accountId: fixture.accountIds[1], closedAt: expect.any(Date) as Date });
      expect((await post(`orders/${body.id}/grant`, { username: playerUsername })).statusCode).toBe(409);
      expect(closes()).toHaveLength(1);
    });

    it('will not grant an order of an unknown product, or a look already owned', async () => {
      const donation = unopened();
      await webhook('order.created', donation);
      expect((await post(`orders/${donation.id}/grant`, { username: playerUsername })).json())
        .toMatchObject({ error: 'SHOPIER_ORDER_NOT_GRANTABLE' });
      const productId = await opened('planet-lava');
      const body = order(productId, 9900, { currency: 'USD' });
      await webhook('order.created', body);
      await manual(1, 'planet-lava');
      expect((await post(`orders/${body.id}/grant`, { username: playerUsername })).statusCode).toBe(409);
      expect(await row(body.id)).toMatchObject({ status: 'UNMATCHED' });
    });

    it('dismisses a queued order and closes it, but never a delivered one', async () => {
      const donation = unopened();
      await webhook('order.created', donation);
      expect((await post(`orders/${donation.id}/dismiss`)).statusCode).toBe(200);
      expect(await row(donation.id)).toMatchObject({ status: 'DISMISSED', closedAt: expect.any(Date) as Date });
      const body = order(await opened('planet-lava'));
      await webhook('order.created', body);
      expect((await post(`orders/${body.id}/dismiss`)).statusCode).toBe(409);
      expect((await post('orders/123/dismiss')).statusCode).toBe(404);
    });

    it('revokes a delivered order (chargeback) without touching other rights', async () => {
      await manual(1, 'planet-turkey');
      const body = order(await opened('planet-lava'));
      await webhook('order.created', body);
      const queued = unopened();
      await webhook('order.created', queued);
      expect((await post(`orders/${queued.id}/revoke`)).statusCode).toBe(409);
      expect((await post(`orders/${body.id}/revoke`)).statusCode).toBe(200);
      expect(await owned()).toEqual(['planet-turkey']);
      expect(await row(body.id)).toMatchObject({ status: 'REVOKED' });
      expect((await post(`orders/${body.id}/revoke`)).statusCode).toBe(409);
    });

    it('syncs open Shopier orders through the same rules and retries unclosed deliveries', async () => {
      const missed = order(await opened('planet-lava'));
      const old = unopened({ status: 'fulfilled' });
      closeStatus = 500;
      const unclosed = order(await opened('ring-aurora'), 4900);
      await webhook('order.created', unclosed);
      expect(await row(unclosed.id)).toMatchObject({ status: 'MATCHED', closedAt: null });
      closeStatus = 200;
      const unreadable = { ...unopened({ note: 'okunmaz' }), lineItems: 'broken' };
      remoteOrders = [missed, old, unclosed, unreadable];
      const synced = await post('sync');
      expect(synced.statusCode, synced.body).toBe(200);
      expect(synced.json()).toEqual({ recorded: 2, closed: 2 });
      expect(await row(unreadable.id)).toMatchObject({ status: 'UNMATCHED', reason: 'UNREADABLE', note: 'okunmaz' });
      expect(await owned()).toEqual(['planet-lava', 'ring-aurora']);
      expect(await row(old.id)).toBeUndefined();
      expect(await row(unclosed.id)).toMatchObject({ closedAt: expect.any(Date) as Date });
      expect(calls.find(call => call.method === 'GET')?.url).toBe('https://api.shopier.com/v1/orders?limit=50');
      remoteOrders = [{ ...missed, status: 'fulfilled' }, old, { ...unclosed, status: 'fulfilled' }];
      expect((await post('sync')).json()).toEqual({ recorded: 0, closed: 0 });
      const rights = await fixture.db.select().from(cosmeticEntitlements)
        .where(and(eq(cosmeticEntitlements.accountId, fixture.accountIds[1]!), eq(cosmeticEntitlements.source, 'SHOPIER')));
      expect(rights).toHaveLength(2);
    });
  });
});
