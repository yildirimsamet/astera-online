import { and, asc, eq, gte, isNull, or } from 'drizzle-orm';
import { hpRadiationApplies, MONUMENT_BALANCE, TRAVEL, type HpRadiationSource } from '@astera/rules';
import type { Queryable } from '../db/client.js';
import { hpRadiationSources, seasons } from '../db/schema.js';

/** Historical windows remain available to every still-unsettled flight family. */
export async function hpSourcesForSeason(tx: Queryable, seasonId: string): Promise<HpRadiationSource[]> {
  const rows = await tx.select().from(hpRadiationSources).where(eq(hpRadiationSources.seasonId, seasonId))
    .orderBy(asc(hpRadiationSources.activeFrom), asc(hpRadiationSources.id));
  return rows.map((row) => ({
    id: row.id, center: { x: row.x, y: row.y, z: row.z }, radius: row.radius,
    intensityHpPerMinute: row.intensityHpPerMinute, mode: row.mode,
    activeFromMs: row.activeFrom.getTime(), activeUntilMs: row.activeUntil?.getTime() ?? null,
  }));
}

/** Public HP geometry/history, separately named from the legacy percentage model. */
export async function hpRadiationForGalaxy(db: Queryable, seasonId: string, now: Date) {
  const [season] = await db.select({ rulesetVersion: seasons.rulesetVersion }).from(seasons).where(eq(seasons.id, seasonId));
  if (!season || !hpRadiationApplies(season.rulesetVersion)) return [];
  const cutoff = new Date(now.getTime() - 2 * TRAVEL.pacedFlightCapMinutes * 60_000);
  const rows = await db.select().from(hpRadiationSources).where(and(eq(hpRadiationSources.seasonId, seasonId),
    or(isNull(hpRadiationSources.activeUntil), gte(hpRadiationSources.activeUntil, cutoff)))).orderBy(hpRadiationSources.id);
  return rows.map((row) => {
    // Levels describe the approved monument profiles. Operator zones, shelters
    // and historical four-HP monument clouds retain their existing appearance.
    const level = row.anchorKind === 'MONUMENT' && row.mode === 'EMIT'
      ? Object.values(MONUMENT_BALANCE).find(balance => balance.intensityHpPerMinute === row.intensityHpPerMinute)?.radiationLevel
      : undefined;
    return { id: row.id, mode: row.mode, center: { x: row.x, y: row.y, z: row.z }, radius: row.radius,
      intensityHpPerMinute: row.intensityHpPerMinute, activeFrom: row.activeFrom.toISOString(), activeUntil: row.activeUntil?.toISOString() ?? null,
      ...(level === undefined ? {} : { level }) };
  });
}
