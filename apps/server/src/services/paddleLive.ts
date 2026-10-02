import { createHmac, timingSafeEqual } from 'node:crypto';
import { isIP } from 'node:net';
import { and, desc, eq, inArray, isNotNull, isNull, or } from 'drizzle-orm';
import { z } from 'zod';
import type { PlanetSkinId } from '@astera/rules';
import type { Db } from '../db/client.js';
import { accounts, cosmeticEntitlements, paddleReversals, paddleSkinOrders, paddleWebhookEvents, planets, players } from '../db/schema.js';
import type { Env } from '../env.js';
import { GameError } from './planet.js';
import { publishShard } from '../stream/bus.js';

// The Paddle catalog has no Japan price. Keep that dormant checkout route on
// the offers it can actually fulfill; Japan uses the live Polar product.
export const paddleItemIds = [
  'planet-lava', 'planet-ice', 'planet-toxic', 'planet-desert',
  'planet-turkey', 'planet-germany', 'planet-france', 'planet-spain',
  'bundle',
] as const satisfies readonly (PlanetSkinId | 'bundle')[];
export type PaddleItemId = (typeof paddleItemIds)[number];

export const LIVE_PRICE_IDS = {
  'planet-lava': 'pri_01m3fwr44wjzkbenrjctb9k6dd',
  'planet-ice': 'pri_01m3fws4ewv6kp2yr4tztk8427',
  'planet-toxic': 'pri_01m3fwtx8bvz0dbqdv3p18379m',
  'planet-desert': 'pri_01m3fwvmk6eysq56ed05z1828m',
  'planet-turkey': 'pri_01m3fx4wqpeqpzav659tz16e7t',
  'planet-germany': 'pri_01m3fx5v21rxrjaddw764dexe4',
  'planet-france': 'pri_01m3fx6rg3nsn9nd3j179287hg',
  'planet-spain': 'pri_01m3fx85a9gb6gpkbbrjjry73p',
  bundle: 'pri_01m3fx3943k024e12yb67a49r1',
} as const satisfies Record<PaddleItemId, string>;

export function priceIdsFor(env: Env): Record<PaddleItemId, string> {
  return {
    'planet-lava': env.PADDLE_PRICE_LAVA,
    'planet-ice': env.PADDLE_PRICE_ICE,
    'planet-toxic': env.PADDLE_PRICE_TOXIC,
    'planet-desert': env.PADDLE_PRICE_DESERT,
    'planet-turkey': env.PADDLE_PRICE_TURKEY,
    'planet-germany': env.PADDLE_PRICE_GERMANY,
    'planet-france': env.PADDLE_PRICE_FRANCE,
    'planet-spain': env.PADDLE_PRICE_SPAIN,
    bundle: env.PADDLE_PRICE_BUNDLE,
  };
}

export const bundleSkinIds = ['planet-lava', 'planet-ice', 'planet-toxic', 'planet-desert'] as const;
const skinsFor = (itemId: PaddleItemId): readonly PlanetSkinId[] => itemId === 'bundle' ? bundleSkinIds : [itemId];

export function paddleWebhookReady(env: Env): boolean {
  return env.PADDLE_ENV === 'production' && env.PADDLE_API_KEY.startsWith('pdl_live_')
    && env.PADDLE_WEBHOOK_SECRET.startsWith('pdl_ntfset_');
}

export function paddleReady(env: Env): boolean {
  return paddleWebhookReady(env) && env.PADDLE_CHECKOUT_ENABLED && env.PADDLE_CLIENT_TOKEN.startsWith('live_');
}

export async function paddleCustomerForAccount(db: Db, accountId: string): Promise<string | null> {
  const [order] = await db.select({ customerId: paddleSkinOrders.customerId }).from(paddleSkinOrders)
    .where(and(eq(paddleSkinOrders.accountId, accountId), isNotNull(paddleSkinOrders.customerId)))
    .orderBy(desc(paddleSkinOrders.createdAt)).limit(1);
  return order?.customerId ?? null;
}

const previewSchema = z.object({ data: z.object({
  address: z.object({ country_code: z.string().length(2) }),
  currency_code: z.string(),
  details: z.object({ line_items: z.array(z.object({ price: z.object({ id: z.string() }),
    formatted_unit_totals: z.object({ total: z.string().min(1) }) })) }),
}) });
type Preview = z.infer<typeof previewSchema>;

async function preview(env: Env, itemIds: readonly PaddleItemId[], location: object, currency?: 'EUR' | 'TRY'): Promise<Preview> {
  const prices = priceIdsFor(env);
  let response: Response;
  try {
    response = await fetch('https://api.paddle.com/pricing-preview', {
      method: 'POST', headers: { Authorization: `Bearer ${env.PADDLE_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: itemIds.map(itemId => ({ price_id: prices[itemId], quantity: 1 })),
        ...location, ...(currency ? { currency_code: currency } : {}) }),
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) throw new Error('Paddle price preview failed');
    return previewSchema.parse(await response.json());
  } catch {
    throw new GameError('PADDLE_PRICING_UNAVAILABLE', 'Pricing is temporarily unavailable', 502);
  }
}

async function countryForIp(env: Env, ip: string): Promise<string> {
  const result = await preview(env, ['planet-lava'], { customer_ip_address: ip });
  return result.data.address.country_code;
}

/** Match display prices to the currency that the later transaction will actually use. */
export async function livePricingForIp(env: Env, ip: string) {
  if (!env.PADDLE_API_KEY.startsWith('pdl_live_')) throw new GameError('SKIN_SHOP_CLOSED', 'Pricing is not available yet', 503);
  const detected = await preview(env, paddleItemIds, { customer_ip_address: ip });
  const countryCode = detected.data.address.country_code;
  const euroItems = countryCode === 'TR'
    ? (['planet-germany', 'planet-france', 'planet-spain'] as const) : paddleItemIds;
  const euros = await preview(env, euroItems, { address: { country_code: countryCode } }, 'EUR');
  const euroItemSet = new Set<string>(euroItems);
  const prices: Partial<Record<PaddleItemId, { formatted: string; currencyCode: string }>> = {};
  const priceIds = priceIdsFor(env);
  for (const itemId of paddleItemIds) {
    const useTry = countryCode === 'TR' && !euroItemSet.has(itemId);
    const result = useTry ? detected.data : euros.data;
    const line = result.details.line_items.find(row => row.price.id === priceIds[itemId]);
    if (!line) throw new GameError('PADDLE_PRICING_UNAVAILABLE', 'Pricing is temporarily unavailable', 502);
    prices[itemId] = { formatted: line.formatted_unit_totals.total, currencyCode: result.currency_code };
  }
  return { countryCode, prices };
}

export async function createSkinPurchase(db: Db, env: Env, accountId: string, itemId: PaddleItemId, ip: string) {
  if (!paddleReady(env)) throw new GameError('SKIN_SHOP_CLOSED', 'Skin sales are not available yet', 503);
  const priceId = priceIdsFor(env)[itemId];
  const countryCode = await countryForIp(env, ip);
  const currencyCode = countryCode === 'TR' && !['planet-germany', 'planet-france', 'planet-spain'].includes(itemId)
    ? 'TRY' : 'EUR';
  // Lock the account while reserving the offer. A bundle and one of its skins
  // must never become two payable checkouts in concurrent requests.
  const overlappingIds: PaddleItemId[] = itemId === 'bundle'
    ? ['bundle', ...bundleSkinIds]
    : bundleSkinIds.some(id => id === itemId) ? [itemId, 'bundle'] : [itemId];
  const reservation = await db.transaction(async tx => {
    const [account] = await tx.select({ id: accounts.id }).from(accounts)
      .where(eq(accounts.id, accountId)).for('update').limit(1);
    if (!account) throw new GameError('ACCOUNT_NOT_FOUND', 'Account not found', 404);
    const owned = await tx.select({ cosmeticId: cosmeticEntitlements.cosmeticId }).from(cosmeticEntitlements)
      .where(and(eq(cosmeticEntitlements.accountId, accountId),
        inArray(cosmeticEntitlements.cosmeticId, skinsFor(itemId)), isNull(cosmeticEntitlements.revokedAt)));
    if (owned.length) throw new GameError('SKIN_ALREADY_OWNED', 'This account already owns part of this offer', 409);
    const [pending] = await tx.select().from(paddleSkinOrders).where(and(
      eq(paddleSkinOrders.accountId, accountId), inArray(paddleSkinOrders.itemId, overlappingIds),
      eq(paddleSkinOrders.status, 'PENDING'))).limit(1);
    if (pending) {
      if (pending.itemId === itemId && pending.transactionId) return { transactionId: pending.transactionId };
      throw new GameError('SKIN_CHECKOUT_IN_PROGRESS', 'Another checkout for this skin is in progress', 409);
    }
    const [intent] = await tx.insert(paddleSkinOrders).values({ accountId, itemId, priceId })
      .returning({ id: paddleSkinOrders.id });
    if (!intent) throw new GameError('SKIN_CHECKOUT_STARTING', 'Checkout is still starting; try again shortly', 409);
    return { intentId: intent.id };
  });
  if ('transactionId' in reservation) return { transactionId: reservation.transactionId };
  const intentId = reservation.intentId;
  let response: Response;
  try {
    response = await fetch('https://api.paddle.com/transactions', {
      method: 'POST', headers: { Authorization: `Bearer ${env.PADDLE_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: [{ price_id: priceId, quantity: 1 }], collection_mode: 'automatic',
        currency_code: currencyCode, custom_data: { astera_order_id: intentId } }), signal: AbortSignal.timeout(8000),
    });
  } catch {
    // An interrupted request may have succeeded at Paddle. Keep the intent pending.
    throw new GameError('PADDLE_UNAVAILABLE', 'Payment service unavailable', 502);
  }
  const parsed = z.object({ data: z.object({ id: z.string().startsWith('txn_') }) })
    .safeParse(await response.json().catch(() => null));
  if (!response.ok || !parsed.success) {
    if (response.status >= 400 && response.status < 500) await db.update(paddleSkinOrders)
      .set({ status: 'FAILED' }).where(eq(paddleSkinOrders.id, intentId));
    throw new GameError('PADDLE_UNAVAILABLE', 'Payment service unavailable', 502);
  }
  await db.update(paddleSkinOrders).set({ transactionId: parsed.data.data.id })
    .where(eq(paddleSkinOrders.id, intentId));
  return { transactionId: parsed.data.data.id };
}

/** Verify the exact raw bytes and Paddle timestamp before parsing JSON. */
export function verifyPaddleSignature(raw: string, header: string | undefined, secret: string): boolean {
  if (!header || !secret) return false;
  const fields = header.split(';').map(part => part.trim());
  const timestamp = fields.find(part => part.startsWith('ts='))?.slice(3);
  const signatures = fields.filter(part => part.startsWith('h1=')).map(part => part.slice(3));
  if (!timestamp || !/^\d{10}$/.test(timestamp) || Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) return false;
  const expected = createHmac('sha256', secret).update(`${timestamp}:${raw}`).digest();
  return signatures.some(signature => /^[0-9a-f]{64}$/i.test(signature)
    && timingSafeEqual(expected, Buffer.from(signature, 'hex')));
}

const ipResponse = z.object({ data: z.object({ ipv4_cidrs: z.array(z.string()) }) });
let ipCache: { addresses: Set<string>; expiresAt: number } | null = null;

/** Paddle currently publishes /32 CIDRs. Any unexpected format fails closed. */
export async function isPaddleWebhookIp(ip: string, env: Env): Promise<boolean> {
  if (!ipCache || ipCache.expiresAt <= Date.now()) {
    try {
      const response = await fetch('https://api.paddle.com/ips', {
        headers: { Authorization: `Bearer ${env.PADDLE_API_KEY}` }, signal: AbortSignal.timeout(5000),
      });
      if (!response.ok) return false;
      const parsed = ipResponse.parse(await response.json());
      if (!parsed.data.ipv4_cidrs.length || parsed.data.ipv4_cidrs.some(cidr =>
        !cidr.endsWith('/32') || isIP(cidr.slice(0, -3)) !== 4)) return false;
      ipCache = { addresses: new Set(parsed.data.ipv4_cidrs.map(cidr => cidr.slice(0, -3))),
        expiresAt: Date.now() + 15 * 60_000 };
    } catch { return false; }
  }
  const address = ip.startsWith('::ffff:') ? ip.slice(7) : ip;
  return ipCache.addresses.has(address);
}

const event = z.object({ event_id: z.string().min(1), event_type: z.string(), data: z.unknown() });
const completedTransaction = z.object({
  id: z.string().startsWith('txn_'), status: z.literal('completed'),
  customer_id: z.string().startsWith('ctm_').nullish(),
  custom_data: z.object({ astera_order_id: z.string().uuid() }).nullish(),
  items: z.array(z.object({ price: z.object({ id: z.string() }), quantity: z.number().int() })),
});
const adjustment = z.object({ transaction_id: z.string().startsWith('txn_'),
  action: z.string(), status: z.string(), type: z.string().optional() });

export async function processPaddleEvent(db: Db, raw: string): Promise<void> {
  const payload = event.parse(JSON.parse(raw));
  await db.transaction(async tx => {
    const [seen] = await tx.insert(paddleWebhookEvents)
      .values({ id: payload.event_id, eventType: payload.event_type })
      .onConflictDoNothing().returning({ id: paddleWebhookEvents.id });
    if (!seen) return;
    if (payload.event_type === 'transaction.completed') {
      const parsed = completedTransaction.safeParse(payload.data);
      if (!parsed.success) return;
      const data = parsed.data;
      const [order] = await tx.select().from(paddleSkinOrders).where(or(
        eq(paddleSkinOrders.transactionId, data.id),
        data.custom_data?.astera_order_id ? eq(paddleSkinOrders.id, data.custom_data.astera_order_id) : undefined,
      )).for('update').limit(1);
      if (!order?.accountId || order.status !== 'PENDING' || (order.transactionId && order.transactionId !== data.id)) return;
      const offer = z.enum(paddleItemIds).safeParse(order.itemId);
      if (!offer.success) return;
      if (data.items.length !== 1 || data.items[0]?.price.id !== order.priceId || data.items[0].quantity !== 1) return;
      const [reversal] = await tx.select().from(paddleReversals)
        .where(eq(paddleReversals.transactionId, data.id)).limit(1);
      if (reversal) {
        await tx.update(paddleSkinOrders).set({ transactionId: data.id, status: 'REVOKED' })
          .where(eq(paddleSkinOrders.id, order.id));
        return;
      }
      for (const skinId of skinsFor(offer.data)) {
        await tx.insert(cosmeticEntitlements).values({ accountId: order.accountId,
          cosmeticId: skinId, source: 'PADDLE', orderRef: `${data.id}:${skinId}` }).onConflictDoNothing();
      }
      await tx.update(paddleSkinOrders).set({ transactionId: data.id, customerId: data.customer_id ?? null,
        status: 'COMPLETED' }).where(eq(paddleSkinOrders.id, order.id));
      return;
    }
    if (payload.event_type !== 'adjustment.created' && payload.event_type !== 'adjustment.updated') return;
    const parsed = adjustment.safeParse(payload.data);
    if (!parsed.success || parsed.data.status !== 'approved'
      || !['refund', 'chargeback'].includes(parsed.data.action)
      || (parsed.data.action === 'refund' && parsed.data.type === 'partial')) return;
    const data = parsed.data;
    await tx.insert(paddleReversals).values({ transactionId: data.transaction_id, action: data.action })
      .onConflictDoNothing();
    const [order] = await tx.select().from(paddleSkinOrders)
      .where(eq(paddleSkinOrders.transactionId, data.transaction_id)).for('update').limit(1);
    if (!order || order.status === 'REVOKED') return;
    const offer = z.enum(paddleItemIds).safeParse(order.itemId);
    if (!offer.success) return;
    await tx.update(paddleSkinOrders).set({ status: 'REVOKED' }).where(eq(paddleSkinOrders.id, order.id));
    if (!order.accountId) return;
    for (const skinId of skinsFor(offer.data)) {
      await tx.update(cosmeticEntitlements).set({ revokedAt: new Date() }).where(and(
        eq(cosmeticEntitlements.source, 'PADDLE'),
        eq(cosmeticEntitlements.orderRef, `${data.transaction_id}:${skinId}`), isNull(cosmeticEntitlements.revokedAt)));
      const [active] = await tx.select({ id: cosmeticEntitlements.id }).from(cosmeticEntitlements)
        .where(and(eq(cosmeticEntitlements.accountId, order.accountId),
          eq(cosmeticEntitlements.cosmeticId, skinId), isNull(cosmeticEntitlements.revokedAt))).limit(1);
      if (active) continue;
      const changed = await tx.update(planets).set({ equippedSkinId: null }).where(and(
        eq(planets.equippedSkinId, skinId),
        inArray(planets.controllerPlayerId, tx.select({ id: players.id }).from(players)
          .where(eq(players.accountId, order.accountId))),
      )).returning({ seasonId: planets.seasonId });
      for (const seasonId of new Set(changed.map(row => row.seasonId))) await publishShard(tx, seasonId, 'world');
    }
  });
}
