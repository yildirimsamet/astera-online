import { describe, expect, it } from 'vitest';
import { decideSpawnGate, gateSpawns, SPAWN_GATE } from '../src/spawnGate.js';

/**
 * Owner rule, 2026-10-17: outside asteroid showers, the rocks drifting in a galaxy — and,
 * with no exception at all, its pirate fleets — never outnumber the people who played in
 * the last five minutes. Each birth is checked at its own instant; a birth that would
 * reach the cap is skipped.
 */
const rock = (index: number, appearsAt: number, expiresAt = appearsAt + 90) => ({ index, appearsAt, expiresAt });

describe('decideSpawnGate', () => {
  it('uses a five-minute presence window', () => {
    expect(SPAWN_GATE.onlineWindowMinutes).toBe(5);
  });

  it('keeps births while the drifting count stays below the cap and skips the one that would reach it', () => {
    const skipped = decideSpawnGate({ births: [rock(1, 10), rock(2, 11), rock(3, 12)], alive: [], cap: 2 });
    expect(skipped).toEqual([3]);
  });

  it('counts already drifting rocks and lets an expired one free a place', () => {
    const alive = [rock(9, 0, 15)];
    const skipped = decideSpawnGate({ births: [rock(1, 10), rock(2, 14), rock(3, 16)], alive, cap: 2 });
    // At 10: 1 alive → keep. At 14: 2 alive → skip. At 16: rock 9 expired, 1 alive → keep.
    expect(skipped).toEqual([2]);
  });

  it('skips every birth when nobody played in the window', () => {
    expect(decideSpawnGate({ births: [rock(1, 10), rock(2, 11)], alive: [], cap: 0 })).toEqual([1, 2]);
  });

  it('never skips inside an exempt window, but those births still count afterwards', () => {
    const exempt = (minute: number) => minute >= 10 && minute < 20;
    const skipped = decideSpawnGate({
      births: [rock(1, 10), rock(2, 11), rock(3, 12), rock(4, 21)], alive: [], cap: 1, exempt,
    });
    expect(skipped).toEqual([4]);
  });

  it('decides in birth order, breaking ties by index, whatever the input order', () => {
    const skipped = decideSpawnGate({ births: [rock(7, 10), rock(5, 10), rock(6, 9)], alive: [], cap: 2 });
    expect(skipped).toEqual([7]);
  });

  it('rejects a negative or fractional cap', () => {
    expect(() => decideSpawnGate({ births: [], alive: [], cap: -1 })).toThrow(RangeError);
    expect(() => decideSpawnGate({ births: [], alive: [], cap: 1.5 })).toThrow(RangeError);
  });
});

describe('gateSpawns', () => {
  const field = [rock(1, 5), rock(2, 12), rock(3, 15), rock(4, 25)];

  it('passes the whole field through while the gate is off', () => {
    expect(gateSpawns(field, null, new Set())).toEqual(field);
  });

  it('keeps births before activation, hides skipped and not-yet-decided births after it', () => {
    const gated = gateSpawns(field, { fromMinute: 10, throughMinute: 20 }, new Set([3]));
    expect(gated.map((spec) => spec.index)).toEqual([1, 2]);
  });

  it('never hides a pre-activation birth even if an index was recorded', () => {
    const gated = gateSpawns(field, { fromMinute: 10, throughMinute: 30 }, new Set([1]));
    expect(gated.map((spec) => spec.index)).toEqual([1, 2, 3, 4]);
  });
});
