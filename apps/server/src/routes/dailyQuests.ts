import { and, eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { planets, players } from '../db/schema.js';
import { claimDailyQuest, dailyQuestsView } from '../services/dailyQuests.js';
import { GameError } from '../services/planet.js';
import { requireAuth } from './auth.js';

const claimBody = z.object({ id: z.string().min(1).max(32) });

/**
 * GÜNLÜK GÖREVLER (owner, 2026-11-24). Two routes, like the rewards': the panel, and a claim that answers
 * with both surfaces it moved — the panel and the planet — so neither has to refetch (D53).
 */
export function registerDailyQuestRoutes(app: FastifyInstance): void {
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

  app.get('/api/daily-quests', { preHandler: requireAuth }, async (req) =>
    dailyQuestsView(app.db, await myPlanet(req.accountId!), app.clock));

  app.post('/api/daily-quests/claim', { preHandler: requireAuth }, async (req) => {
    const { id } = claimBody.parse(req.body);
    return claimDailyQuest(app.db, await myPlanet(req.accountId!), id, app.clock);
  });
}
