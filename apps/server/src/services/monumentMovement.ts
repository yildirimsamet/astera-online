import { randomUUID } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import {
  MOBILE_HULLS,
  applyMonumentHpDose,
  distance,
  fleetSpeedMult,
  fleetTravelExact,
  hangarLoad,
  fleetCount,
  hpLethalAtMs,
  interpolatePosition,
  normalizeMonumentLots,
  recallMonumentShips,
  segmentsExposureHp,
  type Fleet,
  type MonumentShipLot,
  type MonumentRadiationLoss,
  type Vec3,
} from '@astera/rules';
import { addMinutes, type Clock } from '../clock.js';
import type { Tx } from '../db/client.js';
import { monuments, monumentShipLots, monumentWaves, units, type MonumentReturnReason } from '../db/schema.js';
import { completeMonumentJoint } from './monumentJoint.js';
import { notify } from './notifications.js';
import { tellMonumentRadiationLoss } from './monumentRadiationLoss.js';
import { hpSourcesForSeason, lockMonument, settleLockedMonument, type LockedMonument } from './monument.js';
import { lockWorlds, safeHomePlanet } from './ownership.js';
import { GameError, loadLocked, orbitOf, recomputePlayerWealth, saveResources, setUnits } from './planet.js';
import { landHpShips, type HpDockReport } from './shipDamage.js';
import { publish, publishShard } from '../stream/bus.js';
import { schedule } from '../worker/queue.js';
import { monumentRouteSchema, scheduleFlightBoundary } from './monumentBoundaries.js';

type WaveRow = typeof monumentWaves.$inferSelect;
const fleetOf = (lots: readonly MonumentShipLot[]): Fleet => {
  const fleet: Fleet = {};
  for (const lot of lots) fleet[lot.hull] = (fleet[lot.hull] ?? 0) + lot.count;
  return fleet;
};

/** Existing stacks only decrease here; this helper never takes a planet lock or creates units. */
export async function replaceWaveLots(tx: Tx, locked: LockedMonument, wave: WaveRow, next: MonumentShipLot[]): Promise<void> {
  const normalized = normalizeMonumentLots(next);
  const fleet = fleetOf(normalized);
  for (const row of locked.unitRows) {
    if (row.location !== wave.unitLocation) continue;
    const count = fleet[row.hull] ?? 0;
    if (count > row.count) throw new GameError('MONUMENT_MANIFEST_MISMATCH', 'A wave transition cannot create ships', 409);
    if (count !== row.count) {
      const predicate = and(eq(units.planetId, row.planetId), eq(units.location, row.location), eq(units.hull, row.hull));
      if (count === 0) await tx.delete(units).where(predicate);
      else await tx.update(units).set({ count }).where(predicate);
    }
    row.count = count;
  }
  await tx.delete(monumentShipLots).where(eq(monumentShipLots.waveId, wave.id));
  if (normalized.length > 0) await tx.insert(monumentShipLots).values(normalized.map((lot) => ({
    id: lot.id, waveId: wave.id, hull: lot.hull, count: lot.count,
    damageBp: lot.damageBp, remainderBp: lot.remainderBp, deuterium: lot.deuterium,
  })));
  locked.lots = [...locked.lots.filter((lot) => lot.waveId !== wave.id), ...normalized];
}

export async function saveWave(tx: Tx, wave: WaveRow): Promise<void> {
  await tx.update(monumentWaves).set({
    status: wave.status, route: wave.route, arriveAt: wave.arriveAt, heldAt: wave.heldAt,
    returnReason: wave.returnReason, reservedBulk: wave.reservedBulk, radiationSettledAt: wave.radiationSettledAt,
    generation: wave.generation, resolvedAt: wave.resolvedAt,
  }).where(eq(monumentWaves.id, wave.id));
}

/** Dose over the original geometry, with only the source time windows clipped to the unpaid prefix. */
export async function settleMonumentFlight(tx: Tx, locked: LockedMonument, waveId: string, at: Date): Promise<MonumentRadiationLoss & { wave: WaveRow }> {
  const wave = locked.waves.find((row) => row.id === waveId);
  if (!wave || (wave.status !== 'OUTBOUND' && wave.status !== 'RETURNING')) throw new GameError('MONUMENT_NOT_FLYING', 'That wave is not in flight', 409);
  const parsed = monumentRouteSchema.safeParse(wave.route);
  if (!parsed.success) throw new GameError('MONUMENT_ROUTE_INVALID', 'That wave has no valid physical route', 409);
  const fromMs = wave.radiationSettledAt.getTime();
  const hardEnd = Math.min(wave.arriveAt?.getTime() ?? fromMs, locked.season.endsAt.getTime());
  if (!Number.isSafeInteger(at.getTime()) || fromMs > hardEnd) throw new GameError('MONUMENT_TIMELINE_INVALID', 'Invalid flight settlement time', 409);
  const toMs = Math.max(fromMs, Math.min(at.getTime(), hardEnd));
  const historical = await hpSourcesForSeason(tx, wave.seasonId);
  const sources = historical.flatMap((source) => {
    const activeFromMs = Math.max(source.activeFromMs, fromMs);
    const activeUntilMs = Math.min(source.activeUntilMs ?? toMs, toMs);
    return activeFromMs < activeUntilMs ? [{ ...source, activeFromMs, activeUntilMs }] : [];
  });
  const before = locked.lots.filter((lot) => lot.waveId === wave.id);
  const result = applyMonumentHpDose(before, segmentsExposureHp(parsed.data, sources));
  if (toMs > fromMs) {
    await replaceWaveLots(tx, locked, wave, result.lots);
    wave.radiationSettledAt = new Date(toMs);
    if (wave.status === 'OUTBOUND' && wave.purpose === 'REINFORCE') wave.reservedBulk = hangarLoad(fleetOf(result.lots));
    if (result.lots.length === 0) {
      const death = Math.max(...before.map((lot) => hpLethalAtMs(parsed.data, sources, lot) ?? toMs));
      wave.status = 'LOST';
      wave.resolvedAt = new Date(death);
      wave.reservedBulk = 0;
      wave.generation += 1;
    }
    await saveWave(tx, wave);
    if (wave.status === 'LOST') await completeMonumentJoint(tx, wave.jointOperationId, wave.resolvedAt ?? at);
    if (result.destroyed.length > 0) await recomputePlayerWealth(tx, wave.playerId);
    if (result.destroyed.length > 0) {
      const deadIds = new Set(result.destroyed.map(lot => lot.id));
      const death = Math.max(...before.filter(lot => deadIds.has(lot.id)).map(lot => hpLethalAtMs(parsed.data, sources, lot) ?? toMs));
      await tellMonumentRadiationLoss(tx, locked.monument, wave, result.destroyed, result.lots, new Date(death));
    }
  }
  await scheduleFlightBoundary(tx, wave, result.lots, historical, locked.season.endsAt);
  return { ...result, wave };
}

/** Discover endpoints, then lock them before the target. A moved endpoint requests a safe retry. */
async function lockMovement(tx: Tx, waveId: string, playerId?: string) {
  const [identity] = await tx.select().from(monumentWaves).where(eq(monumentWaves.id, waveId));
  if (!identity) throw new GameError('MONUMENT_WAVE_NOT_FOUND', 'No such monument wave', 404);
  if (playerId !== undefined && identity.playerId !== playerId) throw new GameError('MONUMENT_WAVE_NOT_OWNED', 'That wave belongs to another commander', 403);
  const homeId = await safeHomePlanet(tx, identity.playerId, identity.originPlanetId);
  const worlds = await lockWorlds(tx, [identity.originPlanetId, homeId]);
  const locked = await lockMonument(tx, identity.monumentId, true, [identity.playerId]);
  const wave = locked.waves.find((row) => row.id === waveId);
  if (!wave) return null;
  if (!worlds.has(wave.originPlanetId) || await safeHomePlanet(tx, wave.playerId, wave.originPlanetId) !== homeId) {
    throw new GameError('PLACEMENT_CHANGED', 'That wave’s home changed; refresh and try again', 409);
  }
  const home = worlds.get(homeId);
  if (home?.controllerPlayerId !== wave.playerId) throw new GameError('PLANET_NOT_OWNED', 'The return world changed hands', 409);
  return { locked, wave, home };
}

/** Reanchor owned ships before an obsolete origin can be deleted; all endpoints are already locked. */
async function reanchorWave(tx: Tx, locked: LockedMonument, wave: WaveRow, homeId: string): Promise<void> {
  if (wave.originPlanetId === homeId) return;
  await tx.update(units).set({ planetId: homeId }).where(and(eq(units.planetId, wave.originPlanetId), eq(units.location, wave.unitLocation)));
  for (const row of locked.unitRows) if (row.location === wave.unitLocation) row.planetId = homeId;
  wave.originPlanetId = homeId;
  await tx.update(monumentWaves).set({ originPlanetId: homeId }).where(eq(monumentWaves.id, wave.id));
}

export interface MonumentReturn {
  wave: WaveRow;
  lots: MonumentShipLot[];
}

/** Caller holds the wave's origin and destination worlds before its target lock. */
export async function beginMonumentReturn(tx: Tx, locked: LockedMonument, wave: WaveRow, selections: readonly { lotId: string; count: number }[], home: { id: string; x: number; y: number; z: number }, at: Date, reason: MonumentReturnReason): Promise<MonumentReturn> {
  if (!Number.isSafeInteger(at.getTime()) || at < wave.radiationSettledAt || (wave.status === 'HOLD' && at < locked.monument.settledAt)) {
    throw new GameError('MONUMENT_TIMELINE_INVALID', 'The recall precedes the paid flight; refresh and try again', 409);
  }
  const before = locked.lots.filter((lot) => lot.waveId === wave.id);
  let split: ReturnType<typeof recallMonumentShips>;
  try {
    if (selections.length === 0) throw new RangeError('Choose at least one ship');
    split = recallMonumentShips(before, wave.playerId, selections.map((selection) => ({ ...selection, returnLotId: randomUUID() })));
  } catch (error) {
    if (!(error instanceof RangeError)) throw error;
    throw new GameError('BAD_MONUMENT_RECALL', error.message, 400);
  }
  let position: Vec3 = { x: locked.monument.x, y: locked.monument.y, z: locked.monument.z };
  if (wave.status === 'OUTBOUND') {
    const path = monumentRouteSchema.parse(wave.route);
    const segment = path.find((leg) => at.getTime() <= leg.endMs) ?? path[path.length - 1]!;
    position = interpolatePosition(segment.from, segment.to, segment.startMs, segment.endMs, at.getTime());
  }
  await reanchorWave(tx, locked, wave, home.id);
  const fleet = fleetOf(split.recalled);
  const orbit = await orbitOf(tx, home.id);
  const minutes = fleetTravelExact(distance(position, home), fleet, { boost: fleetSpeedMult(orbit), tech: wave.tech });
  if (!Number.isFinite(minutes)) throw new GameError('BAD_MONUMENT_RECALL', 'Those ships cannot return', 400);
  const arriveAt = addMinutes(at, minutes);
  const route = [{ from: position, to: { x: home.x, y: home.y, z: home.z }, startMs: at.getTime(), endMs: arriveAt.getTime() }];
  let returning: WaveRow;
  let recalled: MonumentShipLot[];
  if (split.remaining.length === 0) {
    returning = wave;
    recalled = split.recalled;
    await replaceWaveLots(tx, locked, wave, recalled);
    wave.status = 'RETURNING';
    wave.returnReason = reason;
    wave.route = route;
    wave.arriveAt = arriveAt;
    wave.radiationSettledAt = at;
    wave.reservedBulk = 0;
    wave.generation += 1;
    await saveWave(tx, wave);
  } else {
    const id = randomUUID();
    recalled = split.recalled.map((lot) => ({ ...lot, waveId: id }));
    const [fragment] = await tx.insert(monumentWaves).values({
      id, seasonId: wave.seasonId, monumentId: wave.monumentId, playerId: wave.playerId,
      originPlanetId: wave.originPlanetId, rootWaveId: wave.rootWaveId ?? wave.id,
      jointContributionId: wave.jointContributionId, jointOperationId: wave.jointOperationId,
      unitLocation: `monument:${id}`, purpose: wave.purpose,
      sentFleet: fleet, tech: wave.tech, route, fuelPaid: 0, status: 'RETURNING', returnReason: reason,
      sentAt: wave.sentAt, heldAt: wave.heldAt, arriveAt, radiationSettledAt: at,
    }).returning();
    if (!fragment) throw new Error('monument return fragment insert returned no row');
    returning = fragment;
    await replaceWaveLots(tx, locked, wave, split.remaining);
    await setUnits(tx, wave.originPlanetId, fleet, fragment.unitLocation, wave.playerId);
    await tx.insert(monumentShipLots).values(recalled.map((lot) => ({
      id: lot.id, waveId: id, hull: lot.hull, count: lot.count,
      damageBp: lot.damageBp, remainderBp: lot.remainderBp, deuterium: lot.deuterium,
    })));
    locked.lots.push(...recalled);
    locked.waves.push(fragment);
    locked.unitRows.push(...MOBILE_HULLS.flatMap((hull) => (fleet[hull] ?? 0) > 0 ? [{
      planetId: wave.originPlanetId, ownerPlayerId: wave.playerId, hull, location: fragment.unitLocation, count: fleet[hull]!,
    }] : []));
    if (wave.status === 'OUTBOUND' && wave.purpose === 'REINFORCE') wave.reservedBulk = hangarLoad(fleetOf(split.remaining));
    wave.generation += 1;
    await saveWave(tx, wave);
    // A partial outbound recall invalidates the original ETA event as well.
    if (wave.status === 'OUTBOUND' && wave.arriveAt !== null) await schedule(tx, {
      seasonId: wave.seasonId, kind: 'monument_arrival', refId: wave.id, resolveAt: wave.arriveAt,
      dedupeKey: `monument-arrival:${wave.id}:${wave.generation}`, payload: { generation: wave.generation },
    });
  }
  const remainingHold = new Set(locked.waves.filter((row) => row.status === 'HOLD').map((row) => row.id));
  if (!locked.lots.some((lot) => remainingHold.has(lot.waveId))
    && (locked.monument.controllerPlayerId !== null || locked.monument.controllerClanId !== null)) {
    locked.monument.controllerPlayerId = null;
    locked.monument.controllerClanId = null;
    locked.monument.emptySince = at;
    locked.monument.generation += 1;
    await publishShard(tx, wave.seasonId, 'control');
    await tx.update(monuments).set({ controllerPlayerId: null, controllerClanId: null, emptySince: at, generation: locked.monument.generation })
      .where(eq(monuments.id, locked.monument.id));
    await publishShard(tx, wave.seasonId, 'control');
  }
  await schedule(tx, { seasonId: wave.seasonId, kind: 'monument_arrival', refId: returning.id, resolveAt: arriveAt,
    dedupeKey: `monument-arrival:${returning.id}:${returning.generation}`, payload: { generation: returning.generation } });
  const sources = await hpSourcesForSeason(tx, wave.seasonId);
  await scheduleFlightBoundary(tx, returning, recalled, sources, locked.season.endsAt);
  if (wave.status === 'OUTBOUND') await scheduleFlightBoundary(tx, wave, split.remaining, sources, locked.season.endsAt);
  await completeMonumentJoint(tx, wave.jointOperationId, at);
  await settleLockedMonument(tx, locked, at);
  if (reason !== 'RECALLED') await notify(tx, { playerId: wave.playerId, kind: 'monument_returning', refId: returning.id, at,
    payload: { targetKind: 'MONUMENT', monumentId: locked.monument.id, monumentOrdinal: locked.monument.ordinal,
      reason, craft: fleetCount(fleet), arriveAt: arriveAt.toISOString() } });
  await publish(tx, wave.playerId, 'private:monument');
  return { wave: returning, lots: recalled };
}

const recallIdentity = z.object({ playerId: z.string().uuid(), waveId: z.string().uuid() });
const recallSchema = z.union([
  recallIdentity.extend({ selections: z.array(z.object({ lotId: z.string().uuid(), count: z.number().int().positive().max(2_147_483_647) })).nonempty().max(10_000), all: z.never().optional() }),
  recallIdentity.extend({ all: z.literal(true), selections: z.never().optional() }),
]);
type RecallCommand = { selections: readonly { lotId: string; count: number }[]; all?: never }
  | { all: true; selections?: never };

export async function resolveMonumentFlightLoss(tx: Tx, input: { waveId: string; generation: number; at: Date }): Promise<void> {
  const [identity] = await tx.select().from(monumentWaves).where(eq(monumentWaves.id, input.waveId));
  if (identity?.generation !== input.generation || (identity.status !== 'OUTBOUND' && identity.status !== 'RETURNING')
    || identity.arriveAt === null || input.at >= identity.arriveAt) return;
  const movement = await lockMovement(tx, input.waveId);
  if (movement?.wave.generation !== input.generation || (movement.wave.status !== 'OUTBOUND' && movement.wave.status !== 'RETURNING')) return;
  const loss = await settleMonumentFlight(tx, movement.locked, movement.wave.id, input.at);
  if (loss.destroyed.length > 0) {
    await publish(tx, movement.wave.playerId, 'private:monument');
    await publishShard(tx, movement.wave.seasonId, 'arrival');
  }
}

export async function recallMonument(tx: Tx, input: { playerId: string; waveId: string; clock: Clock } & RecallCommand): Promise<MonumentReturn> {
  const parsed = recallSchema.safeParse(input);
  if (!parsed.success) throw new GameError('BAD_MONUMENT_RECALL', 'Choose valid owned ships to recall', 400);
  const movement = await lockMovement(tx, input.waveId, input.playerId);
  if (!movement) throw new GameError('MONUMENT_NOT_RECALLABLE', 'That wave is already home or lost', 409);
  const { locked, wave, home } = movement;
  const at = input.clock.now();
  if (at >= locked.season.endsAt) throw new GameError('SEASON_FROZEN', 'That season is over', 409);
  if (wave.status !== 'OUTBOUND' && wave.status !== 'HOLD') throw new GameError('MONUMENT_NOT_RECALLABLE', 'That wave is already returning', 409);
  if (wave.status === 'OUTBOUND' && wave.arriveAt !== null && wave.arriveAt <= at) throw new GameError('MONUMENT_ARRIVAL_PENDING', 'That wave is arriving; refresh its state', 409);
  const settlement = await settleLockedMonument(tx, locked, at);
  const current = settlement.waves.find((row) => row.id === wave.id);
  if (!current || current.status === 'LOST') throw new GameError('BAD_MONUMENT_RECALL', 'Those ships were lost', 409);
  if (current.status === 'OUTBOUND') {
    const flight = await settleMonumentFlight(tx, locked, current.id, at);
    if (flight.wave.status === 'LOST') throw new GameError('BAD_MONUMENT_RECALL', 'Those ships were lost', 409);
  }
  // A whole-flight intent selects survivors only after settlement, under the same locks.
  const selections = parsed.data.all === true
    ? locked.lots.filter(lot => lot.waveId === current.id).map(lot => ({ lotId: lot.id, count: lot.count }))
    : parsed.data.selections;
  return beginMonumentReturn(tx, locked, current, selections, home, at, 'RECALLED');
}

/** Generation/ETA/status claim and physical landing are one commit; replay is a no-op. */
export async function resolveMonumentReturn(tx: Tx, input: { waveId: string; generation: number; at: Date }): Promise<{ wave: WaveRow; deliveredDeuterium: number; dock: HpDockReport } | null> {
  const [identity] = await tx.select().from(monumentWaves).where(eq(monumentWaves.id, input.waveId));
  if (identity?.status !== 'RETURNING' || identity.generation !== input.generation) return null;
  const movement = await lockMovement(tx, input.waveId);
  if (!movement) return null;
  const { locked, wave, home } = movement;
  if (wave.status !== 'RETURNING' || wave.generation !== input.generation || wave.arriveAt === null
    || input.at < wave.arriveAt || wave.arriveAt > locked.season.endsAt) return null;
  const at = wave.arriveAt;
  const loss = await settleMonumentFlight(tx, locked, wave.id, at);
  if (loss.wave.status === 'LOST') return { wave, deliveredDeuterium: 0, dock: { autoRepaired: [], docked: [] } };
  const destination = await loadLocked(tx, home.id, { now: () => at }, { expectedPlayerId: wave.playerId });
  const deliveredDeuterium = loss.lots.reduce((sum, lot) => sum + lot.deuterium, 0);
  const dock = await landHpShips(tx, { planetId: home.id, ownerPlayerId: wave.playerId,
    fleet: fleetOf(loss.lots), damage: loss.lots, at });
  await tx.delete(units).where(and(eq(units.planetId, wave.originPlanetId), eq(units.location, wave.unitLocation)));
  await tx.delete(monumentShipLots).where(eq(monumentShipLots.waveId, wave.id));
  await saveResources(tx, home.id, { alloy: destination.alloy, crystal: destination.crystal, deuterium: destination.deuterium + deliveredDeuterium });
  wave.status = 'HOME';
  wave.resolvedAt = at;
  wave.reservedBulk = 0;
  wave.generation += 1;
  await saveWave(tx, wave);
  await recomputePlayerWealth(tx, wave.playerId);
  await notify(tx, { playerId: wave.playerId, kind: 'fleet_returned', refId: wave.id, at,
    payload: { trip: 'monument', targetKind: 'MONUMENT', monumentId: locked.monument.id, monumentOrdinal: locked.monument.ordinal,
      craft: loss.lots.reduce((sum, lot) => sum + lot.count, 0), deuterium: deliveredDeuterium, reason: wave.returnReason, dock } });
  await publish(tx, wave.playerId, 'private:monument');
  await publishShard(tx, wave.seasonId, 'arrival');
  return { wave, deliveredDeuterium, dock };
}
