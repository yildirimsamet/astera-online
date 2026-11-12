import { DEATH_STAR } from '@astera/rules';
import { describe, expect, it } from 'vitest';
import { empBrownout, empSlot, empStormReach, empStormStart, empStormStrength } from '../src/galaxy/empSchedule.js';
import { NUKE_SECONDS } from '../src/galaxy/nukeLayers.js';

/**
 * A WORLD UNDER EMP MUST LOOK IT (owner, 2026-11-12: "gezegenin EMP etkisi altında olduğu belli
 * olmalı"). Arcs crawl over the surface and bolts leap off the limb on their own irregular beat,
 * and the world's light stutters like a failing grid — often enough to read at a glance, never
 * so often that it becomes a strobe.
 */
describe('the EMP storm schedule', () => {
  it('fires each slot again every few seconds, never in lockstep with the others', () => {
    const fires = (slot: number) => {
      let count = 0;
      let last = -1;
      for (let t = 0; t < 60; t += 0.05) {
        const s = empSlot(slot, t, 0.5);
        if (s.active && s.spawn !== last) { count++; last = s.spawn; }
      }
      return count;
    };
    for (const slot of [0, 1, 2]) {
      expect(fires(slot)).toBeGreaterThanOrEqual(15);
      expect(fires(slot)).toBeLessThanOrEqual(40);
    }
    expect(empSlot(0, 10, 0.5).spawn).not.toBe(empSlot(1, 10, 0.5).spawn);
  });

  it('plays an arc for its own length and then rests', () => {
    let active = 0;
    for (let t = 0; t < 60; t += 0.01) if (empSlot(0, t, 0.5).active) active++;
    expect(active / 6000).toBeLessThan(0.35);
    const s = empSlot(0, 7.3, 0.5);
    if (s.active) { expect(s.phase).toBeGreaterThanOrEqual(0); expect(s.phase).toBeLessThan(1); }
  });

  it('places the same arc at the same spot for every viewer', () => {
    expect(empSlot(2, 13.37, 0.5)).toEqual(empSlot(2, 13.37, 0.5));
    const s = empSlot(2, 13.37, 0.5);
    expect(Math.hypot(...s.at)).toBeCloseTo(1, 5);
  });

  it('stutters the light in short drops, dark less than a sixth of the time', () => {
    let dark = 0;
    let deepest = 0;
    for (let t = 0; t < 60; t += 0.01) {
      const d = empBrownout(t);
      if (d > 0.02) dark++;
      deepest = Math.max(deepest, d);
    }
    expect(dark / 6000).toBeLessThan(1 / 6);
    expect(deepest).toBeGreaterThan(0.2);
    expect(deepest).toBeLessThanOrEqual(0.5);
  });

  it('is quiet on a clock it cannot read', () => {
    expect(empSlot(0, Number.NaN, 0.5).active).toBe(false);
    expect(empBrownout(Number.NaN)).toBe(0);
  });
});

/**
 * WHEN A WORLD'S STORM SHOWS (owner approved the storm, 2026-11-12). A hit sets the EMP's end to the
 * hit plus `empMinutes` (server `strategic.ts`), so the end names the strike that caused it. The
 * storm takes over from that strike's crater, so neither competes for the frame of impact; it rises
 * in, holds, and dies away as the hour ends. From afar the ember says it; up close the storm does.
 */
describe('when a world shows its EMP storm', () => {
  const hit = 1_000_000;
  const until = hit + DEATH_STAR.empMinutes * 60_000;
  const start = hit + NUKE_SECONDS * 1000;

  it('starts once the strike that caused it has finished playing', () => {
    expect(empStormStart(until)).toBe(start);
  });

  it('rises in over a second and a half, holds, and dies away in the last twenty seconds of the hour', () => {
    expect(empStormStrength(start - 1, start, until)).toBe(0);
    expect(empStormStrength(start, start, until)).toBe(0);
    const rising = empStormStrength(start + 750, start, until);
    expect(rising).toBeGreaterThan(0);
    expect(rising).toBeLessThan(1);
    expect(empStormStrength(start + 1500, start, until)).toBe(1);
    expect(empStormStrength(until - 20_000, start, until)).toBe(1);
    const fading = empStormStrength(until - 10_000, start, until);
    expect(fading).toBeGreaterThan(0);
    expect(fading).toBeLessThan(1);
    expect(empStormStrength(until, start, until)).toBe(0);
    expect(empStormStrength(until + 1, start, until)).toBe(0);
  });

  it('is quiet on a clock it cannot read', () => {
    expect(empStormStrength(Number.NaN, start, until)).toBe(0);
    expect(empStormStrength(start + 5000, Number.NaN, until)).toBe(0);
  });

  it('shows only on a world large enough on screen to read it, fading in as it grows', () => {
    expect(empStormReach(6)).toBe(0);
    expect(empStormReach(12)).toBe(0);
    const middle = empStormReach(16);
    expect(middle).toBeGreaterThan(0);
    expect(middle).toBeLessThan(1);
    expect(empStormReach(20)).toBe(1);
    expect(empStormReach(400)).toBe(1);
    expect(empStormReach(Number.NaN)).toBe(0);
    let last = 0;
    for (let px = 0; px <= 40; px += 0.5) {
      expect(empStormReach(px)).toBeGreaterThanOrEqual(last);
      last = empStormReach(px);
    }
  });
});
