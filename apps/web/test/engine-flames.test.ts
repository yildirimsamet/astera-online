// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { DataTexture, Matrix4, Vector3, AdditiveBlending, BackSide } from 'three';
import { EngineFlameBatch, ENGINE_FLAME_VARIANTS } from '../src/vfx/engineFlames.js';

describe('original engine flame pack', () => {
  it('batches all four shapes in one twelve-triangle volume proxy', () => {
    const texture = new DataTexture();
    const batch = new EngineFlameBatch(texture, { capacity: 4 });
    ENGINE_FLAME_VARIANTS.forEach((variant, index) => {
      batch.set(index, { variant, matrix: new Matrix4().makeTranslation(index * 2, 0, 0),
        length: 4, nozzleRadius: .2, throttle: 1, seed: index });
    });
    expect(ENGINE_FLAME_VARIANTS).toEqual(['solar', 'cryo', 'vacuum', 'siege']);
    expect(batch.mesh.count).toBe(4);
    expect(batch.mesh.geometry.index!.count / 3).toBe(12);
    expect(batch.mesh.material.depthTest).toBe(true);
    expect(batch.mesh.material.depthWrite).toBe(false);
    expect(batch.mesh.material.blending).toBe(AdditiveBlending);
    expect(batch.mesh.material.side).toBe(BackSide);
    expect(batch.mesh.material.forceSinglePass).toBe(true);
    expect(Array.from(batch.mesh.geometry.getAttribute('aFlame').array).every(Number.isFinite)).toBe(true);
    batch.dispose();
  });

  it('starts dark, clamps throttle, and switches off without stale emission', () => {
    const batch = new EngineFlameBatch(new DataTexture(), { capacity: 2 });
    expect(batch.mesh.count).toBe(0);
    const flame = { variant: 'solar' as const, matrix: new Matrix4(), length: 3, nozzleRadius: .1, seed: 0 };
    batch.set(0, { ...flame, throttle: 2 });
    expect(batch.mesh.geometry.getAttribute('aFlame').getY(0)).toBe(1);
    batch.set(0, { ...flame, throttle: -.1 });
    expect(batch.mesh.geometry.getAttribute('aFlame').getY(0)).toBe(0);
    batch.dispose();
  });

  it('uses absolute time without replacing uniforms, attributes or matrices', () => {
    const batch = new EngineFlameBatch(new DataTexture());
    const uniforms = batch.mesh.material.uniforms;
    const attributes = batch.mesh.geometry.attributes;
    const matrix = batch.mesh.instanceMatrix.array;
    batch.update(1 / 120);
    batch.update(3600);
    expect(batch.mesh.material.uniforms).toBe(uniforms);
    expect(batch.mesh.geometry.attributes).toBe(attributes);
    expect(batch.mesh.instanceMatrix.array).toBe(matrix);
    expect(uniforms.uTime!.value).toBe(3600);
    expect(() => { batch.update(NaN); }).toThrow(RangeError);
    batch.dispose();
  });

  it('validates capacity, slots, dimensions, time and transforms', () => {
    const texture = new DataTexture();
    for (const capacity of [0, -1, .5, NaN, Infinity, 65537]) {
      expect(() => new EngineFlameBatch(texture, { capacity })).toThrow(RangeError);
    }
    const batch = new EngineFlameBatch(texture, { capacity: 2 });
    const options = { variant: 'cryo' as const, matrix: new Matrix4(), length: 2, nozzleRadius: .1, throttle: 1, seed: 0 };
    for (const index of [-1, .5, 2, NaN]) expect(() => { batch.set(index, options); }).toThrow(RangeError);
    for (const dimension of [0, -1, NaN, Infinity]) {
      expect(() => { batch.set(0, { ...options, length: dimension }); }).toThrow(RangeError);
      expect(() => { batch.set(0, { ...options, nozzleRadius: dimension }); }).toThrow(RangeError);
    }
    expect(() => { batch.set(0, { ...options, throttle: NaN }); }).toThrow(RangeError);
    expect(() => { batch.set(0, { ...options, seed: Infinity }); }).toThrow(RangeError);
    expect(() => { batch.set(0, { ...options, matrix: new Matrix4().makeScale(0, 1, 1) }); }).toThrow(RangeError);
    expect(() => { batch.set(0, { ...options, matrix: new Matrix4().makeTranslation(NaN, 0, 0) }); }).toThrow(RangeError);
    batch.set(1, { ...options, matrix: new Matrix4().makeScale(.4, 2, 1.2) });
    const matrix = new Matrix4();
    batch.mesh.getMatrixAt(1, matrix);
    expect(new Vector3().setFromMatrixScale(matrix).toArray()).toEqual([expect.closeTo(.4), 2, expect.closeTo(1.2)]);
    batch.dispose();
  });

  it('releases owned GPU resources once and retains a shared caller texture', () => {
    const texture = new DataTexture();
    const batch = new EngineFlameBatch(texture, { quality: 'mobile' });
    const textureDispose = vi.spyOn(texture, 'dispose');
    const geometryDispose = vi.spyOn(batch.mesh.geometry, 'dispose');
    const materialDispose = vi.spyOn(batch.mesh.material, 'dispose');
    batch.dispose(); batch.dispose();
    expect(textureDispose).not.toHaveBeenCalled();
    expect(geometryDispose).toHaveBeenCalledTimes(1);
    expect(materialDispose).toHaveBeenCalledTimes(1);
    expect(() => { batch.update(1); }).toThrow();
  });
});
