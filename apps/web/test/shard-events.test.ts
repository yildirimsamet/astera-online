import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { keys } from '../src/api/queries.js';
import {
  COALESCE_MS,
  isGlobalEvent,
  isPrivateEvent,
  isShardEvent,
  readsForGlobalEvent,
  readsForPrivateEvent,
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

  it('refreshes asteroid entitlement when damage can shrink a sensor post', () => {
    expect(readsForShardEvent('shard:impact')).toContainEqual(keys.miningField);
  });

  it('refreshes asteroid entitlement when a controlled world changes hands', () => {
    expect(readsForShardEvent('shard:control')).toContainEqual(keys.miningField);
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
    expect(readsForShardEvent('shard:score')).toEqual([keys.leaderboard, keys.galaxy]);
    expect(readsForShardEvent('shard:chat')).toEqual([keys.chatMessages, keys.chatUnread]);
    expect(readsForShardEvent('shard:chronicle')).toEqual([keys.chronicle]);
    expect(readsForShardEvent('shard:galaxy-event')).toEqual([
      keys.galaxyEvents,
      keys.notifications,
      keys.chronicle,
      keys.miningField,
    ]);
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

describe('what a global operator event asks the client to read', () => {
  it('refreshes announcements and nothing from the live galaxy', () => {
    expect(isGlobalEvent('global:announcement')).toBe(true);
    expect(isGlobalEvent('shard:announcement')).toBe(false);
    expect(readsForGlobalEvent('global:announcement')).toEqual([keys.announcements]);
  });

  it('keeps unknown global events inert', () => {
    expect(readsForGlobalEvent('global:something-new')).toEqual([]);
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

/**
 * WHAT A PRIVATE CLAN EVENT COSTS THIS CLIENT. D114.
 *
 * These are player events, so they legitimately reach past the clan surface — but
 * they arrive at the chat's own ceiling of five per ten seconds per clanmate, and
 * nothing routed them at all: every one fell through to the blanket resync of all
 * twenty-two live reads, for five people at once.
 */
describe('what a private clan event asks the client to read', () => {
  it('recognises its own namespace and never the shard one', () => {
    expect(isPrivateEvent('private:clan-chat')).toBe(true);
    expect(isPrivateEvent('shard:clan')).toBe(false);
    expect(isShardEvent('private:clan-chat')).toBe(false);
    // Notification kinds share this string space too.
    expect(isPrivateEvent('raided')).toBe(false);
  });

  it('sends a message to the conversation and the beacon, and nowhere else', () => {
    expect(readsForPrivateEvent('private:clan-chat')).toEqual([keys.clanBadge, keys.clanChat]);
  });

  it('sends a roster change to every surface that names the roster', () => {
    expect(readsForPrivateEvent('private:clan-membership'))
      .toEqual([
        keys.clanBadge,
        keys.clanHome,
        keys.clanStrength,
        keys.clanEvents,
        keys.galaxy,
        keys.leaderboard,
      ]);
  });

  /**
   * The one kind that legitimately leaves the clan surface: a convoy that lands
   * puts real ships and real resources on a world, so the planet payload moved.
   */
  it('sends a convoy to the world it changes as well as to the clan surface', () => {
    expect(readsForPrivateEvent('private:clan-aid')).toEqual([
      keys.clanAid, keys.clanHome, keys.planet, keys.planets, keys.pending, keys.traffic,
    ]);
  });

  it('sends a mining launch to every private surface changed on another device', () => {
    expect(readsForPrivateEvent('private:mining')).toEqual([
      keys.miningStatus,
      keys.pending,
      keys.planet,
    ]);
  });

  it('refreshes only the two Telescope surfaces when a watched fleet moves', () => {
    expect(readsForPrivateEvent('private:sight')).toEqual([keys.galaxy, keys.intel]);
  });

  it('refreshes only traffic for an entitled strategic interception witness', () => {
    expect(readsForPrivateEvent('private:strategic-sight')).toEqual([keys.traffic]);
  });

  /**
   * The opposite default to the shard table's inert `[]`. A newer server naming a
   * kind this build has never heard of still described something that happened to
   * this commander, so `null` sends the caller to the full resync.
   */
  it('answers null for a kind it does not know, rather than nothing', () => {
    expect(readsForPrivateEvent('private:clan-unheard-of')).toBeNull();
    expect(readsForShardEvent('shard:unheard-of')).toEqual([]);
  });
});
