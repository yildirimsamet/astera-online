import { describe, expect, it } from 'vitest';
import { DIG_END, DIG_START, mineFrame } from '../../src/dev/lab/mine.js';

describe('mining dig timeline (vfx lab)', () => {
  it('the drill closes in, slowing, and touches the rock when the dig starts', () => {
    expect(mineFrame(0).gap).toBeGreaterThan(1);
    expect(mineFrame(DIG_START).gap).toBe(0);
    const early = mineFrame(0.1).gap - mineFrame(0.3).gap;
    const late = mineFrame(DIG_START - 0.3).gap - mineFrame(DIG_START - 0.1).gap;
    expect(early).toBeGreaterThan(late);
  });

  it('sparks, dust and the hot spot belong to the dig alone', () => {
    expect(mineFrame(DIG_START - 0.05).sparks).toBe(0);
    expect(mineFrame((DIG_START + DIG_END) / 2).sparks).toBeGreaterThan(0.8);
    expect(mineFrame((DIG_START + DIG_END) / 2).heat).toBeGreaterThan(0.6);
    expect(mineFrame(DIG_END + 0.3).sparks).toBe(0);
    expect(mineFrame(DIG_END + 0.6).heat).toBeLessThan(0.2);
  });

  it('the hold fills during the dig and glows on the way home', () => {
    expect(mineFrame(DIG_START).cargo).toBe(0);
    expect(mineFrame((DIG_START + DIG_END) / 2).cargo).toBeGreaterThan(0);
    expect(mineFrame(DIG_END + 0.5).cargo).toBe(1);
    expect(mineFrame(DIG_END + 0.5).gap).toBeGreaterThan(0);
  });

  it('the drill spins only while it bites', () => {
    expect(mineFrame(DIG_START - 0.2).spin).toBe(0);
    expect(mineFrame(DIG_START + 0.5).spin).toBeGreaterThan(0.5);
  });

  it('bad clocks draw the drill waiting off the rock, nothing burning', () => {
    for (const t of [Number.NaN, Number.NEGATIVE_INFINITY, -2]) {
      const frame = mineFrame(t);
      expect(Object.values(frame).every(Number.isFinite)).toBe(true);
      expect(frame.sparks + frame.heat + frame.spin).toBe(0);
    }
  });
});
