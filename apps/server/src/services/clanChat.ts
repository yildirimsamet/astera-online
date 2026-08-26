import { and, count, desc, eq, gt, gte, lt, or, sql } from 'drizzle-orm';
import { CLAN, SEASON, clanChatMessageIsValid } from '@astera/rules';
import { addMinutes } from '../clock.js';
import type { Db, Tx } from '../db/client.js';
import { accounts, clanMemberships, clanMessages, planets, players, seasons } from '../db/schema.js';
import { publishPrivate } from '../stream/bus.js';
import { activeClanMembership, activeClanPlayerIds, lockClanPlayers } from './clanCombat.js';
import { clanActor } from './clan.js';
import { GameError, lockSeason } from './planet.js';

export interface ClanMessageView {
  id: string;
  authorPlayerId: string;
  planetId: string;
  username: string;
  content: string;
  createdAt: string;
  self: boolean;
}

export async function readClanChat(
  db: Db,
  accountId: string,
  input: { before?: string; limit: number; now: Date },
): Promise<{ messages: ClanMessageView[]; nextBefore: string | null }> {
  const actor = await clanActor(db, accountId);
  const [season] = await db.select().from(seasons).where(eq(seasons.id, actor.seasonId));
  assertClanChatOpen(season, input.now);
  const membership = await activeClanMembership(db, actor.playerId);
  if (!membership) throw new GameError('NOT_IN_CLAN', 'You do not belong to a clan', 403);
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
    content: clanMessages.content,
    createdAt: clanMessages.createdAt,
  }).from(clanMessages)
    .innerJoin(players, eq(clanMessages.authorPlayerId, players.id))
    .innerJoin(accounts, eq(players.accountId, accounts.id))
    .innerJoin(planets, and(
      eq(planets.controllerPlayerId, players.id),
      eq(planets.kind, 'CAPITAL'),
    ))
    .where(and(
      eq(clanMessages.clanId, membership.clanId),
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
  return {
    messages: [...page].reverse().map((message) => ({
      ...message,
      createdAt: message.createdAt.toISOString(),
      self: message.authorPlayerId === actor.playerId,
    })),
    nextBefore,
  };
}

function assertClanChatOpen(
  season: typeof seasons.$inferSelect | undefined,
  now: Date,
): asserts season is typeof seasons.$inferSelect {
  if (season?.status === 'live') return;
  if (
    season?.status === 'frozen'
    && now <= addMinutes(season.endsAt, SEASON.afterglowMinutes)
  ) return;
  throw new GameError('SEASON_FROZEN', 'Clan chat has closed for this season', 409);
}

export async function postClanChat(
  tx: Tx,
  input: { playerId: string; content: string; now: Date },
): Promise<ClanMessageView> {
  const content = input.content.trim();
  if (!clanChatMessageIsValid(content)) {
    throw new GameError('BAD_CLAN_MESSAGE', 'Write between one and 280 characters', 400);
  }
  const actor = await clanActorForPlayer(tx, input.playerId);
  const season = await lockSeason(tx, actor.seasonId, false);
  assertClanChatOpen(season, input.now);
  await lockClanPlayers(tx, [input.playerId]);
  const membership = await activeClanMembership(tx, input.playerId);
  if (!membership) throw new GameError('NOT_IN_CLAN', 'You do not belong to a clan', 403);
  await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`clan-chat:${membership.clanId}`}))`);
  const [latest] = await tx.select({ createdAt: clanMessages.createdAt })
    .from(clanMessages).where(eq(clanMessages.clanId, membership.clanId))
    .orderBy(desc(clanMessages.createdAt), desc(clanMessages.id)).limit(1);
  const createdAt = latest && latest.createdAt >= input.now
    ? new Date(latest.createdAt.getTime() + 1)
    : input.now;
  const cutoff = new Date(input.now.getTime() - CLAN.chatWindowSeconds * 1_000);
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
  const [message] = await tx.insert(clanMessages).values({
    seasonId: actor.seasonId,
    clanId: membership.clanId,
    authorPlayerId: input.playerId,
    content,
    createdAt,
  }).returning({
    id: clanMessages.id,
    authorPlayerId: clanMessages.authorPlayerId,
    content: clanMessages.content,
    createdAt: clanMessages.createdAt,
  });
  if (!message) throw new Error('clan message insert returned no row');
  for (const playerId of await activeClanPlayerIds(tx, membership.clanId)) {
    await publishPrivate(tx, playerId, 'chat');
  }
  return {
    ...message,
    planetId: actor.planetId,
    username: actor.displayName,
    createdAt: message.createdAt.toISOString(),
    self: true,
  };
}

async function clanActorForPlayer(tx: Tx, playerId: string) {
  const [row] = await tx.select({
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

export async function markClanChatRead(
  tx: Tx,
  input: { playerId: string; messageId: string; now: Date },
): Promise<string> {
  const actor = await clanActorForPlayer(tx, input.playerId);
  const season = await lockSeason(tx, actor.seasonId, false);
  assertClanChatOpen(season, input.now);
  await lockClanPlayers(tx, [input.playerId]);
  const membership = await activeClanMembership(tx, input.playerId);
  if (!membership) throw new GameError('NOT_IN_CLAN', 'You do not belong to a clan', 403);
  const [message] = await tx.select({ createdAt: clanMessages.createdAt })
    .from(clanMessages).where(and(
      eq(clanMessages.id, input.messageId),
      eq(clanMessages.clanId, membership.clanId),
      gte(clanMessages.createdAt, membership.joinedAt),
    ));
  if (!message) throw new GameError('CLAN_MESSAGE_NOT_VISIBLE', 'That message is not visible', 404);
  const [locked] = await tx.select().from(clanMemberships)
    .where(and(
      eq(clanMemberships.playerId, input.playerId),
      eq(clanMemberships.clanId, membership.clanId),
      sql`${clanMemberships.leftAt} is null`,
    )).for('update');
  if (!locked || locked.leftAt) throw new GameError('NOT_IN_CLAN', 'You no longer belong to that clan', 403);
  const readAt = locked.lastChatReadAt && locked.lastChatReadAt > message.createdAt
    ? locked.lastChatReadAt
    : message.createdAt;
  await tx.update(clanMemberships).set({ lastChatReadAt: readAt })
    .where(eq(clanMemberships.id, locked.id));
  return readAt.toISOString();
}
