import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  BUILDING_IDS,
  HULLS,
  INSTRUMENT_IDS,
  RESEARCH_PROJECT_IDS,
  SATELLITE_IDS,
  type HullId,
} from '@astera/rules';
import { and, asc, eq } from 'drizzle-orm';
import { planets } from '../db/schema.js';
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
import { cancelResearchOrder, completeResearch } from '../services/research.js';
import { capitalPlanet, commanderForAccount, ownedPlanet } from '../services/ownership.js';
import { GameError } from '../services/planet.js';
import { buildDeathStar, buildInterceptor, launchDeathStar } from '../services/strategic.js';
import { launchSettlement, launchTransfer } from '../services/movement.js';
import { cancelBuildOrder } from '../services/buildQueue.js';

/**
 * Five structures. The Orbital Ring is not one of them any more (D22): satellites
 * stopped being rationed by slots, which was the only thing it sold. A request
 * naming it is now rejected at the boundary rather than quietly raising a building
 * that does nothing.
 */
/**
 * EVERY ID LIST HERE IS DERIVED, AND NONE OF THEM IS TYPED TWICE.
 *
 * These were hand-written `z.enum` literals beside the generated enums in
 * `packages/rules`, and three of them had quietly fallen behind — the Hangar and
 * the Deuterium Refinery were missing from the buildings, and eleven of the fifteen
 * research projects were missing from the research list. The server answered 400 to
 * things it fully implements, which reads as a malformed request rather than as a
 * missing case, and nothing could catch it: a `z.enum` of string literals is valid
 * TypeScript whatever it leaves out.
 *
 * `zodEnum` is the one cast that makes this work — `z.enum` wants a non-empty
 * tuple and a readonly array does not prove it is one. Every list below is
 * non-empty by construction.
 */
const zodEnum = <T extends string>(values: readonly T[]) =>
  z.enum(values as unknown as [T, ...T[]]);

const BUILDING = zodEnum(BUILDING_IDS);
/**
 * TWO LISTS, BECAUSE THEY ARE TWO KINDS OF THING. D25.
 *
 * Instruments sit on the ground and carry levels; satellites sit in orbit, take a
 * slot, and are bought once. The Drill is on neither list — it became a craft, and
 * the Shipyard builds craft.
 */
const INSTRUMENT = zodEnum(INSTRUMENT_IDS);
const SATELLITE = zodEnum(SATELLITE_IDS);
/**
 * What may be put in an attack fleet. A Prospector is deliberately absent: it is
 * not a warship, and D19 keeps mining traffic out of the fog layer entirely.
 */
const ALL_HULL_IDS = Object.keys(HULLS) as HullId[];
/* By the PROPERTY that makes a hull mobile, not by a second list of names. */
const MOBILE = zodEnum(ALL_HULL_IDS.filter(
  (id) => !HULLS[id].ground && id !== 'PROSPECTOR',
));
const HULL = zodEnum(ALL_HULL_IDS);
const RESEARCH = zodEnum(RESEARCH_PROJECT_IDS);

const launchBody = z.object({
  originPlanetId: z.string().uuid().optional(),
  targetPlanetId: z.string().uuid(),
  fleet: z.record(MOBILE, z.number().int().min(0)).refine(
    (f) => Object.values(f).some((n) => n > 0),
    'Send at least one ship',
  ),
}).strict();

export function registerPlanetRoutes(app: FastifyInstance): void {
  /** Resolve the caller's planet, or 404. Never trusts a planet id from the client. */
  const myPlanet = async (accountId: string): Promise<string> => {
    const commander = await commanderForAccount(app.db, accountId);
    return (await capitalPlanet(app.db, commander.playerId)).id;
  };

  const explicitPlanet = async (accountId: string, raw: unknown) => {
    const { planetId } = z.object({ planetId: z.string().uuid() }).strict().parse(raw);
    return ownedPlanet(app.db, accountId, planetId);
  };

  app.get('/api/planets', { preHandler: requireAuth }, async (req) => {
    return app.db.transaction(async (tx) => {
      const commander = await commanderForAccount(tx, req.accountId!);
      /**
       * A PRIVATE VIEW ADVANCES LAZY ECONOMY, SO THIS IS AN UPDATE LOCK.
       *
       * The first multi-world version took SHARE on every owned row and then
       * `planetView` called `loadLocked`, upgrading each one to UPDATE. Two reads
       * arriving together could both hold SHARE and wait forever for the other
       * upgrade; PostgreSQL correctly killed one with 40P01 and the client saw a
       * transient 500. Acquire the final lock mode up front, in the same ascending
       * planet order every multi-world mutation uses. There is then no lock
       * conversion and no opposite ordering with settlement or transfer.
       */
      const locked = await tx.select().from(planets)
        .where(eq(planets.controllerPlayerId, commander.playerId))
        .orderBy(asc(planets.id))
        .for('update');
      const worlds = locked.toSorted((a, b) =>
        a.kind === b.kind ? a.id.localeCompare(b.id) : a.kind === 'CAPITAL' ? -1 : 1,
      );
      const views = [];
      for (const world of worlds) views.push(await planetView(tx, world.id, app.clock));
      return {
        playerId: commander.playerId,
        seasonId: commander.seasonId,
        capitalPlanetId: worlds.find((world) => world.kind === 'CAPITAL')?.id ?? null,
        planets: views,
      };
    });
  });

  app.get('/api/planets/:planetId', { preHandler: requireAuth }, async (req) => {
    const { planetId } = z.object({ planetId: z.string().uuid() }).strict().parse(req.params);
    return app.db.transaction(async (tx) => {
      const commander = await commanderForAccount(tx, req.accountId!);
      const locked = await tx.select({ id: planets.id }).from(planets).where(and(
        eq(planets.id, planetId),
        eq(planets.controllerPlayerId, commander.playerId),
      )).for('update');
      if (!locked[0]) throw new GameError('PLANET_NOT_OWNED', 'You no longer control that world', 403);
      return planetView(tx, planetId, app.clock);
    });
  });

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

  app.post('/api/planets/:planetId/collect', { preHandler: requireAuth }, async (req) => {
    const owner = await explicitPlanet(req.accountId!, req.params);
    return collectWorks(app.db, owner.planetId, app.clock, owner.playerId);
  });

  app.post('/api/planet/upgrade', { preHandler: requireAuth }, async (req) => {
    const { type } = z.object({ type: BUILDING }).strict().parse(req.body);
    const planetId = await myPlanet(req.accountId!);
    return upgradeBuilding(app.db, planetId, type, app.clock);
  });
  app.post('/api/planets/:planetId/upgrade', { preHandler: requireAuth }, async (req) => {
    const { type } = z.object({ type: BUILDING }).strict().parse(req.body);
    const owner = await explicitPlanet(req.accountId!, req.params);
    return upgradeBuilding(app.db, owner.planetId, type, app.clock, owner.playerId);
  });

  app.post('/api/planet/build', { preHandler: requireAuth }, async (req) => {
    const { hull, count } = z
      .object({ hull: HULL, count: z.number().int().min(1).max(10_000) }).strict()
      .parse(req.body);
    const planetId = await myPlanet(req.accountId!);
    return buildUnits(app.db, planetId, hull, count, app.clock);
  });
  app.post('/api/planets/:planetId/build', { preHandler: requireAuth }, async (req) => {
    const { hull, count } = z
      .object({ hull: HULL, count: z.number().int().min(1).max(10_000) }).strict()
      .parse(req.body);
    const owner = await explicitPlanet(req.accountId!, req.params);
    return buildUnits(app.db, owner.planetId, hull, count, app.clock, owner.playerId);
  });

  app.post('/api/planet/build-orders/:orderId/cancel', { preHandler: requireAuth }, async (req) => {
    const { orderId } = z.object({ orderId: z.string().uuid() }).strict().parse(req.params);
    z.object({}).strict().parse(req.body ?? {});
    const planetId = await myPlanet(req.accountId!);
    return cancelBuildOrder(app.db, planetId, orderId, app.clock);
  });
  app.post(
    '/api/planets/:planetId/build-orders/:orderId/cancel',
    { preHandler: requireAuth },
    async (req) => {
      const { planetId, orderId } = z.object({
        planetId: z.string().uuid(),
        orderId: z.string().uuid(),
      }).strict().parse(req.params);
      z.object({}).strict().parse(req.body ?? {});
      const owner = await ownedPlanet(app.db, req.accountId!, planetId);
      return cancelBuildOrder(app.db, owner.planetId, orderId, app.clock, owner.playerId);
    },
  );

  /** Seasonal projects share the CONSTRUCTION queue. D4/D93. */
  app.post('/api/planet/research', { preHandler: requireAuth }, async (req) => {
    const { projectId } = z.object({ projectId: RESEARCH }).strict().parse(req.body);
    const planetId = await myPlanet(req.accountId!);
    return completeResearch(app.db, planetId, projectId, app.clock);
  });
  app.post('/api/planets/:planetId/research', { preHandler: requireAuth }, async (req) => {
    const { projectId } = z.object({ projectId: RESEARCH }).strict().parse(req.body);
    const owner = await explicitPlanet(req.accountId!, req.params);
    return completeResearch(app.db, owner.planetId, projectId, app.clock, owner.playerId);
  });
  app.post('/api/planet/research-orders/:orderId/cancel', { preHandler: requireAuth }, async (req) => {
    const { orderId } = z.object({ orderId: z.string().uuid() }).strict().parse(req.params);
    z.object({}).strict().parse(req.body ?? {});
    const planetId = await myPlanet(req.accountId!);
    return cancelResearchOrder(app.db, planetId, orderId, app.clock);
  });
  app.post(
    '/api/planets/:planetId/research-orders/:orderId/cancel',
    { preHandler: requireAuth },
    async (req) => {
      const { planetId, orderId } = z.object({
        planetId: z.string().uuid(),
        orderId: z.string().uuid(),
      }).strict().parse(req.params);
      z.object({}).strict().parse(req.body ?? {});
      const owner = await ownedPlanet(app.db, req.accountId!, planetId);
      return cancelResearchOrder(app.db, owner.planetId, orderId, app.clock, owner.playerId);
    },
  );

  /** Raise one of the four ground instruments. D25. */
  app.post('/api/planet/instrument', { preHandler: requireAuth }, async (req) => {
    const { type } = z.object({ type: INSTRUMENT }).strict().parse(req.body);
    const planetId = await myPlanet(req.accountId!);
    return raiseInstrument(app.db, planetId, type, app.clock);
  });
  app.post('/api/planets/:planetId/instrument', { preHandler: requireAuth }, async (req) => {
    const { type } = z.object({ type: INSTRUMENT }).strict().parse(req.body);
    const owner = await explicitPlanet(req.accountId!, req.params);
    return raiseInstrument(app.db, owner.planetId, type, app.clock, owner.playerId);
  });

  /** Put one of the four satellites in orbit. Bought once, never raised. D25. */
  app.post('/api/planet/satellite', { preHandler: requireAuth }, async (req) => {
    const { type } = z.object({ type: SATELLITE }).strict().parse(req.body);
    const planetId = await myPlanet(req.accountId!);
    return installSatellite(app.db, planetId, type, app.clock);
  });
  app.post('/api/planets/:planetId/satellite', { preHandler: requireAuth }, async (req) => {
    const { type } = z.object({ type: SATELLITE }).strict().parse(req.body);
    const owner = await explicitPlanet(req.accountId!, req.params);
    return installSatellite(app.db, owner.planetId, type, app.clock, owner.playerId);
  });

  app.post('/api/planets/:planetId/death-star/build', { preHandler: requireAuth }, async (req) => {
    z.object({}).strict().parse(req.body ?? {});
    const owner = await explicitPlanet(req.accountId!, req.params);
    return buildDeathStar(app.db, owner.planetId, app.clock, owner.playerId);
  });

  /**
   * LOAD ONE INTERCEPTION CHARGE. T10, wired in T12.
   *
   * `buildInterceptor` shipped complete and tested with no route to reach it, so
   * the Interception Grid was a research project that authorised nothing. It takes
   * the weapon's shape deliberately: same asset table, same completion event, same
   * answer — one charge is one row, and reloading is another build.
   */
  app.post('/api/planets/:planetId/interceptor/build', { preHandler: requireAuth }, async (req) => {
    z.object({}).strict().parse(req.body ?? {});
    const owner = await explicitPlanet(req.accountId!, req.params);
    return buildInterceptor(app.db, owner.planetId, app.clock, owner.playerId);
  });

  /**
   * Launch an attack. IRREVERSIBLE — there is no recall endpoint, by design.
   *
   * The response leads with the exposure window because that is the line the UI
   * is built around: "home defence after launch, and for how long".
   */
  app.post('/api/fleet/launch', { preHandler: requireAuth }, async (req) => {
    const body = launchBody.parse(req.body);
    const planetId = body.originPlanetId ?? await myPlanet(req.accountId!);
    const owner = await ownedPlanet(app.db, req.accountId!, planetId);
    return launchAttack(
      app.db,
      planetId,
      body.targetPlanetId,
      body.fleet,
      app.clock,
      owner.playerId,
    );
  });

  app.post('/api/death-star/launch', { preHandler: requireAuth }, async (req) => {
    const body = z.object({
      originPlanetId: z.string().uuid(),
      targetPlanetId: z.string().uuid(),
    }).strict().parse(req.body);
    const owner = await ownedPlanet(app.db, req.accountId!, body.originPlanetId);
    return launchDeathStar(
      app.db,
      body.originPlanetId,
      body.targetPlanetId,
      app.clock,
      owner.playerId,
    );
  });

  app.post('/api/fleet/transfer', { preHandler: requireAuth }, async (req) => {
    const body = z.object({
      originPlanetId: z.string().uuid(),
      targetPlanetId: z.string().uuid(),
      fleet: z.record(HULL, z.number().int().min(0)),
      cargo: z.object({
        alloy: z.number().int().min(0),
        crystal: z.number().int().min(0),
        deuterium: z.number().int().min(0),
      }).strict(),
    }).strict().parse(req.body);
    const origin = await ownedPlanet(app.db, req.accountId!, body.originPlanetId);
    return launchTransfer(
      app.db,
      origin.playerId,
      body.originPlanetId,
      body.targetPlanetId,
      body.fleet,
      body.cargo,
      app.clock,
    );
  });

  app.post('/api/fleet/settle', { preHandler: requireAuth }, async (req) => {
    const body = z.object({
      originPlanetId: z.string().uuid(),
      targetPlanetId: z.string().uuid(),
    }).strict().parse(req.body);
    const origin = await ownedPlanet(app.db, req.accountId!, body.originPlanetId);
    return launchSettlement(
      app.db,
      origin.playerId,
      body.originPlanetId,
      body.targetPlanetId,
      app.clock,
    );
  });
}
