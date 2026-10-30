import { and, asc, eq, gt, gte, inArray, isNull, lt, lte, or } from 'drizzle-orm';
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
  return targetSourcesFrom(season, rows);
}

/** `hpSourcesForTarget` for every planet in `planetIds`, before each one's own `from`. Scaling plan F1.4. */
export async function planetAnchoredSources(tx: Queryable, season: typeof seasons.$inferSelect,
  planetIds: readonly string[], until: Date) {
  return tx.select().from(hpRadiationSources).where(and(eq(hpRadiationSources.seasonId, season.id),
    eq(hpRadiationSources.anchorKind, 'PLANET'), inArray(hpRadiationSources.anchorId, [...planetIds]),
    lt(hpRadiationSources.activeFrom, until)));
}

export function targetSourcesFrom(season: typeof seasons.$inferSelect,
  rows: readonly (typeof hpRadiationSources.$inferSelect)[]): HpRadiationSource[] {
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

/**
 * `hpSourcesForSeason(…, { from: at, until: at + 1ms, targets: monuments })` over rows
 * already read, in the same order: the monuments' instantaneous dose on a cached read
 * (F1.8). `rows` must hold every source still active at `at`.
 */
export function monumentDoseSources(season: typeof seasons.$inferSelect, rows: readonly (typeof hpRadiationSources.$inferSelect)[],
  monumentIds: ReadonlySet<string>, at: Date): HpRadiationSource[] {
  const ms = at.getTime();
  return rows
    .filter(row => (row.activeUntil === null || row.activeUntil.getTime() > ms) && row.activeFrom.getTime() < ms + 1
      && (row.origin === 'ENVIRONMENT' || (row.anchorKind === 'MONUMENT' && row.anchorId !== null && monumentIds.has(row.anchorId))))
    .sort((a, b) => a.activeFrom.getTime() - b.activeFrom.getTime() || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    .flatMap(row => sourceWindows(row, monumentMotionStart(season), season.radiationBombStartsAt));
}

/** Current availability never needs the ended source history used by flight settlement. */
export async function activeHpSourcesForSeason(tx: Queryable, seasonId: string, now: Date): Promise<HpRadiationSource[]> {
  const [season] = await tx.select().from(seasons).where(eq(seasons.id, seasonId));
  return season ? activeHpSources(tx, season, now) : [];
}

/** `activeHpSourcesForSeason` for a caller already holding the season row. */
export async function activeHpSources(tx: Queryable, season: typeof seasons.$inferSelect, now: Date): Promise<HpRadiationSource[]> {
  const seasonId = season.id;
  if (!hpRadiationApplies(season.rulesetVersion)) return [];
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
  const rows = await galaxyHpRadiationRows(db, seasonId, now);
  const bodies = monumentMotionStart(season) ? await db.select({ id: monuments.id, x: monuments.x, y: monuments.y, z: monuments.z })
    .from(monuments).where(eq(monuments.seasonId, seasonId)) : [];
  return galaxyHpRadiationView(season, rows, bodies, now);
}

/** How long an ended source stays on the map: the longest a flight can still be crossing it. */
const MAP_MEMORY_MS = 2 * TRAVEL.pacedFlightCapMinutes * 60_000;

/**
 * Every row the galaxy may draw at `since` or later, bomb history included (F1.8). A
 * cached copy loaded earlier is a superset of what a later instant draws; the view
 * filters it again, and the monuments' own dose reads the same rows.
 */
export async function galaxyHpRadiationRows(db: Queryable, seasonId: string, since: Date) {
  return db.select().from(hpRadiationSources).where(and(eq(hpRadiationSources.seasonId, seasonId),
    or(isNull(hpRadiationSources.activeUntil), gte(hpRadiationSources.activeUntil, new Date(since.getTime() - MAP_MEMORY_MS)))))
    .orderBy(hpRadiationSources.id);
}

export function galaxyHpRadiationView(season: typeof seasons.$inferSelect, rows: readonly (typeof hpRadiationSources.$inferSelect)[],
  bodies: readonly { id: string; x: number; y: number; z: number }[], now: Date) {
  const cutoff = now.getTime() - MAP_MEMORY_MS;
  const drawn = rows.filter(row => (row.activeUntil === null || row.activeUntil.getTime() >= cutoff)
    // Bomb history is server-only: target auras never irradiate a travelling fleet.
    && (row.origin === 'ENVIRONMENT' || (row.activeUntil !== null && row.activeUntil.getTime() > now.getTime())));
  const cutover = monumentMotionStart(season);
  const byId = new Map((cutover ? bodies : []).map(body => [body.id, body]));
  return drawn.flatMap(row => sourceWindows(row, cutover, season.radiationBombStartsAt).map(source => {
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
