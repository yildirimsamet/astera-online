import { describe, expect, it } from 'vitest';
import { INACTIVITY_MS, SILENT_SPACE, silentSpaceDue, silentSpaceDueAt } from '../src/index.js';

/**
 * SILENT SPACE TAKES A COMMANDER WHO HAS STOPPED PLAYING, NOT ONE WHO HAS STOPPED LOGGING IN.
 * D212, owner rule 2026-10-07: thirty hours without an attack, a building upgrade, a research
 * or a ship/defence order. Login is not on the list.
 */
describe('Silent Space departure after 30 hours without development or combat', () => {
  const hour = 60 * 60 * 1000;
  const state = { lastProgressAt: 0, joinedAt: 0, mainEnteredAt: 0 };

  it('is thirty hours, while a return application keeps its own 48-hour clock', () => {
    expect(SILENT_SPACE.idleMs).toBe(30 * hour);
    expect(INACTIVITY_MS).toBe(48 * hour);
  });

  it('includes exactly 30 hours and excludes one millisecond before', () => {
    expect(silentSpaceDue(state, 30 * hour - 1)).toBe(false);
    expect(silentSpaceDue(state, 30 * hour)).toBe(true);
  });

  it.each(['lastProgressAt', 'joinedAt', 'mainEnteredAt'] as const)('uses %s as a lower bound', (field) => {
    expect(silentSpaceDue({ ...state, [field]: hour }, 30 * hour)).toBe(false);
    expect(silentSpaceDue({ ...state, [field]: hour }, 31 * hour)).toBe(true);
  });

  it('counts from arrival when the commander has never ordered anything', () => {
    const fresh = { lastProgressAt: null, joinedAt: 5 * hour, mainEnteredAt: 5 * hour };
    expect(silentSpaceDue(fresh, 35 * hour - 1)).toBe(false);
    expect(silentSpaceDue(fresh, 35 * hour)).toBe(true);
    expect(silentSpaceDueAt(fresh)).toBe(35 * hour);
  });

  it('gives a commander back from Silent Space a full window', () => {
    const returned = { lastProgressAt: 2 * hour, joinedAt: 0, mainEnteredAt: 40 * hour };
    expect(silentSpaceDueAt(returned)).toBe(70 * hour);
  });

  it('ignores logins and last-seen instants: only an order moves the clock', () => {
    const loggingIn = { ...state, lastActiveAt: 29 * hour, lastSeenAt: 29 * hour };
    expect(silentSpaceDue(loggingIn, 30 * hour)).toBe(true);
    expect(silentSpaceDue(state, -hour)).toBe(false);
  });

  it('halves production and nothing else', () => {
    expect(SILENT_SPACE.productionPace).toBe(0.5);
  });
});
