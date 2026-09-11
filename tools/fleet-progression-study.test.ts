import { expect, it } from 'vitest';
import { progressionScenario } from './fleet-progression-study.js';
import { fleetSession } from './fleet-session-study.js';

it('starts with zero free hulls and does not charge synthetic first-fleet packages as well', () => {
  const s = progressionScenario('average');
  expect(s.initialFleet).toEqual({});
  expect(s.development.some(a => ['opening-fleet', 'T3', 'T4'].includes(a.id))).toBe(false);
  expect(s.development.some(a => a.id.startsWith('colony'))).toBe(false);
  const r = fleetSession(s);
  expect(r.orders.length).toBeGreaterThan(0);
  for (const n of Object.values(r.hullConservationError)) expect(n).toBe(0);
  for (const o of r.orders) for (const gate of s.hullRequires?.[o.hull] ?? []) {
    expect(o.at).toBeGreaterThanOrEqual(r.developmentCompleted[gate]!);
  }
});

it('does not infer a first hull from the research completion timestamp', () => {
  const s = progressionScenario('average');
  const r = fleetSession(s);
  if (r.firstBuilt.TEMPEST !== undefined) {
    expect(r.firstBuilt.TEMPEST).toBeGreaterThan(r.developmentCompleted['T3-research']!);
  }
  expect(r.firstBuilt.DART).toBeGreaterThan(0);
});
