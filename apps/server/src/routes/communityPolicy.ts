import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { CHAT_LANGUAGES } from '@astera/rules';
import { requireAuth } from './auth.js';
import { acceptCommunityPolicy, communityPolicyStatus } from '../services/communityPolicy.js';

export function registerCommunityPolicyRoutes(app: FastifyInstance): void {
  app.addHook('onSend', (req, reply, payload, done) => {
    if (req.url.startsWith('/api/community/policy')) void reply.header('Cache-Control', 'no-store'); done(null, payload);
  });
  app.get('/api/community/policy', { preHandler: requireAuth }, req => communityPolicyStatus(app.db, req.accountId!));
  app.post('/api/community/policy', { preHandler: requireAuth, bodyLimit: 4096 }, req => {
    const body = z.object({ version: z.string().max(64), locale: z.enum(CHAT_LANGUAGES) }).strict().parse(req.body);
    return acceptCommunityPolicy(app.db, app.clock, req.accountId!, body.version, body.locale);
  });
}
