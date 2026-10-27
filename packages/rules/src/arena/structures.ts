import { ARENA_CATALOG, catalogMeshes, decodeEntry } from './catalog.js';
import { createMesh, type ArenaMesh } from './mesh.js';
import { STRUCTURE_CATALOG } from './structures.generated.js';

type Point = readonly [number, number, number];
/** A marked spot on a structure in its own frame (metres, glTF Y-up): where, and which way out. */
export interface StructureMark { p: Point; d: Point }

/**
 * An enterable structure of the Rift (15-yarik-haritasi §3), written by
 * `tools/yarik-structures.mjs` from the delivered collider. Positions are int16 of the unit
 * ball (× `radius` metres), encoded like the rock catalog; the marks are in metres.
 */
export interface StructureEntry {
  key: string;
  /** Metres from the structure's origin to its farthest collider corner: the unit-space scale. */
  radius: number;
  /** Which node the collider came from (`collider`, or `lod0` for the v1 deliveries). */
  source: string;
  positions: string;
  indices: string;
  entrances: readonly StructureMark[];
  deposits: readonly StructureMark[];
  pads: readonly StructureMark[];
  deck: StructureMark | null;
  /** Route centrelines through the inside, for clearance checks and the map. */
  paths: readonly (readonly Point[])[];
  /** Kit pieces (brief 4): where another piece meets this one, the centre of the 70 m opening and its outward direction. */
  ports: readonly StructureMark[];
  /** Kit pieces: open points inside where loose ore drifts (farm spots, ≥ 40 m clear round). */
  cargo: readonly Point[];
}

let meshes: readonly ArenaMesh[] | null = null;

/** The structures' collider trees in unit space, built once; index = position in STRUCTURE_CATALOG. */
export function structureMeshes(): readonly ArenaMesh[] {
  meshes ??= STRUCTURE_CATALOG.map(entry => {
    const { positions, indices } = decodeEntry(entry);
    return createMesh(positions, indices);
  });
  return meshes;
}

/** Mesh index of structure i in a layout's `meshes`: they follow the rock catalog. */
export const STRUCTURE_MESH_BASE = ARENA_CATALOG.length;

let all: readonly ArenaMesh[] | null = null;

/** Every collider shape a layout can place: the rock catalog, then the structures. One shared list. */
export function arenaMeshes(): readonly ArenaMesh[] {
  all ??= [...catalogMeshes(), ...structureMeshes()];
  return all;
}

export { STRUCTURE_CATALOG };
