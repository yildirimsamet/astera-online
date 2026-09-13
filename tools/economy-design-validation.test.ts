import { expect, it } from 'vitest';
import {
  ECONOMY_VALIDATION_EXCLUSIONS,
  designBattleSample,
  designValidation,
} from './economy-design-validation.js';
import { designSeason } from './economy-design-model.js';

it('declares the Intergalactic Convoy outside economy calibration', () => {
  expect(ECONOMY_VALIDATION_EXCLUSIONS).toEqual([
    'trade-ship',
    'asteroid-shower',
    'intergalactic-convoy',
    'colony-transfer',
  ]);
});

it('measures prepared counter victories against real opposition without counting walkovers', () => {
  const r = designBattleSample({ VIPER: 12 }, { SENTINEL: 12 });
  expect(r.samples).toBe(32); expect(r.victories).toBe(32);
  expect(r.meanWinningLoss).toBeGreaterThanOrEqual(0.15);
  expect(r.meanWinningLoss).toBeLessThanOrEqual(0.3);
  expect(r.resourceLossShare.alloy).toBeCloseTo(r.meanWinningLoss!);
  const empty = designBattleSample({ VIPER: 12 }, {});
  expect(empty.defended).toBe(false); expect(empty.ordinaryTargetPassed).toBe(false);
});

it('keeps the bounded validation reproducible with explicit inputs and separate acceptance claims', () => {
  const r = designValidation(false);
  expect(r.isolated).toHaveLength(8);
  expect(r.combat).toHaveLength(21);
  expect(r.isolated.every(x => x.summary.maxResourceError < 1e-7 && x.summary.maxHullError === 0)).toBe(true);
  const averageBaselines = r.isolated.filter(x => x.profile === 'average' && x.stress === 'baseline');
  // This historical target-derived candidate is diagnostic, not the shipped D208
  // calibration. Once D184's missing-Hangar crash was fixed, both durations were
  // measurably early; preserve the rejected result instead of claiming acceptance.
  expect(averageBaselines.map(x => ({ days: x.days, pacingPassed: x.pacingPassed })))
    .toEqual([{ days: 14, pacingPassed: false }, { days: 30, pacingPassed: false }]);
  for (const x of averageBaselines) {
    const goal = designSeason(x.days);
    expect(x.pacingPassed).toBe(x.summary.milestones.firstT3Day !== null
      && x.summary.milestones.firstT4Day !== null
      && x.summary.milestones.firstT3Day >= goal.t3Days[0]!
      && x.summary.milestones.firstT3Day <= goal.t3Days[1]!
      && x.summary.milestones.firstT4Day >= goal.t4Days[0]!
      && x.summary.milestones.firstT4Day <= goal.t4Days[1]!);
  }
  expect(r.combat.every(x => x.result.ordinaryTargetPassed)).toBe(true);
  expect(r.excluded).toEqual([
    'trade-ship',
    'asteroid-shower',
    'intergalactic-convoy',
    'colony-transfer',
  ]);
});
