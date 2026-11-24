import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  completeNewcomerScenario,
  dismissNewcomerScenario,
  readNewcomerScenario,
  startNewcomerScenario,
} from '../services/newcomerScenario.js';
import { requireAuth } from './auth.js';

const emptyBody = z.object({}).strict();

/**
 * İNİŞ SONRASI İLK SAAT GÖREVLERİ ROUTES (plan 2026-11-20 §5.3, Faz 4; playtest 2026-11-23).
 *
 * Only lifecycle transitions live here (start, complete, dismiss). All actual gameplay steps
 * (mining, pirate raiding, probing) are performed by the player through the real game routes.
 */
export function registerNewcomerScenarioRoutes(app: FastifyInstance): void {
  app.get('/api/newcomer-scenario', { preHandler: requireAuth }, async (req) => {
    const self = await app.projections.commander(req.accountId!);
    const scenario = await readNewcomerScenario(app.db, self.playerId);
    return { scenario };
  });

  app.post('/api/newcomer-scenario/start', { preHandler: requireAuth }, async (req) => {
    emptyBody.parse(req.body ?? {});
    const self = await app.projections.commander(req.accountId!);
    return { scenario: await startNewcomerScenario(app.db, self.playerId, app.clock) };
  });

  app.post('/api/newcomer-scenario/complete', { preHandler: requireAuth }, async (req) => {
    emptyBody.parse(req.body ?? {});
    const self = await app.projections.commander(req.accountId!);
    return { scenario: await completeNewcomerScenario(app.db, self.playerId, app.clock) };
  });

  app.post('/api/newcomer-scenario/dismiss', { preHandler: requireAuth }, async (req) => {
    emptyBody.parse(req.body ?? {});
    const self = await app.projections.commander(req.accountId!);
    return { scenario: await dismissNewcomerScenario(app.db, self.playerId, app.clock) };
  });
}
