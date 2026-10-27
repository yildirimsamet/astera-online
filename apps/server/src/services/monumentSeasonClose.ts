import { and, asc, eq, inArray, isNotNull } from 'drizzle-orm';
import type { Fleet, MonumentShipLot } from '@astera/rules';
import type { Tx } from '../db/client.js';
import { monuments, monumentShipLots, type monumentWaves, planets, scheduledEvents, seasons, units } from '../db/schema.js';
import { lockMonuments, type LockedMonument } from './monument.js';
import { advanceLockedMonument, monumentEndpoints, monumentHomes } from './monumentArrival.js';
import { saveWave, settleMonumentFlight } from './monumentMovement.js';
import { lockWorlds, safeHomePlanet } from './ownership.js';
import { GameError, loadLocked, recomputePlayerWealth, saveResources } from './planet.js';
import { dockNotice, landHpShips } from './shipDamage.js';
import { publish, publishShard } from '../stream/bus.js';
import { closeMonumentProbes } from './monumentProbe.js';
import { notify } from './notifications.js';
import { completeMonumentJoint } from './monumentJoint.js';
import { finishAdmiralLeg } from './admiral.js';

interface Delivery {
  wave: typeof monumentWaves.$inferSelect;
  ordinal: number;
  lots: MonumentShipLot[];
  homeId: string;
  at: Date;
}

async function deliver(tx: Tx, input: Delivery): Promise<void> {
  const { wave, lots, homeId, at } = input;
  const world = await loadLocked(tx, homeId, { now: () => at }, { expectedPlayerId: wave.playerId, requireLive: false });
  const fleet: Fleet = {};
  for (const lot of lots) fleet[lot.hull] = (fleet[lot.hull] ?? 0) + lot.count;
  const dock = await landHpShips(tx, { planetId: homeId, ownerPlayerId: wave.playerId, fleet, damage: lots, at });
  await tx.delete(units).where(and(eq(units.planetId, wave.originPlanetId), eq(units.location, wave.unitLocation)));
  await tx.delete(monumentShipLots).where(eq(monumentShipLots.waveId, wave.id));
  await saveResources(tx, homeId, { alloy: world.alloy, crystal: world.crystal,
    deuterium: world.deuterium + lots.reduce((sum, lot) => sum + lot.deuterium + (lot.returnFuelReserve ?? 0) + (lot.fuelRefund ?? 0), 0) });
  wave.status = 'HOME';
  wave.resolvedAt = at;
  wave.returnReason = 'FREEZE';
  wave.reservedBulk = 0;
  wave.generation += 1;
  await saveWave(tx, wave);
  // An escort still with this wave lands beside it (Y9).
  await finishAdmiralLeg(tx, at, 'monument', wave.id, lots.reduce((sum, lot) => sum + lot.count, 0));
  await completeMonumentJoint(tx, wave.jointOperationId, at);
  await notify(tx, { playerId: wave.playerId, kind: 'fleet_returned', refId: wave.id, at,
    payload: { trip: 'monument', targetKind: 'MONUMENT', monumentId: wave.monumentId, monumentOrdinal: input.ordinal,
      craft: lots.reduce((sum, lot) => sum + lot.count, 0),
      deuterium: lots.reduce((sum, lot) => sum + lot.deuterium, 0),
      fuelRefund: lots.reduce((sum, lot) => sum + (lot.returnFuelReserve ?? 0) + (lot.fuelRefund ?? 0), 0),
      reason: 'FREEZE', ...dockNotice(dock) } });
  await publish(tx, wave.playerId, 'private:monument');
}

/**
 * Exclusive lifecycle lock, real paths through the cutoff, then direct landing.
 * Called before the freeze snapshot. No return is invented or charged here.
 * Every world and target is locked before any participant ledger, including
 * fragments created while reconciling an older battle's capacity overflow.
 */
export async function closeSeasonMonuments(tx: Tx, input: { seasonId: string; cutoff: Date; adminUsernames: readonly string[] }): Promise<void> {
  const [season] = await tx.select().from(seasons).where(eq(seasons.id, input.seasonId)).for('update');
  if (season?.status !== 'live') return;
  const cutoff = new Date(Math.min(input.cutoff.getTime(), season.endsAt.getTime()));
  if (!Number.isSafeInteger(cutoff.getTime()) || cutoff < season.startsAt) throw new GameError('MONUMENT_TIMELINE_INVALID', 'Invalid season boundary', 409);
  const landed = await landMonumentFleets(tx, { seasonId: season.id, cutoff, observedAt: input.cutoff, adminUsernames: input.adminUsernames, closing: true });
  if (!landed) return;
  await closeMonumentProbes(tx, season.id, cutoff);
  for (const target of landed.locked) await closeTarget(tx, target, cutoff);
  await tx.delete(scheduledEvents).where(and(eq(scheduledEvents.seasonId, season.id),
    inArray(scheduledEvents.kind, ['monument_arrival', 'monument_loss', 'monument_respawn'])));
  for (const playerId of landed.owners) await recomputePlayerWealth(tx, playerId, input.cutoff);
  await publishShard(tx, season.id, 'control');
}

/**
 * Settles every monument of a season to `cutoff`, then lands every fleet still out there at its
 * owner's safe home with its ships, health, cargo and unspent fuel reserve. The caller holds the
 * season row lock and decides what happens to the targets and their lifecycle afterwards.
 */
export async function landMonumentFleets(tx: Tx, input: {
  seasonId: string; cutoff: Date; observedAt: Date; adminUsernames: readonly string[]; closing: boolean;
}): Promise<{ locked: LockedMonument[]; owners: string[] } | null> {
  const { cutoff } = input;
  const targets = await tx.select({ id: monuments.id }).from(monuments).where(eq(monuments.seasonId, input.seasonId)).orderBy(asc(monuments.id));
  if (targets.length === 0) return null;
  const endpoints = await monumentEndpoints(tx, targets.map((row) => row.id));
  const owned = await tx.select({ id: planets.id, playerId: planets.controllerPlayerId }).from(planets)
    .where(and(eq(planets.seasonId, input.seasonId), isNotNull(planets.controllerPlayerId)));
  const worldIds = [...new Set([...endpoints.planetIds, ...owned.map((world) => world.id)])];
  const worlds = worldIds.length === 0 ? new Map<string, typeof planets.$inferSelect>() : await lockWorlds(tx, worldIds);
  const locked = await lockMonuments(tx, targets.map((row) => row.id), { requireLive: false,
    extraPlayerIds: owned.flatMap((world) => world.playerId === null ? [] : [world.playerId]) });
  const deliveries: Delivery[] = [];
  const owners = new Set<string>();
  for (const target of locked) {
    if (target.monument.settledAt > cutoff || target.waves.some((wave) => wave.radiationSettledAt > cutoff)) {
      throw new GameError('MONUMENT_TIMELINE_INVALID', 'The season boundary precedes an already settled fleet', 409);
    }
    const homes = await monumentHomes(tx, target, endpoints.homeIds, worlds);
    await advanceLockedMonument(tx, target, homes, cutoff, input.adminUsernames, input.closing, input.observedAt);
    for (const wave of target.waves) {
      owners.add(wave.playerId);
      if (wave.status === 'HOME' || wave.status === 'LOST') continue;
      const at = wave.status === 'RETURNING' && wave.arriveAt !== null && wave.arriveAt < cutoff ? wave.arriveAt : cutoff;
      if (wave.status === 'OUTBOUND' || wave.status === 'RETURNING') {
        const flight = await settleMonumentFlight(tx, target, wave.id, at, input.observedAt);
        if (flight.wave.status === 'LOST') continue;
      }
      const homeId = await safeHomePlanet(tx, wave.playerId, wave.originPlanetId);
      if (worlds.get(homeId)?.controllerPlayerId !== wave.playerId) throw new GameError('PLACEMENT_CHANGED', 'The closing fleet has no locked safe home', 409);
      deliveries.push({ wave, ordinal: target.monument.ordinal, at, homeId, lots: target.lots.filter((lot) => lot.waveId === wave.id) });
    }
  }
  // A delayed return that reached home before the boundary is delivered first.
  deliveries.sort((a, b) => a.at.getTime() - b.at.getTime() || a.wave.id.localeCompare(b.wave.id));
  for (const delivery of deliveries) await deliver(tx, delivery);
  return { locked, owners: [...owners].sort() };
}

async function closeTarget(tx: Tx, locked: LockedMonument, cutoff: Date): Promise<void> {
  const m = locked.monument;
  await tx.update(monuments).set({ controllerPlayerId: null, controllerClanId: null, generation: m.generation + 1,
    emptySince: m.controllerPlayerId !== null || m.controllerClanId !== null ? cutoff : m.emptySince }).where(eq(monuments.id, m.id));
}
