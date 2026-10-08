import { and, eq, inArray } from 'drizzle-orm';
import {
  ANTI_STRATEGIC,
  DEATH_STAR,
  interceptionRange,
  interceptorCapacity,
  strategicStockpile,
  distance,
  maxRadarRange,
  travelExact,
  type Fleet,
  type Resources,
} from '@astera/rules';
import { addMinutes, type Clock } from '../clock.js';
import type { Db, Tx } from '../db/client.js';
import {
  buildings,
  missions,
  planets,
  strategicAssets,
  type StrategicDestroyedOrder,
  type StrategicLevelChange,
} from '../db/schema.js';
import { publishShard } from '../stream/bus.js';
import { schedule } from '../worker/queue.js';
import { assertFreeBay } from './flight.js';
import { advanceNeutralEconomy } from './neutral.js';
import { capitalPlanet, lockWorlds } from './ownership.js';
import { assertAttackProtections, assertTierBand } from './attackProtection.js';
import {
  GameError,
  assertSeasonOpenThrough,
  assertWorldOperational,
  loadLocked,
  recomputePlayerWealth,
  saveResources,
} from './planet.js';
import { planetView } from './planetView.js';
import { pendingThreads } from './session.js';
import { inboundRadarLead } from './radar.js';
import { assertClanHostilityAllowed, lockClanPlayers } from './clanCombat.js';
import { researchLevels } from './researchState.js';
import { rescheduleLoyaltyWatch } from './loyalty.js';
import { assertOutsideSilentSpace, markProgress } from './waitingRoom.js';

export async function buildDeathStar(db: Db, planetId: string, clock: Clock, expectedPlayerId?: string) {
  return db.transaction(async (tx) => {
    const planet = await loadLocked(tx, planetId, clock, { expectedPlayerId });
    assertWorldOperational(planet);
    if (
      planet.buildings.CORE < DEATH_STAR.requiredCore
      || planet.buildings.SHIPYARD < DEATH_STAR.requiredShipyard
    ) {
      throw new GameError('DEATH_STAR_LOCKED', 'Raise Core and Shipyard first', 403);
    }
    /** Count under the planet row lock so two may exist, but a third cannot race in. */
    const live = await tx
      .select({ id: strategicAssets.id, readyAt: strategicAssets.readyAt })
      .from(strategicAssets)
      .where(and(
        eq(strategicAssets.planetId, planetId),
        eq(strategicAssets.type, 'DEATH_STAR'),
        inArray(strategicAssets.status, ['BUILDING', 'PAUSED', 'READY']),
      ));
    /* One per world, two once the commander holds the Stockpile (owner, 2026-10-01). */
    const allowed = strategicStockpile(
      (await researchLevels(tx, planet.playerId)).get('STRATEGIC_STOCKPILE') ?? 0,
    );
    if (live.length >= allowed) {
      throw new GameError('DEATH_STAR_EXISTS', 'This world has reached its Death Star capacity', 409, {
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

    /** Two weapons are allowed by default, but they are still built serially. */
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
    await markProgress(tx, planet.playerId, planet.now); // D212: a weapon order is production
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
    /* Two per world, four once the commander holds the Grid (owner, 2026-10-01). */
    const max = interceptorCapacity(
      (await researchLevels(tx, planet.playerId)).get('INTERCEPTION_GRID') ?? 0,
    );
    if (live.length >= max) {
      throw new GameError('INTERCEPTOR_LOADED', 'That world has reached its interceptor capacity', 409, {
        max,
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
    await markProgress(tx, planet.playerId, planet.now); // D212: a defence order is production
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
    assertOutsideSilentSpace(origin);
    await assertFreeBay(tx, originPlanetId, origin.buildings.CORE, origin.faults);

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
     * BOTH ATTACK SHIELDS BIND THE HEAVIEST WEAPON TOO. D183 · 2026-09-14.
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
    await assertAttackProtections(tx, {
      attackerPlayerId: origin.playerId,
      defenderPlayerId: target.controllerPlayerId,
      now: origin.now,
      acknowledgeShieldLoss: acknowledgeShieldLoss ?? false,
    });

    /**
     * AND THE SAME DEVELOPMENT BAND AS A RAID. D168 · owner report 2026-10-01.
     *
     * The strike used to sit outside it, and the weapon's gate is Core 12 — the
     * first level of tier 4 — so a tier 4 commander could strike a tier 6 one who
     * was refused a raid back. Ordered exactly as `launchAttack` orders it: after
     * the shields, before the weapon is read, so a refusal spends nothing. A
     * neutral world has no commander to measure.
     */
    if (target.controllerPlayerId) {
      await assertTierBand(tx, origin.playerId, target.controllerPlayerId);
    }

    /** A strike never changes control; hitting an EMP-active world restarts the hour. */
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
        // The weapon is the cost. A strike burns no deuterium.
        fuelPaid: 0,
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
    await markProgress(tx, origin.playerId, origin.now); // D212
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
 * Apply the tactical EMP payload.
 *
 * Impact advances lazy economy first, then drains only the active Aegis charge.
 * Buildings, stores, units, orders, research, ownership, and construction remain
 * untouched. The timestamp is also the fire-control blackout for ground defences.
 */
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
  loyaltyBefore: number | null;
  loyaltyAfter: number | null;
}> {
  const empty = (previousPlayerId: string | null, outcome: 'FIRST_STRIKE' | 'INEFFECTIVE') => ({
    outcome,
    previousPlayerId,
    damage: 0,
    destroyedFleet: {},
    destroyedResources: { alloy: 0, crystal: 0, deuterium: 0 },
    levelChanges: [],
    destroyedOrders: [],
    shieldDestroyed: 0,
    loyaltyBefore: null,
    loyaltyAfter: null,
  });
  const [target] = await tx
    .select()
    .from(planets)
    .where(eq(planets.id, mission.targetPlanetId))
    .for('update');
  if (!target) return empty(null, 'INEFFECTIVE');
  if (target.controllerPlayerId === mission.ownerPlayerId) {
    return empty(target.controllerPlayerId, 'INEFFECTIVE');
  }
  if (target.protectedUntil !== null && target.protectedUntil > now) {
    return empty(target.controllerPlayerId, 'INEFFECTIVE');
  }

  const owned = target.controllerPlayerId && target.kind !== 'NEUTRAL'
    ? await loadLocked(
        tx,
        target.id,
        { now: () => now },
        { expectedPlayerId: target.controllerPlayerId },
      )
    : null;
  const neutral = target.kind === 'NEUTRAL'
    ? await advanceNeutralEconomy(tx, target.id, now)
    : null;
  const shieldDestroyed = owned?.shield ?? neutral?.shield ?? target.shield;
  const empUntil = addMinutes(now, DEATH_STAR.empMinutes);
  /*
    AND A COLONY PAYS IN LOYALTY. Owner, 2026-10-01.

    Off the figure `loadLocked` just brought to this instant — faults drain it and a quiet
    colony climbs back while the weapon flies, so the value last written is not the one
    the hit meets. Every colony, like a battle loss. At zero the re-booked watch fires
    `colony_secession` now, and the world goes NEUTRAL through the one path that already
    knows how: fleet home, guns to the caretaker, nobody credited.
  */
  const loyaltyBefore = owned?.kind === 'COLONY' ? owned.loyalty : null;
  const loyaltyAfter = loyaltyBefore === null
    ? null
    : Math.max(0, loyaltyBefore - DEATH_STAR.colonyLoyaltyLoss);

  await tx
    .update(planets)
    .set({
      shield: 0,
      empUntil,
      lastTickAt: now,
      ...(loyaltyAfter === null ? {} : { loyalty: loyaltyAfter }),
    })
    .where(eq(planets.id, target.id));
  if (loyaltyAfter !== null) {
    await rescheduleLoyaltyWatch(tx, { seasonId: target.seasonId, planetId: target.id, now });
  }

  return {
    ...empty(target.controllerPlayerId, 'FIRST_STRIKE'),
    shieldDestroyed,
    loyaltyBefore,
    loyaltyAfter,
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
 * completion event and so one abandon path, and this once refunded the weapon's
 * price for both — a charge failure could therefore mint resources.
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
