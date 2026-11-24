import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { requireAuth } from './auth.js';
import { idempotentMutation } from '../services/idempotency.js';
import { hopFleet, hopFleetTx, jumpFleet, jumpFleetTx, retargetAttack, retargetAttackTx } from '../services/moonMovement.js';
import { orderMoon, orderMoonTx } from '../services/moonBuild.js';
import { listMoonScans, scanFromMoon, scanFromMoonTx } from '../services/moonScan.js';
import { commanderForAccount, ownedPlanet } from '../services/ownership.js';
import { buildPlanetResult } from '../services/planetView.js';

/**
 * MOON ROUTES (ay entegrasyon planı §6.6, §6.21). Every refusal is a `GameError` from the service; the hull
 * names are checked there too, so an unknown hull and an emplacement get the same `HULL_CANNOT_HOP`.
 */
const hopBody = z.object({
  direction: z.enum(['UP', 'DOWN']),
  fleet: z.record(z.string(), z.number().int().min(0).max(2_147_483_647)),
}).strict();

function optionalIdempotencyKey(req: FastifyRequest): string | undefined {
  return req.headers['idempotency-key'] === undefined
    ? undefined
    : z.string().min(8).max(128).parse(req.headers['idempotency-key']);
}

export function registerMoonRoutes(app: FastifyInstance): void {
  app.post('/api/planets/:planetId/moon/hop', { preHandler: requireAuth }, async (req) => {
    const { planetId } = z.object({ planetId: z.string().uuid() }).strict().parse(req.params);
    const body = hopBody.parse(req.body);
    const key = optionalIdempotencyKey(req);
    const owner = await ownedPlanet(app.db, req.accountId!, planetId);
    const format = (move: Awaited<ReturnType<typeof hopFleet>>) => (
      { id: move.id, kind: move.kind, fleet: move.fleet, departAt: move.departAt, arriveAt: move.arriveAt }
    );
    if (key) {
      return idempotentMutation(
        app.db,
        { playerId: owner.playerId, operation: `moon.hop:${owner.planetId}`, key, body, now: app.clock.now() },
        async (tx) => format(await hopFleetTx(tx, owner.playerId, owner.planetId, body.direction, body.fleet, app.clock)),
      );
    }
    return format(await hopFleet(app.db, owner.playerId, owner.planetId, body.direction, body.fleet, app.clock));
  });

  /** The Moon Gate (§6.11): jump a fleet from this world's moon to another of the caller's moons. */
  app.post('/api/planets/:planetId/moon/jump', { preHandler: requireAuth }, async (req) => {
    const { planetId } = z.object({ planetId: z.string().uuid() }).strict().parse(req.params);
    const body = z.object({ toPlanetId: z.string().uuid(), fleet: hopBody.shape.fleet }).strict().parse(req.body);
    const key = optionalIdempotencyKey(req);
    const owner = await ownedPlanet(app.db, req.accountId!, planetId);
    const format = (move: Awaited<ReturnType<typeof jumpFleet>>) => (
      { id: move.id, kind: move.kind, fleet: move.fleet, fuelPaid: move.fuelPaid, departAt: move.departAt, arriveAt: move.arriveAt }
    );
    if (key) {
      return idempotentMutation(
        app.db,
        { playerId: owner.playerId, operation: `moon.jump:${owner.planetId}`, key, body, now: app.clock.now() },
        async (tx) => format(await jumpFleetTx(tx, owner.playerId, owner.planetId, body.toPlanetId, body.fleet, app.clock)),
      );
    }
    return format(await jumpFleet(app.db, owner.playerId, owner.planetId, body.toPlanetId, body.fleet, app.clock));
  });

  /** S8, V29: build a Common moon on this world's construction line. */
  app.post('/api/planets/:planetId/moon/build', { preHandler: requireAuth }, async (req) => {
    const { planetId } = z.object({ planetId: z.string().uuid() }).strict().parse(req.params);
    z.object({}).strict().parse(req.body ?? {});
    const key = optionalIdempotencyKey(req);
    const owner = await ownedPlanet(app.db, req.accountId!, planetId);
    if (key) {
      return idempotentMutation(
        app.db,
        { playerId: owner.playerId, operation: `moon.build:${owner.planetId}`, key, body: {}, now: app.clock.now() },
        async (tx) => buildPlanetResult(await orderMoonTx(tx, owner.planetId, app.clock, owner.playerId)),
      );
    }
    return orderMoon(app.db, owner.planetId, app.clock, owner.playerId);
  });

  /** Gözcü (§6.12): photograph the routes into and out of a world in this moon's range. */
  app.post('/api/planets/:planetId/moon/scan', { preHandler: requireAuth }, async (req) => {
    const { planetId } = z.object({ planetId: z.string().uuid() }).strict().parse(req.params);
    const body = z.object({ targetPlanetId: z.string().uuid() }).strict().parse(req.body);
    const key = optionalIdempotencyKey(req);
    const owner = await ownedPlanet(app.db, req.accountId!, planetId);
    if (key) {
      return idempotentMutation(
        app.db,
        { playerId: owner.playerId, operation: `moon.scan:${owner.planetId}`, key, body, now: app.clock.now() },
        async (tx) => scanFromMoonTx(tx, owner.playerId, owner.planetId, body.targetPlanetId, app.clock),
      );
    }
    return scanFromMoon(app.db, owner.playerId, owner.planetId, body.targetPlanetId, app.clock);
  });

  app.get('/api/intel/moon-scans', { preHandler: requireAuth }, async (req) => {
    const owner = await commanderForAccount(app.db, req.accountId!);
    return { scans: await listMoonScans(app.db, owner.playerId) };
  });

  /** S13: switch an own raid in the air between the world's planet and its moon (§6.8). */
  app.post('/api/missions/:missionId/target-body', { preHandler: requireAuth }, async (req) => {
    const { missionId } = z.object({ missionId: z.string().uuid() }).strict().parse(req.params);
    const body = z.object({ body: z.enum(['PLANET', 'MOON']) }).strict().parse(req.body);
    const key = optionalIdempotencyKey(req);
    const owner = await commanderForAccount(app.db, req.accountId!);
    if (key) {
      return idempotentMutation(
        app.db,
        { playerId: owner.playerId, operation: `moon.retarget:${missionId}`, key, body, now: app.clock.now() },
        async (tx) => retargetAttackTx(tx, owner.playerId, missionId, body.body, app.clock),
      );
    }
    return retargetAttack(app.db, owner.playerId, missionId, body.body, app.clock);
  });
}
