import * as THREE from 'three';

type Point = readonly [number, number, number];

/**
 * Where a damaged hull smokes and burns: `count` points of its upper surface, one per equal stretch
 * of its length (x), each the candidate nearest that stretch's middle. Same hull, same vents.
 */
export function pickVents<P extends Point>(candidates: readonly P[], count: number): P[] {
  if (candidates.length <= count) return [...candidates];
  let min = Infinity, max = -Infinity;
  for (const p of candidates) { min = Math.min(min, p[0]); max = Math.max(max, p[0]); }
  const span = (max - min) / count;
  const vents: P[] = [];
  for (let i = 0; i < count; i++) {
    const middle = min + span * (i + 0.5);
    let best: P | undefined;
    for (const p of candidates) {
      if (!best || Math.abs(p[0] - middle) < Math.abs(best[0] - middle)
        || (Math.abs(p[0] - middle) === Math.abs(best[0] - middle) && p[1] > best[1])) best = p;
    }
    if (best) vents.push(best);
  }
  return vents;
}

/**
 * The upward-facing points of a hull, as [along (z), up (y), across (x)] so `pickVents` spreads them
 * along its length. Reads plain and interleaved vertex data alike: glTF often packs position and
 * normal into one buffer. `stride` skips vertices to keep a dense hull cheap.
 */
export function hullDeck(object: THREE.Object3D, stride = 5): [number, number, number][] {
  object.updateMatrixWorld(true);
  const deck: [number, number, number][] = [];
  const p = new THREE.Vector3(), n = new THREE.Vector3(), normalMatrix = new THREE.Matrix3();
  object.traverse((node) => {
    if (!(node instanceof THREE.Mesh)) return;
    const geometry: unknown = node.geometry;
    if (!(geometry instanceof THREE.BufferGeometry)) return;
    const position: unknown = geometry.getAttribute('position'), normal: unknown = geometry.getAttribute('normal');
    const readable = (a: unknown): a is THREE.BufferAttribute | THREE.InterleavedBufferAttribute =>
      a instanceof THREE.BufferAttribute || a instanceof THREE.InterleavedBufferAttribute;
    if (!readable(position) || !readable(normal)) return;
    normalMatrix.getNormalMatrix(node.matrixWorld);
    for (let i = 0; i < position.count; i += stride) {
      n.fromBufferAttribute(normal, i).applyMatrix3(normalMatrix).normalize();
      if (n.y < 0.75) continue;
      p.fromBufferAttribute(position, i).applyMatrix4(node.matrixWorld);
      deck.push([p.z, p.y, p.x]);
    }
  });
  return deck;
}

const hash = (n: number): number => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

/**
 * A flipbook loop with no visible seam: two copies half a cycle apart, each fading to nothing as it
 * wraps from its last frame to its first, their weights always summing to one.
 */
export function loopLayers(seconds: number, fps: number, frames: number, offset: number): [{ frame: number; weight: number }, { frame: number; weight: number }] {
  const t = Number.isFinite(seconds) && seconds > 0 ? seconds : 0;
  const cycle = (t * fps) / frames + offset;
  const layer = (shift: number) => {
    const p = (((cycle + shift) % 1) + 1) % 1;
    return { frame: p * frames, weight: 1 - Math.abs(2 * p - 1) };
  };
  return [layer(0), layer(0.5)];
}

const smooth = (edge0: number, edge1: number, x: number): number => {
  const k = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return k * k * (3 - 2 * k);
};

/** Smoke puffs per vent: enough to keep one unbroken column. */
export const SMOKE_PUFFS = 7;

/**
 * One smoke puff of a vent. A vent's puffs share its life (2.6–3.4 s) and sit evenly spaced along the
 * column (a little jitter, never a hole), so they are reborn one at a time; each rebirth (`cycle`)
 * takes a new sideways drift, size and starting frame, so no two passes of the column look alike.
 */
export function puffState(vent: number, puff: number, seconds: number) {
  const life = 2.6 + 0.8 * hash(vent * 31 + 1);
  if (!Number.isFinite(seconds) || seconds < 0) return { life, age: 0, cycle: -1, alpha: 0, drift: 0, size: 1, frame: 8 };
  const slot = (puff + 0.25 * (hash(vent * 13 + puff * 5 + 3) - 0.5)) / SMOKE_PUFFS;
  const x = seconds / life + slot + hash(vent * 7 + 2);
  const cycle = Math.floor(x);
  const age = x - cycle;
  const seed = vent * 1000 + puff * 100 + cycle;
  return {
    life, age, cycle,
    alpha: smooth(0, 0.15, age) * (1 - smooth(0.55, 1, age)),
    drift: hash(seed * 3 + 1) * 2 - 1,
    size: 0.8 + 0.5 * hash(seed * 3 + 2),
    frame: 8 + 20 * hash(seed * 3 + 5),
  };
}
