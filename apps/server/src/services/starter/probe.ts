import {
  PROBE, STARTER, bearingBetween, classReading, combatValue, computeLoot, detectChance, distance, fuzzBand, garrisonOf, moduleStage,
  partitionCombatFleet, partsVisible, repairProgress, seededFrom, travelExact, unarmedCount, vaultProtects, vesselEconomyInput,
  vesselProbeAccuracy, STARTER_PVP_BALANCE, fleetCount, type Fleet, type HpDamageLots,
} from '@astera/rules';
import { and, desc, eq, gt, inArray, isNull } from 'drizzle-orm';
import type { Clock } from '../../clock.js';
import type { Db, Queryable, Tx } from '../../db/client.js';
import { starterSites, vesselMissions, vesselNotifications, vesselProbeReports, vesselScanEvents, vesselUnits, vessels } from '../../db/schema.js';
import { publish, publishShard } from '../../stream/bus.js';
import { scheduleStarter } from '../../worker/starterQueue.js';
import { GameError } from '../planet.js';
import { vesselProvenance } from '../commandOrigin.js';
import { markProgress } from './quiet.js';
import { progressOf, withVesselLock, type VesselRow } from './vessel.js';
import { assertFeatureOpen, claimLanding, inShips, missionFrom, placeOf, siteName, type MissionRow } from './world.js';

const COOLDOWN_MS = PROBE.retargetCooldownMinutes * 60_000;

export interface VesselProbeLaunch { missionId: string; arriveAt: Date; flightMinutes: number }

/** What flies to a ship or a shared place here. Nothing over in the main galaxy is found by this. */
async function findTarget(q: Queryable, galaxyId: string, targetId: string) {
  const [ship] = await q.select().from(vessels)
    .where(and(eq(vessels.id, targetId), eq(vessels.starterGalaxyId, galaxyId), eq(vessels.status, 'ACTIVE')));
  if (ship) return { kind: 'ship' as const, ship, at: placeOf(ship) };
  const [site] = await q.select().from(starterSites).where(and(eq(starterSites.id, targetId), eq(starterSites.starterGalaxyId, galaxyId)));
  if (site) return { kind: 'site' as const, site, at: { x: site.x, y: site.y, z: site.z } };
  throw new GameError('PLANET_NOT_FOUND', 'Nothing like that in this galaxy', 404, { context: 'ship' });
}

export const launchVesselProbe = (db: Db, accountId: string, targetId: string, clock: Clock): Promise<VesselProbeLaunch> =>
  withVesselLock(db, accountId, clock, async (tx, vessel) => {
    assertFeatureOpen(vessel.row, 'intel');
    if (vessel.row.id === targetId) throw new GameError('SELF_PROBE', 'You already know what is on your own ship', 400, { context: 'ship' });
    // First, because waking can move the ship: the target and the route are read from where it stands now.
    await markProgress(tx, vessel, clock);
    const target = await findTarget(tx, vessel.row.starterGalaxyId, targetId);
    if (vessel.row.alloy < PROBE.alloy || vessel.row.crystal < PROBE.crystal) {
      throw new GameError('INSUFFICIENT_RESOURCES', 'Not enough resources for a probe', 400, { context: 'probe' });
    }
    const since = new Date(vessel.now.getTime() - COOLDOWN_MS);
    const [recent] = await tx.select({ departAt: vesselMissions.departAt }).from(vesselMissions).where(and(
      eq(vesselMissions.ownerVesselId, vessel.row.id), eq(vesselMissions.kind, 'PROBE'),
      target.kind === 'ship' ? eq(vesselMissions.targetVesselId, targetId) : eq(vesselMissions.targetSiteId, targetId),
      gt(vesselMissions.departAt, since),
    )).orderBy(desc(vesselMissions.departAt)).limit(1);
    if (recent) {
      const readyAt = new Date(recent.departAt.getTime() + COOLDOWN_MS);
      throw new GameError('PROBE_COOLDOWN', 'That was probed too recently', 409, {
        until: readyAt.toISOString(), seconds: Math.max(1, Math.ceil((readyAt.getTime() - vessel.now.getTime()) / 1000)),
      });
    }
    vessel.row = { ...vessel.row, alloy: vessel.row.alloy - PROBE.alloy, crystal: vessel.row.crystal - PROBE.crystal };

    const flightMinutes = travelExact(distance(placeOf(vessel.row), target.at), STARTER.probeSpeed);
    const arriveAt = new Date(vessel.now.getTime() + flightMinutes * 60_000);
    const [mission] = await tx.insert(vesselMissions).values({
      starterGalaxyId: vessel.row.starterGalaxyId,
      ownerVesselId: vessel.row.id,
      kind: 'PROBE',
      ...(target.kind === 'ship' ? { targetVesselId: targetId } : { targetSiteId: targetId }),
      fromX: vessel.row.x, fromY: vessel.row.y, fromZ: vessel.row.z,
      toX: target.at.x, toY: target.at.y, toZ: target.at.z,
      departAt: vessel.now, ...vesselProvenance(vessel.now),
      arriveAt,
    }).returning();
    await scheduleStarter(tx, { starterGalaxyId: vessel.row.starterGalaxyId, kind: 'vessel_mission_arrival', refId: mission!.id, resolveAt: arriveAt });
    await publishShard(tx, vessel.row.starterGalaxyId, 'launch');
    return { missionId: mission!.id, arriveAt, flightMinutes };
  });

/** A ship's standing as a probe reads it: bands, each on its own stream, so none moves another. */
async function readShip(tx: Tx, target: VesselRow, accuracy: number, missionId: string) {
  const unitRows = await tx.select().from(vesselUnits).where(and(eq(vesselUnits.vesselId, target.id), eq(vesselUnits.location, 'HOME')));
  const home: Fleet = {};
  for (const unit of unitRows) home[unit.hull] = unit.count;
  const lots: HpDamageLots = unitRows.flatMap(unit => unit.damage);
  const ready = partitionCombatFleet(home, lots).eligible;
  const line = garrisonOf(ready, {});
  const works = vesselEconomyInput(target.modules);
  const raidable = computeLoot(
    { alloy: target.alloy, crystal: target.crystal, deuterium: target.deuterium },
    { alloy: target.bufferAlloy, crystal: target.bufferCrystal, deuterium: target.bufferDeuterium },
    vaultProtects(works.vaultLevel, works.refineryLevel, works.extractorLevel, works.plantLevel),
    'DECISIVE', Number.MAX_SAFE_INTEGER, STARTER_PVP_BALANCE,
  );
  const stream = (salt: number) => seededFrom(missionId, salt);
  const away = await tx.select({ id: vesselMissions.id }).from(vesselMissions).where(and(
    eq(vesselMissions.ownerVesselId, target.id), inArray(vesselMissions.kind, ['ATTACK', 'RAID_SITE']), inArray(vesselMissions.status, ['OUTBOUND', 'RETURNING']),
  )).limit(1);
  return {
    stock: fuzzBand(raidable.alloy + raidable.crystal + raidable.deuterium, accuracy, stream(1)),
    deuteriumStock: fuzzBand(raidable.deuterium, accuracy, stream(2)),
    defence: fuzzBand(combatValue(ready), accuracy, stream(3)),
    fleetSize: fuzzBand(fleetCount(home), accuracy, stream(4)),
    fleetHome: away.length === 0,
    classReading: classReading(line, accuracy, stream(5)),
    shield: fuzzBand(target.shield, accuracy, stream(6)),
    unarmed: fuzzBand(unarmedCount(line), accuracy, stream(7)),
    // Repair progress is read only here, and only as a band: this is what a probe is for (§3.5).
    repair: fuzzBand(Math.round(repairProgress(progressOf(target)).share * 100), accuracy, stream(8)),
  };
}

/** What a place holds, which is the question before flying a fleet there. */
function readSite(site: typeof starterSites.$inferSelect, accuracy: number, missionId: string, hunting: boolean) {
  const stream = (salt: number) => seededFrom(missionId, salt);
  const guard = site.guard ?? {};
  return {
    stock: fuzzBand(site.alloy + site.crystal + site.deuterium, accuracy, stream(1)),
    deuteriumStock: fuzzBand(site.deuterium, accuracy, stream(2)),
    defence: fuzzBand(combatValue(guard), accuracy, stream(3)),
    fleetSize: fuzzBand(fleetCount(guard), accuracy, stream(4)),
    fleetHome: true,
    classReading: classReading(guard, accuracy, stream(5)),
    ...(hunting ? { hasPart: site.hasPart } : {}),
    // The first hunt's report (plan F4) reads as an outpost's: who holds it and what it pays.
    ...(site.kind === 'OUTPOST' ? { outpost: true } : {}),
  };
}

/**
 * A probe lands and reads its target, then turns for home (owner 2026-11-07: as the main galaxy's does,
 * `worker/handlers.ts`). What it read is kept, unread, until it is back (`landVesselProbe`); the ship it
 * came for feels it now. Nothing is read if that ship has gone. Answers the ship that felt it.
 */
export async function resolveVesselProbe(tx: Tx, mission: MissionRow, clock: Clock): Promise<string | null> {
  if (!mission.ownerVesselId) return null;
  const targetId = mission.targetVesselId;
  // Answered to the caller, which rings the phone once this has committed.
  let felt: string | null = null;
  // Home the way it came, as long again, counted from when it got there: a late worker does not hold it.
  const returnAt = new Date(2 * mission.arriveAt.getTime() - mission.departAt.getTime());
  await inShips(tx, targetId ? [mission.ownerVesselId, targetId] : [mission.ownerVesselId], clock, async (_, ships) => {
    if (!await claimLanding(tx, mission.id, 'RETURNING', returnAt)) return;
    await scheduleStarter(tx, { starterGalaxyId: mission.starterGalaxyId, kind: 'vessel_mission_return', refId: mission.id, resolveAt: returnAt });
    await publishShard(tx, mission.starterGalaxyId, 'launch');
    const observer = ships.get(mission.ownerVesselId!);
    if (!observer) return;
    const accuracy = vesselProbeAccuracy(moduleStage(progressOf(observer.row), 'SURVEY'));
    const now = observer.now;

    if (mission.targetSiteId) {
      const [site] = await tx.select().from(starterSites).where(eq(starterSites.id, mission.targetSiteId));
      if (!site) return;
      await tx.insert(vesselProbeReports).values({
        observerVesselId: observer.row.id, targetSiteId: site.id, missionId: mission.id,
        targetName: siteName(site), at: now, accuracy, snapshot: readSite(site, accuracy, mission.id, partsVisible(progressOf(observer.row))), detected: false,
      });
      return;
    }

    const target = targetId ? ships.get(targetId) : undefined;
    if (target?.row.status !== 'ACTIVE') return;

    // The first look at a ship is always felt: at 15 % most players would never live this moment (§3.5).
    const [seenBefore] = await tx.select({ id: vesselScanEvents.id }).from(vesselScanEvents).where(eq(vesselScanEvents.targetVesselId, target.row.id)).limit(1);
    const radar = moduleStage(progressOf(target.row), 'RADAR');
    const detected = !seenBefore || seededFrom(mission.id, 9)() < detectChance(radar, 0);
    const snapshot = await readShip(tx, target.row, accuracy, mission.id);
    await tx.insert(vesselProbeReports).values({
      observerVesselId: observer.row.id, targetVesselId: target.row.id, missionId: mission.id,
      targetName: target.row.name, at: now, accuracy, snapshot, detected,
    });

    await tx.insert(vesselScanEvents).values({
      targetVesselId: target.row.id, at: now, detected,
      bearing: detected && radar >= 2 ? bearingBetween(placeOf(target.row), missionFrom(mission)) : null,
    });
    if (detected) {
      await tx.insert(vesselNotifications).values({
        vesselId: target.row.id, kind: 'PROBE_DETECTED', refId: mission.id, payload: {}, createdAt: now,
      }).onConflictDoNothing();
      await publish(tx, target.row.id, 'private:vessel-sight');
      felt = target.row.id;
    }
  });
  return felt;
}

/** Home: what it read becomes readable, and its owner is told. A redelivered return finds it landed. */
export async function landVesselProbe(tx: Tx, mission: MissionRow, clock: Clock): Promise<void> {
  const owner = mission.ownerVesselId;
  if (!owner) {
    await tx.update(vesselMissions).set({ status: 'DONE' }).where(and(eq(vesselMissions.id, mission.id), eq(vesselMissions.status, 'RETURNING')));
    return;
  }
  await inShips(tx, [owner], clock, async (_, ships) => {
    const claimed = await tx.update(vesselMissions).set({ status: 'DONE' })
      .where(and(eq(vesselMissions.id, mission.id), eq(vesselMissions.status, 'RETURNING'))).returning({ id: vesselMissions.id });
    if (claimed.length === 0) return;
    const observer = ships.get(owner);
    if (!observer) return;
    // Nothing was read when the ship it came for had gone: it comes home empty.
    const [report] = await tx.update(vesselProbeReports).set({ deliveredAt: observer.now })
      .where(and(eq(vesselProbeReports.missionId, mission.id), isNull(vesselProbeReports.deliveredAt)))
      .returning({ targetName: vesselProbeReports.targetName });
    if (!report) return;
    await deliverReport(tx, observer.row.id, mission.id, report.targetName);
    observer.row = withFirstReport(observer.row);
  });
}

const withFirstReport = (row: VesselRow): VesselRow =>
  row.facts.includes('FIRST_PROBE_REPORT') ? row : { ...row, facts: [...row.facts, 'FIRST_PROBE_REPORT'] };

async function deliverReport(tx: Tx, observerId: string, missionId: string, targetName: string): Promise<void> {
  await tx.insert(vesselNotifications).values({
    vesselId: observerId, kind: 'PROBE_REPORT', refId: missionId, payload: { targetName }, createdAt: new Date(),
  }).onConflictDoNothing();
  await publish(tx, observerId, 'private:vessel-sight');
}
