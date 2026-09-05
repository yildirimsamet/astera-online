import { describe, expect, it } from 'vitest';
import { BOTS } from '../src/services/bots/personas.js';
import { botsAwakeAt } from '../src/services/bots/schedule.js';

/**
 * THE SHIFT ROSTER, AND IT IS THE HALF OF THIS FEATURE A PLAYER CAN COUNT.
 *
 * Owner instruction: nobody awake between 01:00 and 08:00 Türkiye time, and
 * between four and twelve of them awake at every other minute of the day. Both
 * are absolute, so both are asserted minute by minute across whole days rather
 * than sampled — a floor that holds at 20:00 and dips to three at 08:07 is not a
 * floor, and 08:07 is exactly where a naive edge jitter puts the hole.
 */

/** A wall-clock instant in Türkiye, as the UTC moment the server actually holds. */
const trt = (day: number, hour: number, minute = 0): Date =>
  new Date(Date.UTC(2026, 8, day, hour - 3, minute));

const SEED = 20260904;

const minutesOfDay = function* (day: number): Generator<{ hour: number; minute: number; at: Date }> {
  for (let hour = 0; hour < 24; hour++) {
    for (let minute = 0; minute < 60; minute++) {
      yield { hour, minute, at: trt(day, hour, minute) };
    }
  }
};

describe('bot shift roster', () => {
  it('leaves the galaxy to the players between 01:00 and 08:00 Türkiye time', () => {
    for (let day = 10; day < 17; day++) {
      for (const { hour, minute, at } of minutesOfDay(day)) {
        if (hour < 1 || hour >= 8) continue;
        const awake = botsAwakeAt(BOTS.perGalaxy, SEED, at);
        expect(awake.size, `${String(hour)}:${String(minute)} on day ${String(day)}`).toBe(0);
      }
    }
  });

  it('holds the four-to-twelve envelope at every waking minute', () => {
    for (let day = 10; day < 17; day++) {
      for (const { hour, minute, at } of minutesOfDay(day)) {
        if (hour >= 1 && hour < 8) continue;
        const awake = botsAwakeAt(BOTS.perGalaxy, SEED, at);
        const where = `${String(hour)}:${String(minute)} on day ${String(day)}`;
        expect(awake.size, where).toBeGreaterThanOrEqual(4);
        expect(awake.size, where).toBeLessThanOrEqual(BOTS.perGalaxy);
      }
    }
  });

  it('reaches the full roster at the evening peak and thins out by morning', () => {
    const peak = botsAwakeAt(BOTS.perGalaxy, SEED, trt(11, 21, 15));
    const morning = botsAwakeAt(BOTS.perGalaxy, SEED, trt(11, 8, 15));
    expect(peak.size).toBe(BOTS.perGalaxy);
    expect(morning.size).toBeLessThan(peak.size);
  });

  it('names only ordinals the galaxy actually seated', () => {
    for (const { at } of minutesOfDay(12)) {
      for (const ordinal of botsAwakeAt(BOTS.perGalaxy, SEED, at)) {
        expect(Number.isInteger(ordinal)).toBe(true);
        expect(ordinal).toBeGreaterThanOrEqual(0);
        expect(ordinal).toBeLessThan(BOTS.perGalaxy);
      }
    }
  });

  it('answers the same question the same way', () => {
    const at = trt(11, 19, 40);
    const first = [...botsAwakeAt(BOTS.perGalaxy, SEED, at)].sort((a, b) => a - b);
    const second = [...botsAwakeAt(BOTS.perGalaxy, SEED, at)].sort((a, b) => a - b);
    expect(second).toEqual(first);
  });

  it('does not run the same shift every day', () => {
    const days = [10, 11, 12, 13, 14].map((day) =>
      [...botsAwakeAt(BOTS.perGalaxy, SEED, trt(day, 9, 0))].sort((a, b) => a - b).join(','));
    expect(new Set(days).size).toBeGreaterThan(1);
  });

  it('gives every commander a share of the week', () => {
    const seen = new Set<number>();
    for (let day = 10; day < 17; day++) {
      for (let hour = 8; hour < 24; hour++) {
        for (const ordinal of botsAwakeAt(BOTS.perGalaxy, SEED, trt(day, hour))) seen.add(ordinal);
      }
    }
    expect(seen.size).toBe(BOTS.perGalaxy);
  });

  it('keeps a session in one piece rather than blinking, and gives everyone a break', () => {
    for (let ordinal = 0; ordinal < BOTS.perGalaxy; ordinal++) {
      const runs: number[] = [];
      let run = 0;
      for (const { at } of minutesOfDay(11)) {
        if (botsAwakeAt(BOTS.perGalaxy, SEED, at).has(ordinal)) run++;
        else {
          if (run > 0) runs.push(run);
          run = 0;
        }
      }
      if (run > 0) runs.push(run);

      // A commander who appears for four minutes and vanishes reads as a script.
      for (const length of runs) {
        expect(length, `bot ${String(ordinal)} session length`).toBeGreaterThanOrEqual(BOTS.slotMinutes);
      }
      // And one who is on for every waking minute of every day reads as one too.
      // `maxSessionSlots` is what buys this: the roster rotates rather than parking.
      expect(runs.length, `bot ${String(ordinal)} sessions in a day`).toBeGreaterThanOrEqual(2);
      const awakeMinutes = runs.reduce((sum, length) => sum + length, 0);
      expect(awakeMinutes, `bot ${String(ordinal)} awake minutes`).toBeLessThan(17 * 60);
    }
  });

  it('scales a smaller roster without ever emptying the galaxy', () => {
    for (const perGalaxy of [4, 6, 8]) {
      for (const { hour, at } of minutesOfDay(11)) {
        const awake = botsAwakeAt(perGalaxy, SEED, at);
        if (hour >= 1 && hour < 8) {
          expect(awake.size).toBe(0);
          continue;
        }
        expect(awake.size).toBeGreaterThanOrEqual(1);
        expect(awake.size).toBeLessThanOrEqual(perGalaxy);
      }
    }
  });

  it('reads the Türkiye calendar day, not the UTC one', () => {
    // 00:30 TRT is 21:30 UTC on the previous date. A roster keyed off the UTC day
    // would change shift in the middle of the busiest hour of the evening.
    const before = botsAwakeAt(BOTS.perGalaxy, SEED, trt(11, 23, 45));
    const after = botsAwakeAt(BOTS.perGalaxy, SEED, trt(12, 0, 15));
    const shared = [...before].filter((ordinal) => after.has(ordinal));
    expect(shared.length).toBeGreaterThan(0);
  });

  it('is empty for a galaxy that seated nobody', () => {
    expect(botsAwakeAt(0, SEED, trt(11, 20)).size).toBe(0);
  });
});
