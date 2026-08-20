import { and, eq, gt, inArray } from 'drizzle-orm';
import {
  activeAsteroids,
  asteroidActive,
  claimOre,
  interceptAsteroid,
  prospectorHold,
  prospectorSpeed,
  prospectorTravelMinutes,
  DEBRIS,
  claimDebris,
  collectorCap,
  debrisAlive,
  debrisRemaining,
  productionMult,
  alloyRate,
  crystalRate,
  distance,
  type AsteroidSpec,
  type Vec3,
} from '@blindspace/rules';
import { addMinutes, atMinute, minutesSince, type Clock } from '../clock.js';
import type { Db, Queryable, Tx } from '../db/client.js';
import { asteroidClaims, debrisFields, miningRuns, planets, seasons, units } from '../db/schema.js';
import { assertFreeBay } from './flight.js';
import { GameError, loadLocked, orbitOf, saveResources, setUnits } from './planet.js';
import { galaxyOf } from './season.js';
import { schedule } from '../worker/queue.js';
import { publishShard } from '../stream/bus.js';

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
}> {
  const [season] = await tx.select().from(seasons).where(eq(seasons.id, seasonId));
  if (!season) throw new GameError('SEASON_NOT_FOUND', 'No such season', 404);
  // The asteroid schedule is a function of the seed alone, so the slot count
  // passed here cannot change it — see `generateGalaxy`.
  return { asteroids: galaxyOf(seasonId, season.seed).asteroids, startsAt: season.startsAt };
}

export interface AsteroidView extends AsteroidSpec {
  /** Ore still in it. Public — everyone races for the same rock. */
  oreRemaining: number;
}

/**
 * Every rock in the disc right now, with what is left in it.
 *
 * PUBLIC BY DESIGN. Asteroids are not part of the fog: they are physical objects
 * on open trajectories and the race only works if everyone can see the same prize.
 * Nothing here reveals anything about a player.
 */
export async function visibleAsteroids(
  db: Db,
  seasonId: string,
  now: Date,
): Promise<AsteroidView[]> {
  const { asteroids, startsAt } = await fieldOf(db, seasonId);
  const live = activeAsteroids(asteroids, minutesSince(startsAt, now));
  if (live.length === 0) return [];

  const claims = await db
    .select()
    .from(asteroidClaims)
    .where(
      and(
        eq(asteroidClaims.seasonId, seasonId),
        inArray(asteroidClaims.index, live.map((a) => a.index)),
      ),
    );
  const taken = new Map(claims.map((c) => [c.index, c.oreTaken]));

  return live
    .map((a) => ({ ...a, oreRemaining: Math.max(0, a.ore - (taken.get(a.index) ?? 0)) }))
    // A rock that has been stripped is gone as far as anyone is concerned; leaving
    // it on the map would advertise a trip that pays nothing.
    .filter((a) => a.oreRemaining > 0);
}

export interface MiningLaunch {
  runId: string;
  /** Absent on a harvest — a wreck field is not in the generated asteroid field. */
  asteroidIndex?: number;
  craft: number;
  arriveAt: Date;
  flightMinutes: number;
  intercept: Vec3;
  /** Ore the squadron could carry if the rock still has it when they land. */
  capacity: number;
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
  asteroidIndex: number,
  craft: number,
  clock: Clock,
): Promise<MiningLaunch> {
  if (!Number.isInteger(craft) || craft < 1) {
    throw new GameError('BAD_COUNT', 'Send at least one Prospector');
  }

  return db.transaction(async (tx) => {
    const origin = await loadLocked(tx, planetId, clock);

    /**
     * NO GATE ON SENDING. D25.
     *
     * It used to demand a DRILL satellite, which is a structure that no longer
     * exists — a drill is a craft you build at the Shipyard. Owning one is the
     * whole permission; the DERRICK in orbit makes it faster and roomier.
     */
    const available = origin.homeFleet.PROSPECTOR ?? 0;
    if (available < craft) {
      throw new GameError('NOT_ENOUGH_CRAFT', `Only ${String(available)} Prospectors at home`);
    }

    // Before the intercept solve: no point finding a meeting point for a launch
    // that has nowhere to launch from. D28.
    await assertFreeBay(tx, planetId, origin.buildings.CORE);

    const { asteroids, startsAt } = await fieldOf(tx, origin.seasonId);
    const rock = asteroids.find((a) => a.index === asteroidIndex);
    if (!rock) throw new GameError('NO_SUCH_ASTEROID', 'No such asteroid', 404);

    const nowMinutes = minutesSince(startsAt, origin.now);
    if (!asteroidActive(rock, nowMinutes)) {
      throw new GameError('ASTEROID_GONE', 'That rock is not in the disc', 409);
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

    const arriveAt = atMinute(startsAt, hit.meetsAtMinutes);
    const holdEach = prospectorHold(origin.orbit);

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

    return {
      runId: run!.id,
      asteroidIndex,
      craft,
      arriveAt,
      flightMinutes: hit.flightMinutes,
      intercept: hit.at,
      capacity: holdEach * craft,
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
   * fifty clients to refetch a world that has not moved.
   */
  await publishShard(tx, run.seasonId, 'mining');

  let mined = { alloy: 0, crystal: 0 };

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
    const claim = claimOre(remaining, run.holdEach * run.craft, rock.crystalShare);
    mined = { alloy: claim.alloy, crystal: claim.crystal };

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
    }
  }

  // Home the way they came. The rock has moved on, so the trip back is measured
  // from the meeting point rather than from wherever the rock is now.
  const [home] = await tx.select().from(planets).where(eq(planets.id, run.planetId));
  if (!home) throw new Error(`mining run ${runId} references a missing planet`);

  const back = prospectorTravelMinutes(
    Math.hypot(run.interceptX - home.x, run.interceptY - home.y, run.interceptZ - home.z),
    // Re-read from what is CURRENTLY in orbit on purpose: the craft is a real
    // object being flown home, and a Derrick that lands while it is out
    // legitimately gets it back sooner. Only the aim point is frozen.
    prospectorSpeed(await orbitOf(tx, run.planetId)),
  );
  const homeAt = addMinutes(now, back);

  await tx
    .update(miningRuns)
    .set({ minedAlloy: mined.alloy, minedCrystal: mined.crystal, homeAt })
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
  delivered: { alloy: number; crystal: number };
  /** What was mined but would not fit — the store was already full. */
  wasted: { alloy: number; crystal: number };
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
  const gotAlloy = Math.min(run.minedAlloy, roomAlloy);
  const gotCrystal = Math.min(run.minedCrystal, roomCrystal);

  await saveResources(tx, run.planetId, {
    alloy: planet.alloy,
    crystal: planet.crystal,
    bufferAlloy: planet.bufferAlloy + gotAlloy,
    bufferCrystal: planet.bufferCrystal + gotCrystal,
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
    delivered: { alloy: gotAlloy, crystal: gotCrystal },
    wasted: {
      alloy: run.minedAlloy - gotAlloy,
      crystal: run.minedCrystal - gotCrystal,
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
): Promise<{ alloy: number; crystal: number }> {
  const [field] = await tx
    .select()
    .from(debrisFields)
    .where(eq(debrisFields.id, fieldId))
    .for('update');
  if (!field) return { alloy: 0, crystal: 0 };

  const age = (now.getTime() - field.createdAt.getTime()) / 60_000;
  const alloyLeft = debrisRemaining(field.alloy, field.takenAlloy, age);
  const crystalLeft = debrisRemaining(field.crystal, field.takenCrystal, age);
  const claim = claimDebris(alloyLeft, crystalLeft, hold);

  if (claim.alloy > 0 || claim.crystal > 0) {
    await tx
      .update(debrisFields)
      .set({
        takenAlloy: field.takenAlloy + claim.alloy,
        takenCrystal: field.takenCrystal + claim.crystal,
      })
      .where(eq(debrisFields.id, fieldId));
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
  const oldest = new Date(now.getTime() - DEBRIS.decayMinutes * 60_000);
  const rows = await db
    .select()
    .from(debrisFields)
    .where(and(eq(debrisFields.seasonId, seasonId), gt(debrisFields.createdAt, oldest)));

  return rows
    .map((d) => {
      const age = (now.getTime() - d.createdAt.getTime()) / 60_000;
      return {
        id: d.id,
        planetId: d.planetId,
        alloy: debrisRemaining(d.alloy, d.takenAlloy, age),
        crystal: debrisRemaining(d.crystal, d.takenCrystal, age),
        minutesLeft: Math.max(0, DEBRIS.decayMinutes - age),
        createdAt: d.createdAt,
      };
    })
    .filter((d) => d.alloy + d.crystal > 1);
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
): Promise<MiningLaunch> {
  if (!Number.isInteger(craft) || craft < 1) {
    throw new GameError('BAD_COUNT', 'Send at least one craft');
  }

  return db.transaction(async (tx) => {
    const origin = await loadLocked(tx, planetId, clock);

    const available = origin.homeFleet.PROSPECTOR ?? 0;
    if (available < craft) {
      throw new GameError('NOT_ENOUGH_CRAFT', `Only ${String(available)} Prospectors at home`);
    }

    await assertFreeBay(tx, planetId, origin.buildings.CORE);

    const [field] = await tx
      .select()
      .from(debrisFields)
      .where(and(eq(debrisFields.id, fieldId), eq(debrisFields.seasonId, origin.seasonId)));
    if (!field) throw new GameError('NO_SUCH_FIELD', 'No such wreck field', 404);

    const age = (origin.now.getTime() - field.createdAt.getTime()) / 60_000;
    if (
      !debrisAlive(field.alloy, field.crystal, field.takenAlloy, field.takenCrystal, age)
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

    const [target] = await tx.select().from(planets).where(eq(planets.id, field.planetId));
    if (!target) throw new GameError('NO_SUCH_FIELD', 'No such wreck field', 404);

    const speed = prospectorSpeed(origin.orbit);
    const dist = distance(origin, target);
    // A harvest is the same craft on a different errand, so it flies by the same
    // rule as a mining run — mining's own launch overhead, not a warship's. D48.
    const oneWay = prospectorTravelMinutes(dist, speed);
    const arriveAt = addMinutes(origin.now, oneWay);
    const holdEach = prospectorHold(origin.orbit);

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

    return {
      runId: run!.id,
      craft,
      arriveAt,
      flightMinutes: oneWay,
      intercept: { x: target.x, y: target.y, z: target.z },
      capacity: holdEach * craft,
    };
  });
}
