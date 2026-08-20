import * as THREE from 'three';

/**
 * THE TEXTURES THE FIRE IS MADE OF. D44.
 *
 * Every one of these is drawn into a canvas at load and never touched again. That
 * is a deliberate choice about where the quality comes from, and it is the one the
 * research kept pointing at: for a phone, a baked frame on a single quad beats a
 * hundred live particles by a wide margin, and a shaped, coloured texture beats a
 * smooth radial gradient by more than any amount of extra geometry can.
 *
 * WHY NOT COMMISSION SPRITE SHEETS. `KNOWN RISKS` is explicit that 3D scope creep
 * is a real danger and that this project uses assets that exist and commissions
 * nothing mid-phase. Procedural textures cost one canvas each, ship in the bundle
 * for free, and can be re-tuned by editing a number rather than by re-ordering art.
 *
 * WHY THE COLOUR IS BAKED IN. A sprite's `color` MULTIPLIES its map, so a single
 * white blob can only ever be tinted one colour — which is exactly why the first
 * version of the bombardment read as an orange smudge. Fire is not one colour: it
 * is white at the core, yellow through the body, orange at the edge and deep red
 * as it dies, and that ramp is the whole difference between fire and a glow.
 *
 * ALL ADDITIVE. Overlaps get brighter rather than muddier, which is what makes two
 * of these on top of each other read as hotter instead of as thicker.
 *
 * Each is built once, on first use, and shared by every effect in the galaxy —
 * `null` if there is no 2D context, which is the case under the test renderer and
 * must not throw.
 */

type Cache = THREE.Texture | null;

/** A canvas of `size`, or null where there is no 2D context to draw into. */
function surface(size: number): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } | null {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  return ctx ? { canvas, ctx } : null;
}

const finish = (canvas: HTMLCanvasElement): THREE.Texture => {
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
};

/**
 * Cheap value noise on a lattice, smoothed.
 *
 * Not simplex, and it does not need to be: these are 128-pixel textures drawn once
 * at load, and what they want from noise is "not a perfect circle" rather than
 * spectral quality. Seeded so the same texture is drawn on every machine.
 */
function noiseField(size: number, cells: number, seed: number): Float32Array {
  const lattice = new Float32Array((cells + 1) * (cells + 1));
  let s = seed >>> 0;
  const rand = (): number => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  for (let i = 0; i < lattice.length; i++) lattice[i] = rand();

  const out = new Float32Array(size * size);
  const smooth = (t: number): number => t * t * (3 - 2 * t);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const fx = (x / size) * cells;
      const fy = (y / size) * cells;
      const x0 = Math.floor(fx);
      const y0 = Math.floor(fy);
      const tx = smooth(fx - x0);
      const ty = smooth(fy - y0);
      const at = (cx: number, cy: number): number => lattice[cy * (cells + 1) + cx] ?? 0;
      const top = at(x0, y0) * (1 - tx) + at(x0 + 1, y0) * tx;
      const bottom = at(x0, y0 + 1) * (1 - tx) + at(x0 + 1, y0 + 1) * tx;
      out[y * size + x] = top * (1 - ty) + bottom * ty;
    }
  }
  return out;
}

/* ── fire ───────────────────────────────────────────────────── */

let fire: Cache | undefined;

/**
 * A FIREBALL, not a glow.
 *
 * A radial falloff broken up by two octaves of noise, coloured along the ramp real
 * fire follows: white at the core, through yellow and orange, to a dark red rim
 * that dies before the edge of the quad. The noise is what stops it reading as a
 * lens flare — a perfect circle is the single most recognisable sign of a
 * placeholder effect.
 *
 * Alpha is premultiplied into the colour by the additive blend, so the edge is
 * black rather than transparent-white, which keeps a soft rim instead of a halo.
 */
export function fireTexture(): THREE.Texture | null {
  if (fire !== undefined) return fire;
  const made = surface(128);
  if (!made) return (fire = null);
  const { canvas, ctx } = made;
  const size = 128;

  const coarse = noiseField(size, 5, 0x51f3a7);
  const fine = noiseField(size, 13, 0x9e37b1);
  const image = ctx.createImageData(size, size);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = y * size + x;
      const dx = (x + 0.5) / size - 0.5;
      const dy = (y + 0.5) / size - 0.5;
      const r = Math.hypot(dx, dy) * 2;

      // Turbulence, strongest at the rim: the core of a fireball is a solid
      // white ball and it is the OUTSIDE that tears into tongues.
      const turbulence = ((coarse[i] ?? 0.5) - 0.5) * 0.55 + ((fine[i] ?? 0.5) - 0.5) * 0.3;
      const shaped = Math.max(0, r + turbulence * Math.min(1, r * 1.4));

      // Heat falls off fast, so the white core is small and the body is orange.
      const heat = Math.max(0, 1 - shaped) ** 1.75;
      const glow = Math.max(0, 1 - shaped) ** 3.2;

      const red = Math.min(1, heat * 1.35);
      const green = Math.min(1, heat * heat * 1.15 + glow * 0.35);
      const blue = Math.min(1, glow * 1.4 * (heat * heat));

      const o = i * 4;
      image.data[o] = Math.round(red * 255);
      image.data[o + 1] = Math.round(green * 255);
      image.data[o + 2] = Math.round(blue * 255);
      image.data[o + 3] = Math.round(Math.min(1, heat * 1.1) * 255);
    }
  }
  ctx.putImageData(image, 0, 0);
  return (fire = finish(canvas));
}

/* ── the shock ring ─────────────────────────────────────────── */

let ring: Cache | undefined;

/**
 * THE RING THAT MAKES IT AN EXPLOSION RATHER THAN A FLASH.
 *
 * A thin bright annulus with a hard-ish inner edge and a soft outer one, so an
 * expanding sprite reads as a wave leaving the impact. It is the single cheapest
 * thing that separates "a light came on" from "something went off", which is why
 * every shockwave technique in the field is some version of this shape.
 *
 * Drawn as a sprite rather than as ring geometry on purpose: a sprite is already
 * camera-facing from every angle, which a ring mesh in a galaxy the player can fly
 * underneath is not — and a shockwave seen edge-on is an invisible one.
 */
export function ringTexture(): THREE.Texture | null {
  if (ring !== undefined) return ring;
  const made = surface(128);
  if (!made) return (ring = null);
  const { canvas, ctx } = made;
  const size = 128;

  const wobble = noiseField(size, 7, 0x2ab4d9);
  const image = ctx.createImageData(size, size);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = y * size + x;
      const dx = (x + 0.5) / size - 0.5;
      const dy = (y + 0.5) / size - 0.5;
      // A little out of round, from the same noise, so it is not a compass circle.
      const r = Math.hypot(dx, dy) * 2 + ((wobble[i] ?? 0.5) - 0.5) * 0.06;

      // Peak at 0.78 of the radius, falling away sharply inside and softly out.
      const band = r < 0.78 ? Math.max(0, 1 - (0.78 - r) / 0.3) ** 2.6 : Math.max(0, 1 - (r - 0.78) / 0.22) ** 1.6;

      const lit = Math.max(0, Math.min(1, band));
      const o = i * 4;
      image.data[o] = Math.round(Math.min(1, lit * 1.2) * 255);
      image.data[o + 1] = Math.round(lit * lit * 0.85 * 255);
      image.data[o + 2] = Math.round(lit ** 4 * 0.7 * 255);
      image.data[o + 3] = Math.round(lit * 255);
    }
  }
  ctx.putImageData(image, 0, 0);
  return (ring = finish(canvas));
}

/* ── embers ─────────────────────────────────────────────────── */

let spark: Cache | undefined;

/** A hot point with a small halo. What gets thrown out of an impact. */
export function sparkTexture(): THREE.Texture | null {
  if (spark !== undefined) return spark;
  const made = surface(32);
  if (!made) return (spark = null);
  const { canvas, ctx } = made;

  const g = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
  g.addColorStop(0, 'rgba(255,255,244,1)');
  g.addColorStop(0.25, 'rgba(255,214,140,0.9)');
  g.addColorStop(0.6, 'rgba(255,120,40,0.35)');
  g.addColorStop(1, 'rgba(120,20,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 32, 32);
  return (spark = finish(canvas));
}

/* ── the plume ──────────────────────────────────────────────── */

let plume: Cache | undefined;

/**
 * THE STREAK A ROUND DRAGS, AS A TEXTURE RATHER THAN AS A COLOUR.
 *
 * Read ACROSS the ribbon: hot and near-white down the centre line, falling to
 * nothing at both edges, with a little noise so the column is not a perfectly
 * even bar. The ribbon supplies the length; this supplies the softness, and
 * softness across the width is precisely what the first version lacked — a
 * vertex-coloured strip has hard edges however carefully its brightness is
 * tapered, which is why it read as a drawn line rather than as exhaust.
 */
export function plumeTexture(): THREE.Texture | null {
  if (plume !== undefined) return plume;
  const made = surface(64);
  if (!made) return (plume = null);
  const { canvas, ctx } = made;
  const size = 64;

  const grain = noiseField(size, 9, 0x77c1e5);
  const image = ctx.createImageData(size, size);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = y * size + x;
      const across = Math.abs((x + 0.5) / size - 0.5) * 2;
      const core = Math.max(0, 1 - across) ** 2.1;
      const lit = Math.max(0, Math.min(1, core * (0.82 + (grain[i] ?? 0.5) * 0.36)));

      const o = i * 4;
      image.data[o] = Math.round(Math.min(1, lit * 1.15) * 255);
      image.data[o + 1] = Math.round(lit ** 1.7 * 255);
      image.data[o + 2] = Math.round(lit ** 4.5 * 255);
      image.data[o + 3] = Math.round(lit * 255);
    }
  }
  ctx.putImageData(image, 0, 0);
  return (plume = finish(canvas));
}
