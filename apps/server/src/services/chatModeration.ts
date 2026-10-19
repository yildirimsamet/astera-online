import { and, desc, eq, gt, inArray, isNull, or, sql } from 'drizzle-orm';
import type { ChatLanguage } from '@astera/rules';
import type { Clock } from '../clock.js';
import type { Db, Tx } from '../db/client.js';
import { accounts, adminActions, chatMessages, chatMutes, clanMessages, clans, players, seasons } from '../db/schema.js';
import { publishPrivate, publishShard } from '../stream/bus.js';
import { activeClanPlayerIds } from './clanCombat.js';
import { GameError } from './planet.js';

export type ModeratedChannel = 'general' | 'clan' | 'dm';
export const MUTE_MINUTES = { '5m': 5, '15m': 15, '1h': 60, '4h': 240, '1d': 1440 } as const;
export type MuteDuration = keyof typeof MUTE_MINUTES | 'permanent' | 'remove';

/** Shared by senders and exclusive for mute changes, across API replicas. */
export async function assertChatAllowed(tx: Tx, accountId: string, channel: ModeratedChannel, clock: Clock): Promise<void> {
  await assertCommunityPolicyAccepted(tx, accountId);
  await tx.execute(sql`select pg_advisory_xact_lock_shared(hashtextextended(${`chat-moderation:${accountId}`}, 0))`);
  const now = clock.now();
  const [mute] = await tx.select({ expiresAt: chatMutes.expiresAt }).from(chatMutes).where(and(
    eq(chatMutes.accountId, accountId), eq(chatMutes.channel, channel),
    or(isNull(chatMutes.expiresAt), gt(chatMutes.expiresAt, now)),
  )).limit(1);
  if (mute) throw new GameError('CHAT_MUTED', 'You are muted in this chat channel', 403, {
    channel, expiresAt: mute.expiresAt?.toISOString() ?? 'permanent',
  });
}

async function targetAccount(tx: Tx, username: string) {
  const [account] = await tx.select({ id: accounts.id, username: accounts.username }).from(accounts)
    .where(eq(accounts.username, username.toLowerCase())).limit(1);
  if (!account) throw new GameError('ACCOUNT_NOT_FOUND', 'Account not found', 404);
  return account;
}

export async function setChatMute(db: Db, actorAccountId: string, input: {
  username: string; channels: ModeratedChannel[]; duration: MuteDuration;
}, clock: Clock) {
  return db.transaction(async tx => {
    const target = await targetAccount(tx, input.username);
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`chat-moderation:${target.id}`}, 0))`);
    const now = clock.now();
    const expiresAt = input.duration === 'permanent' || input.duration === 'remove' ? null
      : new Date(now.getTime() + MUTE_MINUTES[input.duration] * 60_000);
    if (input.duration === 'remove') {
      await tx.delete(chatMutes).where(and(eq(chatMutes.accountId, target.id), inArray(chatMutes.channel, input.channels)));
    } else {
      await tx.insert(chatMutes).values(input.channels.map(channel => ({
        accountId: target.id, channel, expiresAt, createdAt: now, actorAccountId,
      }))).onConflictDoUpdate({ target: [chatMutes.accountId, chatMutes.channel], set: { expiresAt, createdAt: now, actorAccountId } });
    }
    await tx.insert(adminActions).values({ actorAccountId, targetAccountId: target.id, action: 'CHAT_MUTE',
      details: { channels: input.channels, duration: input.duration, expiresAt: expiresAt?.toISOString() ?? null }, createdAt: now });
    return { username: target.username, channels: input.channels, duration: input.duration, expiresAt };
  });
}

export type MaskScope = { channel: 'general'; seasonId: string; language: ChatLanguage }
  | { channel: 'clan'; clanId: string };

export async function maskChatMessages(db: Db, actorAccountId: string, input: MaskScope & { username: string; count: number }, now: Date) {
  return db.transaction(async tx => {
    const target = await targetAccount(tx, input.username);
    let seasonId: string;
    if (input.channel === 'clan') {
      const [clan] = await tx.select({ seasonId: clans.seasonId }).from(clans).where(eq(clans.id, input.clanId)).limit(1);
      if (!clan) throw new GameError('CLAN_NOT_FOUND', 'Clan not found', 404);
      seasonId = clan.seasonId;
    } else {
      seasonId = input.seasonId;
      const [season] = await tx.select({ id: seasons.id }).from(seasons).where(eq(seasons.id, seasonId)).limit(1);
      if (!season) throw new GameError('SEASON_NOT_FOUND', 'Galaxy not found', 404);
    }
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${input.channel === 'clan' ? `clan-chat:${input.clanId}` : `chat:${seasonId}`}))`);
    const table = input.channel === 'general' ? chatMessages : clanMessages;
    const scope = input.channel === 'general'
      ? and(eq(chatMessages.seasonId, input.seasonId), eq(chatMessages.language, input.language))
      : eq(clanMessages.clanId, input.clanId);
    const rows = await tx.select({ id: table.id, content: table.content, media: table.media }).from(table)
      .innerJoin(players, eq(players.id, table.authorPlayerId))
      .where(and(scope, eq(players.accountId, target.id)))
      .orderBy(desc(table.createdAt), desc(table.id)).limit(input.count);
    // Count the same last X on retry; never walk backwards into older, unselected text.
    const changed = rows.filter(row => row.content !== '**' || row.media !== null);
    if (changed.length > 0) {
      await tx.update(table).set({ content: '**', media: null }).where(inArray(table.id, changed.map(row => row.id)));
      await tx.insert(adminActions).values({ actorAccountId, targetAccountId: target.id, action: 'CHAT_MASK',
        details: { ...input, messages: changed }, createdAt: now });
      if (input.channel === 'general') await publishShard(tx, seasonId, 'chat');
      else for (const playerId of await activeClanPlayerIds(tx, input.clanId)) await publishPrivate(tx, playerId, 'chat');
    }
    return { masked: changed.length };
  });
}
import { assertCommunityPolicyAccepted } from './communityPolicy.js';
