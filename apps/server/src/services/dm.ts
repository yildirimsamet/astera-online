import { and, asc, desc, eq, inArray, isNull, or, sql } from 'drizzle-orm';
import { CHAT } from '@astera/rules';
import type { Clock } from '../clock.js';
import type { Db, Queryable, Tx } from '../db/client.js';
import {
  accounts, botProfiles, dmBlocks, dmConversations, dmMessages, dmReadMarkers,
  players, seasons, shards,
} from '../db/schema.js';
import { CHANNEL, publish } from '../stream/bus.js';
import { GameError } from './planet.js';
import { messageDecorations } from './messageDecorations.js';

interface Commander {
  id: string;
  accountId: string;
  seasonId: string;
  username: string;
  country: string;
  role: 'MAIN' | 'WAITING';
  seasonStatus: string;
}

async function commander(db: Queryable, accountId: string): Promise<Commander> {
  const [row] = await db.select({
    id: players.id, accountId: players.accountId, seasonId: players.seasonId,
    username: accounts.displayName, country: accounts.countryCode,
    role: shards.role, seasonStatus: seasons.status,
  }).from(players)
    .innerJoin(accounts, eq(accounts.id, players.accountId))
    .innerJoin(seasons, eq(seasons.id, players.seasonId))
    .innerJoin(shards, eq(shards.id, seasons.shardId))
    .where(eq(players.accountId, accountId)).limit(1);
  if (!row) throw new GameError('NO_PLANET', 'Join a galaxy first', 404);
  return row;
}

async function participant(db: Queryable, accountId: string, conversationId: string) {
  const me = await commander(db, accountId);
  const [conversation] = await db.select().from(dmConversations).where(and(
    eq(dmConversations.id, conversationId),
    or(eq(dmConversations.playerLowId, me.id), eq(dmConversations.playerHighId, me.id)),
  )).limit(1);
  if (!conversation) throw new GameError('DM_NOT_FOUND', 'Conversation not found', 404);
  return { me, conversation };
}

export async function lockDmPair(tx: Tx, a: string, b: string): Promise<void> {
  const [low, high] = a < b ? [a, b] : [b, a];
  await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`dm:${low}:${high}`}))`);
}

async function isBlocked(db: Queryable, a: string, b: string): Promise<boolean> {
  const [row] = await db.select({ blocker: dmBlocks.blockerPlayerId }).from(dmBlocks).where(or(
    and(eq(dmBlocks.blockerPlayerId, a), eq(dmBlocks.targetPlayerId, b)),
    and(eq(dmBlocks.blockerPlayerId, b), eq(dmBlocks.targetPlayerId, a)),
  )).limit(1);
  return row !== undefined;
}

export async function dmContacts(db: Db, accountId: string, query: string) {
  const me = await commander(db, accountId);
  if (me.role !== 'MAIN' || me.seasonStatus !== 'live') return { contacts: [] };
  const pattern = `%${query.replaceAll('\\', '\\\\').replaceAll('%', '\\%').replaceAll('_', '\\_')}%`;
  const contacts = await db.select({
    playerId: players.id, username: accounts.displayName, country: accounts.countryCode,
  }).from(players)
    .innerJoin(accounts, eq(accounts.id, players.accountId))
    .leftJoin(botProfiles, eq(botProfiles.accountId, accounts.id))
    .where(and(
      eq(players.seasonId, me.seasonId), isNull(botProfiles.accountId),
      sql`${players.id} <> ${me.id}`,
      sql`${accounts.displayName} ILIKE ${pattern} ESCAPE '\\'`,
      sql`NOT EXISTS (
        SELECT 1 FROM dm_blocks b
        WHERE (b.blocker_player_id = ${me.id} AND b.target_player_id = ${players.id})
           OR (b.blocker_player_id = ${players.id} AND b.target_player_id = ${me.id})
      )`,
    ))
    .orderBy(asc(accounts.displayName))
    .limit(30);
  return { contacts };
}

interface ConversationRow extends Record<string, unknown> {
  id: string;
  conversationSeasonId: string;
  peerId: string;
  username: string;
  country: string;
  peerSeasonId: string;
  blockedByMe: boolean;
  blockedByPeer: boolean;
  unreadCount: number;
  lastId: string;
  lastContent: string;
  lastCreatedAt: Date;
}

export async function dmConversationsFor(db: Db, accountId: string) {
  const me = await commander(db, accountId);
  const rows = await db.execute<ConversationRow>(sql`
    SELECT c.id, c.season_id AS "conversationSeasonId",
           peer.id AS "peerId", a.display_name AS username, a.country_code AS country,
           peer.season_id AS "peerSeasonId",
           (mine.blocker_player_id IS NOT NULL) AS "blockedByMe",
           (theirs.blocker_player_id IS NOT NULL) AS "blockedByPeer",
           (SELECT count(*)::int FROM dm_messages m
             WHERE m.conversation_id = c.id AND m.author_player_id <> ${me.id}
               AND (r.read_at IS NULL OR m.created_at > r.read_at)) AS "unreadCount",
           last.id AS "lastId", last.content AS "lastContent", last.created_at AS "lastCreatedAt"
      FROM dm_conversations c
      JOIN players peer ON peer.id = CASE WHEN c.player_low_id = ${me.id}
                                         THEN c.player_high_id ELSE c.player_low_id END
      JOIN accounts a ON a.id = peer.account_id
      LEFT JOIN dm_read_markers r ON r.conversation_id = c.id AND r.player_id = ${me.id}
      LEFT JOIN dm_blocks mine ON mine.blocker_player_id = ${me.id} AND mine.target_player_id = peer.id
      LEFT JOIN dm_blocks theirs ON theirs.blocker_player_id = peer.id AND theirs.target_player_id = ${me.id}
      JOIN LATERAL (
        SELECT m.id, m.content, m.created_at FROM dm_messages m
         WHERE m.conversation_id = c.id ORDER BY m.created_at DESC, m.id DESC LIMIT 1
      ) last ON true
     WHERE c.player_low_id = ${me.id} OR c.player_high_id = ${me.id}
     ORDER BY last.created_at DESC, last.id DESC
  `);
  const conversations = rows.map((row) => {
    const unavailableReason = me.seasonStatus !== 'live' ? 'SEASON_ENDED' as const
      : me.seasonId !== row.conversationSeasonId
        || row.peerSeasonId !== row.conversationSeasonId || me.role !== 'MAIN'
        ? 'WAITING' as const
      : row.blockedByMe || row.blockedByPeer ? 'BLOCKED' as const : null;
    return {
      id: row.id,
      peer: { playerId: row.peerId, username: row.username, country: row.country },
      lastMessage: { id: row.lastId, content: row.lastContent, createdAt: row.lastCreatedAt },
      unreadCount: row.unreadCount,
      blockedByMe: row.blockedByMe,
      canSend: unavailableReason === null,
      unavailableReason,
    };
  });
  return { conversations, totalUnread: conversations.reduce((total, row) => total + row.unreadCount, 0) };
}

export async function dmUnread(db: Db, accountId: string): Promise<number> {
  const me = await commander(db, accountId);
  const [row] = await db.execute<{ count: number }>(sql`
    SELECT count(*)::int AS count
      FROM dm_conversations c
      JOIN dm_messages m ON m.conversation_id = c.id AND m.author_player_id <> ${me.id}
      LEFT JOIN dm_read_markers r ON r.conversation_id = c.id AND r.player_id = ${me.id}
     WHERE (c.player_low_id = ${me.id} OR c.player_high_id = ${me.id})
       AND (r.read_at IS NULL OR m.created_at > r.read_at)
  `);
  return row?.count ?? 0;
}

export async function dmPage(db: Db, accountId: string, conversationId: string, limit: number, before?: string) {
  const { me, conversation } = await participant(db, accountId, conversationId);
  let cursor: { createdAt: Date; id: string } | undefined;
  if (before) {
    const [found] = await db.select({ createdAt: dmMessages.createdAt, id: dmMessages.id })
      .from(dmMessages).where(and(eq(dmMessages.id, before), eq(dmMessages.conversationId, conversationId))).limit(1);
    if (!found) throw new GameError('BAD_DM_CURSOR', 'Conversation cursor not found', 400);
    cursor = found;
  }
  const rows = await db.select({
    id: dmMessages.id, authorPlayerId: dmMessages.authorPlayerId,
    username: accounts.displayName, content: dmMessages.content,
    replyToMessageId: dmMessages.replyToMessageId, createdAt: dmMessages.createdAt,
  }).from(dmMessages)
    .innerJoin(players, eq(players.id, dmMessages.authorPlayerId))
    .innerJoin(accounts, eq(accounts.id, players.accountId))
    .where(and(
      eq(dmMessages.conversationId, conversationId),
      cursor ? or(
        sql`${dmMessages.createdAt} < ${cursor.createdAt}`,
        and(eq(dmMessages.createdAt, cursor.createdAt), sql`${dmMessages.id} < ${cursor.id}`),
      ) : undefined,
    ))
    .orderBy(desc(dmMessages.createdAt), desc(dmMessages.id)).limit(limit + 1);
  const page = rows.slice(0, limit);
  const decorations = await messageDecorations(db, 'dm', page, me.id);
  const peerId = conversation.playerLowId === me.id ? conversation.playerHighId : conversation.playerLowId;
  const [peer] = await db.select({ seasonId: players.seasonId }).from(players).where(eq(players.id, peerId)).limit(1);
  const blocked = await isBlocked(db, me.id, peerId);
  const unavailableReason = me.seasonStatus !== 'live' ? 'SEASON_ENDED' as const
    : me.seasonId !== conversation.seasonId || peer?.seasonId !== conversation.seasonId || me.role !== 'MAIN'
      ? 'WAITING' as const : blocked ? 'BLOCKED' as const : null;
  return {
    messages: page.reverse().map(({ replyToMessageId: _replyToMessageId, ...row }) => ({
      ...row, self: row.authorPlayerId === me.id,
      ...(decorations.get(row.id) ?? { replyTo: null, reactions: [] }),
    })),
    nextBefore: rows.length > limit ? (page.at(-1)?.id ?? null) : null,
    canSend: unavailableReason === null,
    unavailableReason,
  };
}

export async function postDm(db: Db, accountId: string, recipientPlayerId: string, content: string, clock: Clock, replyToMessageId?: string) {
  const requestedAt = clock.now();
  return db.transaction(async (tx) => {
    const me = await commander(tx, accountId);
    if (me.id === recipientPlayerId) throw new GameError('DM_SELF', 'Cannot message yourself', 400);
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`dm-rate:${me.id}`}))`);
    const pair = [me.id, recipientPlayerId].sort();
    const locked = await tx.select({ id: players.id, seasonId: players.seasonId, accountId: players.accountId })
      .from(players).where(inArray(players.id, pair)).orderBy(asc(players.id)).for('update');
    const recipient = locked.find((row) => row.id === recipientPlayerId);
    if (!recipient) throw new GameError('DM_RECIPIENT_NOT_FOUND', 'Commander not found', 404);
    const [bot] = await tx.select({ accountId: botProfiles.accountId }).from(botProfiles)
      .where(eq(botProfiles.accountId, recipient.accountId)).limit(1);
    if (bot) throw new GameError('DM_RECIPIENT_NOT_FOUND', 'Commander not found', 404);
    if (me.role !== 'MAIN' || me.seasonStatus !== 'live' || recipient.seasonId !== me.seasonId) {
      throw new GameError('DM_UNAVAILABLE', 'Both commanders must be in the same live galaxy', 409);
    }
    await lockDmPair(tx, me.id, recipientPlayerId);
    if (await isBlocked(tx, me.id, recipientPlayerId)) {
      throw new GameError('DM_BLOCKED', 'This conversation cannot receive messages', 403);
    }
    const cutoff = new Date(requestedAt.getTime() - CHAT.windowSeconds * 1000);
    const [rate] = await tx.execute<{ count: number }>(sql`
      SELECT count(*)::int AS count FROM dm_messages
       WHERE author_player_id = ${me.id} AND created_at > ${cutoff.toISOString()}::timestamptz
    `);
    if ((rate?.count ?? 0) >= CHAT.burst) {
      throw new GameError('CHAT_RATE_LIMIT', 'Slow down before sending another message', 429, { seconds: CHAT.windowSeconds });
    }
    const [inserted] = await tx.insert(dmConversations).values({
      seasonId: me.seasonId, playerLowId: pair[0]!, playerHighId: pair[1]!,
    }).onConflictDoNothing().returning({ id: dmConversations.id });
    const [existing] = inserted ? [] : await tx.select({ id: dmConversations.id }).from(dmConversations).where(and(
      eq(dmConversations.seasonId, me.seasonId), eq(dmConversations.playerLowId, pair[0]!), eq(dmConversations.playerHighId, pair[1]!),
    )).limit(1);
    const conversationId = inserted?.id ?? existing?.id;
    if (!conversationId) throw new Error('DM conversation insert returned no row');
    const [replyTo] = replyToMessageId ? await tx.select({
      id: dmMessages.id, content: dmMessages.content, username: accounts.displayName,
    }).from(dmMessages)
      .innerJoin(players, eq(players.id, dmMessages.authorPlayerId))
      .innerJoin(accounts, eq(accounts.id, players.accountId))
      .where(and(eq(dmMessages.id, replyToMessageId), eq(dmMessages.conversationId, conversationId))).limit(1) : [];
    if (replyToMessageId && !replyTo) throw new GameError('DM_MESSAGE_NOT_FOUND', 'Message not found', 404);
    const [latest] = await tx.select({ createdAt: dmMessages.createdAt }).from(dmMessages)
      .where(eq(dmMessages.conversationId, conversationId))
      .orderBy(desc(dmMessages.createdAt), desc(dmMessages.id)).limit(1);
    const createdAt = latest && latest.createdAt >= requestedAt
      ? new Date(latest.createdAt.getTime() + 1) : requestedAt;
    const [message] = await tx.insert(dmMessages).values({
      conversationId, authorPlayerId: me.id, content, replyToMessageId: replyToMessageId ?? null, createdAt,
    }).returning({ id: dmMessages.id, authorPlayerId: dmMessages.authorPlayerId,
      content: dmMessages.content, createdAt: dmMessages.createdAt });
    if (!message) throw new Error('DM insert returned no row');
    await publish(tx, me.id, 'private:dm');
    await publish(tx, recipientPlayerId, 'private:dm');
    return { conversationId, message: { ...message, username: me.username, self: true,
      replyTo: replyTo ?? null, reactions: [] } };
  });
}

export async function markDmRead(db: Db, accountId: string, conversationId: string, messageId: string) {
  return db.transaction(async (tx) => {
    const { me } = await participant(tx, accountId, conversationId);
    const [message] = await tx.select({ createdAt: dmMessages.createdAt }).from(dmMessages)
      .where(and(eq(dmMessages.id, messageId), eq(dmMessages.conversationId, conversationId))).limit(1);
    if (!message) throw new GameError('DM_MESSAGE_NOT_FOUND', 'Message not found', 404);
    await tx.select({ id: players.id }).from(players).where(eq(players.id, me.id)).for('update');
    const [marker] = await tx.select({ readAt: dmReadMarkers.readAt }).from(dmReadMarkers).where(and(
      eq(dmReadMarkers.conversationId, conversationId), eq(dmReadMarkers.playerId, me.id),
    )).limit(1);
    const readAt = marker?.readAt && marker.readAt > message.createdAt ? marker.readAt : message.createdAt;
    await tx.insert(dmReadMarkers).values({ conversationId, playerId: me.id, readAt })
      .onConflictDoUpdate({ target: [dmReadMarkers.conversationId, dmReadMarkers.playerId], set: { readAt } });
    return { readAt };
  });
}

export async function setDmBlock(db: Db, accountId: string, targetPlayerId: string, blocked: boolean, clock: Clock) {
  return db.transaction(async (tx) => {
    const me = await commander(tx, accountId);
    if (me.id === targetPlayerId) throw new GameError('DM_SELF', 'Cannot block yourself', 400);
    const [target] = await tx.select({ id: players.id, seasonId: players.seasonId })
      .from(players).where(eq(players.id, targetPlayerId)).limit(1);
    if (!target) throw new GameError('DM_RECIPIENT_NOT_FOUND', 'Commander not found', 404);
    const [existing] = await tx.select({ id: dmConversations.id }).from(dmConversations).where(or(
      and(eq(dmConversations.playerLowId, me.id), eq(dmConversations.playerHighId, targetPlayerId)),
      and(eq(dmConversations.playerHighId, me.id), eq(dmConversations.playerLowId, targetPlayerId)),
    )).limit(1);
    if (target.seasonId !== me.seasonId && !existing) throw new GameError('DM_RECIPIENT_NOT_FOUND', 'Commander not found', 404);
    await lockDmPair(tx, me.id, targetPlayerId);
    if (blocked) {
      await tx.insert(dmBlocks).values({ blockerPlayerId: me.id, targetPlayerId, createdAt: clock.now() }).onConflictDoNothing();
    } else {
      await tx.delete(dmBlocks).where(and(eq(dmBlocks.blockerPlayerId, me.id), eq(dmBlocks.targetPlayerId, targetPlayerId)));
    }
    await publish(tx, me.id, 'private:dm');
    await publish(tx, targetPlayerId, 'private:dm');
    return { blocked };
  });
}

/** A transfer changes every peer's send permission; fan out only to actual DM peers. */
export async function notifyDmPeers(tx: Tx, playerId: string): Promise<void> {
  await tx.execute(sql`
    SELECT pg_notify(${CHANNEL}, json_build_object(
      'playerId', CASE WHEN player_low_id = ${playerId} THEN player_high_id ELSE player_low_id END,
      'kind', 'private:dm'
    )::text)
      FROM dm_conversations
     WHERE player_low_id = ${playerId} OR player_high_id = ${playerId}
  `);
  await publish(tx, playerId, 'private:dm');
}
