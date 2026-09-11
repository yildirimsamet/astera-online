/** Proposed-economy event ledger. Actions are an explicit route, never free milestone grants. */
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Resources } from '../packages/rules/src/types.js';
import { playerWindows } from '../packages/sim/src/player-calendar.js';
export { playerWindows } from '../packages/sim/src/player-calendar.js';

interface Window { start: number; end: number }
type Queue = 'construction' | 'research' | 'yard';
export interface Action {
  id: string; queue: Queue; cost: Resources; minutes: number; requires: string[]; rateGain?: Resources;
  /** Earliest opportunity, not an automatic order or a grant of ownership. */
  notBefore?: number;
  /** Expired optional opportunities are skipped, not accumulated as future debt. */
  expiresAt?: number;
}
interface Scenario {
  start: Resources; rate: Resources; worksHours: number; storageHours: number;
  end: number; windows: Window[]; actions: Action[];
}
const resources = ['alloy', 'crystal', 'deuterium'] as const;
const zero = (): Resources => ({ alloy: 0, crystal: 0, deuterium: 0 });

/** An impossible prerequisite graph is invalid input, not a pacing result. */
export function assertAcyclic(actions: Pick<Action, 'id' | 'requires'>[]): void {
  const graph = new Map(actions.map(a => [a.id, a.requires]));
  const visiting = new Set<string>(), done = new Set<string>();
  const visit = (id: string) => {
    if (visiting.has(id)) throw new Error('Circular development dependency');
    if (done.has(id)) return;
    const requires = graph.get(id);
    if (!requires) throw new Error('Unknown development dependency');
    visiting.add(id);
    for (const prerequisite of requires) visit(prerequisite);
    visiting.delete(id); done.add(id);
  };
  for (const a of actions) visit(a.id);
}

export function evaluateCalendar(s: Scenario) {
  const ids = new Set(s.actions.map(a => a.id));
  const validAmount = (v: number) => Number.isFinite(v) && v >= 0;
  if (ids.size !== s.actions.length || ![s.end, s.worksHours, s.storageHours].every(validAmount)
    || resources.some(r => !validAmount(s.start[r]) || !validAmount(s.rate[r]))
    || s.windows.some(w => !validAmount(w.start) || !validAmount(w.end) || w.end < w.start)
    || s.actions.some(a => !Number.isFinite(a.minutes) || a.minutes <= 0 || !validAmount(a.notBefore ?? 0)
      || (a.expiresAt !== undefined && (!validAmount(a.expiresAt) || a.expiresAt <= (a.notBefore ?? 0)))
      || a.requires.some(id => !ids.has(id) || id === a.id)
      || resources.some(r => !validAmount(a.cost[r]) || !validAmount(a.rateGain?.[r] ?? 0)))) {
    throw new Error('Invalid calendar, order identifiers, duration or resource quantities');
  }
  assertAcyclic(s.actions);
  const stock = { ...s.start }, works = zero(), rate = { ...s.rate };
  const produced = zero(), overflow = zero(), spent = zero();
  const started: Record<string, number> = {}, completed: Record<string, number> = {};
  const pending: { action: Action; due: number }[] = [];
  const decisions = new Set<number>();
  // An economic decision every two active minutes, not free decisions while asleep.
  for (const w of s.windows) for (let t = w.start; t < Math.min(w.end, s.end); t += 2) decisions.add(t);
  const events = new Set<number>([0, s.end, ...decisions]);
  let now = 0;
  while (events.size) {
    const t = Math.min(...events);
    events.delete(t);
    if (t > s.end) break;
    for (const r of resources) {
      const gain = (t - now) / 60 * rate[r];
      const accepted = Math.min(gain, Math.max(0, s.worksHours * rate[r] - works[r]));
      produced[r] += accepted; overflow[r] += gain - accepted; works[r] += accepted;
    }
    now = t;
    for (let i = pending.length - 1; i >= 0; i--) {
      const job = pending[i]!;
      if (job.due <= t) {
        completed[job.action.id] = t;
        for (const r of resources) rate[r] += job.action.rateGain?.[r] ?? 0;
        pending.splice(i, 1);
      }
    }
    if (!decisions.has(t) || t === s.end) continue;
    for (const r of resources) {
      const collect = Math.min(works[r], Math.max(0, s.storageHours * rate[r] - stock[r]));
      stock[r] += collect; works[r] -= collect;
    }
    // Same deterministic planning skill for every profile; three prepaid slots per queue.
    const action = s.actions.find(a => started[a.id] === undefined && t >= (a.notBefore ?? 0)
      && (a.expiresAt === undefined || t < a.expiresAt)
      && a.requires.every(id => completed[id] !== undefined)
      && pending.filter(p => p.action.queue === a.queue).length < 3);
    if (!action || !resources.every(r => stock[r] + 1e-8 >= action.cost[r])) continue;
    const tail = Math.max(t, ...pending.filter(p => p.action.queue === action.queue).map(p => p.due));
    const due = tail + action.minutes;
    for (const r of resources) { stock[r] -= action.cost[r]; spent[r] += action.cost[r]; }
    started[action.id] = t;
    pending.push({ action, due });
    if (due <= s.end) events.add(due);
  }
  return { stock, works, rate, produced, overflow, spent, started, completed,
    conservationError: Object.fromEntries(resources.map(r => [r, s.start[r] + produced[r] - spent[r] - stock[r] - works[r]])) };
}

/** Transparent route feasibility example; industrial packages represent investment bundles, not new game buildings. */
function route(priceScale: number, timeScale: number): Action[] {
  const actions: Action[] = [];
  const cost = (a: number, c: number, d = 0): Resources => ({ alloy: Math.round(a * priceScale), crystal: Math.round(c * priceScale), deuterium: Math.round(d * priceScale) });
  actions.push({ id: 'opening-fleet', queue: 'yard', cost: cost(600, 120), minutes: 12, requires: [] });
  for (let level = 1; level <= 12; level++) {
    const prior = level === 1 ? [] : [`industry-${level - 1}`];
    actions.push({ id: `industry-${level}`, queue: 'construction', cost: cost(180 * 1.65 ** level, 65 * 1.65 ** level),
      minutes: (5 + 9 * level ** 1.3) * timeScale, requires: prior,
      rateGain: { alloy: 65 * 1.18 ** level, crystal: 27 * 1.18 ** level, deuterium: 4 * 1.12 ** level } });
    if ([3, 5, 8].includes(level)) {
      const id = level === 3 ? 'colony' : level === 5 ? 'T3' : 'T4';
      const previous = level === 3 ? [] : [level === 5 ? 'colony' : 'T3'];
      actions.push({ id: `${id}-research`, queue: 'research', cost: cost(650 * level ** 1.5, 300 * level ** 1.5, 25 * level ** 1.5),
        minutes: 75 * level * timeScale, requires: [`industry-${level}`, ...previous] });
      actions.push({ id, queue: 'yard', cost: cost(500 * level ** 1.4, 220 * level ** 1.4, 20 * level ** 1.4),
        minutes: 30 * level * timeScale, requires: [`${id}-research`] });
    }
  }
  return actions;
}

/** Revised design: territory preparation is a voluntary investment, never a military prerequisite. */
export function capitalRoute(priceScale: number, timeScale: number, prepareColony: boolean): Action[] {
  if (![priceScale, timeScale].every(n => Number.isFinite(n) && n > 0)) throw new Error('Invalid route scale');
  const rename = (id: string) => id === 'colony' ? 'colony-ready' : id;
  return route(priceScale, timeScale)
    .filter(a => prepareColony || !a.id.startsWith('colony'))
    .map(a => ({ ...a, id: rename(a.id), requires: a.requires.filter(id => id !== 'colony').map(rename) }));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const rows = [];
  for (const priceScale of [1, 1.5, 2]) for (const timeScale of [1, 2, 4]) {
    for (const profile of ['average', 'low', 'low-once'] as const) {
      const s: Scenario = { start: { alloy: 1200, crystal: 400, deuterium: 80 }, rate: { alloy: 90, crystal: 40, deuterium: 6 },
        worksHours: 12, storageHours: 48, end: 14 * 1440, windows: playerWindows(profile, 14), actions: route(priceScale, timeScale) };
      rows.push({ profile, priceScale, timeScale, scenario: s, result: evaluateCalendar(s) });
    }
  }
  process.stdout.write(JSON.stringify({ version: 1,
    caveat: 'Proposed bundle route sensitivity ONLY. Not current game rules, not a complete colony/research legality model. No attacks, territory race, colony output, PvE, market, or loot. colony means paid preparation complete, not acquired planet. Costs include first fleet per milestone but no ongoing replacement. Loss target must be joined through an operation ledger before acceptance.', rows }, null, 2) + '\n');
}
