import { and, eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { planets, players } from '../db/schema.js';
import { mobileFleetSchema } from '../schemas/fleet.js';
import { GameError } from '../services/planet.js';
import { ownedPlanet } from '../services/ownership.js';
import { launchTrade } from '../services/trade.js';
import { requireAuth } from './auth.js';

/**
 * A pile of resources, as a client is allowed to state one.
 *
 * Whole units only, never negative, and no third opinion about which resources
 * exist: `quoteTrade` still re-checks every figure inside the transaction and is
 * the authority on what the merchant will take. This is the untrusted-boundary
 * parse, not the rule.
 */
const resources = z.object({
  alloy: z.number().int().min(0),
  crystal: z.number().int().min(0),
  deuterium: z.number().int().min(0),
}).strict();

const tradeBody = z.object({
  originPlanetId: z.string().uuid().optional(),
  occurrenceId: z.string().uuid(),
  /*
    DERIVED FROM THE RULES CATALOGUE, NEVER TYPED OUT AGAIN. `mobileFleetSchema` is
    the same parser every other launch boundary uses, so a hull the game adds is
    legal here on the day it is added and a hull it retires is refused here on the
    day it is retired.
  */
  fleet: mobileFleetSchema,
  give: resources,
  want: resources,
}).strict();

/**
 * TİCARET GEMİSİ — sending a convoy. D156.
 *
 * ONE ROUTE, AND DELIBERATELY NO `GET`. The merchant already reaches the client on
 * `GET /api/galaxy/events`, orbit and all — it is an announced public moment, so
 * there is nothing to gate and nothing to sell. The client then solves the
 * rendezvous with the SAME `interceptOrbit` the server runs, off the same
 * published elements, which is what stops the sheet and the launch disagreeing
 * about the meeting minute. A second read here would be a second answer to a
 * question that already has one.
 *
 * The business is all in `trade.ts`: this parses an untrusted body, resolves which
 * of the caller's worlds is launching, and lets the service refuse.
 */
export function registerTradeRoutes(app: FastifyInstance): void {
  const capitalOf = async (accountId: string) => {
    const rows = await app.db
      .select({ planetId: planets.id, seasonId: players.seasonId, playerId: players.id })
      .from(players)
      .innerJoin(
        planets,
        and(eq(planets.controllerPlayerId, players.id), eq(planets.kind, 'CAPITAL')),
      )
      .where(eq(players.accountId, accountId))
      .limit(1);
    const row = rows[0];
    if (!row) throw new GameError('NO_PLANET', 'Join a galaxy first', 404);
    return row;
  };

  app.post('/api/trade/launch', { preHandler: requireAuth }, async (req) => {
    const body = tradeBody.parse(req.body);
    const legacy = await capitalOf(req.accountId!);
    const planetId = body.originPlanetId ?? legacy.planetId;
    const owner = body.originPlanetId
      ? await ownedPlanet(app.db, req.accountId!, body.originPlanetId)
      : legacy;
    return launchTrade(
      app.db,
      planetId,
      {
        occurrenceId: body.occurrenceId,
        fleet: body.fleet,
        give: body.give,
        want: body.want,
      },
      app.clock,
      owner.playerId,
    );
  });
}
