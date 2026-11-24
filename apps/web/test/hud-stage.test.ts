import { describe, expect, it } from 'vitest';
import { hudStageOf } from '../src/starter/hudStage.js';

/**
 * THE HUD'S OPENING REVEAL (playtest 2026-11-23 item 5; review 2026-11-23). The landing card hides the HUD,
 * the tour opens it piece by piece, and nothing else may leave a first game with no HUD at all.
 */
describe('the HUD stage of a first landing', () => {
  const base = { aboard: false, arrivalPending: false, tourDone: false, tourStep: 0 } as const;

  it('hides the HUD behind the founding-hour card while that card waits', () => {
    expect(hudStageOf({ ...base, step: 'LANDING', arrivalPending: true })).toBe(-1);
  });

  it('tours the HUD once the card is gone, even before the hour\'s start has been answered', () => {
    expect(hudStageOf({ ...base, step: 'LANDING' })).toBe(0);
    expect(hudStageOf({ ...base, step: 'MINE', tourStep: 2 })).toBe(2);
  });

  it('opens everything once the tour is done, so the card with its start key can be reached', () => {
    expect(hudStageOf({ ...base, step: 'LANDING', tourDone: true })).toBe(4);
    expect(hudStageOf({ ...base, step: 'MINE', tourDone: true })).toBe(4);
  });

  it('opens everything aboard, without tasks, after them, and in their later steps', () => {
    expect(hudStageOf({ ...base, aboard: true, step: 'LANDING', arrivalPending: true })).toBe(4);
    expect(hudStageOf({ ...base, step: null })).toBe(4);
    expect(hudStageOf({ ...base, step: 'DISMISSED' })).toBe(4);
    expect(hudStageOf({ ...base, step: 'PIRATE' })).toBe(4);
  });
});
