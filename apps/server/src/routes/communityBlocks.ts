import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireAuth } from './auth.js';
import { blockCommunityPlayer, listCommunityBlocks, unblockCommunityAccount } from '../services/communityBlocks.js';

export function registerCommunityBlockRoutes(app: FastifyInstance): void {
  app.addHook('onSend', (req, reply, payload, done) => {
    if (req.url.startsWith('/api/community/blocks')) void reply.header('Cache-Control', 'no-store');
    done(null, payload);
  });
  app.get('/api/community/blocks', { preHandler: requireAuth }, req => listCommunityBlocks(app.db, req.accountId!));
  app.post('/api/community/blocks', { preHandler: requireAuth, bodyLimit: 4096 }, req => {
    const { targetPlayerId } = z.object({ targetPlayerId: z.string().uuid() }).strict().parse(req.body);
    return blockCommunityPlayer(app.db, app.clock, req.accountId!, targetPlayerId);
  });
  app.delete('/api/community/blocks/:accountId', { preHandler: requireAuth }, req => {
    const { accountId } = z.object({ accountId: z.string().uuid() }).strict().parse(req.params);
    return unblockCommunityAccount(app.db, req.accountId!, accountId);
  });
}
