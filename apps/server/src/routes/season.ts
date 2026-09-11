import { and, eq, gte, sql } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { RIVAL, SERVERS } from '@astera/rules';
import {
  planets,
  playerRivals,
  players,
  seasonResults,
  seasons,
  shards,
} from '../db/schema.js';
import type { Queryable } from '../db/client.js';
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
        playerId: players.id,
        shieldUntil: players.newcomerShieldUntil,
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
      /** Up to `RIVAL.max` marks, each carrying the slot the disc colours it by. D183. */
      rivals: await rivalsOf(app.db, row.playerId),
      /**
       * THE COMMANDER'S OWN FIRST-DAY SHIELD. D183.
       *
       * Null once it is spent or expired, which is also the ordinary state. On this
       * payload because the launch surface has to say what a raid COSTS before it is
       * pressed — a shield spent without being offered is a shield the player did not
       * choose to spend, and `SHIELD_WOULD_DROP` is the refusal that would otherwise
       * be the first they heard of it.
       */
      shieldUntil: row.shieldUntil !== null && row.shieldUntil > app.clock.now()
        ? row.shieldUntil
        : null,
    };
  });

  /**
   * THE COMMANDERS THIS ONE IS WATCHING, AND THE MARKS ARE FREE TO MOVE. D103 · D183.
   *
   * The mark used to COMMIT: the first probe, battle or Death Star between the two
   * commanders froze it for the rest of the season, and every later press of the
   * control was answered with `RIVAL_COMMITTED`. Owner instruction reverses that —
   * players disliked it, and it was the wrong shape for what the mark is. A Rival
   * is a bookmark on a disc of three hundred worlds, not a declaration; a second
   * press of the same commander clears it, and any world may be marked at any time.
   *
   * AND THERE ARE UP TO `RIVAL.max` OF THEM NOW. D183, owner instruction. One mark
   * is the right shape for a duel and the wrong one for the game being played: a
   * commander with three colonies has three neighbours worth watching before they
   * have an enemy, and the single mark meant choosing which of them to forget.
   *
   * THE PRESS IS A TOGGLE ON THE COMMANDER, NOT ON THE WORLD. D97's reasoning: the
   * mark is about a person, and a commander who holds four colonies would otherwise
   * eat four of the five slots. Pressing any world of an already-marked commander
   * clears that mark.
   *
   * A FULL SET REFUSES RATHER THAN EVICTING. Silently dropping the oldest would
   * make a control that is supposed to remember things forget one without saying
   * so — the exact failure a bookmark cannot have.
   *
   * The encounter history the old lock read is untouched. Battles, strikes and probe
   * readings are still recorded, because the reports, the dossier and the recap are
   * built on them — nothing reads them to refuse anything any more.
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

      // `null` empties the disc — the one gesture that clears every mark at once.
      if (body.planetId === null) {
        await tx.delete(playerRivals).where(eq(playerRivals.playerId, me.playerId));
        return { rivals: [] };
      }

      /*
        CLEARING A MARK NEVER ASKS WHETHER THE WORLD IS STILL THERE.

        A marked world can be reclaimed or wiped from the galaxy, and the mark then
        pointed at nothing the commander could press twice — the only way out was
        the menu's "clear the lost marker", which sent `null` and took the other
        four with it. Removing a mark by the planet it was placed on is checked
        FIRST, so a dead anchor is exactly as easy to clear as a live one.
      */
      const byAnchor = await tx
        .delete(playerRivals)
        .where(and(
          eq(playerRivals.playerId, me.playerId),
          eq(playerRivals.planetId, body.planetId),
        ))
        .returning({ slot: playerRivals.slot });
      if (byAnchor.length > 0) return { rivals: await rivalsOf(tx, me.playerId) };

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

      /*
        THE WHOLE SET, UNDER THE COMMANDER'S OWN ROW LOCK.

        `FOR UPDATE` above is on `players`, so two presses from one account
        serialise here rather than racing for a slot — which is what the unique
        index on `(player_id, slot)` would otherwise have to catch as an error.
      */
      const held = await tx
        .select({ targetPlayerId: playerRivals.targetPlayerId, slot: playerRivals.slot })
        .from(playerRivals)
        .where(eq(playerRivals.playerId, me.playerId));

      const already = held.find((mark) => mark.targetPlayerId === target.playerId);
      if (already) {
        await tx.delete(playerRivals).where(and(
          eq(playerRivals.playerId, me.playerId),
          eq(playerRivals.targetPlayerId, target.playerId),
        ));
        return { rivals: await rivalsOf(tx, me.playerId) };
      }

      if (held.length >= RIVAL.max) {
        throw new GameError(
          'RIVAL_LIMIT',
          `You are already watching ${String(RIVAL.max)} commanders. Clear one first.`,
          409,
          { max: RIVAL.max },
        );
      }

      /*
        THE LOWEST FREE SLOT, BECAUSE A SLOT IS A COLOUR.

        Not `held.length`: clearing the second of three marks would then hand the
        next one a colour already on the disc. The lowest free index also means a
        commander with two marks is shown the first two colours rather than the
        first and the fourth, which is what makes the set read as a set.
      */
      const taken = new Set(held.map((mark) => mark.slot));
      let slot = 0;
      while (taken.has(slot)) slot += 1;

      await tx.insert(playerRivals).values({
        playerId: me.playerId,
        planetId: body.planetId,
        targetPlayerId: target.playerId,
        slot,
      });
      return { rivals: await rivalsOf(tx, me.playerId) };
    });
  });
}

/**
 * EVERY MARK THIS COMMANDER IS KEEPING, IN SLOT ORDER. D183.
 *
 * Slot order rather than insertion order so a legend, a rail and the disc all list
 * them the same way — the slot is the mark's identity, so it is also its place.
 */
async function rivalsOf(
  db: Queryable,
  playerId: string,
): Promise<{ planetId: string; playerId: string; slot: number }[]> {
  const rows = await db
    .select({
      planetId: playerRivals.planetId,
      targetPlayerId: playerRivals.targetPlayerId,
      slot: playerRivals.slot,
    })
    .from(playerRivals)
    .where(eq(playerRivals.playerId, playerId))
    .orderBy(playerRivals.slot);
  return rows.map((row) => ({
    planetId: row.planetId,
    playerId: row.targetPlayerId,
    slot: row.slot,
  }));
}
