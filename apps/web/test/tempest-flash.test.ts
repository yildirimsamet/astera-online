import { describe, expect, it } from 'vitest';
import { createTempestFlashClock, TEMPEST_FLASH } from '../src/galaxy/tempestFlash.js';

/*
  OWNER, 2026-10-20: Tempest's map flashes read as small rectangles. They are round flashes,
  dense at the centre and fading out — outer edge 18–26 px, core 4–8 px, each a random size —
  in quick yellow/white bursts (SSB … SBSBS … SBBS) with a random 1–3 s rest between, and no
  two fleets flashing in step.
*/
function seeded(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Flash { start: number; end: number; white: boolean; outerPx: number; corePx: number; motor: number; peak: number }

/** Walks a clock in 2 ms steps and returns each lit interval as one flash. */
function record(seed: number, seconds: number, motors = 1, from = 0): Flash[] {
  const clock = createTempestFlashClock(seeded(seed), from, motors);
  const flashes: Flash[] = [];
  let open: Flash | null = null;
  let previousKey = '';
  for (let time = from; time < from + seconds; time += .002) {
    const sample = clock.sample(time);
    const key = `${String(sample.white)}:${String(sample.outerPx)}:${String(sample.corePx)}:${String(sample.motor)}`;
    if (sample.intensity > 0 && (!open || key !== previousKey)) {
      if (open) flashes.push(open);
      open = { start: time, end: time, white: sample.white, outerPx: sample.outerPx, corePx: sample.corePx, motor: sample.motor, peak: sample.intensity };
    } else if (sample.intensity > 0 && open) {
      open.end = time;
      open.peak = Math.max(open.peak, sample.intensity);
    } else if (open) {
      flashes.push(open);
      open = null;
    }
    previousKey = key;
  }
  return flashes;
}

/** Flashes closer than the shortest rest belong to one burst. */
function bursts(flashes: readonly Flash[]): Flash[][] {
  const groups: Flash[][] = [];
  for (const flash of flashes) {
    const last = groups.at(-1);
    if (last && flash.start - last.at(-1)!.end < TEMPEST_FLASH.restSeconds[0] * .9) last.push(flash);
    else groups.push([flash]);
  }
  return groups;
}

describe('Tempest map flashes', () => {
  it('fires bursts of two to five quick flashes', () => {
    const groups = bursts(record(7, 90)).slice(0, -1);
    expect(groups.length).toBeGreaterThan(20);
    for (const group of groups) {
      expect(group.length).toBeGreaterThanOrEqual(2);
      expect(group.length).toBeLessThanOrEqual(5);
      for (const flash of group) expect(flash.end - flash.start).toBeLessThanOrEqual(TEMPEST_FLASH.flashSeconds[1] + .005);
    }
    const sizes = new Set(groups.map(group => group.length));
    expect(sizes.size).toBeGreaterThanOrEqual(3);
  });

  it('rests between one and three seconds, a different rest each time', () => {
    const groups = bursts(record(11, 120));
    const rests = groups.slice(1).map((group, index) => group[0]!.start - groups[index]!.at(-1)!.end);
    for (const rest of rests) {
      expect(rest).toBeGreaterThanOrEqual(1 - .01);
      expect(rest).toBeLessThanOrEqual(3 + .01);
    }
    expect(Math.max(...rests) - Math.min(...rests)).toBeGreaterThan(1);
  });

  it('mixes yellow and white flashes, each with its own outer and core size', () => {
    const flashes = record(3, 60);
    expect(flashes.some(flash => flash.white)).toBe(true);
    expect(flashes.some(flash => !flash.white)).toBe(true);
    for (const flash of flashes) {
      expect(flash.outerPx).toBeGreaterThanOrEqual(18);
      expect(flash.outerPx).toBeLessThanOrEqual(26);
      expect(flash.corePx).toBeGreaterThanOrEqual(4);
      expect(flash.corePx).toBeLessThanOrEqual(8);
      expect(flash.peak).toBeGreaterThan(.8);
    }
    expect(new Set(flashes.map(flash => Math.round(flash.outerPx))).size).toBeGreaterThan(3);
  });

  it('keeps two fleets out of step', () => {
    const a = record(21, 20).map(flash => Math.round(flash.start * 10));
    const b = record(22, 20).map(flash => Math.round(flash.start * 10));
    const shared = a.filter(start => b.includes(start)).length;
    expect(shared).toBeLessThan(Math.min(a.length, b.length) / 2);
  });

  it('lights one motor of a formation at a time, chosen among its motors', () => {
    const motors = new Set(record(5, 60, 6).map(flash => flash.motor));
    expect(motors.size).toBeGreaterThan(1);
    for (const motor of motors) expect(motor).toBeGreaterThanOrEqual(0);
    for (const motor of motors) expect(motor).toBeLessThan(6);
  });

  it('resumes with a real rest after a long pause instead of replaying missed bursts', () => {
    const clock = createTempestFlashClock(seeded(9), 0, 1);
    clock.sample(1);
    const started = performance.now();
    const after = clock.sample(100_000);
    expect(performance.now() - started).toBeLessThan(50);
    expect(after.intensity).toBe(0);
    const flashes = record(9, 10, 1, 100_000);
    expect(flashes.length).toBeGreaterThan(0);
  });

  it('is dark at rest', () => {
    const clock = createTempestFlashClock(seeded(1), 0, 1);
    const last = bursts(record(1, 30))[0]!.at(-1)!;
    for (let time = 0; time <= last.end; time += .002) clock.sample(time);
    for (let time = last.end + .05; time < last.end + .95; time += .05) expect(clock.sample(time).intensity).toBe(0);
  });
});
