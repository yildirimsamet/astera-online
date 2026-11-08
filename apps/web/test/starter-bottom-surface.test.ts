import { describe, expect, it } from 'vitest';
import { bottomSurface, selectionGone } from '../src/starter/bottomSurface.js';

describe('one surface at the foot of the galaxy', () => {
  it('gives a selection priority over the destination, starter objective and context', () => {
    expect(bottomSurface({ page: false, selected: true, destination: true, starter: true, context: true })).toBe('selection');
  });
  it('lets the destination keep its own room over the next step', () => {
    expect(bottomSurface({ page: false, selected: false, destination: true, starter: true, context: true })).toBe('destination');
  });
  it('shows only the starter objective, or the main galaxy context', () => {
    expect(bottomSurface({ page: false, selected: false, destination: false, starter: true, context: true })).toBe('starter');
    expect(bottomSurface({ page: false, selected: false, destination: false, starter: false, context: true })).toBe('context');
  });
  it('leaves the space to an open page', () => {
    expect(bottomSurface({ page: true, selected: true, destination: true, starter: true, context: true })).toBeNull();
  });
});

// Walk 2026-11-08: the Prospector came home with its card open; the card drew nothing, and the next step
// and the guide's "read the card" note stayed hidden behind a selection nobody could see or close.
describe('a selection whose subject is gone', () => {
  const live = { runs: ['r1'], threads: ['t1'], contacts: ['c1'] };
  it('holds nothing once the flight it was on has ended', () => {
    expect(selectionGone({ kind: 'run', id: 'r2' }, live)).toBe(true);
    expect(selectionGone({ kind: 'thread', key: 't2' }, live)).toBe(true);
    expect(selectionGone({ kind: 'contact', id: 'c2' }, live)).toBe(true);
  });
  it('holds its place while the flight is up', () => {
    expect(selectionGone({ kind: 'run', id: 'r1' }, live)).toBe(false);
    expect(selectionGone({ kind: 'thread', key: 't1' }, live)).toBe(false);
    expect(selectionGone({ kind: 'contact', id: 'c1' }, live)).toBe(false);
  });
  it('leaves everything else, and no selection, alone', () => {
    expect(selectionGone({ kind: 'planet', id: 'p1' }, live)).toBe(false);
    expect(selectionGone(null, live)).toBe(false);
  });
});
