import { isFeatureOpen, moduleStage, outpostName, partsVisible, siteCode, sensorZone, vesselSphere, type StarterFeature, type Vec3 } from '@astera/rules';
import { and, asc, desc, eq, inArray, isNotNull, isNull, sql } from 'drizzle-orm';
import type { Clock } from '../../clock.js';
import type { Db, Queryable, Tx } from '../../db/client.js';
import { starterGalaxies, starterSites, vesselBotState, vesselMissions, vesselProbeReports, vessels } from '../../db/schema.js';
import { GameError } from '../planet.js';
import { progressOf, saveVessel, settleVessel, type LockedVessel, type VesselRow } from './vessel.js';

export type MissionRow = typeof vesselMissions.$inferSelect;

export const placeOf = (row: Pick<VesselRow, 'x' | 'y' | 'z'>): Vec3 => ({ x: row.x, y: row.y, z: row.z });
export const missionFrom = (m: MissionRow): Vec3 => ({ x: m.fromX, y: m.fromY, z: m.fromZ });
export const missionTo = (m: MissionRow): Vec3 => ({ x: m.toX, y: m.toY, z: m.toZ });

/** The menu hides a closed system; this is what actually keeps it closed. Plan §3.7. */
export function assertFeatureOpen(row: VesselRow, feature: StarterFeature): void {
  if (!isFeatureOpen(progressOf(row), feature)) throw new GameError('FEATURE_LOCKED', 'That system is still broken', 403, { feature });
}

/**
 * MORE THAN ONE SHIP, LOCKED IN ONE ORDER AND SETTLED. Two arrivals crossing each other's ships take
 * the same locks in the same sequence, so neither waits on the other. Anything `fn` leaves in a
 * ship's row is saved.
 */
export function withShips<T>(db: Db, ids: readonly string[], clock: Clock, fn: (tx: Tx, ships: Map<string, LockedVessel>) => Promise<T>): Promise<T> {
  return db.transaction(tx => inShips(tx, ids, clock, fn));
}

export async function inShips<T>(tx: Tx, ids: readonly string[], clock: Clock, fn: (tx: Tx, ships: Map<string, LockedVessel>) => Promise<T>): Promise<T> {
  const wanted = [...new Set(ids)];
  const rows = wanted.length === 0 ? [] : await tx.select({ row: vessels, epoch: starterGalaxies.epoch, galaxyOrdinal: starterGalaxies.ordinal }).from(vessels)
    .innerJoin(starterGalaxies, eq(starterGalaxies.id, vessels.starterGalaxyId))
    .where(inArray(vessels.id, wanted)).orderBy(asc(vessels.id)).for('no key update', { of: vessels });
  const ships = new Map<string, LockedVessel>();
  const now = clock.now();
  for (const found of rows) {
    const vessel: LockedVessel = { row: found.row, epoch: found.epoch, galaxyOrdinal: found.galaxyOrdinal, now };
    await settleVessel(tx, vessel);
    ships.set(found.row.id, vessel);
  }
  const answer = await fn(tx, ships);
  for (const vessel of ships.values()) await saveVessel(tx, vessel.row);
  return answer;
}

/** Everything of this ship's still in the air. */
export const flyingFrom = (q: Queryable, vesselId: string): Promise<MissionRow[]> =>
  q.select().from(vesselMissions).where(and(eq(vesselMissions.ownerVesselId, vesselId), inArray(vesselMissions.status, ['OUTBOUND', 'RETURNING'])));

/**
 * A RECALL TAKES THE FLIGHT WITHOUT WAITING. It already holds the ship, and a landing holds the flight
 * and then asks for the ship, so waiting here is a deadlock. A flight someone holds is landing right
 * now, which is the same answer as one that has landed.
 */
export async function takeFlightToRecall(tx: Tx, missionId: string): Promise<boolean> {
  const [held] = await tx.select({ id: vesselMissions.id }).from(vesselMissions).where(eq(vesselMissions.id, missionId)).for('update', { skipLocked: true });
  return held !== undefined;
}

/**
 * THE MISSION'S TURN, once: true for whoever flips it. Delivery is at least once, and everything a
 * landing does sits behind this.
 */
export async function claimLanding(tx: Tx, missionId: string, to: 'RETURNING' | 'DONE' | 'CANCELLED', returnAt?: Date): Promise<boolean> {
  const claimed = await tx.update(vesselMissions).set({ status: to, ...(returnAt ? { returnAt } : {}) })
    .where(and(eq(vesselMissions.id, missionId), eq(vesselMissions.status, 'OUTBOUND'))).returning({ id: vesselMissions.id });
  return claimed.length > 0;
}

/** The name a place goes by on the map and in a report: an outpost's word, a wreck's code. */
export const siteName = (site: { id: string; kind: string }): string =>
  site.kind === 'OUTPOST' ? outpostName(site.id) : siteCode(site);

/**
 * WHO KNOWS WHERE A PART IS. Plan §3.5. Only a ship hunting one, and only for a place it can see or
 * has read with a probe. A part that has since gone takes its mark with it. `hasPart` is absent
 * rather than false for everyone else, so there is nothing to find in the payload.
 */
export async function partSight(q: Queryable, row: VesselRow): Promise<(site: { id: string; x: number; y: number; z: number; hasPart: boolean }) => boolean> {
  const progress = progressOf(row);
  if (!partsVisible(progress)) return () => false;
  const reports = await q.select({ siteId: vesselProbeReports.targetSiteId, snapshot: vesselProbeReports.snapshot }).from(vesselProbeReports)
    .where(and(eq(vesselProbeReports.observerVesselId, row.id), isNotNull(vesselProbeReports.targetSiteId), isNotNull(vesselProbeReports.deliveredAt))).orderBy(desc(vesselProbeReports.at));
  const read = new Map<string, Record<string, unknown>>();
  for (const report of reports) if (report.siteId && !read.has(report.siteId)) read.set(report.siteId, report.snapshot);
  const sphere = vesselSphere(placeOf(row), moduleStage(progress, 'TELESCOPE'), moduleStage(progress, 'RADAR'), row.id);
  return site => site.hasPart && (read.get(site.id)?.hasPart === true || sensorZone([sphere], { x: site.x, y: site.y, z: site.z }) === 'IDENTIFIED');
}

/**
 * A SCARCE PART WAITS FOR A PERSON. Plan §3.12. A ship the server plays may take one only while there
 * are more out there than people hunting them; it goes off and does something else, and that is all
 * anyone sees of the rule.
 */
export async function mayTakePart(q: Queryable, row: VesselRow): Promise<boolean> {
  const [bot] = await q.select({ id: vesselBotState.vesselId }).from(vesselBotState).where(eq(vesselBotState.vesselId, row.id));
  if (!bot) return true;
  const people = await q.select({ modules: vessels.modules, facts: vessels.facts, parts: vessels.parts, fuel: vessels.fuel }).from(vessels)
    .leftJoin(vesselBotState, eq(vesselBotState.vesselId, vessels.id))
    .where(and(eq(vessels.starterGalaxyId, row.starterGalaxyId), eq(vessels.status, 'ACTIVE'), isNull(vesselBotState.vesselId)));
  const hunting = people.filter(person => partsVisible(person)).length;
  if (hunting === 0) return true;
  const [open] = await q.select({ n: sql<number>`count(*)::int` }).from(starterSites)
    .where(and(eq(starterSites.starterGalaxyId, row.starterGalaxyId), eq(starterSites.hasPart, true)));
  return (open?.n ?? 0) > hunting;
}
