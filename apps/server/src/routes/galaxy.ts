import { eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { buildings, planets, players } from '../db/schema.js';
import { GameError } from '../services/planet.js';
import { readTelescopes } from '../services/intel.js';
import { requireAuth } from './auth.js';

/**
 * Core level is exposed as a coarse TIER, never the exact number.
 *
 * Development level is public — you can see a planet is big — but knowing it
 * precisely is what a probe is for. Leaking the exact level for free would make
 * the cheapest tier of intel redundant.
 */
const coreTier = (level: number): number => Math.max(1, Math.ceil(level / 3));

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

    const rows = await app.db
      .select({ planet: planets, ownerName: players.name })
      .from(planets)
      .innerJoin(players, eq(planets.playerId, players.id))
      .where(eq(planets.seasonId, self.player.seasonId));

    // One query for every core level, rather than one per planet.
    const coreRows = await app.db
      .select({ planetId: buildings.planetId, level: buildings.level })
      .from(buildings)
      .where(eq(buildings.type, 'CORE'));
    const cores = new Map(coreRows.map((r) => [r.planetId, r.level]));

    const watching = await readTelescopes(app.db, self.player.id, app.clock);
    const byTarget = new Map(watching.map((w) => [w.targetPlanetId, w]));

    return {
      you: { planetId: self.planet.id, playerId: self.player.id },
      planets: rows.map((r) => {
        const watch = byTarget.get(r.planet.id);
        const isSelf = r.planet.id === self.planet.id;
        return {
          id: r.planet.id,
          name: r.planet.name,
          owner: r.ownerName,
          position: { x: r.planet.x, y: r.planet.y, z: r.planet.z },
          coreTier: coreTier(cores.get(r.planet.id) ?? 1),
          isSelf,
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
