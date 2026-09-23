import { expect, it } from 'vitest';
import {
  DEVELOPMENT_SATELLITE_TARGET,
  TARGET_BUILDINGS,
  unreachableGoalReason,
} from './economy-goal-sim.js';
import { satelliteSlots } from '../packages/rules/src/index.js';

/**
 * A HARNESS THAT CANNOT REACH ITS OWN GOAL REPORTS A BALANCE FAILURE THAT IS NOT ONE.
 *
 * The development package asked for all four satellites while `TARGET_BUILDINGS.CORE` was 12, and
 * `satelliteSlots(12)` is three — the fourth opens at Core 15. The placement rule inside the tool
 * refuses a satellite past the Core's slots, so the checklist could never complete and the run
 * printed `FAIL: the primary route did not finish inside 16 days`. That number measured the
 * harness, not the economy, and it is the kind of reading a balance change would then be made
 * against.
 *
 * The targets themselves are a calibration decision and are NOT retuned here.
 */
it('never asks the development package for more satellites than its Core can hold', () => {
  expect(DEVELOPMENT_SATELLITE_TARGET).toBeGreaterThan(0);
  expect(DEVELOPMENT_SATELLITE_TARGET).toBeLessThanOrEqual(satelliteSlots(TARGET_BUILDINGS.CORE));
});

it('declares the goal reachable, or says exactly why it is not', () => {
  expect(unreachableGoalReason()).toBeNull();
});
