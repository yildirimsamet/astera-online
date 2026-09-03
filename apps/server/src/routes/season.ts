import { and, eq, gte, sql } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { SERVERS } from '@astera/rules';
import {
  planets,
  players,
  seasonResults,
  seasons,
  shards,
} from '../db/schema.js';
import { addMinutes } from '../clock.js';
import { GameError } from '../services/planet.js';
import { requireAuth } from './auth.js';

/**
 * The clock of the galaxy the caller is standing in.
 *
 * DERIVED FROM THE PLAYER, NOT FROM CONFIGURATION. Until D21 this read a
 * `SHARD_CODE` environment variable, which is correct for exactly as long as there
 * is one galaxy — the moment there is more than one, an env var means every player is told
 * the season, the seed and the deadline of `EU-1` whichever galaxy they are
 * actually in. The seed is the worst of those: the client rebuilds the entire disc
 * and every asteroid orbit from it, so a wrong one draws a world the server does
 * not have, and mining resolves against rocks the player never saw.
 */
export function registerSeasonRoutes(app: FastifyInstance): void {
  app.get('/api/season', { preHandler: requireAuth }, async (req) => {
    const [row] = await app.db
      .select({
        season: seasons,
        shard: shards,
        accountId: players.accountId,
        rivalPlanetId: players.rivalPlanetId,
        rivalPlayerId: players.rivalPlayerId,
      })
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
    /**
     * AND HOW MANY HAVE BEEN HERE TODAY. Owner instruction.
     *
     * The live figure alone reads as an empty galaxy at every hour that is not
     * peak, because it is a five-minute slice of a game played in gaps. This is
     * the same column, the same index and the same grouped shape over a day, so
     * the second reading costs one more `count(*)` on a request that was already
     * being made — no presence table, no cache to invalidate, and nothing that can
     * fall out of step with the first figure.
     *
     * IT REFRESHES BECAUSE THE PAYLOAD DOES. `useSeason` re-reads once a minute
     * (see `queries.ts`), so the day figure moves as commanders arrive without a
     * broadcast per login — which at three hundred seats would be a shard event a
     * minute to move a number in a corner.
     */
    const today = addMinutes(app.clock.now(), -SERVERS.dayWindowMinutes);
    const [[count], [active], [seenToday], [result]] = await Promise.all([
      app.db
        .select({ n: sql<number>`count(*)::int` })
        .from(players)
        .where(eq(players.seasonId, row.season.id)),
      app.db
        .select({ n: sql<number>`count(*)::int` })
        .from(players)
        .where(and(eq(players.seasonId, row.season.id), gte(players.lastActiveAt, since))),
      app.db
        .select({ n: sql<number>`count(*)::int` })
        .from(players)
        .where(and(eq(players.seasonId, row.season.id), gte(players.lastActiveAt, today))),
      app.db
        .select()
        .from(seasonResults)
        .where(and(
          eq(seasonResults.seasonId, row.season.id),
          eq(seasonResults.accountId, row.accountId),
        )),
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
      rulesetVersion: row.season.rulesetVersion,
      players: count?.n ?? 0,
      online: active?.n ?? 0,
      onlineToday: seenToday?.n ?? 0,
      result: result ?? null,
      rivalPlanetId: row.rivalPlanetId,
      rivalPlayerId: row.rivalPlayerId,
    };
  });

  /**
   * THE ONE WORLD A COMMANDER IS WATCHING, AND IT IS FREE TO MOVE. D103.
   *
   * The mark used to COMMIT: the first probe, battle or Death Star between the two
   * commanders froze it for the rest of the season, and every later press of the
   * control was answered with `RIVAL_COMMITTED`. Owner instruction reverses that —
   * players disliked it, and it was the wrong shape for what the mark is. A Rival
   * is a bookmark on a disc of three hundred worlds, not a declaration; a second
   * press of the same world clears it, and any world may be marked at any time.
   *
   * The encounter history that check read is untouched. Battles, strikes and probe
   * readings are still recorded, because the reports, the dossier and the recap are
   * built on them — nothing reads them to refuse anything any more.
   *
   * The two refusals that remain are about targets that cannot exist: your own
   * world, and a world outside your galaxy.
   */
  app.post('/api/rival', { preHandler: requireAuth }, async (req) => {
    const body = z.object({ planetId: z.string().uuid().nullable() }).strict().parse(req.body);
    return app.db.transaction(async (tx) => {
      const [me] = await tx
        .select({ playerId: players.id, seasonId: players.seasonId, planetId: planets.id })
        .from(players)
        .innerJoin(planets, and(eq(planets.controllerPlayerId, players.id), eq(planets.kind, 'CAPITAL')))
        .where(eq(players.accountId, req.accountId!))
        .for('update')
        .limit(1);
      if (!me) throw new GameError('NO_PLANET', 'Join a galaxy first', 404);

      if (body.planetId !== null) {
        const [target] = await tx
          .select({ id: planets.id, playerId: planets.controllerPlayerId })
          .from(planets)
          .where(and(
            eq(planets.id, body.planetId),
            eq(planets.seasonId, me.seasonId),
            sql`${planets.controllerPlayerId} IS NOT NULL`,
          ))
          .limit(1);
        if (!target) {
          throw new GameError('RIVAL_NOT_VISIBLE', 'That world is not in your galaxy', 404);
        }
        if (target.playerId === me.playerId) {
          throw new GameError('RIVAL_SELF', 'You cannot mark your own world as a rival', 400);
        }
        if (!target.playerId) {
          throw new GameError('RIVAL_NOT_VISIBLE', 'That world has no commander', 404);
        }
        await tx.update(players).set({
          rivalPlanetId: body.planetId,
          rivalPlayerId: target.playerId,
        }).where(eq(players.id, me.playerId));
        return { rivalPlanetId: body.planetId, rivalPlayerId: target.playerId };
      }

      await tx
        .update(players)
        .set({ rivalPlanetId: null, rivalPlayerId: null })
        .where(eq(players.id, me.playerId));
      return { rivalPlanetId: null, rivalPlayerId: null };
    });
  });
}
