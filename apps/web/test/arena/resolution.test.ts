import { describe, expect, it } from 'vitest';
import { createResolution, stepResolution, type Resolution } from '../../src/arena/resolution.js';

/**
 * Owner 2026-10-20: the playtest must stay smooth on every friend's phone. The arena
 * renders sharp (up to 2×); a phone that cannot hold the frame rate steps its pixel
 * ratio down until it can. A phone that keeps up is never touched.
 */
const run = (r: Resolution, fps: number, seconds: number): number[] => {
  const changes: number[] = [];
  for (let t = 0; t < seconds; t += 1 / fps) { const next = stepResolution(r, 1 / fps); if (next !== null) changes.push(next); }
  return changes;
};

describe('arena resolution governor', () => {
  it('never touches a device that holds the frame rate', () => {
    const r = createResolution(2);
    expect(run(r, 60, 60)).toEqual([]);
    expect(run(r, 52, 30)).toEqual([]);
    expect(r.ratio).toBe(2);
  });

  it('steps a struggling device down a quarter at a time, never below one', () => {
    const r = createResolution(2);
    const changes = run(r, 30, 60);
    expect(changes).toEqual([1.75, 1.5, 1.25, 1]);
    expect(r.ratio).toBe(1);
  });

  it('waits out the first seconds of loading and shader warm-up', () => {
    const r = createResolution(2);
    expect(run(r, 20, 2.5)).toEqual([]);
  });

  it('stops stepping once the lower ratio holds the frame rate', () => {
    const r = createResolution(2);
    expect(run(r, 35, 5.2)).toEqual([1.75]);
    expect(run(r, 58, 30)).toEqual([]);
    expect(r.ratio).toBe(1.75);
  });

  it('ignores a hitch or a backgrounded tab instead of reading it as a slow device', () => {
    const r = createResolution(2);
    run(r, 60, 4);
    for (let i = 0; i < 5; i++) expect(stepResolution(r, 2)).toBeNull();
    expect(run(r, 60, 10)).toEqual([]);
  });

  it('starts at the device ratio when that is already at or below one', () => {
    const r = createResolution(1);
    expect(run(r, 20, 30)).toEqual([]);
  });
});
