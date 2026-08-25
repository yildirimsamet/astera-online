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
import { assertFreeBay } from './flight.js';
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

const DAMAGED_BUILDINGS = ['CORE', 'REFINERY', 'EXTRACTOR', 'SHIPYARD'] as const;
const DESTROYED_HOME = [
  'WASP', 'LANCE', 'BULWARK', 'HAULER', 'RUNNER', 'BREACHER', 'PROSPECTOR', 'THORN', 'BASTION',
] as const;

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

  // Production is lazy. A commander does not have to open the target world for
  // its Works to exist, so advance an owned target under the lock before measuring
  // and clearing it. Otherwise Death Star damage depends on when the defender last
  // made an API request rather than on the shared server clock.
  const advancedTarget = target.controllerPlayerId && target.kind !== 'NEUTRAL'
    ? await loadLocked(
        tx,
        target.id,
        { now: () => now },
        { expectedPlayerId: target.controllerPlayerId },
      )
    : null;

  const [buildingRows, aegisRows, homeRows] = await Promise.all([
    tx.select().from(buildings).where(and(
      eq(buildings.planetId, target.id),
      inArray(buildings.type, [...DAMAGED_BUILDINGS]),
    )),
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
  const resourcesDestroyed = advancedTarget
    ? advancedTarget.alloy + advancedTarget.crystal + advancedTarget.deuterium
      + advancedTarget.bufferAlloy + advancedTarget.bufferCrystal
      + advancedTarget.bufferDeuterium
    : target.alloy + target.crystal + target.deuterium
      + target.bufferAlloy + target.bufferCrystal + target.bufferDeuterium;
  const buildingDamage = buildingRows.reduce((sum, row) => {
    if (row.level <= 0) return sum;
    const cost = upgradeCost(row.level - 1);
    return sum + cost.alloy + cost.crystal + cost.deuterium;
  }, 0);
  const aegisDamage = aegisRows.reduce((sum, row) => {
    if (row.level <= 0) return sum;
    const cost = instrumentCost('AEGIS', row.level - 1);
    return sum + cost.alloy + cost.crystal + cost.deuterium;
  }, 0);
  const damage = resourcesDestroyed + buildingDamage + aegisDamage + fleetValue(destroyedFleet);

  const secondStrike = target.kind !== 'CAPITAL'
    && mission.deathStarCapture
    && target.recoveryUntil !== null
    && target.recoveryUntil > now;
  await tx
    .update(planets)
    .set({
      alloy: 0,
      crystal: 0,
      deuterium: 0,
      bufferAlloy: 0,
      bufferCrystal: 0,
      bufferDeuterium: 0,
      shield: 0,
      disruptedUntil: null,
      lastTickAt: now,
    })
    .where(eq(planets.id, target.id));
  await tx
    .update(buildings)
    .set({ level: sql`GREATEST(0, ${buildings.level} - 1)` })
    .where(and(eq(buildings.planetId, target.id), inArray(buildings.type, [...DAMAGED_BUILDINGS])));
  await tx
    .update(satellites)
    .set({ level: sql`GREATEST(0, ${satellites.level} - 1)` })
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
