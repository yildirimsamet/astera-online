import { and, asc, eq, inArray, or } from 'drizzle-orm';
import { SEASON, type ReactionEmoji } from '@astera/rules';
import { addMinutes } from '../clock.js';
import type { Db } from '../db/client.js';
import {
  chatMessages, clanMessages, dmBlocks, dmConversations, dmMessages, messageReactions,
  players, seasons, shards,
} from '../db/schema.js';
import { publish, publishPrivate, publishShard } from '../stream/bus.js';
import { activeClanMembership, activeClanPlayerIds } from './clanCombat.js';
import { lockDmPair } from './dm.js';
import { reactionViews, type MessageChannel } from './messageDecorations.js';
import { GameError } from './planet.js';

/** Replaces the actor's sole reaction atomically, after checking current visibility. */
export async function setMessageReaction(
  db: Db, accountId: string, channel: MessageChannel, messageId: string,
  emoji: ReactionEmoji | null, now: Date,
) {
  return db.transaction(async (tx) => {
    const [me] = await tx.select({ id: players.id, seasonId: players.seasonId,
      role: shards.role, status: seasons.status, endsAt: seasons.endsAt })
      .from(players).innerJoin(seasons, eq(seasons.id, players.seasonId))
      .innerJoin(shards, eq(shards.id, seasons.shardId))
      .where(eq(players.accountId, accountId)).limit(1);
    if (!me) throw new GameError('NO_PLANET', 'Join a galaxy first', 404);

    let target: { chatMessageId?: string; clanMessageId?: string; dmMessageId?: string };
    let notify: () => Promise<void>;
    if (channel === 'general') {
      const [row] = await tx.select({ seasonId: chatMessages.seasonId }).from(chatMessages)
        .where(eq(chatMessages.id, messageId)).for('update').limit(1);
      if (row?.seasonId !== me.seasonId) throw new GameError('CHAT_MESSAGE_NOT_VISIBLE', 'Message not visible', 404);
      target = { chatMessageId: messageId };
      notify = () => publishShard(tx, me.seasonId, 'chat');
    } else if (channel === 'clan') {
      const membership = await activeClanMembership(tx, me.id);
      if (!membership) throw new GameError('NOT_IN_CLAN', 'You do not belong to a clan', 403);
      const [row] = await tx.select({ clanId: clanMessages.clanId, createdAt: clanMessages.createdAt })
        .from(clanMessages).where(eq(clanMessages.id, messageId)).for('update').limit(1);
      if (row?.clanId !== membership.clanId || row.createdAt < membership.joinedAt) {
        throw new GameError('CLAN_MESSAGE_NOT_VISIBLE', 'Message not visible', 404);
      }
      if (me.status !== 'live' && !(me.status === 'frozen'
        && now <= addMinutes(me.endsAt, SEASON.afterglowMinutes))) {
        throw new GameError('SEASON_FROZEN', 'Clan chat is closed', 409);
      }
      target = { clanMessageId: messageId };
      notify = async () => {
        for (const id of await activeClanPlayerIds(tx, membership.clanId)) await publishPrivate(tx, id, 'chat');
      };
    } else {
      const [row] = await tx.select({ conversationId: dmMessages.conversationId,
        seasonId: dmConversations.seasonId, low: dmConversations.playerLowId,
        high: dmConversations.playerHighId })
        .from(dmMessages).innerJoin(dmConversations, eq(dmConversations.id, dmMessages.conversationId))
        .where(eq(dmMessages.id, messageId)).limit(1);
      if (!row || (row.low !== me.id && row.high !== me.id)) {
        throw new GameError('DM_MESSAGE_NOT_FOUND', 'Message not found', 404);
      }
      const peerId = row.low === me.id ? row.high : row.low;
      // Transfer takes an UPDATE lock on the player. SHARE makes this permission
      // check wait for it, while remaining compatible with block's FK key locks.
      const currentPlayers = await tx.select({ id: players.id, seasonId: players.seasonId })
        .from(players).where(inArray(players.id, [me.id, peerId]))
        .orderBy(asc(players.id)).for('share');
      const currentMe = currentPlayers.find((player) => player.id === me.id);
      const peer = currentPlayers.find((player) => player.id === peerId);
      await lockDmPair(tx, me.id, peerId);
      const [currentSeason] = currentMe ? await tx.select({ status: seasons.status, role: shards.role })
        .from(seasons).innerJoin(shards, eq(shards.id, seasons.shardId))
        .where(eq(seasons.id, currentMe.seasonId)).limit(1) : [];
      if (currentSeason?.status !== 'live' || currentSeason.role !== 'MAIN'
        || currentMe?.seasonId !== row.seasonId
        || peer?.seasonId !== row.seasonId) {
        throw new GameError('DM_UNAVAILABLE', 'Both commanders must be in the same live galaxy', 409);
      }
      const [currentMessage] = await tx.select({ conversationId: dmMessages.conversationId })
        .from(dmMessages).where(eq(dmMessages.id, messageId)).for('update').limit(1);
      if (currentMessage?.conversationId !== row.conversationId) {
        throw new GameError('DM_MESSAGE_NOT_FOUND', 'Message not found', 404);
      }
      const [block] = await tx.select({ playerId: dmBlocks.blockerPlayerId }).from(dmBlocks)
        .where(or(and(eq(dmBlocks.blockerPlayerId, me.id), eq(dmBlocks.targetPlayerId, peerId)),
          and(eq(dmBlocks.blockerPlayerId, peerId), eq(dmBlocks.targetPlayerId, me.id)))).limit(1);
      if (block) throw new GameError('DM_BLOCKED', 'This conversation cannot receive reactions', 403);
      target = { dmMessageId: messageId };
      notify = async () => { await publish(tx, me.id, 'private:dm'); await publish(tx, peerId, 'private:dm'); };
    }

    const key = channel === 'general' ? messageReactions.chatMessageId
      : channel === 'clan' ? messageReactions.clanMessageId : messageReactions.dmMessageId;
    await tx.delete(messageReactions).where(and(eq(key, messageId), eq(messageReactions.playerId, me.id)));
    if (emoji !== null) await tx.insert(messageReactions).values({
      ...target, playerId: me.id, emoji, createdAt: now,
    });
    await notify();
    const reactions = await reactionViews(tx, channel, [messageId], me.id);
    return { reactions: reactions.get(messageId) ?? [] };
  });
}
