import { eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { planets, players } from '../db/schema.js';
import { GameError } from '../services/planet.js';
import { readTelescopes } from '../services/intel.js';
import { publicWorlds } from '../services/publicGalaxy.js';
import { galaxyTraffic } from '../services/traffic.js';
import { requireAuth } from './auth.js';

/**
 * THE GALAXY, AS EVERYBODY SEES IT PLUS WHAT YOU HAVE EARNED.
 *
 * The public half — every world, its tier, its orbit and whether it has a dome —
 * is `services/publicGalaxy.ts`, because `/api/preview` serves the same projection
 * to a visitor who has no account. What is added here is the half that is yours:
 * which world is yours, and a fleet reading for anything your telescopes are
 * actually watching.
 */

export function registerGalaxyRoutes(app: FastifyInstance): void {
  /**
   * Every planet in the season, at the tier of detail this player has earned.
   *
   * THE FOG IS ENFORCED HERE. Fleet status is attached only for planets the caller
   * is actually watching, and only when their clarity permits it. A planet the
   * caller does not watch has no `fleet` key at all — there is nothing in the
   * payload for a modified client to reveal.
   */
  app.get('/api/galaxy', { preHandler: requireAuth }, async (req) => {
    const mine = await app.db
      .select({ player: players, planet: planets })
      .from(players)
      .innerJoin(planets, eq(planets.playerId, players.id))
      .where(eq(players.accountId, req.accountId!))
      .limit(1);
    const self = mine[0];
    if (!self) throw new GameError('NO_PLANET', 'Join a galaxy first', 404);

    const worlds = await publicWorlds(app.db, self.player.seasonId);

    const watching = await readTelescopes(app.db, self.player.id, app.clock);
    const byTarget = new Map(watching.map((w) => [w.targetPlanetId, w]));

    return {
      you: { planetId: self.planet.id, playerId: self.player.id },
      planets: worlds.map((world) => {
        const watch = byTarget.get(world.id);
        return {
          ...world,
          isSelf: world.id === self.planet.id,
          // Present only where earned. Absent is not "unknown" — it is "you are
          // not looking at this planet".
          ...(watch
            ? {
                fleet: {
                  status: watch.reading.status,
                  staleMinutes: Math.round(watch.reading.staleMinutes),
                  etaMinutes: watch.reading.etaMinutes,
                  clarity: watch.reading.state,
                },
              }
            : {}),
        };
      }),
    };
  });

  /**
   * Movement in the galaxy, deliberately unattributable.
   *
   * Exists so the 3D surface has life in it without handing away the intel layer:
   * contacts appear mid-flight only, offset by a seeded jitter wider than the
   * planets are spaced, and carry no id, owner, kind or destination. See
   * `services/traffic.ts` for why each of those three rules is load-bearing.
   */
  app.get('/api/galaxy/traffic', { preHandler: requireAuth }, async (req) => {
    const mine = await app.db
      .select({ player: players, planet: planets })
      .from(players)
      .innerJoin(planets, eq(planets.playerId, players.id))
      .where(eq(players.accountId, req.accountId!))
      .limit(1);
    const self = mine[0];
    if (!self) throw new GameError('NO_PLANET', 'Join a galaxy first', 404);

    return {
      contacts: await galaxyTraffic(
        app.db,
        self.player.seasonId,
        self.planet.id,
        app.clock.now(),
      ),
    };
  });

  /** The Dominion ladder. Public by design — competition needs a visible target. */
  app.get('/api/leaderboard', { preHandler: requireAuth }, async (req) => {
    const mine = await app.db
      .select()
      .from(players)
      .where(eq(players.accountId, req.accountId!))
      .limit(1);
    const self = mine[0];
    if (!self) throw new GameError('NO_PLANET', 'Join a galaxy first', 404);

    const rows = await app.db
      .select()
      .from(players)
      .where(eq(players.seasonId, self.seasonId));

    const ladder = rows
      .map((p) => ({
        playerId: p.id,
        name: p.name,
        dominion: Math.round(p.dominionTaken - p.dominionLost),
        wealth: Math.round(p.wealth),
      }))
      .sort((a, b) => b.dominion - a.dominion)
      .map((entry, i) => ({ rank: i + 1, ...entry }));

    return {
      ladder: ladder.slice(0, 50),
      you: ladder.find((e) => e.playerId === self.id) ?? null,
    };
  });
}
