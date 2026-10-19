import { describe, expect, it } from 'vitest';
import { pendingSchema, trafficSchema } from '../src/api/schemas.js';
import { towingFormation, towCablePoint, towAnchor, towRoll } from '../src/galaxy/towing.js';
import { hullVisualScale } from '../src/galaxy/flightVisual.js';

describe('reward towing formation', () => {
  it('separates all three prizes, including same-type ships, from the active wing without mutating it', () => {
    const fleet = { DART: 22, TALON: 2, COURIER: 1 };
    const before = { ...fleet };
    const view = towingFormation(fleet, { DART: 2, TALON: 1 }, 1);
    expect(fleet).toEqual(before);
    expect(view.markers.filter(m => m.hull === 'DART').reduce((sum, m) => sum + m.filled, 0)).toBe(20);
    expect(view.tows.map(t => t.hull).sort()).toEqual(['DART', 'DART', 'TALON']);
    expect(view.slots[view.tugIndex!]?.[2]).toBe(Math.max(...view.slots.map(slot => slot[2])));
    for (const [index, tow] of view.tows.entries()) {
      expect(tow.previous).toBe(index - 1);
      expect(tow.position[0]).toBe(0);
      expect(tow.position[1]).toBe(0);
      if (index > 0) expect(tow.position[2]).toBeLessThan(view.tows[index - 1]!.position[2]);
      const nose = tow.position[2] + hullVisualScale(tow.hull, 1) / 2;
      for (const [index, slot] of view.slots.entries()) {
        expect(nose).toBeLessThan(slot[2] - hullVisualScale(view.markers[index]!.hull, 1) / 2);
      }
    }
    for (const [i, a] of view.tows.entries()) for (const b of view.tows.slice(i + 1)) {
      expect(Math.hypot(...a.position.map((v, axis) => v - b.position[axis]!)))
        .toBeGreaterThan((hullVisualScale(a.hull, 1) + hullVisualScale(b.hull, 1)) / 2);
    }
    expect(towingFormation(fleet, { DART: 2, TALON: 1 }, 1)).toEqual(view);
  });
  it.each([1, 2, 3, 7])('chains all %i prizes in order without truncation', count => {
    const view = towingFormation({DART: count, CITADEL: 1}, {DART: count}, 1);
    expect(view.tows).toHaveLength(count);
    expect(view.tows.map(tow => tow.previous)).toEqual(Array.from({length: count}, (_, index) => index - 1));
    expect(view.markers.map(marker => marker.hull)).toEqual(['CITADEL']);
  });

  it('does not invent a tug or a missing reward', () => {
    expect(towingFormation({}, { DART: 1 }, 1).tows).toEqual([]);
    expect(towingFormation({ DART: 1 }, { DART: 1 }, 1).tows).toEqual([]);
    expect(towingFormation({ DART: 1 }, { DART: 1 }, 1).markers[0]?.filled).toBe(1);
    expect(towingFormation({ DART: 2 }, { TALON: 3 }, 1).tows).toEqual([]);
    expect(towingFormation({ DART: 2 }, undefined, 1).markers[0]?.filled).toBe(2);
  });
  it('attaches to the posed, rolling hull instead of floating below its nose', () => {
    const tow = {hull: 'DART' as const, position: [0, -1, -4] as [number, number, number], previous: -1};
    const nose = towAnchor(tow, 1, 0, 0, true);
    expect(nose[1]).toBeGreaterThan(tow.position[1]);
    expect(nose[2]).toBeGreaterThan(tow.position[2]);
    const tilted = towAnchor(tow, 1, 5000, 0, true);
    expect(tilted[0]).not.toBe(nose[0]);
    expect(Math.hypot(tilted[0], tilted[1] - tow.position[1])).toBeCloseTo(nose[1] - tow.position[1]);
    expect(tilted[2]).toBe(nose[2]);
    expect(Math.abs(towRoll(5000, 0))).toBeLessThanOrEqual(.09);
    expect(towAnchor(tow, 1, 5000, 0, false)[2]).toBeLessThan(tow.position[2]);
  });

  it('keeps the cable fixed at both hulls and sags below the formation', () => {
    const start: [number, number, number] = [0, 0, 0];
    const end: [number, number, number] = [1, -2, -12];
    expect(towCablePoint(start, end, 3, 0)).toEqual(start);
    expect(towCablePoint(start, end, 3, 1)).toEqual(end);
    expect(towCablePoint(start, end, 3, .5)[1]).toBeLessThan(-3);
    for (let i = 0; i <= 20; i++) expect(towCablePoint(start, end, 0, i / 20).every(Number.isFinite)).toBe(true);
  });
});

it('preserves towing metadata through both client API contracts', () => {
  const now = new Date().toISOString();
  const towing = { DART: 2, TALON: 1 };
  expect(pendingSchema.parse({pending: [{kind: 'intergalactic_convoy', targetName: '', minutesRemaining: 2,
    arriveAt: now, leg: 'return', fleet: {DART: 3, TALON: 1}, towing}]}).pending[0]).toHaveProperty('towing', towing);
  expect(trafficSchema.parse({contacts: [{id: 'flight', kind: 'fleet', from: {x: 0, y: 0, z: 0},
    to: {x: 1, y: 0, z: 0}, startAt: now, endAt: now, fleet: {DART: 3, TALON: 1}, towing}]}).contacts[0])
    .toHaveProperty('towing', towing);
});
