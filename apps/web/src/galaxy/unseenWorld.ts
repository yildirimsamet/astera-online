import { Line, Material, Mesh, Points, Sprite } from 'three';
import type * as THREE from 'three';
import type { PlanetNode } from './scene.js';
import { planetImpactGroups } from './planetImpactMaterial.js';

/**
 * A WORLD OUTSIDE LIVE SIGHT, AS THE PICTURE SHOWS IT (owner, 2026-11-20).
 *
 * Any world without a live reading — never seen, or remembered from an old record — is drawn in
 * black and white with a band of mist across it: the sign games use for "unknown". It
 * belongs to the world, so it reads from any camera, inside a telescope's reach or far outside it.
 * The world stays where it is, its shape and light kept, and is still findable and tappable.
 *
 * It reads `intel`, which the server decides. The picture never decides what a player may know.
 */

type SightNode = Pick<PlanetNode, 'id' | 'intel'>;

export const isUnseen = (node: SightNode): boolean => node.intel !== 'RESOLVED';

/**
 * The default worlds' draws: one per impact level and sight, so the unseen ones can carry the grey
 * material while the live ones keep theirs. A galaxy with no unseen world draws exactly as before.
 */
export function planetDrawGroups<T extends SightNode & Parameters<typeof planetImpactGroups>[0][number]>(
  nodes: readonly T[],
): { key: string; level: number; grey: boolean; nodes: T[] }[] {
  const groups: { key: string; level: number; grey: boolean; nodes: T[] }[] = [];
  for (const { level, nodes: members } of planetImpactGroups(nodes)) {
    const live = members.filter(node => !isUnseen(node));
    const unseen = members.filter(isUnseen);
    if (live.length > 0) groups.push({ key: `${String(level)}:live`, level, grey: false, nodes: live });
    if (unseen.length > 0) groups.push({ key: `${String(level)}:grey`, level, grey: true, nodes: unseen });
  }
  return groups;
}

const LUMA = 'vec3(0.2126, 0.7152, 0.0722)';
const GREY_MAIN = 'unseenColourMain';

/**
 * Any fragment shader, its final colour turned to luminance: black and white, light and shading
 * kept, a little steeper than plain luminance (owner: black and white, but bold, never faded).
 *
 * It renames the shader's own `main` and adds a new one that runs it and then greys what it wrote,
 * so it works on three's built-in materials and on hand-written ones alike (a cosmetic ring, a
 * skin's palette) — whatever the shader does, it still does, in grey. Applying it twice is a no-op.
 */
export function greyFragment(source: string): string {
  if (source.includes(`void ${GREY_MAIN}()`)) return source;
  return `${source.replace(/\bvoid\s+main\s*\(\s*(?:void\s*)?\)/, `void ${GREY_MAIN}()`)}
void main() {
  ${GREY_MAIN}();
  float unseenLuma = dot(gl_FragColor.rgb, ${LUMA});
  unseenLuma = max(0.0, (unseenLuma - 0.18) * 1.35 + 0.2);
  gl_FragColor.rgb = vec3(unseenLuma);
}
`;
}

/**
 * A material drawn for worlds outside live sight. Chains whatever the material already does (an
 * impact scar stays a scar, in grey) and compiles its own program, so a grey world never shares a
 * colour world's shader.
 */
export function greyUnseenMaterial(material: THREE.Material): void {
  if (material.userData.unseenGrey === true) return;
  material.userData.unseenGrey = true;
  const compile = material.onBeforeCompile.bind(material);
  const program = material.customProgramCacheKey();
  material.onBeforeCompile = (shader, renderer) => {
    compile(shader, renderer);
    shader.fragmentShader = greyFragment(shader.fragmentShader);
  };
  material.customProgramCacheKey = () => `${program}|unseen-grey`;
  material.needsUpdate = true;
}

/** A colour as a world outside live sight shows it: its brightness kept, its hue gone. */
export function greyColour(colour: THREE.Color): THREE.Color {
  const luma = 0.2126 * colour.r + 0.7152 * colour.g + 0.0722 * colour.b;
  return colour.setRGB(luma, luma, luma);
}

/**
 * The card stand-ins (a world's art on a quad while its model loads, or if it fails), one draw per
 * art and sight: an unseen world's card is drawn grey, so a world never flashes its colours while
 * the camera closes on it and its next model arrives.
 */
export function cardGroups<T extends SightNode>(
  nodes: readonly T[],
  textureOf: (node: T) => string,
): { texture: string; grey: boolean; nodes: T[] }[] {
  const groups = new Map<string, { texture: string; grey: boolean; nodes: T[] }>();
  for (const node of nodes) {
    const texture = textureOf(node);
    const grey = isUnseen(node);
    const key = `${texture}|${grey ? 'grey' : 'live'}`;
    const group = groups.get(key);
    if (group) group.nodes.push(node);
    else groups.set(key, { texture, grey, nodes: [node] });
  }
  return [...groups.values()];
}

/**
 * The light a world model's instance colour carries. A live world keeps its own; an unseen one is
 * drawn at full, neutral light — its black and white is the whole signal, so it is never dimmed
 * or tinted on top (owner, 2026-11-20: "siyah-beyaz ama doygun, fark edilir, soluk değil").
 */
export function modelTint(node: SightNode, liveLight: number): [number, number, number] {
  return isUnseen(node) ? [1, 1, 1] : [liveLight, liveLight, liveLight];
}

/** The clouds' look. Sizes and offsets are in units of the world's radius. */
export const CLOUD = {
  texture: '/assets/vfx/library/synty-fog-cloud.webp',
  /** The texture's width and height on the quad: a thin band of mist, not a puff. */
  stretch: [1.7, 0.6] as const,
  /** How far in front of the world's centre, toward the camera, the clouds hang. */
  lift: 1.4,
  /** Opacity at the cloud's thickest: the world shows through. */
  opacity: 0.55,
  /** Cool blue-grey: mist in deep space, never a bright white puff. Linear RGB. */
  colour: [0.42, 0.48, 0.6] as const,
} as const;

export interface CloudInstance {
  id: string;
  centre: readonly [number, number, number];
  radius: number;
  /** Screen-plane offset from the world's centre, in radii. */
  offset: readonly [number, number];
  /** Width in radii. */
  size: number;
  /** Lean in radians. */
  angle: number;
  /** Where in its slow drift this cloud starts. */
  phase: number;
}

/** A stable 0..1 number from a world's id, so a world's clouds never change between frames. */
function seed(id: string, salt: number): number {
  let hash = 2166136261 ^ salt;
  for (let index = 0; index < id.length; index += 1) hash = Math.imul(hash ^ id.charCodeAt(index), 16777619);
  return ((hash >>> 0) % 10000) / 10000;
}

/**
 * One band of mist per unseen world, drawn across its middle and leaning a little its own way, so a
 * field of unknown worlds does not read as one stamp repeated. The world's edges stay in view.
 * (Two crossed clouds were tried first; the owner found them heavy, 2026-11-20.)
 */
export function cloudLayout(nodes: readonly (SightNode & Pick<PlanetNode, 'position' | 'radius'>)[]): CloudInstance[] {
  const clouds: CloudInstance[] = [];
  for (const node of nodes) {
    if (!isUnseen(node)) continue;
    const a = seed(node.id, 1);
    const b = seed(node.id, 2);
    clouds.push({
      id: node.id,
      centre: node.position,
      radius: node.radius,
      offset: [0.2 * (a - 0.5), 0.2 * (b - 0.5)],
      size: 1.6 + 0.3 * b,
      angle: 0.5 * (a - 0.5) + (b > 0.5 ? 0.15 : -0.15),
      phase: a * 6.283,
    });
  }
  return clouds;
}

/** Every cloud as per-instance arrays for one draw: centre xyz, shape (offset xy, size, angle), world (radius, phase). */
export function cloudAttributes(clouds: readonly CloudInstance[]): {
  count: number;
  centre: Float32Array;
  shape: Float32Array;
  world: Float32Array;
} {
  const centre = new Float32Array(clouds.length * 3);
  const shape = new Float32Array(clouds.length * 4);
  const world = new Float32Array(clouds.length * 2);
  clouds.forEach((cloud, index) => {
    centre.set(cloud.centre, index * 3);
    shape.set([cloud.offset[0], cloud.offset[1], cloud.size, cloud.angle], index * 4);
    world.set([cloud.radius, cloud.phase], index * 2);
  });
  return { count: clouds.length, centre, shape, world };
}

const isMaterial = (value: unknown): value is THREE.Material => value instanceof Material;

/** Every material under `root` drawn in black and white; safe to call every frame. */
export function greyObject(root: THREE.Object3D): void {
  root.traverse((part) => {
    if (!(part instanceof Mesh || part instanceof Points || part instanceof Line || part instanceof Sprite)) return;
    const value: unknown = part.material;
    const materials: unknown[] = Array.isArray(value) ? value : [value];
    for (const each of materials) if (isMaterial(each)) greyUnseenMaterial(each);
  });
}
