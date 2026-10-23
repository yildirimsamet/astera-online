import type { StructureMark } from './structures.js';
import type { Vec3 } from './types.js';

type Point = readonly [number, number, number];
/** Quarter turns about +Y; at 1, local +Z goes to +X. */
export type QuarterTurn = 0 | 1 | 2 | 3;
/** A kit piece in a plan: its origin on the 20 m grid (metres, plan frame) and its turn. */
export interface BlueprintPiece { key: string; at: Point; turn: QuarterTurn }
/**
 * A modular building of the Rift (16-yarik-v6-plani §7): kit pieces (brief 4) put together
 * port to port. The layout places each piece as its own structure collider, so a building
 * needs no collider of its own, and every peer places it exactly (quarter turns, no trig).
 */
export interface Blueprint { key: string; pieces: readonly BlueprintPiece[] }
/** A port in the plan frame: which piece it belongs to, the centre of its plane, and its outward direction. */
export interface PlacedPort { piece: number; p: Point; d: Point }

const COS = [1, 0, -1, 0] as const;
const SIN = [0, 1, 0, -1] as const;
/** No −0: plans are compared and hashed as plain numbers. */
const clean = (v: number): number => (v === 0 ? 0 : v);

export function quarter(k: QuarterTurn, p: Point): [number, number, number] {
  const c = COS[k]; const s = SIN[k];
  return [clean(p[0] * c + p[2] * s), clean(p[1]), clean(-p[0] * s + p[2] * c)];
}

/** Every port of every piece, in the plan frame. */
export function blueprintPorts(plan: Blueprint, kit: readonly { key: string; ports: readonly StructureMark[] }[]): PlacedPort[] {
  return plan.pieces.flatMap((piece, index) => {
    const entry = kit.find(e => e.key === piece.key);
    if (!entry) throw new Error(`Blueprint ${plan.key}: the kit has no piece ${piece.key}`);
    return entry.ports.map(port => {
      const p = quarter(piece.turn, port.p);
      return { piece: index, p: [clean(piece.at[0] + p[0]), clean(piece.at[1] + p[1]), clean(piece.at[2] + p[2])], d: quarter(piece.turn, port.d) };
    });
  });
}

/** Ports not met by exactly one port of another piece, in the same plane and facing it. */
export function openPorts(plan: Blueprint, kit: readonly { key: string; ports: readonly StructureMark[] }[]): PlacedPort[] {
  const ports = blueprintPorts(plan, kit);
  return ports.filter(a => ports.filter(b => b.piece !== a.piece
    && Math.abs(a.p[0] - b.p[0]) + Math.abs(a.p[1] - b.p[1]) + Math.abs(a.p[2] - b.p[2]) < 0.5
    && a.d[0] * b.d[0] + a.d[1] * b.d[1] + a.d[2] * b.d[2] < -0.99).length !== 1);
}

/**
 * Each piece's place in the level for a plan at p whose +Z faces the horizontal unit (fx, fz):
 * where its origin goes and which way its own +Z points.
 */
export function blueprintPoses(plan: Blueprint, p: Vec3, fx: number, fz: number): { key: string; p: Vec3; fx: number; fz: number }[] {
  // The yaw that takes plan +Z onto (fx, fz): x' = x·fz + z·fx, z' = −x·fx + z·fz.
  const turn = (x: number, z: number): [number, number] => [clean(x * fz + z * fx), clean(-x * fx + z * fz)];
  return plan.pieces.map(piece => {
    const [x, z] = turn(piece.at[0], piece.at[2]);
    const forward = quarter(piece.turn, [0, 0, 1]);
    const [wx, wz] = turn(forward[0], forward[2]);
    return { key: piece.key, p: { x: clean(p.x + x), y: clean(p.y + piece.at[1]), z: clean(p.z + z) }, fx: wx, fz: wz };
  });
}
