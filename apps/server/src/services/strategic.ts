import { and, eq, inArray, sql } from 'drizzle-orm';
import {
  DEATH_STAR,
  MULTI_WORLD,
  distance,
  fleetValue,
  instrumentCost,
  maxRadarRange,
  radarLead,
  travelExact,
  upgradeCost,
  type Fleet,
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
  units,
} from '../db/schema.js';
import { publishShard } from '../stream/bus.js';
import { schedule } from '../worker/queue.js';
import { destroyBuildingOrders } from './buildQueue.js';
import { assertFreeBay } from './flight.js';
import { advanceNeutralEconomy } from './neutral.js';
import { assertColonyCapacity, capitalPlanet, lockWorlds, transferPlanetControl } from './ownership.js';
import {
  GameError,
  assertSeasonOpenThrough,
  assertWorldOperational,
  loadLocked,
  recomputePlayerWealth,
  saveResources,
} from './planet.js';
import { planetView } from './planetView.js';
import { hasResearch } from './researchState.js';
import { pendingThreads } from './session.js';
import { assertClanHostilityAllowed, lockClanPlayers } from './clanCombat.js';

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
const CORE_BOUND_BUILDINGS = ['REFINERY', 'EXTRACTOR', 'VAULT', 'SHIPYARD'] as const;
const DESTROYED_HOME = [
  'WASP', 'LANCE', 'BULWARK', 'HAULER', 'RUNNER', 'BREACHER', 'PROSPECTOR', 'THORN', 'BASTION',
] as const;

/** Half of a stale figure is not half of what is there — see `stockShareDestroyed`. */
const survives = (amount: number): number =>
  Math.floor(amount * (1 - DEATH_STAR.stockShareDestroyed));

export async function buildDeathStar(db: Db, planetId: string, clock: Clock, expectedPlayerId?: string) {
  return db.transaction(async (tx) => {
    const planet = await loadLocked(tx, planetId, clock, { expectedPlayerId });
    assertWorldOperational(planet);
    if (!(await hasResearch(tx, planetId, DEATH_STAR.requiredResearch))) {
      throw new GameError('DEATH_STAR_LOCKED', 'Research Death Star Protocol first', 403);
    }
    if (
      planet.buildings.CORE < DEATH_STAR.requiredCore
      || planet.buildings.SHIPYARD < DEATH_STAR.requiredShipyard
    ) {
      throw new GameError('DEATH_STAR_LOCKED', 'Raise Core and Shipyard first', 403);
    }
    const [existing] = await tx
      .select({ id: strategicAssets.id })
      .from(strategicAssets)
      .where(and(
        eq(strategicAssets.planetId, planetId),
        inArray(strategicAssets.status, ['BUILDING', 'PAUSED', 'READY']),
      ));
    if (existing) throw new GameError('DEATH_STAR_EXISTS', 'This world already has one', 409);
    if (
      planet.alloy < DEATH_STAR.cost.alloy
      || planet.crystal < DEATH_STAR.cost.crystal
      || planet.deuterium < DEATH_STAR.cost.deuterium
    ) {
      throw new GameError('INSUFFICIENT_RESOURCES', 'Not enough resources');
    }

    const readyAt = addMinutes(planet.now, DEATH_STAR.buildMinutes);
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
        startedAt: planet.now,
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

export async function launchDeathStar(
  db: Db,
  originPlanetId: string,
  targetPlanetId: string,
  clock: Clock,
  expectedPlayerId?: string,
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
    // D98: recovery only implies acquisition for a world whose control may
    // actually change. A capital may be devastated repeatedly, but never reserves
    // colony capacity and never becomes a capture while the rocket is in flight.
    const captureIntent = target.kind !== 'CAPITAL'
      && target.recoveryUntil !== null
      && target.recoveryUntil > origin.now;
    if (captureIntent) await assertColonyCapacity(tx, origin.playerId, origin.seasonId);
    const [asset] = await tx
      .select()
      .from(strategicAssets)
      .where(and(eq(strategicAssets.planetId, originPlanetId), eq(strategicAssets.status, 'READY')))
      .for('update');
    if (!asset) throw new GameError('DEATH_STAR_NOT_READY', 'No Death Star is ready', 409);

    const dist = distance(origin, target);
    const oneWay = travelExact(dist, DEATH_STAR.speed);
    const arriveAt = addMinutes(origin.now, oneWay);
    if (captureIntent && target.recoveryUntil !== null && arriveAt >= target.recoveryUntil) {
      throw new GameError(
        'RECOVERY_WINDOW_TOO_SHORT',
        'The recovery window closes before impact',
        409,
        { recoveryUntil: target.recoveryUntil.toISOString() },
      );
    }
    assertSeasonOpenThrough(origin, arriveAt);
    const [mission] = await tx
      .insert(missions)
      .values({
        seasonId: origin.seasonId,
        kind: 'death_star',
        ownerPlayerId: origin.playerId,
        originPlanetId,
        targetPlanetId,
        fleet: {},
        cargo: { alloy: 0, crystal: 0, deuterium: 0 },
        distance: dist,
        departAt: origin.now,
        arriveAt,
        deathStarCapture: captureIntent,
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
    const warnAt = addMinutes(arriveAt, -radarLead(maxRadarRange(), dist, oneWay));
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

async function pauseBuildingAsset(tx: Tx, planetId: string, now: Date): Promise<void> {
  const [asset] = await tx
    .select()
    .from(strategicAssets)
    .where(and(eq(strategicAssets.planetId, planetId), eq(strategicAssets.status, 'BUILDING')))
    .for('update');
  if (!asset?.readyAt) return;
  await tx
    .update(strategicAssets)
    .set({
      status: 'PAUSED',
      remainingSeconds: Math.max(0, Math.ceil((asset.readyAt.getTime() - now.getTime()) / 1000)),
      readyAt: null,
    })
    .where(and(eq(strategicAssets.id, asset.id), eq(strategicAssets.status, 'BUILDING')));
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
}> {
  const [target] = await tx
    .select()
    .from(planets)
    .where(eq(planets.id, mission.targetPlanetId))
    .for('update');
  if (!target) {
    return { outcome: 'INEFFECTIVE', previousPlayerId: null, damage: 0, destroyedFleet: {} };
  }
  if (target.controllerPlayerId === mission.ownerPlayerId) {
    return {
      outcome: 'INEFFECTIVE',
      previousPlayerId: target.controllerPlayerId,
      damage: 0,
      destroyedFleet: {},
    };
  }
  if (target.protectedUntil !== null && target.protectedUntil > now) {
    return {
      outcome: 'INEFFECTIVE',
      previousPlayerId: target.controllerPlayerId,
      damage: 0,
      destroyedFleet: {},
    };
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

  const [buildingRows, aegisRows, homeRows] = await Promise.all([
    tx.select().from(buildings).where(eq(buildings.planetId, target.id)),
    tx.select().from(satellites).where(and(
      eq(satellites.planetId, target.id),
      eq(satellites.type, 'AEGIS'),
    )),
    tx.select().from(units).where(and(
      eq(units.planetId, target.id),
      eq(units.location, 'home'),
      inArray(units.hull, [...DESTROYED_HOME]),
    )),
  ]);
  const destroyedFleet: Fleet = {};
  for (const row of homeRows) {
    if (row.count > 0) destroyedFleet[row.hull] = row.count;
  }

  const coreBefore = buildingRows.find((row) => row.type === 'CORE')?.level ?? 0;
  const coreAfter = Math.max(0, coreBefore - 1);
  /**
   * The Core, plus whatever the Core's fall pulled down with it. Reported rather
   * than assumed: a Refinery two levels under the ceiling loses nothing, and the
   * `damage` figure has to say so or the impact record overstates what happened.
   */
  const buildingDamage = buildingRows.reduce((sum, row) => {
    const after = row.type === 'CORE' ? coreAfter : Math.min(row.level, coreAfter);
    let lost = 0;
    for (let level = after; level < row.level; level++) {
      const cost = upgradeCost(level);
      lost += cost.alloy + cost.crystal + cost.deuterium;
    }
    return sum + lost;
  }, 0);
  const aegisDamage = aegisRows.reduce((sum, row) => {
    const after = Math.max(0, row.level - DEATH_STAR.aegisLevelsLost);
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
  const strippedValue = resourcesDestroyed + buildingDamage + aegisDamage + fleetValue(destroyedFleet);

  const secondStrike = target.kind !== 'CAPITAL'
    && mission.deathStarCapture
    && target.recoveryUntil !== null
    && target.recoveryUntil > now;
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
    .delete(units)
    .where(and(
      eq(units.planetId, target.id),
      eq(units.location, 'home'),
      inArray(units.hull, [...DESTROYED_HOME]),
    ));
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

  if (secondStrike) {
    const protectedUntil = addMinutes(now, MULTI_WORLD.occupationMinutes);
    await transferPlanetControl(tx, {
      targetPlanetId: target.id,
      newPlayerId: mission.ownerPlayerId,
      expectedControllerPlayerId: target.controllerPlayerId,
      now,
      protectedUntil,
    });
    await schedule(tx, {
      seasonId: mission.seasonId,
      kind: 'occupation_end',
      refId: target.id,
      payload: { expectedUntil: protectedUntil.toISOString() },
      resolveAt: protectedUntil,
    });
    await resumePausedAsset(tx, target.id, mission.seasonId, now);
    if (target.controllerPlayerId) await recomputePlayerWealth(tx, target.controllerPlayerId);
    await recomputePlayerWealth(tx, mission.ownerPlayerId);
    return {
      outcome: 'CAPTURED',
      previousPlayerId: target.controllerPlayerId,
      damage,
      destroyedFleet,
    };
  }

  const recoveryUntil = addMinutes(now, MULTI_WORLD.recoveryMinutes);
  await tx
    .update(planets)
    .set({ recoveryUntil, protectedUntil: null })
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
  };
}

async function resumePausedAsset(
  tx: Tx,
  planetId: string,
  seasonId: string,
  now: Date,
): Promise<void> {
  const [paused] = await tx
    .select()
    .from(strategicAssets)
    .where(and(eq(strategicAssets.planetId, planetId), eq(strategicAssets.status, 'PAUSED')))
    .for('update');
  if (!paused) return;
  const readyAt = new Date(now.getTime() + Math.max(0, paused.remainingSeconds ?? 0) * 1000);
  const resumed = await tx
    .update(strategicAssets)
    .set({ status: 'BUILDING', readyAt })
    .where(and(eq(strategicAssets.id, paused.id), eq(strategicAssets.status, 'PAUSED')))
    .returning({ id: strategicAssets.id });
  if (!resumed[0]) return;
  await schedule(tx, {
    seasonId,
    kind: 'death_star_ready',
    refId: paused.id,
    payload: { expectedReadyAt: readyAt.toISOString() },
    resolveAt: readyAt,
  });
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
    .returning({ planetId: strategicAssets.planetId });
}

/** A permanently failed strategic build is a system fault, so it costs nothing. */
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
    const failed = await tx
      .update(strategicAssets)
      .set({ status: 'CONSUMED', readyAt: null, remainingSeconds: 0 })
      .where(and(
        eq(strategicAssets.id, assetId),
        eq(strategicAssets.status, 'BUILDING'),
      ))
      .returning({ id: strategicAssets.id });
    if (failed.length === 0) return false;
    planet.alloy += DEATH_STAR.cost.alloy;
    planet.crystal += DEATH_STAR.cost.crystal;
    planet.deuterium += DEATH_STAR.cost.deuterium;
    await saveResources(tx, planet.planetId, {
      alloy: planet.alloy,
      crystal: planet.crystal,
      deuterium: planet.deuterium,
    });
    await recomputePlayerWealth(tx, planet.playerId);
    return true;
  });
}

export async function endRecovery(
  tx: Tx,
  planetId: string,
  expectedUntil: string,
  now: Date,
): Promise<boolean> {
  const until = new Date(expectedUntil);
  const ended = await tx
    .update(planets)
    .set({ recoveryUntil: null, lastTickAt: now })
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
