import { expect, it } from 'vitest';
import { designBattleSample, designValidation } from './economy-design-validation.js';

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
  expect(r.isolated.filter(x => x.profile === 'average' && x.stress === 'baseline').every(x => x.pacingPassed)).toBe(true);
  expect(r.combat.every(x => x.result.ordinaryTargetPassed)).toBe(true);
  expect(r.excluded).toEqual(['trade-ship', 'asteroid-shower', 'colony-transfer']);
});
