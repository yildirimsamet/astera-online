import type { ArenaLayout, StructureKind } from '@astera/rules/arena';

/**
 * The Rift map (owner 2026-10-22, item 9; 15-yarik-haritasi §7): places only. It is built from
 * the layout alone. Y7's friend overlay is separate; this plan never exposes a rival.
 *
 * Map space is SVG units = metres, north-up: +Z is up and, looking down, −X is to the right
 * (facing +Z, your right-hand side is −X).
 */
export interface MapPlan {
  radius: number;
  /** `angle`: the structure's long axis on the map, degrees clockwise from map +X. */
  landmarks: { kind: Exclude<StructureKind, 'dock'>; x: number; y: number; size: number; angle: number }[];
  belts: { x: number; y: number; r: number; dense: boolean }[];
  dust: { x: number; y: number; r: number }[];
  exits: { x: number; y: number }[];
  entries: { x: number; y: number }[];
}

export const mapPoint = (x: number, z: number): { x: number; y: number } => ({ x: x === 0 ? 0 : -x, y: z === 0 ? 0 : -z });

export function mapPlan(layout: ArenaLayout): MapPlan {
  const landmarks: MapPlan['landmarks'] = [];
  for (const s of layout.structures) {
    // A dock carries an exit: drawn once, as the exit.
    if (s.kind === 'dock') continue;
    landmarks.push({ kind: s.kind, ...mapPoint(s.p.x, s.p.z), size: s.scale, angle: Math.round(Math.atan2(-s.uz, -s.ux) * 180 / Math.PI) });
  }
  return {
    radius: layout.radius,
    landmarks,
    belts: layout.fields.map(f => ({ ...mapPoint(f.p.x, f.p.z), r: f.radius, dense: f.dense })),
    dust: layout.dust.map(d => ({ ...mapPoint(d.p.x, d.p.z), r: d.radius })),
    exits: layout.exits.map(e => mapPoint(e.x, e.z)),
    entries: layout.entries.map(e => mapPoint(e.x, e.z)),
  };
}

/** The own arrow: at the ship, pointing along its flat heading (fx, fz). */
export function selfTransform(x: number, z: number, fx: number, fz: number): string {
  const p = mapPoint(x, z);
  const degrees = Math.round(Math.atan2(-fx || 0, fz) * 180 / Math.PI);
  return `translate(${String(Math.round(p.x))} ${String(Math.round(p.y))}) rotate(${String(degrees === 0 ? 0 : degrees)})`;
}

/** Range rings and the scale bar: a fifth of the disc, down to a 500 m step. */
export function mapGrid(radius: number): { step: number; rings: number[] } {
  const step = Math.max(500, Math.floor(radius / 5 / 500) * 500);
  const rings: number[] = [];
  for (let r = step; r < radius; r += step) rings.push(r);
  return { step, rings };
}

/** Height in the slab, floor 0 to ceiling 1. */
export const altitudeShare = (y: number, halfHeight: number): number => Math.max(0, Math.min(1, (y + halfHeight) / (2 * halfHeight)));
