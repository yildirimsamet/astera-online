import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { BRAND_RECALL } from '@astera/rules';
import { answerBrandRecall, brandRecallStatus } from '../services/brandRecall.js';
import { requireAuth } from './auth.js';

const bodySchema = z.object({ answer: z.enum(BRAND_RECALL.choices).nullable() }).strict();

export function registerBrandRecallRoutes(app: FastifyInstance): void {
  app.get('/api/session/brand-recall', { preHandler: requireAuth }, async (req) => brandRecallStatus(app.db, req.accountId!));
  app.post('/api/session/brand-recall', { preHandler: requireAuth }, async (req) => {
    const { answer } = bodySchema.parse(req.body);
    return answerBrandRecall(app.db, req.accountId!, answer, app.clock);
  });
}
