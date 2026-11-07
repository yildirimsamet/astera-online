import { blockAccount } from '../communityBlocks.js';
import { CHAT, type ChatLanguage } from '@astera/rules';
import { and, count, desc, eq, gt, lt, ne, notExists, sql } from 'drizzle-orm';
import { z } from 'zod';
import type { Clock } from '../../clock.js';
import type { Db, Queryable } from '../../db/client.js';
import { accounts, communityBlocks, contentReports, starterChatMessages, vessels } from '../../db/schema.js';
import { publishShard } from '../../stream/bus.js';
import { contentReportBody } from '../contentReports.js';
import { assertChatAllowed, assertCleanMessage } from '../chatModeration.js';
import { takeSecurityCounter } from '../mail.js';
import { GameError } from '../planet.js';
import { assertFeatureOpen } from './world.js';
import { refuseLeft, type VesselRow } from './vessel.js';

type Row = typeof starterChatMessages.$inferSelect;

async function shipOf(q: Queryable, accountId: string): Promise<VesselRow> {
  const [row] = await q.select().from(vessels).where(eq(vessels.accountId, accountId));
  if (!row) throw new GameError('VESSEL_NOT_FOUND', 'This account has no colony ship', 404);
  refuseLeft(row);
  assertFeatureOpen(row, 'chat');
  return row;
}

/** A blocked pair does not see each other, whichever of them did the blocking. */
const notBlocked = (accountId: string) => notExists(sqlBlocks(accountId));
const sqlBlocks = (accountId: string) => sql`(
  SELECT 1 FROM ${communityBlocks}
  WHERE (${communityBlocks.blockerAccountId} = ${accountId} AND ${communityBlocks.targetAccountId} = ${starterChatMessages.authorAccountId})
     OR (${communityBlocks.targetAccountId} = ${accountId} AND ${communityBlocks.blockerAccountId} = ${starterChatMessages.authorAccountId})
)`;

/** The main chat's own shape, with nothing of the main chat's: no reply, no reaction, no clan, no picture. */
const view = (row: Row, accountId: string) => ({
  id: row.id,
  authorPlayerId: row.authorVesselId,
  username: row.username,
  clanTag: null,
  content: row.content,
  media: null,
  language: row.language,
  createdAt: row.createdAt,
  self: row.authorAccountId === accountId,
  replyTo: null,
  reactions: [],
  admin: false,
});

const room = (row: VesselRow, language: ChatLanguage) => and(eq(starterChatMessages.starterGalaxyId, row.starterGalaxyId), eq(starterChatMessages.language, language));

export async function readStarterChat(db: Db, accountId: string, limit: number, language: ChatLanguage, before?: string) {
  const ship = await shipOf(db, accountId);
  const [cursor] = before ? await db.select({ at: starterChatMessages.createdAt }).from(starterChatMessages).where(eq(starterChatMessages.id, before)) : [];
  const rows = await db.select().from(starterChatMessages).where(and(
    room(ship, language), notBlocked(accountId),
    cursor ? lt(starterChatMessages.createdAt, cursor.at) : undefined,
  )).orderBy(desc(starterChatMessages.createdAt)).limit(limit + 1);
  const page = rows.slice(0, limit);
  return { messages: [...page].reverse().map(row => view(row, accountId)), nextBefore: rows.length > limit ? (page.at(-1)?.id ?? null) : null };
}

/** Same words refused, same mute, same flood limit as the main channel: only the room is different. */
export async function postStarterChat(db: Db, accountId: string, content: string, language: ChatLanguage, clock: Clock) {
  assertCleanMessage(content);
  const ship = await shipOf(db, accountId);
  const now = clock.now();
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`starter-chat:${ship.starterGalaxyId}`}))`);
    await assertChatAllowed(tx, accountId, 'general', clock);
    const [rate] = await tx.select({ value: count() }).from(starterChatMessages).where(and(
      eq(starterChatMessages.authorAccountId, accountId), gt(starterChatMessages.createdAt, new Date(now.getTime() - CHAT.windowSeconds * 1000)),
    ));
    if ((rate?.value ?? 0) >= CHAT.burst) throw new GameError('CHAT_RATE_LIMIT', 'Send at most five messages every ten seconds', 429, { seconds: CHAT.windowSeconds });
    const [latest] = await tx.select({ at: starterChatMessages.createdAt }).from(starterChatMessages)
      .where(eq(starterChatMessages.starterGalaxyId, ship.starterGalaxyId)).orderBy(desc(starterChatMessages.createdAt)).limit(1);
    // Two messages in one millisecond still have an order.
    const createdAt = latest && latest.at >= now ? new Date(latest.at.getTime() + 1) : now;
    const [row] = await tx.insert(starterChatMessages).values({
      starterGalaxyId: ship.starterGalaxyId, authorAccountId: accountId, authorVesselId: ship.id, username: ship.name, language, content, createdAt,
    }).returning();
    await publishShard(tx, ship.starterGalaxyId, 'chat');
    return view(row!, accountId);
  });
}

export async function unreadStarterChat(db: Db, accountId: string, language: ChatLanguage): Promise<number> {
  const [ship] = await db.select().from(vessels).where(eq(vessels.accountId, accountId));
  if (!ship || ship.status === 'DEPARTED') return 0;
  const [unread] = await db.select({ value: count() }).from(starterChatMessages).where(and(
    room(ship, language), notBlocked(accountId), ne(starterChatMessages.authorAccountId, accountId),
    ship.chatReadAt ? gt(starterChatMessages.createdAt, ship.chatReadAt) : undefined,
  ));
  return unread?.value ?? 0;
}

export async function markStarterChatRead(db: Db, accountId: string, messageId: string) {
  const ship = await shipOf(db, accountId);
  const [message] = await db.select({ at: starterChatMessages.createdAt }).from(starterChatMessages)
    .where(and(eq(starterChatMessages.id, messageId), eq(starterChatMessages.starterGalaxyId, ship.starterGalaxyId)));
  if (!message) throw new GameError('CHAT_MESSAGE_NOT_VISIBLE', 'That message is not visible', 404);
  if (!ship.chatReadAt || ship.chatReadAt < message.at) await db.update(vessels).set({ chatReadAt: message.at }).where(eq(vessels.id, ship.id));
  return message.at;
}

/** The chat names a ship where the main one names a commander: same block, on the same accounts. */
export async function blockStarterAuthor(db: Db, accountId: string, vesselId: string, clock: Clock) {
  const ship = await shipOf(db, accountId);
  if (vesselId === ship.id) throw new GameError('BLOCK_SELF', 'You cannot block yourself', 400);
  const [author] = await db.select({ accountId: vessels.accountId }).from(vessels)
    .where(and(eq(vessels.id, vesselId), eq(vessels.starterGalaxyId, ship.starterGalaxyId)));
  if (!author) throw new GameError('PLAYER_NOT_FOUND', 'Player not available', 404);
  return db.transaction(tx => blockAccount(tx, clock, accountId, author.accountId));
}

const reportOf = z.object({ kind: z.literal('message'), messageId: z.string().uuid(), reason: z.string(), details: z.string() });

/** Into the one moderation queue. The evidence comes from the row, never from what a client says it read. */
export async function reportStarterChat(db: Db, accountId: string, input: unknown, clock: Clock) {
  const body = reportOf.parse(contentReportBody.parse(input));
  const ship = await shipOf(db, accountId);
  const targetKey = `starter:${body.messageId}`;
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`content-report:${accountId}`}, 0))`);
    const receipt = (row: typeof contentReports.$inferSelect) => ({ report: { id: row.id, createdAt: row.createdAt.toISOString(), status: row.status } });
    const [existing] = await tx.select().from(contentReports).where(and(eq(contentReports.reporterAccountId, accountId), eq(contentReports.targetKey, targetKey)));
    if (existing) return receipt(existing);
    const [message] = await tx.select().from(starterChatMessages)
      .where(and(eq(starterChatMessages.id, body.messageId), eq(starterChatMessages.starterGalaxyId, ship.starterGalaxyId)));
    if (!message) throw new GameError('CHAT_MESSAGE_NOT_VISIBLE', 'Message not visible', 404);
    if (message.authorAccountId === accountId) throw new GameError('REPORT_SELF', 'You cannot report yourself', 400);
    const now = clock.now();
    if (!await takeSecurityCounter(tx, `content-report:${accountId}`, 5, 15 * 60_000, now)) throw new GameError('RATE_LIMITED', 'Try later', 429, { seconds: 900 });
    const [author] = await tx.select({ username: accounts.displayName }).from(accounts).where(eq(accounts.id, message.authorAccountId));
    const [created] = await tx.insert(contentReports).values({
      reporterAccountId: accountId, targetAccountId: message.authorAccountId, targetKey, kind: 'message', channel: 'general', messageId: message.id,
      reason: body.reason, details: body.details,
      evidence: { username: author?.username ?? message.username, playerId: message.authorVesselId, content: message.content, media: null }, createdAt: now,
    }).returning();
    return receipt(created!);
  });
}
