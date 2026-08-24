import { and, eq, gt, sql } from 'drizzle-orm';
import {
  DEUTERIUM,
  RESEARCH_PROJECT_IDS,
  RESEARCH_PROJECTS,
  researchAvailable,
  type ResearchProjectId,
} from '@astera/rules';
import { atMinute } from '../clock.js';
import type { Queryable } from '../db/client.js';
import { battleReports, planetResearch } from '../db/schema.js';
import type { LockedPlanet } from './planet.js';

export async function completedResearch(
  db: Queryable,
  planetId: string,
): Promise<Set<ResearchProjectId>> {
  const rows = await db
    .select({ projectId: planetResearch.projectId })
    .from(planetResearch)
    .where(eq(planetResearch.planetId, planetId));
  return new Set(rows.map((row) => row.projectId));
}

export async function hasResearch(
  db: Queryable,
  planetId: string,
  projectId: ResearchProjectId,
): Promise<boolean> {
  const [row] = await db
    .select({ projectId: planetResearch.projectId })
    .from(planetResearch)
    .where(
      and(
        eq(planetResearch.planetId, planetId),
        eq(planetResearch.projectId, projectId),
      ),
    )
    .limit(1);
  return row !== undefined;
}

/**
 * Everything the owner may know about the three-project frontier. D93–D95.
 *
 * No discovery flag is stored. The isotope project is revealed by the shared
 * season clock; Dense Fuel Cells is revealed by a real cargo-limited raid after
 * its prerequisite is complete. That keeps research attached to PvP instead of
 * becoming a detached checklist.
 */
export async function researchView(
  db: Queryable,
  planet: LockedPlanet,
  projectedCompleted: ReadonlySet<ResearchProjectId> = new Set(),
) {
  const attackerDamage = sql<number>`(
    SELECT COALESCE(SUM((round ->> 'attackerDamage')::double precision), 0)
    FROM jsonb_array_elements(${battleReports.rounds}) AS round
  )`;
  const [rows, cargoInsight, shieldInsight] = await Promise.all([
    db
      .select({
        projectId: planetResearch.projectId,
        completedAt: planetResearch.completedAt,
      })
      .from(planetResearch)
      .where(eq(planetResearch.planetId, planet.planetId)),
    db
      .select({ id: battleReports.id })
      .from(battleReports)
      .where(
        and(
          eq(battleReports.attackerPlayerId, planet.playerId),
          eq(battleReports.cargoLimited, true),
        ),
      )
      .limit(1),
    db
      .select({ id: battleReports.id })
      .from(battleReports)
      .where(
        and(
          eq(battleReports.attackerPlayerId, planet.playerId),
          gt(battleReports.shieldAbsorbed, 0),
          sql`${attackerDamage} > 0`,
          sql`${battleReports.shieldAbsorbed} >= ${attackerDamage}
            * ${DEUTERIUM.graviticDiscoveryShieldShare}`,
        ),
      )
      .limit(1),
  ]);
  const completedAt = new Map(rows.map((row) => [row.projectId, row.completedAt]));
  const queuedWorld = new Set<ResearchProjectId>([
    ...completedAt.keys(),
    ...projectedCompleted,
  ]);
  const graviticInsight = shieldInsight.length > 0;

  const discoveredWith = (
    id: ResearchProjectId,
    completed: ReadonlySet<ResearchProjectId>,
  ): boolean => id === 'ISOTOPE_SPECTROMETRY'
    ? researchAvailable(id, planet.nowMinutes)
    : id === 'DENSE_FUEL_CELLS'
      ? completed.has('ISOTOPE_SPECTROMETRY') && cargoInsight.length > 0
      : id === 'GRAVITIC_CHARGES'
        ? completed.has('ISOTOPE_SPECTROMETRY') && graviticInsight
        : completed.has('GRAVITIC_CHARGES') && researchAvailable(id, planet.nowMinutes);

  const durableWorld = new Set(completedAt.keys());

  return RESEARCH_PROJECT_IDS.map((id) => {
    const project = RESEARCH_PROJECTS[id];
    const completed = completedAt.has(id);
    const discovered = discoveredWith(id, durableWorld);
    const prerequisiteMet = project.prerequisite === null || durableWorld.has(project.prerequisite);
    const queueDiscovered = discoveredWith(id, queuedWorld);
    const queuePrerequisiteMet = project.prerequisite === null
      || queuedWorld.has(project.prerequisite);

    return {
      id,
      cost: project.cost,
      discovered,
      completed,
      completedAt: completedAt.get(id) ?? null,
      available: !completed
        && discovered
        && prerequisiteMet
        && researchAvailable(id, planet.nowMinutes),
      /** Whether this project may be appended after the active Construction tail. */
      queueDiscovered,
      queueAvailable: !queuedWorld.has(id)
        && queueDiscovered
        && queuePrerequisiteMet
        && researchAvailable(id, planet.nowMinutes),
      availableAt: atMinute(planet.seasonStart, project.availableAtMinutes),
      prerequisite: project.prerequisite,
    };
  });
}
