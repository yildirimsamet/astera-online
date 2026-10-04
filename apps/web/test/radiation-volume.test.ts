import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { paintRadiationVolume } from '../src/galaxy/radiationVolume.js';

describe('the shared radiation smoke volume', () => {
  let texture: THREE.Data3DTexture;
  let density: Uint8Array;
  beforeAll(() => {
    texture = paintRadiationVolume();
    const data = texture.image.data;
    if (!(data instanceof Uint8Array)) throw new Error('Smoke density must use one byte per voxel');
    density = data;
  });
  afterAll(() => { texture.dispose(); });

  it('keeps the shared density field below 128 KiB without mipmaps', () => {
    const { width, height, depth } = texture.image;
    expect(density.byteLength).toBeLessThanOrEqual(128 * 1024);
    expect(density.length).toBe(width * height * depth);
    expect(texture.format).toBe(THREE.RedFormat);
    expect(texture.generateMipmaps).toBe(false);
  });

  it('has translucent lanes and varied smoke density rather than a uniform fill', () => {
    const values = Array.from(density).sort((a, b) => a - b);
    expect(values[0]).toBeLessThanOrEqual(8);
    expect(values.at(-1)).toBeGreaterThan(128);
    expect(new Set(values).size).toBeGreaterThan(128);
    expect(values[Math.floor(values.length * 0.2)]).toBeLessThan(32);
  });

  it('interpolates density in all dimensions without a repeating seam', () => {
    expect(texture.minFilter).toBe(THREE.LinearFilter);
    expect(texture.magFilter).toBe(THREE.LinearFilter);
    expect(texture.wrapS).toBe(THREE.ClampToEdgeWrapping);
    expect(texture.wrapT).toBe(THREE.ClampToEdgeWrapping);
    expect(texture.wrapR).toBe(THREE.ClampToEdgeWrapping);
  });
});
