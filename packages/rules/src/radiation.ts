import { SHIP_DAMAGE } from './constants.js';
import type { DamageLots } from './damage.js';
import { fleetCount } from './hulls.js';
import { interpolatePosition } from './travel.js';
import type { Fleet, Vec3 } from './types.js';

/**
 * RADIATION. Owner decisions K3 · K3a, 2026-09-29 (`plan.md` F8).
 *
 * A cloud takes a fixed share of every ship's FULL hull per minute spent inside it —
 * `intensityPctPerMinute` — the same inside the whole sphere, and clouds that overlap
 * add. A SHELTER cancels every cloud for the time a flight spends inside it.
 *
 * THERE IS NO TICK. A flight is straight segments flown at constant speed, so the time
 * each one spends in each sphere is a closed-form line–sphere intersection, clipped to
 * the source's live window. Everything below reads one piecewise-constant dose-rate
 * profile per segment, so the total (`segmentsDoseBp`) and the moment it kills
 * (`lethalAtMs`) can never disagree.
 *
 * ONE COPY. The server settles with these, the client forecasts and draws with them,
 * and the simulator would read them too; nothing else computes a dose.
 *
 * A stationary hold is a segment with `from === to` for its window. The next-season
 * HP model in `radiationHp.ts` shares this geometry, while keeping its dose separate.
 */

/** Spatial and historical coverage shared by percentage and HP rulesets. */
export interface RadiationField {
  id: string;
  /** EMIT doses; SHELTER cancels every EMIT for the time it covers. */
  mode: 'EMIT' | 'SHELTER';
  center: Vec3;
  radius: number;
  activeFromMs: number;
  /** `null` while it has not been ended. Ending a source never rewrites the past. */
  activeUntilMs: number | null;
}

export interface RadiationSource extends RadiationField {
  /** Share of a full hull per minute inside, in percent. A SHELTER's is ignored. */
  intensityPctPerMinute: number;
}

/** Straight flight at constant speed from `from` at `startMs` to `to` at `endMs`. */
export interface Segment {
  from: Vec3;
  to: Vec3;
  startMs: number;
  endMs: number;
}

const MINUTE_MS = 60_000;

/**
 * A HAIR OF FLOAT NOISE UNDER A WHOLE BASIS POINT COUNTS AS IT. Twenty minutes at
 * 1%/min comes out as 1999.9999999998 in floating point; without this it would settle
 * as 1999, and a flight that `lethalAtMs` says dies would land alive.
 */
const DOSE_EPSILON = 1e-6;

const finite = (n: number): boolean => Number.isFinite(n);
const finitePoint = (p: Vec3): boolean => finite(p.x) && finite(p.y) && finite(p.z);

function assertSource(source: RadiationField, intensityPerMinute: number): void {
  if (!finitePoint(source.center) || !finite(source.radius) || source.radius <= 0
    || !finite(intensityPerMinute) || intensityPerMinute < 0
    || !finite(source.activeFromMs)
    || (source.activeUntilMs !== null && !finite(source.activeUntilMs))) {
    throw new RangeError(`bad radiation source ${source.id}`);
  }
}

function assertSegment(segment: Segment): void {
  if (!finitePoint(segment.from) || !finitePoint(segment.to)
    || !finite(segment.startMs) || !finite(segment.endMs) || segment.endMs < segment.startMs) {
    throw new RangeError('bad flight segment');
  }
}

const dot = (a: Vec3, b: Vec3): number => a.x * b.x + a.y * b.y + a.z * b.z;
const minus = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });

/**
 * The span of a segment spent strictly inside a sphere, in ms, or `null`.
 *
 * A convex sphere and a straight line meet in one interval at most. A flight that only
 * grazes it spends no time inside; a segment that takes no time spends none either; one
 * that holds still spends all of it or none.
 */
export function sphereInterval(segment: Segment, center: Vec3, radius: number): [number, number] | null {
  assertSegment(segment);
  const span = segment.endMs - segment.startMs;
  if (span <= 0) return null;
  const d = minus(segment.to, segment.from);
  const f = minus(segment.from, center);
  const a = dot(d, d);
  const k = dot(f, f) - radius * radius;
  if (a === 0) return k < 0 ? [segment.startMs, segment.endMs] : null;
  const b = 2 * dot(d, f);
  const disc = b * b - 4 * a * k;
  if (disc <= 0) return null;
  const root = Math.sqrt(disc);
  const lo = Math.max(0, (-b - root) / (2 * a));
  const hi = Math.min(1, (-b + root) / (2 * a));
  if (hi <= lo) return null;
  return [segment.startMs + lo * span, segment.startMs + hi * span];
}

/** A source's part of a segment: inside it, and while it is live. */
function liveInterval(segment: Segment, source: RadiationField): [number, number] | null {
  const inside = sphereInterval(segment, source.center, source.radius);
  if (!inside) return null;
  const lo = Math.max(inside[0], source.activeFromMs);
  const hi = Math.min(inside[1], source.activeUntilMs ?? Number.POSITIVE_INFINITY);
  return hi > lo ? [lo, hi] : null;
}

export interface RadiationRatePiece {
  startMs: number;
  endMs: number;
  /** Units supplied by the caller, per millisecond. */
  rate: number;
}

/** Where on a segment a dose is being taken, and how fast. Nonzero pieces only, in order. */
export function radiationRateProfile<Source extends RadiationField>(
  segment: Segment,
  sources: readonly Source[],
  intensityPerMinute: (source: Source) => number,
): RadiationRatePiece[] {
  assertSegment(segment);
  for (const source of sources) assertSource(source, intensityPerMinute(source));
  const emits: { span: [number, number]; rate: number }[] = [];
  const shelters: [number, number][] = [];
  for (const source of sources) {
    const intensity = intensityPerMinute(source);
    if (source.mode === 'EMIT' && intensity === 0) continue;
    const span = liveInterval(segment, source);
    if (!span) continue;
    if (source.mode === 'SHELTER') shelters.push(span);
    else emits.push({ span, rate: intensity / MINUTE_MS });
  }
  if (emits.length === 0) return [];

  const cuts = [...new Set([...emits.flatMap(({ span }) => span), ...shelters.flat()])].sort((a, b) => a - b);
  const within = (span: [number, number], t: number): boolean => span[0] <= t && t <= span[1];
  const pieces: RadiationRatePiece[] = [];
  for (let i = 1; i < cuts.length; i++) {
    const startMs = cuts[i - 1], endMs = cuts[i];
    if (startMs === undefined || endMs === undefined) continue;
    const mid = (startMs + endMs) / 2;
    if (shelters.some((span) => within(span, mid))) continue;
    const rate = emits.reduce((sum, emit) => sum + (within(emit.span, mid) ? emit.rate : 0), 0);
    if (rate > 0) pieces.push({ startMs, endMs, rate });
  }
  return pieces;
}

const doseProfile = (segment: Segment, sources: readonly RadiationSource[]): RadiationRatePiece[] =>
  radiationRateProfile(segment, sources, (source) => source.intensityPctPerMinute * 100);

/** The dose one segment takes, in basis points of a full hull, unrounded. */
export function segmentExposure(segment: Segment, sources: readonly RadiationSource[]): number {
  return doseProfile(segment, sources).reduce((sum, piece) => sum + piece.rate * (piece.endMs - piece.startMs), 0);
}

/**
 * The dose a whole path takes, in whole basis points — what `applyDose` is handed.
 * Rounded once, down, where it is applied.
 */
export function segmentsDoseBp(segments: readonly Segment[], sources: readonly RadiationSource[]): number {
  const raw = segments.reduce((sum, segment) => sum + segmentExposure(segment, sources), 0);
  return Math.floor(raw + DOSE_EPSILON);
}

/** The path up to a moment: for a settlement made while the ships are still in the air. */
export function segmentsUntil(segments: readonly Segment[], untilMs: number): Segment[] {
  const cut: Segment[] = [];
  for (const segment of segments) {
    if (segment.startMs >= untilMs) break;
    if (segment.endMs <= untilMs) {
      cut.push(segment);
      continue;
    }
    cut.push({
      from: segment.from,
      to: interpolatePosition(segment.from, segment.to, segment.startMs, segment.endMs, untilMs),
      startMs: segment.startMs,
      endMs: untilMs,
    });
    break;
  }
  return cut;
}

/**
 * A flight's path, as the server stores it.
 *
 * Straight from origin to target, or — once called back (K8) — out to where it turned
 * and home again: the recall writes `recallFrom` at `recalledAt` and a new `arriveAt`,
 * and the speed never changes, so both legs are exact.
 */
export function missionSegments(flight: {
  origin: Vec3;
  target: Vec3;
  departAtMs: number;
  arriveAtMs: number;
  recalledAtMs?: number | null;
  recallFrom?: Vec3 | null;
}): Segment[] {
  const recalledAtMs = flight.recalledAtMs ?? null;
  const recallFrom = flight.recallFrom ?? null;
  if ((recalledAtMs === null) !== (recallFrom === null)) {
    throw new RangeError('a recall needs both its moment and its position');
  }
  const path = recalledAtMs === null || recallFrom === null
    ? [{ from: flight.origin, to: flight.target, startMs: flight.departAtMs, endMs: flight.arriveAtMs }]
    : [
        { from: flight.origin, to: recallFrom, startMs: flight.departAtMs, endMs: recalledAtMs },
        { from: recallFrom, to: flight.origin, startMs: recalledAtMs, endMs: flight.arriveAtMs },
      ];
  for (const segment of path) assertSegment(segment);
  return path;
}

/**
 * THE MOMENT A CLOUD FINISHES A SHIP that started the path `startBp` damaged, or `null`.
 *
 * The first whole millisecond at which the path cut there settles to a full hull — so a
 * fleet drawn fading at this moment is a fleet the server destroys, and one minute
 * earlier it would still have landed. K3a's threshold event is this moment.
 */
export function lethalAtMs(
  segments: readonly Segment[],
  sources: readonly RadiationSource[],
  startBp = 0,
): number | null {
  if (!Number.isInteger(startBp) || startBp < 0 || startBp >= SHIP_DAMAGE.destroyedBp) {
    throw new RangeError(`bad starting damage ${String(startBp)}`);
  }
  /*
    THE SETTLEMENT'S OWN LINE. `segmentsDoseBp` settles `floor(raw + DOSE_EPSILON)`, so a
    path kills exactly when its raw dose reaches `needed - DOSE_EPSILON`; a comparison
    against `needed` alone missed the float-noise band the epsilon exists for. The moment
    is aimed half an epsilon inside the line, so the path cut there settles to a full hull
    through any float noise.
  */
  const needed = SHIP_DAMAGE.destroyedBp - startBp;
  const aim = needed - DOSE_EPSILON / 2;
  let taken = 0;
  let previousEnd = Number.NEGATIVE_INFINITY;
  for (const segment of segments) {
    if (segment.startMs < previousEnd) throw new RangeError('segments out of order');
    previousEnd = segment.endMs;
    for (const piece of doseProfile(segment, sources)) {
      const gained = piece.rate * (piece.endMs - piece.startMs);
      if (taken + gained + DOSE_EPSILON >= needed) {
        // Whole ms, rounded up: the dose never falls, so a later moment settles at least as high.
        return Math.ceil(Math.min(piece.endMs, piece.startMs + Math.max(0, aim - taken) / piece.rate));
      }
      taken += gained;
    }
  }
  return null;
}

/**
 * THE MOMENT A CLOUD FINISHES A WHOLE WING, or `null`. Plan D15.
 *
 * The wing is gone when its soundest ship is: a worn ship going first leaves the rest
 * flying. The disc fades a commander's own wing at this moment, and it is the server
 * that says when — it holds the whole path, the recall's turn and the damage carried.
 */
export function wingLethalAtMs(
  segments: readonly Segment[],
  sources: readonly RadiationSource[],
  fleet: Fleet,
  damage: DamageLots | null | undefined,
): number | null {
  const ships = fleetCount(fleet);
  if (ships === 0 || sources.length === 0) return null;
  const lots = damage ?? [];
  const worn = lots.reduce((sum, lot) => sum + lot.count, 0);
  const soundest = worn < ships ? 0 : Math.min(...lots.map((lot) => lot.damageBp));
  return lethalAtMs(segments, sources, soundest);
}
