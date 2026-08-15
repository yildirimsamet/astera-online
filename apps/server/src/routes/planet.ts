import { eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  alloyRate,
  crystalRate,
  dominion,
  satelliteSlots,
  storageCap,
  upgradeCost,
  vaultProtects,
  type BuildingId,
} from '@blindspace/rules';
import { planets, players } from '../db/schema.js';
import { GameError, loadLocked } from '../services/planet.js';
import { buildUnits, installSatellite, upgradeBuilding } from '../services/build.js';
import { launchAttack } from '../services/mission.js';
import { requireAuth } from './auth.js';

const BUILDING = z.enum(['CORE', 'REFINERY', 'EXTRACTOR', 'VAULT', 'SHIPYARD', 'RING']);
const SATELLITE = z.enum(['TELESCOPE', 'RADAR', 'AEGIS', 'VEIL', 'DRILL']);
const MOBILE = z.enum(['WASP', 'LANCE', 'BULWARK', 'HAULER']);
const HULL = z.enum(['WASP', 'LANCE', 'BULWARK', 'HAULER', 'BASTION']);

const launchBody = z.object({
  targetPlanetId: z.string().uuid(),
  fleet: z.record(MOBILE, z.number().int().min(0)).refine(
    (f) => Object.values(f).some((n) => n > 0),
    'Send at least one ship',
  ),
});

export function registerPlanetRoutes(app: FastifyInstance): void {
  /** Resolve the caller's planet, or 404. Never trusts a planet id from the client. */
  const myPlanet = async (accountId: string): Promise<string> => {
    const rows = await app.db
      .select({ planetId: planets.id })
      .from(planets)
      .innerJoin(players, eq(planets.playerId, players.id))
      .where(eq(players.accountId, accountId))
      .limit(1);
    const planetId = rows[0]?.planetId;
    if (!planetId) throw new GameError('NO_PLANET', 'Join a galaxy first', 404);
    return planetId;
  };

  app.get('/api/planet', { preHandler: requireAuth }, async (req) => {
    const planetId = await myPlanet(req.accountId!);
    return app.db.transaction(async (tx) => {
      const p = await loadLocked(tx, planetId, app.clock);
      const [player] = await tx.select().from(players).where(eq(players.id, p.playerId));

      return {
        planet: {
          id: p.planetId,
          name: p.name,
          position: { x: p.x, y: p.y, z: p.z },
          alloy: Math.floor(p.alloy),
          crystal: Math.floor(p.crystal),
          alloyCap: storageCap(alloyRate(p.buildings.REFINERY)),
          crystalCap: storageCap(crystalRate(p.buildings.EXTRACTOR)),
          alloyPerHour: Math.round(alloyRate(p.buildings.REFINERY)),
          crystalPerHour: Math.round(crystalRate(p.buildings.EXTRACTOR)),
          vaultFloor: vaultProtects(p.buildings.VAULT),
          shield: Math.floor(p.shield),
          disruptedUntil: p.disruptedUntil,
        },
        buildings: p.buildings,
        nextCosts: Object.fromEntries(
          (Object.keys(p.buildings) as BuildingId[]).map((b) => [b, upgradeCost(p.buildings[b])]),
        ),
        satellites: p.satellites,
        satelliteSlots: satelliteSlots(p.buildings.RING),
        fleet: p.homeFleet,
        ground: p.ground,
        score: {
          wealth: player?.wealth ?? 0,
          dominion: dominion({
            taken: player?.dominionTaken ?? 0,
            lost: player?.dominionLost ?? 0,
          }),
        },
      };
    });
  });

  app.post('/api/planet/upgrade', { preHandler: requireAuth }, async (req) => {
    const { type } = z.object({ type: BUILDING }).parse(req.body);
    const planetId = await myPlanet(req.accountId!);
    return upgradeBuilding(app.db, planetId, type, app.clock);
  });

  app.post('/api/planet/build', { preHandler: requireAuth }, async (req) => {
    const { hull, count } = z
      .object({ hull: HULL, count: z.number().int().min(1).max(10_000) })
      .parse(req.body);
    const planetId = await myPlanet(req.accountId!);
    return buildUnits(app.db, planetId, hull, count, app.clock);
  });

  app.post('/api/planet/satellite', { preHandler: requireAuth }, async (req) => {
    const { type } = z.object({ type: SATELLITE }).parse(req.body);
    const planetId = await myPlanet(req.accountId!);
    return installSatellite(app.db, planetId, type, app.clock);
  });

  /**
   * Launch an attack. IRREVERSIBLE — there is no recall endpoint, by design.
   *
   * The response leads with the exposure window because that is the line the UI
   * is built around: "home defence after launch, and for how long".
   */
  app.post('/api/fleet/launch', { preHandler: requireAuth }, async (req) => {
    const body = launchBody.parse(req.body);
    const planetId = await myPlanet(req.accountId!);
    return launchAttack(
      app.db,
      planetId,
      body.targetPlanetId,
      body.fleet,
      app.clock,
    );
  });
}
