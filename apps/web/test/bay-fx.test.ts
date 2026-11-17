import { VESSEL_SYSTEMS } from '@astera/rules';
import { describe, expect, it } from 'vitest';
import { BAY_RETURN, flipbookFrame, sparkAt, strobeOn, sweepTurn } from '../src/galaxy/bayFx.js';

/**
 * THE SHIP'S OWN EFFECTS (owner 2026-11-18: no round glow; each effect is its event). A weld throws
 * sparks; a system that comes back does its own work where it sits: the furnace catches, the antenna
 * sweeps, power arcs through the yard; a mended bay carries a running light that blinks.
 */
describe('what a bay does when its system comes back', () => {
  it('gives every system its own work, and none of them a glow', () => {
    expect(BAY_RETURN).toEqual({ REFINERY: 'burner', DRIVE: 'burner', DEFENCE: 'sweep', SURVEY: 'sweep', CARGO: 'arcs' });
    expect(Object.keys(BAY_RETURN).sort()).toEqual([...VESSEL_SYSTEMS].sort());
  });
});

describe('a spark', () => {
  it('leaves its bay, slows, and burns out at the end of its life', () => {
    const born = sparkAt(0.3, 0, 0.5);
    const mid = sparkAt(0.3, 0.25, 0.5);
    const late = sparkAt(0.3, 0.45, 0.5);
    expect(born).not.toBeNull();
    expect(Math.hypot(...(born?.at ?? [1, 1, 1]))).toBeCloseTo(0, 6);
    const reach = (s: ReturnType<typeof sparkAt>) => Math.hypot(...(s?.at ?? [0, 0, 0]));
    expect(reach(mid)).toBeGreaterThan(0);
    expect(reach(late)).toBeGreaterThan(reach(mid));
    // Slowing: the second half covers less ground than the first.
    expect(reach(late) - reach(mid)).toBeLessThan(reach(mid) - reach(born));
    expect(born?.heat).toBeGreaterThan(late?.heat ?? 1);
    expect(sparkAt(0.3, 0.5, 0.5)).toBeNull();
  });

  it('flies its own way for each seed', () => {
    expect(sparkAt(0.1, 0.2, 0.5)?.at).not.toEqual(sparkAt(0.7, 0.2, 0.5)?.at);
  });
});

describe('a flipbook', () => {
  it('steps through its frames at its rate and starts again', () => {
    expect(flipbookFrame(0, 24, 16)).toBe(0);
    expect(flipbookFrame(1 / 24, 24, 16)).toBe(1);
    expect(flipbookFrame(16 / 24, 24, 16)).toBe(0);
  });
});

describe('the antenna\'s sweep', () => {
  it('turns twice in its time, and stops there', () => {
    expect(sweepTurn(0, 2.4)).toBe(0);
    expect(sweepTurn(1.2, 2.4)).toBeCloseTo(2 * Math.PI, 6);
    expect(sweepTurn(2.4, 2.4)).toBeCloseTo(4 * Math.PI, 6);
    expect(sweepTurn(9, 2.4)).toBeCloseTo(4 * Math.PI, 6);
  });
});

describe('a running light', () => {
  it('blinks twice, briefly, and is dark most of the time', () => {
    const period = 2;
    const samples = Array.from({ length: 200 }, (_, i) => strobeOn((i / 200) * period, 0));
    const lit = samples.filter(Boolean).length / samples.length;
    expect(lit).toBeGreaterThan(0.05);
    expect(lit).toBeLessThan(0.25);
    const flashes = samples.filter((on, i) => on && !samples[(i + samples.length - 1) % samples.length]).length;
    expect(flashes).toBe(2);
  });

  it('keeps each bay off the others\' beat', () => {
    const at = (offset: number) => Array.from({ length: 50 }, (_, i) => strobeOn(i / 25, offset));
    expect(at(0)).not.toEqual(at(0.37));
  });
});
