import { createHmac, randomBytes, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parseEnv } from 'node:util';
import { COSMETIC_IDS, cosmeticById } from '@astera/rules';
import { and, eq } from 'drizzle-orm';
import { pino } from 'pino';
import { z } from 'zod';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { skinCollectionSchema as collectionSchema } from '../../web/src/api/schemas.js';
import { buildApp } from '../src/app.js';
import { TokenService } from '../src/auth/tokens.js';
import { cosmeticEntitlements, polarSkinOrders, seasons } from '../src/db/schema.js';
import { clanActor, createClan } from '../src/services/clan.js';
import { clanCosmeticFlags } from '../src/services/cosmeticEquipment.js';
import { grant, seedWorld, setLevel, testDb, testEnv, type Fixture } from './helpers.js';

const wave = [
  'ring-saturn', 'ring-prism', 'ring-inferno', 'ring-nebula', 'engine-tempest', 'engine-prism',
  'flag-sovereign', 'flag-kraken', 'flag-oni', 'flag-voideye', 'flag-valkyrie',
  'flag-scarab', 'flag-stag', 'flag-horizon', 'flag-tiger', 'flag-scorpion',
] as const;
const root = resolve(import.meta.dirname, '../../..');
const mapping = await readFile(resolve(root, 'config/polar-cosmetics.sandbox.json'), 'utf8');
const template = parseEnv(await readFile(resolve(root, '.env.example'), 'utf8'));
const planets = Object.fromEntries(Object.entries(template).filter(([key]) => key.startsWith('POLAR_PRODUCT_')));
const secret = `whsec_${randomBytes(32).toString('base64')}`;
const env = testEnv({ ...planets, POLAR_ENV: 'sandbox', POLAR_CHECKOUT_ENABLED: 'true',
  POLAR_ACCESS_TOKEN: 'polar_oat_test', POLAR_WEBHOOK_SECRET: secret, POLAR_COSMETIC_PRODUCTS: mapping });

afterAll(async () => { const { close } = await testDb(); await close(); });

describe('second-wave Polar delivery with the shipped sandbox catalogue', () => {
  let fixture: Fixture;
  let app: ReturnType<typeof buildApp>['app'];
  let close: () => Promise<void>;
  let authorization: string;
  let checkoutId: string;
  let checkoutCalls: number;

  beforeEach(async () => {
    fixture = await seedWorld(1);
    checkoutId = randomUUID();
    checkoutCalls = 0;
    vi.stubGlobal('fetch', vi.fn((url: string, init?: RequestInit) => {
      if (url === 'https://api.country.is/198.51.100.251') return Promise.resolve(new Response(JSON.stringify({ country: 'TR' })));
      if (url !== 'https://sandbox-api.polar.sh/v1/checkouts/' || typeof init?.body !== 'string') throw new Error('Unexpected provider request');
      const body = z.object({ currency: z.literal('try'), products: z.array(z.string()).length(1), external_customer_id: z.string().uuid() })
        .parse(JSON.parse(init.body));
      const offer = Object.values(env.POLAR_COSMETIC_PRODUCTS).find(entry => entry.productId === body.products[0]);
      if (!offer) throw new Error('Unknown checkout product');
      expect(body.external_customer_id).toBe(fixture.accountIds[0]);
      checkoutCalls += 1;
      return Promise.resolve(new Response(JSON.stringify({ id: checkoutId, url: `https://sandbox.polar.sh/checkout/${checkoutId}`,
        expires_at: '2027-01-01T00:00:00Z', currency: 'try', total_amount: offer.tryAmount }), { status: 201 }));
    }));
    const built = buildApp({ env, db: fixture.db, clock: fixture.clock, logger: pino({ level: 'silent' }) });
    app = built.app; close = built.close;
    await app.ready();
    authorization = `Bearer ${await new TokenService('test-secret-that-is-long-enough', 15, 30).issueAccess(fixture.accountIds[0]!)}`;
  });
  afterEach(async () => { vi.unstubAllGlobals(); await close(); });

  const purchase = (itemId: string) => app.inject({ method: 'POST', url: '/api/skins/polar-purchase',
    remoteAddress: '198.51.100.251', headers: { authorization }, payload: { itemId } });
  const collection = async () => collectionSchema.parse((await app.inject({ method: 'GET', url: '/api/skins', headers: { authorization, 'x-astera-cosmetics': COSMETIC_IDS.join(',') } })).json());
  async function webhook(type: string, data: object, eventId = randomUUID(), valid = true) {
    const payload = JSON.stringify({ type, timestamp: new Date().toISOString(), data });
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = createHmac('sha256', Buffer.from(secret.slice(6), 'base64'))
      .update(`${eventId}.${timestamp}.${payload}`).digest('base64');
    return app.inject({ method: 'POST', url: '/api/polar/webhook', payload,
      headers: { 'content-type': 'application/json', 'webhook-id': eventId, 'webhook-timestamp': String(timestamp),
        'webhook-signature': valid ? `v1,${signature}` : 'v1,invalid' } });
  }

  it.each(wave)('sells, delivers once, equips and fully refunds %s', async itemId => {
    const definition = cosmeticById(itemId);
    if (!definition) throw new Error('Missing second-wave cosmetic');
    let clanId: string | undefined;
    if (definition.category === 'FLAG') {
      await fixture.db.update(seasons).set({ rulesetVersion: 3 }).where(eq(seasons.id, fixture.seasonId));
      await grant(fixture.db, fixture.planetIds[0]!, 120_000, 60_000);
      await setLevel(fixture.db, fixture.planetIds[0]!, 'CORE', 10);
      const actor = await clanActor(fixture.db, fixture.accountIds[0]!);
      clanId = (await fixture.db.transaction(tx => createClan(tx, {
        actor, name: 'Wave Guard', tag: 'WG', description: '', recruiting: true, clock: fixture.clock,
      }))).clanId;
    }
    const responses = await Promise.all([purchase(itemId), purchase(itemId)]);
    expect(responses.some(response => response.statusCode === 200), responses.map(response => response.body).join('\n')).toBe(true);
    for (const response of responses) {
      expect([200, 409]).toContain(response.statusCode);
      if (response.statusCode === 409) expect(response.json()).toMatchObject({ error: 'SKIN_CHECKOUT_IN_PROGRESS' });
    }
    expect((await purchase(itemId)).statusCode).toBe(200);
    expect(checkoutCalls).toBe(1);
    expect((await collection()).ownedCosmeticIds).toEqual([]);
    const [intent] = await fixture.db.select().from(polarSkinOrders).where(eq(polarSkinOrders.checkoutId, checkoutId));
    if (!intent) throw new Error('Missing reserved order');
    expect(intent.itemId).toBe(itemId);
    expect(intent.productId).toBe(env.POLAR_COSMETIC_PRODUCTS[itemId]?.productId);
    const data = { id: randomUUID(), status: 'paid', paid: true, product_id: intent.productId,
      checkout_id: checkoutId, metadata: { astera_order_id: intent.id }, total_amount: env.POLAR_COSMETIC_PRODUCTS[itemId]?.tryAmount,
      refunded_amount: 0, customer: { external_id: fixture.accountIds[0] } };
    expect((await webhook('order.paid', data, randomUUID(), false)).statusCode).toBe(401);
    expect((await webhook('order.paid', { ...data, product_id: randomUUID() })).statusCode).toBe(200);
    expect((await webhook('order.paid', { ...data, customer: { external_id: randomUUID() } })).statusCode).toBe(200);
    expect((await collection()).ownedCosmeticIds).toEqual([]);
    const eventId = randomUUID();
    for (const deliveryId of [eventId, eventId, randomUUID()]) expect((await webhook('order.paid', data, deliveryId)).statusCode).toBe(200);
    expect((await collection()).ownedCosmeticIds).toEqual([itemId]);
    expect((await purchase(itemId)).statusCode).toBe(409);
    const rights = await fixture.db.select().from(cosmeticEntitlements).where(eq(cosmeticEntitlements.accountId, fixture.accountIds[0]!));
    expect(rights).toHaveLength(1);
    expect(rights[0]).toMatchObject({ cosmeticId: itemId, source: 'POLAR', orderRef: `${data.id}:${itemId}`, revokedAt: null });
    expect((await app.inject({ method: 'POST', url: '/api/cosmetics/equip', headers: { authorization },
      payload: { category: definition.category, cosmeticId: itemId } })).statusCode).toBe(200);
    expect((await collection()).equipment?.[definition.category]).toBe(itemId);
    if (clanId) expect((await clanCosmeticFlags(fixture.db, fixture.seasonId)).get(clanId)).toBe(itemId);
    const legacy = collectionSchema.parse((await app.inject({ method: 'GET', url: '/api/skins', headers: { authorization } })).json());
    expect(legacy.ownedCosmeticIds).toEqual([]);
    expect(legacy.equipment).toEqual({});
    if (clanId) expect(legacy.clanFlagId).toBe('flag-vanguard');
    const partial = { ...data, status: 'partially_refunded', refunded_amount: 100 };
    expect((await webhook('order.refunded', partial)).statusCode).toBe(200);
    expect((await collection()).ownedCosmeticIds).toEqual([itemId]);
    const full = { ...data, status: 'refunded', refunded_amount: data.total_amount };
    const refundId = randomUUID();
    for (const deliveryId of [refundId, refundId, randomUUID()]) expect((await webhook('order.refunded', full, deliveryId)).statusCode).toBe(200);
    expect((await collection()).ownedCosmeticIds).toEqual([]);
    expect((await collection()).equipment?.[definition.category]).toBeUndefined();
    if (clanId) expect((await clanCosmeticFlags(fixture.db, fixture.seasonId)).get(clanId)).toBe('flag-vanguard');
    expect((await webhook('order.paid', data)).statusCode).toBe(200);
    expect((await collection()).ownedCosmeticIds).toEqual([]);
    const [order] = await fixture.db.select().from(polarSkinOrders).where(eq(polarSkinOrders.id, intent.id));
    expect(order?.status).toBe('REVOKED');
    const [revoked] = await fixture.db.select().from(cosmeticEntitlements)
      .where(and(eq(cosmeticEntitlements.accountId, fixture.accountIds[0]!), eq(cosmeticEntitlements.cosmeticId, itemId)));
    expect(revoked?.revokedAt).toBeInstanceOf(Date);
  });

  it.each(['ring-saturn', 'engine-tempest', 'flag-sovereign'] as const)('never grants %s when its refund arrives before payment', async itemId => {
    expect((await purchase(itemId)).statusCode).toBe(200);
    const [intent] = await fixture.db.select().from(polarSkinOrders).where(eq(polarSkinOrders.checkoutId, checkoutId));
    if (!intent) throw new Error('Missing reserved order');
    const data = { id: randomUUID(), product_id: intent.productId, checkout_id: checkoutId,
      metadata: { astera_order_id: intent.id }, customer: { external_id: fixture.accountIds[0] } };
    expect((await webhook('order.refunded', { ...data, status: 'refunded' })).statusCode).toBe(200);
    expect((await webhook('order.paid', { ...data, status: 'paid', paid: true })).statusCode).toBe(200);
    expect((await collection()).ownedCosmeticIds).toEqual([]);
  });

  it('preserves a manual grant made while its Polar checkout is pending', async () => {
    const itemId = 'ring-saturn';
    expect((await purchase(itemId)).statusCode).toBe(200);
    const [intent] = await fixture.db.select().from(polarSkinOrders).where(eq(polarSkinOrders.checkoutId, checkoutId));
    if (!intent) throw new Error('Missing reserved order');
    const data = { id: randomUUID(), status: 'paid', paid: true, product_id: intent.productId,
      checkout_id: checkoutId, metadata: { astera_order_id: intent.id }, customer: { external_id: fixture.accountIds[0] } };
    await fixture.db.insert(cosmeticEntitlements).values({ accountId: fixture.accountIds[0]!, cosmeticId: itemId,
      source: 'MANUAL', orderRef: 'wave2-manual-entitlement' });
    expect((await webhook('order.paid', data)).statusCode).toBe(200);
    expect((await app.inject({ method: 'POST', url: '/api/cosmetics/equip', headers: { authorization },
      payload: { category: 'RING', cosmeticId: itemId } })).statusCode).toBe(200);
    expect((await webhook('order.refunded', { ...data, status: 'refunded' })).statusCode).toBe(200);
    expect((await collection()).ownedCosmeticIds).toEqual([itemId]);
    expect((await collection()).equipment?.RING).toBe(itemId);
    const rights = await fixture.db.select().from(cosmeticEntitlements).where(eq(cosmeticEntitlements.accountId, fixture.accountIds[0]!));
    expect(rights).toHaveLength(1);
    expect(rights.find(right => right.source === 'POLAR')).toBeUndefined();
    expect(rights.find(right => right.source === 'MANUAL')?.revokedAt).toBeNull();
  });

  it.each(['flag-vanguard', 'flag-orbit', 'flag-bastion', 'flag-meridian'])('never opens a paid checkout for included standard %s', async itemId => {
    expect((await purchase(itemId)).statusCode).toBe(503);
    expect(checkoutCalls).toBe(0);
    expect(await fixture.db.select().from(polarSkinOrders)).toEqual([]);
  });

  it.each(['ring-saturn', 'engine-tempest', 'flag-sovereign'] as const)('delivers and refunds pending %s after restarting with the old sale mapping', async itemId => {
    expect((await purchase(itemId)).statusCode).toBe(200);
    const [intent] = await fixture.db.select().from(polarSkinOrders).where(eq(polarSkinOrders.checkoutId, checkoutId));
    if (!intent) throw new Error('Missing reserved order');
    await close();
    const oldMapping = Object.fromEntries(Object.entries(env.POLAR_COSMETIC_PRODUCTS)
      .filter(([id]) => !wave.some(item => item === id)));
    expect(Object.keys(oldMapping)).toHaveLength(20);
    const replacement = buildApp({ db: fixture.db, clock: fixture.clock, logger: pino({ level: 'silent' }),
      env: { ...env, POLAR_COSMETIC_PRODUCTS: oldMapping, POLAR_CHECKOUT_ENABLED: false } });
    app = replacement.app; close = replacement.close; await app.ready();
    expect((await purchase(itemId)).statusCode).toBe(503);
    const data = { id: randomUUID(), product_id: intent.productId, checkout_id: checkoutId,
      metadata: { astera_order_id: intent.id }, customer: { external_id: fixture.accountIds[0] } };
    expect((await webhook('order.paid', { ...data, paid: true, status: 'paid' })).statusCode).toBe(200);
    expect((await collection()).ownedCosmeticIds).toEqual([itemId]);
    const legacy = collectionSchema.parse((await app.inject({ method: 'GET', url: '/api/skins', headers: { authorization } })).json());
    expect(legacy.ownedCosmeticIds).toEqual([]);
    expect((await webhook('order.refunded', { ...data, status: 'refunded' })).statusCode).toBe(200);
    expect((await collection()).ownedCosmeticIds).toEqual([]);
    expect((await webhook('order.paid', { ...data, paid: true, status: 'paid' })).statusCode).toBe(200);
    expect((await collection()).ownedCosmeticIds).toEqual([]);
  });
});
