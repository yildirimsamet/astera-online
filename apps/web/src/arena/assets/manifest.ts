import { z } from 'zod';

/**
 * The reference pack (`astera-refs/dist/v2/manifest.json`), served at `/__ref/` by the dev
 * server, or by the arena process to a seated pilot of the private playtest (cookie-gated,
 * never in git or the build). Every path is checked: no traversal, only the two served
 * folders. When it is missing — CI, a fresh clone, a public build — the arena draws its
 * procedural set.
 */
export const referencePath = z.string().refine(path => {
  let decoded: string;
  try { decoded = decodeURIComponent(path); } catch { return false; }
  return /^\/__ref\/(dist|audio)\/[a-zA-Z0-9_./-]+$/.test(decoded)
    && !decoded.split('/').some(part => part === '..' || part === '.')
    && !decoded.includes('\\');
});

const maps = z.object({ map: referencePath.optional(), normalMap: referencePath.optional(), emissiveMap: referencePath.optional() });
export const modelDescriptor = z.object({
  model: referencePath,
  /** Subdivision's converted meshes store V upside down. */
  uvFlip: z.boolean(),
  /** Degrees about +Y that turn the model's nose onto +Z. */
  rotateY: z.number(),
  /** Nozzle centres in the normalised model (length 1 along Z, centred). */
  engines: z.array(z.tuple([z.number(), z.number(), z.number()])).optional(),
  /** Nozzle exit radius in the same space, measured on the model: how wide the flame leaves it. */
  nozzle: z.number().positive().optional(),
  maps: maps.optional(),
  /** Per-mesh maps, in mesh order, for models made of several parts. */
  meshMaps: z.array(maps).optional(),
  /** Index of the mesh that glows (crystal shards). */
  glowMesh: z.number().int().nonnegative().optional(),
  /**
   * Already normalised by its tool (the collider catalog's unit space, or a class ship at
   * length 1 along Z): drawn exactly as written, never recentred or rescaled.
   */
  unit: z.boolean().optional(),
  /** The file's own PBR maps and factors (roughness, metal, occlusion, emission) are kept as authored. */
  pbr: z.boolean().optional(),
  /** Levels of detail in the file, as nodes `lod0`, `lod1`…: the first is the full model. */
  lods: z.number().int().min(1).max(4).optional(),
});
export type ModelDescriptor = z.infer<typeof modelDescriptor>;
export type MapSet = z.infer<typeof maps>;

/** The three ship classes of the Rift (plan 14 §3): attack, defence, support. Their numbers live in the rules. */
export { SHIP_CLASSES, type ShipClass } from '@astera/rules/arena';

export const referenceManifest = z.object({
  version: z.literal(2),
  ships: z.object({
    hero: modelDescriptor, rivals: z.array(modelDescriptor).min(1),
    /** Y3: one ship per class from tools/arena-ships.mjs; all three or none. */
    classes: z.object({ akinci: modelDescriptor, muhafiz: modelDescriptor, kilavuz: modelDescriptor }).optional(),
  }),
  rocks: z.array(modelDescriptor).min(1),
  giants: z.array(modelDescriptor).min(1),
  crystals: z.array(modelDescriptor).min(1),
  shards: z.array(modelDescriptor),
  structures: z.object({
    hub: modelDescriptor, gate: modelDescriptor, outpost: z.array(modelDescriptor), generator: modelDescriptor,
    wreck: z.array(modelDescriptor), relay: modelDescriptor, pad: modelDescriptor,
  }),
  props: z.object({ debris: z.array(modelDescriptor), cargo: modelDescriptor }),
  textures: z.record(z.string(), referencePath),
  sky: z.object({
    faces: z.array(referencePath).length(6), env: z.array(referencePath).length(6),
    /** Y3: the same six faces as one KTX2 cube (tools/arena-ktx2.mjs); the faces stay as its fallback. */
    cube: referencePath.optional(),
  }),
  fx: z.record(z.string(), referencePath),
  sounds: z.record(z.string(), z.array(referencePath)),
  music: z.array(referencePath),
  /** Y2: one model per collider catalog shape, by catalog key (tools/arena-colliders.mjs). */
  colliders: z.record(z.string(), modelDescriptor).optional(),
});
export type ReferenceManifest = z.infer<typeof referenceManifest>;

export function parseReferenceManifest(value: unknown): ReferenceManifest | null {
  const parsed = referenceManifest.safeParse(value);
  return parsed.success ? parsed.data : null;
}
