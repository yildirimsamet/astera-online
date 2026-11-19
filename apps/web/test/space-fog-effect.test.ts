import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { VIEW } from '@astera/rules';
import { FOG, MAX_FOG_SPHERES, SOFT_STEPS } from '../src/galaxy/spaceFog.js';
import { SpaceFogEffect, fogSource } from '../src/galaxy/spaceFogEffect.js';

const raw = (effect: SpaceFogEffect, name: string): unknown => {
  const found = effect.uniforms.get(name);
  if (!found) throw new Error(`no uniform ${name}`);
  return found.value;
};
const number = (effect: SpaceFogEffect, name: string): number => raw(effect, name) as number;
const matrix = (effect: SpaceFogEffect, name: string): THREE.Matrix4 => raw(effect, name) as THREE.Matrix4;
const vectors = (effect: SpaceFogEffect, name: string): THREE.Vector4[] => raw(effect, name) as THREE.Vector4[];
const volume = (effect: SpaceFogEffect): THREE.Data3DTexture => raw(effect, 'uDensityTex') as THREE.Data3DTexture;

describe('the fog effect reads the chosen look from the one place that states it', () => {
  it('carries density 0.025 and the 38 game unit transition in scene units', () => {
    const effect = new SpaceFogEffect();
    expect(number(effect, 'uDensity')).toBe(0.025);
    expect(number(effect, 'uTransition')).toBeCloseTo(38 / VIEW.scale, 12);
    expect(number(effect, 'uLimit')).toBe(FOG.rayLimit);
    effect.dispose();
  });

  it('sizes the shader from the same constants as the geometry', () => {
    const effect = new SpaceFogEffect();
    const source = effect.getFragmentShader();
    expect(source).toContain(`vec4 uSphere[${String(MAX_FOG_SPHERES)}]`);
    expect(source).toContain(`i < ${String(SOFT_STEPS)}`);
    effect.dispose();
  });

  it('asks for the depth buffer, which is how a pixel finds its place in space', () => {
    const effect = new SpaceFogEffect();
    expect(effect.getAttributes() & 1).toBe(1);
    effect.dispose();
  });
});

describe('the spheres the fog opens', () => {
  const sphere = (x: number, identify: number) => ({ at: { x, y: 0, z: 0 }, identify });

  it('starts with fog off: no data is not the same as an empty sky', () => {
    const effect = new SpaceFogEffect();
    expect(number(effect, 'uCount')).toBe(0);
    effect.dispose();
  });

  it('is fed from the shared source and counts what it was given', () => {
    const effect = new SpaceFogEffect();
    fogSource.set([sphere(100, 250), sphere(500, 80)]);
    effect.update(null as never, null as never, 0.016);
    expect(number(effect, 'uCount')).toBe(2);
    const first = vectors(effect, 'uSphere')[0]!;
    expect(first.w).toBeCloseTo(250 / VIEW.scale, 12);
    expect(first.x).toBeCloseTo(100 / VIEW.scale, 12);
    fogSource.set(null);
    effect.update(null as never, null as never, 0.016);
    expect(number(effect, 'uCount')).toBe(0);
    effect.dispose();
  });

  it('never holds more than the shader has room for', () => {
    const effect = new SpaceFogEffect();
    fogSource.set(Array.from({ length: MAX_FOG_SPHERES + 4 }, (_, index) => sphere(index * 900, 100 + index)));
    effect.update(null as never, null as never, 0.016);
    expect(number(effect, 'uCount')).toBe(MAX_FOG_SPHERES);
    fogSource.set(null);
    effect.dispose();
  });
});

describe('the camera and the clock', () => {
  it('copies the camera it is given on every frame, so rays follow the real view', () => {
    const effect = new SpaceFogEffect();
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 600);
    camera.position.set(3, 4, 5);
    camera.updateMatrixWorld(true);
    effect.mainCamera = camera;
    effect.update(null as never, null as never, 0.016);
    expect(matrix(effect, 'uCamWorld').elements.slice(12, 15)).toEqual([3, 4, 5]);
    expect(matrix(effect, 'uProjInv').elements).toEqual(camera.projectionMatrixInverse.elements);
    camera.position.set(-1, 0, 2);
    camera.updateMatrixWorld(true);
    effect.update(null as never, null as never, 0.016);
    expect(matrix(effect, 'uCamWorld').elements.slice(12, 15)).toEqual([-1, 0, 2]);
    effect.dispose();
  });

  it('keeps the drift clock under its wrap so precision never decays', () => {
    const effect = new SpaceFogEffect();
    for (let frame = 0; frame < 5; frame += 1) effect.update(null as never, null as never, 900);
    expect(number(effect, 'uTime')).toBeLessThan(2000);
    expect(number(effect, 'uTime')).toBeGreaterThanOrEqual(0);
    effect.dispose();
  });

  it('survives a stalled frame with a negative or non-finite delta', () => {
    const effect = new SpaceFogEffect();
    effect.update(null as never, null as never, Number.NaN);
    effect.update(null as never, null as never, -5);
    expect(Number.isFinite(number(effect, 'uTime'))).toBe(true);
    effect.dispose();
  });
});

describe('the density volume', () => {
  it('is released with the effect', () => {
    const effect = new SpaceFogEffect();
    const texture = volume(effect);
    let disposed = false;
    texture.addEventListener('dispose', () => { disposed = true; });
    effect.dispose();
    expect(disposed).toBe(true);
  });

  it('mirrors at the edge so the pattern has no seam', () => {
    const effect = new SpaceFogEffect();
    const texture = volume(effect);
    expect([texture.wrapS, texture.wrapT, texture.wrapR]).toEqual([THREE.MirroredRepeatWrapping, THREE.MirroredRepeatWrapping, THREE.MirroredRepeatWrapping]);
    effect.dispose();
  });
});
