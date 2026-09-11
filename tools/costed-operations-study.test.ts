import { expect, it } from 'vitest';
import { operationsScenario } from './costed-operations-study.js';
import { fleetSession } from './fleet-session-study.js';
import { summarizeCosted } from './costed-progression-study.js';

it('pays intelligence hardware and operations without inventing a Telescope prerequisite for probes', () => {
  const s = operationsScenario('average', 3, 1), r = fleetSession(s);
  expect(s.world!.initial.buildings.CORE).toBe(0);
  expect(r.world!.orbit).toContain('UPLINK');
  expect(r.world!.instruments!.TELESCOPE).toBe(1);
  expect(r.probes.length).toBeGreaterThan(0);
  expect(r.launches.length).toBeGreaterThan(0);
  expect(r.probes[0]!.at).toBeLessThan(r.developmentCompleted['intel:telescope']!);
  expect(r.probes[0]!.at).toBeLessThan(60);
  expect(r.fuelSpent).toBeGreaterThan(0);
  const summary = summarizeCosted(s, r);
  expect(summary.spendingResidual).toEqual({ alloy: 0, crystal: 0, deuterium: 0 });
  expect(summary.maxResourceError).toBeLessThan(1e-6);
  expect(summary.maxHullError).toBe(0);
});

it('includes an explicitly stronger opponent control with real paid replacement losses', () => {
  const s = operationsScenario('average', 3, 42, 'line');
  expect(s.targets[0]!.fleet).toEqual({ VIPER: 6 });
  const r = fleetSession(s);
  expect(r.losses.VIPER).toBeGreaterThan(0);
  expect(r.built.VIPER).toBeGreaterThan(8);
  expect(summarizeCosted(s, r).maxHullError).toBe(0);
});

it('can fund and finish a first-hour favorable-counter raid while refusing the unfavorable counter', () => {
  const s = operationsScenario('average', 1, 42); s.end = 60;
  s.targets[0]!.fleet = { WARDEN: 2 }; s.bulk!.WARDEN = 3;
  const r = fleetSession(s);
  expect(r.launches[0]!.at).toBe(8);
  expect(r.launches[0]!.returnAt).toBe(23);
  expect(r.probes[0]!.returnAt).toBeLessThan(8);
  expect(r.fuelSpent).toBe(2);
  expect(summarizeCosted(s, r).spendingResidual).toEqual({ alloy: 0, crystal: 0, deuterium: 0 });
  s.targets[0]!.fleet = { PIKE: 2 }; s.bulk!.PIKE = 3;
  expect(fleetSession(s).launches).toHaveLength(0);
});
