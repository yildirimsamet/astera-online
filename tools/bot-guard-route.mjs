/** An investigation fixture, never imported by the live bot worker. Prices come from the rules. */
const rules = await import(process.env.GUARD_ROUTE_RULES ?? '../packages/rules/src/index.ts');
const { buildingCost, HULLS, RESEARCH_PROJECTS, satelliteCost, instrumentCost } = rules;

export const laneOf = goal => goal.kind === 'research' ? 'RESEARCH' : goal.kind === 'hull' ? 'YARD' : 'CONSTRUCTION';

export const claimableRouteRewards = view => view.chains.filter(chain => chain.scope === 'season')
  .flatMap(chain => chain.tiers.filter(tier => tier.state === 'claimable').map(tier => tier.id));

/** Ordered purchases, not calendar-day instructions. Targets denote total ownership. */
export function guardRoute(variant = 'balanced', extended = false) {
  const out = [];
  let minCore = 2;
  const put = (kind, id, target, milestone) => out.push({ kind, id, target,
    minCore, key: `${kind}:${id}:${target}`, ...(milestone ? { milestone } : {}) });
  const b = (id, level, mark) => {
    put('building', id, level, mark);
    if (id === 'CORE') minCore = level;
  };
  const r = (id, level) => put('research', id, level);
  const h = (id, count, mark) => put('hull', id, count, mark);
  const grow = level => { b('CORE', level); b('REFINERY', level); b('EXTRACTOR', level); };
  const topResearch = () => {
    r('STARSHIP_ENGINEERING', 2); b('SHIPYARD', 5); b('SHIPYARD', 6); b('HANGAR', 3);
    h('CORSAIR', 3); h('CATACLYSM', 3); h('PALADIN', 2, 'first_t4_mix');
  };

  r('DEUTERIUM_SYNTHESIS', 1); b('DEUTERIUM_PLANT', 1);
  for (let level = 3; level <= 9; level++) {
    grow(level);
    if (level === 4) b('DEUTERIUM_PLANT', 2);
    if (level === 6) {
      b('SHIPYARD', 2); h('PROSPECTOR', 2); h('THORN', 2); h('HARPOON', 1);
      h('VIPER', 4); h('SENTINEL', 2); h('COURIER', 2, 'early_defence');
    }
  }
  put('satellite', 'FOUNDRY', 1, 'economy_9');
  r('DEUTERIUM_SYNTHESIS', 2); b('DEUTERIUM_PLANT', 3); b('DEUTERIUM_PLANT', 4);
  if (variant === 'early-robots') r('AI_ROBOTS', 1);
  for (let level = 10; level <= 12; level++) grow(level);
  b('VAULT', 2); b('HANGAR', 2, 'economy_12');
  r('STARSHIP_ENGINEERING', 1); b('SHIPYARD', 3); b('SHIPYARD', 4);
  r('SHIP_POWER', 1); r('SHIP_POWER', 2); r('SHIP_ARMOR', 1); r('SHIP_ARMOR', 2); r('SHIP_SHIELDS', 1);
  h('THORN', 4); h('HARPOON', 2); h('BASTION', 2);
  h('TEMPEST', 4); h('BALLISTA', 3); h('PRAETORIAN', 3, 'first_t3_mix');
  if (variant === 'early-engineering') {
    for (let level = 3; level <= 6; level++) b('VAULT', level);
    topResearch();
  }
  grow(13); grow(14);
  if (variant !== 'early-engineering') { b('VAULT', 3); topResearch(); }
  b('DEUTERIUM_PLANT', 5); b('DEUTERIUM_PLANT', 6);
  grow(15); grow(16);
  put('satellite', 'DERRICK', 1);
  if (variant !== 'early-robots') r('AI_ROBOTS', 1);
  r('YARD_AUTOMATION', 1); r('YARD_AUTOMATION', 2); r('INDUSTRIAL', 1);
  r('SHIP_POWER', 3); r('SHIP_ARMOR', 3); r('SHIP_SHIELDS', 2);
  r('DEUTERIUM_SYNTHESIS', 3); b('DEUTERIUM_PLANT', 7); b('DEUTERIUM_PLANT', 8);
  b('HANGAR', 4);
  h('CORSAIR', 12); h('CATACLYSM', 12); h('PALADIN', 8, 'operational_mix');
  if (extended) {
    grow(17); grow(18);
    put('satellite', 'BEACON', 1);
    r('SHIP_POWER', 4); r('SHIP_ARMOR', 4); r('SHIP_SHIELDS', 3);
    r('DEUTERIUM_SYNTHESIS', 4);
    for (let level = 9; level <= 12; level++) b('DEUTERIUM_PLANT', level);
    r('INDUSTRIAL', 2); b('HANGAR', 5);
    h('CORSAIR', 30); h('CATACLYSM', 30); h('PALADIN', 20, 'mature_mix');
  }
  return out;
}

export function projectedLevel(view, goal) {
  if (goal.kind === 'building') return view.buildings[goal.id]
    + view.queues.CONSTRUCTION.filter(q => q.subject === goal.id).reduce((n, q) => n + q.count, 0);
  if (goal.kind === 'research') return Math.max(view.research.find(q => q.id === goal.id)?.level ?? 0,
    ...view.researchQueue.filter(q => q.projectId === goal.id).map(q => q.level));
  if (goal.kind === 'hull') return (view.fleet[goal.id] ?? view.ground?.[goal.id] ?? 0) + (view.fleetAway[goal.id] ?? 0)
    + (view.fleetDocked[goal.id] ?? 0) + view.queues.YARD.filter(q => q.subject === goal.id).reduce((n, q) => n + q.count, 0);
  if (goal.kind === 'satellite') return view.orbit.includes(goal.id)
    || view.queues.CONSTRUCTION.some(q => q.subject === goal.id) ? 1 : 0;
  return (view.instruments[goal.id] ?? 0)
    + view.queues.CONSTRUCTION.filter(q => q.subject === goal.id).reduce((n, q) => n + q.count, 0);
}

export function completedLevel(view, goal) {
  if (goal.kind === 'building') return view.buildings[goal.id];
  if (goal.kind === 'research') return view.research.find(q => q.id === goal.id)?.level ?? 0;
  if (goal.kind === 'hull') return (view.fleet[goal.id] ?? view.ground?.[goal.id] ?? 0) + (view.fleetAway[goal.id] ?? 0) + (view.fleetDocked[goal.id] ?? 0);
  if (goal.kind === 'satellite') return view.orbit.includes(goal.id) ? 1 : 0;
  return view.instruments[goal.id] ?? 0;
}

export function quoteGoal(view, goal) {
  const held = projectedLevel(view, goal);
  const count = goal.kind === 'hull' ? Math.max(0, goal.target - held) : 1;
  const cost = goal.kind === 'building' ? buildingCost(goal.id, held)
    : goal.kind === 'research' ? RESEARCH_PROJECTS[goal.id].costAt(held + 1)
    : goal.kind === 'satellite' ? satelliteCost(goal.id)
    : goal.kind === 'instrument' ? instrumentCost(goal.id, held)
    : Object.fromEntries(['alloy', 'crystal', 'deuterium'].map(k => [k, HULLS[goal.id][k] * count]));
  return { count, cost };
}

export function selectedGoals(view, route) {
  const lanes = new Set();
  return route.filter(goal => {
    const lane = laneOf(goal);
    const core = lane === 'CONSTRUCTION' ? projectedLevel(view, { kind: 'building', id: 'CORE' }) : view.buildings.CORE;
    if (core < (goal.minCore ?? 0)) return false;
    if (lanes.has(lane) || projectedLevel(view, goal) >= goal.target) return false;
    lanes.add(lane);
    return true;
  });
}
