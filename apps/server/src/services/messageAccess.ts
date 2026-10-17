import { and, eq, gte, or } from 'drizzle-orm';
import type { Queryable } from '../db/client.js';
import { chatMessages, clanMessages, dmConversations, dmMessages, players, seasons } from '../db/schema.js';
import { activeClanMembership } from './clanCombat.js';
import { assertClanChatOpen } from './clanChat.js';
import { isAdminAccount } from './admin.js';
import type { MessageChannel } from './messageDecorations.js';
import { GameError } from './planet.js';

/** Read permissions intentionally allow retained DM history after a block or transfer. */
export async function assertMessageReadable(
  db: Queryable, accountId: string, channel: MessageChannel, messageId: string,
  adminUsernames: ReadonlySet<string>, now: Date,
): Promise<void> {
  const [me] = await db.select({ id: players.id, seasonId: players.seasonId, status: seasons.status, endsAt: seasons.endsAt }).from(players)
    .innerJoin(seasons, eq(seasons.id, players.seasonId))
    .where(eq(players.accountId, accountId)).limit(1);
  if (!me) throw new GameError('NO_PLANET', 'Join a galaxy first', 404);
  let visible: boolean;
  if (channel === 'general') {
    const [row] = await db.select({ id: chatMessages.id }).from(chatMessages)
      .where(and(eq(chatMessages.id, messageId), eq(chatMessages.seasonId, me.seasonId))).limit(1);
    visible = row !== undefined;
  } else if (channel === 'clan') {
    if (await isAdminAccount(db, accountId, adminUsernames)) {
      const [row] = await db.select({ id: clanMessages.id }).from(clanMessages)
        .where(eq(clanMessages.id, messageId)).limit(1);
      visible = row !== undefined;
    } else {
      assertClanChatOpen(me, now);
      const membership = await activeClanMembership(db, me.id);
      const [row] = membership ? await db.select({ id: clanMessages.id }).from(clanMessages)
        .where(and(eq(clanMessages.id, messageId), eq(clanMessages.clanId, membership.clanId),
          gte(clanMessages.createdAt, membership.joinedAt))).limit(1) : [];
      visible = row !== undefined;
    }
  } else {
    const [row] = await db.select({ id: dmMessages.id }).from(dmMessages)
      .innerJoin(dmConversations, eq(dmConversations.id, dmMessages.conversationId))
      .where(and(eq(dmMessages.id, messageId), or(
        eq(dmConversations.playerLowId, me.id), eq(dmConversations.playerHighId, me.id),
      ))).limit(1);
    visible = row !== undefined;
  }
  if (!visible) throw new GameError('CHAT_MESSAGE_NOT_VISIBLE', 'Message not visible', 404);
}
