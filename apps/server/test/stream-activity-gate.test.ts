import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { activityGate, isGalaxyActivity } from '../src/stream/activityGate.js';

/**
 * A COMMANDER HEARS THE GALAXY'S TRAFFIC AT A BOUNDED RATE. Capacity fix plan (2026-11-02).
 *
 * Each launch and landing sent every client in the galaxy to read `/api/galaxy/traffic`,
 * coalesced only over 250 ms. Twice the commanders is twice the readers of twice the
 * events: at 200 commanders it was already 3.5 times the five-second poll. The gate lives
 * on the server's side of the stream, so the clients already installed obey it as well.
 */
const shard = 'season-1';
const event = (kind: string) => ({ shard, kind });

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); });

const opened = (gapMs = 5_000) => {
  const delivered: string[] = [];
  const gate = activityGate((each) => { delivered.push(each.kind); }, gapMs, () => 0);
  return { delivered, gate };
};

it('delivers the first event at once, so a quiet galaxy stays instant', () => {
  const { delivered, gate } = opened();
  gate.note(event('shard:launch'));
  expect(delivered).toEqual(['shard:launch']);
});

it('holds what follows and delivers each kind once when the gap ends', () => {
  const { delivered, gate } = opened();
  gate.note(event('shard:launch'));
  gate.note(event('shard:launch'));
  gate.note(event('shard:arrival'));
  gate.note(event('shard:launch'));
  expect(delivered).toEqual(['shard:launch']);
  vi.advanceTimersByTime(4_999);
  expect(delivered).toEqual(['shard:launch']);
  vi.advanceTimersByTime(1);
  expect(delivered).toEqual(['shard:launch', 'shard:launch', 'shard:arrival']);
});

it('never loses the last event of a burst, and keeps the gap after a held delivery', () => {
  const { delivered, gate } = opened();
  gate.note(event('shard:launch'));
  gate.note(event('shard:mining'));
  vi.advanceTimersByTime(5_000);
  expect(delivered).toEqual(['shard:launch', 'shard:mining']);
  gate.note(event('shard:arrival'));
  expect(delivered).toEqual(['shard:launch', 'shard:mining']);
  vi.advanceTimersByTime(5_000);
  expect(delivered).toEqual(['shard:launch', 'shard:mining', 'shard:arrival']);
});

it('opens again after a quiet gap', () => {
  const { delivered, gate } = opened();
  gate.note(event('shard:launch'));
  vi.advanceTimersByTime(5_000);
  gate.note(event('shard:arrival'));
  expect(delivered).toEqual(['shard:launch', 'shard:arrival']);
});

it('spreads held deliveries, so a galaxy of commanders does not read in one instant', () => {
  const delivered: number[] = [];
  const gate = activityGate(() => { delivered.push(Date.now()); }, 5_000, () => 0.5);
  const start = Date.now();
  gate.note(event('shard:launch'));
  gate.note(event('shard:launch'));
  vi.advanceTimersByTime(5_499);
  expect(delivered).toEqual([start]);
  vi.advanceTimersByTime(1);
  expect(delivered).toEqual([start, start + 5_500]);
});

it('delivers nothing after the stream is gone', () => {
  const { delivered, gate } = opened();
  gate.note(event('shard:launch'));
  gate.note(event('shard:arrival'));
  gate.cancel();
  vi.advanceTimersByTime(60_000);
  expect(delivered).toEqual(['shard:launch']);
  expect(vi.getTimerCount()).toBe(0);
});

it('gates only the kinds that fire all day, never what a commander must hear at once', () => {
  for (const kind of ['launch', 'arrival', 'mining', 'pirate']) expect(isGalaxyActivity(`shard:${kind}`)).toBe(true);
  for (const kind of ['shard:rollover', 'shard:season', 'shard:control', 'shard:impact', 'shard:transfer', 'shard:world', 'raided', 'global:announcement']) {
    expect(isGalaxyActivity(kind)).toBe(false);
  }
});
