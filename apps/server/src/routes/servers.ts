import { eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { planets } from '../db/schema.js';
import { joinSeason } from '../services/player.js';
import { currentPlacement, listServers, resolveJoinTarget } from '../services/servers.js';
import { optionalAuth, requireAuth } from './auth.js';

/** Shard codes are ours, not the player's — but they still arrive over the wire. */
const codeParams = z.object({ code: z.string().trim().min(1).max(32) });

/**
 * THE LOBBY. D21.
 *
 * Choosing a galaxy is the first real decision the game asks for, and the list has
 * to be enough to make it: how many worlds are taken, how many commanders are in
 * there right now, and which door is actually open.
 */
export function registerServerRoutes(app: FastifyInstance): void {
  /**
   * Every galaxy and its state.
   *
   * PUBLIC, with one extra fact for a caller who is signed in. A player has to be
   * able to see whether this world has anyone in it before deciding to make an
   * account, and the payload reveals nothing about any individual — two counts and
   * a status per galaxy, no names, no planets, no ladder.
   */
  app.get('/api/servers', { preHandler: optionalAuth }, async (req) => {
    const servers = await listServers(app.db, app.clock);
    const placement = req.accountId ? await currentPlacement(app.db, req.accountId) : null;

    return {
      servers: servers.map((s) => ({
        code: s.code,
        name: s.name,
        ordinal: s.ordinal,
        planets: s.planets,
        capacity: s.capacity,
        online: s.online,
        status: s.status,
        endsAt: s.seasonEndsAt,
        /** True for the one galaxy this account already commands a planet in. */
        yours: placement?.shardCode === s.code,
      })),
      /** Where the caller already is. Null means the choice is still theirs. */
      placement: placement ? { shard: placement.shardCode, name: placement.shardName } : null,
    };
  });

  /**
   * Take a planet in a named galaxy.
   *
   * Every rule that can refuse this lives in `resolveJoinTarget` and `joinSeason`,
   * and both refuse with a code the interface can act on: SERVER_LOCKED names the
   * galaxy to try instead, ALREADY_PLACED means the account is spoken for, and
   * SHARD_FULL means fifty people got there first.
   *
   * Idempotent for the galaxy the caller is already in — `joinSeason` returns the
   * existing planet — so a retried request on a flaky phone connection cannot
   * produce a second world.
   *
   * AND THAT PROMISE WAS BEING BROKEN BY THE GATE IN FRONT OF IT. D52a.
   * `resolveJoinTarget` runs first and refuses on the galaxy's STATUS, so once the
   * caller's own galaxy filled up — which is the normal end state of every galaxy —
   * a retry answered `SHARD_FULL` and never reached the idempotent path. A client
   * retry, a reinstall or a double-tap locked a placed commander out of their own
   * world. The existing idempotency test never saw it because its galaxy still had
   * room.
   *
   * A caller who is already IN this galaxy is not joining it, so none of the
   * capacity rules apply to them: their placement is looked up first and answered
   * directly. Everyone else goes through the gate exactly as before.
   */
  app.post('/api/servers/:code/join', { preHandler: requireAuth }, async (req) => {
    const { code } = codeParams.parse(req.params);

    const placement = await currentPlacement(app.db, req.accountId!);
    if (placement?.shardCode === code) {
      const seated = await joinSeason(app.db, req.accountId!, placement.seasonId, app.clock);
      return {
        shard: placement.shardCode,
        shardName: placement.shardName,
        seasonId: seated.seasonId,
        playerId: seated.playerId,
        planetId: seated.planetId,
        planetName: placement.planetName,
        slotIndex: seated.slotIndex,
      };
    }

    const target = await resolveJoinTarget(app.db, code, app.clock);
    const joined = await joinSeason(app.db, req.accountId!, target.seasonId, app.clock);

    const [planet] = await app.db
      .select({ name: planets.name })
      .from(planets)
      .where(eq(planets.id, joined.planetId));

    return {
      shard: target.shardCode,
      shardName: target.shardName,
      seasonId: joined.seasonId,
      playerId: joined.playerId,
      planetId: joined.planetId,
      planetName: planet?.name ?? '',
      slotIndex: joined.slotIndex,
    };
  });
}
