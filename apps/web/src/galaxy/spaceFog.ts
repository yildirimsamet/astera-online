import { VIEW, toWorld, type SensorSphere } from '@astera/rules';

/**
 * THE SOFT OUTER FOG, ITS NUMBERS AND ITS GEOMETRY. Owner's lab choice, 2026-11-14:
 * soft fade, density 0.025, a transition of exactly 38 game units
 * (`docs/teleskop-yumusak-sis-gelistirme-plani-2026-11-14.md`).
 *
 * Space outside every identifying sensor volume carries a thin haze; space inside
 * does not. The fog only DESCRIBES the edge of live knowledge. What a player may
 * read is decided by the server's projection, never by this file.
 *
 * ONE PLACE FOR THE NUMBERS. The shader, the tests and the notes all read `FOG`;
 * a second copy of 0.025 or 38 is how the look quietly stops being the one chosen.
 *
 * THE GEOMETRY BELOW IS THE SAME ARITHMETIC AS THE SHADER, in plain code, so it can
 * be tested to the digit. The shader cannot be unit tested; this can.
 */

export const FOG = {
  /** The lab's density parameter. It enters the opacity formula; it is not a screen-wide 2.5 % veil. */
  density: 0.025,
  /** The width of the soft edge, outward from a volume's surface, in GAME units. */
  transitionGameUnits: 38,
  /** The same width in scene units, through the shared scale (38 / 50 = 0.76). */
  transition: 38 / VIEW.scale,
  /** Opacity is `1 − exp(−column × density × OPACITY_GAIN)`; the lab's constant. */
  opacityGain: 0.065,
  /**
   * How far a camera ray is followed through the fog, in scene units. A ray that
   * ends in empty sky is not allowed to travel for ever, and one that ends on a
   * far world is cut here too. 60 is the lab's own limit, which the owner approved the look at; the disc is 40 scene units across its radius.
   */
  rayLimit: 60,
} as const;

/** The shader's fixed array size. A commander owns a capital and three colonies; eight is slack. */
export const MAX_FOG_SPHERES = 8;

/** How many equally spaced radii the soft edge is averaged over. Matches the shader's loop. */
export const SOFT_STEPS = 4;

type Vec3 = readonly [number, number, number];

export interface FogSphere {
  centre: Vec3;
  /** Scene units. */
  radius: number;
}

/**
 * The open volumes: one per sensor, as `identify` spheres in scene units.
 *
 * IDENTIFY, NOT DETECT. The radar range is where a contact is noticed, never where
 * the sky is open; the naked eye's free neighbourhood already arrives as an
 * `identify`. Anything that is not a positive finite number opens nothing, an
 * identical sphere is drawn once, and past the shader's capacity the widest win.
 */
export function fogSpheres(posts: readonly Pick<SensorSphere, 'at' | 'identify'>[]): FogSphere[] {
  const seen = new Set<string>();
  const spheres: FogSphere[] = [];
  for (const post of posts) {
    if (!Number.isFinite(post.identify) || post.identify <= 0) continue;
    const centre = toWorld(post.at);
    if (!centre.every(Number.isFinite)) continue;
    const radius = post.identify / VIEW.scale;
    const key = `${centre.join(',')}|${String(radius)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    spheres.push({ centre, radius });
  }
  return spheres.sort((a, b) => b.radius - a.radius).slice(0, MAX_FOG_SPHERES);
}

/** The stretch of the ray, in [0, reach], that lies inside one sphere (null when it misses or only touches). */
function chord(origin: Vec3, direction: Vec3, reach: number, sphere: FogSphere, pad: number): [number, number] | null {
  const radius = sphere.radius + pad;
  const ox = origin[0] - sphere.centre[0];
  const oy = origin[1] - sphere.centre[1];
  const oz = origin[2] - sphere.centre[2];
  const b = ox * direction[0] + oy * direction[1] + oz * direction[2];
  const discriminant = b * b - (ox * ox + oy * oy + oz * oz - radius * radius);
  if (discriminant <= 0) return null;
  const half = Math.sqrt(discriminant);
  const from = Math.max(0, -b - half);
  const to = Math.min(reach, -b + half);
  return to > from ? [from, to] : null;
}

/**
 * HOW MUCH OF THE RAY, UP TO `reach`, LIES OUTSIDE EVERY SPHERE (each grown by `pad`).
 *
 * The covered stretches are MERGED before they are subtracted. Two volumes that
 * cross cover their overlap once; taking each chord off separately would count the
 * overlap twice and leave a dark seam, which is exactly what a union is for.
 */
export function outsideLength(
  origin: Vec3,
  direction: Vec3,
  reach: number,
  spheres: readonly FogSphere[],
  pad = 0,
): number {
  const spans: [number, number][] = [];
  for (const sphere of spheres) {
    const span = chord(origin, direction, reach, sphere, pad);
    if (span) spans.push(span);
  }
  spans.sort((a, b) => a[0] - b[0]);
  let covered = 0;
  let edge = 0;
  for (const [from, to] of spans) {
    const start = Math.max(from, edge);
    if (to > start) { covered += to - start; edge = to; }
  }
  return reach - covered;
}

/**
 * THE FOGGED LENGTH WITH THE SOFT EDGE, WITHOUT SAMPLING THE EDGE.
 *
 * A linear ramp from 0 at a volume's surface to 1 at 38 game units out is the same
 * thing as the average, over thresholds s in [0, 1], of "outside the volume grown by
 * s × 38". Each of those is an exact ray–sphere union, so the soft edge costs a few
 * analytic intersections and none of the banding a stepped ray would show where the
 * edge is thinner than a step. The thresholds sit at the middle of equal strips.
 */
export function foggedLength(
  origin: Vec3,
  direction: Vec3,
  reach: number,
  spheres: readonly FogSphere[],
): number {
  let total = 0;
  for (let step = 0; step < SOFT_STEPS; step += 1) {
    total += outsideLength(origin, direction, reach, spheres, FOG.transition * (step + 0.5) / SOFT_STEPS);
  }
  return total / SOFT_STEPS;
}

/**
 * HOW FOGGED A SURFACE THE CAMERA SEES IS: 0 inside an open volume, 1 beyond the
 * soft edge, a straight ramp between. A live object is never veiled from in front,
 * whichever side of the volume the camera is on.
 */
export function surfaceClearance(point: Vec3, spheres: readonly FogSphere[]): number {
  let nearest = Number.POSITIVE_INFINITY;
  for (const sphere of spheres) {
    const away = Math.hypot(point[0] - sphere.centre[0], point[1] - sphere.centre[1], point[2] - sphere.centre[2]);
    nearest = Math.min(nearest, away - sphere.radius);
  }
  return Math.min(1, Math.max(0, nearest / FOG.transition));
}
