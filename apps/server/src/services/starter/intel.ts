import { PROBE, moduleStage, telescopeCooldownHours, telescopeReading, telescopeSeed, telescopeSlots, sensorZone, vesselSphere, type FleetStatus } from '@astera/rules';
import { and, desc, eq, inArray, isNotNull } from 'drizzle-orm';
import type { Clock } from '../../clock.js';
import type { Db, Queryable } from '../../db/client.js';
import { vesselMissions, vesselProbeReports, vesselScanEvents, vesselWatches, vessels } from '../../db/schema.js';
import { GameError } from '../planet.js';
import { markProgress } from './quiet.js';
import { progressOf, refuseLeft, withVesselLock } from './vessel.js';
import { assertFeatureOpen, placeOf } from './world.js';

const REPORT_LIMIT = 40;
const LOG_LIMIT = 30;

async function shipOf(q: Queryable, accountId: string) {
  const [row] = await q.select().from(vessels).where(eq(vessels.accountId, accountId));
  if (!row) throw new GameError('VESSEL_NOT_FOUND', 'This account has no colony ship', 404);
  refuseLeft(row);
  return row;
}

/** A fleet is away while anything armed of its owner's is flying. A probe or a miner leaves it home. */
const fleetStatusOf = async (q: Queryable, vesselId: string): Promise<{ status: FleetStatus; homeAt: Date | null }> => {
  const flights = await q.select({ returnAt: vesselMissions.returnAt, arriveAt: vesselMissions.arriveAt }).from(vesselMissions).where(and(
    eq(vesselMissions.ownerVesselId, vesselId), inArray(vesselMissions.kind, ['ATTACK', 'RAID_SITE']), inArray(vesselMissions.status, ['OUTBOUND', 'RETURNING']),
  ));
  if (flights.length === 0) return { status: 'HOME', homeAt: null };
  return { status: 'AWAY', homeAt: flights.map(f => f.returnAt ?? f.arriveAt).sort((a, b) => b.getTime() - a.getTime())[0] ?? null };
};

/** The intel page, in the main `/api/intel` shape, so that the page itself needs no second copy. */
export async function starterIntelView(db: Db, accountId: string, clock: Clock) {
  const row = await shipOf(db, accountId);
  const now = clock.now();
  const reports = await db.select().from(vesselProbeReports).where(and(eq(vesselProbeReports.observerVesselId, row.id), isNotNull(vesselProbeReports.deliveredAt)))
    .orderBy(desc(vesselProbeReports.at)).limit(REPORT_LIMIT);
  const log = await db.select().from(vesselScanEvents)
    .where(and(eq(vesselScanEvents.targetVesselId, row.id), eq(vesselScanEvents.detected, true)))
    .orderBy(desc(vesselScanEvents.at)).limit(LOG_LIMIT);
  const watches = await db.select({ watch: vesselWatches, name: vessels.name }).from(vesselWatches)
    .innerJoin(vessels, eq(vessels.id, vesselWatches.targetVesselId))
    .where(eq(vesselWatches.observerVesselId, row.id));
  const stage = moduleStage(progressOf(row), 'TELESCOPE');
  const watching = await Promise.all(watches.map(async ({ watch, name }) => {
    const truth = await fleetStatusOf(db, watch.targetVesselId);
    const eta = truth.homeAt ? Math.max(0, Math.round((truth.homeAt.getTime() - now.getTime()) / 60_000)) : null;
    return {
      slot: watch.slot,
      observerPlanetId: row.id,
      targetPlanetId: watch.targetVesselId,
      targetName: name,
      ownerName: name,
      reading: telescopeReading(stage, 0, truth.status, 0, eta, telescopeSeed(`${row.id}:${String(watch.slot)}`, Math.floor(now.getTime() / 60_000))),
      cooldownUntil: watch.cooldownUntil,
    };
  }));
  const cooldowns = await db.select({ targetVesselId: vesselMissions.targetVesselId, departAt: vesselMissions.departAt }).from(vesselMissions).where(and(
    eq(vesselMissions.ownerVesselId, row.id), eq(vesselMissions.kind, 'PROBE'), isNotNull(vesselMissions.targetVesselId),
  )).orderBy(desc(vesselMissions.departAt)).limit(20);
  const seen = new Set<string>();
  const probeCooldowns = cooldowns.flatMap(({ targetVesselId, departAt }) => {
    const readyAt = new Date(departAt.getTime() + PROBE.retargetCooldownMinutes * 60_000);
    if (!targetVesselId || seen.has(targetVesselId) || readyAt <= now) return [];
    seen.add(targetVesselId);
    return [{ targetPlanetId: targetVesselId, readyAt }];
  });
  return {
    watching,
    radarLog: log.map(event => ({ at: event.at, planetId: row.id, planetName: row.name, bearing: event.bearing, originPlanetName: null, originPlanetId: null })),
    probeReports: reports.map(report => ({
      missionId: report.missionId,
      targetPlanetId: report.targetVesselId ?? report.targetSiteId ?? report.id,
      targetName: report.targetName,
      targetUsername: report.targetName,
      at: report.at,
      accuracy: report.accuracy,
      detected: report.detected,
      ...report.snapshot,
    })),
    probeCooldowns,
    probeCost: { alloy: PROBE.alloy, crystal: PROBE.crystal, deuterium: 0 },
  };
}

export const assignVesselWatch = (db: Db, accountId: string, targetId: string, slot: number, clock: Clock) =>
  withVesselLock(db, accountId, clock, async (tx, vessel) => {
    assertFeatureOpen(vessel.row, 'telescope');
    if (vessel.row.id === targetId) throw new GameError('SELF_WATCH', 'You already know what your own fleet is doing');
    const progress = progressOf(vessel.row);
    const stage = moduleStage(progress, 'TELESCOPE');
    const slots = telescopeSlots(stage);
    if (slot < 0 || slot >= slots) throw new GameError('BAD_SLOT', `This telescope can watch ${String(slots)}`, 400, { context: 'ship', level: stage, slots });
    const [target] = await tx.select().from(vessels).where(and(
      eq(vessels.id, targetId), eq(vessels.starterGalaxyId, vessel.row.starterGalaxyId), eq(vessels.status, 'ACTIVE'),
    ));
    if (!target) throw new GameError('PLANET_NOT_FOUND', 'No such ship in this galaxy', 404, { context: 'ship' });
    const sphere = vesselSphere(placeOf(vessel.row), stage, moduleStage(progress, 'RADAR'));
    if (sensorZone([sphere], placeOf(target)) !== 'IDENTIFIED') throw new GameError('OUT_OF_RANGE', 'That ship is beyond this telescope', 409, { context: 'ship', reach: sphere.identify });
    const [held] = await tx.select().from(vesselWatches).where(and(eq(vesselWatches.observerVesselId, vessel.row.id), eq(vesselWatches.slot, slot)));
    if (held?.targetVesselId === targetId) return { slot, targetPlanetId: targetId, cooldownUntil: held.cooldownUntil };
    if (held?.cooldownUntil && held.cooldownUntil > vessel.now) {
      throw new GameError('WATCH_COOLDOWN', 'This slot cannot be pointed elsewhere yet', 409, { until: held.cooldownUntil.toISOString() });
    }
    const cooldownUntil = new Date(vessel.now.getTime() + telescopeCooldownHours(stage) * 3_600_000);
    await tx.insert(vesselWatches).values({ observerVesselId: vessel.row.id, slot, targetVesselId: targetId, cooldownUntil })
      .onConflictDoUpdate({ target: [vesselWatches.observerVesselId, vesselWatches.slot], set: { targetVesselId: targetId, cooldownUntil } });
    await markProgress(tx, vessel, clock);
    return { slot, targetPlanetId: targetId, cooldownUntil };
  });

