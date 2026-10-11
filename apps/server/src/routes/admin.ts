import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { and, asc, eq, isNull } from 'drizzle-orm';
import { CHAT, CHAT_LANGUAGES } from '@astera/rules';
import { adminActions, clans, seasons, shards } from '../db/schema.js';
import { requireAdmin } from './community.js';
import { listAdminPlayers } from '../services/adminPlayers.js';
import { maskChatMessages, setChatMute } from '../services/chatModeration.js';
import { postClanChat, readClanChat } from '../services/clanChat.js';
import { clanActor } from '../services/clan.js';

const username = z.string().trim().min(1).max(64);
const pageQuery = z.object({ before: z.string().uuid().optional(), limit: z.coerce.number().int().min(1).max(100).default(50) }).strict();
const clanParams = z.object({ clanId: z.string().uuid() });
const muteBody = z.object({ username,
  channels: z.array(z.enum(['general', 'clan', 'dm'])).min(1).max(3).refine(items => new Set(items).size === items.length),
  duration: z.enum(['5m', '15m', '1h', '4h', '1d', 'permanent', 'remove']),
}).strict();
const maskBase = { username, count: z.number().int().min(1).max(500) };
const maskBody = z.discriminatedUnion('channel', [
  z.object({ ...maskBase, channel: z.literal('general'), seasonId: z.string().uuid(), language: z.enum(CHAT_LANGUAGES) }).strict(),
  z.object({ ...maskBase, channel: z.literal('clan'), clanId: z.string().uuid() }).strict(),
]);
const messageBody = z.object({
  content: z.string().trim().min(1).refine(value => Array.from(value).length <= CHAT.maxChars),
  replyToMessageId: z.string().uuid().optional(),
}).strict();

export function registerAdminRoutes(app: FastifyInstance): void {
  app.get('/api/admin/players', { preHandler: requireAdmin }, req =>
    listAdminPlayers(app.db, pageQuery.parse(req.query), app.clock.now()));
  app.get('/api/admin/clans', { preHandler: requireAdmin }, async () => ({
    galaxies: await app.db.select({ seasonId: seasons.id, name: shards.name, code: shards.code }).from(seasons)
      .innerJoin(shards, eq(shards.id, seasons.shardId)).where(eq(seasons.status, 'live')).orderBy(asc(shards.ordinal)),
    clans: await app.db.select({ id: clans.id, name: clans.name, tag: clans.tag, seasonId: clans.seasonId,
      galaxy: shards.name, galaxyCode: shards.code }).from(clans)
      .innerJoin(seasons, eq(seasons.id, clans.seasonId)).innerJoin(shards, eq(shards.id, seasons.shardId))
      .where(and(isNull(clans.disbandedAt), eq(seasons.status, 'live'))).orderBy(asc(shards.ordinal), asc(clans.tag)),
  }));
  app.get('/api/admin/clans/:clanId/chat', { preHandler: requireAdmin }, req => {
    const { clanId } = clanParams.parse(req.params);
    const query = pageQuery.extend({ limit: z.coerce.number().int().min(1).max(50).default(50) }).parse(req.query);
    return readClanChat(app.db, req.accountId!, { ...query, adminClanId: clanId, now: app.clock.now() }, app.adminUsernames);
  });
  app.post('/api/admin/clans/:clanId/chat', { preHandler: requireAdmin }, async req => {
    const { clanId } = clanParams.parse(req.params);
    const body = messageBody.parse(req.body);
    const actor = await clanActor(app.db, req.accountId!);
    return app.db.transaction(async tx => {
      const message = await postClanChat(tx, { ...body, playerId: actor.playerId, adminClanId: clanId, clock: app.clock }, app.adminUsernames);
      await tx.insert(adminActions).values({ actorAccountId: req.accountId!, action: 'CLAN_CHAT_POST', details: { clanId, messageId: message.id }, createdAt: app.clock.now() });
      return { message };
    });
  });
  app.post('/api/admin/chat/mute', { preHandler: requireAdmin }, req =>
    setChatMute(app.db, req.accountId!, muteBody.parse(req.body), app.clock));
  app.post('/api/admin/chat/mask', { preHandler: requireAdmin }, req =>
    maskChatMessages(app.db, req.accountId!, maskBody.parse(req.body), app.clock.now()));
}
