import { expect, it } from 'vitest';
import { HULLS, buildingCost, RESEARCH_PROJECTS } from '../packages/rules/src/index.js';
import { costedScenario, summarizeCosted, invoiceDecreases, offlineCandidateScenario } from './costed-progression-study.js';
import { fleetSession } from './fleet-session-study.js';

it('keeps the offline candidate explicit and removes only the requested sessions', () => {
  const base = offlineCandidateScenario('average', 'baseline');
  expect(base.world!.initial.collectorHours).toBe(12);
  expect(base.world!.initial.prices).toEqual({ earlyMilitary: 0.5, lateMilitary: 0.5 });
  expect(offlineCandidateScenario('average', 'missed-first-evening').windows)
    .toEqual(base.windows.filter(w => w.start !== 720));
  expect(offlineCandidateScenario('average', 'missed-work-checks').windows)
    .toEqual(base.windows.filter(w => ![270, 480].includes(w.start % 1440)));
  expect(offlineCandidateScenario('average', 'loss-day7.5').shocks)
    .toEqual([{ at: 10800, homeLossFraction: 0.5 }]);
  const result = fleetSession(base);
  expect(result.world!.collectorHours).toBe(12);
  expect(summarizeCosted(base, result).maxResourceError).toBeLessThan(1e-6);
});

it('replaces bundles with explicit zero-to-built infrastructure and actual hull research requirements', () => {
  const s = costedScenario('average', 14);
  expect(Object.values(s.world!.initial.buildings).every(n => n === 0)).toBe(true);
  expect(s.world!.initial.tech).toEqual({});
  expect(s.initialFleet).toEqual({});
  expect(s.development.every(a => s.world!.orders[a.id] !== undefined && !a.rateGain)).toBe(true);
  expect(s.development.some(a => a.id.startsWith('industry-'))).toBe(false);
  for (const req of HULLS.CATACLYSM.requiredResearch) expect(s.hullRequires!.CATACLYSM).toContain(`research:${req.project}:${req.level}`);
});

it('records actual paid invoices and counts committed unfinished jobs in the same budget', () => {
  const s = costedScenario('average', 14), r = fleetSession(s), summary = summarizeCosted(s, r);
  expect(r.jobs.length).toBeGreaterThan(4);
  const core = r.jobs.find(j => j.action.id === 'building:CORE:1')!;
  expect(core.action.cost).toEqual(buildingCost('CORE', 0));
  const synthesis = r.jobs.find(j => j.action.id === 'research:DEUTERIUM_SYNTHESIS:1');
  if (synthesis) expect(synthesis.action.cost).toEqual(RESEARCH_PROJECTS.DEUTERIUM_SYNTHESIS.costAt(1));
  expect(summary.spendingResidual.alloy).toBeCloseTo(0, 6);
  expect(summary.spendingResidual.crystal).toBeCloseTo(0, 6);
  expect(summary.spendingResidual.deuterium).toBeCloseTo(0, 6);
  expect(summary.maxResourceError).toBeLessThan(1e-6);
});

it('carries candidate invoice factors through actual queued jobs without changing gates or recurring income', () => {
  const s = costedScenario('average', 14, { earlyMilitary: 0.2, lateMilitary: 0.2 });
  const baseline = costedScenario('average', 14);
  expect(s.windows).toEqual(baseline.windows);
  expect(s.rate).toEqual(baseline.rate);
  expect(s.hullRequires).toEqual(baseline.hullRequires);
  const r = fleetSession(s);
  const j = r.jobs.find(j => j.action.id === 'research:STARSHIP_ENGINEERING:1')!;
  expect(j.action.cost.alloy).toBe(Math.ceil(RESEARCH_PROJECTS.STARSHIP_ENGINEERING.costAt(1).alloy * 0.2));
  expect(summarizeCosted(s, r).spendingResidual.alloy).toBe(0);
});

it('flags a cheaper upper research rung created by independently scaling early and late prices', () => {
  expect(invoiceDecreases({ earlyMilitary: 0.4, lateMilitary: 0.1 })).toContain('STARSHIP_ENGINEERING:2');
  expect(invoiceDecreases({ earlyMilitary: 0.2, lateMilitary: 0.2 })).toEqual([]);
});

it('includes paid intelligence in the categorized spending instead of hiding it in residuals', () => {
  const s = costedScenario('average', 14), r = fleetSession(s);
  r.intelSpent = { alloy: 50, crystal: 30, deuterium: 0 };
  r.spent.alloy += 50; r.spent.crystal += 30;
  const summary = summarizeCosted(s, r);
  expect(summary.categories.intelligence).toEqual(r.intelSpent);
  expect(summary.spendingResidual).toEqual({ alloy: 0, crystal: 0, deuterium: 0 });
});
