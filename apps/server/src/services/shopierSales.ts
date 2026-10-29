import { and, asc, desc, eq, gt, inArray, isNotNull, isNull, like, lte, ne, notInArray, sql } from 'drizzle-orm';
import { z } from 'zod';
import { COSMETIC_IDS, cosmeticById, type CosmeticCategory, type CosmeticId } from '@astera/rules';
import { normaliseUsername } from '../auth/credentials.js';
import type { Db, Tx } from '../db/client.js';
import { accounts, cosmeticEntitlements, planets, players, shopierCheckouts, shopierOrders,
  shopierWebhookEvents } from '../db/schema.js';
import type { Env } from '../env.js';
import { publishShard } from '../stream/bus.js';
import { GameError } from './planet.js';
import { closeShopierOrder, createShopierProduct, deleteShopierProduct, listShopierOrders, shopierReady } from './shopier.js';

export const shopierItemIds = [...COSMETIC_IDS, 'bundle'] as const;
type ShopierItemId = (typeof shopierItemIds)[number];
const elementalIds = ['planet-lava', 'planet-ice', 'planet-toxic', 'planet-desert'] as const;
const skinsFor = (itemId: ShopierItemId): readonly CosmeticId[] => itemId === 'bundle' ? elementalIds : [itemId];
/** The set and its four looks cannot both be open: paying both would buy a look twice. */
const overlapping = (itemId: ShopierItemId): readonly ShopierItemId[] => itemId === 'bundle'
  ? ['bundle', ...elementalIds] : elementalIds.some(id => id === itemId) ? [itemId, 'bundle'] : [itemId];

/** Owner 2026-10-29: an unpaid product stays open 48 hours, counted again from every press. */
const CHECKOUT_LIFETIME_MS = 48 * 3_600_000;
/** Shopier answers a create in well under its 5 s timeout; a press pending a minute never got there. */
const CHECKOUT_START_TIMEOUT_MS = 60_000;
const OPEN_LIMIT = 5;
/** New products per commander per hour: Shopier allows 200 calls a minute for the whole shop. */
const HOURLY_LIMIT = 12;
/** Deletes per clean-up round: 20 × 3 s stays far inside the round's ten minutes. */
const SWEEP_BATCH = 20;

/** What the buyer reads on Shopier's page; the image beside it shows the look itself. */
const TITLES: Record<CosmeticCategory | 'bundle', string> = {
  PLANET: 'Gezegen görünümü', RING: 'Gezegen halkası görünümü', SHIP: 'Gemi görünümü', PROBE: 'Probe görünümü',
  MINER: 'Kazıcı görünümü', ENGINE: 'Motor alevi görünümü', FLAG: 'Klan bayrağı', bundle: '4\'lü gezegen görünümü paketi',
};
const titleFor = (itemId: ShopierItemId): string =>
  `Astera Online · ${TITLES[itemId === 'bundle' ? 'bundle' : cosmeticById(itemId)?.category ?? 'PLANET']}`;

/** Prices the store may show beside a Shopier press, in kuruş. Nothing while closed. */
export function shopierShop(env: Env) {
  if (!shopierReady(env)) return { enabled: false, prices: {} };
  return { enabled: true, prices: env.SHOPIER_PRICES };
}

/**
 * THE COMMANDER'S OWN PRODUCT (owner 2026-10-29). The local row is written before Shopier is
 * called, so a fast webhook always finds its owner; the same look pressed again returns the
 * same product and restarts its 48 hours. Mirrors `startPolarPurchase`.
 */
export async function startShopierCheckout(db: Db, env: Env, accountId: string, itemId: ShopierItemId, now: Date) {
  if (!shopierReady(env)) throw new GameError('SKIN_SHOP_CLOSED', 'Skin sales are not available yet', 503);
  const amount = env.SHOPIER_PRICES[itemId];
  if (!amount) throw new GameError('SHOPIER_PRODUCT_MISSING', 'This item is not sold on Shopier', 404);
  const expiresAt = new Date(now.getTime() + CHECKOUT_LIFETIME_MS);
  const offer = { amount, currency: 'TRY' as const, expiresAt };
  const reservation = await db.transaction(async tx => {
    const [account] = await tx.select({ id: accounts.id }).from(accounts)
      .where(eq(accounts.id, accountId)).for('update').limit(1);
    if (!account) throw new GameError('ACCOUNT_NOT_FOUND', 'Account not found', 404);
    const [owned] = await tx.select({ id: cosmeticEntitlements.id }).from(cosmeticEntitlements)
      .where(and(eq(cosmeticEntitlements.accountId, accountId),
        inArray(cosmeticEntitlements.cosmeticId, skinsFor(itemId)), isNull(cosmeticEntitlements.revokedAt))).limit(1);
    if (owned) throw new GameError('SKIN_ALREADY_OWNED', 'This account already owns part of this offer', 409);
    // Kept, not deleted: a product that did appear late can still be paid and must still deliver.
    await tx.update(shopierCheckouts).set({ status: 'FAILED' }).where(and(eq(shopierCheckouts.accountId, accountId),
      eq(shopierCheckouts.status, 'PENDING'), lte(shopierCheckouts.createdAt, new Date(now.getTime() - CHECKOUT_START_TIMEOUT_MS))));
    const live = await tx.select().from(shopierCheckouts).where(and(eq(shopierCheckouts.accountId, accountId),
      inArray(shopierCheckouts.status, ['PENDING', 'OPEN']))).orderBy(asc(shopierCheckouts.createdAt));
    const same = live.find(row => row.itemId === itemId);
    if (same?.status === 'PENDING') throw new GameError('SKIN_CHECKOUT_STARTING', 'Checkout is still starting; try again shortly', 409);
    if (same?.url && same.amount === amount) {
      await tx.update(shopierCheckouts).set({ expiresAt }).where(eq(shopierCheckouts.id, same.id));
      return { url: same.url };
    }
    const [recent] = await tx.select({ count: sql<number>`count(*)::int` }).from(shopierCheckouts).where(and(
      eq(shopierCheckouts.accountId, accountId), gt(shopierCheckouts.createdAt, new Date(now.getTime() - 3_600_000))));
    if ((recent?.count ?? 0) >= HOURLY_LIMIT) {
      throw new GameError('SHOPIER_CHECKOUT_LIMIT', 'Too many payment pages opened; try again later', 429);
    }
    // Replaced: the same look at an old price, an overlapping look or set, and the oldest past the limit.
    const replaced = live.filter(row => row.itemId === itemId || overlapping(itemId).some(id => id === row.itemId));
    const kept = live.filter(row => !replaced.includes(row));
    replaced.push(...kept.slice(0, Math.max(0, kept.length - (OPEN_LIMIT - 1))));
    if (replaced.length > 0) {
      await tx.update(shopierCheckouts).set({ status: 'CANCELLED' }).where(inArray(shopierCheckouts.id, replaced.map(row => row.id)));
    }
    const [intent] = await tx.insert(shopierCheckouts).values({ accountId, itemId, amount, createdAt: now, expiresAt })
      .returning({ id: shopierCheckouts.id });
    if (!intent) throw new GameError('SKIN_CHECKOUT_STARTING', 'Checkout is still starting; try again shortly', 409);
    return { intentId: intent.id };
  });
  if ('url' in reservation) return { url: reservation.url, ...offer };
  const { intentId } = reservation;
  let product: { productId: string; url: string };
  try {
    product = await createShopierProduct(env, {
      title: titleFor(itemId), amount, imageUrl: `${env.SHOPIER_IMAGE_BASE_URL}/${itemId}.jpg`,
      description: `Astera Online oyun içi görünüm. Bu ödeme sayfası tek bir komutan için açıldı; ödeme gelince görünüm onun hesabına kendiliğinden eklenir. Ref: ${intentId.slice(0, 8)}`,
    });
  } catch {
    await db.update(shopierCheckouts).set({ status: 'FAILED' })
      .where(and(eq(shopierCheckouts.id, intentId), eq(shopierCheckouts.status, 'PENDING')));
    throw new GameError('SHOPIER_UNAVAILABLE', 'Shopier did not answer', 502);
  }
  // The product is recorded even if a newer press replaced this one meanwhile: clean-up deletes it.
  await db.update(shopierCheckouts).set({ productId: product.productId, url: product.url }).where(eq(shopierCheckouts.id, intentId));
  const [opened] = await db.update(shopierCheckouts).set({ status: 'OPEN' })
    .where(and(eq(shopierCheckouts.id, intentId), eq(shopierCheckouts.status, 'PENDING'))).returning({ id: shopierCheckouts.id });
  if (!opened) throw new GameError('SKIN_CHECKOUT_STARTING', 'Checkout is still starting; try again shortly', 409);
  return { url: product.url, ...offer };
}

const kurus = (value: string): number | null => {
  const match = /^(\d{1,9})(?:\.(\d{1,2}))?$/.exec(value.trim());
  return match ? Number(match[1]) * 100 + Number((match[2] ?? '').padEnd(2, '0')) : null;
};

const orderId = z.string().regex(/^\d{1,20}$/);
/** Just enough of an order to queue it for the operator when the rest cannot be read. */
const sightingSchema = z.object({ id: orderId, status: z.unknown(), note: z.unknown(), currency: z.unknown(), totals: z.unknown() });
const totalOf = (totals: unknown): unknown => z.object({ total: z.unknown() }).safeParse(totals).data?.total;
const orderSchema = z.object({
  id: orderId,
  status: z.string(),
  paymentStatus: z.string(),
  currency: z.string(),
  totals: z.object({ total: z.string() }).passthrough(),
  note: z.string().nullish(),
  lineItems: z.array(z.object({ productId: z.string(), quantity: z.number().int() }).passthrough()),
}).passthrough();
type ShopierOrder = z.infer<typeof orderSchema>;
const refundSchema = z.object({ type: z.string(), status: z.string(), orderId }).passthrough();
const text = (value: unknown, max: number): string | null => typeof value === 'string' ? value.slice(0, max) : null;

interface Outcome { status: 'MATCHED' | 'UNMATCHED'; reason: string | null; itemId: ShopierItemId | null;
  accountId: string | null; checkoutId: string | null }

/** Rights for one order; replays insert nothing. Returns how many looks were new. */
async function grantOrder(tx: Tx, accountId: string, itemId: ShopierItemId, orderId: string): Promise<number> {
  let granted = 0;
  for (const cosmeticId of skinsFor(itemId)) {
    const inserted = await tx.insert(cosmeticEntitlements).values({ accountId, cosmeticId, source: 'SHOPIER',
      orderRef: `${orderId}:${cosmeticId}` }).onConflictDoNothing().returning({ id: cosmeticEntitlements.id });
    granted += inserted.length;
  }
  return granted;
}

/** Removes only this order's Shopier rights; a planet wearing a look nobody owns any more drops it. */
async function revokeOrder(tx: Tx, orderId: string): Promise<void> {
  const revoked = await tx.update(cosmeticEntitlements).set({ revokedAt: new Date() }).where(and(
    eq(cosmeticEntitlements.source, 'SHOPIER'), like(cosmeticEntitlements.orderRef, `${orderId}:%`),
    isNull(cosmeticEntitlements.revokedAt))).returning({ accountId: cosmeticEntitlements.accountId, cosmeticId: cosmeticEntitlements.cosmeticId });
  const seasons = new Set<string>();
  const owners = [...new Set(revoked.flatMap(right => right.accountId ? [right.accountId] : []))];
  for (const { accountId, cosmeticId } of revoked) {
    if (!accountId) continue;
    const [active] = await tx.select({ id: cosmeticEntitlements.id }).from(cosmeticEntitlements)
      .where(and(eq(cosmeticEntitlements.accountId, accountId), eq(cosmeticEntitlements.cosmeticId, cosmeticId),
        isNull(cosmeticEntitlements.revokedAt))).limit(1);
    if (active) continue;
    const changed = await tx.update(planets).set({ equippedSkinId: null }).where(and(
      eq(planets.equippedSkinId, cosmeticId),
      inArray(planets.controllerPlayerId, tx.select({ id: players.id }).from(players).where(eq(players.accountId, accountId))),
    )).returning({ seasonId: planets.seasonId });
    for (const row of changed) seasons.add(row.seasonId);
  }
  // A ring, ship, flag or engine is seen by everyone in the galaxy, not only on the owner's planets.
  if (owners.length > 0) {
    const commanders = await tx.select({ seasonId: players.seasonId }).from(players).where(inArray(players.accountId, owners));
    for (const row of commanders) seasons.add(row.seasonId);
  }
  for (const seasonId of seasons) await publishShard(tx, seasonId, 'world');
}

/** The product names the buyer. A paid order on one of ours delivers whatever the row's status. */
async function match(tx: Tx, order: ShopierOrder): Promise<Outcome> {
  const none = { itemId: null, accountId: null, checkoutId: null };
  const unmatched = (reason: string, known: Partial<Outcome> = {}): Outcome => ({ ...none, ...known, status: 'UNMATCHED', reason });
  if (order.paymentStatus !== 'paid') return unmatched('NOT_PAID');
  const [line, ...rest] = order.lineItems;
  if (!line || rest.length > 0 || line.quantity !== 1) return unmatched('MULTI_ITEM');
  const [checkout] = await tx.select().from(shopierCheckouts)
    .where(eq(shopierCheckouts.productId, line.productId)).for('update');
  const itemId = z.enum(shopierItemIds).safeParse(checkout?.itemId);
  if (!checkout || !itemId.success) return unmatched('UNKNOWN_PRODUCT');
  const known = { itemId: itemId.data, accountId: checkout.accountId, checkoutId: checkout.id };
  // A paid single unit spent the product's only stock: it is sold, whatever this order delivers.
  if (checkout.status !== 'PAID') {
    await tx.update(shopierCheckouts).set({ status: 'PAID', orderId: order.id, paidAt: new Date() })
      .where(eq(shopierCheckouts.id, checkout.id));
  }
  if (order.currency !== 'TRY' || kurus(order.totals.total) !== checkout.amount) return unmatched('AMOUNT_MISMATCH', known);
  if (!checkout.accountId) return unmatched('ACCOUNT_MISSING', known);
  const granted = await grantOrder(tx, checkout.accountId, itemId.data, order.id);
  return granted > 0 ? { ...known, status: 'MATCHED', reason: null } : unmatched('ALREADY_OWNED', known);
}

/**
 * First sighting of an order wins; later ones (and refunded IDs) are no-ops. An authentic order
 * whose shape this code cannot read is queued as UNREADABLE rather than lost: the buyer paid.
 * Returns the order ID when the look was delivered.
 */
async function recordOrder(tx: Tx, payload: unknown): Promise<string | null> {
  const sighting = sightingSchema.safeParse(payload);
  if (!sighting.success) return null;
  const seen = sighting.data;
  const [fresh] = await tx.insert(shopierOrders).values({ orderId: seen.id, status: 'UNMATCHED', reason: 'PROCESSING',
    note: text(seen.note, 300) ?? '', total: text(totalOf(seen.totals), 20), currency: text(seen.currency, 3) })
    .onConflictDoNothing().returning({ orderId: shopierOrders.orderId });
  if (!fresh) return null;
  const order = orderSchema.safeParse(payload);
  const outcome: Outcome = order.success ? await match(tx, order.data)
    : { status: 'UNMATCHED', reason: 'UNREADABLE', itemId: null, accountId: null, checkoutId: null };
  await tx.update(shopierOrders).set(outcome).where(eq(shopierOrders.orderId, seen.id));
  return outcome.status === 'MATCHED' ? seen.id : null;
}

async function markClosed(db: Db, env: Env, orderId: string): Promise<boolean> {
  if (!await closeShopierOrder(env, orderId)) return false;
  await db.update(shopierOrders).set({ closedAt: new Date() }).where(eq(shopierOrders.orderId, orderId));
  return true;
}

/** Called only after the signature over the raw body has been verified. */
export async function processShopierEvent(db: Db, env: Env, webhookId: string, eventType: string, payload: unknown): Promise<void> {
  const delivered = await db.transaction(async tx => {
    const [seen] = await tx.insert(shopierWebhookEvents).values({ id: webhookId.slice(0, 200), eventType: eventType.slice(0, 64) })
      .onConflictDoNothing().returning({ id: shopierWebhookEvents.id });
    if (!seen) return null;
    if (eventType === 'order.created') return recordOrder(tx, payload);
    if (eventType === 'refund.updated') {
      const refund = refundSchema.safeParse(payload);
      if (!refund.success || refund.data.status !== 'succeeded' || refund.data.type !== 'full') return null;
      const orderId = refund.data.orderId;
      const [existing] = await tx.select().from(shopierOrders).where(eq(shopierOrders.orderId, orderId)).for('update');
      if (!existing) {
        await tx.insert(shopierOrders).values({ orderId, status: 'REFUNDED', reason: 'REFUND_FIRST' }).onConflictDoNothing();
        return null;
      }
      if (existing.status === 'REFUNDED') return null;
      await revokeOrder(tx, orderId);
      await tx.update(shopierOrders).set({ status: 'REFUNDED' }).where(eq(shopierOrders.orderId, orderId));
    }
    return null;
  });
  if (delivered) await markClosed(db, env, delivered);
}

/* ── the operator's queue ─────────────────────────────── */

/** Every waiting order (bounded), then the latest decided ones: a busy day never hides a waiting buyer. */
export async function shopierQueue(db: Db) {
  const list = (waiting: boolean, limit: number) => db.select({ row: shopierOrders, username: accounts.username }).from(shopierOrders)
    .leftJoin(accounts, eq(accounts.id, shopierOrders.accountId))
    .where(waiting ? eq(shopierOrders.status, 'UNMATCHED') : ne(shopierOrders.status, 'UNMATCHED'))
    .orderBy(desc(shopierOrders.receivedAt), desc(shopierOrders.orderId)).limit(limit);
  const rows = [...await list(true, 200), ...await list(false, 50)];
  return { orders: rows.map(({ row, username }) => ({ orderId: row.orderId, status: row.status, reason: row.reason,
    itemId: row.itemId, username, note: row.note, total: row.total, currency: row.currency,
    receivedAt: row.receivedAt, closed: row.closedAt !== null })) };
}

async function lockedOrder(tx: Tx, orderId: string) {
  const [row] = await tx.select().from(shopierOrders).where(eq(shopierOrders.orderId, orderId)).for('update');
  if (!row) throw new GameError('SHOPIER_ORDER_NOT_FOUND', 'Order not found', 404);
  return row;
}

/** The operator names the commander for an order no product of ours could bind. */
export async function grantShopierOrder(db: Db, env: Env, orderId: string, username: string) {
  const accountId = await db.transaction(async tx => {
    const row = await lockedOrder(tx, orderId);
    const itemId = z.enum(shopierItemIds).safeParse(row.itemId);
    if (row.status !== 'UNMATCHED' || !itemId.success) {
      throw new GameError('SHOPIER_ORDER_NOT_GRANTABLE', 'Only a queued order of a known item can be granted', 409);
    }
    const [account] = await tx.select({ id: accounts.id }).from(accounts)
      .where(eq(accounts.username, normaliseUsername(username))).limit(1);
    if (!account) throw new GameError('ACCOUNT_NOT_FOUND', 'Account not found', 404);
    if (await grantOrder(tx, account.id, itemId.data, orderId) === 0) {
      throw new GameError('SKIN_ALREADY_OWNED', 'This account already owns this offer', 409);
    }
    await tx.update(shopierOrders).set({ status: 'RESOLVED', accountId: account.id }).where(eq(shopierOrders.orderId, orderId));
    return account.id;
  });
  const closed = await markClosed(db, env, orderId);
  return { orderId, accountId, closed };
}

/** Handled outside the game (a donation, a manual refund): close it so Shopier pays it out. */
export async function dismissShopierOrder(db: Db, env: Env, orderId: string) {
  await db.transaction(async tx => {
    const row = await lockedOrder(tx, orderId);
    if (row.status !== 'UNMATCHED') throw new GameError('SHOPIER_ORDER_NOT_QUEUED', 'Only a queued order can be dismissed', 409);
    await tx.update(shopierOrders).set({ status: 'DISMISSED' }).where(eq(shopierOrders.orderId, orderId));
  });
  return { orderId, closed: await markClosed(db, env, orderId) };
}

/** A chargeback has no Shopier event: the operator takes back what this order gave. */
export async function revokeShopierOrder(db: Db, orderId: string) {
  await db.transaction(async tx => {
    const row = await lockedOrder(tx, orderId);
    if (row.status !== 'MATCHED' && row.status !== 'RESOLVED') {
      throw new GameError('SHOPIER_ORDER_NOT_DELIVERED', 'Only a delivered order can be revoked', 409);
    }
    await revokeOrder(tx, orderId);
    await tx.update(shopierOrders).set({ status: 'REVOKED' }).where(eq(shopierOrders.orderId, orderId));
  });
  return { orderId };
}

/**
 * Pull Shopier's open orders through the same rules: a webhook lost to downtime is
 * recorded, and a delivery whose close failed is closed again. Orders the owner already
 * closed by hand are history, not work.
 */
export async function syncShopierOrders(db: Db, env: Env) {
  if (!env.SHOPIER_ACCESS_TOKEN.trim()) throw new GameError('SHOPIER_UNAVAILABLE', 'Shopier is not configured', 503);
  let remote: unknown;
  try { remote = await listShopierOrders(env); }
  catch { throw new GameError('SHOPIER_UNAVAILABLE', 'Shopier did not answer', 502); }
  const open = z.array(z.unknown()).catch([]).parse(remote).flatMap(item => {
    const sighting = sightingSchema.safeParse(item);
    return sighting.success && sighting.data.status === 'unfulfilled' ? [{ id: sighting.data.id, item }] : [];
  });
  let recorded = 0;
  let closed = 0;
  for (const { id, item } of open) {
    const [known] = await db.select().from(shopierOrders).where(eq(shopierOrders.orderId, id));
    if (!known) {
      recorded++;
      if (await db.transaction(tx => recordOrder(tx, item)) && await markClosed(db, env, id)) closed++;
    } else if (['MATCHED', 'RESOLVED', 'DISMISSED'].includes(known.status) && !known.closedAt) {
      if (await markClosed(db, env, id)) closed++;
    }
  }
  return { recorded, closed };
}

/**
 * THE CLEAN-UP ROUND, every ten minutes on the worker (index.ts). An unpaid product past its 48
 * hours expires; an open one whose look arrived another way, whose commander left or whose
 * price moved is cancelled; then every product no longer for sale is deleted from Shopier. Stage 0
 * showed deleting a paid order's product leaves the order and its payout intact. A failed delete
 * keeps `removedAt` empty and the next round tries again.
 */
export async function sweepShopierCheckouts(db: Db, env: Env, now: Date) {
  const result = { expired: 0, cancelled: 0, removed: 0 };
  if (!env.SHOPIER_ACCESS_TOKEN.trim()) return result;
  result.expired = (await db.update(shopierCheckouts).set({ status: 'EXPIRED' })
    .where(and(eq(shopierCheckouts.status, 'OPEN'), lte(shopierCheckouts.expiresAt, now)))
    .returning({ id: shopierCheckouts.id })).length;
  const open = await db.select().from(shopierCheckouts).where(eq(shopierCheckouts.status, 'OPEN'));
  const owners = [...new Set(open.flatMap(row => row.accountId ? [row.accountId] : []))];
  const rights = owners.length === 0 ? [] : await db.select({ accountId: cosmeticEntitlements.accountId, cosmeticId: cosmeticEntitlements.cosmeticId })
    .from(cosmeticEntitlements).where(and(inArray(cosmeticEntitlements.accountId, owners), isNull(cosmeticEntitlements.revokedAt)));
  const owned = new Set(rights.map(right => `${right.accountId}:${right.cosmeticId}`));
  const stale = open.filter(row => {
    const item = z.enum(shopierItemIds).safeParse(row.itemId);
    return !row.accountId || !item.success || env.SHOPIER_PRICES[item.data] !== row.amount
      || skinsFor(item.data).some(id => owned.has(`${row.accountId}:${id}`));
  });
  if (stale.length > 0) {
    result.cancelled = (await db.update(shopierCheckouts).set({ status: 'CANCELLED' }).where(and(
      inArray(shopierCheckouts.id, stale.map(row => row.id)), eq(shopierCheckouts.status, 'OPEN')))
      .returning({ id: shopierCheckouts.id })).length;
  }
  const gone = await db.select({ id: shopierCheckouts.id, productId: shopierCheckouts.productId }).from(shopierCheckouts)
    .where(and(isNotNull(shopierCheckouts.productId), isNull(shopierCheckouts.removedAt),
      notInArray(shopierCheckouts.status, ['PENDING', 'OPEN'])))
    .orderBy(asc(shopierCheckouts.createdAt)).limit(SWEEP_BATCH);
  for (const row of gone) {
    if (!row.productId || !await deleteShopierProduct(env, row.productId)) continue;
    await db.update(shopierCheckouts).set({ removedAt: now }).where(eq(shopierCheckouts.id, row.id));
    result.removed++;
  }
  return result;
}
