import { describe, expect, it } from 'vitest';
import { COLLECT_THRESHOLD, collectState, worksOutlook, type CollectInput } from '../../src/lib/collect.js';

/**
 * WHEN THE COLLECT BUBBLE STANDS OVER YOUR WORLD. Spec B13 (docs/ui-v2/gozlemevi.md).
 *
 * Production lands in the works, not in storage (D16), and stops when a vessel is
 * full. The bubble appears once the works hold a tenth of what they can, pulses
 * when a vessel is full, and says so plainly when the store has no room to take
 * what is waiting — collecting then would move nothing.
 */

const input = (over: Partial<CollectInput> = {}): CollectInput => ({
  caps: { alloy: 1_000, crystal: 1_000, deuterium: 0 },
  works: { alloy: 0, crystal: 0, deuterium: 0 },
  store: { alloy: 0, crystal: 0, deuterium: 0 },
  storeCaps: { alloy: 10_000, crystal: 10_000, deuterium: 5_000 },
  ...over,
});

describe('the collect bubble', () => {
  it('stays down until the works hold a tenth of what they can', () => {
    expect(COLLECT_THRESHOLD).toBe(0.1);
    expect(collectState(input({ works: { alloy: 150, crystal: 40, deuterium: 0 } })).ripe).toBe(false);
    expect(collectState(input({ works: { alloy: 150, crystal: 50, deuterium: 0 } })).ripe).toBe(true);
  });

  it('counts everything waiting', () => {
    expect(collectState(input({ works: { alloy: 150, crystal: 50, deuterium: 3 } })).waiting).toBe(203);
  });

  it('is full when any one vessel is', () => {
    expect(collectState(input({ works: { alloy: 999.6, crystal: 0, deuterium: 0 } })).full).toBe(true);
    expect(collectState(input({ works: { alloy: 900, crystal: 900, deuterium: 0 } })).full).toBe(false);
  });

  it('never calls a vessel with no capacity full', () => {
    expect(collectState(input({ caps: { alloy: 1_000, crystal: 1_000, deuterium: 0 } })).full).toBe(false);
  });

  it('is blocked when the store has no room for any of it', () => {
    const blocked = collectState(input({
      works: { alloy: 500, crystal: 0, deuterium: 0 },
      store: { alloy: 10_000, crystal: 10_000, deuterium: 0 },
    }));
    expect(blocked.blocked).toBe(true);
    expect(blocked.movable).toBe(0);
    const partly = collectState(input({
      works: { alloy: 500, crystal: 0, deuterium: 0 },
      store: { alloy: 9_800, crystal: 0, deuterium: 0 },
    }));
    expect(partly.blocked).toBe(false);
    expect(partly.movable).toBe(200);
  });

  it('has nothing to say about empty works', () => {
    const empty = collectState(input());
    expect(empty).toMatchObject({ waiting: 0, ripe: false, full: false, blocked: false });
  });
});

/**
 * RESOURCE BY RESOURCE (owner, 2026-09-24): a faulty refinery stops one resource, and a
 * partly full store leaves one resource behind after a collect — one total ("1.5k")
 * says neither. The works are read per resource, and so is the room the store has left.
 */
describe('the works, resource by resource', () => {
  it('says what each vessel holds', () => {
    const state = collectState(input({ works: { alloy: 150.7, crystal: 50, deuterium: 0 } }));
    expect(state.each).toEqual({ alloy: 150.7, crystal: 50, deuterium: 0 });
  });

  it('names the resources the store has no room left for', () => {
    const state = collectState(input({
      works: { alloy: 500, crystal: 300, deuterium: 0 },
      store: { alloy: 10_000, crystal: 2_000, deuterium: 0 },
    }));
    expect(state.noRoom).toEqual(['alloy']);
  });

  /** The top bar marks the one resource that has stopped, under its own store (owner, 2026-09-25). */
  it('names the resources whose vessel is full and has stopped', () => {
    const state = collectState(input({ works: { alloy: 999.6, crystal: 400, deuterium: 0 } }));
    expect(state.stopped).toEqual(['alloy']);
    expect(collectState(input({ works: { alloy: 900, crystal: 0, deuterium: 0 } })).stopped).toEqual([]);
  });

  it('names nothing as out of room when nothing of it is waiting', () => {
    const state = collectState(input({
      works: { alloy: 0, crystal: 300, deuterium: 0 },
      store: { alloy: 10_000, crystal: 0, deuterium: 0 },
    }));
    expect(state.noRoom).toEqual([]);
  });
});

/**
 * WHEN THE WORKS WILL BE FULL (owner, 2026-09-24): the reason to come back is the moment
 * production stops, so the pool says it — the soonest vessel to reach its rim.
 */
describe('the works outlook', () => {
  const caps = { alloy: 1_000, crystal: 400, deuterium: 0 };

  it('reads each vessel as its share of what it can hold', () => {
    const { fill } = worksOutlook({ caps, works: { alloy: 500, crystal: 400, deuterium: 0 }, rates: { alloy: 100, crystal: 50, deuterium: 0 } });
    expect(fill).toEqual({ alloy: 0.5, crystal: 1, deuterium: 0 });
  });

  it('is full at the soonest rim among the vessels still filling', () => {
    // Alloy: 500 left at 100/h = 5 h; crystal: 300 left at 50/h = 6 h.
    const { fullInMinutes } = worksOutlook({ caps, works: { alloy: 500, crystal: 100, deuterium: 0 }, rates: { alloy: 100, crystal: 50, deuterium: 0 } });
    expect(fullInMinutes).toBe(300);
  });

  it('skips a vessel already full and one that nothing flows into', () => {
    const { fullInMinutes } = worksOutlook({ caps, works: { alloy: 1_000, crystal: 100, deuterium: 0 }, rates: { alloy: 100, crystal: 0, deuterium: 20 } });
    expect(fullInMinutes).toBeNull();
  });

  it('never divides by a vessel with no capacity', () => {
    const { fill } = worksOutlook({ caps: { alloy: 0, crystal: 0, deuterium: 0 }, works: { alloy: 5, crystal: 0, deuterium: 0 }, rates: { alloy: 10, crystal: 0, deuterium: 0 } });
    expect(fill).toEqual({ alloy: 0, crystal: 0, deuterium: 0 });
  });
});
