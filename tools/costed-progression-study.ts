/** Explicit building/research invoices inside the existing physical fleet ledger, replacing industry bundles. */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { HULLS, buildingCost, RESEARCH_PROJECTS, fleetEntries } from '../packages/rules/src/index.js';
import type { ResearchProjectId, Resources, HullId } from '../packages/rules/src/types.js';
import { playerWindows, type ActivityProfile } from '../packages/sim/src/player-calendar.js';
import { prototypeRoster } from './fleet-economy-next-study.js';
import { fleetSession, type SessionScenario } from './fleet-session-study.js';
import { emptyWorld, completeWorldOrder, quoteWorldOrder, worldStats, type WorldOrder, type CostedWorld } from './costed-world.js';
import type { Action } from './economy-calendar-model.js';

const keys = ['alloy', 'crystal', 'deuterium'] as const;
const zero = (): Resources => ({ alloy: 0, crystal: 0, deuterium: 0 });
export function invoiceDecreases(prices: CostedWorld['prices']) {
  const w = emptyWorld(); w.prices = prices;
  const decreases: string[] = [];
  for (const id of ['STARSHIP_ENGINEERING', 'SHIP_POWER', 'SHIP_ARMOR'] as const) {
    let previous = zero();
    for (let level = 1; level <= RESEARCH_PROJECTS[id].maxLevel; level++) {
      const order = { research: id, level }, quote = quoteWorldOrder(w, order, 30 * 1440)!;
      if (keys.some(k => quote.cost[k] < previous[k])) decreases.push(`${id}:${level}`);
      previous = quote.cost; completeWorldOrder(w, order);
    }
  }
  return decreases;
}
export function costedScenario(profile: ActivityProfile, days: number, prices?: CostedWorld['prices'], collectorHours?: number): SessionScenario {
  if (!Number.isInteger(days) || days < 1 || days > 30) throw new Error('Invalid duration');
  const initial = emptyWorld(), actions: Action[] = [], orders: Record<string, WorldOrder> = {};
  if (prices) initial.prices = { ...prices };
  if (collectorHours !== undefined) initial.collectorHours = collectorHours;
  const put = (order: Extract<WorldOrder, { building: string } | { research: string }>) => {
    const id = 'building' in order ? `building:${order.building}:${order.level}` : `research:${order.research}:${order.level}`;
    if (orders[id]) return;
    orders[id] = order;
    const cost = 'building' in order ? buildingCost(order.building, order.level - 1) : RESEARCH_PROJECTS[order.research].costAt(order.level);
    // Actual duration and legality are quoted from paid/projected state at order time, never this placeholder.
    actions.push({ id, queue: 'building' in order ? 'construction' : 'research', cost, minutes: 1, requires: [] });
  };
  const research = (id: ResearchProjectId, level: number) => {
    const prerequisite = RESEARCH_PROJECTS[id].prerequisite;
    if (prerequisite) research(prerequisite, 1);
    for (let rung = 1; rung <= level; rung++) put({ research: id, level: rung });
  };
  for (let level = 1; level <= 12; level++) {
    put({ building: 'CORE', level });
    for (const building of ['REFINERY', 'EXTRACTOR', 'VAULT'] as const) put({ building, level });
    if (level <= 6) put({ building: 'SHIPYARD', level });
    if (level <= 6) {
      research('DEUTERIUM_SYNTHESIS', Math.ceil(level / 3));
      put({ building: 'DEUTERIUM_PLANT', level });
    }
    if (level === 4 || level === 6) {
      const hull = level === 4 ? 'TEMPEST' : 'CATACLYSM';
      for (const req of HULLS[hull].requiredResearch) research(req.project, req.level);
    }
  }
  const hulls: HullId[] = ['DART', 'VIPER', 'TEMPEST', 'CATACLYSM'];
  const hullRequires = Object.fromEntries(hulls.map(id => [id, HULLS[id].requiredResearch.map(r => `research:${r.project}:${r.level}`)]));
  return { ...worldStats(initial), world: { initial, orders }, initialFleet: {},
    desiredFleet: { CATACLYSM: 2, TEMPEST: 4, VIPER: 8, DART: 2 }, packet: { DART: 2 },
    packetChoices: [{ CATACLYSM: 2, TEMPEST: 2 }, { TEMPEST: 2, VIPER: 4 }, { VIPER: 4 }, { DART: 2 }],
    stock: { alloy: 1500, crystal: 400, deuterium: 50 }, end: days * 1440, seasonEnd: days * 1440, seed: 42,
    windows: playerWindows(profile, days), development: actions, hullRequires, targets: [],
    roster: prototypeRoster(1.1, 0.52, 0), bulk: { DART: 3, VIPER: 5, TEMPEST: 8, CATACLYSM: 13 } };
}

const stresses = ['baseline', 'missed-first-evening', 'missed-work-checks', 'loss-day3.5', 'loss-day7.5'] as const;
export function offlineCandidateScenario(profile: ActivityProfile, stress: typeof stresses[number]) {
  const s = costedScenario(profile, 14, { earlyMilitary: 0.5, lateMilitary: 0.5 }, 12);
  if (stress === 'missed-first-evening') s.windows = s.windows.filter(w => w.start !== 720);
  if (stress === 'missed-work-checks') s.windows = s.windows.filter(w => ![270, 480].includes(w.start % 1440));
  if (stress === 'loss-day3.5' || stress === 'loss-day7.5') s.shocks = [{ at: (stress === 'loss-day3.5' ? 3.5 : 7.5) * 1440, homeLossFraction: 0.5 }];
  return s;
}

export function summarizeCosted(s: SessionScenario, r: ReturnType<typeof fleetSession>) {
  const categories: Record<'construction' | 'research' | 'hulls' | 'fuel' | 'intelligence', Resources> = {
    construction: zero(), research: zero(), hulls: zero(), intelligence: { ...r.intelSpent }, fuel: { ...zero(), deuterium: r.fuelSpent } };
  for (const j of r.jobs) for (const k of keys) categories[j.action.queue === 'research' ? 'research' : 'construction'][k] += j.action.cost[k];
  for (const o of r.orders) for (const k of keys) categories.hulls[k] += s.roster![o.hull]![k] * o.count;
  const current = r.world!;
  const blocked = s.development.filter(a => r.developmentStarted[a.id] === undefined).flatMap(a => {
    const quote = quoteWorldOrder(current, s.world!.orders[a.id]!, s.end);
    return quote ? [{ id: a.id, cost: quote.cost,
      exceedsCapacity: keys.filter(k => quote.cost[k] > worldStats(current).storage[k]),
      missing: Object.fromEntries(keys.map(k => [k, Math.max(0, quote.cost[k] - r.stock[k])])) }] : [];
  });
  const gates = Object.fromEntries((['DART', 'VIPER', 'TEMPEST', 'CATACLYSM'] as const).map(h => {
    const yard = HULLS[h].minShipyard;
    const ids = [...(s.hullRequires?.[h] ?? []), ...(yard > 0 ? [`building:SHIPYARD:${yard}`] : [])];
    return [h, ids.some(id => r.developmentCompleted[id] === undefined) ? null : Math.max(0, ...ids.map(id => r.developmentCompleted[id]!))];
  }));
  return { firstBuiltDays: Object.fromEntries(Object.entries(r.firstBuilt).map(([id, t]) => [id, t / 1440])), gates,
    milestones: { firstFleetMinute: r.firstBuilt.DART ?? null, firstT3Day: r.firstBuilt.TEMPEST === undefined ? null : r.firstBuilt.TEMPEST / 1440,
      firstT4Day: r.firstBuilt.CATACLYSM === undefined ? null : r.firstBuilt.CATACLYSM / 1440 },
    completedBuildings: current.buildings, completedResearch: current.tech, categories, blocked,
    spendingResidual: Object.fromEntries(keys.map(k => [k, r.spent[k] - Object.values(categories).reduce((sum, c) => sum + c[k], 0)])),
    maxResourceError: Math.max(...Object.values(r.resourceConservationError).map(Math.abs)),
    maxHullError: Math.max(0, ...Object.values(r.hullConservationError).map(Math.abs)),
    ownedBulk: fleetEntries(r.home).reduce((sum, [h, n]) => sum + s.bulk![h]! * n, 0) };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const rows = [];
  for (const profile of ['average', 'low', 'low-once'] as const) for (const days of [14, 30]) {
    const scenario = costedScenario(profile, days), result = fleetSession(scenario);
    rows.push({ profile, days, scenario, summary: summarizeCosted(scenario, result), result });
  }
  const calibrationRows = [];
  for (const profile of ['average', 'low', 'low-once'] as const)
    for (const earlyMilitary of [0.15, 0.2, 0.25, 0.3, 0.4]) for (const lateMilitary of [0.1, 0.15, 0.2, 0.25, 0.3]) {
      const prices = { earlyMilitary, lateMilitary }, s = costedScenario(profile, 14, prices), r = fleetSession(s);
      const summary = summarizeCosted(s, r), m = summary.milestones;
      calibrationRows.push({ profile, prices, summary, invoiceDecreases: invoiceDecreases(prices),
        pacingPassed: m.firstT3Day !== null && m.firstT3Day >= 3 && m.firstT3Day <= 4
          && m.firstT4Day !== null && m.firstT4Day >= 7 && m.firstT4Day <= 8 });
    }
  const stressRows = [];
  for (const profile of ['average', 'low', 'low-once'] as const)
    for (const stress of ['baseline', 'missed-first-evening', 'missed-work-checks', 'loss-day3.5', 'loss-day7.5'] as const) {
      const s = costedScenario(profile, 14, { earlyMilitary: 0.2, lateMilitary: 0.2 });
      if (stress === 'missed-first-evening') s.windows = s.windows.filter(w => w.start !== 720);
      if (stress === 'missed-work-checks') s.windows = s.windows.filter(w => ![270, 480].includes(w.start % 1440));
      if (stress === 'loss-day3.5' || stress === 'loss-day7.5') s.shocks = [{ at: (stress === 'loss-day3.5' ? 3.5 : 7.5) * 1440, homeLossFraction: 0.5 }];
      const r = fleetSession(s);
      stressRows.push({ profile, stress, summary: summarizeCosted(s, r), result: r });
    }
  const offlineCalibrationRows = [], offlineStressRows = [];
  for (const profile of ['average', 'low', 'low-once'] as const) {
    for (const earlyMilitary of [0.2, 0.3, 0.4, 0.5]) for (const lateMilitary of [0.2, 0.3, 0.4, 0.5, 0.6]) {
      const prices = { earlyMilitary, lateMilitary }, s = costedScenario(profile, 14, prices, 12), r = fleetSession(s);
      const summary = summarizeCosted(s, r), m = summary.milestones;
      offlineCalibrationRows.push({ profile, prices, collectorHours: 12, summary, invoiceDecreases: invoiceDecreases(prices),
        pacingPassed: m.firstT3Day !== null && m.firstT3Day >= 3 && m.firstT3Day <= 4
          && m.firstT4Day !== null && m.firstT4Day >= 7 && m.firstT4Day <= 8 });
    }
    for (const stress of stresses) {
      const s = offlineCandidateScenario(profile, stress), result = fleetSession(s);
      offlineStressRows.push({ profile, stress, scenario: s, summary: summarizeCosted(s, result), result });
    }
  }
  const files = ['tools/costed-progression-study.ts', 'tools/costed-world.ts', 'tools/fleet-session-study.ts',
    'tools/fleet-economy-study.ts', 'tools/fleet-economy-next-study.ts', 'tools/economy-calendar-model.ts',
    'packages/sim/src/player-calendar.ts', 'packages/rules/src/hulls.ts', 'packages/rules/src/research.ts',
    'packages/rules/src/economy.ts', 'packages/rules/src/constants.ts', 'packages/rules/src/tech.ts',
    'packages/rules/src/combat.ts', 'packages/rules/src/fuel.ts', 'packages/rules/src/travel.ts'];
  const sourceHashes = Object.fromEntries(files.map(f => [f, createHash('sha256').update(readFileSync(f)).digest('hex')]));
  process.stdout.write(JSON.stringify({ version: 4, sourceHashes, calibrationRows, stressRows, offlineCalibrationRows, offlineStressRows,
    offlineCaveat: 'rows/calibrationRows/stressRows retain current 6h Works controls. offlineCalibrationRows explicitly use 12h Works with unchanged hourly rates and Vault capacity. offlineStressRows use 0.5/0.5 military invoices and 12h Works. No live constants changed. Sensitivity grid, not an optimizer. Missed sessions and losses can miss pacing targets; no acceptance bands widened.',
    caveat: 'Structural cost integration: all seven real building types and complete selected T3/T4 research chain. Zero installed buildings/tech/hulls; explicit 1500/400/50 seed wallet. Rules intrinsic Hangar0/flight bays remain declared base capacities. rows are current building/research price references with candidate hull recipes. calibrationRows change only military research invoices; duration remains derived from the changed invoice. Early factors price Engineering1/Power1-2; late factors price other selected military rungs. All other prices, recurring rates, gates and human windows unchanged. pacingPassed checks only T3/T4 clocks; invoiceDecreases separately flags cheaper upper rungs. stressRows use 0.2/0.2 with missed sessions or exogenous docked-hull losses, not an opposing player. No industry bundles or granted shipyard4/Core4. Same-queue projected orders; income only after completion. No combat, intel, mining, satellites, instruments or colony spending. First built hull is not first PvP or full fleet conversion. 30 days extends the reference route, not a calibrated season. Not final balance.', rows }, null, 2) + '\n');
}
