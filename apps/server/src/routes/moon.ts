import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireAuth } from './auth.js';
import { hopFleet } from '../services/moonMovement.js';
import { ownedPlanet } from '../services/ownership.js';

/**
 * MOON ROUTES (ay entegrasyon planı §6.6, §6.21). Every refusal is a `GameError` from the service; the hull
 * names are checked there too, so an unknown hull and an emplacement get the same `HULL_CANNOT_HOP`.
 */
const hopBody = z.object({
  direction: z.enum(['UP', 'DOWN']),
  fleet: z.record(z.string(), z.number().int().min(0).max(2_147_483_647)),
}).strict();

export function registerMoonRoutes(app: FastifyInstance): void {
  app.post('/api/planets/:planetId/moon/hop', { preHandler: requireAuth }, async (req) => {
    const { planetId } = z.object({ planetId: z.string().uuid() }).strict().parse(req.params);
    const body = hopBody.parse(req.body);
    const owner = await ownedPlanet(app.db, req.accountId!, planetId);
    const move = await hopFleet(app.db, owner.playerId, owner.planetId, body.direction, body.fleet, app.clock);
    return { id: move.id, kind: move.kind, fleet: move.fleet, departAt: move.departAt, arriveAt: move.arriveAt };
  });
}
