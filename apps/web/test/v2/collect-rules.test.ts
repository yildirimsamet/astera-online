import { describe, expect, it } from 'vitest';
import { COLLECT_THRESHOLD, collectState, type CollectInput } from '../../src/lib/collect.js';

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
