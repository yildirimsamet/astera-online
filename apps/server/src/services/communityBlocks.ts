import { and, asc, count, eq, inArray, or, sql, type SQLWrapper } from 'drizzle-orm';
import type { Db, Queryable, Tx } from '../db/client.js';
import type { Clock } from '../clock.js';
import { accounts, communityBlocks, dmConversations, dmMessages, players } from '../db/schema.js';
import { publish } from '../stream/bus.js';
import { GameError } from './planet.js';
import { takeSecurityCounter } from './mail.js';

/** SQL filter shared by history, pagination, unread, quotes and reaction rosters. */
export function chatVisibleTo(accountId: string | SQLWrapper, authorPlayerId: SQLWrapper) {
  return sql`NOT EXISTS (SELECT 1 FROM community_blocks cb JOIN players blocked_author ON blocked_author.id = ${authorPlayerId}
    WHERE (cb.blocker_account_id = ${accountId} AND cb.target_account_id = blocked_author.account_id)
       OR (cb.target_account_id = ${accountId} AND cb.blocker_account_id = blocked_author.account_id))`;
}
export const accountForPlayer = (playerId: string) => sql`(SELECT account_id FROM players WHERE id = ${playerId}::uuid)`;
export async function lockCommunityPair(tx: Tx, a: string, b: string): Promise<void> {
  const [low, high] = [a, b].sort();
  await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`community-pair:${low}:${high}`}, 0))`);
}
export async function communityPairBlocked(db: Queryable, a: string, b: string): Promise<boolean> {
  const [row] = await db.select({ id: communityBlocks.blockerAccountId }).from(communityBlocks).where(or(
    and(eq(communityBlocks.blockerAccountId, a), eq(communityBlocks.targetAccountId, b)),
    and(eq(communityBlocks.blockerAccountId, b), eq(communityBlocks.targetAccountId, a)),
  )).limit(1);
  return row !== undefined;
}
async function lockAccounts(tx: Tx, ids: string[]) {
  await tx.select({ id: accounts.id }).from(accounts).where(inArray(accounts.id, [...new Set(ids)]))
    .orderBy(asc(accounts.id)).for('key share');
}
async function notify(tx: Tx, ids: string[]) {
  const affected = await tx.select({ id: players.id }).from(players).where(inArray(players.accountId, ids));
  for (const player of affected) await publish(tx, player.id, 'private:community-block');
}
export async function blockCommunityPlayer(db: Db, clock: Clock, accountId: string, targetPlayerId: string) {
  return db.transaction(async tx => {
    const [me] = await tx.select().from(players).where(eq(players.accountId, accountId));
    const [target] = await tx.select().from(players).where(eq(players.id, targetPlayerId));
    if (!me || !target) throw new GameError('PLAYER_NOT_FOUND', 'Player not available', 404);
    if (target.accountId === accountId) throw new GameError('BLOCK_SELF', 'You cannot block yourself', 400);
    if (target.seasonId !== me.seasonId) {
      const [known] = await tx.select({ id: dmMessages.id }).from(dmMessages).innerJoin(dmConversations, eq(dmMessages.conversationId, dmConversations.id)).where(or(
        and(eq(dmConversations.playerLowId, me.id), eq(dmConversations.playerHighId, target.id)),
        and(eq(dmConversations.playerHighId, me.id), eq(dmConversations.playerLowId, target.id)),
      )).limit(1);
      if (!known) throw new GameError('PLAYER_NOT_FOUND', 'Player not available', 404);
    }
    await lockAccounts(tx, [accountId, target.accountId]);
    // Account-level budget/count must serialize even when different targets are blocked concurrently.
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`community-blocks:${accountId}`}, 0))`);
    await lockCommunityPair(tx, accountId, target.accountId);
    const where = and(eq(communityBlocks.blockerAccountId, accountId), eq(communityBlocks.targetAccountId, target.accountId));
    const [existing] = await tx.select().from(communityBlocks).where(where);
    if (existing) return { blocked: true as const };
    const [total] = await tx.select({ value: count() }).from(communityBlocks).where(eq(communityBlocks.blockerAccountId, accountId));
    if ((total?.value ?? 0) >= 500) throw new GameError('BLOCK_LIMIT', 'Remove an existing block first', 409);
    if (!await takeSecurityCounter(tx, `community-blocks:${accountId}`, 20, 15 * 60_000, clock.now())) throw new GameError('RATE_LIMITED', 'Try later', 429);
    await tx.insert(communityBlocks).values({ blockerAccountId: accountId, targetAccountId: target.accountId, createdAt: clock.now() });
    await notify(tx, [accountId, target.accountId]); return { blocked: true as const };
  });
}
export async function listCommunityBlocks(db: Db, accountId: string) {
  const blocks = await db.select({ accountId: communityBlocks.targetAccountId, username: accounts.displayName, createdAt: communityBlocks.createdAt })
    .from(communityBlocks).innerJoin(accounts, eq(accounts.id, communityBlocks.targetAccountId)).where(eq(communityBlocks.blockerAccountId, accountId))
    .orderBy(asc(communityBlocks.createdAt), asc(communityBlocks.targetAccountId)).limit(500);
  return { blocks };
}
export async function unblockCommunityAccount(db: Db, accountId: string, targetAccountId: string) {
  return db.transaction(async tx => {
    const where = and(eq(communityBlocks.blockerAccountId, accountId), eq(communityBlocks.targetAccountId, targetAccountId));
    const [existing] = await tx.select().from(communityBlocks).where(where);
    if (!existing) return { blocked: false as const };
    await lockAccounts(tx, [accountId, targetAccountId]); await lockCommunityPair(tx, accountId, targetAccountId);
    await tx.delete(communityBlocks).where(where); await notify(tx, [accountId, targetAccountId]); return { blocked: false as const };
  });
}
