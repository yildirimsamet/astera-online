import { eq, sql } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { planets, players } from '../db/schema.js';
import { GameError } from '../services/planet.js';
import { liveSeason } from '../services/season.js';
import { joinSeason } from '../services/player.js';
import { requireAuth } from './auth.js';

/**
 * Getting into the galaxy.
 *
 * Auth creates an account; this places it on a world. Keeping them separate is
 * what lets an account outlive a season — the account keeps record and cosmetics,
 * the player row is wiped with the shard.
 */
export function registerSeasonRoutes(app: FastifyInstance, shardCode: string): void {
  const requireLiveSeason = async () => {
    const row = await liveSeason(app.db, shardCode);
    if (!row) throw new GameError('NO_SEASON', 'No galaxy is open right now', 404);
    return row;
  };

  /** The season clock. Public: knowing how long is left is what produces the sunset. */
  app.get('/api/season', { preHandler: requireAuth }, async () => {
    const { season, shard } = await requireLiveSeason();

    const [count] = await app.db
      .select({ n: sql<number>`count(*)::int` })
      .from(players)
      .where(eq(players.seasonId, season.id));

    return {
      seasonId: season.id,
      shard: shard.code,
      /**
       * The galaxy is never stored slot by slot — it is regenerated from this seed
       * wherever it is needed. Handing it to the client lets the 3D surface build
       * the disc and the asteroid orbits locally instead of downloading them, which
       * is what A5 meant by "nothing is stored that a formula and a clock can
       * derive". It reveals nothing: the layout is public, and every planet in it
       * is already returned by /api/galaxy.
       */
      seed: season.seed,
      status: season.status,
      startsAt: season.startsAt,
      endsAt: season.endsAt,
      playerCap: shard.playerCap,
      players: count?.n ?? 0,
    };
  });

  /**
   * Take a planet on the live season.
   *
   * Idempotent by construction: `joinSeason` returns the existing placement, so a
   * client that retries — or a player who reinstalls — lands on the same planet
   * rather than acquiring a second one.
   */
  app.post('/api/season/join', { preHandler: requireAuth }, async (req) => {
    const { season } = await requireLiveSeason();
    const joined = await joinSeason(app.db, req.accountId!, season.id, app.clock);

    const [planet] = await app.db
      .select()
      .from(planets)
      .where(eq(planets.id, joined.planetId));

    return {
      seasonId: season.id,
      playerId: joined.playerId,
      planetId: joined.planetId,
      planetName: planet?.name ?? '',
      slotIndex: joined.slotIndex,
    };
  });
}
