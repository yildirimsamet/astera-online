import { and, eq } from 'drizzle-orm';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { FLEET_V2_HULLS } from '@astera/rules';
import { z } from 'zod';
import { planets } from '../db/schema.js';
import {
  launchIntergalacticConvoy,
  type IntergalacticConvoyLaunch,
} from '../services/intergalacticConvoyRaid.js';
import { idempotentMutation } from '../services/idempotency.js';
import { commanderForAccount, capitalPlanet } from '../services/ownership.js';
import { GameError } from '../services/planet.js';
import { planetView } from '../services/planetView.js';
import { pendingThreads } from '../services/session.js';
import { requireAuth } from './auth.js';

const fleetFields = Object.fromEntries(FLEET_V2_HULLS.map((hull) => [
  hull,
  z.number().int().positive().max(Number.MAX_SAFE_INTEGER).optional(),
]));
const convoyFleet = z.object(fleetFields).strict().refine(
  (fleet) => Object.keys(fleet).length > 0,
  'Send at least one craft',
);

const convoyLaunchBody = z.object({
  originPlanetId: z.string().uuid(),
  occurrenceId: z.string().uuid(),
  fleet: convoyFleet,
  quotedAt: z.string().datetime({ offset: true }),
  quotedFlightSeconds: z.number().finite().nonnegative(),
  quotedArriveAt: z.string().datetime({ offset: true }),
}).strict();

const idempotencyKey = (req: FastifyRequest): string => {
  const parsed = z.string().min(8).max(128).safeParse(req.headers['idempotency-key']);
  if (!parsed.success) {
    throw new GameError('IDEMPOTENCY_KEY_REQUIRED', 'A valid idempotency-key header is required', 400);
  }
  return parsed.data;
};

type WireLaunch = Omit<
  IntergalacticConvoyLaunch,
  'departAt' | 'arriveAt' | 'engagementEndsAt' | 'homeAt'
> & {
  departAt: string;
  arriveAt: string;
  engagementEndsAt: string;
  homeAt: string;
};

const wireLaunch = (launch: IntergalacticConvoyLaunch): WireLaunch => ({
  ...launch,
  departAt: launch.departAt.toISOString(),
  arriveAt: launch.arriveAt.toISOString(),
  engagementEndsAt: launch.engagementEndsAt.toISOString(),
  homeAt: launch.homeAt.toISOString(),
});

/**
 * A REPLAY RE-READS VOLATILE D53 PROJECTIONS INSTEAD OF RESTORING OLD STATE.
 *
 * A DELIBERATE DEPARTURE FROM "IN THE SAME TRANSACTION", AND THE ONE ROUTE THAT
 * NEEDS IT. D53 says a mutation answers with the authoritative planet view its own
 * GET would give, read inside the mutating transaction — which is right precisely
 * because it stops a stale read landing after the write. This launch is idempotent,
 * so its answer is also REPLAYED: `request_log` stores the immutable command result
 * and hands it back to a retry of the same key, possibly minutes later.
 *
 * A stored `planet` and `pending` would then be a snapshot from that earlier
 * instant, and writing it into the client cache would roll the world BACKWARDS past
 * everything that happened in between — the exact failure D53 exists to prevent,
 * arriving through the door marked "safe retry". So only the immutable half of the
 * answer is stored, and the volatile half is hydrated here, after the command has
 * committed, on both the first response and every replay.
 *
 * The projection is therefore never older than the launch; it may be newer, which
 * is the direction that is always safe.
 */
async function freshProjection(
  app: FastifyInstance,
  playerId: string,
  requestedPlanetId: string,
) {
  return app.db.transaction(async (tx) => {
    const [stillMine] = await tx.select({ id: planets.id }).from(planets).where(and(
      eq(planets.id, requestedPlanetId),
      eq(planets.controllerPlayerId, playerId),
    )).limit(1);
    const projectionPlanetId = stillMine?.id ?? (await capitalPlanet(tx, playerId)).id;
    const planet = await planetView(tx, projectionPlanetId, app.clock);
    const pending = await pendingThreads(tx, projectionPlanetId, app.clock.now());
    return { planet, pending };
  });
}

export function registerIntergalacticConvoyRoutes(app: FastifyInstance): void {
  app.post('/api/intergalactic-convoy/launch', { preHandler: requireAuth }, async (req) => {
    const body = convoyLaunchBody.parse(req.body);
    const commander = await commanderForAccount(app.db, req.accountId!);
    const now = app.clock.now();
    const immutable = await idempotentMutation(app.db, {
      playerId: commander.playerId,
      operation: 'intergalactic-convoy.launch',
      key: idempotencyKey(req),
      body,
      now,
      onOutcome: (outcome) => {
        app.metrics.observeOperation('intergalactic-convoy.launch', outcome);
      },
    }, async (tx) => wireLaunch(await launchIntergalacticConvoy(tx, {
      planetId: body.originPlanetId,
      expectedPlayerId: commander.playerId,
      order: {
        occurrenceId: body.occurrenceId,
        fleet: body.fleet,
        quotedAt: new Date(body.quotedAt),
        quotedFlightSeconds: body.quotedFlightSeconds,
        quotedArriveAt: new Date(body.quotedArriveAt),
      },
      clock: { now: () => now },
    })));
    return {
      ...immutable,
      ...await freshProjection(app, commander.playerId, body.originPlanetId),
    };
  });
}
