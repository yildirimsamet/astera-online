import { expect, it } from 'vitest';
import { designScenario } from './economy-design-study.js';
import { fleetSession } from './fleet-session-study.js';
import { summarizeCosted } from './costed-progression-study.js';

it('gives the average player repeatable tier production inside the target windows without unnecessary fuel plants', () => {
  const s = designScenario('average', 14), r = fleetSession(s), q = summarizeCosted(s, r);
  expect(q.milestones.firstFleetMinute).toBeLessThan(60);
  expect(q.milestones.firstT3Day).toBeGreaterThanOrEqual(3);
  expect(q.milestones.firstT3Day).toBeLessThanOrEqual(4);
  expect(q.milestones.firstT4Day).toBeGreaterThanOrEqual(7);
  expect(q.milestones.firstT4Day).toBeLessThanOrEqual(8);
  expect(r.world!.buildings.DEUTERIUM_PLANT).toBe(3);
  expect(q.maxResourceError).toBeLessThan(1e-7); expect(q.maxHullError).toBe(0);
});

it('keeps low participation slower without reducing offline hourly production', () => {
  const a = designScenario('average', 14), low = designScenario('low-once', 14);
  expect(a.world!.initial).toEqual(low.world!.initial);
  const r = fleetSession(low);
  expect((r.firstBuilt.TEMPEST ?? Infinity) / 1440).toBeGreaterThan(4);
});

it('calibrates a thirty-day season to the same progression fractions without stretching the opening', () => {
  const s = designScenario('average', 30); s.fleetBudgetHours = 24;
  const q = summarizeCosted(s, fleetSession(s));
  expect(q.milestones.firstFleetMinute).toBeLessThan(60);
  expect(q.milestones.firstT3Day).toBeGreaterThanOrEqual(3 * 30 / 14);
  expect(q.milestones.firstT3Day).toBeLessThanOrEqual(4 * 30 / 14);
  expect(q.milestones.firstT4Day).toBeGreaterThanOrEqual(7 * 30 / 14);
  expect(q.milestones.firstT4Day).toBeLessThanOrEqual(8 * 30 / 14);
});

it('leaves paid industrial development beyond the first T4 instead of ending the route at Core twelve', () => {
  const s = designScenario('average', 30);
  expect(Object.values(s.world!.orders).some(o => 'building' in o && o.building === 'CORE' && o.level === 20)).toBe(true);
});

it('pays for a growing fleet and stops replacing two-tier-old losses after reaching T4', () => {
  const s = designScenario('average', 14); s.fleetBudgetHours = 24;
  const base = fleetSession(s);
  // Growth may stay in T3 while the independent D budget limits T4; count all paid hulls.
  expect(Object.values(base.home).reduce((sum, n) => sum + n, 0)).toBeGreaterThan(16);
  expect(base.maxCommittedBulk).toBeLessThanOrEqual(base.infrastructure.hangar);
  s.shocks = [{ at: 12 * 1440, homeLossFraction: 1 }];
  const r = fleetSession(s);
  expect(r.orders.filter(o => o.at >= 12 * 1440 && (o.hull === 'DART' || o.hull === 'VIPER'))).toHaveLength(0);
  expect(r.orders.some(o => o.at >= 12 * 1440 && o.hull === 'CATACLYSM')).toBe(true);
  expect(summarizeCosted(s, r).maxResourceError).toBeLessThan(1e-7);
});
