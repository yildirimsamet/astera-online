import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { markChatRead, postChat, readChat, unreadChat } from '../services/chat.js';
import { requireAuth } from './auth.js';

const listQuery = z.object({
  before: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(50),
});
const messageBody = z.object({
  content: z.string()
    .transform((value) => value.trim())
    .pipe(z.string().min(1).refine((value) => Array.from(value).length <= 280, 'Must contain at most 280 characters')),
}).strict();
const readBody = z.object({ messageId: z.string().uuid() }).strict();

export function registerChatRoutes(app: FastifyInstance): void {
  app.get('/api/chat/messages', { preHandler: requireAuth }, async (req) => {
    const query = listQuery.parse(req.query);
    return readChat(app.db, req.accountId!, query.limit, query.before);
  });

  app.post('/api/chat/messages', { preHandler: requireAuth }, async (req) => {
    const body = messageBody.parse(req.body);
    return { message: await postChat(app.db, req.accountId!, body.content, app.clock) };
  });

  app.get('/api/chat/unread', { preHandler: requireAuth }, async (req) => ({
    count: await unreadChat(app.db, req.accountId!),
  }));

  app.post('/api/chat/read', { preHandler: requireAuth }, async (req) => {
    const body = readBody.parse(req.body);
    return { ok: true as const, readAt: await markChatRead(app.db, req.accountId!, body.messageId) };
  });
}
