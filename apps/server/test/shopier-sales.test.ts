import { createHmac, randomBytes, randomUUID } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { pino } from 'pino';
import { z } from 'zod';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildApp } from '../src/app.js';
import { TokenService } from '../src/auth/tokens.js';
import { accounts, cosmeticEntitlements, planets, shopierOrders, shopierPurchaseCodes } from '../src/db/schema.js';
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

const LAVA = '51278662';
const BUNDLE = '51278911';
const RING = '52000001';
const DONATION = '51278360';
const hookToken = randomBytes(24).toString('hex');
const products = JSON.stringify({
  'planet-lava': { productId: LAVA, tryAmount: 9900 },
  bundle: { productId: BUNDLE, tryAmount: 27900 },
  'ring-aurora': { productId: RING, tryAmount: 4900 },
});
const codeShape = /^AST-[2-9A-HJKMNP-TV-Z]{6}$/;

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
  let closeStatus: number;
  let remoteOrders: unknown[];
  let orderSeq: number;

  async function start(over: Record<string, string> = {}) {
    const built = buildApp({ env: testEnv({ ADMIN_USERNAMES: adminUsername, SHOPIER_CHECKOUT_ENABLED: 'true',
      SHOPIER_ACCESS_TOKEN: 'shopier-pat', SHOPIER_WEBHOOK_TOKEN: hookToken, SHOPIER_PRODUCTS: products, ...over }),
    db: fixture.db, clock: fixture.clock, logger: pino({ level: 'silent' }) });
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
    closeStatus = 200;
    remoteOrders = [];
    orderSeq = 900_000_000 + Math.floor(Math.random() * 1000) * 1000;
    vi.stubGlobal('fetch', vi.fn((url: string, init?: RequestInit) => {
      const method = init?.method ?? 'GET';
      calls.push({ method, url, body: typeof init?.body === 'string' ? JSON.parse(init.body) : undefined });
      const headers = new Headers(init?.headers);
      if (headers.get('authorization') !== 'Bearer shopier-pat') throw new Error('Missing Shopier token');
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

  async function codeFor(itemId: string, auth = player) {
    return app.inject({ method: 'POST', url: '/api/skins/shopier-code', headers: auth, payload: { itemId } });
  }
  async function issued(itemId: string): Promise<string> {
    const response = await codeFor(itemId);
    expect(response.statusCode, response.body).toBe(200);
    return z.object({ code: z.string() }).parse(response.json()).code;
  }
  function order(over: Record<string, unknown> = {}) {
    return {
      id: String(orderSeq++), status: 'unfulfilled', paymentStatus: 'paid', installments: false,
      dateCreated: '2026-10-16T10:00:00+0300', currency: 'TRY', paymentMethod: 'creditCard',
      totals: { subtotal: '99.00', shipping: '0.00', discount: '0.00', total: '99.00' }, discounts: [],
      shippingInfo: { firstName: 'Ada', lastName: 'Yılmaz', email: 'ada@example.com', phone: '5550000000', country: 'Türkiye' },
      billingInfo: {}, note: '',
      lineItems: [{ productId: LAVA, title: 'Lav Gezegeni', type: 'digital', selection: [], options: [],
        quantity: 1, price: '99.00', total: '99.00' }],
      fulfillments: [], returns: [], refunds: [], ...over,
    };
  }
  const bundleOrder = (note: string) => order({ note,
    totals: { subtotal: '279.00', shipping: '0.00', discount: '0.00', total: '279.00' },
    lineItems: [{ productId: BUNDLE, title: 'Element Paketi', type: 'digital', quantity: 1, price: '279.00', total: '279.00' }] });
  async function webhook(event: string, body: object, options: { id?: string; encoding?: 'hex' | 'base64'; signature?: string | null } = {}) {
    const payload = JSON.stringify(body);
    const signature = options.signature !== undefined ? options.signature
      : createHmac('sha256', hookToken).update(payload).digest(options.encoding ?? 'hex');
    const headers: Record<string, string> = { 'content-type': 'application/json', 'shopier-event': event,
      'shopier-webhook-id': options.id ?? randomUUID(), 'shopier-timestamp': String(Math.floor(Date.now() / 1000)),
      'shopier-account-id': '1', 'shopier-api-version': '1.0' };
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

  describe('shop and purchase codes', () => {
    it('publishes only configured prices, and nothing while closed', async () => {
      const open = await app.inject({ method: 'GET', url: '/api/skins/shopier-shop' });
      expect(open.json()).toEqual({ enabled: true, prices: { 'planet-lava': 9900, bundle: 27900, 'ring-aurora': 4900 } });
      await close();
      await start({ SHOPIER_CHECKOUT_ENABLED: 'false' });
      expect((await app.inject({ method: 'GET', url: '/api/skins/shopier-shop' })).json()).toEqual({ enabled: false, prices: {} });
      expect((await codeFor('planet-lava')).statusCode).toBe(503);
    });

    it('requires a commander, a known item and a Shopier product', async () => {
      expect((await app.inject({ method: 'POST', url: '/api/skins/shopier-code', payload: { itemId: 'planet-lava' } })).statusCode).toBe(401);
      expect((await codeFor('planet-mars')).statusCode).toBe(400);
      const missing = await codeFor('planet-ice');
      expect(missing.statusCode).toBe(404);
      expect(missing.json()).toMatchObject({ error: 'SHOPIER_PRODUCT_MISSING' });
    });

    it('returns the same open code for the same item and a different one for another item', async () => {
      const response = await codeFor('planet-lava');
      expect(response.statusCode, response.body).toBe(200);
      const body = response.json<{ code: string }>();
      expect(body).toEqual({ code: expect.stringMatching(codeShape) as string, url: `https://www.shopier.com/${LAVA}`, amount: 9900, currency: 'TRY' });
      expect(await issued('planet-lava')).toBe(body.code);
      const ring = await issued('ring-aurora');
      expect(ring).not.toBe(body.code);
      expect(ring).toMatch(codeShape);
    });

    it('hands concurrent presses one code', async () => {
      const codes = await Promise.all(Array.from({ length: 6 }, () => issued('planet-lava')));
      expect(new Set(codes).size).toBe(1);
      const rows = await fixture.db.select().from(shopierPurchaseCodes)
        .where(eq(shopierPurchaseCodes.accountId, fixture.accountIds[1]!));
      expect(rows).toHaveLength(1);
    });

    it('refuses an item, or a bundle, the commander already owns in part', async () => {
      await manual(1, 'planet-lava');
      expect((await codeFor('planet-lava')).json()).toMatchObject({ error: 'SKIN_ALREADY_OWNED' });
      expect((await codeFor('bundle')).statusCode).toBe(409);
      expect((await codeFor('ring-aurora')).statusCode).toBe(200);
    });
  });

  describe('webhook delivery', () => {
    it('refuses unsigned or wrongly signed events and answers 503 without a token', async () => {
      const code = await issued('planet-lava');
      const body = order({ note: code });
      expect((await webhook('order.created', body, { signature: null })).statusCode).toBe(401);
      expect((await webhook('order.created', body, { signature: 'deadbeef' })).statusCode).toBe(401);
      expect((await webhook('order.created', body, {
        signature: createHmac('sha256', 'another-token').update(JSON.stringify(body)).digest('hex') })).statusCode).toBe(401);
      expect(await owned()).toEqual([]);
      await close();
      await start({ SHOPIER_WEBHOOK_TOKEN: '' });
      expect((await webhook('order.created', body)).statusCode).toBe(503);
    });

    it('grants on a signed paid order, consumes the code and closes the order once', async () => {
      const code = await issued('planet-lava');
      const body = order({ note: `Komutan: ${code.toLowerCase().replace('-', ' ')} teşekkürler` });
      const response = await webhook('order.created', body);
      expect(response.statusCode, response.body).toBe(200);
      expect(await owned()).toEqual(['planet-lava']);
      expect(await shopierRights()).toMatchObject([{ accountId: fixture.accountIds[1], cosmeticId: 'planet-lava',
        source: 'SHOPIER', orderRef: `${body.id}:planet-lava` }]);
      expect(await row(body.id)).toMatchObject({ status: 'MATCHED', reason: null, itemId: 'planet-lava',
        accountId: fixture.accountIds[1], code, closedAt: expect.any(Date) as Date });
      const [used] = await fixture.db.select().from(shopierPurchaseCodes).where(eq(shopierPurchaseCodes.code, code));
      expect(used).toMatchObject({ status: 'USED', orderId: body.id });
      expect(closes()).toEqual([{ method: 'PUT', url: `https://api.shopier.com/v1/orders/${body.id}`,
        body: { fulfillments: { productType: 'digital', note: expect.any(String) as string } } }]);
      expect(await issued('ring-aurora')).not.toBe(code);
      expect((await codeFor('planet-lava')).statusCode).toBe(409);
    });

    it('accepts a base64 signature too', async () => {
      const code = await issued('planet-lava');
      expect((await webhook('order.created', order({ note: code }), { encoding: 'base64' })).statusCode).toBe(200);
      expect(await owned()).toEqual(['planet-lava']);
    });

    it('processes a redelivery or a second event for the same order only once', async () => {
      const code = await issued('planet-lava');
      const body = order({ note: code });
      const id = randomUUID();
      expect((await webhook('order.created', body, { id })).statusCode).toBe(200);
      expect((await webhook('order.created', body, { id })).statusCode).toBe(200);
      expect((await webhook('order.created', body)).statusCode).toBe(200);
      expect(await shopierRights()).toHaveLength(1);
      expect(closes()).toHaveLength(1);
    });

    it('grants the whole bundle, or only its missing looks', async () => {
      const code = await issued('bundle');
      await manual(1, 'planet-ice');
      expect((await webhook('order.created', bundleOrder(code))).statusCode).toBe(200);
      expect(await owned()).toEqual(['planet-desert', 'planet-ice', 'planet-lava', 'planet-toxic']);
      expect((await shopierRights()).map(right => right.cosmeticId).sort())
        .toEqual(['planet-desert', 'planet-lava', 'planet-toxic']);
    });

    it('keeps the delivery when closing the order on Shopier fails', async () => {
      closeStatus = 500;
      const code = await issued('planet-lava');
      const body = order({ note: code });
      expect((await webhook('order.created', body)).statusCode).toBe(200);
      expect(await owned()).toEqual(['planet-lava']);
      expect(await row(body.id)).toMatchObject({ status: 'MATCHED', closedAt: null });
    });

    it('queues an authentic order it cannot read instead of losing it', async () => {
      const code = await issued('planet-lava');
      const body = { ...order({ note: code }), lineItems: [{ productId: LAVA, quantity: '1' }] };
      expect((await webhook('order.created', body)).statusCode).toBe(200);
      expect(await owned()).toEqual([]);
      expect(await row(body.id)).toMatchObject({ status: 'UNMATCHED', reason: 'UNREADABLE', note: code, total: '99.00', currency: 'TRY' });
      expect(closes()).toEqual([]);
    });

    it('ignores unknown events and malformed orders without granting', async () => {
      expect((await webhook('product.created', { id: '1', title: 'x' })).statusCode).toBe(200);
      expect((await webhook('order.created', { id: 'not-a-number', lineItems: 'nope' })).statusCode).toBe(200);
      expect(await shopierRights()).toEqual([]);
      expect(closes()).toEqual([]);
    });
  });

  describe('orders a code cannot bind', () => {
    async function expectQueued(body: ReturnType<typeof order>, reason: string) {
      const response = await webhook('order.created', body);
      expect(response.statusCode, response.body).toBe(200);
      expect(await row(body.id)).toMatchObject({ status: 'UNMATCHED', reason });
    }

    it('queues an order without a code, with an unknown code or with a spent code', async () => {
      await expectQueued(order({ note: playerUsername }), 'NO_CODE');
      await expectQueued(order({ note: 'AST-ZZZZZZ' }), 'CODE_UNKNOWN');
      const code = await issued('planet-lava');
      await webhook('order.created', order({ note: code }));
      await expectQueued(order({ note: code }), 'CODE_USED');
      expect(await shopierRights()).toHaveLength(1);
    });

    it('reads a code split by invisible characters a phone keyboard inserted', async () => {
      const code = await issued('planet-lava');
      const body = order({ note: `${code.slice(0, 4)}\u200b${code.slice(4, 7)}\u2060${code.slice(7)}\ufeff` });
      expect((await webhook('order.created', body)).statusCode).toBe(200);
      expect(await row(body.id)).toMatchObject({ status: 'MATCHED', code });
    });

    it('shows the operator the code that belongs to the paid item when the note holds several', async () => {
      const spent = await issued('planet-lava');
      await webhook('order.created', order({ note: spent }));
      const ring = await issued('ring-aurora');
      const body = order({ note: `${ring} ${spent}` });
      await webhook('order.created', body);
      expect(await row(body.id)).toMatchObject({ status: 'UNMATCHED', reason: 'CODE_USED', code: spent });
    });

    it('queues a code paid on a different product', async () => {
      const code = await issued('planet-lava');
      await expectQueued(bundleOrder(code), 'CODE_ITEM_MISMATCH');
      expect(await owned()).toEqual([]);
      const [open] = await fixture.db.select().from(shopierPurchaseCodes).where(eq(shopierPurchaseCodes.code, code));
      expect(open?.status).toBe('OPEN');
    });

    it('queues carts, quantities, other products, other currencies, discounts and unpaid orders', async () => {
      const code = await issued('planet-lava');
      const line = { productId: LAVA, title: 'Lav', type: 'digital', quantity: 1, price: '99.00', total: '99.00' };
      await expectQueued(order({ note: code, lineItems: [line, { ...line, productId: RING }] }), 'MULTI_ITEM');
      await expectQueued(order({ note: code, lineItems: [{ ...line, quantity: 2, total: '198.00' }],
        totals: { subtotal: '198.00', shipping: '0.00', discount: '0.00', total: '198.00' } }), 'MULTI_ITEM');
      await expectQueued(order({ note: code, lineItems: [{ ...line, productId: DONATION }] }), 'UNKNOWN_PRODUCT');
      await expectQueued(order({ note: code, currency: 'USD' }), 'AMOUNT_MISMATCH');
      await expectQueued(order({ note: code, totals: { subtotal: '99.00', shipping: '0.00', discount: '20.00', total: '79.00' } }), 'AMOUNT_MISMATCH');
      await expectQueued(order({ note: code, paymentStatus: 'unpaid' }), 'NOT_PAID');
      expect(await owned()).toEqual([]);
      expect(closes()).toEqual([]);
    });

    it('queues a code whose account is gone, and a look the commander already owns', async () => {
      const gone = await issued('planet-lava');
      await fixture.db.update(shopierPurchaseCodes).set({ accountId: null }).where(eq(shopierPurchaseCodes.code, gone));
      await expectQueued(order({ note: gone }), 'ACCOUNT_MISSING');
      const code = await issued('ring-aurora');
      await manual(1, 'ring-aurora');
      const body = order({ note: code, totals: { subtotal: '49.00', shipping: '0.00', discount: '0.00', total: '49.00' },
        lineItems: [{ productId: RING, title: 'Aurora', type: 'digital', quantity: 1, price: '49.00', total: '49.00' }] });
      await expectQueued(body, 'ALREADY_OWNED');
      expect(await shopierRights()).toEqual([]);
      const [spent] = await fixture.db.select().from(shopierPurchaseCodes).where(eq(shopierPurchaseCodes.code, code));
      expect(spent?.status).toBe('USED');
    });
  });

  describe('refunds', () => {
    const refund = (orderId: string, over: Record<string, unknown> = {}) => ({ id: randomUUID(), type: 'full',
      status: 'succeeded', orderId, dateCreated: '2026-10-16T11:00:00+0300', currency: 'TRY', total: '99.00', note: '', ...over });

    it('removes only this order\'s rights and the worn planet look after a full refund', async () => {
      await manual(1, 'planet-turkey');
      const code = await issued('planet-lava');
      const body = order({ note: code });
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
      const code = await issued('ring-aurora');
      const body = order({ note: code, totals: { subtotal: '49.00', shipping: '0.00', discount: '0.00', total: '49.00' },
        lineItems: [{ productId: RING, title: 'Aurora', type: 'digital', quantity: 1, price: '49.00', total: '49.00' }] });
      await webhook('order.created', body);
      expect((await app.inject({ method: 'POST', url: '/api/cosmetics/equip', headers: player,
        payload: { category: 'RING', cosmeticId: 'ring-aurora' } })).statusCode).toBe(200);
      published.length = 0;
      await webhook('refund.updated', refund(body.id, { total: '49.00' }));
      expect(await owned()).toEqual([]);
      expect(published).toContainEqual({ shard: fixture.seasonId, kind: 'world' });
    });

    it('remembers a refund that arrives before its order', async () => {
      const code = await issued('planet-lava');
      const body = order({ note: code });
      await webhook('refund.updated', refund(body.id));
      await webhook('order.created', body);
      expect(await owned()).toEqual([]);
      expect(await row(body.id)).toMatchObject({ status: 'REFUNDED' });
      expect(closes()).toEqual([]);
    });
  });

  describe('operator queue', () => {
    const post = (path: string, payload: object = {}, auth = admin) =>
      app.inject({ method: 'POST', url: `/api/admin/shopier/${path}`, headers: auth, payload });

    it('is closed to players', async () => {
      expect((await app.inject({ method: 'GET', url: '/api/admin/shopier/orders', headers: player })).statusCode).toBe(403);
      for (const path of ['orders/1/grant', 'orders/1/dismiss', 'orders/1/revoke', 'sync']) {
        expect((await post(path, { username: playerUsername }, player)).statusCode).toBe(403);
      }
    });

    it('lists queued orders with their reason and note, newest first', async () => {
      const first = order({ note: 'kod yok' });
      const second = order({ note: 'AST-ZZZZZZ' });
      await webhook('order.created', first);
      await webhook('order.created', second);
      const response = await app.inject({ method: 'GET', url: '/api/admin/shopier/orders', headers: admin });
      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({ orders: [
        { orderId: second.id, status: 'UNMATCHED', reason: 'CODE_UNKNOWN', itemId: 'planet-lava', note: 'AST-ZZZZZZ', total: '99.00' },
        { orderId: first.id, status: 'UNMATCHED', reason: 'NO_CODE', note: 'kod yok' },
      ] });
    });

    it('keeps every waiting order in view however many deliveries came after it', async () => {
      const waiting = order({ note: 'eski' });
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

    it('grants a queued order to the named commander once and closes it', async () => {
      const body = order({ note: playerUsername });
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
      const donation = order({ lineItems: [{ productId: DONATION, title: '499₺ Destek', type: 'digital', quantity: 1, price: '99.00', total: '99.00' }] });
      await webhook('order.created', donation);
      expect((await post(`orders/${donation.id}/grant`, { username: playerUsername })).json())
        .toMatchObject({ error: 'SHOPIER_ORDER_NOT_GRANTABLE' });
      const body = order({ note: 'isim' });
      await webhook('order.created', body);
      await manual(1, 'planet-lava');
      expect((await post(`orders/${body.id}/grant`, { username: playerUsername })).statusCode).toBe(409);
      expect(await row(body.id)).toMatchObject({ status: 'UNMATCHED' });
    });

    it('dismisses a queued order and closes it, but never a delivered one', async () => {
      const donation = order({ lineItems: [{ productId: DONATION, title: 'Destek', type: 'digital', quantity: 1, price: '99.00', total: '99.00' }] });
      await webhook('order.created', donation);
      expect((await post(`orders/${donation.id}/dismiss`)).statusCode).toBe(200);
      expect(await row(donation.id)).toMatchObject({ status: 'DISMISSED', closedAt: expect.any(Date) as Date });
      const code = await issued('planet-lava');
      const body = order({ note: code });
      await webhook('order.created', body);
      expect((await post(`orders/${body.id}/dismiss`)).statusCode).toBe(409);
      expect((await post('orders/123/dismiss')).statusCode).toBe(404);
    });

    it('revokes a delivered order (chargeback) without touching other rights', async () => {
      await manual(1, 'planet-turkey');
      const code = await issued('planet-lava');
      const body = order({ note: code });
      await webhook('order.created', body);
      const queued = order({ note: 'yok' });
      await webhook('order.created', queued);
      expect((await post(`orders/${queued.id}/revoke`)).statusCode).toBe(409);
      expect((await post(`orders/${body.id}/revoke`)).statusCode).toBe(200);
      expect(await owned()).toEqual(['planet-turkey']);
      expect(await row(body.id)).toMatchObject({ status: 'REVOKED' });
      expect((await post(`orders/${body.id}/revoke`)).statusCode).toBe(409);
    });

    it('syncs open Shopier orders through the same rules and retries unclosed deliveries', async () => {
      const code = await issued('planet-lava');
      const missed = order({ note: code });
      const old = order({ status: 'fulfilled', note: playerUsername });
      closeStatus = 500;
      const ringCode = await issued('ring-aurora');
      const unclosed = order({ note: ringCode, totals: { subtotal: '49.00', shipping: '0.00', discount: '0.00', total: '49.00' },
        lineItems: [{ productId: RING, title: 'Aurora', type: 'digital', quantity: 1, price: '49.00', total: '49.00' }] });
      await webhook('order.created', unclosed);
      expect(await row(unclosed.id)).toMatchObject({ status: 'MATCHED', closedAt: null });
      closeStatus = 200;
      const unreadable = { ...order({ note: 'okunmaz' }), lineItems: 'broken' };
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
