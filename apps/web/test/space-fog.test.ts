import { describe, expect, it } from 'vitest';
import { VIEW } from '@astera/rules';
import {
  FOG, MAX_FOG_SPHERES, foggedLength, fogSpheres, outsideLength, surfaceClearance,
  type FogSphere,
} from '../src/galaxy/spaceFog.js';

const ray = (from: [number, number, number], to: [number, number, number]) => {
  const d = [to[0] - from[0], to[1] - from[1], to[2] - from[2]] as const;
  const length = Math.hypot(...d);
  return { origin: from, direction: [d[0] / length, d[1] / length, d[2] / length] as [number, number, number], length };
};
const ball = (x: number, radius: number, y = 0, z = 0): FogSphere => ({ centre: [x, y, z], radius });

describe('the owner-chosen look, stated once', () => {
  it('uses the density 0.025 and a transition of exactly 38 game units', () => {
    expect(FOG.density).toBe(0.025);
    expect(FOG.transitionGameUnits).toBe(38);
  });

  it('turns the 38 game units into scene units through the shared scale, not through a copied number', () => {
    expect(FOG.transition).toBeCloseTo(38 / VIEW.scale, 12);
    expect(FOG.transition).toBeCloseTo(0.76, 12);
  });
});

describe('the sensor spheres the fog opens', () => {
  const post = (x: number, identify: number, extra: Record<string, unknown> = {}) =>
    ({ at: { x, y: 0, z: 0 }, identify, detect: identify * 2, telescope: true, ...extra });

  it('converts game units to scene units through the shared transform', () => {
    const [sphere] = fogSpheres([post(100, 250)]);
    expect(sphere).toEqual({ centre: [100 / VIEW.scale, 0, 0], radius: 250 / VIEW.scale });
  });

  it('uses identify, never the radar range: radar does not open the sky', () => {
    expect(fogSpheres([post(0, 100)])[0]?.radius).toBeCloseTo(100 / VIEW.scale, 12);
  });

  it('drops a sphere that opens nothing, and a sphere that is not a number', () => {
    expect(fogSpheres([post(0, 0), post(0, Number.NaN), post(Number.NaN, 50), post(0, -5)])).toEqual([]);
  });

  it('draws one sphere for the same centre and radius, so nothing is counted twice', () => {
    expect(fogSpheres([post(10, 80), post(10, 80, { planetId: 'again' })])).toHaveLength(1);
  });

  it('keeps the widest spheres when there are more than the shader holds', () => {
    const many = Array.from({ length: MAX_FOG_SPHERES + 3 }, (_, index) => post(index * 1000, 100 + index));
    const kept = fogSpheres(many);
    expect(kept).toHaveLength(MAX_FOG_SPHERES);
    expect(Math.min(...kept.map(sphere => sphere.radius))).toBeCloseTo(103 / VIEW.scale, 12);
  });

  it('answers an empty list with no spheres, which the shader reads as "fog off"', () => {
    expect(fogSpheres([])).toEqual([]);
  });
});

describe('how much of a camera ray lies outside every open volume', () => {
  it('is the whole ray when there are no spheres', () => {
    const r = ray([0, 0, 0], [10, 0, 0]);
    expect(outsideLength(r.origin, r.direction, r.length, [])).toBeCloseTo(10, 12);
  });

  it('is zero when the camera is inside and the surface is inside too', () => {
    const r = ray([0, 0, 0], [3, 0, 0]);
    expect(outsideLength(r.origin, r.direction, r.length, [ball(0, 5)])).toBe(0);
  });

  it('starts the fog at the exit when the camera is inside the volume', () => {
    const r = ray([0, 0, 0], [20, 0, 0]);
    expect(outsideLength(r.origin, r.direction, r.length, [ball(0, 5)])).toBeCloseTo(15, 12);
  });

  it('counts the stretch before a distant volume and the stretch after it', () => {
    const r = ray([0, 0, 0], [30, 0, 0]);
    expect(outsideLength(r.origin, r.direction, r.length, [ball(15, 5)])).toBeCloseTo(20, 12);
  });

  it('counts the empty gap between two separate volumes', () => {
    const r = ray([0, 0, 0], [40, 0, 0]);
    expect(outsideLength(r.origin, r.direction, r.length, [ball(5, 5), ball(30, 5)])).toBeCloseTo(40 - 10 - 10, 12);
  });

  it('removes the overlap of two crossing volumes once, not twice', () => {
    const r = ray([-20, 0, 0], [20, 0, 0]);
    // [-8, 2] and [-2, 8] cover [-8, 8]: 16 long. Subtracting each (10 + 10) would give 20, not 16.
    expect(outsideLength(r.origin, r.direction, r.length, [ball(-3, 5), ball(3, 5)])).toBeCloseTo(40 - 16, 12);
  });

  it('removes a volume that sits entirely inside a larger one only once', () => {
    const r = ray([-20, 0, 0], [20, 0, 0]);
    expect(outsideLength(r.origin, r.direction, r.length, [ball(0, 10), ball(0, 3)])).toBeCloseTo(20, 12);
  });

  it('removes an identical volume only once', () => {
    const r = ray([-20, 0, 0], [20, 0, 0]);
    expect(outsideLength(r.origin, r.direction, r.length, [ball(0, 10), ball(0, 10)])).toBeCloseTo(20, 12);
  });

  it('chains three volumes that overlap end to end and leaves their true gaps foggy', () => {
    const r = ray([-30, 0, 0], [60, 0, 0]);
    const chain = [ball(0, 6), ball(9, 6), ball(18, 6), ball(45, 4)];
    // Covered: [-6, 24] and [41, 49] = 30 + 8.
    expect(outsideLength(r.origin, r.direction, r.length, chain)).toBeCloseTo(90 - 38, 12);
  });

  it('ignores a volume that is only touched at one point', () => {
    const r = ray([-10, 5, 0], [10, 5, 0]);
    expect(outsideLength(r.origin, r.direction, r.length, [ball(0, 5)])).toBeCloseTo(20, 9);
  });

  it('ignores a volume behind the camera', () => {
    const r = ray([0, 0, 0], [10, 0, 0]);
    expect(outsideLength(r.origin, r.direction, r.length, [ball(-20, 5)])).toBeCloseTo(10, 12);
  });

  it('stops at the surface that was hit: a volume beyond it does not count', () => {
    const r = ray([0, 0, 0], [10, 0, 0]);
    expect(outsideLength(r.origin, r.direction, r.length, [ball(20, 5)])).toBeCloseTo(10, 12);
  });

  it('reads the third axis: a volume above the disc is a sphere, not a circle', () => {
    const r = ray([-20, 0, 0], [20, 0, 0]);
    expect(outsideLength(r.origin, r.direction, r.length, [ball(0, 5, 4)])).toBeCloseTo(40 - 6, 12);
    expect(outsideLength(r.origin, r.direction, r.length, [ball(0, 5, 6)])).toBeCloseTo(40, 12);
  });
});

describe('the soft edge', () => {
  const wide = FOG.transition;

  it('lies between the hard edge at R + 38 game units (most open) and the hard edge at R (most fog)', () => {
    const r = ray([-20, 0, 0], [20, 0, 0]);
    const spheres = [ball(0, 5)];
    const soft = foggedLength(r.origin, r.direction, r.length, spheres);
    expect(soft).toBeLessThan(outsideLength(r.origin, r.direction, r.length, spheres));
    expect(soft).toBeGreaterThan(outsideLength(r.origin, r.direction, r.length, [ball(0, 5 + wide)]));
  });

  it('has no fog at all when every sphere is wider than the ray reaches', () => {
    const r = ray([0, 0, 0], [3, 0, 0]);
    expect(foggedLength(r.origin, r.direction, r.length, [ball(0, 50)])).toBe(0);
  });

  it('is the whole ray when nothing is open', () => {
    const r = ray([0, 0, 0], [10, 0, 0]);
    expect(foggedLength(r.origin, r.direction, r.length, [])).toBeCloseTo(10, 12);
  });

  it('grows continuously as a ray slides off a volume instead of jumping', () => {
    const lengths = Array.from({ length: 13 }, (_, step) => step * 0.5).map(height => {
      const r = ray([-20, height, 0], [20, height, 0]);
      return foggedLength(r.origin, r.direction, r.length, [ball(0, 5)]);
    });
    for (let index = 1; index < lengths.length; index += 1) {
      expect(lengths[index]!).toBeGreaterThanOrEqual(lengths[index - 1]!);
      expect(lengths[index]! - lengths[index - 1]!).toBeLessThan(4);
    }
  });

  it('does not darken where two volumes cross: the overlap is open once', () => {
    const r = ray([-20, 0, 0], [20, 0, 0]);
    const crossing = foggedLength(r.origin, r.direction, r.length, [ball(-3, 5), ball(3, 5)]);
    const merged = foggedLength(r.origin, r.direction, r.length, [ball(-3, 5)]) - 0;
    expect(crossing).toBeLessThan(merged);
  });
});

describe('a surface the camera sees', () => {
  const spheres = [ball(0, 5)];
  const wide = FOG.transition;

  it('is fully clear inside an open volume, whatever the camera looks through', () => {
    expect(surfaceClearance([1, 0, 0], spheres)).toBe(0);
  });

  it('is fully foggy beyond the soft edge', () => {
    expect(surfaceClearance([5 + wide + 0.01, 0, 0], spheres)).toBe(1);
  });

  it('opens linearly across the soft edge: R, R + 19 game units, R + 38 game units', () => {
    expect(surfaceClearance([5, 0, 0], spheres)).toBeCloseTo(0, 12);
    expect(surfaceClearance([5 + wide / 2, 0, 0], spheres)).toBeCloseTo(0.5, 12);
    expect(surfaceClearance([5 + wide, 0, 0], spheres)).toBeCloseTo(1, 12);
  });

  it('is open if any one volume holds it', () => {
    expect(surfaceClearance([30, 0, 0], [ball(0, 5), ball(30, 2)])).toBe(0);
  });

  it('is foggy when nothing is open', () => {
    expect(surfaceClearance([0, 0, 0], [])).toBe(1);
  });
});
