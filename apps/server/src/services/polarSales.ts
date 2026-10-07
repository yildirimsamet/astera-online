import { and, eq, inArray, isNull, lte, or } from 'drizzle-orm';
import { z } from 'zod';
import { PLANET_SKIN_IDS, type PlanetSkinId } from '@astera/rules';
import type { Db } from '../db/client.js';
import { accounts, cosmeticEntitlements, planets, players, polarReversals,
  polarSkinOrders, polarWebhookEvents } from '../db/schema.js';
import type { Env } from '../env.js';
import { publishShard } from '../stream/bus.js';
import { GameError } from './planet.js';
import { createPolarCheckoutSession, polarPricingForIp, polarReady, productIdsFor, type PolarItemId } from './polar.js';

export const polarItemIds = [...PLANET_SKIN_IDS, 'bundle'] as const;
const elementalIds = ['planet-lava', 'planet-ice', 'planet-toxic', 'planet-desert'] as const;
const skinsFor = (itemId: PolarItemId): readonly PlanetSkinId[] => itemId === 'bundle' ? elementalIds : [itemId];
// Polar requests time out after 8s; leave room for persistence before recovering a crashed start.
const CHECKOUT_START_TIMEOUT_MS = 60_000;

/** A local intent is written before contacting Polar so even a fast webhook can find its owner. */
export async function startPolarPurchase(db: Db, env: Env, accountId: string, itemId: PolarItemId, ip: string) {
  if (!polarReady(env)) throw new GameError('SKIN_SHOP_CLOSED', 'Skin sales are not available yet', 503);
  const quote = await polarPricingForIp(ip);
  const price = quote.prices[itemId];
  const productId = productIdsFor(env)[itemId];
  const overlapping: PolarItemId[] = itemId === 'bundle'
    ? ['bundle', ...elementalIds] : elementalIds.some(id => id === itemId) ? [itemId, 'bundle'] : [itemId];
  const reservation = await db.transaction(async tx => {
    const [account] = await tx.select({ id: accounts.id }).from(accounts)
      .where(eq(accounts.id, accountId)).for('update').limit(1);
    if (!account) throw new GameError('ACCOUNT_NOT_FOUND', 'Account not found', 404);
    const [owned] = await tx.select({ id: cosmeticEntitlements.id }).from(cosmeticEntitlements)
      .where(and(eq(cosmeticEntitlements.accountId, accountId),
        inArray(cosmeticEntitlements.cosmeticId, skinsFor(itemId)), isNull(cosmeticEntitlements.revokedAt))).limit(1);
    if (owned) throw new GameError('SKIN_ALREADY_OWNED', 'This account already owns part of this offer', 409);
    const now = Date.now();
    // Recover every overlap under the account lock. Keep the intent for a late paid/refunded webhook.
    await tx.update(polarSkinOrders).set({ status: 'FAILED' }).where(and(
      eq(polarSkinOrders.accountId, accountId), inArray(polarSkinOrders.itemId, overlapping),
      eq(polarSkinOrders.status, 'PENDING'),
      or(lte(polarSkinOrders.expiresAt, new Date(now)),
        and(isNull(polarSkinOrders.expiresAt),
          lte(polarSkinOrders.createdAt, new Date(now - CHECKOUT_START_TIMEOUT_MS)))),
    ));
    const [pending] = await tx.select().from(polarSkinOrders).where(and(
      eq(polarSkinOrders.accountId, accountId), inArray(polarSkinOrders.itemId, overlapping),
      eq(polarSkinOrders.status, 'PENDING'))).limit(1);
    if (pending) {
      if (pending.itemId === itemId && pending.checkoutId && pending.checkoutUrl) {
        return { checkoutId: pending.checkoutId, url: pending.checkoutUrl };
      } else {
        throw new GameError('SKIN_CHECKOUT_IN_PROGRESS', 'Another checkout for this skin is in progress', 409);
      }
    }
    const [intent] = await tx.insert(polarSkinOrders).values({ accountId, itemId, productId })
      .returning({ id: polarSkinOrders.id });
    if (!intent) throw new GameError('SKIN_CHECKOUT_STARTING', 'Checkout is still starting; try again shortly', 409);
    return { intentId: intent.id };
  });
  if ('checkoutId' in reservation) return reservation;
  const intentId = reservation.intentId;
  try {
    const session = await createPolarCheckoutSession(env, { accountId, orderId: intentId, itemId, ip,
      currency: price.currencyCode, expectedAmount: price.amount });
    await db.update(polarSkinOrders).set({ checkoutId: session.checkoutId,
      checkoutUrl: session.url, expiresAt: session.expiresAt })
      .where(eq(polarSkinOrders.id, intentId));
    return { checkoutId: session.checkoutId, url: session.url };
  } catch (error) {
    // The intent remains to match any unexpectedly late paid webhook by metadata.
    await db.update(polarSkinOrders).set({ status: 'FAILED' })
      .where(and(eq(polarSkinOrders.id, intentId), eq(polarSkinOrders.status, 'PENDING')));
    throw error;
  }
}

const order = z.object({
  id: z.string().uuid(),
  checkout_id: z.string().uuid(),
  product_id: z.string().uuid(),
  metadata: z.object({ astera_order_id: z.string().uuid() }).passthrough(),
  customer: z.object({ external_id: z.string().uuid().nullish() }).passthrough().nullish(),
});
const paidOrder = order.extend({ paid: z.literal(true) });
const refundedOrder = order.extend({ status: z.enum(['refunded', 'partially_refunded']) });
const event = z.object({ type: z.string(), data: z.unknown() });

/** Called only after the Polar SDK has checked the signature over the raw body. */
export async function processPolarEvent(db: Db, webhookId: string, payload: unknown): Promise<void> {
  const parsedEvent = event.parse(payload);
  await db.transaction(async tx => {
    const [seen] = await tx.insert(polarWebhookEvents).values({ id: webhookId, eventType: parsedEvent.type })
      .onConflictDoNothing().returning({ id: polarWebhookEvents.id });
    if (!seen) return;
    if (parsedEvent.type === 'checkout.expired') {
      const expired = z.object({ id: z.string().uuid() }).safeParse(parsedEvent.data);
      if (expired.success) await tx.update(polarSkinOrders).set({ status: 'FAILED' })
        .where(and(eq(polarSkinOrders.checkoutId, expired.data.id), eq(polarSkinOrders.status, 'PENDING')));
      return;
    }
    if (parsedEvent.type === 'order.paid') {
      const parsed = paidOrder.safeParse(parsedEvent.data);
      if (!parsed.success) return;
      const data = parsed.data;
      const [intent] = await tx.select().from(polarSkinOrders)
        .where(or(eq(polarSkinOrders.checkoutId, data.checkout_id),
          eq(polarSkinOrders.id, data.metadata.astera_order_id))).for('update').limit(1);
      if (!intent?.accountId || intent.orderId && intent.orderId !== data.id
        || intent.checkoutId && intent.checkoutId !== data.checkout_id
        || intent.id !== data.metadata.astera_order_id || intent.productId !== data.product_id
        || data.customer?.external_id && data.customer.external_id !== intent.accountId) return;
      const item = z.enum(polarItemIds).safeParse(intent.itemId);
      if (!item.success || intent.status === 'COMPLETED' || intent.status === 'REVOKED') return;
      const [reversal] = await tx.select().from(polarReversals).where(eq(polarReversals.orderId, data.id)).limit(1);
      if (reversal) {
        await tx.update(polarSkinOrders).set({ checkoutId: data.checkout_id, orderId: data.id, status: 'REVOKED' })
          .where(eq(polarSkinOrders.id, intent.id));
        return;
      }
      for (const skinId of skinsFor(item.data)) {
        await tx.insert(cosmeticEntitlements).values({ accountId: intent.accountId, cosmeticId: skinId,
          source: 'POLAR', orderRef: `${data.id}:${skinId}` }).onConflictDoNothing();
      }
      await tx.update(polarSkinOrders).set({ checkoutId: data.checkout_id, orderId: data.id, status: 'COMPLETED' })
        .where(eq(polarSkinOrders.id, intent.id));
      return;
    }
    if (parsedEvent.type !== 'order.refunded') return;
    const parsed = refundedOrder.safeParse(parsedEvent.data);
    if (!parsed.success || parsed.data.status !== 'refunded') return;
    const data = parsed.data;
    const [intent] = await tx.select().from(polarSkinOrders)
      .where(or(eq(polarSkinOrders.orderId, data.id), eq(polarSkinOrders.checkoutId, data.checkout_id),
        eq(polarSkinOrders.id, data.metadata.astera_order_id))).for('update').limit(1);
    if (!intent) return;
    if (intent.productId !== data.product_id || intent.id !== data.metadata.astera_order_id
      || intent.orderId && intent.orderId !== data.id
      || intent.checkoutId && intent.checkoutId !== data.checkout_id) return;
    const item = z.enum(polarItemIds).safeParse(intent.itemId);
    if (!item.success || intent.status === 'REVOKED') return;
    await tx.insert(polarReversals).values({ orderId: data.id }).onConflictDoNothing();
    await tx.update(polarSkinOrders).set({ checkoutId: data.checkout_id, orderId: data.id, status: 'REVOKED' })
      .where(eq(polarSkinOrders.id, intent.id));
    if (!intent.accountId) return;
    for (const skinId of skinsFor(item.data)) {
      await tx.update(cosmeticEntitlements).set({ revokedAt: new Date() }).where(and(
        eq(cosmeticEntitlements.source, 'POLAR'), eq(cosmeticEntitlements.orderRef, `${data.id}:${skinId}`),
        isNull(cosmeticEntitlements.revokedAt)));
      const [active] = await tx.select({ id: cosmeticEntitlements.id }).from(cosmeticEntitlements)
        .where(and(eq(cosmeticEntitlements.accountId, intent.accountId),
          eq(cosmeticEntitlements.cosmeticId, skinId), isNull(cosmeticEntitlements.revokedAt))).limit(1);
      if (active) continue;
      const changed = await tx.update(planets).set({ equippedSkinId: null }).where(and(
        eq(planets.equippedSkinId, skinId),
        inArray(planets.controllerPlayerId, tx.select({ id: players.id }).from(players)
          .where(eq(players.accountId, intent.accountId))),
      )).returning({ seasonId: planets.seasonId });
      for (const seasonId of new Set(changed.map(row => row.seasonId))) await publishShard(tx, seasonId, 'world');
    }
  });
}
