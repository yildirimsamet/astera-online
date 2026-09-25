/**
 * A SHOOTING STAR, AS A PATH IN TIME. Owner, 2026-09-25: *"Laglı gibi kayıyorlar.
 * Daha güzel olsun arkasında sönen ışık bırakıyor gibi olsun."*
 *
 * IT NEVER STOPS. The head flies from where it spawned at one speed for its whole
 * visible life, its trail — the stretch of path it has just crossed — following at
 * full length. It flares in, burns, and then FADES WHILE STILL FLYING until there
 * is nothing left; only then is the slot free. The first version stopped the head
 * where it burnt out and shrank the trail into it, and the owner's reading of that
 * was exact: *"bir noktaya çarpmış takılı kalmış ve sönmeye başlamış gibi."*
 *
 * The trail's own fade — bright at the head, gone at the tail — is the ribbon's
 * gradient (`METEOR_RIBBON_FRAGMENT`), so the light it leaves behind it is always
 * dying away, and the whole streak dims together as it goes.
 *
 * Pure, so the streak's behaviour is a test rather than an impression, and so the
 * renderer only ever reads positions and light off it.
 */

export type Vec3 = readonly [number, number, number];

export interface MeteorPath {
  readonly from: Vec3;
  /** Unit vector. */
  readonly direction: Vec3;
  /** World units a second. */
  readonly speed: number;
  /** The longest the trail gets, world units. */
  readonly length: number;
  /** Seconds it burns at full brightness, after flaring in and before it fades. */
  readonly life: number;
}

export interface MeteorTrail {
  readonly head: [number, number, number];
  readonly tail: [number, number, number];
  /** 0–1: the burning head. */
  readonly headLight: number;
  /** 0–1: the trail behind it. */
  readonly trailLight: number;
}

/** Seconds it takes to fade away after its life, still flying. */
export const METEOR_FADE = 0.8;

/** Seconds it takes to flare in. */
const METEOR_RISE = 0.12;

/** Where the streak is and how bright, `age` seconds in; null before or after it. */
export function meteorTrail(path: MeteorPath, age: number): MeteorTrail | null {
  if (!(age >= 0) || age > path.life + METEOR_FADE) return null;
  const at = (s: number): [number, number, number] => [
    path.from[0] + path.direction[0] * s,
    path.from[1] + path.direction[1] * s,
    path.from[2] + path.direction[2] * s,
  ];
  const travelled = path.speed * age;
  const rising = Math.min(1, age / METEOR_RISE);
  const fading = age <= path.life ? 0 : (age - path.life) / METEOR_FADE;
  const light = rising * rising * (3 - 2 * rising) * (1 - fading) ** 1.6;
  return {
    head: at(travelled),
    tail: at(Math.max(0, travelled - path.length)),
    headLight: light,
    trailLight: light,
  };
}

/* ── how it is drawn ────────────────────────────────────────── */

/**
 * THE TRAIL, AS A RIBBON WITH A REAL WIDTH. It used to be a GL line — one pixel
 * wide everywhere, hard-edged, the same thickness at the head as at the tail. Each
 * streak is a quad now, expanded across itself in SCREEN space so it keeps its
 * width at any distance: a hair at the tail, a couple of pixels at the head.
 */
export const METEOR_RIBBON_VERTEX = /* glsl */ `
attribute vec3 aOther;
attribute float aAlong;
attribute float aSide;
attribute vec2 aLight;
uniform vec2 uResolution;
uniform float uPixelRatio;
varying float vAlong;
varying float vSide;
varying vec2 vLight;
void main() {
  vec4 clip = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  vec4 other = projectionMatrix * modelViewMatrix * vec4(aOther, 1.0);
  /*
    NOTHING HERE MAY PRODUCE A NaN. One NaN pixel in the half-float scene target
    is spread by bloom's mip chain into black blocks across half the screen — which
    is exactly what the first version of this did whenever a trail's far end came
    near the camera plane (w → 0, so the divide overflowed). Both ends must be well
    in front of the eye, and the span must be a real, finite length.
  */
  vec2 across = vec2(0.0, 1.0);
  if (clip.w > 0.01 && other.w > 0.01) {
    vec2 along = (other.xy / other.w - clip.xy / clip.w) * uResolution;
    float span = length(along);
    if (span > 1e-3 && span < 1e6) across = vec2(-along.y, along.x) / span;
  }
  float width = mix(0.35, 2.1, aAlong * aAlong) * uPixelRatio;
  clip.xy += across * aSide * width / uResolution * clip.w;
  gl_Position = clip;
  vAlong = aAlong;
  vSide = aSide;
  vLight = aLight;
}
`;

export const METEOR_RIBBON_FRAGMENT = /* glsl */ `
varying float vAlong;
varying float vSide;
varying vec2 vLight;
void main() {
  // Interpolation can land a hair below zero at the tail, and pow() of a negative
  // is a NaN — see the vertex shader for what one NaN does to this scene.
  float along = clamp(vAlong, 0.0, 1.0);
  float side = clamp(vSide, -1.0, 1.0);
  float glow = max(vLight.y, 0.0) * pow(along, 1.5) * (1.0 - side * side);
  // White-hot at the head, cooling to a warm train behind it.
  vec3 colour = mix(vec3(0.98, 0.68, 0.42), vec3(1.0, 0.96, 0.9), pow(along, 4.0) * (0.35 + 0.65 * clamp(vLight.x, 0.0, 1.0)));
  gl_FragColor = vec4(colour * glow * 0.9, 1.0);
}
`;

/** The burning head: a small hot core with a halo, bright enough to bloom. */
export const METEOR_HEAD_VERTEX = /* glsl */ `
attribute float aLight;
uniform float uPixelRatio;
varying float vLight;
void main() {
  vLight = aLight;
  gl_PointSize = (3.0 + 7.0 * aLight) * uPixelRatio;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

export const METEOR_HEAD_FRAGMENT = /* glsl */ `
varying float vLight;
void main() {
  vec2 p = gl_PointCoord - vec2(0.5);
  float r2 = dot(p, p) * 4.0;
  float light = exp(-r2 * 9.0) * 1.6 + exp(-r2 * 2.5) * 0.35;
  gl_FragColor = vec4(vec3(0.92, 0.96, 1.0) * light * vLight, 1.0);
}
`;
