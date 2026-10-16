import { planetRadiationPath } from './planetAegis.js';
import { and, asc, eq, inArray } from 'drizzle-orm';
import { RADIATION_BOMB, RADIATION_BOMB_VISUAL, RADIATION_LEVEL_HP_PER_MINUTE, radiationBombBuildSeconds,
  distance, travelExact, visualLeg, worldRadius, monumentVisualScale, segmentsExposureHp, type FaultKind, type RadiationBombLevel, type Vec3 } from '@astera/rules';
import { addMinutes, type Clock } from '../clock.js';
import type { Db, Tx } from '../db/client.js';
import { buildings, hpRadiationSources, planets, radiationBombFlights, seasons, strategicAssets } from '../db/schema.js';
import { schedule } from '../worker/queue.js';
import { GameError, assertSeasonOpenThrough, assertWorldOperational, loadLocked, lockSeason, saveResources } from './planet.js';
import { buildPlanetResult, loadPlanetViewData } from './planetView.js';
import { assertOutsideSilentSpace, markProgress } from './waitingRoom.js';
import { lockWorlds } from './ownership.js';
import { assertFreeBay } from './flight.js';
import { assertAttackProtections, assertOwnShieldLoss, assertTierBand, protectionsOf } from './attackProtection.js';
import { assertClanHostilityAllowed, lockClanPlayers } from './clanCombat.js';
import { lockMonument, settleLockedMonument } from './monument.js';
import { monumentFlight } from './monumentMotion.js';
import { idempotentMutation } from './idempotency.js';
import { notify } from './notifications.js';
import { publish, publishShard } from '../stream/bus.js';
import { interceptRadiationBomb, scheduleBombInterception } from './radiationBombInterception.js';
import { cancelRepairsForRadiation } from './buildQueue.js';
import { noteRadiationInventoryChange, schedulePlanetRadiation, settlePlanetRadiationAt } from './planetRadiation.js';
import { scheduleBombWarning } from './radiationBombWarning.js';
import { commitStrategicHonor } from './honorStrategic.js';
import { hpSourcesForTarget } from './radiationSources.js';
import { breakFaultsWithEffects } from './faults.js';
import { rescheduleLoyaltyWatch } from './loyalty.js';

/** One independent stock slot per level, including the bomb's entire outward flight. */
export async function buildRadiationBomb(db: Db, planetId: string, level: RadiationBombLevel,
  clock: Clock, expectedPlayerId?: string) {
  return db.transaction(async tx => {
    const planet = await loadLocked(tx, planetId, clock, { expectedPlayerId });
    assertWorldOperational(planet);
    const [season] = await tx.select({ startsAt: seasons.radiationBombStartsAt }).from(seasons)
      .where(eq(seasons.id, planet.seasonId));
    if (!season?.startsAt || season.startsAt > planet.now) {
      throw new GameError('RADIATION_BOMB_UNAVAILABLE', 'Radiation Bombs are not active in this season', 403);
    }
    if (planet.buildings.CORE < RADIATION_BOMB.requiredCore || planet.buildings.SHIPYARD < RADIATION_BOMB.requiredShipyard) {
      throw new GameError('RADIATION_BOMB_LOCKED', 'Raise Core and Shipyard first', 403);
    }
    const product = RADIATION_BOMB.levels[level];
    const occupied = await tx.select({ id: strategicAssets.id }).from(strategicAssets).where(and(
      eq(strategicAssets.planetId, planetId), eq(strategicAssets.type, product.type),
      inArray(strategicAssets.status, ['BUILDING', 'PAUSED', 'READY', 'LAUNCHED']),
    ));
    if (occupied.length >= RADIATION_BOMB.stockPerLevel) {
      throw new GameError('RADIATION_BOMB_EXISTS', 'This level already occupies its stock slot', 409);
    }
    const cost = product.cost;
    if (planet.alloy < cost.alloy || planet.crystal < cost.crystal || planet.deuterium < cost.deuterium) {
      throw new GameError('INSUFFICIENT_RESOURCES', 'Not enough resources');
    }
    const durationSeconds = radiationBombBuildSeconds(level);
    const readyAt = addMinutes(planet.now, durationSeconds / 60);
    if (readyAt >= planet.seasonEndsAt) {
      throw new GameError('SEASON_ENDS_BEFORE_BUILD', 'That order cannot finish before the season ends', 409,
        { endsAt: planet.seasonEndsAt.toISOString() });
    }
    await saveResources(tx, planetId, { alloy: planet.alloy - cost.alloy,
      crystal: planet.crystal - cost.crystal, deuterium: planet.deuterium - cost.deuterium });
    const [asset] = await tx.insert(strategicAssets).values({ planetId, type: product.type,
      status: 'BUILDING', startedAt: planet.now, readyAt, remainingSeconds: durationSeconds }).returning();
    if (!asset) throw new Error('radiation bomb asset insert returned no row');
    await markProgress(tx, planet.playerId, planet.now);
    await schedule(tx, { seasonId: planet.seasonId, kind: 'death_star_ready', refId: asset.id,
      payload: { expectedReadyAt: readyAt.toISOString() }, resolveAt: readyAt });
    return { assetId: asset.id, readyAt, planet: await loadPlanetViewData(tx, planetId, clock) };
  }).then(buildPlanetResult);
}

export interface RadiationBombLaunch {
  playerId: string;
  originPlanetId: string;
  target: { kind: 'PLANET' | 'MONUMENT'; id: string };
  level: RadiationBombLevel;
  key: string;
  acknowledgeShieldLoss?: boolean;
  clock: Clock;
  adminUsernames?: ReadonlySet<string>;
}

/** Retry receipts contain only wire values; a lost response cannot launch a second bomb. */
export async function launchRadiationBomb(db: Db, input: RadiationBombLaunch) {
  return idempotentMutation(db, { playerId: input.playerId, operation: 'RADIATION_BOMB_LAUNCH',
    key: input.key, body: { originPlanetId: input.originPlanetId, target: input.target,
      level: input.level, acknowledgeShieldLoss: input.acknowledgeShieldLoss ?? false }, now: input.clock.now() }, async tx => {
    const own = await tx.select({ id: planets.id }).from(planets).where(eq(planets.controllerPlayerId, input.playerId));
    await lockWorlds(tx, [...own.map(row => row.id), input.originPlanetId,
      ...(input.target.kind === 'PLANET' ? [input.target.id] : [])]);
    const origin = await loadLocked(tx, input.originPlanetId, input.clock, { expectedPlayerId: input.playerId });
    assertWorldOperational(origin);
    assertOutsideSilentSpace(origin);
    const season = await lockSeason(tx, origin.seasonId);
    if (!season.radiationBombStartsAt || season.radiationBombStartsAt > origin.now) {
      throw new GameError('RADIATION_BOMB_UNAVAILABLE', 'Radiation Bombs are not active in this season', 403);
    }
    await assertFreeBay(tx, origin.planetId, origin.buildings.CORE, origin.faults);
    let targetPosition: Vec3;
    let targetRadius: number;
    let arriveAt: Date;
    let honorDefenders: string[] = [];
    if (input.target.kind === 'PLANET') {
      const [target] = await tx.select().from(planets).where(eq(planets.id, input.target.id));
      if (!target) throw new GameError('PLANET_NOT_FOUND', 'No such world', 404);
      if (target.seasonId !== origin.seasonId) throw new GameError('CROSS_SEASON', 'That world is in another galaxy', 403);
      if (target.controllerPlayerId === origin.playerId) throw new GameError('SELF_ATTACK', 'You cannot target your own world', 403);
      if (target.controllerPlayerId) {
        honorDefenders = [target.controllerPlayerId];
        await lockClanPlayers(tx, [origin.playerId, target.controllerPlayerId]);
        await assertClanHostilityAllowed(tx, origin.playerId, target.controllerPlayerId, origin.now);
      }
      if (target.protectedUntil !== null && target.protectedUntil > origin.now) {
        throw new GameError('OCCUPATION_PROTECTED', 'That world is protected', 409,
          { until: target.protectedUntil.toISOString() });
      }
      await assertAttackProtections(tx, { attackerPlayerId: origin.playerId,
        defenderPlayerId: target.controllerPlayerId, now: origin.now,
        acknowledgeShieldLoss: input.acknowledgeShieldLoss ?? false });
      if (target.controllerPlayerId) await assertTierBand(tx, origin.playerId, target.controllerPlayerId);
      targetPosition = { x: target.x, y: target.y, z: target.z };
      const [core] = await tx.select({ level: buildings.level }).from(buildings)
        .where(and(eq(buildings.planetId, target.id), eq(buildings.type, 'CORE')));
      targetRadius = worldRadius(core?.level ?? 1);
      arriveAt = new Date(Math.ceil(origin.now.getTime() + travelExact(distance(origin, target), RADIATION_BOMB.speed) * 60000));
    } else {
      const locked = await lockMonument(tx, input.target.id, true, [origin.playerId]);
      honorDefenders = [...new Set(locked.waves.filter(wave => wave.status === 'HOLD').map(wave => wave.playerId))];
      if (locked.season.id !== origin.seasonId) throw new GameError('CROSS_SEASON', 'That monument is in another galaxy', 403);
      if (locked.monument.controllerPlayerId === origin.playerId
        || (locked.monument.controllerClanId !== null && locked.memberships.get(origin.playerId) === locked.monument.controllerClanId)) {
        throw new GameError('MONUMENT_FRIENDLY_FIRE', 'Your side already controls that monument', 403);
      }
      for (const owner of new Set(locked.waves.filter(wave => wave.status === 'HOLD').map(wave => wave.playerId))) {
        await assertClanHostilityAllowed(tx, origin.playerId, owner, origin.now);
      }
      await assertOwnShieldLoss(tx, { attackerPlayerId: origin.playerId, now: origin.now,
        acknowledgeShieldLoss: input.acknowledgeShieldLoss ?? false });
      const meeting = monumentFlight(origin, locked.monument, locked.season, RADIATION_BOMB.speed, origin.now);
      targetPosition = meeting.at;
      targetRadius = monumentVisualScale(locked.monument.difficulty) / 2;
      arriveAt = meeting.arriveAt;
    }
    assertSeasonOpenThrough(origin, arriveAt);
    if (arriveAt >= season.endsAt) throw new GameError('SEASON_ENDS_BEFORE_RETURN', 'That bomb cannot arrive before the season ends', 409);
    const [asset] = await tx.select().from(strategicAssets).where(and(eq(strategicAssets.planetId, origin.planetId),
      eq(strategicAssets.type, RADIATION_BOMB.levels[input.level].type), eq(strategicAssets.status, 'READY'))).for('update');
    if (!asset) throw new GameError('RADIATION_BOMB_NOT_READY', 'No bomb of that level is ready', 409);
    // Freeze the visible centreline once. The nose touches the surface at arriveAt;
    // owner, observers and interception all consume these same endpoints. Travel time stays unchanged.
    const halfHull = RADIATION_BOMB_VISUAL[input.level].length / 2;
    const trajectory = visualLeg(origin, targetPosition, worldRadius(origin.buildings.CORE) + halfHull,
      targetRadius + halfHull);
    const [flight] = await tx.insert(radiationBombFlights).values({ assetId: asset.id,
      seasonId: origin.seasonId, ownerPlayerId: origin.playerId, originPlanetId: origin.planetId,
      targetKind: input.target.kind, targetPlanetId: input.target.kind === 'PLANET' ? input.target.id : null,
      targetMonumentId: input.target.kind === 'MONUMENT' ? input.target.id : null, level: input.level,
      departAt: origin.now, arriveAt, originPosition: trajectory.from, targetPosition: trajectory.to }).returning();
    if (!flight) throw new Error('radiation bomb flight insert returned no row');
    await commitStrategicHonor(tx, { seasonId: origin.seasonId, id: `bomb:${flight.id}`, owner: origin.playerId,
      defenders: honorDefenders, at: origin.now, adminUsernames: input.adminUsernames });
    await tx.update(strategicAssets).set({ status: 'LAUNCHED', readyAt: null, remainingSeconds: 0 })
      .where(eq(strategicAssets.id, asset.id));
    await markProgress(tx, origin.playerId, origin.now);
    await schedule(tx, { seasonId: origin.seasonId, kind: 'radiation_bomb_arrival', refId: flight.id,
      dedupeKey: `radiation-bomb-arrival:${flight.id}`, resolveAt: arriveAt });
    await scheduleBombInterception(tx, flight, origin.now);
    await scheduleBombWarning(tx, flight);
    await publishShard(tx, origin.seasonId, 'launch');
    return { flightId: flight.id, departAt: origin.now.toISOString(), arriveAt: arriveAt.toISOString() };
  });
}

/** One terminal transition owns the source, stock release and participant notification. */
export async function resolveRadiationBomb(db: Db, flightId: string, clock: Clock): Promise<void> {
  await db.transaction(tx => resolveRadiationBombInTx(tx, flightId, clock));
}

/** The caller holds the season lifecycle lock. Due shots resolve before final fleet accounting. */
export async function closeSeasonRadiationBombs(tx: Tx, seasonId: string, cutoff: Date): Promise<void> {
  const flights = await tx.select().from(radiationBombFlights).where(and(eq(radiationBombFlights.seasonId, seasonId),
    eq(radiationBombFlights.status, 'OUTBOUND'))).orderBy(asc(radiationBombFlights.arriveAt), asc(radiationBombFlights.id));
  for (const flight of flights) {
    if (flight.arriveAt <= cutoff) await resolveRadiationBombInTx(tx, flight.id, { now: () => cutoff });
    else {
      await tx.update(radiationBombFlights).set({ status: 'INEFFECTIVE', resolvedAt: cutoff }).where(eq(radiationBombFlights.id, flight.id));
      await tx.update(strategicAssets).set({ status: 'CONSUMED' }).where(eq(strategicAssets.id, flight.assetId));
      noteRadiationInventoryChange(tx, flight.ownerPlayerId, cutoff);
    }
  }
}

export async function resolveRadiationBombInTx(tx: Tx, flightId: string, clock: Clock): Promise<void> {
  const [identity] = await tx.select().from(radiationBombFlights).where(eq(radiationBombFlights.id, flightId));
  if (identity?.status !== 'OUTBOUND' || identity.arriveAt > clock.now()) return;
  const season = await lockSeason(tx, identity.seasonId, false);
  await lockWorlds(tx, [identity.originPlanetId, ...(identity.targetPlanetId ? [identity.targetPlanetId] : [])], { requireLive: false });
  const [flight] = await tx.select().from(radiationBombFlights).where(eq(radiationBombFlights.id, flightId)).for('update');
  if (flight?.status !== 'OUTBOUND') return;
  if (await interceptRadiationBomb(tx, flight, flight.arriveAt, clock.now())) return;
  const at = flight.arriveAt;
  const planet = flight.targetPlanetId ? (await tx.select().from(planets).where(eq(planets.id, flight.targetPlanetId)))[0] : undefined;
  const monument = flight.targetMonumentId ? await lockMonument(tx, flight.targetMonumentId, false) : undefined;
  const protection = planet?.controllerPlayerId
    ? (await protectionsOf(tx, [planet.controllerPlayerId], at)).get(planet.controllerPlayerId) : null;
  const ineffective = season.status !== 'live' || at >= season.endsAt
    || (planet !== undefined && ((planet.protectedUntil !== null && planet.protectedUntil > at) || protection != null));
  if (monument && !ineffective) await settleLockedMonument(tx, monument, at, clock.now());
  if (planet && !ineffective) {
    await settlePlanetRadiationAt(tx, planet.id, at, clock.now());
  }
  await tx.update(radiationBombFlights).set({ status: ineffective ? 'INEFFECTIVE' : 'HIT', resolvedAt: at })
    .where(eq(radiationBombFlights.id, flight.id));
  await tx.update(strategicAssets).set({ status: 'CONSUMED' }).where(eq(strategicAssets.id, flight.assetId));
  noteRadiationInventoryChange(tx, flight.ownerPlayerId, clock.now());
  if (ineffective) {
    for (const playerId of new Set([flight.ownerPlayerId, ...(planet?.controllerPlayerId ? [planet.controllerPlayerId] : [])])) {
      await notify(tx, { playerId, kind: 'radiation_bomb_result', refId: flight.id, at,
        payload: { outcome: 'INEFFECTIVE', level: flight.level, targetKind: flight.targetKind,
          targetId: flight.targetPlanetId ?? flight.targetMonumentId, targetName: planet?.name,
          defended: playerId === planet?.controllerPlayerId } });
      await publish(tx, playerId, 'fleet');
    }
    await publishShard(tx, flight.seasonId, 'world');
    return;
  }
  const until = new Date(Math.min(at.getTime() + RADIATION_BOMB.durationMinutes * 60000, season.endsAt.getTime()));
  const position = planet ?? monument?.monument;
  if (!position) throw new Error('radiation bomb lost its target');
  await tx.insert(hpRadiationSources).values({ seasonId: flight.seasonId, origin: 'BOMB', bombFlightId: flight.id,
    anchorKind: flight.targetKind, anchorId: flight.targetPlanetId ?? flight.targetMonumentId,
    x: position.x, y: position.y, z: position.z, radius: 1, mode: 'EMIT', radiationLevel: flight.level,
    intensityHpPerMinute: RADIATION_LEVEL_HP_PER_MINUTE[flight.level], activeFrom: at, activeUntil: until,
    label: `Radiation Bomb L${String(flight.level)}` });
  let loyalty: { before: number; after: number } | null = null;
  let faults: FaultKind[] = [];
  let repairs: Awaited<ReturnType<typeof cancelRepairsForRadiation>> | null = null;
  if (planet?.kind === 'COLONY' && planet.controllerPlayerId) {
    // Close the clean economy/loyalty interval before introducing faults. Historical
    // arrivals must not move an already-observed economic clock backwards; health
    // keeps the actual arrival boundary independently through radiationAt.
    const payloadAt = new Date(Math.max(at.getTime(), planet.lastTickAt.getTime()));
    const owned = await loadLocked(tx, planet.id, { now: () => payloadAt }, { requireLive: false, radiationAt: at });
    const product = RADIATION_BOMB.levels[flight.level];
    loyalty = { before: owned.loyalty, after: Math.max(0, owned.loyalty - product.colonyLoyaltyLoss) };
    await tx.update(planets).set({ loyalty: loyalty.after }).where(eq(planets.id, planet.id));
    await rescheduleLoyaltyWatch(tx, { seasonId: flight.seasonId, planetId: planet.id, now: payloadAt });
    if (loyalty.after > 0 && product.colonyFaults > 0) {
      const effects = await breakFaultsWithEffects(tx, { seasonId: flight.seasonId, planetId: planet.id, now: payloadAt,
        count: product.colonyFaults, seed: `radiation-bomb:${flight.id}`, lane: 'STRIKE', announce: false });
      faults = effects.faults;
      repairs = effects.repairs ?? null;
    }
  }
  if (planet) {
    const end = new Date(at.getTime() + 1);
    const sources = await hpSourcesForTarget(tx, season, { kind: 'PLANET', id: planet.id }, at, end);
    if (segmentsExposureHp(await planetRadiationPath(tx, planet, at.getTime(), end.getTime()), sources) > 0) {
      const cancelled = await cancelRepairsForRadiation(tx, planet.id, at);
      if (cancelled.count > 0) repairs = cancelled;
    }
  }
  if (monument) await settleLockedMonument(tx, monument, at, clock.now());
  if (planet) await schedulePlanetRadiation(tx, planet, season, at);
  const recipients = new Set<string>([flight.ownerPlayerId]);
  if (planet?.controllerPlayerId) recipients.add(planet.controllerPlayerId);
  if (monument) for (const wave of monument.waves) if (wave.status === 'HOLD') recipients.add(wave.playerId);
  for (const playerId of recipients) {
    await notify(tx, { playerId, kind: 'radiation_bomb_result', refId: flight.id, at,
      payload: { outcome: 'HIT', targetKind: flight.targetKind, targetId: flight.targetPlanetId ?? flight.targetMonumentId,
        targetName: planet?.name, defended: playerId === planet?.controllerPlayerId,
        ...(monument ? { monumentId: monument.monument.id, monumentOrdinal: monument.monument.ordinal }
          : { targetPlanetId: planet?.id }),
        level: flight.level, activeUntil: until.toISOString(),
        ...(loyalty ? { loyalty } : {}),
        ...(loyalty && playerId === planet?.controllerPlayerId ? { faults } : {}),
        ...(playerId === planet?.controllerPlayerId && repairs && repairs.count > 0
          ? { repairsCancelled: repairs.count, refund: repairs.refund } : {}) } });
    await publish(tx, playerId, 'fleet');
  }
  // A hit is a public moment like a Death Star's: `world` is batched for up to thirty
  // seconds, which let every bystander miss the detonation (owner, 2026-10-16).
  await publishShard(tx, flight.seasonId, 'impact');
  await publishShard(tx, flight.seasonId, 'world');
}
