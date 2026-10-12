import { and, asc, eq, gte, isNull, or } from 'drizzle-orm';
import { hpRadiationApplies, MONUMENT_BALANCE, TRAVEL, type HpRadiationSource } from '@astera/rules';
import type { Queryable } from '../db/client.js';
import { hpRadiationSources, monuments, seasons } from '../db/schema.js';
import { monumentMotionStart, motionOfMonument } from './monumentMotion.js';

/** A cutover clips old spatial history; it never rewrites already-travelled time. */
function sourceWindows(row: typeof hpRadiationSources.$inferSelect, cutover?: Date): HpRadiationSource[] {
  const source: HpRadiationSource = { id: row.id, center: { x: row.x, y: row.y, z: row.z }, radius: row.radius,
    intensityHpPerMinute: row.intensityHpPerMinute, mode: row.mode,
    activeFromMs: row.activeFrom.getTime(), activeUntilMs: row.activeUntil?.getTime() ?? null };
  if (!cutover) return [source];
  const at = cutover.getTime();
  const windows: HpRadiationSource[] = [];
  const oldEnd = Math.min(source.activeUntilMs ?? Infinity, at);
  if (source.activeFromMs < oldEnd) windows.push({ ...source, id: `${source.id}:history`, activeUntilMs: oldEnd });
  const start = Math.max(source.activeFromMs, at);
  if (row.anchorKind !== 'ZONE' && row.anchorId && (source.activeUntilMs === null || source.activeUntilMs > start)) {
    windows.push({ ...source, target: { kind: row.anchorKind, id: row.anchorId }, activeFromMs: start });
  }
  return windows;
}

export async function hpSourcesForSeason(tx: Queryable, seasonId: string): Promise<HpRadiationSource[]> {
  const [season] = await tx.select().from(seasons).where(eq(seasons.id, seasonId));
  if (!season) return [];
  const rows = await tx.select().from(hpRadiationSources).where(eq(hpRadiationSources.seasonId, seasonId))
    .orderBy(asc(hpRadiationSources.activeFrom), asc(hpRadiationSources.id));
  return rows.flatMap(row => sourceWindows(row, monumentMotionStart(season)));
}

/** Entity auras are cosmetic; their damage projection contains no motion geometry. */
export async function hpRadiationForGalaxy(db: Queryable, seasonId: string, now: Date) {
  const [season] = await db.select().from(seasons).where(eq(seasons.id, seasonId));
  if (!season || !hpRadiationApplies(season.rulesetVersion)) return [];
  const cutoff = new Date(now.getTime() - 2 * TRAVEL.pacedFlightCapMinutes * 60_000);
  const rows = await db.select().from(hpRadiationSources).where(and(eq(hpRadiationSources.seasonId, seasonId),
    or(isNull(hpRadiationSources.activeUntil), gte(hpRadiationSources.activeUntil, cutoff)))).orderBy(hpRadiationSources.id);
  const cutover = monumentMotionStart(season);
  const bodies = cutover ? await db.select({ id: monuments.id, x: monuments.x, y: monuments.y, z: monuments.z }).from(monuments)
    .where(eq(monuments.seasonId, seasonId)) : [];
  const byId = new Map(bodies.map(body => [body.id, body]));
  return rows.flatMap(row => sourceWindows(row, cutover).map(source => {
    const body = source.target?.kind === 'MONUMENT' ? byId.get(source.target.id) : undefined;
    const motion = body ? motionOfMonument(body, season) : undefined;
    const level = row.anchorKind === 'MONUMENT' && row.mode === 'EMIT'
      ? Object.values(MONUMENT_BALANCE).find(balance => balance.intensityHpPerMinute === row.intensityHpPerMinute)?.radiationLevel : undefined;
    return { id: source.id, mode: source.mode, center: source.center, radius: source.radius,
      intensityHpPerMinute: source.intensityHpPerMinute, activeFrom: new Date(source.activeFromMs).toISOString(),
      activeUntil: source.activeUntilMs === null ? null : new Date(source.activeUntilMs).toISOString(),
      ...(source.target ? { target: source.target } : {}), ...(motion ? { motion } : {}), ...(level === undefined ? {} : { level }) };
  }));
}
