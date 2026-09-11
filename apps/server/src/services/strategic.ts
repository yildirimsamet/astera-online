import { and, eq, inArray, sql } from 'drizzle-orm';
import {
  ANTI_STRATEGIC,
  BUILDING_IDS,
  DEATH_STAR,
  MULTI_WORLD,
  interceptionRange,
  strategicStockpile,
  buildingCost,
  distance,
  fleetValue,
  instrumentCost,
  maxRadarRange,
  travelExact,
  type BuildingId,
  type Fleet,
  type Resources,
} from '@astera/rules';
import { addMinutes, type Clock } from '../clock.js';
import type { Db, Tx } from '../db/client.js';
import {
  buildings,
  missions,
  neutralPlanetState,
  planets,
  satellites,
  strategicAssets,
  type StrategicDestroyedOrder,
  type StrategicLevelChange,
} from '../db/schema.js';
import { publishShard } from '../stream/bus.js';
import { schedule } from '../worker/queue.js';
import { destroyBuildingOrders } from './buildQueue.js';
import { assertFreeBay } from './flight.js';
import { advanceNeutralEconomy } from './neutral.js';
import { capitalPlanet, lockWorlds } from './ownership.js';
import { assertNewcomerShields } from './player.js';
import {
  GameError,
  assertSeasonOpenThrough,
  assertWorldOperational,
  loadLocked,
  recomputePlayerWealth,
  saveResources,
} from './planet.js';
import { planetView } from './planetView.js';
import { hasResearch, researchLevels } from './researchState.js';
import { pendingThreads } from './session.js';
import { inboundRadarLead } from './radar.js';
import { assertClanHostilityAllowed, lockClanPlayers } from './clanCombat.js';
import { refreshSensorEpoch } from './sensorHistory.js';

/**
 * WHAT AN IMPACT COSTS THE WORLD IT LANDS ON. D113.
 *
 * The Core is the only building a strike lowers directly. Every other building
 * is bound by `CORE_CEILING` — `build.ts` refuses to raise one to or past the
 * Core — so a Core that has just fallen leaves anything sitting on the old
 * ceiling one level above a limit the game will not otherwise let you reach.
 * Those are clamped back to the new Core, which is why a Refinery sometimes
 * drops with the Core and sometimes does not: it drops exactly when the Core
 * required it to.
 */
/*
  EVERY REMAINING BUILDING IS CLAMPED, AND THE STRIKE DESTROYS NOTHING. T4.

  A strike drops the Core, and no building may stand above it — so a Yard does
  fall, and the world can land under its own fleet. That overflow is legal by
  design: the rule is that nothing NEW comes in, never that something already
  there goes. A strike that also deleted the ships it left no room for would be
  doing the one thing the whole capacity design refuses.
*/
const CORE_BOUND_BUILDINGS = [
  'REFINERY', 'EXTRACTOR', 'VAULT', 'SHIPYARD', 'DEUTERIUM_PLANT',
] as const;
/*
  AND THE FLEET IS NOT TOUCHED EITHER. D179, owner instruction.

  `DESTROYED_HOME = ALL_HULLS` stood here and the delete that read it took every
  hull standing at home — the defender's whole standing force, on any world, the
  Prospector included. It was the strike's largest single number and the loudest
  thing about it, and it is gone.

  WHAT REPLACES IT IS THE OUTAGE. The ships survive but may not move: the recovery
  window seals the bays through `assertWorldOperational`, and `startAttack` refuses
  a raid on a recovering world, so for two hours the fleet is present, safe and
  useless. That is the shape the owner asked for — the commander keeps what they
  built and loses the tempo.

  NOTHING IS EXEMPTED, NEUTRALS INCLUDED. A garrison on a world nobody holds
  survives a strike too, so softening a fortified neutral with a rocket before
  settling it is no longer a play. That was weighed and chosen: one sentence the
  whole galaxy can hold beats an exception nobody would find.
*/
const BUILDING_TYPES = new Set<string>(BUILDING_IDS);
const isBuildingId = (value: string): value is BuildingId => BUILDING_TYPES.has(value);

/** Half of a stale figure is not half of what is there — see `stockShareDestroyed`. */
const survives = (amount: number): number =>
  Math.floor(amount * (1 - DEATH_STAR.stockShareDestroyed));

export async function buildDeathStar(db: Db, planetId: string, clock: Clock, expectedPlayerId?: string) {
  return db.transaction(async (tx) => {
    const planet = await loadLocked(tx, planetId, clock, { expectedPlayerId });
    assertWorldOperational(planet);
    if (!(await hasResearch(tx, planet.playerId, DEATH_STAR.requiredResearch))) {
      throw new GameError('DEATH_STAR_LOCKED', 'Research Death Star Protocol first', 403);
    }
    if (
      planet.buildings.CORE < DEATH_STAR.requiredCore
      || planet.buildings.SHIPYARD < DEATH_STAR.requiredShipyard
    ) {
      throw new GameError('DEATH_STAR_LOCKED', 'Raise Core and Shipyard first', 403);
    }
    /**
     * HOW MANY MAY BE ON THE PAD AT ONCE. T11.
     *
     * Counted rather than existence-checked, because the stockpile research raises
     * the ceiling from one to two. Under the planet row lock `loadLocked` already
     * holds, so the count-then-insert cannot race — which is now the only guard,
     * the partial unique index having been relaxed to admit the second weapon.
     */
    const live = await tx
      .select({ id: strategicAssets.id, readyAt: strategicAssets.readyAt })
      .from(strategicAssets)
      .where(and(
        eq(strategicAssets.planetId, planetId),
        eq(strategicAssets.type, 'DEATH_STAR'),
        inArray(strategicAssets.status, ['BUILDING', 'PAUSED', 'READY']),
      ));
    const allowed = strategicStockpile(
      (await researchLevels(tx, planet.playerId)).get('STRATEGIC_STOCKPILE') ?? 0,
    );
    if (live.length >= allowed) {
      throw new GameError('DEATH_STAR_EXISTS', 'This world already has one', 409, {
        held: live.length,
        allowed,
      });
    }
    if (
      planet.alloy < DEATH_STAR.cost.alloy
      || planet.crystal < DEATH_STAR.cost.crystal
      || planet.deuterium < DEATH_STAR.cost.deuterium
    ) {
      throw new GameError('INSUFFICIENT_RESOURCES', 'Not enough resources');
    }

    /**
     * SERIAL, AND THAT IS THE WHOLE BALANCE OF THE STOCKPILE. T11.
     *
     * The second weapon starts when the first is finished, never beside it — so two
     * weapons still cost two full builds and what the research removes is the CHORE
     * of being at the keyboard at the exact minute. Built in parallel it would be a
     * same-hour double strike: the bait and the blow D139 prices one charge against
     * arriving together for the price of one wait.
     */
    const queueHead = live.reduce<Date>(
      (latest, row) => (row.readyAt && row.readyAt > latest ? row.readyAt : latest),
      planet.now,
    );
    const readyAt = addMinutes(queueHead, DEATH_STAR.buildMinutes);
    if (readyAt >= planet.seasonEndsAt) {
      throw new GameError(
        'SEASON_ENDS_BEFORE_BUILD',
        'That order cannot finish before the season ends',
        409,
        { endsAt: planet.seasonEndsAt.toISOString() },
      );
    }

    await saveResources(tx, planetId, {
      alloy: planet.alloy - DEATH_STAR.cost.alloy,
      crystal: planet.crystal - DEATH_STAR.cost.crystal,
      deuterium: planet.deuterium - DEATH_STAR.cost.deuterium,
    });
    const [asset] = await tx
      .insert(strategicAssets)
      .values({
        planetId,
        status: 'BUILDING',
        startedAt: queueHead,
        readyAt,
        remainingSeconds: DEATH_STAR.buildMinutes * 60,
      })
      .returning();
    if (!asset) throw new Error('strategic asset insert returned no row');
    await schedule(tx, {
      seasonId: planet.seasonId,
      kind: 'death_star_ready',
      refId: asset.id,
      payload: { expectedReadyAt: readyAt.toISOString() },
      resolveAt: readyAt,
    });
    return { assetId: asset.id, readyAt, planet: await planetView(tx, planetId, clock) };
  });
}

/**
 * INSTALL, OR RELOAD, ONE INTERCEPTION CHARGE. T10.
 *
 * The same shape as the weapon it answers — a strategic asset on the planet, built
 * through a scheduled completion — because it IS the same kind of thing: installed
 * hardware that comes with the world, survives an ordinary raid, and is spent in
 * one moment. A charge is one row; firing consumes it and reloading is another
 * build, so "how many shots do I have" is a question with a row-shaped answer.
 */
export async function buildInterceptor(
  db: Db,
  planetId: string,
  clock: Clock,
  expectedPlayerId?: string,
) {
  return db.transaction(async (tx) => {
    const planet = await loadLocked(tx, planetId, clock, { expectedPlayerId });
    assertWorldOperational(planet);
    if (!(await hasResearch(tx, planet.playerId, ANTI_STRATEGIC.requiredResearch))) {
      throw new GameError('INTERCEPTOR_LOCKED', 'Research the Interception Grid first', 403, {
        requiredRadar: ANTI_STRATEGIC.requiredRadar,
      });
    }
    /*
      THE RADAR RUNG IS A BUILD REQUIREMENT, NOT A RUNTIME SURPRISE.

      Below it `interceptionRange` is zero — there is no circle to fire along — so a
      grid installed there could never go off and its owner would have no way of
      learning why. Refusing at the counter is the honest version of that.
    */
    /*
      THE EFFECTIVE RUNG, NOT THE INSTALLED ONE.

      An Uplink gates the Telescope and the Radar, so a Radar 5 with no Uplink
      draws no circle at all — and the handler that fires reads exactly this
      effective figure. Checking the raw level here would sell a grid to a world
      whose ring does not exist, which is the trap this requirement is for.
    */
    const radar = planet.effectiveInstruments.RADAR ?? 0;
    if (interceptionRange(radar) <= 0) {
      throw new GameError('INTERCEPTOR_LOCKED', 'Raise the Radar first', 403, {
        requiredRadar: ANTI_STRATEGIC.requiredRadar,
        radar,
      });
    }
    const live = await tx
      .select({ id: strategicAssets.id })
      .from(strategicAssets)
      .where(and(
        eq(strategicAssets.planetId, planetId),
        eq(strategicAssets.type, 'INTERCEPTOR'),
        inArray(strategicAssets.status, ['BUILDING', 'PAUSED', 'READY']),
      ));
    if (live.length >= ANTI_STRATEGIC.maxCharges) {
      throw new GameError('INTERCEPTOR_LOADED', 'That world is already loaded', 409, {
        max: ANTI_STRATEGIC.maxCharges,
      });
    }
    if (
      planet.alloy < ANTI_STRATEGIC.cost.alloy
      || planet.crystal < ANTI_STRATEGIC.cost.crystal
      || planet.deuterium < ANTI_STRATEGIC.cost.deuterium
    ) {
      throw new GameError('INSUFFICIENT_RESOURCES', 'Not enough resources');
    }

    const readyAt = addMinutes(planet.now, ANTI_STRATEGIC.buildMinutes);
    if (readyAt >= planet.seasonEndsAt) {
      throw new GameError(
        'SEASON_ENDS_BEFORE_BUILD',
        'That order cannot finish before the season ends',
        409,
        { endsAt: planet.seasonEndsAt.toISOString() },
      );
    }
    await saveResources(tx, planetId, {
      alloy: planet.alloy - ANTI_STRATEGIC.cost.alloy,
      crystal: planet.crystal - ANTI_STRATEGIC.cost.crystal,
      deuterium: planet.deuterium - ANTI_STRATEGIC.cost.deuterium,
    });
    const [asset] = await tx
      .insert(strategicAssets)
      .values({
        planetId,
        type: 'INTERCEPTOR',
        status: 'BUILDING',
        startedAt: planet.now,
        readyAt,
        remainingSeconds: ANTI_STRATEGIC.buildMinutes * 60,
      })
      .returning();
    if (!asset) throw new Error('interceptor insert returned no row');
    // The same completion event the weapon uses: one asset lifecycle, not two.
    await schedule(tx, {
      seasonId: planet.seasonId,
      kind: 'death_star_ready',
      refId: asset.id,
      payload: { expectedReadyAt: readyAt.toISOString() },
      resolveAt: readyAt,
    });
    return { assetId: asset.id, readyAt, planet: await planetView(tx, planetId, clock) };
  });
}

export async function launchDeathStar(
  db: Db,
  originPlanetId: string,
  targetPlanetId: string,
  clock: Clock,
  expectedPlayerId?: string,
  /** The commander has been told this spends their own first-day shield. D183. */
  acknowledgeShieldLoss?: boolean,
) {
  if (originPlanetId === targetPlanetId) {
    throw new GameError('SELF_ATTACK', 'You cannot target your own world', 400);
  }
  return db.transaction(async (tx) => {
    const [identity] = await tx
      .select({ playerId: planets.controllerPlayerId })
      .from(planets)
      .where(eq(planets.id, originPlanetId));
    if (!identity?.playerId || (expectedPlayerId !== undefined && identity.playerId !== expectedPlayerId)) {
      throw new GameError('PLANET_NOT_OWNED', 'Origin changed', 403);
    }
    const capital = await capitalPlanet(tx, identity.playerId);
    await lockWorlds(tx, [capital.id, originPlanetId, targetPlanetId]);
    const origin = await loadLocked(tx, originPlanetId, clock, { expectedPlayerId });
    assertWorldOperational(origin);
    await assertFreeBay(tx, originPlanetId, origin.buildings.CORE);

    const [target] = await tx.select().from(planets).where(eq(planets.id, targetPlanetId));
    if (!target) throw new GameError('PLANET_NOT_FOUND', 'No such world', 404);
    if (target.seasonId !== origin.seasonId) {
      throw new GameError('CROSS_SEASON', 'That world is in another galaxy', 403);
    }
    if (target.controllerPlayerId === origin.playerId) {
      throw new GameError('SELF_ATTACK', 'You cannot target your own world', 403);
    }
    if (target.controllerPlayerId) {
      await lockClanPlayers(tx, [origin.playerId, target.controllerPlayerId]);
      await assertClanHostilityAllowed(
        tx,
        origin.playerId,
        target.controllerPlayerId,
        origin.now,
      );
    }
    if (target.protectedUntil !== null && target.protectedUntil > origin.now) {
      throw new GameError('OCCUPATION_PROTECTED', 'That world is protected', 409, {
        until: target.protectedUntil.toISOString(),
      });
    }

    /**
     * THE FIRST-DAY SHIELD BINDS THE HEAVIEST WEAPON TOO. D183.
     *
     * A strike is the loudest thing one commander can do to another, so a shield
     * that stopped raids and not this would be a shield that stopped nothing worth
     * stopping. The two refusals are ordered exactly as `startAttack` orders them —
     * the target's first, because giving up your own day to hit somebody who cannot
     * be hit spends a position for nothing.
     *
     * A strike also SPENDS the attacker's shield, and for the same reason a raid
     * does: this is reaching out, and the galaxy may reach back.
     */
    await assertNewcomerShields(tx, {
      attackerPlayerId: origin.playerId,
      defenderPlayerId: target.controllerPlayerId,
      now: origin.now,
      acknowledgeShieldLoss: acknowledgeShieldLoss ?? false,
    });

    /**
     * A STRIKE IS NEVER AN ACQUISITION ANY MORE. D167 — owner instruction.
     *
     * D98/D105/D113 made a second impact inside the recovery window transfer the
     * colony to the attacker, which is why launching one used to reserve colony
     * capacity and refuse when the window would close before impact. That whole
     * route is gone: the weapon darkens a world and starts a DEADLINE its commander
     * has to answer, and a colony that goes unanswered is released to NOBODY.
     *
     * So there is no capture intent to declare, no capacity to reserve, and no
     * `RECOVERY_WINDOW_TOO_SHORT` — a second strike is simply another strike, and
     * its only effect on a world already dark is to restart the clock.
     */
    /*
      THE WEAPON, AND ONLY THE WEAPON. T12.

      Untyped, this read fired whatever was READY on the pad — and since T10 that
      can be an interception charge. A defender who had spent 33,000 on a grid
      could have it launched at somebody as a Death Star, and the world it left
      would be undefended against the strike it was bought to stop.
    */
    const [asset] = await tx
      .select()
      .from(strategicAssets)
      .where(and(
        eq(strategicAssets.planetId, originPlanetId),
        eq(strategicAssets.type, 'DEATH_STAR'),
        eq(strategicAssets.status, 'READY'),
      ))
      .for('update');
    if (!asset) throw new GameError('DEATH_STAR_NOT_READY', 'No Death Star is ready', 409);

    const dist = distance(origin, target);
    const oneWay = travelExact(dist, DEATH_STAR.speed);
    const arriveAt = addMinutes(origin.now, oneWay);
    assertSeasonOpenThrough(origin, arriveAt);
    const [mission] = await tx
      .insert(missions)
      .values({
        seasonId: origin.seasonId,
        kind: 'death_star',
        ownerPlayerId: origin.playerId,
        originPlanetId,
        targetPlanetId,
        /*
          NO FLEET, AND SO NO FUEL. T6.

          `missionFuel` charges mass, and a strike carries none — the weapon IS the
          mission. Its deuterium was paid at construction, three thousand of it, and
          charging again for the flight would be billing the same decision twice.
          This is deliberate rather than an oversight in the fuel pass.
        */
        fleet: {},
        cargo: { alloy: 0, crystal: 0, deuterium: 0 },
        distance: dist,
        departAt: origin.now,
        arriveAt,
        // Retired at D167 and kept only so old rows still parse; nothing sets it.
        deathStarCapture: false,
      })
      .returning();
    if (!mission) throw new Error('death star mission insert returned no row');
    const claimed = await tx
      .update(strategicAssets)
      .set({ status: 'LAUNCHED', missionId: mission.id, readyAt: null, remainingSeconds: 0 })
      .where(and(eq(strategicAssets.id, asset.id), eq(strategicAssets.status, 'READY')))
      .returning({ id: strategicAssets.id });
    if (claimed.length === 0) throw new GameError('DEATH_STAR_NOT_READY', 'It already launched', 409);
    await schedule(tx, {
      seasonId: origin.seasonId,
      kind: 'mission_arrival',
      refId: mission.id,
      resolveAt: arriveAt,
    });
    const [radarTargetCore] = await tx
      .select({ level: buildings.level })
      .from(buildings)
      .where(and(eq(buildings.planetId, targetPlanetId), eq(buildings.type, 'CORE')))
      .limit(1);
    const warnAt = addMinutes(arriveAt, -inboundRadarLead(maxRadarRange(), {
      from: origin,
      to: target,
      originCoreLevel: origin.buildings.CORE,
      targetCoreLevel: radarTargetCore?.level ?? 1,
      oneWayMinutes: oneWay,
    }));
    /**
     * ARM AT LAUNCH, THEN LET THE HANDLER PICK THE FIRST REAL CROSSING.
     *
     * A Telescope on another controlled world can cover an early part of this leg
     * before the weapon reaches the target's widest possible Radar circle. Arming
     * only at that Radar boundary would miss the earlier optical acquisition. The
     * immediate event reads the defender's whole sensor network and sleeps until
     * whichever eligible Radar/Telescope crossing comes first.
     */
    await schedule(tx, {
      seasonId: origin.seasonId,
      kind: 'strategic_intercept',
      refId: mission.id,
      resolveAt: origin.now,
    });
    await schedule(tx, {
      seasonId: origin.seasonId,
      kind: 'radar_warning',
      refId: mission.id,
      resolveAt: warnAt > origin.now ? warnAt : origin.now,
    });
    await publishShard(tx, origin.seasonId, 'launch');
    return {
      missionId: mission.id,
      arriveAt,
      pending: await pendingThreads(tx, originPlanetId, origin.now),
      planet: await planetView(tx, originPlanetId, clock),
    };
  });
}

/**
 * EVERY strategic build on the world, not the first row that came back. T12.
 *
 * A bombardment stops strategic construction (D113), and a world may now have two
 * things under construction — the weapon and the charge that shoots one down. The
 * singular read left one of them building straight through the strike, which is
 * both the wrong outcome and an invisible one: nothing on screen distinguishes a
 * build that survived a bombardment from a build that was never hit.
 */
async function pauseBuildingAsset(tx: Tx, planetId: string, now: Date): Promise<void> {
  const assets = await tx
    .select()
    .from(strategicAssets)
    .where(and(eq(strategicAssets.planetId, planetId), eq(strategicAssets.status, 'BUILDING')))
    .for('update');
  for (const asset of assets) {
    if (!asset.readyAt) continue;
    await tx
      .update(strategicAssets)
      .set({
        status: 'PAUSED',
        remainingSeconds: Math.max(0, Math.ceil((asset.readyAt.getTime() - now.getTime()) / 1000)),
        readyAt: null,
      })
      .where(and(eq(strategicAssets.id, asset.id), eq(strategicAssets.status, 'BUILDING')));
  }
}

export async function applyDeathStarStrike(
  tx: Tx,
  mission: typeof missions.$inferSelect,
  now: Date,
): Promise<{
  outcome: 'FIRST_STRIKE' | 'CAPTURED' | 'INEFFECTIVE';
  previousPlayerId: string | null;
  damage: number;
  destroyedFleet: Fleet;
  destroyedResources: Resources;
  levelChanges: StrategicLevelChange[];
  destroyedOrders: StrategicDestroyedOrder[];
  shieldDestroyed: number;
}> {
  const noDamage = (previousPlayerId: string | null) => ({
    outcome: 'INEFFECTIVE' as const,
    previousPlayerId,
    damage: 0,
    destroyedFleet: {},
    destroyedResources: { alloy: 0, crystal: 0, deuterium: 0 },
    levelChanges: [],
    destroyedOrders: [],
    shieldDestroyed: 0,
  });
  const [target] = await tx
    .select()
    .from(planets)
    .where(eq(planets.id, mission.targetPlanetId))
    .for('update');
  if (!target) {
    return noDamage(null);
  }
  if (target.controllerPlayerId === mission.ownerPlayerId) {
    return noDamage(target.controllerPlayerId);
  }
  if (target.protectedUntil !== null && target.protectedUntil > now) {
    return noDamage(target.controllerPlayerId);
  }

  /**
   * PRODUCTION IS LAZY, AND HALVING MAKES THAT LOAD-BEARING. D113.
   *
   * A commander does not have to open a world for its Works to exist, so the
   * stored row is whatever it was at the last tick. Zeroing a stale figure and
   * zeroing a current one give the same answer, which is why this only ever had
   * to advance an OWNED target — to get the damage number right. Halving does
   * not: half of a figure an hour old leaves the defender with less than half of
   * what they actually had, silently. So both kinds of world are brought to
   * `now` first, a neutral through its own advance because nothing else does it.
   */
  const advancedTarget = target.controllerPlayerId && target.kind !== 'NEUTRAL'
    ? await loadLocked(
        tx,
        target.id,
        { now: () => now },
        { expectedPlayerId: target.controllerPlayerId },
      )
    : null;
  const advancedNeutral = target.kind === 'NEUTRAL'
    ? await advanceNeutralEconomy(tx, target.id, now)
    : null;
  const held = {
    alloy: advancedTarget?.alloy ?? advancedNeutral?.alloy ?? target.alloy,
    crystal: advancedTarget?.crystal ?? advancedNeutral?.crystal ?? target.crystal,
    // A neutral never passively produces Deuterium (D97), so its row is current.
    deuterium: advancedTarget?.deuterium ?? target.deuterium,
    bufferAlloy: advancedTarget?.bufferAlloy ?? target.bufferAlloy,
    bufferCrystal: advancedTarget?.bufferCrystal ?? target.bufferCrystal,
    bufferDeuterium: advancedTarget?.bufferDeuterium ?? target.bufferDeuterium,
  };

  const [buildingRows, aegisRows] = await Promise.all([
    tx.select().from(buildings).where(eq(buildings.planetId, target.id)),
    tx.select().from(satellites).where(and(
      eq(satellites.planetId, target.id),
      eq(satellites.type, 'AEGIS'),
    )),
  ]);
  /*
    ALWAYS EMPTY SINCE D179, AND KEPT RATHER THAN DELETED. The impact record, the
    chronicle and the defender's report all carry this field; emptying it at the
    source retires the behaviour in ONE place and leaves every reader working. A
    reader that must not draw an empty list already checks, because a strike on a
    world with no ships on it has always produced exactly this.
  */
  const destroyedFleet: Fleet = {};

  const coreBefore = buildingRows.find((row) => row.type === 'CORE')?.level ?? 0;
  const coreAfter = Math.max(0, coreBefore - 1);
  const levelChanges: StrategicLevelChange[] = [];
  /**
   * The Core, plus whatever the Core's fall pulled down with it. Reported rather
   * than assumed: a Refinery two levels under the ceiling loses nothing, and the
   * `damage` figure has to say so or the impact record overstates what happened.
   */
  const buildingDamage = buildingRows.reduce((sum, row) => {
    if (!isBuildingId(row.type)) return sum;
    const after = row.type === 'CORE' ? coreAfter : Math.min(row.level, coreAfter);
    if (after < row.level) {
      levelChanges.push({ kind: 'BUILDING', id: row.type, before: row.level, after });
    }
    let lost = 0;
    for (let level = after; level < row.level; level++) {
      const cost = buildingCost(row.type, level);
      lost += cost.alloy + cost.crystal + cost.deuterium;
    }
    return sum + lost;
  }, 0);
  const aegisDamage = aegisRows.reduce((sum, row) => {
    const after = Math.max(0, row.level - DEATH_STAR.aegisLevelsLost);
    if (after < row.level) {
      levelChanges.push({ kind: 'INSTRUMENT', id: 'AEGIS', before: row.level, after });
    }
    let lost = 0;
    for (let level = after; level < row.level; level++) {
      const cost = instrumentCost('AEGIS', level);
      lost += cost.alloy + cost.crystal + cost.deuterium;
    }
    return sum + lost;
  }, 0);
  const resourcesDestroyed =
    (held.alloy - survives(held.alloy))
    + (held.crystal - survives(held.crystal))
    + (held.deuterium - survives(held.deuterium))
    + (held.bufferAlloy - survives(held.bufferAlloy))
    + (held.bufferCrystal - survives(held.bufferCrystal))
    + (held.bufferDeuterium - survives(held.bufferDeuterium));
  const destroyedResources: Resources = {
    alloy: (held.alloy - survives(held.alloy))
      + (held.bufferAlloy - survives(held.bufferAlloy)),
    crystal: (held.crystal - survives(held.crystal))
      + (held.bufferCrystal - survives(held.bufferCrystal)),
    deuterium: (held.deuterium - survives(held.deuterium))
      + (held.bufferDeuterium - survives(held.bufferDeuterium)),
  };
  const shieldDestroyed = advancedTarget?.shield ?? target.shield;
  const strippedValue = resourcesDestroyed + buildingDamage + aegisDamage + fleetValue(destroyedFleet);

  await tx
    .update(planets)
    .set({
      alloy: survives(held.alloy),
      crystal: survives(held.crystal),
      deuterium: survives(held.deuterium),
      bufferAlloy: survives(held.bufferAlloy),
      bufferCrystal: survives(held.bufferCrystal),
      bufferDeuterium: survives(held.bufferDeuterium),
      shield: 0,
      disruptedUntil: null,
      lastTickAt: now,
    })
    .where(eq(planets.id, target.id));
  await tx
    .update(buildings)
    .set({ level: coreAfter })
    .where(and(eq(buildings.planetId, target.id), eq(buildings.type, 'CORE')));
  await tx
    .update(buildings)
    .set({ level: sql`LEAST(${buildings.level}, ${coreAfter})` })
    .where(and(
      eq(buildings.planetId, target.id),
      inArray(buildings.type, [...CORE_BOUND_BUILDINGS]),
    ));
  await tx
    .update(satellites)
    .set({ level: sql`GREATEST(0, ${satellites.level} - ${DEATH_STAR.aegisLevelsLost})` })
    .where(and(eq(satellites.planetId, target.id), eq(satellites.type, 'AEGIS')));
  await tx
    .update(neutralPlanetState)
    .set({ claimUntil: null })
    .where(eq(neutralPlanetState.planetId, target.id));
  /**
   * The scaffolding goes with everything else, and nothing comes back. Owner
   * instruction at D113. It is also what stops a building order placed under a
   * high Core from completing after the strike and standing above the low one —
   * `applyOrderEffect` never re-reads the ceiling. See `destroyBuildingOrders`.
   */
  const burned = await destroyBuildingOrders(tx, target.id, now);
  const burnedValue = burned.reduce(
    (sum, order) => sum + order.cost.alloy + order.cost.crystal + order.cost.deuterium,
    0,
  );
  // The impact record counts the scaffolding, because the defender paid for it and
  // it is as gone as the fleet standing beside it.
  const damage = strippedValue + burnedValue;
  await pauseBuildingAsset(tx, target.id, now);
  // This post changed when the mission arrived. A delayed worker must not grant
  // minutes of Telescope discoveries that the struck world never had.
  await refreshSensorEpoch(tx, target.id, mission.arriveAt);

  /**
   * THE STRIKE STARTS AN OUTAGE. IT NEVER TAKES A WORLD AND NEVER LOSES ONE. D179.
   *
   * The route this line has walked is worth keeping: D105/D113 handed a colony to
   * the attacker when a second impact landed inside the window; D167 removed that
   * and made the window a DEADLINE instead, releasing an unanswered colony to
   * nobody; D179 removes the deadline too, on the owner's instruction after
   * sustained player complaint.
   *
   * SO NOTHING HAPPENS AT THE END OF THIS CLOCK EXCEPT THE LIGHTS COMING BACK ON.
   * Every world keeps its controller through a strike and out the other side —
   * capital, colony and neutral alike — and `MULTI_WORLD.recoveryMinutes` is the
   * same two hours for all three, because an outage does not care what kind of
   * world it is darkening.
   *
   * `recoveryReliefAt` IS NO LONGER WRITTEN BY ANYTHING and is cleared here only so
   * a row stamped before this shipped cannot outlive the rule it belonged to.
   */
  const recoveryUntil = addMinutes(now, MULTI_WORLD.recoveryMinutes);
  await tx
    .update(planets)
    .set({ recoveryUntil, protectedUntil: null, recoveryReliefAt: null })
    .where(eq(planets.id, target.id));
  await schedule(tx, {
    seasonId: mission.seasonId,
    kind: 'recovery_end',
    refId: target.id,
    payload: { expectedUntil: recoveryUntil.toISOString() },
    resolveAt: recoveryUntil,
  });
  if (target.controllerPlayerId) await recomputePlayerWealth(tx, target.controllerPlayerId);
  return {
    outcome: 'FIRST_STRIKE',
    previousPlayerId: target.controllerPlayerId,
    damage,
    destroyedFleet,
    destroyedResources,
    levelChanges,
    destroyedOrders: burned,
    shieldDestroyed,
  };
}

async function resumePausedAsset(
  tx: Tx,
  planetId: string,
  seasonId: string,
  now: Date,
): Promise<void> {
  // Both halves of `pauseBuildingAsset`'s pair come back, each with its own clock
  // and its own completion event. One event between two assets would finish one of
  // them and strand the other in BUILDING for the rest of the season.
  const pausedAssets = await tx
    .select()
    .from(strategicAssets)
    .where(and(eq(strategicAssets.planetId, planetId), eq(strategicAssets.status, 'PAUSED')))
    .for('update');
  for (const paused of pausedAssets) {
    const readyAt = new Date(now.getTime() + Math.max(0, paused.remainingSeconds ?? 0) * 1000);
    const resumed = await tx
      .update(strategicAssets)
      .set({ status: 'BUILDING', readyAt })
      .where(and(eq(strategicAssets.id, paused.id), eq(strategicAssets.status, 'PAUSED')))
      .returning({ id: strategicAssets.id });
    if (!resumed[0]) continue;
    await schedule(tx, {
      seasonId,
      kind: 'death_star_ready',
      refId: paused.id,
      payload: { expectedReadyAt: readyAt.toISOString() },
      resolveAt: readyAt,
    });
  }
}

export async function finishDeathStarBuild(tx: Tx, assetId: string, expectedReadyAt: string) {
  return tx
    .update(strategicAssets)
    .set({ status: 'READY', remainingSeconds: 0 })
    .where(and(
      eq(strategicAssets.id, assetId),
      eq(strategicAssets.status, 'BUILDING'),
      eq(strategicAssets.readyAt, new Date(expectedReadyAt)),
    ))
    .returning({ planetId: strategicAssets.planetId, type: strategicAssets.type });
}

/**
 * A permanently failed strategic build is a system fault, so it costs nothing.
 *
 * EITHER KIND, AT ITS OWN PRICE. The weapon and the interception charge share one
 * completion event and so one abandon path, and this refunded the weapon's price
 * for both — a charge that failed for good paid 44,291 and got 73,815 back.
 */
export async function abandonDeathStarBuild(
  db: Db,
  assetId: string,
  clock: Clock,
): Promise<boolean> {
  return db.transaction(async (tx) => {
    const [identity] = await tx
      .select({ planetId: strategicAssets.planetId })
      .from(strategicAssets)
      .where(eq(strategicAssets.id, assetId));
    if (!identity) return false;
    const planet = await loadLocked(tx, identity.planetId, clock, { requireLive: false });
    const [failed] = await tx
      .update(strategicAssets)
      .set({ status: 'CONSUMED', readyAt: null, remainingSeconds: 0 })
      .where(and(
        eq(strategicAssets.id, assetId),
        eq(strategicAssets.status, 'BUILDING'),
      ))
      .returning({ type: strategicAssets.type });
    if (!failed) return false;
    const paid = failed.type === 'INTERCEPTOR' ? ANTI_STRATEGIC.cost : DEATH_STAR.cost;
    planet.alloy += paid.alloy;
    planet.crystal += paid.crystal;
    planet.deuterium += paid.deuterium;
    await saveResources(tx, planet.planetId, {
      alloy: planet.alloy,
      crystal: planet.crystal,
      deuterium: planet.deuterium,
    });
    await recomputePlayerWealth(tx, planet.playerId);
    return true;
  });
}

/**
 * THE END OF THE WINDOW, AND IT IS HOUSEKEEPING AGAIN. D179.
 *
 * D167 made this a VERDICT: a struck colony whose commander had landed no ship
 * inside the window stopped being theirs here, released to nobody. D179 deletes
 * that on the owner's instruction, and what is deleted is the whole branch — the
 * `recoveryReliefAt` read that decided it, the `releasePlanetControl` call that
 * carried it out, and the fall-through that handled losing the race to it.
 *
 * SO NO WORLD EVER CHANGES HANDS HERE. Not a colony, not a capital, not a neutral.
 * The window ends, the flag clears, a paused strategic build picks up where it was
 * stopped, and the world is exactly as its commander left it two hours earlier
 * minus what the impact itself took.
 *
 * THE `recoveryUntil` GUARD STAYS, and it is still doing real work: `recovery_end`
 * can be redelivered, and a second strike inside the window restarts the clock and
 * schedules a second event. Matching on the exact instant is what keeps the FIRST
 * event from ending a window the SECOND one now owns.
 */
export async function endRecovery(
  tx: Tx,
  planetId: string,
  expectedUntil: string,
  now: Date,
): Promise<boolean> {
  const until = new Date(expectedUntil);
  const ended = await tx
    .update(planets)
    .set({ recoveryUntil: null, recoveryReliefAt: null, lastTickAt: now })
    .where(and(eq(planets.id, planetId), eq(planets.recoveryUntil, until)))
    .returning({ id: planets.id, seasonId: planets.seasonId });
  if (!ended[0]) return false;
  await resumePausedAsset(tx, planetId, ended[0].seasonId, now);
  return true;
}

export async function endOccupation(
  tx: Tx,
  planetId: string,
  expectedUntil: string,
): Promise<boolean> {
  const ended = await tx
    .update(planets)
    .set({ protectedUntil: null })
    .where(and(eq(planets.id, planetId), eq(planets.protectedUntil, new Date(expectedUntil))))
    .returning({ id: planets.id });
  return ended.length > 0;
}
