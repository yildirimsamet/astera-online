import { chatVisibleTo } from './communityBlocks.js';
import { randomUUID } from 'node:crypto';
import { claimChatMedia } from './chatMedia.js';
import type { ChatMedia } from '@astera/rules';
import { and, count, desc, eq, gt, gte, isNull, lt, or, sql } from 'drizzle-orm';
import { CLAN, SEASON, clanChatMessageIsValid } from '@astera/rules';
import { addMinutes, type Clock } from '../clock.js';
import type { Db, Queryable, Tx } from '../db/client.js';
import { accounts, clanMemberships, clanMessages, clans, planets, players, seasons } from '../db/schema.js';
import { publishPrivate } from '../stream/bus.js';
import { activeClanMembership, activeClanPlayerIds, lockClanPlayers } from './clanCombat.js';
import { clanActor } from './clan.js';
import { assertChatAllowed, assertCleanMessage } from './chatModeration.js';
import { GameError, lockSeason } from './planet.js';
import { messageDecorations, authorRecognition, type PodiumPlace, type ReactionView, type ReplyPreview } from './messageDecorations.js';

export interface ClanMessageView {
  id: string;
  authorPlayerId: string;
  planetId?: string;
  username: string;
  clanTag: string | null;
  content: string;
  media?: ChatMedia | null;
  createdAt: string;
  self: boolean;
  replyTo: ReplyPreview | null;
  reactions: ReactionView[];
  previousSeasonRank?: PodiumPlace;
  previousSeasonRanking?: 'HONOR' | 'DOMINION';
  supporter?: boolean;
  admin?: boolean;
}

export async function readClanChat(
  db: Db,
  accountId: string,
  input: { before?: string; limit: number; now: Date; adminClanId?: string },
  adminUsernames: ReadonlySet<string> = new Set(),
): Promise<{ messages: ClanMessageView[]; nextBefore: string | null }> {
  const actor = await clanActor(db, accountId);
  const [season] = await db.select().from(seasons).where(eq(seasons.id, actor.seasonId));
  if (!input.adminClanId) assertClanChatOpen(season, input.now);
  const membership = input.adminClanId
    ? { clanId: input.adminClanId, joinedAt: new Date(0) }
    : await activeClanMembership(db, actor.playerId);
  if (!membership) throw new GameError('NOT_IN_CLAN', 'You do not belong to a clan', 403);
  if (input.adminClanId) {
    const [clan] = await db.select({ id: clans.id }).from(clans).where(eq(clans.id, input.adminClanId)).limit(1);
    if (!clan) throw new GameError('CLAN_NOT_FOUND', 'Clan not found', 404);
  }
  let cursor: { createdAt: Date; id: string } | undefined;
  if (input.before) {
    const [found] = await db.select({ createdAt: clanMessages.createdAt, id: clanMessages.id })
      .from(clanMessages).where(and(
        eq(clanMessages.id, input.before),
        eq(clanMessages.clanId, membership.clanId),
        gte(clanMessages.createdAt, membership.joinedAt),
      ));
    if (!found) throw new GameError('BAD_CLAN_CHAT_CURSOR', 'That chat cursor is not visible', 400);
    cursor = found;
  }
  const rows = await db.select({
    id: clanMessages.id,
    authorPlayerId: clanMessages.authorPlayerId,
    planetId: planets.id,
    username: accounts.displayName,
    login: accounts.username,
    clanTag: clans.tag,
    content: clanMessages.content, media: clanMessages.media,
    replyToMessageId: clanMessages.replyToMessageId,
    createdAt: clanMessages.createdAt,
  }).from(clanMessages)
    .innerJoin(players, eq(clanMessages.authorPlayerId, players.id))
    .innerJoin(accounts, eq(players.accountId, accounts.id))
    .innerJoin(planets, and(
      eq(planets.controllerPlayerId, players.id),
      eq(planets.kind, 'CAPITAL'),
    ))
    .leftJoin(clanMemberships, and(
      eq(clanMemberships.playerId, players.id), isNull(clanMemberships.leftAt),
    ))
    .leftJoin(clans, and(eq(clans.id, clanMemberships.clanId), isNull(clans.disbandedAt)))
    .where(and(
      eq(clanMessages.clanId, membership.clanId),
      chatVisibleTo(accountId, clanMessages.authorPlayerId),
      gte(clanMessages.createdAt, membership.joinedAt),
      cursor ? or(
        lt(clanMessages.createdAt, cursor.createdAt),
        and(eq(clanMessages.createdAt, cursor.createdAt), lt(clanMessages.id, cursor.id)),
      ) : undefined,
    ))
    .orderBy(desc(clanMessages.createdAt), desc(clanMessages.id))
    .limit(input.limit + 1);
  const page = rows.slice(0, input.limit);
  const nextBefore = rows.length > input.limit ? page.at(-1)?.id ?? null : null;
  const decorations = await messageDecorations(db, 'clan', page, actor.playerId, membership.joinedAt);
  return {
    messages: [...page].reverse().map(({ replyToMessageId: _replyToMessageId, login, planetId, ...message }) => ({
      ...message,
      // Open clients still require a string. An empty ID reveals no admin world.
      planetId: !adminUsernames.has(login) || message.authorPlayerId === actor.playerId ? planetId : '',
      admin: adminUsernames.has(login),
      createdAt: message.createdAt.toISOString(),
      self: message.authorPlayerId === actor.playerId,
      ...(decorations.get(message.id) ?? { replyTo: null, reactions: [] }),
    })),
    nextBefore,
  };
}

export function assertClanChatOpen(
  season: Pick<typeof seasons.$inferSelect, 'status' | 'endsAt'> | undefined,
  now: Date,
): asserts season is Pick<typeof seasons.$inferSelect, 'status' | 'endsAt'> {
  if (season?.status === 'live') return;
  if (
    season?.status === 'frozen'
    && now <= addMinutes(season.endsAt, SEASON.afterglowMinutes)
  ) return;
  throw new GameError('SEASON_FROZEN', 'Clan chat has closed for this season', 409);
}

export async function postClanChat(
  tx: Tx,
  input: { playerId: string; content: string; clock: Clock; media?: ChatMedia; replyToMessageId?: string; adminClanId?: string },
  adminUsernames: ReadonlySet<string> = new Set(),
): Promise<ClanMessageView> {
  const now = input.clock.now();
  const content = input.content.trim();
  if (!clanChatMessageIsValid(content) && !(input.media && content.length === 0)) {
    throw new GameError('BAD_CLAN_MESSAGE', 'Write between one and 280 characters', 400);
  }
  assertCleanMessage(content);
  const actor = await clanActorForPlayer(tx, input.playerId);
  const [selectedClan] = input.adminClanId ? await tx.select({ seasonId: clans.seasonId }).from(clans)
    .where(and(eq(clans.id, input.adminClanId), isNull(clans.disbandedAt))).limit(1) : [];
  if (input.adminClanId && !selectedClan) throw new GameError('CLAN_NOT_FOUND', 'Clan not found', 404);
  const seasonId = selectedClan?.seasonId ?? actor.seasonId;
  const season = await lockSeason(tx, seasonId, false);
  assertClanChatOpen(season, now);
  await lockClanPlayers(tx, [input.playerId]);
  const membership = input.adminClanId ? { clanId: input.adminClanId, joinedAt: new Date(0) }
    : await activeClanMembership(tx, input.playerId);
  if (!membership) throw new GameError('NOT_IN_CLAN', 'You do not belong to a clan', 403);
  await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`clan-chat:${membership.clanId}`}))`);
  await assertChatAllowed(tx, actor.accountId, 'clan', input.clock);
  const [replyTo] = input.replyToMessageId ? await tx.select({
    id: clanMessages.id, content: clanMessages.content, media: clanMessages.media, username: accounts.displayName,
  }).from(clanMessages)
    .innerJoin(players, eq(players.id, clanMessages.authorPlayerId))
    .innerJoin(accounts, eq(accounts.id, players.accountId))
    .where(and(eq(clanMessages.id, input.replyToMessageId), eq(clanMessages.clanId, membership.clanId),
      chatVisibleTo(actor.accountId, clanMessages.authorPlayerId),
      gte(clanMessages.createdAt, membership.joinedAt))).limit(1) : [];
  if (input.replyToMessageId && !replyTo) throw new GameError('CLAN_MESSAGE_NOT_VISIBLE', 'That message is not visible', 404);
  const [clan] = await tx.select({ tag: clans.tag }).from(clans)
    .where(and(eq(clans.id, membership.clanId), isNull(clans.disbandedAt)));
  const [latest] = await tx.select({ createdAt: clanMessages.createdAt })
    .from(clanMessages).where(eq(clanMessages.clanId, membership.clanId))
    .orderBy(desc(clanMessages.createdAt), desc(clanMessages.id)).limit(1);
  const createdAt = latest && latest.createdAt >= now
    ? new Date(latest.createdAt.getTime() + 1)
    : now;
  const cutoff = new Date(now.getTime() - CLAN.chatWindowSeconds * 1_000);
  const [rate] = await tx.select({ value: count() }).from(clanMessages).where(and(
    eq(clanMessages.authorPlayerId, input.playerId),
    gt(clanMessages.createdAt, cutoff),
  ));
  if ((rate?.value ?? 0) >= CLAN.chatBurst) {
    throw new GameError('CLAN_CHAT_RATE_LIMIT', 'Send at most five messages every ten seconds', 429, {
      limit: CLAN.chatBurst,
      seconds: CLAN.chatWindowSeconds,
    });
  }
  const messageId = randomUUID();
  const media = await claimChatMedia(tx, actor.accountId, input.media, adminUsernames, now, 'clan', messageId);
  const [message] = await tx.insert(clanMessages).values({
    id: messageId, media,
    seasonId,
    clanId: membership.clanId,
    authorPlayerId: input.playerId,
    content,
    replyToMessageId: input.replyToMessageId ?? null,
    createdAt,
  }).returning({
    id: clanMessages.id,
    authorPlayerId: clanMessages.authorPlayerId,
    content: clanMessages.content, media: clanMessages.media,
    createdAt: clanMessages.createdAt,
  });
  if (!message) throw new Error('clan message insert returned no row');
  for (const playerId of await activeClanPlayerIds(tx, membership.clanId)) {
    await publishPrivate(tx, playerId, 'chat');
  }
  const recognition = (await authorRecognition(tx, [input.playerId])).get(input.playerId);
  return {
    ...message,
    planetId: actor.planetId,
    username: actor.displayName,
    clanTag: clan?.tag ?? null,
    createdAt: message.createdAt.toISOString(),
    self: true,
    admin: adminUsernames.has(actor.login),
    replyTo: replyTo ?? null, reactions: [],
    ...recognition,
  };
}

async function clanActorForPlayer(db: Queryable, playerId: string) {
  const [row] = await db.select({
    accountId: accounts.id,
    login: accounts.username,
    seasonId: players.seasonId,
    displayName: accounts.displayName,
    planetId: planets.id,
  }).from(players)
    .innerJoin(accounts, eq(players.accountId, accounts.id))
    .innerJoin(planets, and(
      eq(planets.controllerPlayerId, players.id),
      eq(planets.kind, 'CAPITAL'),
    ))
    .where(eq(players.id, playerId));
  if (!row) throw new GameError('NO_PLANET', 'Join a galaxy first', 404);
  return row;
}

/**
 * The cursor only moves forward, so a repeated or late mark needs no receipt and no
 * lock: one conditional update, and a mark that moves nothing writes nothing (F1.8 Q16).
 */
export async function markClanChatRead(
  db: Queryable,
  input: { playerId: string; messageId: string; now: Date },
): Promise<string> {
  const actor = await clanActorForPlayer(db, input.playerId);
  const [season] = await db.select({ status: seasons.status, endsAt: seasons.endsAt }).from(seasons)
    .where(eq(seasons.id, actor.seasonId));
  assertClanChatOpen(season, input.now);
  const membership = await activeClanMembership(db, input.playerId);
  if (!membership) throw new GameError('NOT_IN_CLAN', 'You do not belong to a clan', 403);
  const [message] = await db.select({ createdAt: clanMessages.createdAt })
    .from(clanMessages).where(and(
      eq(clanMessages.id, input.messageId),
      eq(clanMessages.clanId, membership.clanId),
      chatVisibleTo(actor.accountId, clanMessages.authorPlayerId),
      gte(clanMessages.createdAt, membership.joinedAt),
    ));
  if (!message) throw new GameError('CLAN_MESSAGE_NOT_VISIBLE', 'That message is not visible', 404);
  const current = and(
    eq(clanMemberships.playerId, input.playerId),
    eq(clanMemberships.clanId, membership.clanId),
    isNull(clanMemberships.leftAt),
  );
  const [moved] = await db.update(clanMemberships).set({ lastChatReadAt: message.createdAt })
    .where(and(current, or(isNull(clanMemberships.lastChatReadAt), lt(clanMemberships.lastChatReadAt, message.createdAt))))
    .returning({ readAt: clanMemberships.lastChatReadAt });
  const [kept] = moved ? [moved] : await db.select({ readAt: clanMemberships.lastChatReadAt })
    .from(clanMemberships).where(current);
  if (!kept?.readAt) throw new GameError('NOT_IN_CLAN', 'You no longer belong to that clan', 403);
  return kept.readAt.toISOString();
}
