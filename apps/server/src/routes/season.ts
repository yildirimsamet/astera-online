import { and, eq, gte, sql } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { SERVERS } from '@astera/rules';
import { planets, players, seasons, shards } from '../db/schema.js';
import { addMinutes } from '../clock.js';
import { GameError } from '../services/planet.js';
import { requireAuth } from './auth.js';

/**
 * The clock of the galaxy the caller is standing in.
 *
 * DERIVED FROM THE PLAYER, NOT FROM CONFIGURATION. Until D21 this read a
 * `SHARD_CODE` environment variable, which is correct for exactly as long as there
 * is one galaxy — the moment there are ten, an env var means every player is told
 * the season, the seed and the deadline of `EU-1` whichever galaxy they are
 * actually in. The seed is the worst of those: the client rebuilds the entire disc
 * and every asteroid orbit from it, so a wrong one draws a world the server does
 * not have, and mining resolves against rocks the player never saw.
 */
export function registerSeasonRoutes(app: FastifyInstance): void {
  app.get('/api/season', { preHandler: requireAuth }, async (req) => {
    const [row] = await app.db
      .select({ season: seasons, shard: shards, playerId: players.id })
      .from(players)
      .innerJoin(seasons, eq(players.seasonId, seasons.id))
      .innerJoin(shards, eq(seasons.shardId, shards.id))
      .where(eq(players.accountId, req.accountId!))
      .limit(1);

    if (!row) throw new GameError('NO_PLANET', 'Join a galaxy first', 404);

    /**
     * HOW MANY WORLDS, AND HOW MANY OF THEM HAVE SOMEBODY AT THE CONTROLS.
     *
     * `online` is here rather than on a second request because the caller already
     * reads this payload for the season clock, and a galaxy screen asking twice to
     * put one number in a corner is two round trips for one tap.
     *
     * The window is `SERVERS.onlineWindowMinutes`, the same one the server list
     * uses — deliberately, because two surfaces disagreeing about how many people
     * are in a galaxy is worse than either figure being wrong. It is generous on
     * purpose: this game is played in gaps, and a commander reading a battle
     * report for four minutes has not left.
     *
     * It leaks nothing. The population of a galaxy is already public on
     * `/api/servers` to somebody who has not even signed in.
     */
    const since = addMinutes(app.clock.now(), -SERVERS.onlineWindowMinutes);
    const [[count], [active]] = await Promise.all([
      app.db
        .select({ n: sql<number>`count(*)::int` })
        .from(planets)
        .where(eq(planets.seasonId, row.season.id)),
      app.db
        .select({ n: sql<number>`count(*)::int` })
        .from(players)
        .where(and(eq(players.seasonId, row.season.id), gte(players.lastActiveAt, since))),
    ]);

    return {
      seasonId: row.season.id,
      shard: row.shard.code,
      shardName: row.shard.name === '' ? row.shard.code : row.shard.name,
      /**
       * The galaxy is never stored slot by slot — it is regenerated from this seed
       * wherever it is needed. Handing it to the client lets the 3D surface build
       * the disc and the asteroid orbits locally instead of downloading them, which
       * is what A5 meant by "nothing is stored that a formula and a clock can
       * derive". It reveals nothing: the layout is public, and every planet in it
       * is already returned by /api/galaxy.
       */
      seed: row.season.seed,
      status: row.season.status,
      startsAt: row.season.startsAt,
      endsAt: row.season.endsAt,
      playerCap: row.shard.playerCap,
      players: count?.n ?? 0,
      online: active?.n ?? 0,
    };
  });
}
