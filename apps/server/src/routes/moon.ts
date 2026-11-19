import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireAuth } from './auth.js';
import { hopFleet, jumpFleet, retargetAttack } from '../services/moonMovement.js';
import { listMoonScans, scanFromMoon } from '../services/moonScan.js';
import { commanderForAccount, ownedPlanet } from '../services/ownership.js';

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

  /** The Moon Gate (§6.11): jump a fleet from this world's moon to another of the caller's moons. */
  app.post('/api/planets/:planetId/moon/jump', { preHandler: requireAuth }, async (req) => {
    const { planetId } = z.object({ planetId: z.string().uuid() }).strict().parse(req.params);
    const body = z.object({ toPlanetId: z.string().uuid(), fleet: hopBody.shape.fleet }).strict().parse(req.body);
    const owner = await ownedPlanet(app.db, req.accountId!, planetId);
    const move = await jumpFleet(app.db, owner.playerId, owner.planetId, body.toPlanetId, body.fleet, app.clock);
    return { id: move.id, kind: move.kind, fleet: move.fleet, fuelPaid: move.fuelPaid, departAt: move.departAt, arriveAt: move.arriveAt };
  });

  /** Gözcü (§6.12): photograph the routes into and out of a world in this moon's range. */
  app.post('/api/planets/:planetId/moon/scan', { preHandler: requireAuth }, async (req) => {
    const { planetId } = z.object({ planetId: z.string().uuid() }).strict().parse(req.params);
    const { targetPlanetId } = z.object({ targetPlanetId: z.string().uuid() }).strict().parse(req.body);
    const owner = await ownedPlanet(app.db, req.accountId!, planetId);
    return scanFromMoon(app.db, owner.playerId, owner.planetId, targetPlanetId, app.clock);
  });

  app.get('/api/intel/moon-scans', { preHandler: requireAuth }, async (req) => {
    const owner = await commanderForAccount(app.db, req.accountId!);
    return { scans: await listMoonScans(app.db, owner.playerId) };
  });

  /** S13: switch an own raid in the air between the world's planet and its moon (§6.8). */
  app.post('/api/missions/:missionId/target-body', { preHandler: requireAuth }, async (req) => {
    const { missionId } = z.object({ missionId: z.string().uuid() }).strict().parse(req.params);
    const { body } = z.object({ body: z.enum(['PLANET', 'MOON']) }).strict().parse(req.body);
    const owner = await commanderForAccount(app.db, req.accountId!);
    return retargetAttack(app.db, owner.playerId, missionId, body, app.clock);
  });
}
