import { inArray, or } from 'drizzle-orm';
import { applyHpDose, fleetCount, fleetEntries, hpWingLethalAtMs, missionSegments, segmentsExposureHp,
  type Fleet, type HpDamageLots, type Segment, type TechLevels, type Vec3 } from '@astera/rules';
import type { Queryable } from '../db/client.js';
import { clanSupportWaves, clanWarContributions, clanWarMissions, units } from '../db/schema.js';
import type { missions } from '../db/schema.js';
import type { FlightRadiation } from './radiation.js';
import { flightPrefix } from './specialFlightRadiation.js';

export interface FlightCohort {
  fleet: Fleet;
  damage: HpDamageLots | null;
  tech: TechLevels;
  paidAt: Date | null;
}

/** Empty locations stay empty. Launch snapshots never replace physical ships. */
export async function physicalFleets(db: Queryable, locations: readonly string[]): Promise<Map<string, Fleet>> {
  const fleets = new Map<string, Fleet>();
  if (locations.length === 0) return fleets;
  const rows = await db.select({ location: units.location, hull: units.hull, count: units.count }).from(units)
    .where(inArray(units.location, [...new Set(locations)]));
  for (const row of rows) {
    if (row.count <= 0) continue;
    const fleet = fleets.get(row.location) ?? {};
    fleet[row.hull] = (fleet[row.hull] ?? 0) + row.count;
    fleets.set(row.location, fleet);
  }
  return fleets;
}

/** A joint mission carries separate paid health/armor cohorts, even in one public wing. */
export async function missionCohorts(db: Queryable, rows: readonly (typeof missions.$inferSelect)[]): Promise<Map<string, FlightCohort[]>> {
  const ids = rows.map(row => row.id);
  const cohorts = new Map<string, FlightCohort[]>();
  if (ids.length === 0) return cohorts;
  const [support, links] = await Promise.all([
    db.select().from(clanSupportWaves).where(or(inArray(clanSupportWaves.outboundMissionId, ids), inArray(clanSupportWaves.returnMissionId, ids))),
    db.select().from(clanWarMissions).where(inArray(clanWarMissions.missionId, ids)),
  ]);
  const operationIds = [...new Set(links.map(link => link.operationId))];
  const contributions = operationIds.length === 0 ? [] : await db.select().from(clanWarContributions)
    .where(inArray(clanWarContributions.operationId, operationIds));
  const physical = await physicalFleets(db, [...ids, ...support.map(wave => wave.unitLocation), ...contributions.map(wave => wave.unitLocation)]);
  for (const mission of rows) {
    const standing = support.find(wave => wave.outboundMissionId === mission.id || wave.returnMissionId === mission.id);
    const link = links.find(row => row.missionId === mission.id);
    const waves = link ? contributions.filter(wave => link.contributionId !== null ? wave.id === link.contributionId
      : wave.operationId === link.operationId && wave.status === 'IN_BATTLE') : [];
    const own = (location: string, damage: HpDamageLots | null, tech: TechLevels, paidAt: Date | null): FlightCohort =>
      ({ fleet: physical.get(location) ?? {}, damage, tech, paidAt });
    cohorts.set(mission.id, standing ? [own(standing.unitLocation, standing.damage, mission.tech ?? {}, standing.radiationSettledAt)]
      : link ? waves.map(wave => own(wave.unitLocation, wave.damage, wave.tech, wave.radiationSettledAt))
        : [own(mission.id, mission.damage, mission.tech ?? {}, mission.radiationSettledAt)]);
  }
  return cohorts;
}

export const missionFlightPath = (mission: typeof missions.$inferSelect, ends: { origin: Vec3; target: Vec3 }): Segment[] => missionSegments({
  ...ends, departAtMs: mission.departAt.getTime(), arriveAtMs: mission.arriveAt.getTime(),
  recalledAtMs: mission.recalledAt?.getTime() ?? null, recallFrom: mission.recallFrom ?? null,
});

/** Read-only temporal projection. Keep original geometry and pay only after each cohort's cursor. */
export function projectHpFlight(cohorts: readonly FlightCohort[], path: readonly Segment[], at: Date,
  radiation: Extract<FlightRadiation, { model: 'HP' }>): { fleet: Fleet; fadeAt: Date | null } {
  const fleet: Fleet = {};
  let wholeDeath = 0, allDie = cohorts.length > 0;
  for (const cohort of cohorts) {
    if (fleetCount(cohort.fleet) === 0) continue;
    const sources = radiation.sources.flatMap(source => {
      const activeFromMs = Math.max(source.activeFromMs, cohort.paidAt?.getTime() ?? path[0]?.startMs ?? 0);
      return source.activeUntilMs === null || source.activeUntilMs > activeFromMs ? [{ ...source, activeFromMs }] : [];
    });
    const surviving = applyHpDose(cohort.fleet, cohort.damage, segmentsExposureHp(flightPrefix(path, at), sources), cohort.tech).fleet;
    for (const [hull, count] of fleetEntries(surviving)) {
      fleet[hull] = (fleet[hull] ?? 0) + count;
    }
    const death = hpWingLethalAtMs(path, sources, cohort.fleet, cohort.damage, cohort.tech);
    if (death === null) allDie = false;
    else wholeDeath = Math.max(wholeDeath, death);
  }
  return { fleet, fadeAt: allDie && wholeDeath > 0 ? new Date(wholeDeath) : null };
}
