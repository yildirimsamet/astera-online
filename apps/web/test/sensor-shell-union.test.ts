import { describe, expect, it } from 'vitest';
import { MAX_SHELL_OCCLUDERS, SHELL_FRAGMENT, shellUnion } from '../src/galaxy/SensorRings.js';

/**
 * Overlapping telescopes are ONE open volume. Its outer surface is the boundary; the pieces of one
 * shell that lie inside another are interior and must not be drawn, or a second blue wall stands in
 * the middle of the commander's own space (plan 2026-11-14, section 5).
 */
const ball = (x: number, radius: number, key = String(x)) => ({ key, centre: [x, 0, 0] as const, radius });

describe('which shells are drawn and what hides their inside parts', () => {
  it('leaves a lone shell whole', () => {
    const { drawn, occluders } = shellUnion([ball(0, 5)]);
    expect(drawn).toHaveLength(1);
    expect(occluders[0]).toEqual([]);
  });

  it('lets each of two overlapping shells be cut by the other', () => {
    const { drawn, occluders } = shellUnion([ball(0, 5), ball(6, 5)]);
    expect(drawn).toHaveLength(2);
    expect(occluders[0]).toEqual([{ centre: [6, 0, 0], radius: 5 }]);
    expect(occluders[1]).toEqual([{ centre: [0, 0, 0], radius: 5 }]);
  });

  it('draws two shells with the same centre and radius once, so they never pile up', () => {
    const { drawn, occluders } = shellUnion([ball(0, 5, 'a'), ball(0, 5, 'b')]);
    expect(drawn.map(shell => shell.key)).toEqual(['a']);
    expect(occluders[0]).toEqual([]);
  });

  it('cuts a shell that lies wholly inside a larger one by that larger one', () => {
    const { drawn, occluders } = shellUnion([ball(0, 10), ball(1, 2)]);
    expect(drawn).toHaveLength(2);
    expect(occluders[1]).toEqual([{ centre: [0, 0, 0], radius: 10 }]);
  });

  it('keeps the true outline of separate shells: they do not cut each other', () => {
    const { occluders } = shellUnion([ball(0, 5), ball(50, 5)]);
    expect(occluders[0]).toEqual([]);
    expect(occluders[1]).toEqual([]);
  });

  it('passes on only as many cutters as the shader has room for', () => {
    const many = Array.from({ length: MAX_SHELL_OCCLUDERS + 5 }, (_, index) => ball(index * 0.1, 5));
    const { occluders } = shellUnion(many);
    expect(Math.max(...occluders.map(list => list.length))).toBeLessThanOrEqual(MAX_SHELL_OCCLUDERS);
  });
});

describe('the shell shader', () => {
  it('discards a fragment that lies inside another open volume', () => {
    expect(SHELL_FRAGMENT).toContain('uOtherCount');
    expect(SHELL_FRAGMENT).toMatch(/uOthers\[/);
    expect(SHELL_FRAGMENT).toMatch(/discard;/);
  });
});
