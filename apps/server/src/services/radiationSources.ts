import { and, asc, eq, gt, gte, isNull, lt, lte, or } from 'drizzle-orm';
import { hpRadiationApplies, TRAVEL, type HpRadiationSource } from '@astera/rules';
import type { Queryable } from '../db/client.js';
import { hpRadiationSources, monuments, seasons } from '../db/schema.js';
import { monumentMotionStart, motionOfMonument } from './monumentMotion.js';

/** A cutover clips old spatial history; it never rewrites already-travelled time. */
function sourceWindows(row: typeof hpRadiationSources.$inferSelect, cutover?: Date, capFrom?: Date | null): HpRadiationSource[] {
  const source: HpRadiationSource = { id: row.id, center: { x: row.x, y: row.y, z: row.z }, radius: row.radius,
    intensityHpPerMinute: row.intensityHpPerMinute, mode: row.mode, origin: row.origin,
    activeFromMs: row.activeFrom.getTime(), activeUntilMs: row.activeUntil?.getTime() ?? null,
    ...(capFrom ? { totalCapFromMs: capFrom.getTime() } : {}) };
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

/** Parked fleets only need their own target's overlapping history, served by its index. */
export async function hpSourcesForTarget(tx: Queryable, season: typeof seasons.$inferSelect,
  target: { kind: 'PLANET' | 'MONUMENT'; id: string }, from: Date, until: Date): Promise<HpRadiationSource[]> {
  const rows = await tx.select().from(hpRadiationSources).where(and(eq(hpRadiationSources.seasonId, season.id),
    eq(hpRadiationSources.anchorKind, target.kind), eq(hpRadiationSources.anchorId, target.id),
    lt(hpRadiationSources.activeFrom, until), or(isNull(hpRadiationSources.activeUntil), gt(hpRadiationSources.activeUntil, from))));
  return rows.flatMap(row => sourceWindows(row, monumentMotionStart(season) ?? season.radiationBombStartsAt ?? undefined,
    season.radiationBombStartsAt));
}

interface HpSourceScope {
  from?: Date;
  until?: Date;
  /** Empty for transit; entity bombs cannot irradiate an ordinary flight. */
  targets?: readonly NonNullable<HpRadiationSource['target']>[];
}

export async function hpSourcesForSeason(tx: Queryable, seasonId: string, scope: HpSourceScope = {}): Promise<HpRadiationSource[]> {
  const [season] = await tx.select().from(seasons).where(eq(seasons.id, seasonId));
  if (!season) return [];
  const rows = await tx.select().from(hpRadiationSources).where(and(eq(hpRadiationSources.seasonId, seasonId),
    scope.from === undefined ? undefined : or(isNull(hpRadiationSources.activeUntil), gt(hpRadiationSources.activeUntil, scope.from)),
    scope.until === undefined ? undefined : lt(hpRadiationSources.activeFrom, scope.until),
    scope.targets === undefined ? undefined : or(eq(hpRadiationSources.origin, 'ENVIRONMENT'),
      ...scope.targets.map(target => and(eq(hpRadiationSources.anchorKind, target.kind), eq(hpRadiationSources.anchorId, target.id)))),
  ))
    .orderBy(asc(hpRadiationSources.activeFrom), asc(hpRadiationSources.id));
  return rows.flatMap(row => sourceWindows(row, monumentMotionStart(season), season.radiationBombStartsAt));
}

/** Current availability never needs the ended source history used by flight settlement. */
export async function activeHpSourcesForSeason(tx: Queryable, seasonId: string, now: Date): Promise<HpRadiationSource[]> {
  const [season] = await tx.select().from(seasons).where(eq(seasons.id, seasonId));
  if (!season || !hpRadiationApplies(season.rulesetVersion)) return [];
  const rows = await tx.select().from(hpRadiationSources).where(and(eq(hpRadiationSources.seasonId, seasonId),
    lte(hpRadiationSources.activeFrom, now), or(isNull(hpRadiationSources.activeUntil), gt(hpRadiationSources.activeUntil, now))));
  const at = now.getTime();
  return rows.flatMap(row => sourceWindows(row, monumentMotionStart(season), season.radiationBombStartsAt))
    .filter(source => source.activeFromMs <= at && (source.activeUntilMs === null || source.activeUntilMs > at));
}

/** Entity auras are cosmetic; their damage projection contains no motion geometry. */
export async function hpRadiationForGalaxy(db: Queryable, seasonId: string, now: Date) {
  const [season] = await db.select().from(seasons).where(eq(seasons.id, seasonId));
  if (!season || !hpRadiationApplies(season.rulesetVersion)) return [];
  const cutoff = new Date(now.getTime() - 2 * TRAVEL.pacedFlightCapMinutes * 60_000);
  const rows = await db.select().from(hpRadiationSources).where(and(eq(hpRadiationSources.seasonId, seasonId),
    or(isNull(hpRadiationSources.activeUntil), gte(hpRadiationSources.activeUntil, cutoff)),
    // Bomb history is server-only: target auras never irradiate a travelling fleet.
    or(eq(hpRadiationSources.origin, 'ENVIRONMENT'), gt(hpRadiationSources.activeUntil, now)),
  )).orderBy(hpRadiationSources.id);
  const cutover = monumentMotionStart(season);
  const bodies = cutover ? await db.select({ id: monuments.id, x: monuments.x, y: monuments.y, z: monuments.z }).from(monuments)
    .where(eq(monuments.seasonId, seasonId)) : [];
  const byId = new Map(bodies.map(body => [body.id, body]));
  return rows.flatMap(row => sourceWindows(row, cutover, season.radiationBombStartsAt).map(source => {
    const body = source.target?.kind === 'MONUMENT' ? byId.get(source.target.id) : undefined;
    const motion = body ? motionOfMonument(body, season) : undefined;
    const level = row.radiationLevel ?? undefined;
    return { id: source.id, mode: source.mode, origin: row.origin, center: source.center, radius: source.radius,
      intensityHpPerMinute: source.intensityHpPerMinute, activeFrom: new Date(source.activeFromMs).toISOString(),
      activeUntil: source.activeUntilMs === null ? null : new Date(source.activeUntilMs).toISOString(),
      ...(source.target ? { target: source.target } : {}), ...(motion ? { motion } : {}), ...(level === undefined ? {} : { level }),
      ...(season.radiationBombStartsAt ? { totalCapFrom: season.radiationBombStartsAt.toISOString() } : {}) };
  }));
}
