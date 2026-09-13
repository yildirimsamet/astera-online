import { expect, it } from 'vitest';
import { closureScenario, externalBudget, colonyInvoice, strategicInvoice, rewardInvoices, closureStudy } from './economy-closure.js';
import { fleetSession } from './fleet-session-study.js';
import { summarizeCosted } from './costed-progression-study.js';
import { HULLS, MULTI_WORLD } from '../packages/rules/src/index.js';

it('closes representative readiness and renewal checks without inventing ownership or raid income', () => {
  const r = closureStudy();
  expect(r.runs).toHaveLength(4);
  expect(r.scaling.map(x => x.colonies)).toEqual([51, 85, 170]);
  const pressure = r.runs.find(x => x.stress === 'evening-losses')!;
  expect(pressure.result.shocks).toHaveLength(10);
  expect(pressure.result.orders.some(o => o.at > 10 * 1440)).toBe(true);
  const average = r.readiness.find(x => x.profile === 'average')!;
  expect(average.ready).toBe(false);
  expect(average.world!.buildings.CORE).toBeLessThan(MULTI_WORLD.colonyCoreThresholds[0]);
  expect(r.readiness.find(x => x.profile === 'low-once')!.ready).toBe(false);
  expect(r.readiness.map(x => x.requirement.core))
    .toEqual(r.readiness.map(() => MULTI_WORLD.colonyCoreThresholds[0]));
  expect(r.renewal.every(x => x.budget.fits)).toBe(true);
  expect(r.runs.every(x => x.summary.maxResourceError < 1e-7)).toBe(true);
});

it('keeps all external-source envelopes separate and scales shared supply with population', () => {
  const a = externalBudget({ alloy: 10000, crystal: 5000, deuterium: 100 }, 300);
  const b = externalBudget({ alloy: 10000, crystal: 5000, deuterium: 100 }, 1000);
  expect(a.mining.alloy).toBe(300000); expect(a.pirates.alloy).toBe(150000);
  expect(a.rewards.alloy).toBe(45000);
  expect(b.mining.alloy / a.mining.alloy).toBeCloseTo(1000 / 300);
  expect(() => externalBudget({ alloy: -1, crystal: 0, deuterium: 0 }, 300)).toThrow();
});

it('separates colony capital from its consumed fee and buys enough real transport volume', () => {
  const c = colonyInvoice();
  expect(c.capital).toEqual(MULTI_WORLD.settlement.cost);
  expect(c.fee).toEqual(MULTI_WORLD.settlement.fee);
  expect(c.couriers).toBe(MULTI_WORLD.settlement.transports);
  expect(c.couriers * HULLS[MULTI_WORLD.settlement.transportHull].cargo)
    .toBeGreaterThanOrEqual(c.capital.alloy + c.capital.crystal + c.capital.deuterium);
  expect(c.total.alloy).toBe(
    c.capital.alloy + c.fee.alloy
    + c.couriers * HULLS[MULTI_WORLD.settlement.transportHull].alloy,
  );
  const s = strategicInvoice();
  expect(s.interceptor.alloy).toBeLessThan(s.weapon.alloy);
  expect(s.interceptor.deuterium).toBeLessThan(s.weapon.deuterium);
});

it('allocates each seasonal reward once without exceeding the chosen finite purse', () => {
  const purse = { alloy: 10000, crystal: 5000, deuterium: 0 }, rows = rewardInvoices(purse);
  expect(new Set(rows.map(r => r.id)).size).toBe(rows.length);
  expect(rows.every(r => r.scope === 'season')).toBe(true);
  expect(rows.reduce((n, r) => n + r.reward.alloy, 0)).toBeLessThanOrEqual(purse.alloy);
  expect(rows.reduce((n, r) => n + r.reward.alloy, 0)).toBeGreaterThan(purse.alloy - rows.length);
});

it('pays for fuel industry, cargo and information in the same physical development ledger', () => {
  const s = closureScenario('average', 14), r = fleetSession(s), q = summarizeCosted(s, r);
  expect(r.world!.buildings.DEUTERIUM_PLANT).toBeGreaterThanOrEqual(7);
  expect(r.world!.instruments!.TELESCOPE).toBe(1);
  expect(r.built.COURIER).toBe(2);
  expect(r.spent.alloy).toBeGreaterThan(10000);
  expect(q.milestones.firstT3Day).toBeGreaterThanOrEqual(3);
  expect(q.milestones.firstT3Day).toBeLessThanOrEqual(4);
  expect(q.milestones.firstT4Day).toBeGreaterThanOrEqual(7);
  expect(q.milestones.firstT4Day).toBeLessThanOrEqual(8);
  expect(q.maxResourceError).toBeLessThan(1e-7); expect(q.maxHullError).toBe(0);
});
