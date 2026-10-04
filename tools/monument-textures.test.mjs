import { describe, expect, it } from 'vitest';
import { applyUvTransform, reframeNormal, sampleMap } from './monument-textures.mjs';

const repeat = { wrapS: 10497, wrapT: 10497 };
const map = { width: 2, height: 2, data: new Uint8Array([
  255, 0, 0, 255, 0, 255, 0, 255,
  0, 0, 255, 255, 255, 255, 255, 255,
]) };
const standard = [1, 0, 0, 0, 1, 0, 0, 0, 1];

describe('monument surface reprojection', () => {
  it('samples authored image pixel centers without flipping the glTF V coordinate', () => {
    expect([...sampleMap(map, 0.25, 0.25, repeat)]).toEqual([255, 0, 0, 255]);
    expect([...sampleMap(map, 0.25, 0.75, repeat)]).toEqual([0, 0, 255, 255]);
  });

  it('interpolates across the original image instead of stretching a triangle across atlas seams', () => {
    expect([...sampleMap(map, 0.5, 0.5, repeat)]).toEqual([127.5, 127.5, 127.5, 255]);
  });

  it('preserves repeated 16× surface mapping, including coordinates outside one tile', () => {
    const transform = { scale: [16, 16], offset: [0, 0], rotation: 0 };
    for (const coordinate of [0.015625, 1.015625, -0.984375]) {
      const [u, v] = applyUvTransform(coordinate, coordinate, transform);
      expect([...sampleMap(map, u, v, repeat)]).toEqual([255, 0, 0, 255]);
    }
  });

  it('applies texture scale, rotation and offset in the glTF order', () => {
    const uv = applyUvTransform(0.5, 0.25, { scale: [2, 3], offset: [0.25, 0.5], rotation: Math.PI / 2 });
    expect(uv[0]).toBeCloseTo(-0.5, 10);
    expect(uv[1]).toBeCloseTo(1.5, 10);
  });

  it('clamps an edge sampler instead of bleeding the opposite side of its atlas', () => {
    expect([...sampleMap(map, -1, 0.25, { wrapS: 33071, wrapT: 33071 })]).toEqual([255, 0, 0, 255]);
    expect([...sampleMap(map, 2, 0.25, { wrapS: 33071, wrapT: 33071 })]).toEqual([0, 255, 0, 255]);
  });

  it('reflects a mirrored source sampler', () => {
    expect([...sampleMap(map, 1.25, 0.25, { wrapS: 33648, wrapT: 33648 })]).toEqual([0, 255, 0, 255]);
  });

  it('retains the normal when source and baked tangent frames agree', () => {
    const normal = reframeNormal([0.3, 0.4, Math.sqrt(0.75)], standard, standard);
    expect(normal[0]).toBeCloseTo(0.3, 6);
    expect(normal[1]).toBeCloseTo(0.4, 6);
    expect(normal[2]).toBeCloseTo(Math.sqrt(0.75), 6);
  });

  it('moves a normal into the new atlas frame without rotating the visible surface shading', () => {
    const rotated = [0, 0, 1, 0, 1, 0, -1, 0, 0];
    expect([...reframeNormal([0, 0, 1], rotated, standard)]).toEqual([-1, 0, 0]);
    expect([...reframeNormal([0, 0, 1], standard, rotated)]).toEqual([1, 0, 0]);
  });
});
