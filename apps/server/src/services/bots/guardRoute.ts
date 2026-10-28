import {
  BUILD, HULLS, RESEARCH_PROJECTS, buildingCost, groundLoad, hangarLoad, hullRequirementsMet,
  hullBulk, plantCeiling, satelliteSlots, satelliteCost, type BuildingId, type HullId, type ResearchProjectId,
  type Resources, type SatelliteId, type TechLevels,
} from '@astera/rules';
import type { PlanetView } from '../planetView.js';

interface Target { target: number; minCore: number }
export type GuardGoal = Target & (
  { kind: 'building'; id: BuildingId } | { kind: 'research'; id: ResearchProjectId }
  | { kind: 'hull'; id: HullId } | { kind: 'satellite'; id: SatelliteId }
);
export type GuardLane = 'CONSTRUCTION' | 'YARD' | 'RESEARCH';
export const guardLane = (goal: GuardGoal): GuardLane =>
  goal.kind === 'research' ? 'RESEARCH' : goal.kind === 'hull' ? 'YARD' : 'CONSTRUCTION';

/** Paid ordering measured in docs/bot-guard-route-study-2026-10-27.md. Never a day-based script. */
export function guardRoute(): GuardGoal[] {
  const out: GuardGoal[] = [];
  let minCore = 2;
  const b = (id: BuildingId, target: number) => {
    out.push({ kind: 'building', id, target, minCore });
    if (id === 'CORE') minCore = target;
  };
  const r = (id: ResearchProjectId, target: number) => out.push({ kind: 'research', id, target, minCore });
  const h = (id: HullId, target: number) => out.push({ kind: 'hull', id, target, minCore });
  const s = (id: SatelliteId) => out.push({ kind: 'satellite', id, target: 1, minCore });
  const grow = (level: number) => { b('CORE', level); b('REFINERY', level); b('EXTRACTOR', level); };
  r('DEUTERIUM_SYNTHESIS', 1); b('DEUTERIUM_PLANT', 1);
  for (let level = 3; level <= 9; level++) {
    grow(level);
    if (level === 4) b('DEUTERIUM_PLANT', 2);
    if (level === 6) {
      b('SHIPYARD', 2); h('PROSPECTOR', 2); h('THORN', 2); h('HARPOON', 1);
      h('VIPER', 4); h('SENTINEL', 2); h('COURIER', 2);
    }
  }
  s('FOUNDRY'); r('DEUTERIUM_SYNTHESIS', 2); b('DEUTERIUM_PLANT', 3); b('DEUTERIUM_PLANT', 4);
  for (let level = 10; level <= 12; level++) grow(level);
  b('VAULT', 2); b('HANGAR', 2);
  r('STARSHIP_ENGINEERING', 1); b('SHIPYARD', 3); b('SHIPYARD', 4);
  r('SHIP_POWER', 1); r('SHIP_POWER', 2); r('SHIP_ARMOR', 1); r('SHIP_ARMOR', 2); r('SHIP_SHIELDS', 1);
  h('THORN', 4); h('HARPOON', 2); h('BASTION', 2);
  h('TEMPEST', 4); h('BALLISTA', 3); h('PRAETORIAN', 3);
  grow(13); grow(14); b('VAULT', 3); r('STARSHIP_ENGINEERING', 2);
  b('SHIPYARD', 5); b('SHIPYARD', 6); b('HANGAR', 3);
  h('CORSAIR', 3); h('CATACLYSM', 3); h('PALADIN', 2);
  b('DEUTERIUM_PLANT', 5); b('DEUTERIUM_PLANT', 6); grow(15); grow(16); s('DERRICK');
  r('AI_ROBOTS', 1); r('YARD_AUTOMATION', 1); r('YARD_AUTOMATION', 2); r('INDUSTRIAL', 1);
  r('SHIP_POWER', 3); r('SHIP_ARMOR', 3); r('SHIP_SHIELDS', 2);
  r('DEUTERIUM_SYNTHESIS', 3); b('DEUTERIUM_PLANT', 7); b('DEUTERIUM_PLANT', 8); b('HANGAR', 4);
  h('CORSAIR', 12); h('CATACLYSM', 12); h('PALADIN', 8);
  grow(17); grow(18); s('BEACON'); r('SHIP_POWER', 4); r('SHIP_ARMOR', 4); r('SHIP_SHIELDS', 3);
  r('DEUTERIUM_SYNTHESIS', 4);
  for (let level = 9; level <= 12; level++) b('DEUTERIUM_PLANT', level);
  r('INDUSTRIAL', 2); b('HANGAR', 5); h('CORSAIR', 30); h('CATACLYSM', 30); h('PALADIN', 20);
  return out;
}

export function guardProjectedLevel(view: PlanetView, goal: GuardGoal): number {
  if (goal.kind === 'building') return view.buildings[goal.id] + view.queues.CONSTRUCTION
    .filter(order => order.subject === goal.id).reduce((n, order) => n + order.count, 0);
  if (goal.kind === 'research') return Math.max(view.research.find(row => row.id === goal.id)?.level ?? 0,
    ...view.researchQueue.filter(order => order.projectId === goal.id).map(order => order.level));
  if (goal.kind === 'satellite') return view.orbit.includes(goal.id)
    || view.queues.CONSTRUCTION.some(order => order.subject === goal.id) ? 1 : 0;
  return (view.fleet[goal.id] ?? view.ground[goal.id] ?? 0) + (view.fleetAway[goal.id] ?? 0)
    + (view.fleetDocked[goal.id] ?? 0) + view.queues.YARD.filter(order => order.subject === goal.id)
      .reduce((n, order) => n + order.count, 0);
}

export const guardTech = (view: PlanetView): TechLevels =>
  Object.fromEntries(view.research.map(row => [row.id, row.level]));

/** Missing lower tiers never drag an advanced/current-season commander back to the opening. */
function obsoleteHull(view: PlanetView, goal: GuardGoal): boolean {
  if (goal.kind !== 'hull' || HULLS[goal.id].ground || HULLS[goal.id].tier === null
    || HULLS[goal.id].profile === 'TRANSPORT') return false;
  const tech = guardTech(view);
  const tier = view.buildings.SHIPYARD >= 6 && hullRequirementsMet('CORSAIR', tech) && hullRequirementsMet('PALADIN', tech) ? 4
    : view.buildings.SHIPYARD >= 4 && hullRequirementsMet('TEMPEST', tech) && hullRequirementsMet('PRAETORIAN', tech) ? 3 : 2;
  return HULLS[goal.id].tier! < tier;
}

export function guardGoals(view: PlanetView): GuardGoal[] {
  let selected: GuardGoal[] = [];
  const lanes = new Set<GuardLane>();
  const projectedCore = guardProjectedLevel(view, { kind: 'building', id: 'CORE', target: 0, minCore: 0 });
  for (const goal of guardRoute()) {
    const lane = guardLane(goal);
    if ((lane === 'CONSTRUCTION' ? projectedCore : view.buildings.CORE) < goal.minCore
      || guardProjectedLevel(view, goal) >= goal.target || obsoleteHull(view, goal) || lanes.has(lane)) continue;
    // Current-season occupants keep their hardware. A full orbit never blocks the economic lane.
    if (goal.kind === 'satellite' && view.orbit.length + view.queues.CONSTRUCTION.filter(q => q.kind === 'SATELLITE').length
      >= satelliteSlots(projectedCore)) continue;
    // Retained guns cannot be removed to satisfy a recipe. Keep the yard useful for ships.
    if (goal.kind === 'hull' && hullRoom(view, goal.id) < hullBulk(goal.id)
      && (HULLS[goal.id].ground || view.buildings.HANGAR >= view.capacity.hangarCeiling)) continue;
    lanes.add(lane); selected.push(goal);
  }
  const planned = selected;
  const yard = selected.find(goal => goal.kind === 'hull');
  if (yard?.kind === 'hull' && !HULLS[yard.id].ground) {
    const count = yard.target - guardProjectedLevel(view, yard);
    if (hangarLoad({ [yard.id]: count }) > hullRoom(view, yard.id)
      && !view.queues.CONSTRUCTION.some(order => order.subject === 'HANGAR')
      && view.buildings.HANGAR < view.capacity.hangarCeiling) {
      // This replacement must pass the same storage check as every other purchase.
      selected = [{ kind: 'building', id: 'HANGAR', target: view.buildings.HANGAR + 1, minCore: 0 },
        ...selected.filter(goal => guardLane(goal) !== 'CONSTRUCTION')];
    }
  }
  const storageBlocked = selected.some(goal => {
    const { cost } = guardQuote(view, goal);
    return cost.alloy > Math.max(view.planet.alloy, view.planet.alloyCap)
      || cost.crystal > Math.max(view.planet.crystal, view.planet.crystalCap)
      || cost.deuterium > Math.max(view.planet.deuterium, view.planet.deuteriumCap);
  });
  if (storageBlocked && view.buildings.VAULT < projectedCore
    && !view.queues.CONSTRUCTION.some(order => order.subject === 'VAULT')) {
    const cost = buildingCost('VAULT', view.buildings.VAULT);
    if (cost.alloy <= Math.max(view.planet.alloyCap, view.planet.alloy)
      && cost.crystal <= Math.max(view.planet.crystalCap, view.planet.crystal)) {
      return [{ kind: 'building', id: 'VAULT', target: view.buildings.VAULT + 1, minCore: 0 },
        ...selected.filter(goal => guardLane(goal) !== 'CONSTRUCTION')];
    }
  }
  // A depot at its ceiling (or itself unaffordable) cannot rescue this Hangar yet.
  // Let the authored economic lane grow its production/caps instead of replacing it forever.
  return storageBlocked ? planned : selected;
}

/** Ownership already includes away/docked units; queued batches still reserve additional room. */
function hullRoom(view: PlanetView, id: HullId): number {
  const load = HULLS[id].ground ? groundLoad : hangarLoad;
  return Math.max(0, (HULLS[id].ground ? view.capacity.ground - view.capacity.groundUsed
    : view.capacity.hangar - view.capacity.hangarUsed)
    - view.queues.YARD.reduce((sum, order) => sum + load({ [order.subject]: order.count }), 0));
}

export function guardQuote(view: PlanetView, goal: GuardGoal): { cost: Resources; count: number } {
  const held = guardProjectedLevel(view, goal);
  let count = 1;
  if (goal.kind === 'hull') {
    const spec = HULLS[goal.id];
    // Save for a payable batch, not an entire target larger than the depot or final Hangar.
    // Keep a one-unit quote when blocked so the planner can request storage/capacity first.
    count = Math.min(Math.max(0, goal.target - held), Math.max(1, Math.floor(hullRoom(view, goal.id) / hullBulk(goal.id))),
      ...(['alloy', 'crystal', 'deuterium'] as const).map(resource => spec[resource] > 0
        ? Math.max(1, Math.floor(Math.max(view.planet[resource], view.planet[`${resource}Cap`]) / spec[resource])) : Infinity));
  }
  const cost = goal.kind === 'building' ? buildingCost(goal.id, held)
    : goal.kind === 'research' ? RESEARCH_PROJECTS[goal.id].costAt(held + 1)
    : goal.kind === 'satellite' ? satelliteCost(goal.id)
    : { alloy: HULLS[goal.id].alloy * count, crystal: HULLS[goal.id].crystal * count, deuterium: HULLS[goal.id].deuterium * count };
  return { cost, count };
}

/** Check ordinary prerequisites before reserving money for an unavailable cross-queue order. */
export function guardGoalAvailable(view: PlanetView, goal: GuardGoal): boolean {
  const lane = guardLane(goal);
  if (lane === 'RESEARCH') {
    const project = view.research.find(row => row.id === goal.id);
    return view.researchQueue.length < BUILD.queueDepth && project?.queueAvailable === true && project.queueDiscovered;
  }
  if (view.queues[lane].length >= BUILD.queueDepth) return false;
  if (goal.kind === 'building' && goal.id === 'DEUTERIUM_PLANT') {
    return guardProjectedLevel(view, goal) < plantCeiling(guardTech(view).DEUTERIUM_SYNTHESIS ?? 0);
  }
  if (goal.kind === 'hull') {
    if (view.buildings.SHIPYARD < HULLS[goal.id].minShipyard || !hullRequirementsMet(goal.id, guardTech(view))) return false;
    const { count } = guardQuote(view, goal);
    return count > 0 && hullBulk(goal.id) * count <= hullRoom(view, goal.id);
  }
  return true;
}
