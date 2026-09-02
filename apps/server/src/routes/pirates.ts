import { and, eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  HULLS,
  MOBILE_HULLS,
  PIRATE,
  distance,
  fleetCount,
  fleetSpeedMult,
  hullTech,
  interceptOrbit,
  massClass,
  piratePosition,
  sensorZone,
  type MobileHullId,
} from '@astera/rules';
import { minutesSince } from '../clock.js';
import { planets, players, units } from '../db/schema.js';
import { GameError, orbitOf } from '../services/planet.js';
import { ownedPlanet } from '../services/ownership.js';
import { pirateCallsign, pirateId } from '../services/pirateField.js';
import { launchPirateRaid } from '../services/pirateRaid.js';
import { techOf } from '../services/researchState.js';
import { requireAuth } from './auth.js';

const raidBody = z.object({
  originPlanetId: z.string().uuid().optional(),
  pirateId: z.string().regex(/^[A-Za-z0-9_-]{22}$/),
  fleet: z.record(z.string(), z.number().int().min(0)),
}).strict();

/**
 * PIRATES — the third target class. D150.
 *
 * `GET` answers with the pirates this commander can see RIGHT NOW, and nothing
 * else: no orbital elements, no raw lane index, no hoard figure. The fog is
 * applied in the query through `sensorZone`, which is the one statement of the
 * three zones — so what this route hands over is exactly what the disc draws.
 *
 * `reachMinutes` COMES FROM HERE AND NOT FROM THE CLIENT. The rendezvous is a
 * numerical solve against a moving target; two implementations would produce two
 * different minutes, and the one the player read would not be the one the launch
 * used. The client asks; the server answers.
 */
export function registerPirateRoutes(app: FastifyInstance): void {
  const me = async (accountId: string) => {
    const rows = await app.db
      .select({ planetId: planets.id, seasonId: players.seasonId, playerId: players.id })
      .from(players)
      .innerJoin(
        planets,
        and(eq(planets.controllerPlayerId, players.id), eq(planets.kind, 'CAPITAL')),
      )
      .where(eq(players.accountId, accountId))
      .limit(1);
    const row = rows[0];
    if (!row) throw new GameError('NO_PLANET', 'Join a galaxy first', 404);
    return row;
  };

  app.get('/api/pirates', { preHandler: requireAuth }, async (req) => {
    const query = z
      .object({ originPlanetId: z.string().uuid().optional() })
      .strict()
      .parse(req.query ?? {});
    const self = await app.projections.commander(req.accountId!);
    const now = app.clock.now();
    const originId = query.originPlanetId ?? self.capitalPlanetId;
    if (!self.planetIds.includes(originId)) {
      throw new GameError('NOT_YOUR_PLANET', 'That world is not yours', 403);
    }

    const [snapshot, sensors] = await Promise.all([
      app.projections.pirateSnapshot(self.seasonId, now),
      app.projections.sensorsFor(self.playerId, self.planetIds),
    ]);
    const nowMinutes = minutesSince(snapshot.startsAt, now);

    /**
     * THE BEST CASE THIS WORLD COULD MANAGE, and it is labelled as such.
     *
     * A fleet flies at its SLOWEST hull, so the earliest any rendezvous could
     * happen is the one its fastest single hull could keep. That is an honest
     * upper bound on opportunity — "could I reach it at all" — and the launch
     * itself is the authority on the actual fleet: `CANNOT_INTERCEPT` is the only
     * final answer, and it is computed from the ships the player really sent.
     */
    const [world] = await app.db
      .select({ x: planets.x, y: planets.y, z: planets.z })
      .from(planets)
      .where(eq(planets.id, originId));
    const origin = world ?? null;
    /**
     * EVERY SPEED A FLEET FROM THIS WORLD COULD ACTUALLY FLY AT.
     *
     * A fleet travels at its SLOWEST hull, so the set of achievable fleet speeds
     * is exactly the set of per-hull speeds standing at home — not a continuum.
     * Solving the rendezvous once for each of them (at most one per hull in the
     * catalogue) lets the launch sheet quote the EXACT flight time for whatever
     * the player has selected, with no second request and no client-side solver.
     *
     * IT HAS TO BE THE SERVER. The rendezvous is a numerical solve against a
     * moving target, and two implementations would put a different minute on the
     * screen than the one the launch actually used — which is the whole reason
     * `interceptOrbit` exists in one place.
     */
    const speedOf = new Map<MobileHullId, number>();
    if (origin) {
      const [home, tech, orbit] = await Promise.all([
        app.db
          .select({ hull: units.hull, count: units.count })
          .from(units)
          .where(and(eq(units.planetId, originId), eq(units.location, 'home'))),
        techOf(app.db, self.playerId),
        orbitOf(app.db, originId),
      ]);
      const boost = fleetSpeedMult(orbit);
      for (const row of home) {
        if (row.count <= 0) continue;
        if (!(MOBILE_HULLS as readonly string[]).includes(row.hull)) continue;
        const hull = row.hull as MobileHullId;
        speedOf.set(hull, HULLS[hull].speed * hullTech(tech, hull).speed * boost);
      }
    }
    const distinctSpeeds = [...new Set(speedOf.values())].sort((a, b) => b - a);

    const pirates = snapshot.standing(now).flatMap((spec) => {
      const at = piratePosition(spec, nowMinutes);
      const zone = sensorZone(sensors, at);
      if (zone === 'NONE') return [];
      const crew = snapshot.livingRosterOf(spec.index);
      if (fleetCount(crew) === 0) return [];

      const reveal = sensors.filter((post) => distance(post.at, at) <= post.detect);
      const identified = zone === 'IDENTIFIED';
      /*
        SOLVED PER DISTINCT SPEED, PUBLISHED PER HULL.

        Solving is a numerical scan; two hulls that fly at the same speed share one
        answer. But the CLIENT cannot key on speed — the figures here carry this
        world's Beacon and the commander's Propulsion, and the panel only knows the
        catalogue. Matching a raw catalogue speed against an effective one landed on
        the nearest row by absolute difference, which was routinely the wrong hull;
        worse, an unreachable speed is absent from this table entirely, so the match
        slid onto a FASTER hull's row and the panel quoted an ETA and enabled Send
        for a launch the server then refused with `CANNOT_INTERCEPT`.

        Keyed by hull there is nothing to guess: the client takes the entry for the
        slowest ship it has selected, and a hull with no entry is a hull that cannot
        get there — which is the same answer the launch will give.
      */
      const byHullSpeed = new Map<number, { minutes: number; distance: number }>();
      if (origin) {
        for (const speed of distinctSpeeds) {
          const solved = interceptOrbit(
            origin,
            speed,
            (minutes) => piratePosition(spec, minutes),
            spec.expiresAt,
            nowMinutes,
          );
          if (solved) {
            byHullSpeed.set(speed, {
              minutes: solved.flightMinutes,
              // The leg the launch will charge fuel for, both ways. D136.
              distance: distance(origin, solved.at),
            });
          }
        }
      }
      const reach = [...speedOf.entries()].flatMap(([hull, speed]) => {
        const solved = byHullSpeed.get(speed);
        return solved === undefined
          ? []
          : [{ hull, minutes: solved.minutes, distance: solved.distance }];
      });

      return [{
        id: pirateId(snapshot.key, spec.index),
        callsign: pirateCallsign(snapshot.key, spec.index),
        zone,
        at,
        /** Minutes until it leaves the disc for good. Public: it is a deadline. */
        expiresInMinutes: Math.max(0, spec.expiresAt - nowMinutes),
        /**
         * The rendezvous for every hull standing at this world, and the leg to it.
         *
         * A fleet flies at its SLOWEST ship, so the panel reads the entry for the
         * slowest hull it has selected and gets the exact minute and the exact
         * distance the launch will use — no second request, no client-side solver,
         * and nothing to infer. A hull that is missing here cannot reach this
         * pirate at all.
         */
        reach,
        /** The soonest of them — what the summary line quotes before a pick. */
        reachMinutes: reach.reduce<number | null>(
          (soonest, e) => (soonest === null || e.minutes < soonest ? e.minutes : soonest),
          null,
        ),
        // Everything below is the disclosure ladder, and IDENTIFIED is what buys
        // the two facts that price the fight: the crew, and the level.
        ...(identified
          ? {
              level: spec.level,
              fleet: crew,
              mass: massClass(crew),
              damageMult: PIRATE.damageMult[spec.level],
            }
          : {
              ...(reveal.some((post) => post.revealsSize) ? { mass: massClass(crew) } : {}),
              ...(reveal.some((post) => post.revealsKind) ? { silhouette: 'pirate' as const } : {}),
            }),
      }];
    });

    return { pirates, originPlanetId: originId };
  });

  /** Send a fleet at one. Refused if it will be gone before they could arrive. */
  app.post('/api/pirates/raid', { preHandler: requireAuth }, async (req) => {
    const body = raidBody.parse(req.body);
    const legacy = await me(req.accountId!);
    const planetId = body.originPlanetId ?? legacy.planetId;
    const owner = body.originPlanetId
      ? await ownedPlanet(app.db, req.accountId!, body.originPlanetId)
      : legacy;
    return launchPirateRaid(
      app.db,
      planetId,
      body.pirateId,
      body.fleet,
      app.clock,
      owner.playerId,
    );
  });
}
