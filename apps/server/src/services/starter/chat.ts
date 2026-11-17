import { blockAccount } from '../communityBlocks.js';
import { CHAT, STARTER, type ChatLanguage } from '@astera/rules';
import { and, count, desc, eq, gt, isNotNull, lt, ne, notExists, sql } from 'drizzle-orm';
import { z } from 'zod';
import type { Clock } from '../../clock.js';
import type { Db, Queryable } from '../../db/client.js';
import { accounts, communityBlocks, contentReports, starterChatMessages, starterDepartures, starterSites, vessels } from '../../db/schema.js';
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

/** How far back the galaxy's own lines reach on a page with nothing older: about one sitting and the next. */
const EVENT_WINDOW_MS = 48 * 3_600_000;
const EVENTS_A_PAGE = 20;
const OUTPOST_RESPAWN_MS = STARTER.sites.outposts.respawnMinutes * 60_000;
type GalaxyEventKind = 'GALAXY_DEPARTED' | 'GALAXY_WRECK' | 'GALAXY_OUTPOST_EMPTY';

/** A line nobody typed, in the chat's own shape: the screen draws it between the bubbles. */
const eventLine = (kind: GalaxyEventKind, id: string, at: Date, params: Record<string, string | number>, language: ChatLanguage) => ({
  id: `${kind}:${id}`, authorPlayerId: '', username: '', content: '', media: null, language, createdAt: at,
  self: false, replyTo: null, reactions: [], admin: false, event: { kind, params },
  /** Made for this read and never stored: there is nothing to mark read. */
  composed: true as const,
});

/**
 * WHAT ANYONE COULD SEE HAPPEN (plan 2026-11-06 §6, F5), between `from` and `to`: a ship left (named, as
 * the departure board names it), a battle left a debris field, an outpost was emptied. Never who fought,
 * dug or took it — the main game's Chronicle rule.
 */
async function galaxyLines(db: Db, galaxyId: string, from: Date, to: Date, language: ChatLanguage) {
  const [left, wrecks, emptied] = await Promise.all([
    db.select({ id: starterDepartures.id, name: starterDepartures.displayName, at: starterDepartures.at }).from(starterDepartures)
      .where(and(eq(starterDepartures.starterGalaxyId, galaxyId), gt(starterDepartures.at, from), lt(starterDepartures.at, to))),
    db.select({ id: starterSites.id, at: starterSites.createdAt }).from(starterSites)
      .where(and(eq(starterSites.starterGalaxyId, galaxyId), eq(starterSites.kind, 'BATTLE_WRECK'), gt(starterSites.createdAt, from), lt(starterSites.createdAt, to))),
    db.select({ id: starterSites.id, level: starterSites.level, respawnAt: starterSites.respawnAt }).from(starterSites)
      .where(and(eq(starterSites.starterGalaxyId, galaxyId), eq(starterSites.kind, 'OUTPOST'), isNotNull(starterSites.respawnAt))),
  ]);
  const lines = [
    ...left.map(row => eventLine('GALAXY_DEPARTED', row.id, row.at, { name: row.name }, language)),
    ...wrecks.map(row => eventLine('GALAXY_WRECK', row.id, row.at, {}, language)),
    ...emptied.flatMap((row) => {
      // The emptying is the respawn's start: the stand-down is fixed, so the moment is read back from it.
      const at = new Date((row.respawnAt?.getTime() ?? 0) - OUTPOST_RESPAWN_MS);
      return at > from && at < to ? [eventLine('GALAXY_OUTPOST_EMPTY', `${row.id}:${String(at.getTime())}`, at, { level: row.level }, language)] : [];
    }),
  ];
  return lines.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).slice(0, EVENTS_A_PAGE);
}

export async function readStarterChat(db: Db, accountId: string, limit: number, language: ChatLanguage, clock: Clock, before?: string) {
  const ship = await shipOf(db, accountId);
  const [cursor] = before ? await db.select({ at: starterChatMessages.createdAt }).from(starterChatMessages).where(eq(starterChatMessages.id, before)) : [];
  const rows = await db.select().from(starterChatMessages).where(and(
    room(ship, language), notBlocked(accountId),
    cursor ? lt(starterChatMessages.createdAt, cursor.at) : undefined,
  )).orderBy(desc(starterChatMessages.createdAt)).limit(limit + 1);
  const page = rows.slice(0, limit);
  const more = rows.length > limit;
  // The galaxy's lines for the span this page covers: from its oldest message when there is an older page.
  const to = cursor?.at ?? clock.now();
  const from = more ? page.at(-1)!.createdAt : new Date(to.getTime() - EVENT_WINDOW_MS);
  const lines = await galaxyLines(db, ship.starterGalaxyId, from, to, language);
  const messages = [...page.map(row => view(row, accountId)), ...lines]
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  return { messages, nextBefore: more ? (page.at(-1)?.id ?? null) : null };
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
