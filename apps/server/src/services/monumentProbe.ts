import { and, desc, eq, gt, inArray, isNotNull } from 'drizzle-orm';
import { MONUMENT_PROBE_LOSS_CHANCE, PROBE, distance, fleetEntries, hpRadiationApplies, monumentProbeSurvives, seededFrom, travelExact, type Fleet } from '@astera/rules';
import type { Queryable, Tx } from '../db/client.js';
import { addMinutes, type Clock } from '../clock.js';
import { monumentProbes, monuments, planets, scheduledEvents } from '../db/schema.js';
import { advanceMonument, monumentEndpoints } from './monumentArrival.js';
import { type LockedMonument } from './monument.js';
import { GameError, assertSeasonOpenThrough, assertWorldOperational, loadLocked, lockSeason, recomputePlayerWealth, saveResources } from './planet.js';
import { lockWorlds, safeHomePlanet } from './ownership.js';
import { notify } from './notifications.js';
import { schedule } from '../worker/queue.js';
import { publish, publishShard } from '../stream/bus.js';
import { flightSegment } from './specialFlightRadiation.js';

type Probe = typeof monumentProbes.$inferSelect;

export async function launchMonumentProbe(tx: Tx, input: {
  playerId: string; originPlanetId: string; monumentId: string; clock: Clock; adminUsernames?: readonly string[];
}) {
  const [target] = await tx.select().from(monuments).where(eq(monuments.id, input.monumentId));
  if (!target) throw new GameError('MONUMENT_NOT_FOUND', 'No such monument', 404);
  const season = await lockSeason(tx, target.seasonId);
  if (!hpRadiationApplies(season.rulesetVersion)) throw new GameError('MONUMENT_UNAVAILABLE', 'Monuments begin in a new galaxy', 409);
  const endpoints = await monumentEndpoints(tx, [target.id]);
  await lockWorlds(tx, [...endpoints.planetIds, input.originPlanetId]);
  const origin = await loadLocked(tx, input.originPlanetId, input.clock, { expectedPlayerId: input.playerId });
  assertWorldOperational(origin);
  if (origin.seasonId !== target.seasonId) throw new GameError('CROSS_SEASON', 'That monument is in another galaxy', 403);
  const { locked } = await advanceMonument(tx, { monumentId: target.id, at: origin.now, adminUsernames: input.adminUsernames ?? [] });
  const [recent] = await tx.select({ departAt: monumentProbes.departAt }).from(monumentProbes).where(and(
    eq(monumentProbes.playerId, input.playerId), eq(monumentProbes.monumentId, target.id),
    inArray(monumentProbes.status, ['OUTBOUND', 'RETURNING', 'HOME', 'LOST']),
    gt(monumentProbes.departAt, addMinutes(origin.now, -PROBE.retargetCooldownMinutes)),
  )).orderBy(desc(monumentProbes.departAt)).limit(1);
  if (recent) throw new GameError('PROBE_COOLDOWN', 'That monument was probed too recently', 409,
    { until: addMinutes(recent.departAt, PROBE.retargetCooldownMinutes).toISOString() });
  if (origin.alloy < PROBE.alloy || origin.crystal < PROBE.crystal) throw new GameError('INSUFFICIENT_RESOURCES', 'Not enough resources for a probe', 400, { context: 'probe' });
  const flightMinutes = travelExact(distance(origin, locked.monument), PROBE.speed);
  const arriveAt = addMinutes(origin.now, flightMinutes);
  assertSeasonOpenThrough(origin, addMinutes(arriveAt, flightMinutes));
  const [probe] = await tx.insert(monumentProbes).values({ seasonId: season.id, monumentId: target.id, playerId: input.playerId,
    originPlanetId: input.originPlanetId, departAt: origin.now, arriveAt, outboundRoute: [flightSegment(origin, locked.monument, origin.now, arriveAt)] }).returning();
  if (!probe) throw new Error('monument probe insert returned no row');
  await saveResources(tx, origin.planetId, { alloy: origin.alloy - PROBE.alloy, crystal: origin.crystal - PROBE.crystal, deuterium: origin.deuterium });
  await recomputePlayerWealth(tx, input.playerId);
  await schedule(tx, { seasonId: season.id, kind: 'monument_probe', refId: probe.id, payload: { leg: 'OUT' },
    dedupeKey: `monument-probe:out:${probe.id}`, resolveAt: arriveAt });
  await publish(tx, input.playerId, 'private:monument');
  await publishShard(tx, season.id, 'launch');
  return { probeId: probe.id, arriveAt, flightMinutes, lossChance: MONUMENT_PROBE_LOSS_CHANCE, price: { alloy: PROBE.alloy, crystal: PROBE.crystal, deuterium: 0 } };
}

/** Called only by the locked target's chronological arrival timeline. */
export async function observeLockedMonumentProbe(tx: Tx, locked: LockedMonument, probe: Probe): Promise<void> {
  if (probe.status !== 'OUTBOUND') return;
  const at = probe.arriveAt;
  if (!monumentProbeSurvives(seededFrom('monument:probe:v1', locked.season.asteroidKey, probe.id)())) {
    await tx.update(monumentProbes).set({ status: 'LOST' }).where(and(eq(monumentProbes.id, probe.id), eq(monumentProbes.status, 'OUTBOUND')));
    await notify(tx, { playerId: probe.playerId, kind: 'monument_probe_lost', refId: probe.id, at,
      payload: { targetKind: 'MONUMENT', monumentId: probe.monumentId, monumentOrdinal: locked.monument.ordinal, lossChance: MONUMENT_PROBE_LOSS_CHANCE } });
  } else {
    const holdIds = new Set(locked.waves.filter((wave) => wave.status === 'HOLD').map((wave) => wave.id));
    const fleet: Fleet = holdIds.size === 0 ? { ...locked.monument.garrison } : {};
    for (const lot of locked.lots.filter((lot) => holdIds.has(lot.waveId))) fleet[lot.hull] = (fleet[lot.hull] ?? 0) + lot.count;
    const homeId = await safeHomePlanet(tx, probe.playerId, probe.originPlanetId);
    const [home] = await tx.select({ x: planets.x, y: planets.y, z: planets.z }).from(planets).where(eq(planets.id, homeId));
    if (!home) throw new GameError('PLACEMENT_CHANGED', 'The probe needs a safe home', 409);
    const homeAt = addMinutes(at, travelExact(distance(locked.monument, home), PROBE.speed));
    await tx.update(monumentProbes).set({ status: 'RETURNING', snapshotFleet: Object.fromEntries(fleetEntries(fleet)), observedAt: at,
      homeAt, returnRoute: [flightSegment(locked.monument, home, at, homeAt)] }).where(and(eq(monumentProbes.id, probe.id), eq(monumentProbes.status, 'OUTBOUND')));
    await schedule(tx, { seasonId: probe.seasonId, kind: 'monument_probe', refId: probe.id, payload: { leg: 'HOME' },
      dedupeKey: `monument-probe:home:${probe.id}`, resolveAt: homeAt });
  }
  await publish(tx, probe.playerId, 'private:monument');
  await publishShard(tx, probe.seasonId, 'arrival');
}

async function deliverProbe(tx: Tx, probe: Probe, at: Date): Promise<void> {
  const [delivered] = await tx.update(monumentProbes).set({ status: 'HOME', deliveredAt: at }).where(and(
    eq(monumentProbes.id, probe.id), eq(monumentProbes.status, 'RETURNING'),
  )).returning();
  if (!delivered) return;
  const [target] = await tx.select({ ordinal: monuments.ordinal }).from(monuments).where(eq(monuments.id, probe.monumentId));
  await notify(tx, { playerId: probe.playerId, kind: 'probe_report', refId: probe.id, at,
    payload: { targetKind: 'MONUMENT', monumentId: probe.monumentId, monumentOrdinal: target?.ordinal, probeId: probe.id,
      observedAt: probe.observedAt?.toISOString(), deliveredAt: at.toISOString(), accuracy: 1 } });
  await publish(tx, probe.playerId, 'private:monument');
  await publishShard(tx, probe.seasonId, 'arrival');
}

export async function resolveMonumentProbe(tx: Tx, input: { probeId: string; leg: 'OUT' | 'HOME'; at: Date; adminUsernames: readonly string[] }): Promise<void> {
  const [probe] = await tx.select().from(monumentProbes).where(eq(monumentProbes.id, input.probeId));
  if (!probe) return;
  if (input.leg === 'OUT') {
    if (probe.status !== 'OUTBOUND' || input.at < probe.arriveAt) return;
    await lockSeason(tx, probe.seasonId);
    await advanceMonument(tx, { monumentId: probe.monumentId, at: input.at, adminUsernames: input.adminUsernames });
  } else {
    if (probe.status !== 'RETURNING' || probe.homeAt === null || input.at < probe.homeAt) return;
    await lockSeason(tx, probe.seasonId);
    await deliverProbe(tx, probe, probe.homeAt);
  }
}

/** Exact counts are accessible only after a successful return, and only to their observer. */
export async function readMonumentProbeReports(db: Queryable, playerId: string) {
  const rows = await db.select().from(monumentProbes).where(and(eq(monumentProbes.playerId, playerId),
    eq(monumentProbes.status, 'HOME'), isNotNull(monumentProbes.deliveredAt))).orderBy(desc(monumentProbes.observedAt), desc(monumentProbes.id));
  return rows.flatMap((row) => row.snapshotFleet === null || row.observedAt === null || row.deliveredAt === null ? [] : [{
    id: row.id, monumentId: row.monumentId, fleet: row.snapshotFleet, accuracy: 1, observedAt: row.observedAt.toISOString(), deliveredAt: row.deliveredAt.toISOString(),
  }]);
}

/** Closing never waits for ephemeral probes or creates intel from an unreached target. */
export async function closeMonumentProbes(tx: Tx, seasonId: string, cutoff: Date): Promise<void> {
  const rows = await tx.select().from(monumentProbes).where(and(eq(monumentProbes.seasonId, seasonId),
    inArray(monumentProbes.status, ['OUTBOUND', 'RETURNING']))).for('update');
  for (const probe of rows) {
    if (probe.status === 'RETURNING') await deliverProbe(tx, probe, new Date(Math.min(probe.homeAt?.getTime() ?? cutoff.getTime(), cutoff.getTime())));
    else await tx.update(monumentProbes).set({ status: 'CANCELLED' }).where(eq(monumentProbes.id, probe.id));
  }
  await tx.delete(scheduledEvents).where(and(eq(scheduledEvents.seasonId, seasonId), eq(scheduledEvents.kind, 'monument_probe')));
}
