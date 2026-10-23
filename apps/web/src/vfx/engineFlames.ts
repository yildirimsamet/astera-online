import { AdditiveBlending, BackSide, BoxGeometry, DynamicDrawUsage, InstancedBufferAttribute,
  InstancedMesh, ShaderMaterial, Vector3, Vector4, type Matrix4, type Texture } from 'three';
import recipes from '../../../../assets/source/engine-flames/recipes.json';
import { engineFlameFragment, engineFlameVertex } from './engineFlameShaders.js';

export const ENGINE_FLAME_VARIANTS = ['solar', 'cryo', 'vacuum', 'siege'] as const;
export type EngineFlameVariant = typeof ENGINE_FLAME_VARIANTS[number];
export const ENGINE_FLAME_RECIPES = recipes;
export const ENGINE_FLAME_NOISE_URL = '/assets/vfx/engine-flames/flow-noise.png';

export interface EngineFlameOptions {
  variant: EngineFlameVariant;
  /** Local nozzle transform; +Z is the ship's nose, exhaust goes towards −Z. */
  matrix: Matrix4;
  length: number;
  nozzleRadius: number;
  throttle: number;
  seed: number;
}

/** Shared geometry/material, including mixed palettes: one draw for a whole fleet.
 * Set transforms/throttle when they change; update only the absolute clock per frame.
 * The caller supplies a repeating linear noise texture and retains ownership of it.
 */
export class EngineFlameBatch {
  readonly mesh: InstancedMesh<BoxGeometry, ShaderMaterial>;
  private readonly flame: InstancedBufferAttribute;
  private readonly dimensions: InstancedBufferAttribute;
  private disposed = false;

  constructor(noise: Texture, { capacity = 1, quality = 'standard' }: {
    capacity?: number; quality?: 'mobile' | 'standard' | 'high';
  } = {}) {
    if (!Number.isInteger(capacity) || capacity < 1 || capacity > 65536) throw new RangeError('Invalid flame capacity');
    const geometry = new BoxGeometry(2, 2, 1).translate(0, 0, -.5);
    this.flame = new InstancedBufferAttribute(new Float32Array(capacity * 4), 4).setUsage(DynamicDrawUsage);
    this.dimensions = new InstancedBufferAttribute(new Float32Array(capacity * 2).fill(1), 2).setUsage(DynamicDrawUsage);
    geometry.setAttribute('aFlame', this.flame);
    geometry.setAttribute('aDimensions', this.dimensions);
    const styles = ENGINE_FLAME_VARIANTS.map(id => recipes[id]);
    const peaks = styles.map(style => {
      let peak = .18;
      for (let i = 0; i <= 100; i++) {
        const t = i / 100;
        peak = Math.max(peak, (.18 + style.expansion * t ** style.rise) * (1 - t) ** style.taper);
      }
      return peak;
    });
    const material = new ShaderMaterial({
      name: 'astera-engine-flames',
      defines: { FLAME_STEPS: quality === 'mobile' ? 8 : quality === 'high' ? 20 : 12 },
      uniforms: {
        uNoise: { value: noise }, uTime: { value: 0 },
        uShape: { value: styles.map(s => new Vector4(s.expansion, s.taper, s.shock, s.turbulence)) },
        uPeak: { value: peaks }, uFlow: { value: styles.map(s => new Vector4(s.speed, s.cells, s.rise, s.sheathGain)) },
        uHot: { value: styles.map(s => new Vector3(s.hot[0], s.hot[1], s.hot[2])) },
        uBody: { value: styles.map(s => new Vector3(s.body[0], s.body[1], s.body[2])) },
        uTail: { value: styles.map(s => new Vector3(s.tail[0], s.tail[1], s.tail[2])) },
        uSheath: { value: styles.map(s => new Vector3(s.sheath[0], s.sheath[1], s.sheath[2])) },
      },
      vertexShader: engineFlameVertex, fragmentShader: engineFlameFragment,
      transparent: true, depthTest: true, depthWrite: false, blending: AdditiveBlending,
      side: BackSide, forceSinglePass: true, toneMapped: false,
    });
    this.mesh = new InstancedMesh(geometry, material, capacity);
    this.mesh.name = 'astera-engine-flames';
    this.mesh.instanceMatrix.setUsage(DynamicDrawUsage);
    this.mesh.count = 0;
    // A small volume budget is more useful than re-walking moving instances each frame.
    // Callers can spatially group batches and control mesh.visible at their own LOD boundary.
    this.mesh.frustumCulled = false;
    this.mesh.raycast = () => undefined;
  }

  set(index: number, options: EngineFlameOptions): void {
    this.assertAlive();
    if (!Number.isInteger(index) || index < 0 || index >= this.flame.count) throw new RangeError('Invalid flame slot');
    const { variant, matrix, length, nozzleRadius, throttle, seed } = options;
    if (!Number.isFinite(length) || !Number.isFinite(nozzleRadius) || !Number.isFinite(throttle) || !Number.isFinite(seed)
      || length <= 0 || nozzleRadius <= 0 || Math.abs(matrix.determinant()) < 1e-12) {
      throw new RangeError('Flame needs finite values, positive dimensions and an invertible transform');
    }
    for (const element of matrix.elements) if (!Number.isFinite(element)) throw new RangeError('Non-finite flame transform');
    const style = ENGINE_FLAME_VARIANTS.indexOf(variant);
    if (style < 0) throw new RangeError('Unknown flame variant');
    this.flame.setXYZW(index, style, Math.max(0, Math.min(1, throttle)), seed % 4096, 0);
    this.dimensions.setXY(index, nozzleRadius, length);
    this.mesh.setMatrixAt(index, matrix);
    this.mesh.count = Math.max(this.mesh.count, index + 1);
    this.flame.needsUpdate = true;
    this.dimensions.needsUpdate = true;
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  update(seconds: number): void {
    this.assertAlive();
    if (!Number.isFinite(seconds) || seconds < 0) throw new RangeError('Invalid flame clock');
    this.mesh.material.uniforms.uTime!.value = seconds;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.mesh.dispose();
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
  }

  private assertAlive(): void {
    if (this.disposed) throw new Error('Flame batch has been disposed');
  }
}
