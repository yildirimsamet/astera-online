import { expect, it } from 'vitest';
import { renewingScenario, summarizeRenewing } from './renewing-target-study.js';
import { fleetSession } from './fleet-session-study.js';

it('changes recurring target production without gifting replacements or changing the attacker wallet', () => {
  const fixed = renewingScenario(3, 'average', 1, false);
  const renewing = renewingScenario(3, 'average', 1, true);
  expect(renewing.stock).toEqual(fixed.stock);
  expect(renewing.initialFleet).toEqual(fixed.initialFleet);
  expect(renewing.targets.map(t => t.fleet)).toEqual(fixed.targets.map(t => t.fleet));
  expect(renewing.targets.every(t => t.economy?.stock.alloy === renewing.stock.alloy)).toBe(true);
});

it('keeps undefended or trivial wins out of the comparable-fleet diagnostic', () => {
  const s = renewingScenario(1, 'average', 1, true);
  s.targets[0]!.fleet = { SENTINEL: 1 }; s.end = 15;
  const score = summarizeRenewing(fleetSession(s), s);
  expect(score.resolved).toBe(1);
  expect(score.comparableFleetBattles).toBe(0);
  expect(score.zeroLossWins).toBe(1);
});

it('does not omit unpaid defender losses from the resource and hull audit', () => {
  const s = renewingScenario(1, 'low-once', 1, true); s.end = 1440;
  const r = fleetSession(s), score = summarizeRenewing(r, s);
  expect(r.defenders[0]!.losses.SENTINEL).toBeGreaterThan(0);
  expect(score.maxHullError).toBe(0);
  expect(score.maxResourceError).toBeLessThan(1e-6);
});
