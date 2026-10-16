import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireAuth } from './auth.js';
import { commanderForAccount } from '../services/ownership.js';
import { endVacation, startVacation, vacationStatus } from '../services/vacation.js';

export function registerVacationRoutes(app: FastifyInstance) {
  const days = z.coerce.number().int().min(1).max(7);
  app.get('/api/vacation', { preHandler: requireAuth }, async req => {
    const input = z.object({ days: days.default(1) }).strict().parse(req.query);
    const owner = await commanderForAccount(app.db, req.accountId!);
    return vacationStatus(app.db, owner.playerId, app.clock, input.days);
  });
  app.post('/api/vacation', { preHandler: requireAuth }, async req => {
    const input = z.object({ days: z.number().int().min(1).max(7), fingerprint: z.string().regex(/^[a-f0-9]{64}$/), requestId: z.string().uuid() }).strict().parse(req.body);
    const owner = await commanderForAccount(app.db, req.accountId!);
    return startVacation(app.db, owner.playerId, input.days, input.fingerprint, input.requestId, app.clock);
  });
  app.post('/api/vacation/end', { preHandler: requireAuth }, async req => {
    const input = z.object({ vacationId: z.string().uuid() }).strict().parse(req.body);
    const owner = await commanderForAccount(app.db, req.accountId!);
    return endVacation(app.db, owner.playerId, input.vacationId, app.clock);
  });
}
