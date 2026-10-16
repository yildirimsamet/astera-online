import { randomInt } from 'node:crypto';
import { and, desc, eq, inArray, isNull, like, ne } from 'drizzle-orm';
import { z } from 'zod';
import { COSMETIC_IDS, type CosmeticId } from '@astera/rules';
import { normaliseUsername } from '../auth/credentials.js';
import type { Db, Tx } from '../db/client.js';
import { accounts, cosmeticEntitlements, planets, players, shopierOrders, shopierPurchaseCodes,
  shopierWebhookEvents } from '../db/schema.js';
import type { Env } from '../env.js';
import { publishShard } from '../stream/bus.js';
import { GameError } from './planet.js';
import { closeShopierOrder, listShopierOrders, shopierProductUrl, shopierReady } from './shopier.js';

export const shopierItemIds = [...COSMETIC_IDS, 'bundle'] as const;
type ShopierItemId = (typeof shopierItemIds)[number];
const elementalIds = ['planet-lava', 'planet-ice', 'planet-toxic', 'planet-desert'] as const;
const skinsFor = (itemId: ShopierItemId): readonly CosmeticId[] => itemId === 'bundle' ? elementalIds : [itemId];

/** No 0/O, 1/I/L or U: a code read aloud or retyped from a phone survives. */
const CODE_ALPHABET = '23456789ABCDEFGHJKMNPQRSTVWXYZ';
const CODE_PATTERN = /AST[\s\-_:.]*([2-9A-HJKMNP-TV-Z]{6})(?![0-9A-Z])/g;
const newCode = (): string => `AST-${Array.from({ length: 6 }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join('')}`;
/** Phone keyboards and copy menus slip invisible marks into pasted text; they are not the buyer's. */
const INVISIBLE = /[\u00AD\u200B-\u200D\u2060\uFEFF]/g;
export const codesInNote = (note: string): string[] =>
  [...note.replace(INVISIBLE, '').toUpperCase().matchAll(CODE_PATTERN)].map(match => `AST-${match[1]!}`);

/** Prices the store may show beside a Shopier press, in kuruş. Nothing while closed. */
export function shopierShop(env: Env) {
  if (!shopierReady(env)) return { enabled: false, prices: {} };
  return { enabled: true, prices: Object.fromEntries(Object.entries(env.SHOPIER_PRODUCTS).map(([id, item]) => [id, item.tryAmount])) };
}

/** The open code for this commander and item, created once. The code is never a payment. */
export async function issueShopierCode(db: Db, env: Env, accountId: string, itemId: ShopierItemId) {
  if (!shopierReady(env)) throw new GameError('SKIN_SHOP_CLOSED', 'Skin sales are not available yet', 503);
  const product = env.SHOPIER_PRODUCTS[itemId];
  if (!product) throw new GameError('SHOPIER_PRODUCT_MISSING', 'This item is not sold on Shopier', 404);
  const offer = { url: shopierProductUrl(product.productId), amount: product.tryAmount, currency: 'TRY' as const };
  return db.transaction(async tx => {
    const [account] = await tx.select({ id: accounts.id }).from(accounts)
      .where(eq(accounts.id, accountId)).for('update').limit(1);
    if (!account) throw new GameError('ACCOUNT_NOT_FOUND', 'Account not found', 404);
    const [owned] = await tx.select({ id: cosmeticEntitlements.id }).from(cosmeticEntitlements)
      .where(and(eq(cosmeticEntitlements.accountId, accountId),
        inArray(cosmeticEntitlements.cosmeticId, skinsFor(itemId)), isNull(cosmeticEntitlements.revokedAt))).limit(1);
    if (owned) throw new GameError('SKIN_ALREADY_OWNED', 'This account already owns part of this offer', 409);
    const [open] = await tx.select({ code: shopierPurchaseCodes.code }).from(shopierPurchaseCodes)
      .where(and(eq(shopierPurchaseCodes.accountId, accountId), eq(shopierPurchaseCodes.itemId, itemId),
        eq(shopierPurchaseCodes.status, 'OPEN'))).limit(1);
    if (open) return { code: open.code, ...offer };
    // 30^6 codes: a collision is a retry, not an error.
    for (let attempt = 0; attempt < 5; attempt++) {
      const [created] = await tx.insert(shopierPurchaseCodes).values({ accountId, itemId, code: newCode() })
        .onConflictDoNothing().returning({ code: shopierPurchaseCodes.code });
      if (created) return { code: created.code, ...offer };
    }
    throw new GameError('SHOPIER_CODE_UNAVAILABLE', 'Try again shortly', 503);
  });
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
  accountId: string | null; code: string | null }

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

async function match(tx: Tx, env: Env, order: ShopierOrder): Promise<Outcome> {
  const none = { itemId: null, accountId: null, code: null };
  const unmatched = (reason: string, known: Partial<Outcome> = {}): Outcome => ({ ...none, ...known, status: 'UNMATCHED', reason });
  if (order.paymentStatus !== 'paid') return unmatched('NOT_PAID');
  const [line, ...rest] = order.lineItems;
  if (!line || rest.length > 0 || line.quantity !== 1) return unmatched('MULTI_ITEM');
  const entry = Object.entries(env.SHOPIER_PRODUCTS).find(([, product]) => product.productId === line.productId);
  const itemId = z.enum(shopierItemIds).safeParse(entry?.[0]);
  if (!entry || !itemId.success) return unmatched('UNKNOWN_PRODUCT');
  const known = { itemId: itemId.data };
  if (order.currency !== 'TRY' || kurus(order.totals.total) !== entry[1].tryAmount) return unmatched('AMOUNT_MISMATCH', known);
  const written = codesInNote(order.note ?? '');
  if (written.length === 0) return unmatched('NO_CODE', known);
  const candidates = await tx.select().from(shopierPurchaseCodes)
    .where(inArray(shopierPurchaseCodes.code, written)).for('update');
  const usable = candidates.find(row => row.status === 'OPEN' && row.itemId === itemId.data);
  if (!usable) {
    // Show the operator the code that concerns the paid item, when the note holds one.
    const shown = candidates.find(row => row.itemId === itemId.data) ?? candidates[0];
    const reason = !shown ? 'CODE_UNKNOWN' : shown.itemId === itemId.data ? 'CODE_USED' : 'CODE_ITEM_MISMATCH';
    return unmatched(reason, { ...known, accountId: shown?.accountId ?? null, code: shown?.code ?? written[0]! });
  }
  const bound = { ...known, code: usable.code, accountId: usable.accountId };
  if (!usable.accountId) return unmatched('ACCOUNT_MISSING', bound);
  const granted = await grantOrder(tx, usable.accountId, itemId.data, order.id);
  await tx.update(shopierPurchaseCodes).set({ status: 'USED', orderId: order.id, usedAt: new Date() })
    .where(eq(shopierPurchaseCodes.id, usable.id));
  return granted > 0 ? { ...bound, status: 'MATCHED', reason: null } : unmatched('ALREADY_OWNED', bound);
}

/**
 * First sighting of an order wins; later ones (and refunded IDs) are no-ops. An authentic order
 * whose shape this code cannot read is queued as UNREADABLE rather than lost: the buyer paid.
 * Returns the order ID when the look was delivered.
 */
async function recordOrder(tx: Tx, env: Env, payload: unknown): Promise<string | null> {
  const sighting = sightingSchema.safeParse(payload);
  if (!sighting.success) return null;
  const seen = sighting.data;
  const [fresh] = await tx.insert(shopierOrders).values({ orderId: seen.id, status: 'UNMATCHED', reason: 'PROCESSING',
    note: text(seen.note, 300) ?? '', total: text(totalOf(seen.totals), 20), currency: text(seen.currency, 3) })
    .onConflictDoNothing().returning({ orderId: shopierOrders.orderId });
  if (!fresh) return null;
  const order = orderSchema.safeParse(payload);
  const outcome: Outcome = order.success ? await match(tx, env, order.data)
    : { status: 'UNMATCHED', reason: 'UNREADABLE', itemId: null, accountId: null, code: null };
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
    if (eventType === 'order.created') return recordOrder(tx, env, payload);
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
    itemId: row.itemId, username, code: row.code, note: row.note, total: row.total, currency: row.currency,
    receivedAt: row.receivedAt, closed: row.closedAt !== null })) };
}

async function lockedOrder(tx: Tx, orderId: string) {
  const [row] = await tx.select().from(shopierOrders).where(eq(shopierOrders.orderId, orderId)).for('update');
  if (!row) throw new GameError('SHOPIER_ORDER_NOT_FOUND', 'Order not found', 404);
  return row;
}

/** The operator names the commander for an order the code could not bind. */
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
      if (await db.transaction(tx => recordOrder(tx, env, item)) && await markClosed(db, env, id)) closed++;
    } else if (['MATCHED', 'RESOLVED', 'DISMISSED'].includes(known.status) && !known.closedAt) {
      if (await markClosed(db, env, id)) closed++;
    }
  }
  return { recorded, closed };
}
