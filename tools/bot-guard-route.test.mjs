import { expect, it } from 'vitest';
import { TUTORIAL_EXIT, HULLS, plantCeiling, satelliteSlots, hangarCapacity, hangarLoad, groundSlots, groundLoad,
  RESEARCH_PROJECTS, researchPrerequisiteMet, hullRequirementsMet } from '../packages/rules/src/index.ts';
import { claimableRouteRewards, guardRoute, projectedLevel, quoteGoal, selectedGoals } from './bot-guard-route.mjs';
import { runGuardRouteStudy } from './bot-guard-route-study.mjs';

it.each([false, true])('orders a paid path with all prerequisites (extended: %s)', extended => {
  const buildings = { ...TUTORIAL_EXIT.buildings }, research = {}, fleet = { ...TUTORIAL_EXIT.fleet };
  const orbit = [...TUTORIAL_EXIT.satellites];
  for (const goal of guardRoute('balanced', extended)) {
    if (goal.kind === 'building') {
      if (buildings[goal.id] >= goal.target) continue;
      expect(goal.target, goal.key).toBe(buildings[goal.id] + 1);
      if (!['CORE', 'HANGAR'].includes(goal.id)) expect(goal.target, goal.key).toBeLessThanOrEqual(buildings.CORE);
      if (goal.id === 'DEUTERIUM_PLANT') expect(goal.target, goal.key).toBeLessThanOrEqual(plantCeiling(research.DEUTERIUM_SYNTHESIS ?? 0));
      buildings[goal.id] = goal.target;
    } else if (goal.kind === 'research') {
      const spec = RESEARCH_PROJECTS[goal.id];
      expect(researchPrerequisiteMet(spec, id => research[id] ?? 0), goal.key).toBe(true);
      expect(goal.target, goal.key).toBe((research[goal.id] ?? 0) + 1);
      research[goal.id] = goal.target;
    } else if (goal.kind === 'satellite') {
      expect(orbit.length + 1, goal.key).toBeLessThanOrEqual(satelliteSlots(buildings.CORE));
      orbit.push(goal.id);
    } else if (goal.kind === 'hull') {
      expect(buildings.SHIPYARD, goal.key).toBeGreaterThanOrEqual(HULLS[goal.id].minShipyard);
      expect(hullRequirementsMet(goal.id, research), goal.key).toBe(true);
      fleet[goal.id] = goal.target;
      expect(hangarLoad(fleet), goal.key).toBeLessThanOrEqual(hangarCapacity(buildings.HANGAR));
      expect(groundLoad(fleet), goal.key).toBeLessThanOrEqual(groundSlots(buildings.CORE));
    }
  }
  expect(research.STARSHIP_ENGINEERING).toBe(2);
  expect(fleet.CORSAIR).toBeGreaterThan(0);
  expect(fleet.CATACLYSM).toBeGreaterThan(0);
  expect(fleet.PALADIN).toBeGreaterThan(0);
  if (extended) {
    expect(buildings.CORE).toBe(18);
    expect(buildings.DEUTERIUM_PLANT).toBe(12);
    expect(fleet.CORSAIR).toBe(30);
  }
});

it('counts queued levels and all owned ships before ordering replacements', () => {
  const view = { buildings: { CORE: 9 }, queues: { CONSTRUCTION: [{ subject: 'CORE', count: 1 }],
    YARD: [{ subject: 'CORSAIR', count: 3 }, { subject: 'CORSAIR', count: 2 }] }, research: [{ id: 'SHIP_POWER', level: 1 }],
    researchQueue: [{ projectId: 'SHIP_POWER', level: 2 }], fleet: { CORSAIR: 1 }, fleetAway: { CORSAIR: 2 },
    fleetDocked: { CORSAIR: 1 }, orbit: ['UPLINK'], instruments: {} };
  expect(projectedLevel(view, { kind: 'building', id: 'CORE' })).toBe(10);
  expect(projectedLevel(view, { kind: 'research', id: 'SHIP_POWER' })).toBe(2);
  expect(projectedLevel(view, { kind: 'hull', id: 'CORSAIR' })).toBe(9);
  expect(quoteGoal(view, { kind: 'hull', id: 'CORSAIR', target: 10 }).count).toBe(1);
  view.ground = { THORN: 2 };
  expect(projectedLevel(view, { kind: 'hull', id: 'THORN' })).toBe(2);
});

it('selects only the first unpaid target per lane, reserving the earlier target priority', () => {
  const route = [
    { kind: 'building', id: 'CORE', target: 10 },
    { kind: 'building', id: 'REFINERY', target: 10 },
    { kind: 'research', id: 'SHIP_POWER', target: 2 },
    { kind: 'hull', id: 'CORSAIR', target: 9 },
  ];
  const view = { buildings: { CORE: 9, REFINERY: 9 }, queues: { CONSTRUCTION: [], YARD: [] },
    research: [{ id: 'SHIP_POWER', level: 1 }], researchQueue: [], fleet: {}, fleetAway: {}, fleetDocked: {},
    orbit: [], instruments: {} };
  expect(selectedGoals(view, route).map(goal => goal.id)).toEqual(['CORE', 'SHIP_POWER', 'CORSAIR']);
});

it('takes only already earned progression rewards, excluding account grants and locked or paid tiers', () => {
  const earned = { chains: [
    { id: 'CORE', scope: 'season', tiers: [{ id: 'CORE:3', state: 'claimed' },
      { id: 'CORE:5', state: 'claimable' }, { id: 'CORE:7', state: 'locked' }] },
    { id: 'SOCIAL', scope: 'account', tiers: [{ id: 'SOCIAL:1', state: 'claimable' }] },
  ] };
  expect(claimableRouteRewards(earned)).toEqual(['CORE:5']);
});

it.runIf(process.env.ASTERA_INCLUDE_LONG_TESTS === '1')('pays and completes the route through the real server services', async () => {
  const result = await runGuardRouteStudy({ variant: 'balanced', days: 30, schedule: 'three-sessions' });
  expect(result.finished, JSON.stringify(result.remaining)).toBe(true);
  expect(result.unexpectedErrors).toEqual([]);
  expect(result.paymentChecks).toBe(result.purchases.length);
  expect(result.purchases.some(p => p.goal === 'research:STARSHIP_ENGINEERING:2')).toBe(true);
  for (const resource of ['alloy', 'crystal', 'deuterium']) {
    expect(result.spent[resource]).toBe(result.purchases.reduce((sum, p) => sum + p.cost[resource], 0));
    expect(result.purchases.every(p => p.cost[resource] <= p.stockBefore[resource]
      && p.cost[resource] <= p.caps[resource])).toBe(true);
  }
  expect(result.minimumResources).toBeGreaterThanOrEqual(0);
  expect(result.final.capacity.hangarUsed).toBeLessThanOrEqual(result.final.capacity.hangar);
  expect(result.milestones.first_t4_mix).toBeDefined();
}, 300_000);

it.runIf(process.env.ASTERA_INCLUDE_LONG_TESTS === '1')('claims earned rewards once through the actual reward service', async () => {
  const result = await runGuardRouteStudy({ variant: 'earned-rewards', days: 30, schedule: 'three-sessions' });
  expect(result.finished, JSON.stringify(result.remaining)).toBe(true);
  expect(result.rewards.length).toBeGreaterThan(0);
  expect(new Set(result.rewards.map(r => r.id)).size).toBe(result.rewards.length);
  expect(result.rewards.some(r => r.id === 'CORE:5')).toBe(true);
  expect(result.rewards.every(r => !r.id.startsWith('SOCIAL:'))).toBe(true);
  expect(result.unexpectedErrors).toEqual([]);
}, 300_000);
