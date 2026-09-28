import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { CHAT } from '@astera/rules';
import {
  dmContacts, dmConversationsFor, dmPage, dmUnread, markDmRead, postDm, setDmBlock,
} from '../services/dm.js';
import { requireAuth } from './auth.js';

const uuid = z.string().uuid();
const contactQuery = z.object({ q: z.string().max(64).default('') });
const pageQuery = z.object({ before: uuid.optional(), limit: z.coerce.number().int().min(1).max(50).default(50) });
const conversationParams = z.object({ id: uuid });
const blockParams = z.object({ targetPlayerId: uuid });
const sendBody = z.object({
  recipientPlayerId: uuid,
  replyToMessageId: uuid.optional(),
  content: z.string().transform((value) => value.trim()).pipe(z.string().min(1).refine(
    (value) => Array.from(value).length <= CHAT.maxChars,
    `Must contain at most ${String(CHAT.maxChars)} characters`,
  )),
}).strict();

export function registerDmRoutes(app: FastifyInstance): void {
  app.get('/api/dm/contacts', { preHandler: requireAuth }, async (req) =>
    dmContacts(app.db, req.accountId!, contactQuery.parse(req.query).q));

  app.get('/api/dm/conversations', { preHandler: requireAuth }, async (req) =>
    dmConversationsFor(app.db, req.accountId!));

  app.get('/api/dm/unread', { preHandler: requireAuth }, async (req) => ({
    count: await dmUnread(app.db, req.accountId!),
  }));

  app.get('/api/dm/conversations/:id/messages', { preHandler: requireAuth }, async (req) => {
    const { id } = conversationParams.parse(req.params);
    const { before, limit } = pageQuery.parse(req.query);
    return dmPage(app.db, req.accountId!, id, limit, before);
  });

  app.post('/api/dm/messages', { preHandler: requireAuth }, async (req) => {
    const { recipientPlayerId, content, replyToMessageId } = sendBody.parse(req.body);
    return postDm(app.db, req.accountId!, recipientPlayerId, content, app.clock, replyToMessageId);
  });

  app.post('/api/dm/conversations/:id/read', { preHandler: requireAuth }, async (req) => {
    const { id } = conversationParams.parse(req.params);
    const { messageId } = z.object({ messageId: uuid }).strict().parse(req.body);
    return markDmRead(app.db, req.accountId!, id, messageId);
  });

  app.post('/api/dm/blocks', { preHandler: requireAuth }, async (req) => {
    const { targetPlayerId } = z.object({ targetPlayerId: uuid }).strict().parse(req.body);
    return setDmBlock(app.db, req.accountId!, targetPlayerId, true, app.clock);
  });

  app.delete('/api/dm/blocks/:targetPlayerId', { preHandler: requireAuth }, async (req) => {
    const { targetPlayerId } = blockParams.parse(req.params);
    return setDmBlock(app.db, req.accountId!, targetPlayerId, false, app.clock);
  });
}
