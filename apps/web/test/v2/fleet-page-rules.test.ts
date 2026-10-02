import { describe, expect, it } from 'vitest';
import { garrisonOf, legProgress, paceShown, recallPreview, roomOf, sumFleets } from '../../src/lib/fleetPage.js';

/**
 * THE FLEET PAGE'S ARITHMETIC. Spec E4, B11 (docs/ui-v2/gozlemevi.md).
 *
 * A flight row shows how far along its leg is, the pace it flies at when that is
 * not full speed, and — on a flight that may still turn — how long the way home
 * would take, because a recall is not free: the fleet stays in the air as long
 * again as it has already flown (K8).
 */
describe('how far along a leg is', () => {
  it('runs from departure to arrival, clamped at both ends', () => {
    const span = { from: 1_000, to: 5_000 };
    expect(legProgress(span, 3_000)).toBe(0.5);
    expect(legProgress(span, 0)).toBe(0);
    expect(legProgress(span, 9_000)).toBe(1);
  });

  it('knows nothing about a fogged leg, and calls an instant leg done', () => {
    expect(legProgress(null, 3_000)).toBeNull();
    expect(legProgress({ from: 2_000, to: 2_000 }, 1_000)).toBe(1);
  });
});

describe('what a recall would cost', () => {
  it('brings the fleet home in the time already flown', () => {
    expect(recallPreview(10_000, 70_000)).toEqual({ backInMs: 60_000, homeAt: 130_000 });
  });

  it('never quotes a negative flight for a clock a moment behind the departure', () => {
    expect(recallPreview(10_000, 9_000)).toEqual({ backInMs: 0, homeAt: 9_000 });
  });
});

describe('the pace worth a label', () => {
  it('says nothing at full speed or when the server did not say', () => {
    expect(paceShown(1)).toBeNull();
    expect(paceShown(undefined)).toBeNull();
  });

  it('names a slowed flight as a whole percentage', () => {
    expect(paceShown(0.75)).toBe(75);
    expect(paceShown(0.1)).toBe(10);
  });
});

describe('a world’s garrison', () => {
  it('lists the hulls standing at home, most first, and drops the empty ones', () => {
    expect(garrisonOf({ COURIER: 1, DART: 12, TALON: 0 })).toEqual([
      { hull: 'DART', count: 12 },
      { hull: 'COURIER', count: 1 },
    ]);
  });

  it('breaks a tie by the catalogue order, so the list never reshuffles', () => {
    const once = garrisonOf({ TALON: 3, DART: 3 });
    expect(garrisonOf({ DART: 3, TALON: 3 })).toEqual(once);
  });
});

describe('a world’s room', () => {
  it('reads the Hangar and the ground pool, and says when either is full', () => {
    expect(roomOf({ hangar: 80, hangarUsed: 80, hangarCeiling: 180, ground: 20, groundUsed: 4 })).toEqual({
      hangar: { used: 80, total: 80, full: true, ceiling: 180 },
      ground: { used: 4, total: 20, full: false },
    });
  });

  it('has no Hangar reading from a server that predates it', () => {
    expect(roomOf({ ground: 20, groundUsed: 4 }).hangar).toBeNull();
    expect(roomOf(undefined)).toEqual({ hangar: null, ground: null });
  });
});

describe('sumFleets', () => {
  it('adds the same hull across piles instead of keeping the last count', () => {
    expect(sumFleets({ DART: 3 }, { DART: 2, PIKE: 1 }, { BALLISTA: 2 })).toEqual({ DART: 5, PIKE: 1, BALLISTA: 2 });
    expect(sumFleets()).toEqual({});
  });
});
