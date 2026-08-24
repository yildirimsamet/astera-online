import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { keys } from '../src/api/queries.js';
import {
  COALESCE_MS,
  isShardEvent,
  readsForShardEvent,
  shardCoalescer,
} from '../src/session/shardEvents.js';

/**
 * WHAT A GALAXY-WIDE EVENT COSTS THIS CLIENT. D53.
 *
 * The broadcast is the thing that makes the disc live, and it is also the easiest
 * way to turn one launch into three hundred simultaneous reads. Both
 * halves are asserted here: that an event moves the right payload, and that a
 * burst of them moves it once.
 */
describe('what a shard event asks the client to read', () => {
  it('recognises the namespace, and only the namespace', () => {
    expect(isShardEvent('shard:launch')).toBe(true);
    expect(isShardEvent('shard:world')).toBe(true);
    expect(isShardEvent('shard:score')).toBe(true);
    expect(isShardEvent('shard:chat')).toBe(true);
    // Notification kinds share this string space and must never be mistaken for
    // one — a shard kind read as a notification would put a line in Signals that
    // nothing wrote, and vice versa.
    expect(isShardEvent('raided')).toBe(false);
    expect(isShardEvent('fleet_returned')).toBe(false);
    expect(isShardEvent('probe_report')).toBe(false);
  });

  it('sends a launch to the one list that carries craft in the air', () => {
    expect(readsForShardEvent('shard:launch')).toEqual([keys.traffic]);
  });

  /** A resolved raid empties the contact AND leaves a debris field behind. */
  it('sends an arrival to traffic and to the field it may have created', () => {
    expect(readsForShardEvent('shard:arrival')).toEqual([keys.traffic, keys.miningField]);
  });

  it('sends a mining run to both lists it appears on', () => {
    expect(readsForShardEvent('shard:mining')).toEqual([keys.miningField, keys.traffic]);
  });

  /**
   * THE EXPENSIVE ONE, AND THE REASON THE KINDS ARE THIS NARROW.
   *
   * `/api/galaxy` carries a telescope reading for every world the caller watches
   * and provokes a `lastConfirmedAt` write. Mapping flights to it would refetch
   * the costliest payload in the game on every launch in a fifty-player shard,
   * for a payload a flight cannot change.
   */
  it('never sends a flight to the galaxy payload', () => {
    for (const kind of ['shard:launch', 'shard:arrival', 'shard:mining']) {
      expect(readsForShardEvent(kind), kind).not.toContainEqual(keys.galaxy);
    }
    expect(readsForShardEvent('shard:world')).toEqual([keys.galaxy, keys.leaderboard]);
    expect(readsForShardEvent('shard:score')).toEqual([keys.leaderboard]);
    expect(readsForShardEvent('shard:chat')).toEqual([keys.chatMessages, keys.chatUnread]);
    expect(readsForShardEvent('shard:chronicle')).toEqual([keys.chronicle]);
  });

  /**
   * A kind this client has never heard of must be INERT — not a crash, and not a
   * blanket refetch. Same reasoning as parsing a notification kind as a string:
   * one unknown value must never be able to cost more than it is worth.
   */
  it('does nothing at all with a kind it does not know', () => {
    expect(readsForShardEvent('shard:teleportation')).toEqual([]);
    expect(readsForShardEvent('shard:')).toEqual([]);
  });
});

describe('the coalescer', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('reads once for a burst, not once per event', () => {
    const flush = vi.fn();
    const c = shardCoalescer(flush);

    // Four commanders launching in the same second, which is a perfectly ordinary
    // evening in a fifty-player galaxy.
    for (let i = 0; i < 4; i += 1) c.note('shard:launch');
    expect(flush).not.toHaveBeenCalled();

    vi.advanceTimersByTime(COALESCE_MS);
    expect(flush).toHaveBeenCalledTimes(1);
    expect(flush.mock.calls[0]?.[0]).toEqual([keys.traffic]);
  });

  /** Different kinds in one window are merged, and each read appears once. */
  it('merges the reads and never repeats one', () => {
    const flush = vi.fn();
    const c = shardCoalescer(flush);

    c.note('shard:launch'); // traffic
    c.note('shard:arrival'); // traffic, mining
    c.note('shard:mining'); // mining, traffic
    c.note('shard:world'); // galaxy

    vi.advanceTimersByTime(COALESCE_MS);
    expect(flush).toHaveBeenCalledTimes(1);
    const reads = flush.mock.calls[0]?.[0] as readonly (readonly string[])[];
    expect(reads).toHaveLength(4);
    expect(reads).toContainEqual(keys.traffic);
    expect(reads).toContainEqual(keys.miningField);
    expect(reads).toContainEqual(keys.galaxy);
    expect(reads).toContainEqual(keys.leaderboard);
  });

  /**
   * IT IS A COALESCING WINDOW, NOT A POLL.
   *
   * On a quiet galaxy a single event still lands within a quarter second of the
   * instant it names — which is the whole point of replacing a twenty-second
   * timer. A window that batched into fixed ticks would have traded one latency
   * for a smaller one instead of removing it.
   */
  it('still lands within its window on a quiet galaxy', () => {
    const flush = vi.fn();
    const c = shardCoalescer(flush);
    c.note('shard:launch');
    vi.advanceTimersByTime(COALESCE_MS);
    expect(flush).toHaveBeenCalledTimes(1);
  });

  /** And the window re-arms, so a second burst is not swallowed by the first. */
  it('arms again for the next burst', () => {
    const flush = vi.fn();
    const c = shardCoalescer(flush);

    c.note('shard:launch');
    vi.advanceTimersByTime(COALESCE_MS);
    c.note('shard:world');
    vi.advanceTimersByTime(COALESCE_MS);

    expect(flush).toHaveBeenCalledTimes(2);
    expect(flush.mock.calls[1]?.[0]).toEqual([keys.galaxy, keys.leaderboard]);
  });

  /**
   * An unknown kind must not arm a timer that will then flush nothing — that is a
   * wake-up bought for a message this client cannot act on.
   */
  it('does not arm a flush for a kind it cannot act on', () => {
    const flush = vi.fn();
    const c = shardCoalescer(flush);
    c.note('shard:something-new');
    vi.advanceTimersByTime(COALESCE_MS * 4);
    expect(flush).not.toHaveBeenCalled();
  });

  /** A pending flush must not outlive the component that armed it. */
  it('cancels cleanly', () => {
    const flush = vi.fn();
    const c = shardCoalescer(flush);
    c.note('shard:launch');
    c.cancel();
    vi.advanceTimersByTime(COALESCE_MS * 4);
    expect(flush).not.toHaveBeenCalled();
  });

  /** And a cancelled coalescer is reusable — the stream reconnects. */
  it('works again after being cancelled', () => {
    const flush = vi.fn();
    const c = shardCoalescer(flush);
    c.note('shard:launch');
    c.cancel();
    c.note('shard:world');
    vi.advanceTimersByTime(COALESCE_MS);
    expect(flush).toHaveBeenCalledTimes(1);
    // The launch was cancelled with the timer; only the new event survives.
    expect(flush.mock.calls[0]?.[0]).toEqual([keys.galaxy, keys.leaderboard]);
  });
});
