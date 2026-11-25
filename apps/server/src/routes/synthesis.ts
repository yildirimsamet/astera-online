import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { CAPSULE_IDS, SYNTHESIS } from '@astera/rules';
import { requireAuth } from './auth.js';
import { idempotentMutation } from '../services/idempotency.js';
import { commanderForAccount } from '../services/ownership.js';
import { buildPlanetResult } from '../services/planetView.js';
import { cancelSynthesis, startSynthesis, synthesisView } from '../services/synthesis.js';

/**
 * SENTEZ LABORATUVARI (plan 2026-11-24 §4.3). One read and two writes; each write answers with the
 * laboratory and the capital it paid from, so neither has to be fetched again (D53).
 */
const startBody = z.object({
  capsuleId: z.enum(CAPSULE_IDS),
  quantity: z.number().int().min(1).max(SYNTHESIS.maxBatch),
}).strict();

function optionalIdempotencyKey(req: FastifyRequest): string | undefined {
  return req.headers['idempotency-key'] === undefined
    ? undefined
    : z.string().min(8).max(128).parse(req.headers['idempotency-key']);
}

export function registerSynthesisRoutes(app: FastifyInstance): void {
  app.get('/api/synthesis', { preHandler: requireAuth }, async (req) => {
    const { playerId } = await commanderForAccount(app.db, req.accountId!);
    return synthesisView(app.db, playerId, app.clock);
  });

  app.post('/api/synthesis/start', { preHandler: requireAuth }, async (req) => {
    const body = startBody.parse(req.body);
    const key = optionalIdempotencyKey(req);
    const { playerId } = await commanderForAccount(app.db, req.accountId!);
    const run = (tx: Parameters<typeof startSynthesis>[0]) => startSynthesis(tx, playerId, body.capsuleId, body.quantity, app.clock);
    const result = key
      ? await idempotentMutation(app.db, { playerId, operation: 'synthesis.start', key, body, now: app.clock.now() }, async (tx) => buildPlanetResult(await run(tx)))
      : buildPlanetResult(await app.db.transaction(run));
    return result;
  });

  app.post('/api/synthesis/cancel', { preHandler: requireAuth }, async (req) => {
    z.object({}).strict().parse(req.body ?? {});
    const key = optionalIdempotencyKey(req);
    const { playerId } = await commanderForAccount(app.db, req.accountId!);
    const run = (tx: Parameters<typeof cancelSynthesis>[0]) => cancelSynthesis(tx, playerId, app.clock);
    return key
      ? idempotentMutation(app.db, { playerId, operation: 'synthesis.cancel', key, body: {}, now: app.clock.now() }, async (tx) => buildPlanetResult(await run(tx)))
      : buildPlanetResult(await app.db.transaction(run));
  });
}
