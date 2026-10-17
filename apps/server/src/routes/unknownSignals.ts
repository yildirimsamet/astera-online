import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireAuth } from './auth.js';
import { GameError } from '../services/planet.js';
import { devUnknownSignal, dispatchUnknownSignal, recallUnknownSignal, unknownSignalsForPlayer, unknownSignalContext } from '../services/unknownSignal.js';

const keyOf = (headers: Record<string, unknown>) => z.string().min(1).max(200).parse(headers['idempotency-key']);
const idOf = (params: unknown) => z.object({ signalId: z.string().uuid() }).strict().parse(params).signalId;

export function registerUnknownSignalRoutes(app: FastifyInstance, environment: string): void {
  app.get('/api/unknown-signals', { preHandler: requireAuth }, async req => {
    z.object({}).strict().parse(req.query ?? {});
    const me = await app.projections.commander(req.accountId!);
    const [list, context] = await Promise.all([unknownSignalsForPlayer(app.db, me.playerId, app.clock), unknownSignalContext(app.db, me.playerId)]);
    return { ...list, ...context };
  });
  app.post('/api/unknown-signals/:signalId/dispatch', { preHandler: requireAuth }, async req => {
    const id = idOf(req.params);
    const body = z.object({ originPlanetId: z.string().uuid(), fleet: z.record(z.string(), z.number().finite().int().positive()) }).strict().parse(req.body);
    const me = await app.projections.commander(req.accountId!);
    return dispatchUnknownSignal(app.db, me.playerId, id, body.originPlanetId, body.fleet, keyOf(req.headers), app.clock);
  });
  app.get('/api/unknown-signals/:signalId', { preHandler: requireAuth }, async req => {
    const id = idOf(req.params);
    const me = await app.projections.commander(req.accountId!);
    const { signals } = await unknownSignalsForPlayer(app.db, me.playerId, app.clock, id);
    if (!signals[0]) throw new GameError('UNKNOWN_SIGNAL_NOT_FOUND', 'That signal no longer exists', 404);
    return { signal: signals[0] };
  });
  app.post('/api/unknown-signals/:signalId/recall', { preHandler: requireAuth }, async req => {
    const id = idOf(req.params);
    z.object({}).strict().parse(req.body ?? {});
    const me = await app.projections.commander(req.accountId!);
    return recallUnknownSignal(app.db, me.playerId, id, keyOf(req.headers), app.clock);
  });
  if (environment !== 'production') app.post('/api/dev/unknown-signal', { preHandler: requireAuth }, async req => {
    const body = z.object({ outcome: z.enum(['RESOURCES', 'ENERGY', 'DERELICT', 'PIRATES', 'SKIN']) }).strict().parse(req.body);
    const me = await app.projections.commander(req.accountId!);
    return devUnknownSignal(app.db, me.playerId, body.outcome, app.clock, environment);
  });
}
