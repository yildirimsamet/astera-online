import { and, eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { PROBE } from '@astera/rules';
import { planets, players } from '../db/schema.js';
import { GameError } from '../services/planet.js';
import {
  assignWatch,
  launchProbe,
  readProbeCooldowns,
  readProbeReports,
  readRadarLog,
  readTelescopes,
} from '../services/intel.js';
import { requireAuth } from './auth.js';
import { ownedPlanet } from '../services/ownership.js';

const watchBody = z.object({
  observerPlanetId: z.string().uuid().optional(),
  targetPlanetId: z.string().uuid(),
  slot: z.number().int().min(0).max(15).default(0),
});

const probeBody = z.object({ originPlanetId: z.string().uuid().optional(), targetPlanetId: z.string().uuid() });

export function registerIntelRoutes(app: FastifyInstance): void {
  const me = async (accountId: string): Promise<{ playerId: string; planetId: string }> => {
    const rows = await app.db
      .select({ playerId: players.id, planetId: planets.id })
      .from(players)
      .innerJoin(planets, and(eq(planets.controllerPlayerId, players.id), eq(planets.kind, 'CAPITAL')))
      .where(eq(players.accountId, accountId))
      .limit(1);
    const row = rows[0];
    if (!row) throw new GameError('NO_PLANET', 'Join a galaxy first', 404);
    return row;
  };

  /**
   * The intel screen — the return moment's payload.
   *
   * Everything here is already filtered by the player's own clarity and radar
   * level. There is no "full" version of this response that a modified client
   * could ask for instead.
   */
  app.get('/api/intel', { preHandler: requireAuth }, async (req) => {
    /**
     * THE WHOLE COMMANDER, NOT THE CAPITAL. D97/D134.
     *
     * `me()` resolves the capital, which is right for the two POST routes below —
     * they need a default origin. It was wrong here: the radar log was read for
     * the capital alone, so every probe against a colony wrote its row and no
     * surface in the game ever read it. The telescope watches were already
     * commander-wide, so one payload was answering at two different scopes.
     */
    const self = await app.projections.commander(req.accountId!);
    const [watching, radarLog, reports, cooldowns] = await Promise.all([
      readTelescopes(app.db, self.playerId, app.clock),
      readRadarLog(app.db, self.planetIds),
      readProbeReports(app.db, self.playerId),
      readProbeCooldowns(app.db, self.playerId, app.clock.now()),
    ]);

    return {
      watching,
      radarLog,
      // Which worlds this commander may not look at again yet, and until when.
      probeCooldowns: cooldowns,
      probeReports: reports.map((r) => ({
        targetPlanetId: r.report.targetPlanetId,
        targetName: r.targetName,
        targetUsername: r.targetUsername,
        at: r.report.createdAt,
        // Rounded so the UI cannot imply more precision than the probe bought.
        accuracy: Math.round(r.report.accuracy * 100) / 100,
        stock: r.report.stock,
        deuteriumStock: r.report.deuteriumStock,
        defence: r.report.defence,
        fleetSize: r.report.fleetSize,
        fleetHome: r.report.fleetHome,
        deathStar: r.report.strategicStatus ?? 'UNKNOWN',
        /**
         * THE TWO READINGS THE PROBE HAS ALWAYS TAKEN AND NEVER DELIVERED. T9 · T10.
         *
         * `resolveProbe` has written both into the report's silhouette since they
         * shipped, and no route ever put them on the wire — so a commander paid
         * alloy, a flight bay, a round trip and the risk of being caught, and
         * could not read either one anywhere in the game.
         *
         *   · `doctrines` is what the target has researched into their hulls. It is
         *     worth up to a 25% combat multiplier, and `CLAUDE.md` requires in as
         *     many words that combat-relevant doctrine be PROBE-VISIBLE (D137). It
         *     was probe-collected and invisible, which is the opposite.
         *   · `interceptor` is whether that world can shoot a strategic weapon down
         *     (T10). Without it a Death Star is 33,000 resources and an hour spent
         *     blind — the feature's whole argument is that scouting turns the strike
         *     into an intelligence decision, and there was nothing to scout WITH.
         *
         * Both are frozen at the look, like everything else in the silhouette, and
         * the client prints their age beside them for exactly that reason.
         *
         * ABSENT rather than defaulted when the report predates them or the target
         * is a caretaker world: an empty object would read as "they have researched
         * nothing", which is a claim this reading cannot make.
         */
        ...(r.report.silhouette?.doctrines
          ? { doctrines: r.report.silhouette.doctrines }
          : {}),
        ...(r.report.silhouette?.interceptor === undefined
          ? {}
          : { interceptor: r.report.silhouette.interceptor }),
        detected: r.report.detected,
      })),
      probeCost: { alloy: PROBE.alloy, crystal: PROBE.crystal, deuterium: 0 },
    };
  });

  /** Point a telescope slot at a planet. Silent — the target is never told. */
  app.post('/api/intel/watch', { preHandler: requireAuth }, async (req) => {
    const body = watchBody.parse(req.body);
    const { planetId, playerId } = await me(req.accountId!);
    const observerPlanetId = body.observerPlanetId ?? planetId;
    const owner = body.observerPlanetId
      ? await ownedPlanet(app.db, req.accountId!, observerPlanetId)
      : { playerId };
    return assignWatch(
      app.db,
      observerPlanetId,
      body.targetPlanetId,
      body.slot,
      app.clock,
      owner.playerId,
    );
  });

  /**
   * Send a probe. Costs alloy and time, and may trip the target's radar.
   *
   * The response deliberately does NOT say whether it was detected — that is only
   * known when the probe lands, and telling the player early would remove the
   * risk the decision is built on.
   */
  app.post('/api/intel/probe', { preHandler: requireAuth }, async (req) => {
    const body = probeBody.parse(req.body);
    const { planetId, playerId } = await me(req.accountId!);
    const originPlanetId = body.originPlanetId ?? planetId;
    const owner = body.originPlanetId
      ? await ownedPlanet(app.db, req.accountId!, originPlanetId)
      : { playerId };
    return launchProbe(
      app.db,
      originPlanetId,
      body.targetPlanetId,
      app.clock,
      owner.playerId,
    );
  });
}
