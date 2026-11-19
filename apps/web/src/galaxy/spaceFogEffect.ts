import * as THREE from 'three';
import { BlendFunction, Effect, EffectAttribute } from 'postprocessing';
import type { SensorSphere } from '@astera/rules';
import { paintRadiationVolume } from './radiationVolume.js';
import { FOG, MAX_FOG_SPHERES, SOFT_STEPS, fogSpheres, type FogSphere } from './spaceFog.js';

/**
 * THE OPEN SPHERES, HANDED FROM THE GALAXY TO THE EFFECT, ONE LIST PER CANVAS.
 *
 * The effect lives inside the composer, which the scene rebuilds on a resolution or a restored
 * context; the sensors live in the screen. They meet at the CAMERA: every canvas has its own, and the
 * composer hands that camera to the effect. A single shared list was the first draft and it was wrong
 * in a way that is easy to miss: the target-map preview and the galleries are galaxies too, and one of
 * them mounting or unmounting would have cleared the real map's fog. No entry means "no data yet",
 * which fogs nothing, so a first frame never veils a map whose eyes have not arrived.
 */
interface Open { spheres: readonly FogSphere[]; version: number }
const open = new WeakMap<THREE.Camera, Open>();
let versions = 0;
export const fogSource = {
  set(camera: THREE.Camera, posts: readonly Pick<SensorSphere, 'at' | 'identify'>[] | null): void {
    if (posts === null) open.delete(camera);
    else open.set(camera, { spheres: fogSpheres(posts), version: versions += 1 });
  },
  read: (camera: THREE.Camera | null): Open | undefined => (camera ? open.get(camera) : undefined),
};

/** Where the drift clock turns over: long enough to never repeat visibly, short enough for float precision. */
const CLOCK_WRAP = 2000;
/** The lab's fog colour, linear RGB. */
const COLOUR = new THREE.Color().setRGB(0.105, 0.15, 0.2, THREE.LinearSRGBColorSpace);

const fragment = /* glsl */ `
  uniform sampler3D uDensityTex;
  uniform vec4 uSphere[${String(MAX_FOG_SPHERES)}];
  uniform int uCount;
  uniform float uTransition;
  uniform float uDensity;
  uniform float uGain;
  uniform float uLimit;
  uniform float uTime;
  uniform vec3 uColour;
  uniform mat4 uProjInv;
  uniform mat4 uCamWorld;

  // The length of the ray [0, reach] outside every sphere grown by pad. Covered stretches are merged
  // before they are taken off, so two crossing volumes are open once, not twice.
  float outsideLength(vec3 origin, vec3 dir, float reach, float pad) {
    float from[${String(MAX_FOG_SPHERES)}];
    float to[${String(MAX_FOG_SPHERES)}];
    int n = 0;
    for (int s = 0; s < ${String(MAX_FOG_SPHERES)}; s++) {
      if (s >= uCount) break;
      vec3 o = origin - uSphere[s].xyz;
      float r = uSphere[s].w + pad;
      float b = dot(o, dir);
      float disc = b * b - (dot(o, o) - r * r);
      if (disc <= 0.0) continue;
      float half_ = sqrt(disc);
      float a = max(0.0, -b - half_);
      float z = min(reach, -b + half_);
      if (z <= a) continue;
      int at = n;
      for (int k = 0; k < ${String(MAX_FOG_SPHERES)}; k++) {
        if (k >= n) break;
        if (from[k] > a) { at = k; break; }
      }
      for (int k = ${String(MAX_FOG_SPHERES - 1)}; k > 0; k--) {
        if (k > n || k <= at) continue;
        from[k] = from[k - 1];
        to[k] = to[k - 1];
      }
      from[at] = a;
      to[at] = z;
      n++;
    }
    float covered = 0.0;
    float edge = 0.0;
    for (int k = 0; k < ${String(MAX_FOG_SPHERES)}; k++) {
      if (k >= n) break;
      float start = max(from[k], edge);
      if (to[k] > start) { covered += to[k] - start; edge = to[k]; }
    }
    return reach - covered;
  }

  // The soft edge: the mean of outsideLength over equal strips of the transition, which is the
  // integral of a linear 0 -> 1 ramp across it.
  float foggedLength(vec3 origin, vec3 dir, float reach) {
    float total = 0.0;
    for (int i = 0; i < ${String(SOFT_STEPS)}; i++) {
      total += outsideLength(origin, dir, reach, uTransition * (float(i) + 0.5) / ${SOFT_STEPS.toFixed(1)});
    }
    return total / ${SOFT_STEPS.toFixed(1)};
  }

  float surfaceClearance(vec3 point) {
    float nearest = 1.0e9;
    for (int s = 0; s < ${String(MAX_FOG_SPHERES)}; s++) {
      if (s >= uCount) break;
      nearest = min(nearest, distance(point, uSphere[s].xyz) - uSphere[s].w);
    }
    return clamp(nearest / uTransition, 0.0, 1.0);
  }

  void mainImage(const in vec4 inputColor, const in vec2 uv, const in float depth, out vec4 outputColor) {
    outputColor = inputColor;
    if (uCount == 0) return;
    vec4 view = uProjInv * vec4(uv * 2.0 - 1.0, depth * 2.0 - 1.0, 1.0);
    view /= view.w;
    vec3 world = (uCamWorld * view).xyz;
    vec3 origin = uCamWorld[3].xyz;
    vec3 delta = world - origin;
    float dist = length(delta);
    vec3 dir = delta / max(dist, 1.0e-5);
    bool sky = depth >= 0.99999;
    float reach = sky ? uLimit : min(dist, uLimit);
    float fogged = foggedLength(origin, dir, reach);
    if (fogged <= 0.0) return;

    // Six samples of the shared density volume along the foggy ray: the shape of the haze, anchored in
    // the world and mirrored at the edge of the volume so it has no seam.
    float density = 0.0;
    vec3 drift = vec3(0.002, -0.001, 0.001) * uTime;
    for (int i = 0; i < 6; i++) {
      vec3 p = origin + dir * reach * ((float(i) + 0.5) / 6.0);
      density += 0.22 + 0.78 * texture(uDensityTex, p * 0.045 + drift).r;
    }
    density /= 6.0;

    // A live object is never veiled from in front, whichever side of the volume the camera is on.
    float clear = sky ? 1.0 : surfaceClearance(world);
    float alpha = (1.0 - exp(-fogged * density * uDensity * uGain)) * clear;
    outputColor.rgb = mix(inputColor.rgb, uColour, alpha);
  }
`;

/**
 * THE SOFT OUTER FOG. One full-screen pass, merged into the composer's existing one, reading the depth
 * the composer already holds: no second scene, no extra target. See `spaceFog.ts` for the numbers and
 * the geometry, and the plan in `docs/teleskop-yumusak-sis-gelistirme-plani-2026-11-14.md`.
 */
export class SpaceFogEffect extends Effect {
  private camera: THREE.Camera | null = null;
  private applied: Open | undefined;
  private readonly spheres = Array.from({ length: MAX_FOG_SPHERES }, () => new THREE.Vector4());
  private readonly volume = paintRadiationVolume();

  constructor() {
    super('SpaceFog', fragment, {
      blendFunction: BlendFunction.SET,
      attributes: EffectAttribute.DEPTH,
      uniforms: new Map<string, THREE.Uniform>([]),
    });
    this.volume.wrapS = this.volume.wrapT = this.volume.wrapR = THREE.MirroredRepeatWrapping;
    this.volume.needsUpdate = true;
    const uniforms = this.uniforms;
    uniforms.set('uDensityTex', new THREE.Uniform(this.volume));
    uniforms.set('uSphere', new THREE.Uniform(this.spheres));
    uniforms.set('uCount', new THREE.Uniform(0));
    uniforms.set('uTransition', new THREE.Uniform(FOG.transition));
    uniforms.set('uDensity', new THREE.Uniform(FOG.density));
    uniforms.set('uGain', new THREE.Uniform(FOG.opacityGain));
    uniforms.set('uLimit', new THREE.Uniform(FOG.rayLimit));
    uniforms.set('uTime', new THREE.Uniform(0));
    uniforms.set('uColour', new THREE.Uniform(new THREE.Vector3(COLOUR.r, COLOUR.g, COLOUR.b)));
    uniforms.set('uProjInv', new THREE.Uniform(new THREE.Matrix4()));
    uniforms.set('uCamWorld', new THREE.Uniform(new THREE.Matrix4()));
  }

  override set mainCamera(camera: THREE.Camera) {
    this.camera = camera;
  }

  override update(_renderer: THREE.WebGLRenderer, _input: THREE.WebGLRenderTarget, deltaTime: number): void {
    const u = this.uniforms;
    if (this.camera) {
      (u.get('uProjInv')?.value as THREE.Matrix4).copy(this.camera.projectionMatrixInverse);
      (u.get('uCamWorld')?.value as THREE.Matrix4).copy(this.camera.matrixWorld);
    }
    const clock = u.get('uTime');
    if (clock) {
      const step = Number.isFinite(deltaTime) && deltaTime > 0 ? deltaTime : 0;
      clock.value = ((clock.value as number) + step) % CLOCK_WRAP;
    }
    const wanted = fogSource.read(this.camera);
    if (wanted?.version !== this.applied?.version) {
      this.applied = wanted;
      const list = wanted?.spheres ?? [];
      list.forEach((sphere, index) => { this.spheres[index]?.set(...sphere.centre, sphere.radius); });
      const count = u.get('uCount');
      if (count) count.value = list.length;
    }
  }

  override dispose(): void {
    this.volume.dispose();
    super.dispose();
  }
}
