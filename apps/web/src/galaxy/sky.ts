import type { RenderQuality } from '../lib/quality.js';

/**
 * THE SKY, AS A PHOTOGRAPH RATHER THAN A WALLPAPER. Owner instruction:
 * *"nasa fotoğraflarındaki gibi olmalı… Oyuncu gerçekten bir uzayın ortasında gibi
 * hissetmeli… (Performansa dikkat et, cihazları öldürme)… her yeri kerhane gibi
 * neon ile doldurma."*
 *
 * WHAT THE LAST TWO ATTEMPTS TAUGHT, because both were rejected on sight:
 *
 *   · A CPU-painted 1024×512 plate (the old `Nebula`) is under three texels a
 *     degree. Nothing in it can be sharp, so it had to be vague — a navy wash.
 *   · A painted 4K panorama is eleven texels a degree against the ~28 a phone shows,
 *     and it baked STARS into that — the "144p" look. Photographs also pinched into
 *     streaks at the poles, where this camera looks most of the time.
 *
 * So the sky is split by what each part needs:
 *
 *   GAS IS SOFT, SO IT IS BAKED. A procedural shader renders it ONCE, on the GPU,
 *   into a cube map — no poles, no seam, a few milliseconds instead of a second of
 *   main-thread painting — and drawing it afterwards is one texture read a pixel.
 *   Nothing sharp goes into the bake, so magnifying it can only ever look soft.
 *
 *   STARS ARE SHARP, SO THEY ARE NEVER BAKED. They are points, drawn at native
 *   resolution every frame, and they read the bake's dust channel so a star behind
 *   a dark lane is dimmed by the same lane the eye can see.
 *
 * WHAT MAKES IT READ AS A PHOTOGRAPH, in the order it mattered:
 *
 *   1. A BAND. From inside a galaxy the sky is a Milky Way — star clouds, a warm
 *      bulge, and dark filamentary dust lanes crossing it. Stars crowd into the
 *      same band, so gas and stars are one sky rather than two layers.
 *   2. NATURAL COLOUR. Hydrogen is pink-red, oxygen is teal and only near the hot
 *      core, dust is brown and absorbs blue first, reflection nebulae are pale blue.
 *      Nothing is saturated to a neon; everything sits well under bloom.
 *   3. PLACES, NOT FOG. Two emission complexes, one reflection nebula and a dark
 *      cloud are LOCAL — most of the sky is black and full of stars, which is what
 *      the photographs actually look like and what keeps the worlds legible.
 *   4. LIT DUST. Pillars inside an emission complex are dark with a bright rim on
 *      the side facing the core — the one detail that makes gas read as a volume.
 */

/* ── the frame of the sky ───────────────────────────────────── */

export type Vec3 = readonly [number, number, number];

const normalise = (v: Vec3): Vec3 => {
  const length = Math.hypot(v[0], v[1], v[2]);
  return [v[0] / length, v[1] / length, v[2] / length];
};
const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];

const along = (a: Vec3, wa: number, b: Vec3, wb: number): Vec3 =>
  normalise([a[0] * wa + b[0] * wb, a[1] * wa + b[1] * wb, a[2] * wa + b[2] * wb]);
const radians = (degrees: number): number => (degrees * Math.PI) / 180;

/**
 * THE VIEW THE SKY IS COMPOSED AROUND: a camera looking down at a world from 34°
 * above it, which is where the orbit spends its time. It was the opening camera's
 * own direction — one fixed offset for every world — until 2026-09-25, when the
 * opening turned to face the galaxy's centre from wherever Home is. That points
 * every commander a different way, so the sky is framed for the typical view now,
 * and the celestial turn carries each of its places through it.
 */
export function compositionView(): Vec3 {
  return normalise([-12, -16, -20]);
}

/**
 * THE SKY IS COMPOSED AROUND THAT VIEW, not placed by taste. The first placement
 * was, and the home camera opened on the one empty half of the sky.
 *
 * The band crosses the portrait frame steeply, lower right to upper left, behind
 * the player's world. The bulge sits 30° down it — just outside the frame, so its
 * glow enters from the lower corner — and the big emission complex waits 20° up it.
 *
 * The sky turns about the vertical, so over a few minutes the camera sweeps the
 * whole ring at this elevation; the band covers half of that ring and the named
 * places below cover the rest (the test walks it).
 */
const VIEW = compositionView();
const SCREEN_RIGHT = normalise(cross(VIEW, [0, 1, 0]));
const SCREEN_UP = cross(SCREEN_RIGHT, VIEW);
const BAND_SLOPE = radians(118);
const BAND_TANGENT = along(SCREEN_RIGHT, Math.cos(BAND_SLOPE), SCREEN_UP, Math.sin(BAND_SLOPE));

/** The normal of the Milky Way's plane. */
export const MILKY_WAY_POLE: Vec3 = normalise(cross(VIEW, BAND_TANGENT));

/** Where the bulge is: on the band, 30° below the composition view. */
export const GALACTIC_CENTRE: Vec3 = along(
  VIEW,
  Math.cos(radians(30)),
  BAND_TANGENT,
  -Math.sin(radians(30)),
);

/** The third axis of the band's frame: longitude 90° from the centre. */
export const GALACTIC_ACROSS: Vec3 = cross(MILKY_WAY_POLE, GALACTIC_CENTRE);

/**
 * A direction given in the band's own coordinates, in degrees: longitude from the
 * centre along the band, latitude off it. The composition view is at (30, 0).
 */
export function bandDirection(longitude: number, latitude: number): Vec3 {
  const l = radians(longitude);
  const b = radians(latitude);
  const c = Math.cos(b);
  return normalise([
    c * (Math.cos(l) * GALACTIC_CENTRE[0] + Math.sin(l) * GALACTIC_ACROSS[0]) + Math.sin(b) * MILKY_WAY_POLE[0],
    c * (Math.cos(l) * GALACTIC_CENTRE[1] + Math.sin(l) * GALACTIC_ACROSS[1]) + Math.sin(b) * MILKY_WAY_POLE[1],
    c * (Math.cos(l) * GALACTIC_CENTRE[2] + Math.sin(l) * GALACTIC_ACROSS[2]) + Math.sin(b) * MILKY_WAY_POLE[2],
  ]);
}

/** A direction by elevation above the disc's plane and bearing around it, in degrees. */
export function skyDirection(elevation: number, bearing: number): Vec3 {
  const e = radians(elevation);
  const a = radians(bearing);
  return [Math.cos(e) * Math.cos(a), Math.sin(e), Math.cos(e) * Math.sin(a)];
}

/** A local feature: where it is, and how far it reaches (degrees). */
export interface SkySite {
  readonly direction: Vec3;
  readonly radius: number;
}

/**
 * An emission nebula: how much of its hot core glows oxygen-teal (0–1), and its
 * shape — `stretch` squeezes the cloud across its long axis (1 is round, and its
 * `radius` stays the long reach), `turn` is where that axis points, degrees.
 */
export interface SkyNebula extends SkySite {
  readonly oxygen: number;
  readonly stretch: number;
  readonly turn: number;
}

/** A galaxy's light: its old yellow bulge, its arms, and its star-forming knots. */
export interface GalaxyPalette {
  readonly core: Vec3;
  readonly arms: Vec3;
  readonly knots: Vec3;
}

/** The ordinary spiral: yellow bulge, blue arms, pink knots. */
export const SPIRAL_PALETTE: GalaxyPalette = {
  core: [1.0, 0.84, 0.62],
  arms: [0.7, 0.8, 1.0],
  knots: [1.0, 0.45, 0.58],
};

/** A galaxy beyond this one: a disc, so it also has a tilt and a turn. */
export interface SkyGalaxy extends SkySite {
  /** Position angle of the major axis on the sky, degrees. */
  readonly turn: number;
  /** 0 face-on, 90 edge-on. */
  readonly tilt: number;
  /** Surface brightness relative to an ordinary distant galaxy. */
  readonly brightness: number;
  readonly palette: GalaxyPalette;
}

/**
 * THE HERO: A GALAXY BEYOND THIS ONE, HANGING OVER THE PLAYER'S WORLD. Owner:
 * *"görünce ağzım açık kalsın."*
 *
 * A range of lit dust cliffs was built here first and rejected on sight — *"Toz
 * bulutlarını abartma, insanlar kendini uzayda hissetmeli bir yağlı boya
 * tablosunun içinde değil."* A galaxy is the opposite kind of object: crisp,
 * structured, mostly empty space around it, and it is the one thing in a sky that
 * says how far away everything is.
 *
 * BELOW THE WORLDS IN THE HIERARCHY, ALWAYS. At first it was bright and five and a
 * half degrees across, and from a wide camera it sat beside the playfield's own
 * core looking more like "the galaxy" than the galaxy the game is played in —
 * owner: *"oyun alanı olan galaksi belirginliğini kaybediyor."* It is a distant
 * object now: smaller, dimmer, and still crisp.
 *
 * Eleven degrees up and to the RIGHT of the composition view: the whole of it in
 * that frame, clear of the world at its centre, and off the band. Right, because the
 * sky turns and everything in it drifts leftward across a view — so it enters from
 * the upper right and sails over the world rather than leaving as it arrives.
 */
const HERO_OFFSET = radians(11);
const HERO_LEAN = radians(30);
export const SKY_HERO: SkyGalaxy = {
  direction: along(
    VIEW,
    Math.cos(HERO_OFFSET),
    along(SCREEN_UP, Math.cos(HERO_LEAN), SCREEN_RIGHT, Math.sin(HERO_LEAN)),
    Math.sin(HERO_OFFSET),
  ),
  radius: 4.2,
  turn: 32,
  tilt: 66,
  brightness: 1.5,
  palette: SPIRAL_PALETTE,
};

/**
 * THE HERO'S NEIGHBOURS. Owner, 2026-09-25: *"Hero galaksiye benzer bir iki tane
 * daha farklı boyutlarda ve farklı renklerde galaksi çiz."* Each on its own sharp
 * card like the hero, each smaller and dimmer than it, and away from the first
 * frame so the hero keeps that: a blue face-on starburst spiral, and a golden,
 * nearly edge-on disc of old stars with its dust lane.
 */
export const SKY_GALAXY_CARDS: readonly SkyGalaxy[] = [
  SKY_HERO,
  {
    direction: skyDirection(-36, 172),
    radius: 2.8,
    turn: -40,
    tilt: 28,
    brightness: 1.25,
    palette: { core: [1.0, 0.92, 0.82], arms: [0.56, 0.7, 1.0], knots: [1.0, 0.5, 0.72] },
  },
  {
    direction: skyDirection(-18, 30),
    radius: 3.4,
    turn: 12,
    tilt: 80,
    brightness: 1.15,
    palette: { core: [1.0, 0.76, 0.46], arms: [0.98, 0.8, 0.6], knots: [1.0, 0.6, 0.45] },
  },
];

/** A card's edge in texels: ~40 a degree (a phone at DPR 2 shows ~36), in 256s, at most 768. */
export function galaxyCardSize(galaxy: SkyGalaxy): number {
  const span = 2 * HERO_CARD_SPAN * galaxy.radius;
  return Math.min(768, Math.max(256, 256 * Math.ceil((span * 40) / 256)));
}

/**
 * THE PLACES IN THE SKY. Few, and local, on purpose — see point 3 above.
 *
 *   · The big emission complex sits on the band like Carina does, up-frame of the
 *     composition view. The band dives to −70° beyond the bulge, so a second, smaller
 *     one holds the stretch of the ring it leaves, the way Orion sits off the plane.
 *   · The dark cloud is a silhouette on the band just beside the composition view —
 *     against the brightest stretch, the only place a silhouette can be seen.
 *   · The half of the ring the band never reaches gets the rest: a reflection
 *     nebula, a lone emission region, and two more galaxies beyond this one.
 *
 * SMALL, on the owner's word: *"gazlar bir kaç tane görece daha ufak şekiller
 * olarak yine kalabilir ama tüm galaksiyi kaplamamalı."* Together they cover
 * under 3% of the sky (the test adds it up).
 */
export const SKY_SITES = {
  /** The bulge's glow reaches this far; the shader's falloff is derived from it. */
  bulge: { direction: GALACTIC_CENTRE, radius: 14 },
  emission: [
    { direction: bandDirection(52, 2.5), radius: 8, oxygen: 0.8, stretch: 1.3, turn: 20 },
    { direction: skyDirection(-44, 142), radius: 6, oxygen: 0.7, stretch: 1.9, turn: -35 },
    { direction: skyDirection(-40, 12), radius: 6, oxygen: 0.55, stretch: 1, turn: 0 },
    // 2026-09-25: *"sağa sola irili ufaklı birazcık daha dağıt"* — a small deep-red
    // knot of hydrogen, and a larger rose one on the far side of the sky.
    { direction: skyDirection(-30, -82), radius: 4.5, oxygen: 0.12, stretch: 2.3, turn: 65 },
    { direction: skyDirection(-20, 100), radius: 7, oxygen: 0.35, stretch: 1.6, turn: 115 },
  ],
  reflection: [
    { direction: skyDirection(-28, -52), radius: 6 },
    { direction: skyDirection(-52, -160), radius: 4 },
  ],
  dark: { direction: bandDirection(19, 0.4), radius: 3 },
  galaxies: [
    { direction: skyDirection(-27, 58), radius: 3.2, turn: 38, tilt: 64, brightness: 1, palette: SPIRAL_PALETTE },
    { direction: skyDirection(-46, -22), radius: 1.3, turn: -20, tilt: 84, brightness: 1, palette: SPIRAL_PALETTE },
  ],
} as const satisfies {
  bulge: SkySite;
  emission: readonly SkyNebula[];
  reflection: readonly SkySite[];
  dark: SkySite;
  galaxies: readonly SkyGalaxy[];
};

/* ── budgets ────────────────────────────────────────────────── */

/**
 * CUBE FACE EDGE, PER PRESET. 1024 is 24 MB and ~11 texels a degree at the face
 * centre — plenty for gas that was generated without anything sharp in it.
 */
export const SKY_BAKE_SIZE: Record<RenderQuality, number> = {
  high: 1024,
  balanced: 1024,
  low: 512,
};

/**
 * HOW MANY STARS. Owner, on seeing 72,000: *"Çok fazla yıldız var. Arkaplan olarak
 * güzel duruyor ama gerçekten oyun alanı olan galaksi belirginliğini kaybediyor ve
 * cihazımı kastırıyor."* The sky is the backdrop to the worlds, never their rival,
 * and every one of these is a vertex on every frame. A portrait phone sees ~2.4%
 * of the sky, so 16,200 is ~400 in a frame, crowding into the band. (12,000 with
 * the old band share was tried too: the band lost its grain and read as smoke.)
 */
export const SKY_STAR_COUNT: Record<RenderQuality, number> = {
  high: 21_000,
  balanced: 16_200,
  low: 9_700,
};

/**
 * WHO IS WHERE. The band's share came down from 55% with the total — owner,
 * 2026-09-25: *"Yıldız kuşağındaki yıldızlar çok sık. %30 civarı azalt."* — so the
 * band lost a third of its stars and the rest of the sky kept the count it had.
 */
const BAND_SHARE = 0.445;
const CLUSTER_SHARE = 0.037;

/**
 * THE BRIGHTEST THE GAS MAY GET, as linear luminance. Under every bloom threshold
 * that draws this sky (the test reads them), so no cloud ever becomes a light.
 */
export const SKY_LUMINANCE_CEILING = 0.29;

/**
 * THE BAKE, A STRIP AT A TIME. Each cube face is painted in quarters, one quarter a
 * frame, then each galaxy card: 27 frames, under half a second, and no single
 * frame carries more than a quarter of a face. A whole face in one frame was a
 * visible hitch on a phone.
 */
export const SKY_BAKE_STRIPS = 4;
export const SKY_BAKE_STEPS = 6 * SKY_BAKE_STRIPS + SKY_GALAXY_CARDS.length;

export type SkyBakeWork =
  | { readonly kind: 'waiting' }
  | { readonly kind: 'face'; readonly face: number; readonly y: number; readonly rows: number }
  | { readonly kind: 'card'; readonly index: number }
  | { readonly kind: 'done' };

/** What bake step `step` paints, for a cube of `size`. */
export function skyBakeStep(step: number, size: number): SkyBakeWork {
  if (!(step >= 0)) return { kind: 'waiting' };
  if (step >= SKY_BAKE_STEPS) return { kind: 'done' };
  const faces = 6 * SKY_BAKE_STRIPS;
  if (step >= faces) return { kind: 'card', index: step - faces };
  const face = Math.floor(step / SKY_BAKE_STRIPS);
  const strip = step % SKY_BAKE_STRIPS;
  const y = Math.floor((strip * size) / SKY_BAKE_STRIPS);
  const next = Math.floor(((strip + 1) * size) / SKY_BAKE_STRIPS);
  return { kind: 'face', face, y, rows: next - y };
}

/** How far out the sky is drawn. Inside every camera's far plane that shows it. */
export const SKY_RADIUS = 500;

/* ── stars ──────────────────────────────────────────────────── */

/** Stable scenery makes visual regression a comparison, not a new sky each run. */
export function randomStream(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Blackbody colour, sampled along the locus: 2,800 K orange to 15,000 K blue-white.
 * Every stop has green between red and blue, and interpolation keeps it there.
 */
const BLACKBODY: readonly (readonly [number, number, number, number])[] = [
  [2800, 1.0, 0.68, 0.4],
  [3800, 1.0, 0.8, 0.6],
  [5000, 1.0, 0.89, 0.79],
  [6000, 1.0, 0.95, 0.9],
  // The locus passes THROUGH white. Interpolating 6,000 K straight to 7,500 K
  // cuts the corner and dips green below both red and blue — a faint magenta.
  [6600, 1.0, 1.0, 1.0],
  [7500, 0.9, 0.92, 1.0],
  [10000, 0.77, 0.83, 1.0],
  [15000, 0.66, 0.75, 1.0],
];

function blackbody(kelvin: number, out: Float32Array, offset: number): void {
  let i = 0;
  while (i < BLACKBODY.length - 2 && kelvin > BLACKBODY[i + 1]![0]) i += 1;
  const a = BLACKBODY[i]!;
  const b = BLACKBODY[i + 1]!;
  const t = Math.min(1, Math.max(0, (kelvin - a[0]) / (b[0] - a[0])));
  // Photographed stars are pale: the colour is a hint, not a fill.
  const pale = 0.35;
  for (let c = 0; c < 3; c++) {
    const value = a[c + 1]! + (b[c + 1]! - a[c + 1]!) * t;
    out[offset + c] = value + (1 - value) * pale;
  }
}

/** Temperature, weighted the way a real field is: mostly G/K, some A/B, few M. */
function temperature(random: () => number): number {
  const u = random();
  if (u < 0.12) return 2800 + random() * 1000;
  if (u < 0.55) return 3800 + random() * 2200;
  if (u < 0.82) return 6000 + random() * 1500;
  return 7500 + random() * 7500;
}

/** Box–Muller; the band's latitude is a bell, not a slab. */
function gaussian(random: () => number): number {
  const u = Math.max(1e-9, random());
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * random());
}

export interface SkyStars {
  /** Unit directions, three per star. */
  readonly positions: Float32Array;
  /** Linear colour, three per star. */
  readonly colours: Float32Array;
  /** Relative brightness, 0 < flux ≤ 1. */
  readonly flux: Float32Array;
  /** Two per star: shimmer rate (rad/s, 0 = steady) and phase. */
  readonly twinkle: Float32Array;
}

/**
 * HOW DEEP A SHIMMER GOES. Owner: *"bazıları hafif hafif ışıldıyor"*. Space has no
 * air to make stars twinkle, so it is a light touch — a star breathes a little
 * brighter and dimmer, it never blinks.
 */
export const STAR_TWINKLE_DEPTH = 0.32;

/** Dimmest to brightest star. Real fields span far more; this is what a screen holds. */
const FLUX_RANGE = 500;

/**
 * THE STARFIELD, AS A POPULATION.
 *
 *   · 44% belong to the band: longitude uniform, latitude a bell that thickens
 *     toward the bulge — the Milky Way is fattest at its centre.
 *   · 4% are in open clusters, a few dozen stars inside a degree: the small
 *     knots that make a field look found rather than sprayed.
 *   · the rest are uniform, so no part of the sky is ever empty.
 *
 * Brightness follows the Euclidean count law, N(>F) ∝ F^-1.5 — overwhelmingly
 * faint stars and a handful of bright ones.
 */
export function buildSkyStars(count: number, seed: number): SkyStars {
  const random = randomStream(seed);
  const positions = new Float32Array(count * 3);
  const colours = new Float32Array(count * 3);
  const flux = new Float32Array(count);
  const twinkle = new Float32Array(count * 2);

  const clusters = Array.from({ length: 14 }, () => {
    const l = random() * 360 - 180;
    const b = gaussian(random) * 9;
    return { centre: bandDirection(l, b), spread: 0.004 + random() * 0.01 };
  });

  const put = (i: number, x: number, y: number, z: number): void => {
    const length = Math.hypot(x, y, z) || 1;
    positions[i * 3] = x / length;
    positions[i * 3 + 1] = y / length;
    positions[i * 3 + 2] = z / length;
  };

  for (let i = 0; i < count; i++) {
    const population = random();
    if (population < BAND_SHARE) {
      const l = random() * 360 - 180;
      const nearCore = Math.exp(-((l / 70) ** 2));
      const b = gaussian(random) * (4.5 + 7 * nearCore);
      const d = bandDirection(l, b);
      put(i, d[0], d[1], d[2]);
    } else if (population < BAND_SHARE + CLUSTER_SHARE) {
      const cluster = clusters[Math.floor(random() * clusters.length)]!;
      const c = cluster.centre;
      put(
        i,
        c[0] + gaussian(random) * cluster.spread,
        c[1] + gaussian(random) * cluster.spread,
        c[2] + gaussian(random) * cluster.spread,
      );
    } else {
      const z = random() * 2 - 1;
      const theta = random() * Math.PI * 2;
      const r = Math.sqrt(1 - z * z);
      put(i, r * Math.cos(theta), z, r * Math.sin(theta));
    }

    const f = (1 - random()) ** (-1 / 1.5);
    flux[i] = Math.min(FLUX_RANGE, f) / FLUX_RANGE;
    blackbody(temperature(random), colours, i * 3);
    // A shimmer only where it can be seen: about a third of the brighter half.
    if (f >= 2 && random() < 0.38) {
      twinkle[i * 2] = 0.4 + random() * 1.8;
      twinkle[i * 2 + 1] = random() * Math.PI * 2;
    }
  }

  return { positions, colours, flux, twinkle };
}

/* ── deep stars ─────────────────────────────────────────────── */

/**
 * HOW FAR OUT THE DEEP STARS STAND, world units from the galaxy's centre: past the
 * playfield (radius 60), inside the sky sphere. The camera reaches ~250 from the
 * centre, so the near part of this shell is close enough to slide visibly across
 * the far part — and across the sky behind both — on every orbit.
 */
export const SKY_DEEP_STAR_REACH = [110, 400] as const;

/** One vertex each; only the ones in the frustum are rasterised. */
export const SKY_DEEP_STAR_COUNT: Record<RenderQuality, number> = {
  high: 1_600,
  balanced: 1_200,
  low: 700,
};

/**
 * THE STARS THAT MAKE THE SKY DEEP. Owner: *"insanlar kendini uzayda hissetmeli,
 * bir yağlı boya tablosunun içinde değil."*
 *
 * The sky above is at infinity: however it is painted, it never moves against
 * itself, and that is the tell of a backdrop. These stand at real distances, even
 * through the volume, so near ones pass in front of far ones whenever the camera
 * moves. Positions are world coordinates, not directions.
 */
export function buildDeepStars(count: number, seed: number): SkyStars {
  const random = randomStream(seed);
  const [near, far] = SKY_DEEP_STAR_REACH;
  const positions = new Float32Array(count * 3);
  const colours = new Float32Array(count * 3);
  const flux = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    // Uniform by volume: the radius goes as the cube root.
    const r = Math.cbrt(near ** 3 + random() * (far ** 3 - near ** 3));
    const z = random() * 2 - 1;
    const theta = random() * Math.PI * 2;
    const ring = Math.sqrt(1 - z * z);
    positions[i * 3] = r * ring * Math.cos(theta);
    positions[i * 3 + 1] = r * z;
    positions[i * 3 + 2] = r * ring * Math.sin(theta);
    flux[i] = Math.min(FLUX_RANGE, (1 - random()) ** (-1 / 1.5)) / FLUX_RANGE;
    blackbody(temperature(random), colours, i * 3);
  }
  return { positions, colours, flux, twinkle: new Float32Array(count * 2) };
}

/* ── shaders ────────────────────────────────────────────────── */

/**
 * 3D simplex noise — Ian McEwan & Stefan Gustavson, "webgl-noise" (MIT).
 * Returns roughly −1…1. Only ever run by the bake, never per frame.
 */
const SIMPLEX = /* glsl */ `
vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 permute(vec4 x) { return mod289(((x * 34.0) + 10.0) * x); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
float snoise(vec3 v) {
  const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;
  i = mod289(i);
  vec4 p = permute(permute(permute(
    i.z + vec4(0.0, i1.z, i2.z, 1.0)) +
    i.y + vec4(0.0, i1.y, i2.y, 1.0)) +
    i.x + vec4(0.0, i1.x, i2.x, 1.0));
  float n_ = 0.142857142857;
  vec3 ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);
  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0) * 2.0 + 1.0;
  vec4 s1 = floor(b1) * 2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);
  vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
  vec4 m = max(0.5 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
  m = m * m;
  return 105.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
}
`;

const NOISE = /* glsl */ `
float fbm(vec3 p, int octaves) {
  float sum = 0.0;
  float amplitude = 0.5;
  float norm = 0.0;
  for (int i = 0; i < 7; i++) {
    if (i >= octaves) break;
    sum += amplitude * snoise(p);
    norm += amplitude;
    p = p * 2.03 + vec3(3.1, 1.7, 5.3);
    amplitude *= 0.5;
  }
  return sum / norm;
}

/** Sharp crests: the fibrous fronts of real gas, not cotton wool. */
float ridged(vec3 p, int octaves) {
  float sum = 0.0;
  float amplitude = 0.5;
  float norm = 0.0;
  for (int i = 0; i < 7; i++) {
    if (i >= octaves) break;
    float n = 1.0 - abs(snoise(p));
    sum += amplitude * n * n;
    norm += amplitude;
    p = p * 2.07 + vec3(5.9, 2.3, 7.1);
    amplitude *= 0.52;
  }
  return sum / norm;
}

/** Billows: summed |noise| puffs up like cauliflower — what lit dust actually does. */
float billow(vec3 p, int octaves) {
  float sum = 0.0;
  float amplitude = 0.5;
  float norm = 0.0;
  for (int i = 0; i < 7; i++) {
    if (i >= octaves) break;
    sum += amplitude * abs(snoise(p));
    norm += amplitude;
    p = p * 2.11 + vec3(4.3, 6.7, 1.9);
    amplitude *= 0.5;
  }
  return sum / norm;
}

/** 0 at the site's centre, 1 at its nominal edge. */
float reach(vec3 d, vec4 site) {
  return (1.0 - dot(d, site.xyz)) / max(1e-5, 1.0 - site.w);
}
`;

const GALAXY = /* glsl */ `
/**
 * A galaxy beyond this one, in gnomonic sky coordinates round its centre (radii),
 * turned onto its major axis and de-projected by its tilt: a yellow bulge and a
 * sharp nucleus, blue flocculent arms broken into fragments, pink knots of star
 * formation, brown dust between the arms and — seen edge-on — one lane through
 * the middle, confined to the disc.
 */
vec3 galaxyAt(vec2 sky, vec4 shape, float seed, vec3 coreTint, vec3 armTint, vec3 knotTint) {
  vec2 p = mat2(shape.x, shape.y, -shape.y, shape.x) * sky;
  float thin = max(0.06, shape.z);
  vec2 disc = vec2(p.x, p.y / thin);
  float r = length(disc);
  if (r > 1.8) return vec3(0.0);
  float theta = atan(disc.y, disc.x);
  float wind = theta - log(r + 0.04) * 2.4;
  float shred = fbm(vec3(disc * 5.0, seed), 4) * 0.5 + 0.5;
  float arms = pow(0.5 + 0.5 * cos(2.0 * wind + shred * 1.2), 2.0) * (0.55 + 0.9 * shred);
  float lanes = pow(0.5 + 0.5 * cos(2.0 * wind + 1.7 + shred), 6.0) * smoothstep(0.12, 0.35, r);
  float body = exp(-r * 2.9) * smoothstep(1.75, 1.0, r);
  float halo = exp(-r * 1.6) * 0.08 * smoothstep(1.8, 1.2, r);
  float bulge = exp(-r * r * 30.0);
  float nucleus = exp(-r * r * 900.0);
  float knots = pow(max(0.0, snoise(vec3(disc * 13.0, seed + 1.0))), 4.0) * arms * smoothstep(0.2, 0.45, r);
  float grain = 0.7 + 0.6 * (fbm(vec3(disc * 9.0, seed + 3.0), 3) * 0.5 + 0.5);
  vec3 light = coreTint * (bulge * 1.5 + nucleus * 2.5)
    + armTint * body * (0.22 + 1.0 * arms) * grain
    + mix(armTint, vec3(0.85), 0.5) * halo
    + knotTint * knots * body * 2.2;
  light *= 1.0 - clamp(lanes * body * 2.2, 0.0, 0.7);
  // Only a nearly edge-on disc shows one lane straight through; at a moderate tilt
  // a straight lane reads as a scratch across the galaxy.
  float lane = exp(-pow((p.y - 0.03 * (1.0 - thin)) / (0.045 * max(thin, 0.25)), 2.0))
    * pow(1.0 - thin, 3.0) * smoothstep(0.85, 0.25, r);
  light *= 1.0 - clamp(lane * 1.5, 0.0, 0.92);
  return light * 0.06 * shape.w;
}

/** The same galaxy looked up by direction, for the ones baked into the cube. */
vec3 galaxy(vec3 d, vec4 site, vec4 shape, float seed, vec3 coreTint, vec3 armTint, vec3 knotTint) {
  float c = dot(d, site.xyz);
  if (c < 0.98) return vec3(0.0);
  vec3 e1 = normalize(cross(site.xyz, abs(site.y) < 0.9 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0)));
  vec3 e2 = cross(site.xyz, e1);
  return galaxyAt(vec2(dot(d, e1), dot(d, e2)) / (c * site.w), shape, seed, coreTint, armTint, knotTint);
}
`;

export const SKY_BAKE_VERTEX = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

export const SKY_BAKE_FRAGMENT = /* glsl */ `
precision highp float;
#define EMISSION_COUNT ${String(SKY_SITES.emission.length)}
#define REFLECTION_COUNT ${String(SKY_SITES.reflection.length)}
varying vec3 vDir;
uniform vec3 uPole;
uniform vec3 uCentre;
uniform vec3 uAcross;
uniform float uBulge;
uniform vec4 uEmission[EMISSION_COUNT];
uniform float uEmissionOxygen[EMISSION_COUNT];
uniform vec4 uEmissionShape[EMISSION_COUNT];
uniform vec4 uReflection[REFLECTION_COUNT];
uniform vec4 uDark;
uniform vec4 uGalaxy[2];
uniform vec4 uGalaxyShape[2];
uniform vec3 uGalaxyCore[2];
uniform vec3 uGalaxyArms[2];
uniform vec3 uGalaxyKnots[2];
uniform float uCeiling;

${SIMPLEX}

${NOISE}
${GALAXY}

void main() {
  vec3 d = normalize(vDir);

  /* ── the band ── */
  float lat = dot(d, uPole);
  vec3 planar = d - uPole * lat;
  float planarLength = length(planar);
  vec3 onBand = planarLength > 1e-4 ? planar / planarLength : uCentre;
  float cosL = dot(onBand, uCentre);
  float core = pow(max(0.0, 0.5 + 0.5 * cosL), 4.0);

  // A ragged edge: the band is a cloud of stars, not a ruled stripe.
  float b = lat + fbm(d * 2.4 + 7.0, 3) * 0.04;
  float width = 0.075 + 0.11 * core;
  float band = exp(-(b * b) / (width * width));
  float wide = exp(-(b * b) / (width * width * 9.0));
  vec3 q = d * 2.6;
  vec3 warp = vec3(fbm(q + 1.3, 4), fbm(q + 8.1, 4), fbm(q + 4.7, 4));
  /*
    THE BAND'S STRUCTURE RUNS ALONG THE BAND. Star clouds and dust lanes are
    sheared out by the galaxy's rotation, so they are long along the plane and
    thin across it — sampled isotropically they came out as round swirls, which
    read as smoke rather than as a Milky Way.
  */
  vec3 sheared = onBand * 3.2 + uPole * lat * 5.0;
  float starClouds = fbm(sheared * 1.1 + warp * 0.2, 6) * 0.5 + 0.5;
  float grain = fbm(sheared * 6.0 + 5.0, 3) * 0.5 + 0.5;
  float toBulge = (1.0 - dot(d, uCentre)) / uBulge;
  float bulge = exp(-toBulge * 2.2) * exp(-(b * b) / (width * width * 2.2));

  // Star clouds are CLUMPS: bright knots over a thin floor, not an even fog.
  float clumps = smoothstep(0.42, 0.78, starClouds);
  float starlight = band * (0.08 + 1.5 * clumps * clumps) * (0.7 + 0.6 * grain);
  starlight = starlight * (0.3 + 0.7 * core) + wide * 0.035 * (0.35 + 0.65 * core) + bulge * 0.7;
  vec3 warm = vec3(1.0, 0.89, 0.76);
  vec3 cool = vec3(0.78, 0.84, 1.0);
  vec3 colour = mix(cool, warm, clamp(core * 1.1 + bulge, 0.0, 1.0)) * starlight * 0.035;

  /* ── dust across the band ── */
  float laneBand = exp(-pow((lat - 0.008) / (width * 0.95), 2.0));
  // The Great Rift: a lane that follows the midplane, wandering and broken.
  float riftCentre = fbm(onBand * 1.7 + 3.0, 3) * 0.03;
  float rift = exp(-pow((lat - riftCentre) / (0.016 + 0.028 * core), 2.0));
  rift *= smoothstep(-0.3, 0.3, fbm(onBand * 2.4 + 9.0, 3));
  // Dark clouds with fractal edges: one coherent field, frayed by a finer one.
  // (Ridged fibres were tried here and read as marbled paper.)
  float dustClouds = fbm(sheared * 1.4 + warp * 0.25 + 17.0, 6) * 0.5 + 0.5;
  float fray = fbm(sheared * 5.0 + 31.0, 3) * 0.1;
  float tau = laneBand * (rift * 1.5 + smoothstep(0.52, 0.74, dustClouds + fray) * 1.2);
  // The dark cloud: a silhouette torn at every scale, never a disc.
  float darkReach = sqrt(reach(d, uDark)) + fbm(d * 7.0, 3) * 0.35 + fbm(d * 22.0, 4) * 0.28;
  tau += smoothstep(1.0, 0.3, darkReach) * 2.4;

  vec3 transmit = exp(-tau * vec3(0.8, 1.0, 1.32));
  // Dust scatters a little of what it swallows — brown, never black paint.
  vec3 scattered = vec3(0.55, 0.4, 0.28) * (1.0 - exp(-tau * 0.8)) * exp(-tau * 0.6) * starlight * 0.014;
  colour = colour * transmit + scattered;
  float starTransmit = dot(transmit, vec3(0.3, 0.45, 0.25));

  /* ── emission complexes ── */
  for (int i = 0; i < EMISSION_COUNT; i++) {
    vec4 site = uEmission[i];
    if (dot(d, site.xyz) < 0.5) continue;
    // Elliptical reach in the cloud's own tangent frame: x along its long axis.
    vec4 shape = uEmissionShape[i];
    vec3 t1 = normalize(cross(site.xyz, abs(site.y) < 0.9 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0)));
    vec3 t2 = cross(site.xyz, t1);
    vec2 g = vec2(dot(d, t1), dot(d, t2)) / (dot(d, site.xyz) * shape.w);
    g = vec2(shape.x * g.x + shape.y * g.y, -shape.y * g.x + shape.x * g.y);
    g.y *= shape.z;
    float r = dot(g, g);
    if (r > 3.0) continue;
    float seed = float(i) * 17.3;
    float scale = 70.0 / max(4.0, degrees(acos(site.w)));
    vec3 p = d * scale + seed;
    vec3 w = vec3(fbm(p * 0.8, 3), fbm(p * 0.8 + 5.2, 3), fbm(p * 0.8 + 9.7, 3));
    // Distance from the ionising cluster in radii, with a torn outline.
    float edge = sqrt(r) + fbm(p * 0.6 + w * 0.8, 4) * 0.32;
    // A LUMINOUS BODY FIRST: brightest round the cluster and falling away. The
    // structure rides on it; without the falloff it reads as wallpaper.
    float glow = exp(-edge * edge * 3.0);
    if (glow < 0.004) continue;
    float body = fbm(p * 1.2 + w * 1.2, 5) * 0.5 + 0.5;
    float strands = ridged(p * 2.0 + w * 1.6, 5);
    float gas = glow * (0.3 + 0.95 * body * body) + glow * pow(strands, 6.0) * 0.55;

    // Oxygen only where the core is hot enough to ionise it.
    float hot = exp(-edge * edge * 12.0);
    vec3 hydrogen = vec3(0.86, 0.27, 0.34);
    vec3 oxygen = vec3(0.36, 0.74, 0.78);
    // A hydrogen-rich cloud stays red to its heart; an oxygen-rich one turns teal.
    float o3 = uEmissionOxygen[i];
    vec3 heart = mix(mix(hydrogen * 1.25, vec3(0.98, 0.76, 0.78), o3), oxygen, o3 * o3);
    vec3 tint = mix(hydrogen, heart, hot);

    colour += tint * gas * 0.15;
  }

  /* ── reflection nebulae: pale blue veils around young stars ── */
  for (int i = 0; i < REFLECTION_COUNT; i++) {
    float r = reach(d, uReflection[i]);
    if (r < 3.0) {
      vec3 p = d * (48.0 / max(3.0, degrees(acos(uReflection[i].w)))) + 41.0 + float(i) * 13.0;
      vec3 w = vec3(fbm(p, 3), fbm(p + 3.7, 3), fbm(p + 6.1, 3));
      float edge = sqrt(r) + fbm(p * 0.7 + w, 3) * 0.3;
      float glow = exp(-edge * edge * 3.4);
      float veil = fbm(p * 1.4 + w * 2.2, 5) * 0.5 + 0.5;
      colour += vec3(0.4, 0.55, 0.95) * glow * (0.2 + veil * veil * 1.1) * 0.055;
    }
  }

  /* ── galaxies beyond this one ── */
  for (int i = 0; i < 2; i++) {
    colour += galaxy(d, uGalaxy[i], uGalaxyShape[i], 9.0 + float(i) * 6.0, uGalaxyCore[i], uGalaxyArms[i], uGalaxyKnots[i]);
  }

  /* ── cirrus: the faint dust that is everywhere once you look ── */
  vec3 c = d * 2.7 + warp * 0.9;
  float cirrus = pow(max(0.0, (fbm(c, 5) * 0.5 + 0.5) - 0.42) / 0.58, 2.6);
  colour += vec3(0.46, 0.44, 0.47) * cirrus * 0.003;

  float luminance = dot(colour, vec3(0.2126, 0.7152, 0.0722));
  if (luminance > uCeiling) colour *= uCeiling / luminance;
  gl_FragColor = vec4(max(colour, 0.0), clamp(starTransmit, 0.0, 1.0));
}
`;

/**
 * THE HERO GALAXY'S CARD. The cube holds ~11 texels a degree, which is plenty for
 * gas and too soft for the one object meant to be looked at, so the hero is baked
 * once into its own texture and drawn as a card tangent to the sky — which IS the
 * gnomonic plane the galaxy is defined in, so the card is exact, not an
 * approximation of the sphere.
 */
export const HERO_CARD_SPAN = 1.8;

export const GALAXY_BAKE_VERTEX = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

export const GALAXY_BAKE_FRAGMENT = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform vec4 uShape;
uniform float uSpan;
uniform float uSeed;
uniform vec3 uCore;
uniform vec3 uArms;
uniform vec3 uKnots;
${SIMPLEX}
${NOISE}
${GALAXY}
void main() {
  vec2 uv = vUv * 2.0 - 1.0;
  vec3 light = galaxyAt(uv * uSpan, uShape, uSeed, uCore, uArms, uKnots);
  // Nothing at the card's border, so it can never show an edge.
  float border = smoothstep(1.0, 0.86, max(abs(uv.x), abs(uv.y)));
  gl_FragColor = vec4(light * border, 1.0);
}
`;

/**
 * The card's corners on a sphere of `distance`, in the same (e1, e2) frame the
 * shader uses: e1 = centre × up, e2 = centre × e1. Four corners, UV order.
 */
export function heroCardCorners(galaxy: SkyGalaxy, distance: number): Vec3[] {
  const c = galaxy.direction;
  const e1 = normalise(cross(c, Math.abs(c[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0]));
  const e2 = cross(c, e1);
  const half = HERO_CARD_SPAN * Math.tan(radians(galaxy.radius)) * distance;
  const corner = (u: number, v: number): Vec3 => [
    c[0] * distance + (e1[0] * u + e2[0] * v) * half,
    c[1] * distance + (e1[1] * u + e2[1] * v) * half,
    c[2] * distance + (e1[2] * u + e2[2] * v) * half,
  ];
  return [corner(-1, -1), corner(1, -1), corner(-1, 1), corner(1, 1)];
}

export const SKY_VERTEX = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

export const SKY_FRAGMENT = /* glsl */ `
varying vec3 vDir;
uniform samplerCube uSky;
uniform float uOpacity;
void main() {
  vec3 colour = texture(uSky, normalize(vDir)).rgb;
  gl_FragColor = vec4(colour * uOpacity, 1.0);
}
`;

export const STAR_VERTEX = /* glsl */ `
attribute float aFlux;
attribute vec2 aTwinkle;
uniform samplerCube uSky;
uniform float uSkyReady;
uniform float uPixelRatio;
uniform float uTime;
uniform float uTwinkleDepth;
varying vec3 vColour;
varying float vAlpha;
void main() {
  vec3 dir = normalize(position);
  float transmit = mix(1.0, texture(uSky, dir).a, uSkyReady);
  // Two slow sines at an irrational ratio: a breath that never repeats exactly.
  float shimmer = aTwinkle.x > 0.0
    ? 1.0 + uTwinkleDepth * sin(uTime * aTwinkle.x + aTwinkle.y)
        * (0.6 + 0.4 * sin(uTime * aTwinkle.x * 0.37 + aTwinkle.y * 2.1))
    : 1.0;
  float flux = aFlux * transmit * shimmer;
  // asinh stretch, as astrophotography processes it: the faint end stays visible
  // and the bright end does not clip into identical white discs.
  float stretched = asinh(flux * 600.0) / asinh(600.0);
  // Never under two device pixels: a smaller point shimmers as the sky turns.
  float size = (1.05 + 3.9 * pow(stretched, 2.4)) * uPixelRatio;
  gl_PointSize = max(2.0, size);
  // Held back: the sky is the backdrop to the worlds, never their rival.
  vAlpha = clamp(stretched * 0.9, 0.0, 1.0) * min(1.0, size * size / (gl_PointSize * gl_PointSize) + 0.3);
  vColour = color;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

/**
 * The deep stars: the same photometry, but a nearer star is a brighter one — the
 * inverse square, held to a range a screen can show. Not dimmed by the sky's dust:
 * they are in front of it.
 */
export const DEEP_STAR_VERTEX = /* glsl */ `
attribute float aFlux;
uniform float uPixelRatio;
varying vec3 vColour;
varying float vAlpha;
void main() {
  vec4 view = modelViewMatrix * vec4(position, 1.0);
  float distance = max(1.0, -view.z);
  float flux = aFlux * clamp(pow(180.0 / distance, 2.0), 0.25, 2.5);
  float stretched = min(1.0, asinh(flux * 600.0) / asinh(600.0));
  float size = (1.15 + 3.2 * stretched * stretched) * uPixelRatio;
  gl_PointSize = max(2.0, size);
  vAlpha = clamp(stretched * 0.9, 0.0, 1.0) * min(1.0, size * size / (gl_PointSize * gl_PointSize) + 0.3);
  vColour = color;
  gl_Position = projectionMatrix * view;
}
`;

export const STAR_FRAGMENT = /* glsl */ `
varying vec3 vColour;
varying float vAlpha;
void main() {
  vec2 p = gl_PointCoord - vec2(0.5);
  float r2 = dot(p, p) * 4.0;
  float profile = exp(-r2 * 3.2);
  gl_FragColor = vec4(vColour * profile * vAlpha, 1.0);
}
`;
