import type { ArenaLayout, StructureKind, Vec3 } from '@astera/rules/arena';

/**
 * PLACE MARKERS (owner 2026-10-22): a small name on each named place — Yarık Kalbi, Kovuk, the
 * outposts — so a pilot knows roughly where they are and where they are heading. Unlike the
 * exit's marker it is never pinned to the screen edge: a place shows only while the view points
 * its way, and not once you are at it.
 */
export type PlaceKind = Exclude<StructureKind, 'dock'>;
export interface Place { kind: PlaceKind; p: Vec3; radius: number }

/** Every named place; the exit docks have their own, always-on marker. */
export function placesOf(layout: ArenaLayout): Place[] {
  return layout.structures.flatMap(s => s.kind === 'dock' ? [] : [{ kind: s.kind, p: s.p, radius: s.scale }]);
}

const smooth = (edge0: number, edge1: number, x: number): number => {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
};

/**
 * 0–1: full within ~20° of the view's centre, gone past ~35°, gone within 1.2× the place's
 * reach (you are there), and gone past ~8 km (across the map a name is clutter, not a
 * heading). `forward` is the view direction, unit length.
 */
export function landmarkSight(eye: Vec3, forward: Vec3, p: Vec3, radius: number): number {
  const dx = p.x - eye.x; const dy = p.y - eye.y; const dz = p.z - eye.z;
  const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
  if (d < 1e-6) return 0;
  const cos = (dx * forward.x + dy * forward.y + dz * forward.z) / d;
  return smooth(0.82, 0.94, cos) * smooth(radius * 1.2, radius * 1.6, d) * smooth(8000, 6000, d);
}

const MINOR: ReadonlySet<PlaceKind> = new Set(['outpost', 'refinery', 'annex']);

/** Lower prints first: the named landmarks before the outposts, then the nearer. */
export const placePriority = (kind: PlaceKind, distance: number): number => distance + (MINOR.has(kind) ? 100000 : 0);

/** Which names to print: where two would overlap (within `gap` × `rise` px), the nearer place wins. */
export function declutter(points: readonly { x: number; y: number; distance: number }[], gap: number, rise = gap / 2): boolean[] {
  const order = points.map((_, i) => i).sort((a, b) => (points[a]?.distance ?? 0) - (points[b]?.distance ?? 0));
  const shown = points.map(() => false);
  const kept: { x: number; y: number }[] = [];
  for (const i of order) {
    const p = points[i];
    if (!p || kept.some(k => Math.abs(k.x - p.x) < gap && Math.abs(k.y - p.y) < rise)) continue;
    kept.push(p); shown[i] = true;
  }
  return shown;
}
