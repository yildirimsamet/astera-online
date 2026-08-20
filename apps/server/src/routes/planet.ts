import { eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { planets, players } from '../db/schema.js';
import { GameError } from '../services/planet.js';
import { planetView } from '../services/planetView.js';
import {
  buildUnits,
  collectWorks,
  installSatellite,
  raiseInstrument,
  upgradeBuilding,
} from '../services/build.js';
import { launchAttack } from '../services/mission.js';
import { requireAuth } from './auth.js';

/**
 * Five structures. The Orbital Ring is not one of them any more (D22): satellites
 * stopped being rationed by slots, which was the only thing it sold. A request
 * naming it is now rejected at the boundary rather than quietly raising a building
 * that does nothing.
 */
const BUILDING = z.enum(['CORE', 'REFINERY', 'EXTRACTOR', 'VAULT', 'SHIPYARD']);
/**
 * TWO LISTS, BECAUSE THEY ARE TWO KINDS OF THING. D25.
 *
 * Instruments sit on the ground and carry levels; satellites sit in orbit, take a
 * slot, and are bought once. The Drill is on neither list — it became a craft, and
 * the Shipyard builds craft.
 */
const INSTRUMENT = z.enum(['TELESCOPE', 'RADAR', 'AEGIS', 'VEIL']);
const SATELLITE = z.enum(['FOUNDRY', 'UPLINK', 'DERRICK', 'BEACON']);
/**
 * What may be put in an attack fleet. A Prospector is deliberately absent: it is
 * not a warship, and D19 keeps mining traffic out of the fog layer entirely.
 */
const MOBILE = z.enum(['WASP', 'LANCE', 'BULWARK', 'HAULER']);
const HULL = z.enum(['WASP', 'LANCE', 'BULWARK', 'HAULER', 'BASTION', 'THORN', 'PROSPECTOR']);

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
    return app.db.transaction(async (tx) => planetView(tx, planetId, app.clock));
  });

  /**
   * Empty the works into storage. D16.
   *
   * No body, and no error when there is nothing there: the interface offers this
   * button whenever the works hold anything, and a player who taps it a moment
   * after a raid emptied them should get a calm zero rather than a refusal.
   */
  app.post('/api/planet/collect', { preHandler: requireAuth }, async (req) => {
    const planetId = await myPlanet(req.accountId!);
    return collectWorks(app.db, planetId, app.clock);
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

  /** Raise one of the four ground instruments. D25. */
  app.post('/api/planet/instrument', { preHandler: requireAuth }, async (req) => {
    const { type } = z.object({ type: INSTRUMENT }).parse(req.body);
    const planetId = await myPlanet(req.accountId!);
    return raiseInstrument(app.db, planetId, type, app.clock);
  });

  /** Put one of the four satellites in orbit. Bought once, never raised. D25. */
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
