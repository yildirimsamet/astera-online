import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { readChronicle } from '../services/chronicle.js';
import { requireAuth } from './auth.js';

const querySchema = z.object({
  before: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(30),
});

export function registerChronicleRoutes(app: FastifyInstance): void {
  app.get('/api/chronicle', { preHandler: requireAuth }, async (req) => {
    const query = querySchema.parse(req.query);
    return readChronicle(app.db, req.accountId!, app.clock, query.limit, query.before);
  });
}
