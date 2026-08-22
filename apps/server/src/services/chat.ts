import { and, count, desc, eq, gt, lt, ne, or, sql } from 'drizzle-orm';
import type { Clock } from '../clock.js';
import type { Db } from '../db/client.js';
import { accounts, chatMessages, planets, players } from '../db/schema.js';
import { GameError } from './planet.js';
import { publishShard } from '../stream/bus.js';

export interface ChatMessageView {
  id: string;
  authorPlayerId: string;
  planetId: string;
  username: string;
  content: string;
  createdAt: Date;
  self: boolean;
}

async function chatPlayer(db: Db, accountId: string) {
  const [row] = await db
    .select({ player: players, planetId: planets.id, username: accounts.displayName })
    .from(players)
    .innerJoin(accounts, eq(players.accountId, accounts.id))
    .innerJoin(planets, eq(planets.playerId, players.id))
    .where(eq(players.accountId, accountId))
    .limit(1);
  if (!row) throw new GameError('NO_PLANET', 'Join a galaxy first', 404);
  return row;
}

/** Newest page on the wire, chronological inside the page for direct rendering. */
export async function readChat(
  db: Db,
  accountId: string,
  limit: number,
  before?: string,
): Promise<{ messages: ChatMessageView[]; nextBefore: string | null }> {
  const me = await chatPlayer(db, accountId);
  let cursor: { createdAt: Date; id: string } | undefined;
  if (before !== undefined) {
    const [found] = await db
      .select({ createdAt: chatMessages.createdAt, id: chatMessages.id })
      .from(chatMessages)
      .where(and(eq(chatMessages.id, before), eq(chatMessages.seasonId, me.player.seasonId)))
      .limit(1);
    if (!found) throw new GameError('BAD_CHAT_CURSOR', 'That chat cursor is not visible', 400);
    cursor = found;
  }

  const rows = await db
    .select({
      id: chatMessages.id,
      authorPlayerId: chatMessages.authorPlayerId,
      planetId: planets.id,
      username: accounts.displayName,
      content: chatMessages.content,
      createdAt: chatMessages.createdAt,
    })
    .from(chatMessages)
    .innerJoin(players, eq(chatMessages.authorPlayerId, players.id))
    .innerJoin(accounts, eq(players.accountId, accounts.id))
    .innerJoin(planets, eq(planets.playerId, players.id))
    .where(and(
      eq(chatMessages.seasonId, me.player.seasonId),
      cursor
        ? or(
            lt(chatMessages.createdAt, cursor.createdAt),
            and(eq(chatMessages.createdAt, cursor.createdAt), lt(chatMessages.id, cursor.id)),
          )
        : undefined,
    ))
    .orderBy(desc(chatMessages.createdAt), desc(chatMessages.id))
    .limit(limit + 1);

  const page = rows.slice(0, limit);
  const nextBefore = rows.length > limit ? (page.at(-1)?.id ?? null) : null;
  return {
    messages: page.reverse().map((row) => ({
      ...row,
      self: row.authorPlayerId === me.player.id,
    })),
    nextBefore,
  };
}

/**
 * Five committed messages in a rolling ten-second window.
 *
 * The season lock also makes `createdAt` strictly monotonic inside one chat. The
 * durable read marker is an instant, so allowing two authors to share that instant
 * would make marking one visible message accidentally mark its timestamp twin.
 */
export async function postChat(
  db: Db,
  accountId: string,
  content: string,
  clock: Clock,
): Promise<ChatMessageView> {
  const me = await chatPlayer(db, accountId);
  const requestedAt = clock.now();
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`chat:${me.player.seasonId}`}))`);
    const [latest] = await tx
      .select({ createdAt: chatMessages.createdAt })
      .from(chatMessages)
      .where(eq(chatMessages.seasonId, me.player.seasonId))
      .orderBy(desc(chatMessages.createdAt), desc(chatMessages.id))
      .limit(1);
    const createdAt = latest && latest.createdAt >= requestedAt
      ? new Date(latest.createdAt.getTime() + 1)
      : requestedAt;
    const cutoff = new Date(requestedAt.getTime() - 10_000);
    const [rate] = await tx
      .select({ value: count() })
      .from(chatMessages)
      .where(and(
        eq(chatMessages.authorPlayerId, me.player.id),
        gt(chatMessages.createdAt, cutoff),
      ));
    if ((rate?.value ?? 0) >= 5) {
      throw new GameError('CHAT_RATE_LIMIT', 'Send at most five messages every ten seconds', 429, {
        seconds: 10,
      });
    }

    const [message] = await tx
      .insert(chatMessages)
      .values({
        seasonId: me.player.seasonId,
        authorPlayerId: me.player.id,
        content,
        createdAt,
      })
      .returning({
        id: chatMessages.id,
        authorPlayerId: chatMessages.authorPlayerId,
        content: chatMessages.content,
        createdAt: chatMessages.createdAt,
      });
    if (!message) throw new Error('chat insert returned no row');

    await publishShard(tx, me.player.seasonId, 'chat');
    return { ...message, planetId: me.planetId, username: me.username, self: true };
  });
}

export async function unreadChat(db: Db, accountId: string): Promise<number> {
  const me = await chatPlayer(db, accountId);
  const [row] = await db
    .select({ value: count() })
    .from(chatMessages)
    .where(and(
      eq(chatMessages.seasonId, me.player.seasonId),
      ne(chatMessages.authorPlayerId, me.player.id),
      me.player.lastChatReadAt ? gt(chatMessages.createdAt, me.player.lastChatReadAt) : undefined,
    ));
  return row?.value ?? 0;
}

export async function markChatRead(
  db: Db,
  accountId: string,
  messageId: string,
): Promise<Date> {
  const me = await chatPlayer(db, accountId);
  return db.transaction(async (tx) => {
    const [message] = await tx
      .select({ createdAt: chatMessages.createdAt })
      .from(chatMessages)
      .where(and(
        eq(chatMessages.id, messageId),
        eq(chatMessages.seasonId, me.player.seasonId),
      ))
      .limit(1);
    if (!message) throw new GameError('CHAT_MESSAGE_NOT_VISIBLE', 'That message is not visible', 404);

    const [locked] = await tx
      .select({ readAt: players.lastChatReadAt })
      .from(players)
      .where(eq(players.id, me.player.id))
      .for('update');
    if (!locked) throw new GameError('NO_PLANET', 'Join a galaxy first', 404);
    const readAt = locked.readAt && locked.readAt > message.createdAt
      ? locked.readAt
      : message.createdAt;
    await tx.update(players).set({ lastChatReadAt: readAt }).where(eq(players.id, me.player.id));
    return readAt;
  });
}
