import { expect, it } from 'vitest';
import { investmentScenario, summarizeInvestment } from './colony-investment-study.js';
import { evaluateCalendar } from './economy-calendar-model.js';

it('charges every productive site and never opens it before readiness and its opportunity', () => {
  const scenario = investmentScenario('average', 3, 0.25, 72);
  const sites = scenario.actions.filter(a => a.id.startsWith('site-'));
  expect(sites).toHaveLength(3);
  expect(sites.map(a => a.notBefore)).toEqual([3, 6, 9].map(d => d * 1440));
  const r = evaluateCalendar(scenario);
  for (const a of sites) {
    expect(a.cost.alloy).toBeGreaterThan(0);
    if (r.started[a.id] !== undefined) {
      expect(r.started[a.id]).toBeGreaterThanOrEqual(a.notBefore!);
      expect(r.started[a.id]).toBeGreaterThanOrEqual(r.completed['colony-ready']!);
    }
  }
  for (const error of Object.values(r.conservationError)) expect(Math.abs(error)).toBeLessThan(1e-7);
});

it('reports no completed site when the opportunity lies beyond the season', () => {
  const scenario = investmentScenario('average', 1, 0.25, 72);
  scenario.end = 1440;
  const r = evaluateCalendar(scenario);
  expect(summarizeInvestment(scenario, r).productiveSites).toBe(0);
  expect(summarizeInvestment(scenario, r).siteSpent.alloy).toBe(0);
});

it('supports a capital-only path with no territory dependency or cost', () => {
  const s = investmentScenario('average', 0, 0.25, 72);
  expect(s.actions.some(a => a.id.startsWith('site-') || a.id.startsWith('colony'))).toBe(false);
  const r = evaluateCalendar(s);
  expect(r.completed.T4).toBeLessThan(s.end);
  expect(summarizeInvestment(s, r).productiveSites).toBe(0);
});

it('models a commander who pays for readiness but never secures a productive site', () => {
  const s = investmentScenario('average', 0, 0.25, 72, 1.5, true);
  const r = evaluateCalendar(s);
  expect(r.completed['colony-ready']).toBeGreaterThan(0);
  expect(summarizeInvestment(s, r).productiveSites).toBe(0);
  expect(summarizeInvestment(s, r).siteSpent.alloy).toBe(0);
  expect(r.completed.T4).toBeLessThan(s.end);
});

it('prices military research independently of optional colony readiness', () => {
  const base = investmentScenario('average', 0, 0.25, 72);
  const adjusted = investmentScenario('average', 0, 0.25, 72, 1.5);
  const price = (s: typeof base) => s.actions.find(a => a.id === 'T3-research')!.cost.alloy;
  expect(price(adjusted)).toBe(Math.ceil(price(base) * 1.5));
  expect(adjusted.actions.find(a => a.id === 'T3-research')!.requires).toEqual(['industry-5']);
});

it('rejects impossible site counts and non-finite economic parameters', () => {
  expect(() => investmentScenario('average', 4, 0.25, 72)).toThrow();
  expect(() => investmentScenario('average', 1, -1, 72)).toThrow();
  expect(() => investmentScenario('average', 1, 0.25, Infinity)).toThrow();
});
