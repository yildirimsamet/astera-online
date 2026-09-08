import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireAuth } from './auth.js';
import { enqueueReturn } from '../services/returnQueue.js';
import { readReturnStatus } from '../services/returnStatus.js';

const intent = z.object({ placementVersion: z.number().int().nonnegative() }).strict();
export function registerReturnApplicationRoutes(app: FastifyInstance): void {
  app.get('/api/return-applications', { preHandler: requireAuth }, async (req) =>
    readReturnStatus(app.db, req.accountId!, app.clock));
  app.post('/api/return-applications', { preHandler: requireAuth }, async (req) => {
    const body = intent.parse(req.body);
    await enqueueReturn(app.db, req.accountId!, app.clock, body.placementVersion);
    return readReturnStatus(app.db, req.accountId!, app.clock);
  });
}
