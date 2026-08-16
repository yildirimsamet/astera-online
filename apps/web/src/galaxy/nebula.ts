/**
 * A nebula that looks photographed rather than airbrushed.
 *
 * The previous version was radial gradients. Real deep-field images do not look
 * like that: emission nebulae are FILAMENTARY — fibrous, stringy structure with
 * hard bright rims, and dark dust lanes crossing in front of them. That texture is
 * what the eye reads as "a photograph of space" versus "a background".
 *
 * Three things make it, and all three are needed:
 *
 *   DOMAIN WARP. Plain fBm gives clouds. Feeding fBm through *another* fBm before
 *   sampling stretches and folds those clouds into filaments. It is the whole
 *   difference, and it costs one extra noise field.
 *
 *   DUST. A second, independent field SUBTRACTS. Real nebulae are half absorption,
 *   and the dark lanes are what give a flat glow depth.
 *
 *   A NARROW PALETTE. Hubble-ish: deep blue in the thin gas, teal through the body,
 *   and warm gold only at the densest cores. Space photographs are nearly
 *   monochrome with two accents; a rainbow reads as a screensaver.
 *
 * Painted once into a canvas and handed to a backdrop sphere. Never per-frame.
 */

/* ── noise ──────────────────────────────────────────────────── */

/** Cheap integer hash. Deterministic, fast enough to run ten million times. */
function hash(x: number, y: number, z: number): number {
  let h = x * 374761393 + y * 668265263 + z * 1274126177;
  h = (h ^ (h >>> 13)) * 1274126177;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

const fade = (t: number): number => t * t * (3 - 2 * t);
const mix = (a: number, b: number, t: number): number => a + (b - a) * t;

/**
 * 3D value noise.
 *
 * Three dimensions rather than two so the texture can be sampled on a CYLINDER —
 * feeding it `cos(θ), sin(θ), v` makes it seamless all the way around the sphere,
 * with no visible join behind the player.
 */
function noise3(x: number, y: number, z: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const zi = Math.floor(z);
  const xf = fade(x - xi);
  const yf = fade(y - yi);
  const zf = fade(z - zi);

  const c000 = hash(xi, yi, zi);
  const c100 = hash(xi + 1, yi, zi);
  const c010 = hash(xi, yi + 1, zi);
  const c110 = hash(xi + 1, yi + 1, zi);
  const c001 = hash(xi, yi, zi + 1);
  const c101 = hash(xi + 1, yi, zi + 1);
  const c011 = hash(xi, yi + 1, zi + 1);
  const c111 = hash(xi + 1, yi + 1, zi + 1);

  return mix(
    mix(mix(c000, c100, xf), mix(c010, c110, xf), yf),
    mix(mix(c001, c101, xf), mix(c011, c111, xf), yf),
    zf,
  );
}

function fbm(x: number, y: number, z: number, octaves: number): number {
  let sum = 0;
  let amplitude = 0.5;
  let frequency = 1;
  let norm = 0;
  for (let o = 0; o < octaves; o++) {
    sum += amplitude * noise3(x * frequency, y * frequency, z * frequency);
    norm += amplitude;
    amplitude *= 0.5;
    frequency *= 2.03;
  }
  return sum / norm;
}

/* ── the plate ──────────────────────────────────────────────── */

/**
 * Deliberately modest.
 *
 * Nebulae have no hard edges, so a 1024x512 plate stretched over the whole sky is
 * indistinguishable from 4K once bilinear filtering has it — and this is CPU work
 * that has to finish before anyone sees the galaxy.
 */
const WIDTH = 1024;
const HEIGHT = 512;

/** Hubble-ish. Deep blue → teal through the body → warm gold in the cores only. */
function palette(density: number, out: [number, number, number]): void {
  const d = Math.min(1, Math.max(0, density));
  if (d < 0.45) {
    const t = d / 0.45;
    out[0] = 10 + t * 22;
    out[1] = 18 + t * 52;
    out[2] = 42 + t * 96;
  } else if (d < 0.78) {
    const t = (d - 0.45) / 0.33;
    out[0] = 32 + t * 46;
    out[1] = 70 + t * 92;
    out[2] = 138 + t * 42;
  } else {
    // Only the densest cores go warm, and they are a small fraction of the sky.
    const t = (d - 0.78) / 0.22;
    out[0] = 78 + t * 150;
    out[1] = 162 + t * 44;
    out[2] = 180 - t * 70;
  }
}

export function paintNebulaCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  const image = ctx.createImageData(WIDTH, HEIGHT);
  const data = image.data;
  const rgb: [number, number, number] = [0, 0, 0];

  for (let j = 0; j < HEIGHT; j++) {
    const v = j / HEIGHT;

    /**
     * The galactic band.
     *
     * Structure concentrated toward the horizon, thinning to almost nothing at the
     * poles — which is both what the sky actually looks like from inside a disc,
     * and what keeps the player's view of the playfield clean while the edges of
     * the frame stay interesting.
     */
    const fromPlane = Math.abs(v - 0.5) * 2;
    // A defined band, not a wash. Most of the sky must stay empty or the worlds in
    // front of it lose their silhouettes — which is what happened twice.
    const band = Math.pow(1 - fromPlane, 3.6);

    for (let i = 0; i < WIDTH; i++) {
      const theta = (i / WIDTH) * Math.PI * 2;
      // Cylindrical sampling: seamless the whole way around, no join to hide.
      // Higher frequency than feels right at first: fine filaments read as
      // something enormous and far away, coarse ones read as fog in front of the
      // camera. Distance is carried by detail, not by dimming.
      const cx = Math.cos(theta) * 3.6;
      const cy = Math.sin(theta) * 3.6;
      const cz = v * 6.2;

      // Warp the sample point with its own noise field. This is what turns
      // clouds into filaments.
      const wx = fbm(cx + 5.2, cy + 1.3, cz, 3) * 2.4;
      const wy = fbm(cx - 3.7, cy + 9.1, cz + 4.4, 3) * 2.4;

      let density = fbm(cx + wx, cy + wy, cz + wx * 0.4, 5);
      // Steep gamma, modest gain. Contrast is what makes gas look like gas; a high
      // gain just makes the whole sphere glow.
      density = Math.pow(density, 3.2) * band * 1.5;

      // Absorption. Independent field, subtracts — the dark lanes are half of why
      // a real nebula reads as three-dimensional.
      const dust = fbm(cx * 1.9 - 11.0, cy * 1.9 + 6.0, cz * 1.9, 4);
      density *= 1 - Math.pow(Math.max(0, dust - 0.42) / 0.58, 1.1) * 0.85;

      palette(density, rgb);

      // Everything fades to the same near-black the page uses, so the sphere and
      // the interface behind it are the same colour where there is no gas.
      // Ceiling on the brightest gas. Nothing in the backdrop may approach the
      // brightness of a planet, or the planet stops being the subject.
      const intensity = Math.min(0.5, density);
      const p = (j * WIDTH + i) * 4;
      data[p] = 4 + rgb[0] * intensity;
      data[p + 1] = 6 + rgb[1] * intensity;
      data[p + 2] = 12 + rgb[2] * intensity;
      data[p + 3] = 255;
    }
  }

  ctx.putImageData(image, 0, 0);
  return canvas;
}
