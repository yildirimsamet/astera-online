import { baysOf } from '../services/flight.js';
import { eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  INSTRUMENT_IDS,
  SATELLITE_IDS,
  alloyRate,
  collectorCap,
  crystalRate,
  dominion,
  instrumentCost,
  productionMult,
  satelliteCost,
  satelliteSlots,
  storageCap,
  upgradeCost,
  vaultProtects,
  type BuildingId,
} from '@blindspace/rules';
import { planets, players } from '../db/schema.js';
import { GameError, awayFleet, loadLocked } from '../services/planet.js';
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
    return app.db.transaction(async (tx) => {
      const p = await loadLocked(tx, planetId, app.clock);
      const [player] = await tx.select().from(players).where(eq(players.id, p.playerId));

      /**
       * THE RATES THE ECONOMY ACTUALLY RUNS AT — Foundry included. D52a.
       *
       * `advanceEconomy` fills the works to `collectorCap(rate × productionMult)` and
       * `collect` fills storage to `storageCap(rate × productionMult)`, and every
       * figure below was computed from the BARE rate. With a Foundry in orbit (×1.06)
       * the real ceiling is six per cent above the published one, so `bufferAlloy`
       * legitimately exceeded `bufferAlloyCap` — the Works widget pinned at 100% and
       * Signals announced "the works have stopped, production is being thrown away"
       * while production was in fact still running. Storage read over 100% of its
       * stated cap after a collect, for the same reason.
       *
       * It also under-sold the satellite it exists to price: a player who had just
       * bought a Foundry saw the same per-hour figure they had before.
       *
       * One boosted rate, used for all six. `productionMult` is the single source —
       * anything that derives a cap or a rate from a level must go through it.
       */
      const boost = productionMult(p.orbit);
      const perHourAlloy = alloyRate(p.buildings.REFINERY) * boost;
      const perHourCrystal = crystalRate(p.buildings.EXTRACTOR) * boost;

      return {
        planet: {
          id: p.planetId,
          name: p.name,
          position: { x: p.x, y: p.y, z: p.z },
          alloy: Math.floor(p.alloy),
          crystal: Math.floor(p.crystal),
          alloyCap: storageCap(perHourAlloy),
          crystalCap: storageCap(perHourCrystal),
          alloyPerHour: Math.round(perHourAlloy),
          crystalPerHour: Math.round(perHourCrystal),
          /**
           * The works: what is waiting to be collected, and the ceiling it stops
           * at (D16). Both are needed on the client, because the interface has to
           * say "full in 3h 20m" before it can say "FULL — you are wasting 160/h",
           * and only the second of those is a reason to open the game right now.
           */
          bufferAlloy: Math.floor(p.bufferAlloy),
          bufferCrystal: Math.floor(p.bufferCrystal),
          bufferAlloyCap: collectorCap(perHourAlloy),
          bufferCrystalCap: collectorCap(perHourCrystal),
          vaultFloor: vaultProtects(p.buildings.VAULT),
          shield: Math.floor(p.shield),
          disruptedUntil: p.disruptedUntil,
        },
        buildings: p.buildings,
        nextCosts: Object.fromEntries(
          (Object.keys(p.buildings) as BuildingId[]).map((b) => [b, upgradeCost(p.buildings[b])]),
        ),
        /** The four on the ground, with their levels. D25. */
        instruments: p.instruments,
        /**
         * What the next level of each instrument costs, priced by the server.
         *
         * The client could compute this — `instrumentCost` is a pure function it
         * already imports — but every other price on this payload is authoritative
         * and a screen that mixes the two is one modifier away from showing a
         * number the purchase endpoint will refuse.
         */
        instrumentCosts: Object.fromEntries(
          INSTRUMENT_IDS.map((i) => [i, instrumentCost(i, p.instruments[i] ?? 0)]),
        ),
        /** What is in orbit, and how much room there is. D25. */
        orbit: p.orbit,
        orbitSlots: satelliteSlots(p.buildings.CORE),
        satelliteCosts: Object.fromEntries(
          SATELLITE_IDS.map((sat) => [sat, satelliteCost(sat)]),
        ),
        fleet: p.homeFleet,
        ground: p.ground,
        /**
         * Your own craft that are currently off the planet.
         *
         * `fleet` is what is standing on the ground, so it is the wrong number to
         * count anything a player OWNS against — and `PROSPECTOR.max` is a rule
         * about ownership. Without this the build sheet would offer a fourth
         * Prospector to somebody whose three were away mining, and the server would
         * refuse it: a control that lies about what it will do.
         *
         * Yours only, and no fog question arises — it is your own planet's units.
         */
        fleetAway: await awayFleet(tx, planetId),
        /**
         * How much this planet has in the air, and how much it may. D28.
         *
         * Counted here rather than derived on the client, because the client cannot
         * see other people's craft and would have to guess — and because the count
         * is already free: this handler holds the planet lock that `assertFreeBay`
         * reads under.
         */
        flight: await baysOf(tx, planetId, p.buildings.CORE),
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
