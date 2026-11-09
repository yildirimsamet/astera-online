import { describe, expect, it } from 'vitest';
import { GALAXY, JUMP_FLIGHT, jumpPosition, jumpThrottle, jumpTravel, starterGalaxyCentre, watchedStop } from '../src/index.js';

/**
 * THE JUMP IS ONE FLIGHT, ON ONE CLOCK (owner, 2026-11-09). The pilot watches the ship light, catch,
 * cross the gap and stop at its new world; everyone else watching sees the same seconds of it.
 */
const { ignite, lit, depart, arrive } = JUMP_FLIGHT;
const samples = (from: number, to: number, step = 0.05) => Array.from({ length: Math.floor((to - from) / step) + 1 }, (_, i) => from + i * step).filter(s => s <= to);

describe('the drive lighting', () => {
  it('is dark before the ignition', () => {
    for (const s of samples(0, ignite - 0.01)) expect(jumpThrottle(s)).toBe(0);
  });

  it('catches twice and dies back, then holds', () => {
    const before = samples(ignite, lit - 0.6, 0.02).map(jumpThrottle);
    let peaks = 0;
    for (let i = 1; i < before.length - 1; i++) if (before[i]! > 0.3 && before[i]! >= before[i - 1]! && before[i]! > before[i + 1]!) peaks++;
    expect(peaks).toBe(2);
    expect(Math.min(...samples(ignite + 0.5, ignite + 1, 0.02).map(jumpThrottle))).toBeLessThan(0.2);
    expect(jumpThrottle(lit)).toBe(1);
  });

  it('burns full across the gap, eases off as the ship brakes, and is out at the stop', () => {
    for (const s of samples(lit, (depart + arrive) / 2)) expect(jumpThrottle(s)).toBe(1);
    expect(jumpThrottle(arrive - 1)).toBeLessThan(0.6);
    expect(jumpThrottle(arrive - 1)).toBeGreaterThan(0);
    expect(jumpThrottle(arrive)).toBe(0);
  });
});

describe('the way across', () => {
  it('starts at the berth and ends at the stop', () => {
    expect(jumpTravel(0)).toBe(0);
    expect(jumpTravel(depart)).toBe(0);
    expect(jumpTravel(arrive)).toBe(1);
    expect(jumpTravel(arrive + 10)).toBe(1);
  });

  it('goes slow, then fast, then slow', () => {
    const span = arrive - depart;
    const speed = (s: number) => (jumpTravel(s + 0.01) - jumpTravel(s)) / 0.01;
    expect(jumpTravel(depart + span * 0.1)).toBeLessThan(0.03);
    expect(1 - jumpTravel(arrive - span * 0.1)).toBeLessThan(0.03);
    expect(speed(depart + span / 2)).toBeGreaterThan(speed(depart + span * 0.2) * 1.5);
    expect(speed(depart + span / 2)).toBeGreaterThan(speed(arrive - span * 0.2) * 1.5);
    const along = samples(0, arrive + 1).map(jumpTravel);
    for (let i = 1; i < along.length; i++) expect(along[i]!).toBeGreaterThanOrEqual(along[i - 1]!);
  });

  it('places the ship on the straight way between', () => {
    const from = { x: 100, y: 0, z: 0 }, to = { x: 300, y: 50, z: -40 };
    expect(jumpPosition(from, to, 0)).toEqual(from);
    expect(jumpPosition(from, to, arrive)).toEqual(to);
    const half = jumpPosition(from, to, depart + (arrive - depart) / 2);
    expect(half.x).toBeCloseTo(200);
    expect(half.y).toBeCloseTo(25);
  });
});

describe('what everyone else sees', () => {
  it('ends where the way to the main galaxy crosses its rim, and nowhere nearer a world', () => {
    const from = starterGalaxyCentre(2);
    const stop = watchedStop(from);
    expect(Math.hypot(stop.x, stop.y, stop.z)).toBeCloseTo(GALAXY.radius);
    const out = Math.hypot(from.x, from.y, from.z);
    expect(stop.x / GALAXY.radius).toBeCloseTo(from.x / out);
    expect(stop.z / GALAXY.radius).toBeCloseTo(from.z / out);
  });

  it('does not move a ship that is already inside the rim', () => {
    expect(watchedStop({ x: 10, y: 0, z: 0 })).toEqual({ x: 10, y: 0, z: 0 });
  });
});
