import { planetArt, planetModel } from '../ui/assets.js';

/**
 * WHICH MODEL A WORLD IS DRAWN WITH (F9 · K7).
 *
 *   · `dot`  — the PNG billboard. A world a few pixels across is a circle whatever it is
 *              made of, and a thousand of them cost a quad each.
 *   · `lite` — the light model (`-lod`, ~1k triangles, colour map only): lit by the scene,
 *              turning on its axis. What most worlds in view are drawn with.
 *   · `full` — the full model (~10k triangles, its detail maps): a world the camera is close to.
 */
export type PlanetLod = 'dot' | 'lite' | 'full';

/** Screen radius, in pixels, at which a world steps up to each model. */
export const PLANET_LOD = {
  lite: 6,
  full: 70,
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

const RANK: Record<PlanetLod, number> = { dot: 0, lite: 1, full: 2 };
const STEPS: readonly [PlanetLod, number][] = [['lite', PLANET_LOD.lite], ['full', PLANET_LOD.full]];

/**
 * The model for a world `px` pixels in radius. Given the model it already has, a world
 * steps up only once clearly past a threshold and steps down only once clearly under it.
 */
export function lodFor(px: number, previous?: PlanetLod): PlanetLod {
  let lod: PlanetLod = 'dot';
  for (const [tier, at] of STEPS) {
    const held = previous !== undefined && RANK[previous] >= RANK[tier];
    const edge = held ? at * (1 - HYSTERESIS) : at * (1 + (previous === undefined ? 0 : HYSTERESIS));
    if (px >= edge) lod = tier;
  }
  return lod;
}

export interface DotGroup<T> { texture: string; nodes: T[] }
export interface ModelGroup<T> { url: string; nodes: T[] }

/**
 * THE DRAWS THE FIELD MAKES: each tier grouped by look, so a tier is one instanced draw
 * per look — the billboards by their render, the models by their file.
 */
export function groupPlanetsByLod<T extends { id: string }>(
  nodes: readonly T[],
  lodOf: (id: string) => PlanetLod,
): { dots: DotGroup<T>[]; lite: ModelGroup<T>[]; full: ModelGroup<T>[] } {
  const dots = new Map<string, T[]>();
  const lite = new Map<string, T[]>();
  const full = new Map<string, T[]>();
  const add = (into: Map<string, T[]>, key: string, node: T): void => {
    const bucket = into.get(key);
    if (bucket) bucket.push(node);
    else into.set(key, [node]);
  };
  for (const node of nodes) {
    const lod = lodOf(node.id);
    if (lod === 'dot') add(dots, planetArt(node.id), node);
    else add(lod === 'lite' ? lite : full, planetModel(node.id, lod), node);
  }
  return {
    dots: [...dots].map(([texture, group]) => ({ texture, nodes: group })),
    lite: [...lite].map(([url, group]) => ({ url, nodes: group })),
    full: [...full].map(([url, group]) => ({ url, nodes: group })),
  };
}
