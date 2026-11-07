import { describe, expect, it } from 'vitest';
import { bottomSurface } from '../src/starter/bottomSurface.js';

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
