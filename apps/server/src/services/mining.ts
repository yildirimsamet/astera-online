import { and, eq, gt, inArray } from 'drizzle-orm';
import {
  asteroidActive,
  claimOre,
  interceptAsteroid,
  prospectorHold,
  prospectorSpeed,
  prospectorReturnSpeed,
  travelExact,
  DEBRIS,
  claimDebris,
  collectorCap,
  debrisAlive,
  debrisRemaining,
  deuteriumCollectorCap,
  deuteriumRate,
  productionMult,
  alloyRate,
  crystalRate,
  distance,
  type AsteroidSpec,
  type SatelliteSet,
  type Vec3,
  orbitDiscoveredAt,
} from '@astera/rules';
import { addMinutes, atMinute, minutesSince, type Clock } from '../clock.js';
import type { Db, Queryable, Tx } from '../db/client.js';
import { asteroidClaims, debrisFields, miningRuns, planets, seasons, units } from '../db/schema.js';
import { assertFreeBay } from './flight.js';
import {
  assertSeasonOpenThrough,
  assertWorldOperational,
  GameError,
  loadLocked,
  orbitOf,
  saveResources,
  setUnits,
  type LockedPlanet,
} from './planet.js';
import {
  asteroidId,
  asteroidIndexFromId,
  privateAsteroidFieldWithEvents,
  projectPlayerAsteroidField,
} from './asteroidField.js';
import { loadGalaxyEventSchedule } from './galaxyEvents.js';
import { sensorHistoryForPlayer } from './sensorHistory.js';
import { schedule } from '../worker/queue.js';
import { publish, publishShard } from '../stream/bus.js';
import { hasResearch, techOf } from './researchState.js';
import type { TechLevels } from '@astera/rules';
import { publicPlanetIdentity, recordGalaxyEvent } from './chronicle.js';
import { pendingThreads, type PendingThread } from './session.js';
import { planetView, type PlanetView } from './planetView.js';

/**
 * MINING — D19.
 *
 * A Prospector flies to the place a passing rock WILL BE, takes what its hold can
 * carry, and comes home. Everything about the field is derived from the season
 * seed; the only stored facts are how much ore has already been taken out of each
 * rock and which craft are currently out.
 *
 * THE RACE IS DECIDED BY ARRIVAL TIME AND NOTHING ELSE. Ore is claimed inside the
 * transaction that resolves an arrival, under a lock on the claim row, so two
 * squadrons landing in the same second cannot both take the last of it. There is
 * no dwell time at the rock — a craft that arrives second takes whatever is left,
 * and one that arrives to find it stripped turns around empty.
 */

/** Where the field lives. Regenerated per season, cached, never downloaded. */
async function fieldOf(tx: Queryable, seasonId: string): Promise<{
  asteroids: AsteroidSpec[];
  startsAt: Date;
  asteroidKey: string;
}> {
  const [season] = await tx.select().from(seasons).where(eq(seasons.id, seasonId));
  if (!season) throw new GameError('SEASON_NOT_FOUND', 'No such season', 404);
  const eventSchedule = await loadGalaxyEventSchedule(tx, season.id, season.startsAt);
  return {
    asteroids: privateAsteroidFieldWithEvents(season.asteroidKey, eventSchedule),
    startsAt: season.startsAt,
    asteroidKey: season.asteroidKey,
  };
}

export interface AsteroidView extends Omit<AsteroidSpec, 'isotopeRich' | 'deuteriumShare'> {
  /** Ore still in it. Internal full-field projection; API routes apply caller fog. */
  oreRemaining: number;
  /** Visible rocks are active; retained in the wire shape for client compatibility. */
  active: boolean;
  /** Hidden until spectroscopy; a normal-looking active rock reveals no fuel. */
  isotopeRich: boolean;
  deuteriumShare: number | null;
}

/**
 * The caller-independent raw snapshot behind `/api/mining`. D99.
 *
 * It intentionally carries raw asteroid/debris facts rather than a response:
 * activity, decay and isotope visibility are derived at request time. Nothing
 * about a player's research, orbit or own runs can enter this shared snapshot.
 */
export interface MiningSnapshot {
  asteroids: AsteroidSpec[];
  startsAt: Date;
  asteroidKey: string;
  oreTaken: ReadonlyMap<number, number>;
  debris: (typeof debrisFields.$inferSelect)[];
}

export async function loadMiningSnapshot(
  db: Queryable,
  seasonId: string,
  now: Date,
): Promise<MiningSnapshot> {
  const field = await fieldOf(db, seasonId);
  const oldest = new Date(now.getTime() - DEBRIS.decayMinutes * 60_000);
  const [claims, debris] = await Promise.all([
    db.select().from(asteroidClaims).where(eq(asteroidClaims.seasonId, seasonId)),
    db
      .select()
      .from(debrisFields)
      .where(and(eq(debrisFields.seasonId, seasonId), gt(debrisFields.createdAt, oldest))),
  ]);
  return {
    ...field,
    oreTaken: new Map(claims.map((claim) => [claim.index, claim.oreTaken])),
    debris,
  };
}

export function projectVisibleAsteroids(
  snapshot: MiningSnapshot,
  now: Date,
  revealIsotopes = false,
): AsteroidView[] {
  const nowMinutes = minutesSince(snapshot.startsAt, now);
  return snapshot.asteroids
    .filter((asteroid) => asteroidActive(asteroid, nowMinutes))
    .map((asteroid) => ({
      index: asteroid.index,
      level: asteroid.level,
      ore: asteroid.ore,
      crystalShare: asteroid.crystalShare,
      radius: asteroid.radius,
      period: asteroid.period,
      phase: asteroid.phase,
      inclination: asteroid.inclination,
      ascendingNode: asteroid.ascendingNode,
      speed: asteroid.speed,
      appearsAt: asteroid.appearsAt,
      expiresAt: asteroid.expiresAt,
      oreRemaining: Math.max(0, asteroid.ore - (snapshot.oreTaken.get(asteroid.index) ?? 0)),
      active: true,
      isotopeRich: asteroid.isotopeRich,
      deuteriumShare: revealIsotopes ? asteroid.deuteriumShare : null,
    }))
    .filter((asteroid) => asteroid.oreRemaining > 0);
}

export function projectVisibleDebris(snapshot: MiningSnapshot, now: Date) {
  return snapshot.debris
    .map((field) => {
      const age = (now.getTime() - field.createdAt.getTime()) / 60_000;
      return {
        id: field.id,
        /** NULL for a pirate battle: open space has no world to orbit. D150. */
        planetId: field.planetId,
        x: field.x,
        y: field.y,
        z: field.z,
        alloy: debrisRemaining(field.alloy, field.takenAlloy, age),
        crystal: debrisRemaining(field.crystal, field.takenCrystal, age),
        deuterium: debrisRemaining(field.deuterium, field.takenDeuterium, age),
        minutesLeft: Math.max(0, DEBRIS.decayMinutes - age),
        createdAt: field.createdAt,
      };
    })
    .filter((field) => field.alloy + field.crystal + field.deuterium > 1);
}

/**
 * Every active rock, for trusted simulation/capacity tooling and legacy service
 * tests. This is deliberately not an API projection: player routes must pass the
 * result through `projectPlayerAsteroidField` and durable sensor history.
 */
export async function visibleAsteroids(
  db: Queryable,
  seasonId: string,
  now: Date,
  revealIsotopes = false,
): Promise<AsteroidView[]> {
  return projectVisibleAsteroids(await loadMiningSnapshot(db, seasonId, now), now, revealIsotopes);
}

/** The caller-only half of mining, built identically for GET and launch POST. */
export function projectPrivateMiningView(
  orbit: SatelliteSet,
  runs: readonly (typeof miningRuns.$inferSelect)[],
  tech: TechLevels,
  asteroidKey: string,
) {
  return {
    /** Whether the DERRICK is in orbit. D25 — hardware, never a level. */
    derrick: orbit.includes('DERRICK'),
    craftSpeed: prospectorSpeed(orbit),
    craftHold: prospectorHold(orbit, tech),
    derrickHold: prospectorHold(['DERRICK'], tech),
    runs: runs.map((run) => ({
      id: run.id,
      planetId: run.planetId,
      targetKind: run.targetKind,
      asteroidId: run.asteroidIndex === null ? null : asteroidId(asteroidKey, run.asteroidIndex),
      debrisFieldId: run.debrisFieldId,
      status: run.status,
      craft: run.craft,
      departAt: run.departAt,
      arriveAt: run.arriveAt,
      homeAt: run.homeAt,
      intercept: { x: run.interceptX, y: run.interceptY, z: run.interceptZ },
      minedAlloy: Math.round(run.minedAlloy),
      minedCrystal: Math.round(run.minedCrystal),
      minedDeuterium: Math.round(run.minedDeuterium),
    })),
  };
}

/** The isotope subset of a private status response, from an already-authorised field. */
export function projectIsotopeKnowledge(
  asteroids: readonly {
    id: string;
    isotopeRich: boolean;
    deuteriumShare: number | null;
  }[],
) {
  return asteroids.flatMap((asteroid) =>
    asteroid.isotopeRich && asteroid.deuteriumShare !== null
      ? [{ id: asteroid.id, deuteriumShare: asteroid.deuteriumShare }]
      : []);
}

export type MiningStatusView = ReturnType<typeof projectPrivateMiningView> & {
  isotopes: ReturnType<typeof projectIsotopeKnowledge>;
};

/**
 * The private mining view immediately after a launch, read before the transaction
 * commits so the run in the answer is the row the mutation just created. D120.
 */
async function miningStatusAfterLaunch(
  tx: Tx,
  origin: Pick<LockedPlanet, 'planetId' | 'playerId' | 'seasonId' | 'orbit' | 'now'>,
): Promise<MiningStatusView> {
  const runs = await activePlayerMiningRuns(tx, origin.playerId);
  const field = await fieldOf(tx, origin.seasonId);
  const view = projectPrivateMiningView(
    origin.orbit,
    runs,
    await techOf(tx, origin.playerId),
    field.asteroidKey,
  );
  // The commander's spectrometry, not the world's. T7.
  if (!(await hasResearch(tx, origin.playerId, 'ISOTOPE_SPECTROMETRY'))) {
    return { ...view, isotopes: [] };
  }

  // Only the asteroid half is needed here. Pulling live debris into a planet-locked
  // launch transaction would lengthen the lock for a payload this response does not
  // carry; claims are the only stored fact isotope visibility needs.
  const claims = await tx
    .select({ index: asteroidClaims.index, oreTaken: asteroidClaims.oreTaken })
    .from(asteroidClaims)
    .where(eq(asteroidClaims.seasonId, origin.seasonId));
  const taken = new Map(claims.map((claim) => [claim.index, claim.oreTaken]));
  const epochs = await sensorHistoryForPlayer(tx, origin.playerId, field.startsAt);
  const projected = projectPlayerAsteroidField(
    { asteroids: field.asteroids, startsAt: field.startsAt, oreTaken: taken },
    field.asteroidKey,
    epochs,
    origin.now,
    true,
  );
  const isotopes = projectIsotopeKnowledge(projected.asteroids.map((asteroid) => ({
    id: asteroid.id,
    isotopeRich: asteroid.isotopeRich,
    deuteriumShare: asteroid.deuteriumShare === null
      ? null
      : Math.round(asteroid.deuteriumShare * 100) / 100,
  })));
  return { ...view, isotopes };
}

async function launchViews(
  tx: Tx,
  origin: LockedPlanet,
  clock: Clock,
): Promise<Pick<MiningLaunch, 'mining' | 'pending' | 'planet'>> {
  // Deliberately sequential on one transaction connection. Each is the same
  // projection its GET endpoint uses, but no second HTTP request or second DB
  // snapshot can race the launch.
  const mining = await miningStatusAfterLaunch(tx, origin);
  const pending = await pendingThreads(tx, origin.planetId, origin.now);
  const planet = await planetView(tx, origin.planetId, clock);
  return { mining, pending, planet };
}

export interface MiningLaunch {
  runId: string;
  /** Absent on a harvest — a wreck field is not in the generated asteroid field. */
  asteroidIndex?: number;
  /** Public target handle. Absent on a harvest. */
  asteroidId?: string;
  craft: number;
  arriveAt: Date;
  flightMinutes: number;
  intercept: Vec3;
  /** Ore the squadron could carry if the rock still has it when they land. */
  capacity: number;
  /** Private run/hardware state, in the exact shape `/api/mining/status` serves. */
  mining: MiningStatusView;
  /** Mission strip state, protected against an older read landing after this POST. */
  pending: PendingThread[];
  /** The selected world after the Prospectors and one flight bay have left it. */
  planet: PlanetView;
}

/**
 * Send Prospectors at a rock.
 *
 * The aim point is solved once, here, and stored — see `mining_runs`. Re-deriving
 * it later would let a Drill upgrade mid-flight silently move a craft onto a new
 * course, and a player watching their squadron cross the disc would see it jump.
 */
export async function launchMining(
  db: Db,
  planetId: string,
  asteroidTarget: number | string,
  craft: number,
  clock: Clock,
  expectedPlayerId?: string,
): Promise<MiningLaunch> {
  if (!Number.isInteger(craft) || craft < 1) {
    throw new GameError('BAD_COUNT', 'Send at least one Prospector', 400, {
      context: 'prospector',
    });
  }

  return db.transaction(async (tx) => {
    const origin = await loadLocked(tx, planetId, clock, { expectedPlayerId });
    assertWorldOperational(origin);

    const field = await fieldOf(tx, origin.seasonId);
    const nowMinutes = minutesSince(field.startsAt, origin.now);
    const fromOpaqueId = typeof asteroidTarget === 'string';
    const asteroidIndex = fromOpaqueId
      ? asteroidIndexFromId(field.asteroidKey, field.asteroids, asteroidTarget)
      : asteroidTarget;
    const rock = asteroidIndex === null
      ? undefined
      : field.asteroids.find((candidate) => candidate.index === asteroidIndex);

    if (fromOpaqueId) {
      const epochs = await sensorHistoryForPlayer(tx, origin.playerId, field.startsAt);
      const earned = rock !== undefined
        && asteroidActive(rock, nowMinutes)
        && orbitDiscoveredAt(rock, epochs, nowMinutes) !== null;
      if (!earned) {
        throw new GameError(
          'ASTEROID_UNAVAILABLE',
          'That asteroid is not available to your sensors',
          404,
        );
      }
    }
    if (!rock || asteroidIndex === null) {
      throw new GameError('NO_SUCH_ASTEROID', 'No such asteroid', 404);
    }

    /**
     * NO GATE ON SENDING. D25.
     *
     * It used to demand a DRILL satellite, which is a structure that no longer
     * exists — a drill is a craft you build at the Shipyard. Owning one is the
     * whole permission; the DERRICK in orbit makes it faster and roomier.
     */
    const available = origin.homeFleet.PROSPECTOR ?? 0;
    if (available < craft) {
      throw new GameError('NOT_ENOUGH_CRAFT', `Only ${String(available)} Prospectors at home`, 400, {
        available,
      });
    }

    // Before the intercept solve: no point finding a meeting point for a launch
    // that has nowhere to launch from. D28.
    await assertFreeBay(tx, planetId, origin.buildings.CORE);

    if (!asteroidActive(rock, nowMinutes)) {
      throw new GameError('ASTEROID_GONE', 'That rock is not in the disc', 409);
    }
    if (
      rock.isotopeRich
      && !(await hasResearch(tx, origin.playerId, 'ISOTOPE_SPECTROMETRY'))
    ) {
      throw new GameError(
        'NEEDS_ISOTOPE_SPECTROMETRY',
        'Research Isotope Spectrometry before mining this anomaly',
        403,
      );
    }

    // Already stripped? Refuse before charging anyone a round trip for nothing.
    const [claim] = await tx
      .select()
      .from(asteroidClaims)
      .where(
        and(eq(asteroidClaims.seasonId, origin.seasonId), eq(asteroidClaims.index, asteroidIndex)),
      );
    if ((claim?.oreTaken ?? 0) >= rock.ore) {
      throw new GameError('ASTEROID_EMPTY', 'That rock has already been stripped', 409);
    }

    /**
     * One run per rock per planet.
     *
     * Enforced by a partial unique index as well as by this check: splitting a
     * squadron across two runs at the same target is pure micro-management with no
     * decision in it, and the index is what makes the guarantee survive a race.
     */
    const [existing] = await tx
      .select({ id: miningRuns.id })
      .from(miningRuns)
      .where(
        and(
          eq(miningRuns.planetId, planetId),
          eq(miningRuns.asteroidIndex, asteroidIndex),
          inArray(miningRuns.status, ['outbound', 'returning']),
        ),
      )
      .limit(1);
    if (existing) {
      throw new GameError('ALREADY_MINING', 'You already have craft working that rock', 409);
    }

    const speed = prospectorSpeed(origin.orbit);
    const hit = interceptAsteroid(origin, speed, rock, nowMinutes);
    if (!hit) {
      throw new GameError(
        'CANNOT_INTERCEPT',
        'It will leave the disc before your craft could reach it',
        409,
      );
    }

    const arriveAt = atMinute(field.startsAt, hit.meetsAtMinutes);
    // Priced at the RETURN speed, or this guard lets a player launch a run that
    // physically cannot get home before the season closes. D117.
    const homeMinutes = travelExact(
      distance(hit.at, origin),
      prospectorReturnSpeed(origin.orbit),
    );
    assertSeasonOpenThrough(origin, addMinutes(arriveAt, homeMinutes));
    const holdEach = prospectorHold(origin.orbit, await techOf(tx, origin.playerId));

    const [run] = await tx
      .insert(miningRuns)
      .values({
        seasonId: origin.seasonId,
        planetId,
        asteroidIndex,
        craft,
        holdEach,
        interceptX: hit.at.x,
        interceptY: hit.at.y,
        interceptZ: hit.at.z,
        departAt: origin.now,
        arriveAt,
      })
      .returning();

    // The craft leave the home stack, exactly like an attack fleet — they are
    // demonstrably not on the planet — but under a `mine:` location so nothing
    // that reads mission ids can mistake them for one.
    const remaining = { ...origin.homeFleet, PROSPECTOR: available - craft };
    await setUnits(tx, planetId, remaining, 'home');
    await setUnits(tx, planetId, { PROSPECTOR: craft }, `mine:${run!.id}`);

    await schedule(tx, {
      seasonId: origin.seasonId,
      kind: 'mining_arrival',
      refId: run!.id,
      resolveAt: arriveAt,
    });

    /**
     * AND THE RACE IS ANNOUNCED. D53.
     *
     * A mining run is the most public thing in the game — D19 publishes the whole
     * leg, the route and the clock, because two players racing for a rock is only
     * a race if both of them can see it. Learning about it up to thirty seconds
     * late is losing the part of the race that was worth watching.
     */
    await publishShard(tx, origin.seasonId, 'mining');
    // The shard wake lets everybody refresh the public race, but another tab or
    // phone owned by the launcher also needs the private run, bay and home-fleet
    // state. The initiating client already has the POST response; this narrow
    // private event closes the same-account multi-device gap.
    await publish(tx, origin.playerId, 'private:mining');

    return {
      runId: run!.id,
      asteroidIndex,
      asteroidId: asteroidId(field.asteroidKey, asteroidIndex),
      craft,
      arriveAt,
      flightMinutes: hit.flightMinutes,
      intercept: hit.at,
      capacity: holdEach * craft,
      ...await launchViews(tx, origin, clock),
    };
  });
}

/**
 * A squadron reaches the rock.
 *
 * Claims what it can carry and turns for home. Idempotent by the same mechanism
 * every other handler uses: the status transition is the claim, so an event
 * delivered twice does nothing the second time.
 */
export async function resolveMiningArrival(tx: Tx, runId: string, now: Date): Promise<void> {
  const claimed = await tx
    .update(miningRuns)
    .set({ status: 'returning' })
    .where(and(eq(miningRuns.id, runId), eq(miningRuns.status, 'outbound')))
    .returning();
  const run = claimed[0];
  if (!run) return; // already resolved by another worker

  /**
   * THE GALAXY SEES THE DRILL TURN FOR HOME. D53.
   *
   * Published from HERE rather than from the worker handler, because the claim
   * above is the thing that decides whether any work happened at all: a redelivered
   * event finds the row already `returning`, claims nothing, and must not send
   * three hundred clients to refetch a world that has not moved.
   */
  await publishShard(tx, run.seasonId, 'mining');

  let mined = { alloy: 0, crystal: 0, deuterium: 0 };

  /**
   * Branch on the COLUMN, never on `targetKind`.
   *
   * `mining_one_target` is a CHECK constraint, so `debrisFieldId is not null` is a
   * fact the database guarantees about this row. `targetKind` is a denormalised
   * label beside it that nothing enforces — and a row where the two disagreed
   * would fall through both arms here and silently mine nothing, which is the
   * quietest possible failure. The label exists for the wire (the client wants a
   * discriminant); the constraint decides what actually happens.
   */
  if (run.debrisFieldId !== null) {
    mined = await claimFromDebris(tx, run.debrisFieldId, run.holdEach * run.craft, now);
  }

  const { asteroids } = await fieldOf(tx, run.seasonId);
  const rockIndex = run.asteroidIndex;
  const rock = rockIndex === null ? undefined : asteroids.find((a) => a.index === rockIndex);

  if (rock && rockIndex !== null) {
    /**
     * Lock the claim row before reading it.
     *
     * Two squadrons landing in the same second is not a rare case — it is the
     * intended one, because the race is the decision. `ON CONFLICT DO UPDATE`
     * with the addition done in SQL means the second transaction blocks on the
     * first, then reads a total that already includes it.
     */
    const [existing] = await tx
      .select()
      .from(asteroidClaims)
      .where(
        and(
          eq(asteroidClaims.seasonId, run.seasonId),
          eq(asteroidClaims.index, rockIndex),
        ),
      )
      .for('update');

    const alreadyTaken = existing?.oreTaken ?? 0;
    const remaining = Math.max(0, rock.ore - alreadyTaken);
    const claim = claimOre(
      remaining,
      run.holdEach * run.craft,
      rock.crystalShare,
      rock.deuteriumShare,
    );
    mined = { alloy: claim.alloy, crystal: claim.crystal, deuterium: claim.deuterium };

    if (claim.taken > 0) {
      await tx
        .insert(asteroidClaims)
        .values({
          seasonId: run.seasonId,
          index: rockIndex,
          oreTaken: alreadyTaken + claim.taken,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: [asteroidClaims.seasonId, asteroidClaims.index],
          set: { oreTaken: alreadyTaken + claim.taken, updatedAt: now },
        });
      if (rock.isotopeRich && remaining - claim.taken <= 0) {
        await recordGalaxyEvent(tx, {
          seasonId: run.seasonId,
          kind: 'isotope_exhausted',
          refId: `${run.seasonId}:${String(rockIndex)}`,
          subjectPlanetId: null,
          payload: {},
          occurredAt: now,
        });
      }
    }
  }

  // Home the way they came. The rock has moved on, so the trip back is measured
  // from the meeting point rather than from wherever the rock is now.
  const [home] = await tx.select().from(planets).where(eq(planets.id, run.planetId));
  if (!home) throw new Error(`mining run ${runId} references a missing planet`);
  if (home.controllerPlayerId) {
    // The shard event refreshes only public field/traffic data at D99 scale. The
    // owner gets a private wake as well so their own run turns around on the same
    // committed instant, without making every other commander query private rows.
    await publish(tx, home.controllerPlayerId, 'mining_arrival');
  }

  /**
   * A LADEN CRAFT FLIES HOME AT A THIRD OF ITS OUTBOUND SPEED. D117.
   *
   * This is the only line that decides the return leg, and everything downstream
   * reads the `homeAt` it produces rather than recomputing a speed: the owner's
   * craft interpolates `arriveAt → homeAt` (`runPosition`), the public contact is
   * built from the same two instants (`projectGalaxyTraffic`), the countdown comes
   * off the instant, and the `mining_return` event is scheduled at it. So the
   * factor belongs here and nowhere else — the two guards that also mention the
   * trip home are proving a run can FINISH, not deciding when it does.
   *
   * Both kinds of run come through here — a rock and a wreck field — which is how
   * the salvage run pays the same price without a branch.
   */
  const back = travelExact(
    Math.hypot(run.interceptX - home.x, run.interceptY - home.y, run.interceptZ - home.z),
    // Re-read from what is CURRENTLY in orbit on purpose: the craft is a real
    // object being flown home, and a Derrick that lands while it is out
    // legitimately gets it back sooner. Only the aim point is frozen.
    prospectorReturnSpeed(await orbitOf(tx, run.planetId)),
  );
  const homeAt = addMinutes(now, back);

  await tx
    .update(miningRuns)
    .set({
      minedAlloy: mined.alloy,
      minedCrystal: mined.crystal,
      minedDeuterium: mined.deuterium,
      homeAt,
    })
    .where(eq(miningRuns.id, runId));

  await schedule(tx, {
    seasonId: run.seasonId,
    kind: 'mining_return',
    refId: runId,
    resolveAt: homeAt,
  });
}


export interface MiningDelivery {
  runId: string;
  craft: number;
  /** What actually reached the store. */
  delivered: { alloy: number; crystal: number; deuterium: number };
  /** What was mined but would not fit — the store was already full. */
  wasted: { alloy: number; crystal: number; deuterium: number };
}

/**
 * The squadron gets home and unloads.
 *
 * Ore goes STRAIGHT INTO STORAGE, not into the works: it was mined, not produced,
 * so the collector has nothing to do with it and a player who flew a mission
 * should not have to press a second button to be paid for it.
 *
 * Storage still caps. Anything over the ceiling is lost and reported as lost —
 * "the honest version shows the waste" — which is what makes emptying the store
 * before a big haul lands a real thing to think about.
 */
export async function resolveMiningReturn(
  tx: Tx,
  runId: string,
  clock: Clock,
): Promise<MiningDelivery | null> {
  const claimed = await tx
    .update(miningRuns)
    .set({ status: 'done' })
    .where(and(eq(miningRuns.id, runId), eq(miningRuns.status, 'returning')))
    .returning();
  const run = claimed[0];
  if (!run) return null;

  /** And again when it lands, for the same reason and on the same claim. D53. */
  await publishShard(tx, run.seasonId, 'mining');

  const planet = await loadLocked(tx, run.planetId, clock);

  /**
   * ORE COMES HOME INTO THE WORKS, NOT INTO STORAGE. D31.
   *
   * Measured with the real interception solver, one Prospector returns 589/h and
   * about eleven craft lift the galaxy's entire 6,393/h ore supply — with no
   * exposure of any kind, because mining sets no fleet status and craft in flight
   * cannot be raided. Income decoupled from the war economy is precisely what
   * emptied OGame's PvP layer through expeditions, and it was doing the same here.
   *
   * Landing it in the works fixes three things at once, all with rules that already
   * exist:
   *
   *   · THROUGHPUT RE-COUPLES TO THE PLANET. What you can absorb between
   *     collections is `collectorCap`, which scales with the Refinery and the
   *     Extractor — not with how many craft you own.
   *   · MINED ORE BECOMES RAIDABLE at `COMBAT.lootBufferShare`, and the vault does
   *     not cover the works at all. A miner is finally a target.
   *   · IT HAS TO BE COLLECTED, so a miner takes the same discipline as everyone
   *     else rather than banking straight to spendable stock.
   *
   * D19's race, D24's public mining runs and the telescope's fleet signal are all
   * untouched.
   *
   * THE TWO CEILINGS ARE INDEPENDENT, deliberately. A single shared factor — the
   * shape `computeLoot` uses for cargo — would throttle the alloy delivery because
   * the CRYSTAL works were full, and a player whose alloy works were half empty
   * cannot be told why they lost alloy. The crystal share of a rock runs as high as
   * 0.65 while the crystal works are roughly a third the size of the alloy ones, so
   * that case is common rather than exotic. Losing only the pile that had nowhere
   * to go is both smaller and explainable.
   */
  const boost = productionMult(planet.orbit);
  const roomAlloy = Math.max(
    0,
    collectorCap(alloyRate(planet.buildings.REFINERY) * boost) - planet.bufferAlloy,
  );
  const roomCrystal = Math.max(
    0,
    collectorCap(crystalRate(planet.buildings.EXTRACTOR) * boost) - planet.bufferCrystal,
  );
  const roomDeuterium = Math.max(
    0,
    deuteriumCollectorCap(
      deuteriumRate(planet.buildings.DEUTERIUM_PLANT) * boost,
      crystalRate(planet.buildings.EXTRACTOR) * boost,
    )
      - planet.bufferDeuterium,
  );
  const gotAlloy = Math.min(run.minedAlloy, roomAlloy);
  const gotCrystal = Math.min(run.minedCrystal, roomCrystal);
  const gotDeuterium = Math.min(run.minedDeuterium, roomDeuterium);

  await saveResources(tx, run.planetId, {
    alloy: planet.alloy,
    crystal: planet.crystal,
    deuterium: planet.deuterium,
    bufferAlloy: planet.bufferAlloy + gotAlloy,
    bufferCrystal: planet.bufferCrystal + gotCrystal,
    bufferDeuterium: planet.bufferDeuterium + gotDeuterium,
  });

  // The craft rejoin the garrison, and their in-flight row goes away. Read the
  // home count fresh rather than trusting the launch-time figure: other runs may
  // have landed while this one was out.
  const [atHome] = await tx
    .select()
    .from(units)
    .where(
      and(
        eq(units.planetId, run.planetId),
        eq(units.hull, 'PROSPECTOR'),
        eq(units.location, 'home'),
      ),
    );
  await setUnits(tx, run.planetId, { PROSPECTOR: (atHome?.count ?? 0) + run.craft }, 'home');
  await tx
    .delete(units)
    .where(and(eq(units.planetId, run.planetId), eq(units.location, `mine:${runId}`)));

  return {
    runId,
    craft: run.craft,
    delivered: { alloy: gotAlloy, crystal: gotCrystal, deuterium: gotDeuterium },
    wasted: {
      alloy: run.minedAlloy - gotAlloy,
      crystal: run.minedCrystal - gotCrystal,
      deuterium: run.minedDeuterium - gotDeuterium,
    },
  };
}

/** Runs still out, for the pending strip and the galaxy view. */
export async function activeMiningRuns(db: Queryable, planetId: string) {
  return db
    .select()
    .from(miningRuns)
    .where(
      and(eq(miningRuns.planetId, planetId), inArray(miningRuns.status, ['outbound', 'returning'])),
    );
}

/** Every live run whose origin is currently controlled by this commander. */
export async function activePlayerMiningRuns(db: Queryable, playerId: string) {
  return db
    .select({ run: miningRuns })
    .from(miningRuns)
    .innerJoin(planets, eq(planets.id, miningRuns.planetId))
    .where(and(
      eq(planets.controllerPlayerId, playerId),
      inArray(miningRuns.status, ['outbound', 'returning']),
    ))
    .then((rows) => rows.map((row) => row.run));
}

/*
 * TWO EXPORTS USED TO LIVE HERE AND NOTHING EVER CALLED EITHER. D52a.
 *
 * `asteroidAt` documented itself as "exported so the galaxy route can answer 'is
 * this still worth chasing'" — a caller that has never existed. `pruneAsteroidClaims`
 * was labelled housekeeping and was never scheduled, so the rows it existed to
 * remove were never removed; they are bounded by the number of rocks in a season,
 * never read again once a rock expires (`visibleAsteroids` filters to LIVE indexes)
 * and cleared by the wipe, so nothing was leaking but the reader's attention.
 *
 * A public surface a future reader has to assume is load-bearing costs more than a
 * function is worth. If either is wanted, it is four lines and a test.
 */

/* ── wreckage ───────────────────────────────────────────────── */

/**
 * Take what a squadron can carry out of a wreck field. D32.
 *
 * The same first-come-first-served race as an asteroid, and the same locking: the
 * row is taken `FOR UPDATE` so two harvesters landing in the same second block on
 * each other rather than both reading the pre-claim total. Decay is applied at read
 * time from the clock, so nothing about the field's current value is stored.
 */
export async function claimFromDebris(
  tx: Tx,
  fieldId: string,
  hold: number,
  now: Date,
): Promise<{ alloy: number; crystal: number; deuterium: number }> {
  const [field] = await tx
    .select()
    .from(debrisFields)
    .where(eq(debrisFields.id, fieldId))
    .for('update');
  if (!field) return { alloy: 0, crystal: 0, deuterium: 0 };

  const age = (now.getTime() - field.createdAt.getTime()) / 60_000;
  const alloyLeft = debrisRemaining(field.alloy, field.takenAlloy, age);
  const crystalLeft = debrisRemaining(field.crystal, field.takenCrystal, age);
  const deuteriumLeft = debrisRemaining(field.deuterium, field.takenDeuterium, age);
  const claim = claimDebris(alloyLeft, crystalLeft, deuteriumLeft, hold);

  if (claim.alloy > 0 || claim.crystal > 0 || claim.deuterium > 0) {
    await tx
      .update(debrisFields)
      .set({
        takenAlloy: field.takenAlloy + claim.alloy,
        takenCrystal: field.takenCrystal + claim.crystal,
        takenDeuterium: field.takenDeuterium + claim.deuterium,
      })
      .where(eq(debrisFields.id, fieldId));

    /**
     * EXHAUSTED IS PER COLUMN, NOT A SINGLE TOTAL — and the total was a latent bug.
     *
     * `claimDebris` floors each resource separately, so a fully drained field can
     * still show a fractional residue in every column at once: up to just under
     * three in total, against a threshold of one. The event therefore fired only
     * when the decay arithmetic happened to land favourably, and a two-column field
     * that had been swept clean routinely announced nothing.
     *
     * A column holding less than one whole unit can never be claimed again, because
     * the floor takes it to zero. So "every column is under one" is the exact
     * statement of finished, and it cannot be knocked out by rounding.
     */
    const leftAfter = Math.max(
      alloyLeft - claim.alloy,
      crystalLeft - claim.crystal,
      deuteriumLeft - claim.deuterium,
    );
    if (leftAfter < 1) {
      /*
        A VOID WRECK EXHAUSTING NAMES NO WORLD, SO IT IS NOT A CHRONICLE LINE. D96.

        The chronicle records public transitions and identifies them by the world
        they happened to; a pirate battle's wreckage happened at a rendezvous with
        no address. Rather than invent a subject, the stripped field simply passes
        without an entry — which is also what `subjectPlanetId` being non-null in
        that payload has always meant.
      */
      const identity = field.planetId === null
        ? null
        : await publicPlanetIdentity(tx, field.planetId);
      if (identity && field.planetId !== null) {
        await recordGalaxyEvent(tx, {
          seasonId: field.seasonId,
          kind: 'wreck_exhausted',
          refId: field.id,
          subjectPlanetId: field.planetId,
          payload: identity,
          occurredAt: now,
        });
      }
    }
  }
  return claim;
}

/** Every wreck field still worth flying to, for the whole galaxy. Public. */
export async function visibleDebris(db: Queryable, seasonId: string, now: Date) {
  /**
   * Pruned in SQL, not in JS.
   *
   * A field older than its decay life is empty by arithmetic — `debrisRemaining`
   * can only return 0 for it — so there is no reading in which those rows matter.
   * Selecting them anyway made this an UNBOUNDED query: nothing ever deletes a
   * debris row, so by the end of a season this would pull every battle the galaxy
   * has ever fought on every read of the disc. `debris_season_idx` is
   * `(season_id, created_at)` and serves this exactly.
   */
  return projectVisibleDebris(await loadMiningSnapshot(db, seasonId, now), now);
}

/**
 * Send craft to a wreck field. D32.
 *
 * Deliberately NOT `interceptAsteroid`: a field does not move, so this is a plain
 * flight to a fixed point and the solver would be answering a question nobody
 * asked. Everything else — the bay, the parked craft, the claim race on arrival,
 * the trip home — is the mining path, because a harvest is the same shape as a
 * mining run and duplicating it would mean maintaining two of everything.
 */
export async function launchHarvest(
  db: Db,
  planetId: string,
  fieldId: string,
  craft: number,
  clock: Clock,
  expectedPlayerId?: string,
): Promise<MiningLaunch> {
  if (!Number.isInteger(craft) || craft < 1) {
    throw new GameError('BAD_COUNT', 'Send at least one craft', 400, { context: 'craft' });
  }

  return db.transaction(async (tx) => {
    const origin = await loadLocked(tx, planetId, clock, { expectedPlayerId });
    assertWorldOperational(origin);

    const available = origin.homeFleet.PROSPECTOR ?? 0;
    if (available < craft) {
      throw new GameError('NOT_ENOUGH_CRAFT', `Only ${String(available)} Prospectors at home`, 400, {
        available,
      });
    }

    await assertFreeBay(tx, planetId, origin.buildings.CORE);

    const [field] = await tx
      .select()
      .from(debrisFields)
      .where(and(eq(debrisFields.id, fieldId), eq(debrisFields.seasonId, origin.seasonId)));
    if (!field) throw new GameError('NO_SUCH_FIELD', 'No such wreck field', 404);

    const age = (origin.now.getTime() - field.createdAt.getTime()) / 60_000;
    if (
      !debrisAlive(
        field.alloy,
        field.crystal,
        field.deuterium,
        field.takenAlloy,
        field.takenCrystal,
        field.takenDeuterium,
        age,
      )
    ) {
      throw new GameError('FIELD_GONE', 'There is nothing left of it', 409);
    }

    const [existing] = await tx
      .select({ id: miningRuns.id })
      .from(miningRuns)
      .where(
        and(
          eq(miningRuns.planetId, planetId),
          eq(miningRuns.debrisFieldId, fieldId),
          inArray(miningRuns.status, ['outbound', 'returning']),
        ),
      )
      .limit(1);
    if (existing) throw new GameError('ALREADY_HARVESTING', 'You already have craft there', 409);

    /*
      THE FIELD'S OWN POSITION, NOT ITS WORLD'S. D150.

      This used to dereference `planetId` and read the coordinates off the planet
      row, which stopped being possible the moment a battle could happen in open
      space. The column is on the field for every kind of wreck, so this is one
      lookup fewer as well as one branch fewer.
    */
    const target = { x: field.x, y: field.y, z: field.z };

    const speed = prospectorSpeed(origin.orbit);
    const dist = distance(origin, target);
    // A harvest is the same craft on a different errand, so it flies by the same
    // rule as a mining run — mining's own launch overhead, not a warship's. D48.
    // Out at hull speed and home at a third of it, for the same reason and through
    // the same turn-around line: a wreck field is not a faster way home. D117.
    const outbound = travelExact(dist, speed);
    const homeMinutes = travelExact(dist, prospectorReturnSpeed(origin.orbit));
    const arriveAt = addMinutes(origin.now, outbound);
    assertSeasonOpenThrough(origin, addMinutes(arriveAt, homeMinutes));
    const holdEach = prospectorHold(origin.orbit, await techOf(tx, origin.playerId));

    const [run] = await tx
      .insert(miningRuns)
      .values({
        seasonId: origin.seasonId,
        planetId,
        targetKind: 'debris',
        debrisFieldId: fieldId,
        craft,
        holdEach,
        interceptX: target.x,
        interceptY: target.y,
        interceptZ: target.z,
        departAt: origin.now,
        arriveAt,
      })
      .returning();

    const remaining = { ...origin.homeFleet, PROSPECTOR: available - craft };
    await setUnits(tx, planetId, remaining, 'home');
    await setUnits(tx, planetId, { PROSPECTOR: craft }, `mine:${run!.id}`);

    await schedule(tx, {
      seasonId: origin.seasonId,
      kind: 'mining_arrival',
      refId: run!.id,
      resolveAt: arriveAt,
    });

    /** A salvage run is a race for a public landmark, exactly like a rock. D53. */
    await publishShard(tx, origin.seasonId, 'mining');
    await publish(tx, origin.playerId, 'private:mining');

    return {
      runId: run!.id,
      craft,
      arriveAt,
      flightMinutes: outbound,
      intercept: { x: target.x, y: target.y, z: target.z },
      capacity: holdEach * craft,
      ...await launchViews(tx, origin, clock),
    };
  });
}
