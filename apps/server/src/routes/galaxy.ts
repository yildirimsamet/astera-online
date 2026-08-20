import { and, eq, inArray } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { SATELLITE_IDS, coreTier, type SatelliteId } from '@astera/rules';
import { buildings, planets, players, satellites } from '../db/schema.js';
import { GameError } from '../services/planet.js';
import { readTelescopes } from '../services/intel.js';
import { galaxyTraffic } from '../services/traffic.js';
import { requireAuth } from './auth.js';

/**
 * Core level is exposed as a coarse TIER, never the exact number.
 *
 * Development level is public — you can see a planet is big — but knowing it
 * precisely is what a probe is for. Leaking the exact level for free would make
 * the cheapest tier of intel redundant.
 *
 * `coreTier` MOVED INTO THE RULES for D49. It was a private helper here, which was
 * right while the tier was only a label on a dossier; it stopped being right the
 * moment a launch could be refused by it, because the server, the simulator and
 * the client now all have to agree to the level on what tier a world is in.
 */

/**
 * HARDWARE IS PUBLIC; READINGS ARE NOT. D15.
 *
 * Which instruments a planet carries is visible to everyone — they are physical
 * objects in orbit and the 3D galaxy draws them. Their LEVELS never leave the
 * owner's own planet payload: an Aegis is visible, its shield strength is not,
 * and shield strength is what decides whether a raid pays. Same for the rest.
 * Seeing that a world is defended is deterrence, which the game wants; knowing
 * how well is intel, which has to be bought.
 */
/**
 * WHAT IS IN ORBIT, WHICH IS THE PUBLIC HALF. D15, narrowed by D25.
 *
 * Only SATELLITES are published. The four ground instruments — Telescope, Radar,
 * Aegis, Veil — are on the planet's surface and are nobody else's business: whether
 * a world can see you, and whether it can tell you are looking, is exactly what the
 * information game is about, and publishing it would answer for free the question a
 * probe is sold to answer.
 *
 * A shielded world still reads as shielded — `shielded` below is published beside
 * the orbit for exactly that reason. A dome around a planet is a physical object
 * like any other, deterrence is meant to be legible, and a raider who cannot tell
 * an armoured world from a bare one is not making a decision. What stays private is
 * the LEVEL behind it, which is what actually decides the raid.
 */
const publicOrbit = (rows: readonly { planetId: string; type: string }[]) => {
  const known = new Set<string>(SATELLITE_IDS);
  const map = new Map<string, SatelliteId[]>();
  for (const row of rows) {
    if (!known.has(row.type)) continue;
    const list = map.get(row.planetId);
    if (list) list.push(row.type as SatelliteId);
    else map.set(row.planetId, [row.type as SatelliteId]);
  }
  return map;
};

/**
 * Who has a dome up. The one instrument fact that is public, and only as a boolean.
 *
 * Read off the same rows as the orbit, because instruments and satellites share a
 * table. Nothing about the level reaches this map — it cannot, it holds booleans.
 */
const publicShields = (rows: readonly { planetId: string; type: string }[]) =>
  new Set(rows.filter((r) => r.type === 'AEGIS').map((r) => r.planetId));

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

    /**
     * One query for every core level, rather than one per planet — and SCOPED TO
     * THIS SEASON.
     *
     * Both of these read every row in their table while there is one galaxy, which
     * is the same answer and no slower. With ten galaxies live in one database
     * (D21) it is ten times the rows to fetch and discard on the single most
     * frequent read in the game, and it grows with the world rather than with the
     * player's own galaxy. The join is the fix; the map lookups below are unchanged.
     */
    const ids = rows.map((r) => r.planet.id);
    const [coreRows, satelliteRows] = await Promise.all([
      app.db
        .select({ planetId: buildings.planetId, level: buildings.level })
        .from(buildings)
        .where(and(eq(buildings.type, 'CORE'), inArray(buildings.planetId, ids))),
      app.db
        .select({ planetId: satellites.planetId, type: satellites.type })
        .from(satellites)
        .where(inArray(satellites.planetId, ids)),
    ]);

    const cores = new Map(coreRows.map((r) => [r.planetId, r.level]));
    const installed = publicOrbit(satelliteRows);
    const shielded = publicShields(satelliteRows);

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
          // Types only. Never levels — see `publicOrbit`.
          satellites: installed.get(r.planet.id) ?? [],
          /** Is there a dome. Never how strong it is. */
          shielded: shielded.has(r.planet.id),
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
