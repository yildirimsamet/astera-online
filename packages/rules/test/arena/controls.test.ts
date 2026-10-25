import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { ARENA_TUNING, createInput, sampleInput, shapeSteering } from '../../src/arena/index.js';

describe('quantized arena controls', () => {
  it('samples exactly the intent that the shared simulation and network will use', () => {
    const input = createInput();
    sampleInput(input, 0.12345, -0.98765, 0.3456);
    expect(input).toEqual({ steerX: 0.123, steerY: -0.988, throttle: 0.35, turbo: false, assistX: 0, assistY: 0 });
  });

  it('clamps out-of-range input and neutralizes non-finite values', () => {
    const input = createInput();
    sampleInput(input, -100, 100, -1);
    expect(input).toMatchObject({ steerX: -1, steerY: 1, throttle: 0 });
    sampleInput(input, NaN, Infinity, Infinity);
    expect(input).toMatchObject({ steerX: 0, steerY: 0, throttle: 0 });
    sampleInput(input, 0, 0, 2, true);
    expect(input).toMatchObject({ throttle: 1, turbo: true });
  });

  it('has a circular deadzone and preserves direction outside it', () => {
    const output = { x: 0, y: 0, z: 0 };
    shapeSteering(output, ARENA_TUNING.deadzone, 0);
    expect(output.x).toBe(0);
    shapeSteering(output, 0.3, 0.4);
    expect(output.x / output.y).toBeCloseTo(0.75, 12);
    expect(Math.sqrt(output.x * output.x + output.y * output.y)).toBeLessThan(0.5);
    shapeSteering(output, 1, 1);
    expect(Math.sqrt(output.x * output.x + output.y * output.y)).toBeCloseTo(1, 12);
  });

  it('gives fine aiming near the centre, full turn at the rim and optional inverted pitch', () => {
    const output = { x: 0, y: 0, z: 0 };
    shapeSteering(output, 0.2, 0);
    expect(output.x).toBeGreaterThan(0);
    expect(output.x).toBeLessThan(0.1);
    shapeSteering(output, 1, 0);
    expect(output.x).toBe(1);
    shapeSteering(output, 0, -1, { sensitivity: 1, invertPitch: true });
    expect(output.y).toBe(1);
  });

  it('stays monotonic and within the unit disc for arbitrary finite stick input', () => {
    fc.assert(fc.property(
      fc.double({ min: 0, max: 1, noNaN: true, noDefaultInfinity: true }),
      fc.double({ min: 0, max: 1, noNaN: true, noDefaultInfinity: true }),
      (a, b) => {
        const low = { x: 0, y: 0, z: 0 };
        const high = { x: 0, y: 0, z: 0 };
        shapeSteering(low, Math.min(a, b), 0);
        shapeSteering(high, Math.max(a, b), 0);
        expect(low.x).toBeLessThanOrEqual(high.x);
        expect(high.x).toBeLessThanOrEqual(1);
      },
    ));
  });
});
