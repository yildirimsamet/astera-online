import { and, eq } from 'drizzle-orm';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { MOBILE_HULLS } from '@astera/rules';
import { monumentProbes, monumentWaves } from '../db/schema.js';
import { commanderForAccount } from '../services/ownership.js';
import { idempotentMutation } from '../services/idempotency.js';
import { quoteMonument, sendMonument } from '../services/monument.js';
import { recallMonument } from '../services/monumentMovement.js';
import { launchMonumentProbe } from '../services/monumentProbe.js';
import { assertMonumentAvailable, projectMonumentTargets, quoteMonumentRecall, readMonuments, reconcileMonumentViews } from '../services/monumentView.js';
import { requireAuth } from './auth.js';
import { GameError } from '../services/planet.js';
import type { Db, Tx } from '../db/client.js';

const targetParam = z.object({ monumentId: z.string().uuid() }).strict();
const waveParam = z.object({ waveId: z.string().uuid() }).strict();
const allowed: ReadonlySet<string> = new Set(MOBILE_HULLS);
const sendBody = z.object({ originPlanetId: z.string().uuid(), purpose: z.enum(['ATTACK', 'REINFORCE']),
  fleet: z.record(z.number().int().nonnegative().max(2_147_483_647)).refine((fleet) =>
    Object.keys(fleet).every((hull) => allowed.has(hull)) && Object.values(fleet).some((count) => count > 0), 'Choose a nonempty mobile fleet'),
  acknowledgeShieldLoss: z.boolean().default(false), acknowledgeRadiationLoss: z.boolean().default(false),
}).strict();
const recallBody = z.object({ selections: z.array(z.object({ lotId: z.string().uuid(), count: z.number().int().positive().max(2_147_483_647) }).strict()).nonempty().max(10_000) }).strict();
const probeBody = z.object({ originPlanetId: z.string().uuid() }).strict();
const keyOf = (req: FastifyRequest): string => z.string().min(8).max(128).parse(req.headers['idempotency-key']);

function serializationFailure(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  if ('code' in error) return error.code === '40001';
  return 'cause' in error && serializationFailure(error.cause);
}

/** A view spans several manifest queries. Retry an overdue transition against a fresh snapshot if another writer won. */
async function consistentMonumentRead<T>(db: Db, read: (tx: Tx) => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try { return await db.transaction(read, { isolationLevel: 'repeatable read' }); }
    catch (error) { if (attempt >= 2 || !serializationFailure(error)) throw error; }
  }
}

export function registerMonumentRoutes(app: FastifyInstance): void {
  const reader = async (req: FastifyRequest) => ({ ...await commanderForAccount(app.db, req.accountId!), at: app.clock.now(), adminUsernames: [...app.adminUsernames] });
  app.get('/api/monuments', { preHandler: requireAuth }, async (req) => {
    z.object({}).strict().parse(req.query ?? {});
    const self = await reader(req);
    return consistentMonumentRead(app.db, (tx) => readMonuments(tx, self));
  });
  app.get('/api/monuments/:monumentId', { preHandler: requireAuth }, async (req) => {
    const { monumentId } = targetParam.parse(req.params);
    z.object({}).strict().parse(req.query ?? {});
    const self = await reader(req);
    return consistentMonumentRead(app.db, (tx) => readMonuments(tx, self, monumentId));
  });
  app.post('/api/monuments/:monumentId/quote', { preHandler: requireAuth }, async (req) => {
    const { monumentId } = targetParam.parse(req.params);
    const body = sendBody.parse(req.body);
    const self = await reader(req);
    return consistentMonumentRead(app.db, async (tx) => {
      await assertMonumentAvailable(tx, self.seasonId, monumentId, true, self.at);
      await projectMonumentTargets(tx, self, [monumentId]);
      return quoteMonument(tx, { ...body, monumentId, senderPlayerId: self.playerId, clock: { now: () => self.at } });
    });
  });
  app.post('/api/monuments/:monumentId/send', { preHandler: requireAuth }, async (req) => {
    const { monumentId } = targetParam.parse(req.params);
    const body = sendBody.parse(req.body);
    const self = await reader(req);
    return idempotentMutation(app.db, { playerId: self.playerId, operation: 'monument.send', key: keyOf(req), body: { monumentId, ...body }, now: self.at }, async (tx) => {
      await assertMonumentAvailable(tx, self.seasonId, monumentId, true, self.at);
      await reconcileMonumentViews(tx, self, monumentId);
      return sendMonument(tx, { ...body, monumentId, senderPlayerId: self.playerId, clock: { now: () => self.at } });
    });
  });
  app.post('/api/monuments/:monumentId/probe', { preHandler: requireAuth }, async (req) => {
    const { monumentId } = targetParam.parse(req.params);
    const body = probeBody.parse(req.body);
    const self = await reader(req);
    return idempotentMutation(app.db, { playerId: self.playerId, operation: 'monument.probe', key: keyOf(req), body: { monumentId, ...body }, now: self.at }, async (tx) => {
      await assertMonumentAvailable(tx, self.seasonId, monumentId, true, self.at);
      await reconcileMonumentViews(tx, self, monumentId);
      const launched = await launchMonumentProbe(tx, { ...body, monumentId, playerId: self.playerId,
        clock: { now: () => self.at }, adminUsernames: self.adminUsernames });
      const [probe] = await tx.select({ id: monumentProbes.id, monumentId: monumentProbes.monumentId, status: monumentProbes.status,
        departAt: monumentProbes.departAt, arriveAt: monumentProbes.arriveAt }).from(monumentProbes).where(eq(monumentProbes.id, launched.probeId));
      return { probe, lossProbability: launched.lossChance, price: launched.price };
    });
  });
  app.post('/api/monuments/waves/:waveId/recall/quote', { preHandler: requireAuth }, async (req) => {
    const { waveId } = waveParam.parse(req.params);
    const body = recallBody.parse(req.body);
    const self = await reader(req);
    return consistentMonumentRead(app.db, (tx) => quoteMonumentRecall(tx, { ...self, ...body, waveId }));
  });
  app.post('/api/monuments/waves/:waveId/recall', { preHandler: requireAuth }, async (req) => {
    const { waveId } = waveParam.parse(req.params);
    const body = recallBody.parse(req.body);
    const self = await reader(req);
    return idempotentMutation(app.db, { playerId: self.playerId, operation: 'monument.recall', key: keyOf(req), body: { waveId, ...body }, now: self.at }, async (tx) => {
      const [wave] = await tx.select({ monumentId: monumentWaves.monumentId }).from(monumentWaves)
        .where(and(eq(monumentWaves.id, waveId), eq(monumentWaves.seasonId, self.seasonId)));
      if (!wave) throw new GameError('MONUMENT_WAVE_NOT_FOUND', 'No such wave', 404);
      await assertMonumentAvailable(tx, self.seasonId, wave.monumentId, true, self.at);
      await reconcileMonumentViews(tx, self, wave.monumentId);
      return recallMonument(tx, { ...body, waveId, playerId: self.playerId, clock: { now: () => self.at } });
    });
  });
}
