import type { Vec3Tuple } from './scene.js';

/**
 * Inner and outer radius of each second-wave belt, in world radii (the planet is ~0.85–1).
 * The shaders and the annulus geometry both read these, so the art never drifts off its mesh.
 * The outer edges stay inside the inspection camera's frame (~2.0).
 */
export const RING_SPANS = {
  saturn: [1.1, 1.9], prism: [1.3, 2.02], inferno: [1.18, 1.95], nebula: [1.06, 2.02],
} as const satisfies Record<string, readonly [number, number]>;

const smoothstep = (a: number, b: number, x: number): number => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const band = (from: number, to: number, edge: number, t: number): number =>
  smoothstep(from - edge, from + edge, t) * (1 - smoothstep(to - edge, to + edge, t));

/**
 * Radial colour (RGB) and optical density (A) of Saturn's rings, sampled from the C ring's
 * inner edge (t = 0) to just past the F ring (t = 1). Real proportions: C ring 1.24–1.53 Rs,
 * B ring to 1.95, Cassini division to 2.03, A ring to 2.27 with the Encke gap at 2.21, F ring
 * at 2.32. Ringlets are fixed sums of sines, so the result is deterministic and the shader
 * reads it once as a 1D texture instead of recomputing anatomy per pixel.
 */
export function saturnRingProfile(samples = 256): Uint8Array {
  const out = new Uint8Array(samples * 4);
  for (let i = 0; i < samples; i++) {
    const t = (i + .5) / samples;
    const ringlets = .5 + .5 * Math.sin(t * 211) * Math.sin(t * 67 + 1.3);
    const c = band(.012, .263, .012, t) * (.1 + .07 * ringlets + .04 * Math.sin(t * 90));
    const b = band(.263, .652, .008, t) * (.78 + .14 * ringlets + .08 * smoothstep(.36, .5, t));
    const a = band(.722, .944, .006, t) * (.56 + .12 * ringlets) * (1 - band(.889, .897, .002, t) * .92);
    const f = band(.982, .99, .003, t) * .5;
    const density = Math.min(1, c + b + a + f);
    // Pale grey-brown C ring, warm cream B ring (tan at its inner edge), cooler A ring, white F ring.
    const cream = smoothstep(.24, .4, t) * (1 - smoothstep(.68, .74, t));
    const tan = band(.26, .4, .04, t);
    const outer = band(.72, .95, .02, t), white = band(.97, 1, .01, t);
    const inner = band(.012, .263, .012, t);
    const red = 186 + 62 * cream - 14 * tan + 40 * outer + 64 * white + 16 * inner;
    const green = 172 + 56 * cream - 22 * tan + 38 * outer + 74 * white;
    const blue = 154 + 36 * cream - 30 * tan + 34 * outer + 86 * white - 14 * inner;
    out.set([Math.min(255, Math.round(red)), Math.min(255, Math.round(green)), Math.min(255, Math.round(blue)), t < .012 ? 0 : Math.round(density * 255)], i * 4);
  }
  return out;
}

export interface ShardTransform { position: Vec3Tuple; rotation: Vec3Tuple; scale: number; hue: number }

/** A seeded generator keeps every client's Prism halo identical. */
function seeded(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * 120 crystal needles in one instanced draw of eight-triangle octahedra: a dense inner lane
 * of small shards and a sparse outer lane of larger ones, so the belt reads as two halos.
 */
export function prismShardTransforms(count = 120): ShardTransform[] {
  const random = seeded(0x9e3779b9);
  return Array.from({ length: count }, (_, i) => {
    const outer = i % 10 >= 7;
    const angle = i / count * Math.PI * 2 + (random() - .5) * .12;
    const radius = outer ? 1.78 + .16 * random() : 1.44 + .16 * random();
    const size = random();
    return {
      position: [Math.cos(angle) * radius, (random() - .5) * (outer ? .34 : .2), Math.sin(angle) * radius],
      rotation: [random() * Math.PI, random() * Math.PI, random() * Math.PI],
      scale: outer ? .042 + .04 * size * size : .018 + .03 * size * size,
      hue: random(),
    };
  });
}
