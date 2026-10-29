import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { CHAT_LANGUAGES, REACTION_EMOJIS } from '@astera/rules';
import { markChatRead, postChat, readChat, unreadChat } from '../services/chat.js';
import { readMessageReactions, setMessageReaction } from '../services/messageReactions.js';
import { chatMessageBody } from '../services/chatMedia.js';
import { requireAuth } from './auth.js';

const listQuery = z.object({
  before: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(50),
  language: z.enum(CHAT_LANGUAGES).default('tr'),
});
const languageBody = z.enum(CHAT_LANGUAGES).default('tr');
const messageBodyWithLanguage = chatMessageBody.innerType().extend({ language: languageBody }).refine(value => value.content.length > 0 || value.media !== undefined);
const readBody = z.object({ messageId: z.string().uuid(), language: languageBody }).strict();

export function registerChatRoutes(app: FastifyInstance): void {
  app.get('/api/chat/reactions', { preHandler: requireAuth }, async req => {
    const query = z.object({ channel: z.enum(['general', 'clan', 'dm']), messageId: z.string().uuid() }).strict().parse(req.query);
    return readMessageReactions(app.db, req.accountId!, query.channel, query.messageId, app.adminUsernames, app.clock.now());
  });
  app.post('/api/chat/reactions', { preHandler: requireAuth }, async (req) => {
    const body = z.object({
      channel: z.enum(['general', 'clan', 'dm']),
      messageId: z.string().uuid(),
      emoji: z.enum(REACTION_EMOJIS).nullable(),
    }).strict().parse(req.body);
    return setMessageReaction(app.db, req.accountId!, body.channel, body.messageId, body.emoji, app.clock.now());
  });
  app.get('/api/chat/messages', { preHandler: requireAuth }, async (req) => {
    const query = listQuery.parse(req.query);
    const self = await app.projections.commander(req.accountId!);
    const [sensors, remembered] = await Promise.all([
      app.projections.sensorsFor(self.playerId, self.seasonId, self.planetIds),
      app.projections.rememberedFor(self.playerId, self.seasonId),
    ]);
    return readChat(
      app.db, req.accountId!, query.limit, { sensors, remembered },
      query.language, query.before, app.adminUsernames,
    );
  });

  app.post('/api/chat/messages', { preHandler: requireAuth }, async (req) => {
    const body = messageBodyWithLanguage.parse(req.body);
    return {
      message: await postChat(
        app.db, req.accountId!, body.content, app.clock, body.language, app.adminUsernames, body.replyToMessageId, body.media,
      ),
    };
  });

  app.get('/api/chat/unread', { preHandler: requireAuth }, async (req) => ({
    count: await unreadChat(app.db, req.accountId!, listQuery.parse(req.query).language),
  }));

  app.post('/api/chat/read', { preHandler: requireAuth }, async (req) => {
    const body = readBody.parse(req.body);
    return { ok: true as const, readAt: await markChatRead(app.db, req.accountId!, body.messageId, body.language) };
  });
}
