import { expect, it } from 'vitest';
import { claimRace } from './colony-claim-study.js';
const player = { id: 'p', distance: 1250, readyAt: 0,
  stock: { alloy: 10000, crystal: 10000, deuterium: 1000 }, windows: [{ start: 0, end: 10 }] };

it('does not issue settlement commands at an offline raid completion', () => {
  const r = claimRace([player], 120);
  expect(r.owner).toBeNull();
  expect(r.log.some(e => e.kind === 'raid-resolved')).toBe(true);
  expect(r.log.some(e => e.kind === 'settlement-launched')).toBe(false);
});
it('can settle offline after a valid online command', () => {
  const r = claimRace([{ ...player, windows: [{ start: 0, end: 15 }] }], 120);
  expect(r.owner).toBe('p');
  expect(r.acquiredAt).toBeGreaterThan(15);
});
it('allows a short session to settle a nearby target', () => {
  expect(claimRace([{ ...player, distance: 400 }], 120).owner).toBe('p');
});
it('lets an informed player omit a slow cargo escort when opening an empty colony', () => {
  const r = claimRace([{ ...player, raidMode: 'combat-only' as const }], 120);
  expect(r.owner).toBe('p');
});
it('never creates a second owner and returns the losing shipment after travel', () => {
  const r = claimRace([{ ...player, id: 'a', windows: [{ start: 0, end: 90 }] },
    { ...player, id: 'b', windows: [{ start: 0, end: 90 }] }], 120);
  expect(r.log.filter(e => e.kind === 'acquired')).toHaveLength(1);
  const returned = r.log.find(e => e.kind === 'settlement-returned');
  expect(returned).toBeDefined();
  expect(returned!.time).toBeGreaterThan(r.acquiredAt!);
  expect(r.conservationError.alloy).toBeCloseTo(0, 7);
  expect(r.conservationError.deuterium).toBeCloseTo(0, 7);
});
it('will not issue an unfunded settlement and keeps the founding cargo treatment explicit', () => {
  expect(claimRace([{ ...player, stock: { alloy: 0, crystal: 0, deuterium: 1000 }, windows: [{ start: 0, end: 90 }] }], 120).owner).toBeNull();
  const r = claimRace([{ ...player, windows: [{ start: 0, end: 90 }] }], 120);
  expect(r.foundingSink.alloy).toBeGreaterThan(0);
  expect(r.conservationError.alloy).toBe(0);
});
