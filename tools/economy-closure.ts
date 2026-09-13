/** Final bounded design contracts. Envelopes are supply limits, never automatic player income. */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { REWARD_CHAINS } from '../packages/rules/src/rewards.js';
import type { Resources } from '../packages/rules/src/types.js';
import type { ActivityProfile } from '../packages/sim/src/player-calendar.js';
import { designIncome, designInvoice, designHull, designRenewal } from './economy-design-model.js';
import { designScenario } from './economy-design-study.js';
import { worldStats, type WorldOrder } from './costed-world.js';
import { fleetSession } from './fleet-session-study.js';
import { summarizeCosted } from './costed-progression-study.js';
import { fleetEntries, FUEL, HULLS, MULTI_WORLD } from '../packages/rules/src/index.js';
import type { Fleet } from '../packages/rules/src/types.js';

const keys = ['alloy', 'crystal', 'deuterium'] as const;
const scaled = (r: Resources, factor: number): Resources => ({ alloy: r.alloy * factor,
  crystal: r.crystal * factor, deuterium: r.deuterium * factor });

export function externalBudget(referenceProduced: Resources, population: number) {
  if (!Number.isInteger(population) || population < 1
    || keys.some(k => !Number.isFinite(referenceProduced[k]) || referenceProduced[k] < 0)) throw new Error('Invalid external budget');
  return { mining: scaled(referenceProduced, population * 0.1),
    pirates: scaled(referenceProduced, population * 0.05), rewards: scaled(referenceProduced, population * 0.015) };
}

export function colonyInvoice() {
  const capital = { ...MULTI_WORLD.settlement.cost }, fee = { ...MULTI_WORLD.settlement.fee };
  const couriers = MULTI_WORLD.settlement.transports;
  const transport = HULLS[MULTI_WORLD.settlement.transportHull];
  return { capital, fee, couriers,
    total: { alloy: capital.alloy + fee.alloy + couriers * transport.alloy,
      crystal: capital.crystal + fee.crystal + couriers * transport.crystal,
      deuterium: capital.deuterium + fee.deuterium + couriers * transport.deuterium } };
}

export function strategicInvoice() {
  const income = designIncome(10);
  const weapon = designInvoice({ ...income, deuterium: designIncome(7).deuterium },
    { alloy: 24, crystal: 24, deuterium: 48 });
  return { weapon, interceptor: { alloy: Math.ceil(weapon.alloy * 0.6), crystal: Math.ceil(weapon.crystal * 0.6),
    deuterium: Math.ceil(weapon.deuterium * 0.6) }, weaponWorkMinutes: 240, interceptorWorkMinutes: 120 };
}

export function rewardInvoices(purse: Resources) {
  if (keys.some(k => !Number.isFinite(purse[k]) || purse[k] < 0)) throw new Error('Invalid reward purse');
  const tiers = REWARD_CHAINS.filter(c => c.scope === 'season').flatMap(c =>
    c.tiers.map((t, i) => ({ id: `${c.id}:${t.goal}`, scope: c.scope, goal: t.goal, weight: i + 1 })));
  const total = tiers.reduce((sum, t) => sum + t.weight, 0);
  return tiers.map(t => ({ ...t, reward: { alloy: Math.floor(purse.alloy * t.weight / total),
    crystal: Math.floor(purse.crystal * t.weight / total), deuterium: Math.floor(purse.deuterium * t.weight / total) } }));
}

export function closureScenario(profile: ActivityProfile, days: number) {
  const s = designScenario(profile, days); s.fleetBudgetHours = 18;
  // D184 removed the runtime fleet ceiling. This older physical harness still
  // needs a finite upper bound for its arithmetic, so model the absent ceiling
  // without reintroducing a gameplay limit.
  s.hangar = Number.MAX_SAFE_INTEGER;
  s.desiredFleet.COURIER = 2;
  const insert = (id: string, order: WorldOrder, before: string) => {
    s.world!.orders[id] = order;
    const index = s.development.findIndex(a => a.id === before);
    s.development.splice(index < 0 ? s.development.length : index, 0,
      { id, queue: 'research' in order ? 'research' : 'construction', minutes: 1,
        cost: { alloy: 0, crystal: 0, deuterium: 0 }, requires: [] });
  };
  insert('satellite:UPLINK', { satellite: 'UPLINK' }, 'building:CORE:2');
  insert('instrument:TELESCOPE:1', { instrument: 'TELESCOPE', level: 1 }, 'building:CORE:2');
  insert('instrument:RADAR:1', { instrument: 'RADAR', level: 1 }, 'building:CORE:4');
  insert('research:DEUTERIUM_SYNTHESIS:2', { research: 'DEUTERIUM_SYNTHESIS', level: 2 }, 'building:CORE:5');
  for (let level = 4; level <= 7; level++) {
    if (level === 7) insert('research:DEUTERIUM_SYNTHESIS:3', { research: 'DEUTERIUM_SYNTHESIS', level: 3 }, 'building:CORE:8');
    insert(`building:DEUTERIUM_PLANT:${level}`, { building: 'DEUTERIUM_PLANT', level }, `building:CORE:${level + 1}`);
  }
  // Buy the T3 fuel supply first; the heavier supply follows the T4 permission.
  // These are spending priorities, not new game prerequisites or calendar grants.
  for (const a of s.development) {
    const o = s.world!.orders[a.id]!;
    if (('building' in o && o.building === 'DEUTERIUM_PLANT' && o.level >= 5)
      || ('research' in o && o.research === 'DEUTERIUM_SYNTHESIS' && o.level === 3)) {
      a.requires = [...a.requires, 'research:STARSHIP_ENGINEERING:2'];
    }
  }
  return s;
}

export function closureStudy() {
  const cases: { profile: ActivityProfile; days: number; stress: string }[] = [
    { profile: 'average', days: 14, stress: 'baseline' }, { profile: 'average', days: 30, stress: 'baseline' },
    { profile: 'low-once', days: 14, stress: 'baseline' }, { profile: 'average', days: 14, stress: 'evening-losses' }];
  const runs = cases.map(c => {
    const scenario = closureScenario(c.profile, c.days);
    // Exogenous stress only: three trips exposing half the home fleet at 22.5% losses.
    // No enemy, loot or actual trip is invented. Actual rounded hull losses are paid back through Yard.
    if (c.stress === 'evening-losses') scenario.shocks = Array.from({ length: 10 }, (_, i) =>
      ({ at: (i + 3) * 1440 + 750, homeLossFraction: 3 * 0.5 * 0.225 }));
    const result = fleetSession(scenario);
    return { ...c, scenario, result, summary: summarizeCosted(scenario, result) };
  });
  // End of the third morning: observation only. No colony or guaranteed target is granted.
  const readiness = (['average', 'low-once'] as const).map(profile => {
    const s = closureScenario(profile, 14); s.end = 3 * 1440 - 1;
    const r = fleetSession(s), c = colonyInvoice();
    const colonyCore = MULTI_WORLD.colonyCoreThresholds[0];
    const ready = r.world!.buildings.CORE >= colonyCore && (r.home.COURIER ?? 0) >= c.couriers
      && (r.home.DART ?? 0) >= 2 && (r.world!.instruments?.TELESCOPE ?? 0) >= 1
      && r.stock.alloy >= c.capital.alloy + c.fee.alloy && r.stock.crystal >= c.capital.crystal + c.fee.crystal
      && r.stock.deuterium >= 5;
    return { profile, at: s.end, ready, stock: r.stock, home: r.home, world: r.world,
      requirement: { ...c, fuelReserve: 5, core: colonyCore, telescope: 1, darts: 2 } };
  });
  const packets: { day: number; fleet: Fleet }[] = [{ day: 5, fleet: { TEMPEST: 2, VIPER: 4, COURIER: 1 } },
    { day: 10, fleet: { CATACLYSM: 2, TEMPEST: 2, COURIER: 1 } }];
  const renewal = packets.map(({ day, fleet }) => {
    const s = closureScenario('average', 14); s.end = day * 1440;
    const r = fleetSession(s), recipe = { alloy: 0, crystal: 0, deuterium: 0 };
    let mass = 0, work = 0;
    for (const [h, n] of fleetEntries(fleet)) {
      const t = designHull(h);
      for (const k of keys) recipe[k] += n * t[k];
      mass += n * Math.max(1, Math.ceil((t.alloy + t.crystal + t.deuterium) * FUEL.perValue
        * (FUEL.pivotRoundTrip / (t.referenceRoundTrip ?? FUEL.pivotRoundTrip)))); work += n * t.workMinutes;
    }
    const fuel = Math.ceil(mass * 1250 / FUEL.scale) * 2;
    const budget = designRenewal(recipe, worldStats(r.world!).rate, 3, 0.225, fuel, 0.3);
    return { day, fleet, recipe, fuel, world: r.world, budget,
      replacementWorkMinutes: work * 3 * 0.225 / (1 + 0.12 * r.world!.buildings.SHIPYARD),
      note: 'Budget stress, not three simulated victories; carrier loss included conservatively.' };
  });
  const reference = runs[0]!.result.produced;
  const scaling = [300, 500, 1000].map(population => ({ population, colonies: Math.ceil(population * 17 / 100),
    totalWorlds: population + Math.ceil(population * 17 / 100), radiusMultiplier3d: Math.cbrt(population / 300),
    external: externalBudget(reference, population) }));
  return { runs, readiness, renewal, scaling, colony: colonyInvoice(), strategic: strategicInvoice(),
    rewards14: rewardInvoices({ alloy: Math.floor(reference.alloy * 0.03),
      crystal: Math.floor(reference.crystal * 0.03), deuterium: 0 }) };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const files = ['tools/economy-closure.ts', 'tools/economy-design-model.ts', 'tools/economy-design-study.ts',
    'tools/costed-world.ts', 'tools/fleet-session-study.ts', 'packages/rules/src/constants.ts',
    'packages/rules/src/research.ts', 'packages/rules/src/rewards.ts', 'packages/rules/src/tech.ts',
    'packages/rules/src/hulls.ts', 'packages/rules/src/combat.ts', 'packages/sim/src/player-calendar.ts'];
  console.log(JSON.stringify({ sourceHashes: Object.fromEntries(files.map(f =>
    [f, createHash('sha256').update(readFileSync(f)).digest('hex')])), ...closureStudy() }, null, 2));
}
