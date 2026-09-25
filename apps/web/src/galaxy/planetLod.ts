import { planetModel } from '../ui/assets.js';

/**
 * WHICH MODEL A WORLD IS DRAWN WITH (F9 · K7). A model at every distance — owner,
 * 2026-09-25: "çok küçükse yine de eski PNG billboard kullanmayalım" — so every world is
 * lit by the scene and turns on its axis, whatever its size on screen.
 *
 *   · `far`  — a speck (`-far`, ~500 triangles, colour map only): the galaxy seen whole.
 *   · `lite` — most worlds in view (`-lod`, ~1k triangles, colour map only).
 *   · `full` — a world the camera is close to (4k triangles, its detail maps).
 */
export type PlanetLod = 'far' | 'lite' | 'full';

/** Every tier, lightest first. */
export const PLANET_TIERS: readonly PlanetLod[] = ['far', 'lite', 'full'];

/**
 * Screen radius, in pixels, at which a world steps up to each model. On a phone held
 * upright (812 px tall, the disc's 45° lens) that is a camera distance over the world's
 * radius of ~163 for the light model and ~34 for the full one (owner, 2026-09-25: "~14
 * çok yakın kalıyor. ~34 falan yapalım"). In pixels rather than distance so a world
 * steps up by how big it LOOKS, whatever the screen.
 */
export const PLANET_LOD = {
  lite: 6,
  full: 29,
} as const;

/**
 * A MODELLED WORLD'S PICK SPHERE, IN RADII (owner: "hitboxlara da bakmayı unutma"). The
 * billboard it replaces is picked by its whole square — twice the radius on a side — so
 * the sphere is sized to that square's area: going 3D neither shrinks the target under a
 * thumb nor grows it over the neighbours.
 */
export const MODEL_PICK_SCALE = 2 / Math.sqrt(Math.PI);

/** How far past a threshold a world must go before it changes model: no flicker while the camera settles. */
const HYSTERESIS = 0.12;

/** A world's radius on screen, in pixels: its radius over the distance, in half-viewport units. */
export function screenRadius(radius: number, distance: number, fovDegrees: number, viewportHeight: number): number {
  const half = Math.tan((fovDegrees * Math.PI) / 360);
  return (radius / (Math.max(distance, 1e-6) * half)) * (viewportHeight / 2);
}

const RANK: Record<PlanetLod, number> = { far: 0, lite: 1, full: 2 };
const STEPS: readonly [PlanetLod, number][] = [['lite', PLANET_LOD.lite], ['full', PLANET_LOD.full]];

/**
 * The model for a world `px` pixels in radius. Given the model it already has, a world
 * steps up only once clearly past a threshold and steps down only once clearly under it.
 */
export function lodFor(px: number, previous?: PlanetLod): PlanetLod {
  let lod: PlanetLod = 'far';
  for (const [tier, at] of STEPS) {
    const held = previous !== undefined && RANK[previous] >= RANK[tier];
    const edge = held ? at * (1 - HYSTERESIS) : at * (1 + (previous === undefined ? 0 : HYSTERESIS));
    if (px >= edge) lod = tier;
  }
  return lod;
}

export interface ModelGroup<T> { lod: PlanetLod; url: string; nodes: T[] }

/**
 * THE DRAWS THE FIELD MAKES: each tier grouped by look — its model file — so a tier is
 * one instanced draw per look.
 */
export function groupPlanetsByLod<T extends { id: string }>(
  nodes: readonly T[],
  lodOf: (id: string) => PlanetLod,
): ModelGroup<T>[] {
  const groups = new Map<string, ModelGroup<T>>();
  for (const node of nodes) {
    const lod = lodOf(node.id);
    const url = planetModel(node.id, lod);
    const group = groups.get(url);
    if (group) group.nodes.push(node);
    else groups.set(url, { lod, url, nodes: [node] });
  }
  return [...groups.values()];
}
