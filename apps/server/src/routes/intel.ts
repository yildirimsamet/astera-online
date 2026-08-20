import { eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { PROBE } from '@astera/rules';
import { planets, players } from '../db/schema.js';
import { GameError } from '../services/planet.js';
import {
  assignWatch,
  launchProbe,
  readProbeReports,
  readRadarLog,
  readTelescopes,
} from '../services/intel.js';
import { requireAuth } from './auth.js';

const watchBody = z.object({
  targetPlanetId: z.string().uuid(),
  slot: z.number().int().min(0).max(15).default(0),
});

const probeBody = z.object({ targetPlanetId: z.string().uuid() });

export function registerIntelRoutes(app: FastifyInstance): void {
  const me = async (accountId: string): Promise<{ playerId: string; planetId: string }> => {
    const rows = await app.db
      .select({ playerId: players.id, planetId: planets.id })
      .from(players)
      .innerJoin(planets, eq(planets.playerId, players.id))
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
    const { playerId, planetId } = await me(req.accountId!);
    const [watching, radarLog, reports] = await Promise.all([
      readTelescopes(app.db, playerId, app.clock),
      readRadarLog(app.db, planetId),
      readProbeReports(app.db, playerId),
    ]);

    return {
      watching,
      radarLog,
      probeReports: reports.map((r) => ({
        targetPlanetId: r.report.targetPlanetId,
        targetName: r.targetName,
        at: r.report.createdAt,
        // Rounded so the UI cannot imply more precision than the probe bought.
        accuracy: Math.round(r.report.accuracy * 100) / 100,
        stock: r.report.stock,
        defence: r.report.defence,
        fleetSize: r.report.fleetSize,
        fleetHome: r.report.fleetHome,
        detected: r.report.detected,
      })),
      probeCost: { alloy: PROBE.alloy, crystal: PROBE.crystal },
    };
  });

  /** Point a telescope slot at a planet. Silent — the target is never told. */
  app.post('/api/intel/watch', { preHandler: requireAuth }, async (req) => {
    const body = watchBody.parse(req.body);
    const { planetId } = await me(req.accountId!);
    return assignWatch(app.db, planetId, body.targetPlanetId, body.slot, app.clock);
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
    const { planetId } = await me(req.accountId!);
    return launchProbe(app.db, planetId, body.targetPlanetId, app.clock);
  });
}
