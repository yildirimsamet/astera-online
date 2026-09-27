import { createHmac, randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { pino } from 'pino';
import { z } from 'zod';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildApp } from '../src/app.js';
import { TokenService } from '../src/auth/tokens.js';
import { cosmeticEntitlements, paddleSkinOrders, planets } from '../src/db/schema.js';
import { LIVE_PRICE_IDS, verifyPaddleSignature } from '../src/services/paddleLive.js';
import { seedWorld, testDb, testEnv, type Fixture } from './helpers.js';

afterAll(async () => { const { close } = await testDb(); await close(); });

const secret = 'pdl_ntfset_live_test_secret';
const transactionId = 'txn_01m3fxlive000000000000000';
const paddleIp = '34.237.3.244';

describe('live Paddle skin sales', () => {
  let fixture: Fixture;
  let app: ReturnType<typeof buildApp>['app'];
  let close: () => Promise<void>;
  let authorization: string;
  let createCalls: unknown[];

  beforeEach(async () => {
    fixture = await seedWorld(1);
    createCalls = [];
    vi.stubGlobal('fetch', vi.fn((input: string, init?: RequestInit) => {
      if (input === 'https://api.paddle.com/ips') return Promise.resolve(new Response(JSON.stringify({ data: { ipv4_cidrs: [`${paddleIp}/32`] } })));
      if (input === 'https://api.paddle.com/pricing-preview' && typeof init?.body === 'string') {
        const body = z.object({ customer_ip_address: z.string().optional(), currency_code: z.string().optional(),
          items: z.array(z.object({ price_id: z.string() })) }).parse(JSON.parse(init.body));
        const country = body.customer_ip_address === '198.51.100.1' ? 'TR' : 'DE';
        return Promise.resolve(new Response(JSON.stringify({ data: { address: { country_code: country },
          currency_code: body.currency_code ?? (country === 'TR' ? 'TRY' : 'EUR'),
          details: { line_items: body.items.map(item => ({ price: { id: item.price_id },
            formatted_unit_totals: { total: body.currency_code === 'EUR' ? '€2.99' : '₺99.00' } })) } } })));
      }
      if (input === 'https://api.paddle.com/transactions' && typeof init?.body === 'string') {
        createCalls.push(JSON.parse(init.body) as unknown);
        return Promise.resolve(new Response(JSON.stringify({ data: { id: transactionId } }), { status: 201 }));
      }
      throw new Error(`Unexpected Paddle request: ${input}`);
    }));
    const built = buildApp({ env: testEnv({ PADDLE_CHECKOUT_ENABLED: 'true', PADDLE_API_KEY: 'pdl_live_test',
      PADDLE_CLIENT_TOKEN: 'live_test', PADDLE_WEBHOOK_SECRET: secret }), db: fixture.db,
      clock: fixture.clock, logger: pino({ level: 'silent' }) });
    app = built.app;
    close = built.close;
    await app.ready();
    authorization = `Bearer ${await new TokenService('test-secret-that-is-long-enough', 15, 30)
      .issueAccess(fixture.accountIds[0]!)}`;
  });
  afterEach(async () => { vi.unstubAllGlobals(); await close(); });

  function webhook(eventType: string, data: object, remoteAddress = paddleIp, eventId = randomUUID()) {
    const payload = JSON.stringify({ event_id: eventId, event_type: eventType, data });
    const ts = Math.floor(Date.now() / 1000);
    const h1 = createHmac('sha256', secret).update(`${ts}:${payload}`).digest('hex');
    return app.inject({ method: 'POST', url: '/api/paddle/webhook', remoteAddress, payload,
      headers: { 'content-type': 'application/json', 'paddle-signature': `ts=${ts};h1=${h1}` } });
  }

  async function readOwned(): Promise<string[]> {
    const response = await app.inject({ method: 'GET', url: '/api/skins', headers: { authorization } });
    return z.object({ ownedSkinIds: z.array(z.string()) }).parse(response.json()).ownedSkinIds;
  }

  it('maps the nine existing live prices and never exposes a sandbox catalog', async () => {
    expect(Object.keys(LIVE_PRICE_IDS)).toHaveLength(9);
    expect(LIVE_PRICE_IDS['planet-lava']).toBe('pri_01m3fwr44wjzkbenrjctb9k6dd');
    expect(LIVE_PRICE_IDS.bundle).toBe('pri_01m3fx3943k024e12yb67a49r1');
    const shop = await app.inject({ method: 'GET', url: '/api/skins/shop', headers: { authorization } });
    expect(shop.json()).toMatchObject({ enabled: true, clientToken: 'live_test', priceIds: LIVE_PRICE_IDS });
    expect(JSON.stringify(shop.json())).not.toContain('sandbox');
  });

  it('serves the public payment-link page only the live client token', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/paddle/client-config' });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ enabled: true, clientToken: 'live_test' });
    expect(response.body).not.toContain('pdl_live_test');
    expect(response.body).not.toContain(secret);
  });

  it('continues processing signed notifications when new skin sales are paused', async () => {
    await close();
    const built = buildApp({ env: testEnv({ PADDLE_CHECKOUT_ENABLED: 'false', PADDLE_API_KEY: 'pdl_live_test',
      PADDLE_CLIENT_TOKEN: '', PADDLE_WEBHOOK_SECRET: secret }), db: fixture.db,
      clock: fixture.clock, logger: pino({ level: 'silent' }) });
    app = built.app;
    close = built.close;
    await app.ready();
    expect((await app.inject({ method: 'GET', url: '/api/paddle/client-config' })).json()).toEqual({ enabled: false });
    expect((await webhook('adjustment.updated', { transaction_id: transactionId,
      action: 'refund', status: 'approved' })).statusCode).toBe(200);
  });

  it('creates one trusted bundle transaction and grants all four skins only after a signed completion', async () => {
    const request = () => app.inject({ method: 'POST', url: '/api/skins/purchase', headers: { authorization }, payload: { itemId: 'bundle' } });
    const first = await request();
    expect(first.statusCode, first.body).toBe(200);
    expect((await request()).statusCode).toBe(200);
    expect(createCalls).toHaveLength(1);
    expect(createCalls[0]).toMatchObject({ items: [{ price_id: LIVE_PRICE_IDS.bundle, quantity: 1 }], collection_mode: 'automatic' });
    expect(createCalls[0]).toMatchObject({ currency_code: 'EUR' });
    const completed = { id: transactionId, status: 'completed', customer_id: 'ctm_01m3fxlive000000000000000',
      items: [{ price: { id: LIVE_PRICE_IDS.bundle }, quantity: 1 }] };
    expect((await webhook('transaction.completed', completed, '203.0.113.10')).statusCode).toBe(403);
    expect((await webhook('transaction.completed', { ...completed, items: [{ price: { id: LIVE_PRICE_IDS['planet-lava'] }, quantity: 1 }] })).statusCode).toBe(200);
    expect(await readOwned()).toEqual([]);
    expect((await webhook('transaction.completed', completed)).statusCode).toBe(200);
    const [finishedOrder] = await fixture.db.select().from(paddleSkinOrders)
      .where(eq(paddleSkinOrders.transactionId, transactionId));
    expect(finishedOrder).toMatchObject({ status: 'COMPLETED', customerId: completed.customer_id });
    const shop = await app.inject({ method: 'GET', url: '/api/skins/shop', headers: { authorization } });
    expect(shop.json()).toMatchObject({ paddleCustomerId: completed.customer_id });
    const owned = await readOwned();
    expect(new Set(owned)).toEqual(new Set(['planet-lava', 'planet-ice', 'planet-toxic', 'planet-desert']));
    const rights = await fixture.db.select().from(cosmeticEntitlements).where(eq(cosmeticEntitlements.accountId, fixture.accountIds[0]!));
    expect(rights).toHaveLength(4);
  });

  it('does not open a second checkout for an elemental skin already in a pending bundle', async () => {
    const request = async (itemId: 'bundle' | 'planet-lava') => app.inject({ method: 'POST',
      url: '/api/skins/purchase', headers: { authorization }, payload: { itemId } });
    expect((await request('bundle')).statusCode).toBe(200);
    expect((await request('planet-lava')).statusCode).toBe(409);
    expect(createCalls).toHaveLength(1);
  });

  it('revokes refunded Paddle rights and unequips skins without deleting order or manual rights', async () => {
    await app.inject({ method: 'POST', url: '/api/skins/purchase', headers: { authorization }, payload: { itemId: 'planet-lava' } });
    const completed = { id: transactionId, status: 'completed', customer_id: 'ctm_01m3fxlive000000000000000',
      items: [{ price: { id: LIVE_PRICE_IDS['planet-lava'] }, quantity: 1 }] };
    await webhook('transaction.completed', completed);
    await app.inject({ method: 'POST', url: `/api/skins/planets/${fixture.planetIds[0]}`, headers: { authorization }, payload: { skinId: 'planet-lava' } });
    expect((await webhook('adjustment.updated', { transaction_id: transactionId, action: 'refund', status: 'approved' })).statusCode).toBe(200);
    expect(await readOwned()).toEqual([]);
    const [world] = await fixture.db.select({ skin: planets.equippedSkinId }).from(planets).where(eq(planets.id, fixture.planetIds[0]!));
    expect(world?.skin).toBeNull();
    const [order] = await fixture.db.select().from(paddleSkinOrders).where(eq(paddleSkinOrders.transactionId, transactionId));
    expect(order?.status).toBe('REVOKED');
    await webhook('transaction.completed', completed);
    expect(await readOwned()).toEqual([]);
  });

  it('rejects malformed, stale and incorrect webhook signatures', () => {
    const raw = '{}';
    const now = Math.floor(Date.now() / 1000);
    const h1 = createHmac('sha256', secret).update(`${now}:${raw}`).digest('hex');
    expect(verifyPaddleSignature(raw, `ts=${now};h1=${h1}`, secret)).toBe(true);
    expect(verifyPaddleSignature(raw, `ts=${now - 601};h1=${h1}`, secret)).toBe(false);
    expect(verifyPaddleSignature(raw, `ts=${now};h1=${'0'.repeat(64)}`, secret)).toBe(false);
  });

  it('shows location based prices and fixes transaction currency to match the chosen offer', async () => {
    const pricing = await app.inject({ method: 'GET', url: '/api/skins/pricing', remoteAddress: '198.51.100.1' });
    expect(pricing.statusCode, pricing.body).toBe(200);
    expect(pricing.json()).toMatchObject({ countryCode: 'TR', prices: {
      'planet-lava': { formatted: '₺99.00', currencyCode: 'TRY' },
      'planet-germany': { formatted: '€2.99', currencyCode: 'EUR' },
    } });
    const buy = await app.inject({ method: 'POST', url: '/api/skins/purchase', remoteAddress: '198.51.100.1',
      headers: { authorization }, payload: { itemId: 'planet-lava' } });
    expect(buy.statusCode, buy.body).toBe(200);
    expect(createCalls[0]).toMatchObject({ currency_code: 'TRY', items: [{ price_id: LIVE_PRICE_IDS['planet-lava'] }] });
  });
});
