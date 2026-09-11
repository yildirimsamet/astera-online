import { expect, it } from 'vitest';
import { calibratedScenario, scoreProgression, stressedScenario, recoveryScenario } from './progression-calibration-study.js';
import { fleetSession } from './fleet-session-study.js';
import { buildingCost } from '../packages/rules/src/index.js';

it('isolates starting capital and research prices without multiplying recurring production or activity', () => {
  const a = calibratedScenario('average', 2, 1, 1);
  const b = calibratedScenario('average', 2, 2, 0.8);
  expect(b.windows).toEqual(a.windows);
  expect(b.rate).toEqual(a.rate);
  expect(b.initialFleet).toEqual({});
  expect(b.stock.alloy).toBe(a.stock.alloy * 2);
  expect(b.development.find(x => x.id === 'industry-1')).toEqual(a.development.find(x => x.id === 'industry-1'));
  expect(b.development.find(x => x.id === 'T3-research')!.cost.alloy)
    .toBe(Math.ceil(a.development.find(x => x.id === 'T3-research')!.cost.alloy * 0.8));
});

it('keeps missing milestones as failures rather than dropping them from the acceptance denominator', () => {
  const s = calibratedScenario('average', 2, 1, 1); s.end = 0;
  const score = scoreProgression(fleetSession(s));
  expect(score.firstRaidResolvedMinute).toBeNull();
  expect(score.firstT3Day).toBeNull();
  expect(score.firstT4Day).toBeNull();
  expect(score.pacingPassed).toBe(false);
});

it('refuses invalid calibration parameters rather than silently producing a nonsensical curve', () => {
  expect(() => calibratedScenario('average', 0, 1, 1)).toThrow();
  expect(() => calibratedScenario('average', 2, -1, 1)).toThrow();
  expect(() => calibratedScenario('average', 2, 1, NaN)).toThrow();
});

it('keeps the empty-target negative control in the pacing denominator', () => {
  const s = stressedScenario('average', 'no-targets');
  const r = scoreProgression(fleetSession(s));
  expect(r.firstRaidResolvedMinute).toBeNull();
  expect(r.pacingPassed).toBe(false);
  expect(r.firstT3Day).not.toBeNull();
});

it('removes workday check-ins without granting production or additional evening time', () => {
  const baseline = stressedScenario('average', 'baseline');
  const missed = stressedScenario('average', 'missed-work-checks');
  expect(missed.windows.length).toBeLessThan(baseline.windows.length);
  expect(missed.windows.every(w => baseline.windows.some(b => b.start === w.start && b.end === w.end))).toBe(true);
  expect(missed.rate).toEqual(baseline.rate);
  expect(missed.stock).toEqual(baseline.stock);
});

it('reports target exhaustion and the remaining season without pretending targets replenish', () => {
  const s = stressedScenario('average', 'baseline');
  const r = scoreProgression(fleetSession(s));
  expect(r.remainingTargets).toBe(0);
  expect(r.lastLaunchDay).toBeLessThan(4);
  expect(r.noLaunchTailDays).toBeGreaterThan(10);
});

it('charges both shipyard upgrades and completes them before permitting a T4 hull', () => {
  const s = stressedScenario('average', 'paid-yard-6');
  expect(s.development.find(a => a.id === 'yard-5')!.cost).toEqual(buildingCost('SHIPYARD', 4));
  expect(s.development.find(a => a.id === 'yard-6')!.cost).toEqual(buildingCost('SHIPYARD', 5));
  const r = fleetSession(s);
  expect(r.firstBuilt.CATACLYSM).toBeGreaterThan(r.developmentCompleted['yard-6']!);
  expect(r.infrastructure.yard).toBe(6);
});

it('applies the loss to the ongoing paid development route without a new wallet or opponent supply', () => {
  const baseline = stressedScenario('average', 'paid-yard-6');
  const shocked = recoveryScenario('average', 5.5);
  expect(shocked.stock).toEqual(baseline.stock);
  expect(shocked.rate).toEqual(baseline.rate);
  expect(shocked.development).toEqual(baseline.development);
  expect(shocked.targets).toEqual(baseline.targets);
  const r = fleetSession(shocked);
  expect(r.shocks[0]!.actualLossFraction).toBeCloseTo(0.5);
  expect(r.shocks[0]!.recoveredAt).toBeGreaterThan(5.5 * 1440);
  expect(Math.abs(r.resourceConservationError.alloy)).toBeLessThan(1e-6);
});
