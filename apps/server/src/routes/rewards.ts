import { and, eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { planets, players } from '../db/schema.js';
import { GameError } from '../services/planet.js';
import { claimReward, rewardsView } from '../services/rewards.js';
import { requireAuth } from './auth.js';

/**
 * TWO ROUTES, AND THE SECOND ANSWERS WITH BOTH THINGS IT MOVED.
 *
 * A claim changes the reward panel AND the planet — resources land in storage and
 * Wealth moves with them — so it returns both, in the shapes the client's cache
 * already holds. That is the D53 rule applied to a new surface rather than
 * discovered on it later: `docs` still lists the mining launches as the two
 * mutations that cost a second round trip, and there was no reason to make this
 * the third.
 */
const claimBody = z.object({ id: z.string().min(1).max(64) });

export function registerRewardRoutes(app: FastifyInstance): void {
  const myPlanet = async (accountId: string): Promise<string> => {
    const rows = await app.db
      .select({ planetId: planets.id })
      .from(planets)
      .innerJoin(players, and(eq(planets.controllerPlayerId, players.id), eq(planets.kind, 'CAPITAL')))
      .where(eq(players.accountId, accountId))
      .limit(1);
    const planetId = rows[0]?.planetId;
    if (!planetId) throw new GameError('NO_PLANET', 'Join a galaxy first', 404);
    return planetId;
  };

  app.get('/api/rewards', { preHandler: requireAuth }, async (req) =>
    rewardsView(app.db, await myPlanet(req.accountId!), app.clock),
  );

  app.post('/api/rewards/claim', { preHandler: requireAuth }, async (req) => {
    const { id } = claimBody.parse(req.body);
    return claimReward(app.db, await myPlanet(req.accountId!), id, app.clock);
  });
}
