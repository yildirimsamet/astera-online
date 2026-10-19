import { and, asc, eq, inArray, lte, or, sql } from 'drizzle-orm';
import { z } from 'zod';
import type { Db } from '../db/client.js';
import type { Clock } from '../clock.js';
import { accounts, adminActions, chatMediaAssets, chatMessages, clanMessages, contentReports, dmConversations, dmMessages, players } from '../db/schema.js';
import { assertMessageReadable } from './messageAccess.js';
import { takeSecurityCounter } from './mail.js';
import { GameError } from './planet.js';
import { publish, publishPrivate, publishShard } from '../stream/bus.js';
import { activeClanPlayerIds } from './clanCombat.js';

const reasons = z.enum(['SPAM', 'HARASSMENT', 'HATE', 'SEXUAL', 'VIOLENCE', 'INAPPROPRIATE_NAME', 'OTHER']);
const details = z.string().trim().max(1000).refine(value => !value.includes('\0'));
export const contentReportBody = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('message'), channel: z.enum(['general', 'clan', 'dm']), messageId: z.string().uuid(), reason: reasons, details }).strict(),
  z.object({ kind: z.literal('player'), playerId: z.string().uuid(), reason: reasons, details }).strict(),
]);
const receipt = (row: typeof contentReports.$inferSelect) => ({ report: { id: row.id, createdAt: row.createdAt.toISOString(), status: 'received' as const } });

/** One report per actor/target; the client never supplies author identity or evidence. */
export async function submitContentReport(db: Db, clock: Clock, reporterAccountId: string, body: z.infer<typeof contentReportBody>, admins: ReadonlySet<string>) {
  return db.transaction(async tx => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`content-report:${reporterAccountId}`}, 0))`);
    const targetKey = body.kind === 'message' ? `${body.channel}:${body.messageId}` : `player:${body.playerId}`;
    const [existing] = await tx.select().from(contentReports).where(and(eq(contentReports.reporterAccountId, reporterAccountId), eq(contentReports.targetKey, targetKey)));
    if (existing) return receipt(existing);
    const [me] = await tx.select({ id: players.id, seasonId: players.seasonId }).from(players).where(eq(players.accountId, reporterAccountId));
    if (!me) throw new GameError('NO_PLANET', 'Join a galaxy first', 404);
    let playerId: string; let content = ''; let media: typeof chatMessages.$inferSelect.media = null;
    if (body.kind === 'message') {
      await assertMessageReadable(tx, reporterAccountId, body.channel, body.messageId, admins, clock.now());
      const table = body.channel === 'general' ? chatMessages : body.channel === 'clan' ? clanMessages : dmMessages;
      const [message] = await tx.select({ authorPlayerId: table.authorPlayerId, content: table.content, media: table.media }).from(table).where(eq(table.id, body.messageId));
      if (!message) throw new GameError('CHAT_MESSAGE_NOT_VISIBLE', 'Message not visible', 404);
      playerId = message.authorPlayerId; content = message.content; media = message.media;
    } else playerId = body.playerId;
    const [target] = await tx.select({ accountId: accounts.id, username: accounts.displayName, seasonId: players.seasonId }).from(players)
      .innerJoin(accounts, eq(accounts.id, players.accountId)).where(eq(players.id, playerId));
    if (!target) throw new GameError('PLAYER_NOT_FOUND', 'Player not available', 404);
    if (body.kind === 'player' && target.seasonId !== me.seasonId) {
      // Retained DM history already makes this peer known; do not expose arbitrary other galaxies.
      const [knownPeer] = await tx.select({ id: dmMessages.id }).from(dmMessages)
        .innerJoin(dmConversations, eq(dmConversations.id, dmMessages.conversationId)).where(or(
          and(eq(dmConversations.playerLowId, me.id), eq(dmConversations.playerHighId, playerId)),
          and(eq(dmConversations.playerHighId, me.id), eq(dmConversations.playerLowId, playerId)),
        )).limit(1);
      if (!knownPeer) throw new GameError('PLAYER_NOT_FOUND', 'Player not available', 404);
    }
    if (target.accountId === reporterAccountId) throw new GameError('REPORT_SELF', 'You cannot report yourself', 400);
    const now = clock.now();
    if (!await takeSecurityCounter(tx, `content-report:${reporterAccountId}`, 5, 15 * 60_000, now)) throw new GameError('RATE_LIMITED', 'Try later', 429, { seconds: 900 });
    const [created] = await tx.insert(contentReports).values({ reporterAccountId, targetAccountId: target.accountId, targetKey,
      kind: body.kind, channel: body.kind === 'message' ? body.channel : null, messageId: body.kind === 'message' ? body.messageId : null,
      reason: body.reason, details: body.details, evidence: { username: target.username, playerId, content, media }, createdAt: now }).returning();
    if (!created) throw new Error('Report was not recorded');
    return receipt(created);
  });
}

/** Decision and content change share one transaction, including audit and notification. */
export async function resolveContentReport(db: Db, clock: Clock, id: string, action: 'MASK' | 'DISMISS', actorAccountId: string) {
  return db.transaction(async tx => {
    const missing = () => new GameError('REPORT_NOT_FOUND', 'Report not found', 404);
    const [initial] = await tx.select().from(contentReports).where(eq(contentReports.id, id));
    if (!initial) throw missing();
    // Match account erasure's account-before-dependent-row order, including both audit FKs.
    const identities = [...new Set([actorAccountId, initial.reporterAccountId, initial.targetAccountId].filter((value): value is string => value !== null))].sort();
    await tx.select({ id: accounts.id }).from(accounts).where(inArray(accounts.id, identities)).orderBy(asc(accounts.id)).for('key share');
    const [report] = await tx.select().from(contentReports).where(eq(contentReports.id, id)).for('update');
    if (!report) throw missing();
    const status = action === 'MASK' ? 'RESOLVED' as const : 'DISMISSED' as const;
    if (report.status !== 'PENDING') {
      if (report.status !== status) throw new GameError('REPORT_ALREADY_CLOSED', 'A different decision is already recorded', 409);
      return { id, status };
    }
    if (action === 'MASK') {
      const messageId = report.messageId;
      if (report.kind !== 'message' || !messageId || !report.channel) throw new GameError('REPORT_NOT_MASKABLE', 'This report does not identify a message', 400);
      const masked = { content: '**', media: null };
      if (report.channel === 'general') {
        const changed = await tx.update(chatMessages).set(masked).where(and(eq(chatMessages.id, messageId), eq(chatMessages.authorPlayerId, report.evidence.playerId))).returning({ seasonId: chatMessages.seasonId });
        for (const message of changed) await publishShard(tx, message.seasonId, 'chat');
      } else if (report.channel === 'clan') {
        const changed = await tx.update(clanMessages).set(masked).where(and(eq(clanMessages.id, messageId), eq(clanMessages.authorPlayerId, report.evidence.playerId))).returning({ clanId: clanMessages.clanId });
        for (const message of changed) for (const playerId of await activeClanPlayerIds(tx, message.clanId)) await publishPrivate(tx, playerId, 'chat');
      } else {
        const changed = await tx.update(dmMessages).set(masked).where(and(eq(dmMessages.id, messageId), eq(dmMessages.authorPlayerId, report.evidence.playerId))).returning({ conversationId: dmMessages.conversationId });
        for (const message of changed) {
          const [pair] = await tx.select().from(dmConversations).where(eq(dmConversations.id, message.conversationId));
          if (pair) { await publish(tx, pair.playerLowId, 'private:dm'); await publish(tx, pair.playerHighId, 'private:dm'); }
        }
      }
    }
    const now = clock.now();
    await tx.update(contentReports).set({ status, resolvedAt: now, moderatorAccountId: actorAccountId }).where(eq(contentReports.id, id));
    await tx.insert(adminActions).values({ actorAccountId, targetAccountId: report.targetAccountId, action: `CONTENT_REPORT_${action}`, details: { reportId: id }, createdAt: now });
    return { id, status };
  });
}

export async function listContentReports(db: Db) {
  const reports = await db.select({ id: contentReports.id, kind: contentReports.kind, channel: contentReports.channel,
    messageId: contentReports.messageId, reason: contentReports.reason, details: contentReports.details,
    evidence: contentReports.evidence, status: contentReports.status, createdAt: contentReports.createdAt,
    targetUsername: accounts.username }).from(contentReports).leftJoin(accounts, eq(accounts.id, contentReports.targetAccountId))
    .where(eq(contentReports.status, 'PENDING')).orderBy(asc(contentReports.createdAt), asc(contentReports.id)).limit(100);
  return { reports };
}

/** Bounded housekeeping, independent of the report's moderation status. */
export async function expireContentReports(db: Db, now: Date): Promise<number> {
  return db.transaction(async tx => {
    const expired = await tx.select({ id: contentReports.id }).from(contentReports)
      .where(lte(contentReports.createdAt, new Date(now.getTime() - 30 * 86_400_000)))
      .orderBy(asc(contentReports.createdAt), asc(contentReports.id)).limit(1000).for('update', { skipLocked: true });
    if (expired.length) await tx.delete(contentReports).where(inArray(contentReports.id, expired.map(row => row.id)));
    return expired.length;
  });
}


/** Private moderation evidence grants no broader access to an upload owner's files. */
export async function contentReportMedia(db: Db, clock: Clock, id: string) {
  const missing = () => new GameError('CHAT_MEDIA_NOT_FOUND', 'Reported attachment unavailable', 404);
  const [report] = await db.select().from(contentReports).where(eq(contentReports.id, id));
  if (report?.kind !== 'message' || report.status !== 'PENDING'
    || report.createdAt.getTime() + 30 * 86_400_000 <= clock.now().getTime()) throw missing();
  const media = report.evidence.media;
  if (!media || media.kind === 'youtube') throw missing();
  const [asset] = await db.select().from(chatMediaAssets).where(eq(chatMediaAssets.id, media.assetId));
  if (!asset?.claimedAt || asset.kind !== media.kind || asset.mimeType !== media.mimeType
    || asset.channel !== report.channel || asset.messageId !== report.messageId) throw missing();
  return asset;
}
