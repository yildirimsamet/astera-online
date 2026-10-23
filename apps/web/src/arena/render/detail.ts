import type * as THREE from 'three';

/**
 * Levels of detail for ships (plan 14 §14.1, Y3). Distances are in ship lengths: past 8 a
 * ship is under ~160 px tall on a phone and the 8 k level reads the same; past 25 the 2 k one.
 * A level is held for 10 % either side of its edge, so a ship hovering there does not flicker.
 */
const EDGES = [8, 25] as const;
const HOLD = 0.1;
/** Seconds the two levels cross-dissolve: a change of level never pops (plan §0.1). */
export const LOD_FADE = 0.35;

export function lodLevel(current: number, distance: number, levels: number): number {
  let level = 0;
  EDGES.forEach((edge, i) => {
    if (i < levels - 1 && distance > edge * (current > i ? 1 - HOLD : 1 + HOLD)) level = i + 1;
  });
  return level;
}

export interface LodUniforms { lodFade: THREE.IUniform<number>; lodSide: THREE.IUniform<number> }
const DITHERED = new WeakMap<THREE.Material, LodUniforms>();

/**
 * Screen-door dissolve: the incoming level keeps the pixels whose noise is under `lodFade`,
 * the outgoing one the rest, so together they always cover the hull exactly once.
 */
export function injectDither(shader: { fragmentShader: string; uniforms: Record<string, THREE.IUniform> }, uniforms: LodUniforms): void {
  shader.uniforms.lodFade = uniforms.lodFade;
  shader.uniforms.lodSide = uniforms.lodSide;
  shader.fragmentShader = shader.fragmentShader
    .replace('#include <common>', '#include <common>\nuniform float lodFade;\nuniform float lodSide;')
    .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
      if (lodFade < 1.0) {
        float lodNoise = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
        if ((lodSide < 0.5) == (lodNoise >= lodFade)) discard;
      }`);
}

/** Gives a hull material the dissolve; every dithered hull shares one program per material kind. */
export function ditherMaterial<M extends THREE.Material>(material: M): M {
  const uniforms: LodUniforms = { lodFade: { value: 1 }, lodSide: { value: 0 } };
  DITHERED.set(material, uniforms);
  material.onBeforeCompile = shader => { injectDither(shader, uniforms); };
  material.customProgramCacheKey = () => 'ship-lod';
  return material;
}

export function ditherUniforms(material: THREE.Material): LodUniforms | null {
  return DITHERED.get(material) ?? null;
}

interface Level { group: THREE.Object3D; materials: readonly THREE.Material[] }

/** One ship's levels: which is drawn, and the dissolve between two. */
export class ShipDetail {
  level = 0;
  private from = -1;
  private progress = 1;

  constructor(private readonly levels: readonly Level[]) { this.apply(); }

  /** `distance` from the camera in ship lengths. One dissolve finishes before the next begins. */
  update(distance: number, dt: number): void {
    if (this.from >= 0) {
      this.progress = Math.min(1, this.progress + dt / LOD_FADE);
      if (this.progress >= 1) this.from = -1;
    } else {
      const target = lodLevel(this.level, distance, this.levels.length);
      if (target !== this.level) { this.from = this.level; this.level = target; this.progress = 0; }
    }
    this.apply();
  }

  private apply(): void {
    this.levels.forEach(({ group, materials }, i) => {
      const incoming = i === this.level; const outgoing = i === this.from;
      group.visible = incoming || outgoing;
      for (const material of materials) {
        const uniforms = DITHERED.get(material);
        if (!uniforms) continue;
        uniforms.lodFade.value = incoming && this.from < 0 ? 1 : this.progress;
        uniforms.lodSide.value = outgoing ? 1 : 0;
      }
    });
  }
}
