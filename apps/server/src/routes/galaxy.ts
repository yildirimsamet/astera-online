import { and, asc, desc, eq, isNull, sql } from 'drizzle-orm';
import { coreTier } from '@astera/rules';
import type { FastifyInstance } from 'fastify';
import {
  accounts,
  buildings,
  clanMemberships,
  clans,
  planets,
  players,
  seasons,
  shards,
} from '../db/schema.js';
import { GameError } from '../services/planet.js';
import { readTelescopes } from '../services/intel.js';
import { projectGalaxyTraffic } from '../services/traffic.js';
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
    const self = await app.projections.commander(req.accountId!);

    const [worlds, watching] = await Promise.all([
      app.projections.worlds(self.seasonId, app.clock.now()),
      readTelescopes(app.db, self.playerId, app.clock),
    ]);
    const mineSet = new Set(self.planetIds);
    const byTarget = new Map(watching.map((w) => [w.targetPlanetId, w]));

    return {
      you: {
        planetId: self.capitalPlanetId,
        playerId: self.playerId,
        capitalPlanetId: self.capitalPlanetId,
        planetIds: self.planetIds,
      },
      planets: worlds.map((world) => {
        const watch = byTarget.get(world.id);
        return {
          ...world,
          isSelf: world.id === self.capitalPlanetId,
          isOwned: mineSet.has(world.id),
          isCapital: world.kind === 'CAPITAL',
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
    const self = await app.projections.commander(req.accountId!);
    const now = app.clock.now();
    const snapshot = await app.projections.trafficSnapshot(self.seasonId, now);

    return {
      contacts: projectGalaxyTraffic(
        snapshot,
        self.capitalPlanetId,
        now,
        self.playerId,
        self.planetIds,
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

    const [galaxy] = await app.db
      .select({ capacity: shards.playerCap })
      .from(seasons)
      .innerJoin(shards, eq(seasons.shardId, shards.id))
      .where(eq(seasons.id, self.seasonId));
    if (!galaxy) throw new GameError('SEASON_NOT_FOUND', 'Galaxy not found', 404);

    const score = sql<number>`round(${players.dominionTaken} - ${players.dominionLost})`;
    const rows = await app.db
      .select({
        playerId: players.id,
        username: accounts.displayName,
        planetId: planets.id,
        planetName: planets.name,
        coreLevel: buildings.level,
        score,
        clanId: clans.id,
        clanName: clans.name,
        clanTag: clans.tag,
      })
      .from(players)
      .innerJoin(accounts, eq(players.accountId, accounts.id))
      .innerJoin(
        planets,
        and(eq(planets.controllerPlayerId, players.id), eq(planets.kind, 'CAPITAL')),
      )
      .innerJoin(buildings, and(eq(buildings.planetId, planets.id), eq(buildings.type, 'CORE')))
      .leftJoin(
        clanMemberships,
        and(eq(clanMemberships.playerId, players.id), isNull(clanMemberships.leftAt)),
      )
      .leftJoin(
        clans,
        and(eq(clans.id, clanMemberships.clanId), isNull(clans.disbandedAt)),
      )
      .where(eq(players.seasonId, self.seasonId))
      .orderBy(desc(score), asc(players.joinedAt), asc(players.id))
      .limit(galaxy.capacity);

    const ladder = rows
      .map((entry, i) => ({
        rank: i + 1,
        playerId: entry.playerId,
        username: entry.username,
        planetId: entry.planetId,
        planetName: entry.planetName,
        coreTier: coreTier(entry.coreLevel),
        score: entry.score,
        clan: entry.clanId && entry.clanName && entry.clanTag
          ? { id: entry.clanId, name: entry.clanName, tag: entry.clanTag }
          : null,
      }));

    return {
      ladder,
      you: ladder.find((e) => e.playerId === self.id) ?? null,
    };
  });
}
