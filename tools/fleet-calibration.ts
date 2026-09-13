/** Live fleet audit, including physical wallets and event-free seasons. Never substitutes a design roster. */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ALL_HULLS, COMBAT_HULLS, HULLS, RESOURCE_VALUE, TRADE, alloyRate, crystalRate,
  deuteriumRate, fleetEntries, hullFuelMass, median, missionFuel, resourceValue, shieldHp,
  type Fleet, type HullId, type Resources,
} from '../packages/rules/src/index.js';
import { BANDS, raidReturn, runSeason, type InvariantKey } from '../packages/sim/src/index.js';
import {
  MAX_FLEET_TECH, economicFleetValue, fleetAtEconomicBudget, fleetAtWallet,
  measureFleetBattle, runFleetCalibration,
} from '../packages/sim/src/fleet-calibration.js';

const zero = (): Resources => ({ alloy: 0, crystal: 0, deuterium: 0 });
const recipe = (fleet: Fleet): Resources => {
  const cost = zero();
  for (const [id, count] of fleetEntries(fleet)) {
    for (const key of ['alloy', 'crystal', 'deuterium'] as const) cost[key] += count * HULLS[id][key];
  }
  return cost;
};
const tierHull = (profile: string, tier: number): HullId => {
  const id = ALL_HULLS.find(id => HULLS[id].profile === profile && HULLS[id].tier === tier);
  if (!id) throw new Error(`Missing ${profile} tier ${String(tier)}`);
  return id;
};
export const maxCoreLevel = (players: readonly { buildings: { CORE: number } }[]): number =>
  players.reduce((peak, player) => Math.max(peak, player.buildings.CORE), 0);
export const DEFAULT_FLEET_CALIBRATION_SAMPLES = 64;
const packets = (tier: number): Fleet[] => {
  const raider = tierHull('RAIDER', tier), striker = tierHull('STRIKER', tier);
  const fortress = tierHull('FORTRESS', tier), escort = tierHull('ESCORT', tier);
  return [{ [raider]: 2, [striker]: 1 }, { [raider]: 2, [escort]: 1 },
    { [striker]: 1, [fortress]: 1 }, { [raider]: 1, [striker]: 1, [escort]: 1 },
    { [raider]: 2, [striker]: 1, [tierHull('TRANSPORT', tier)]: 1 }];
};

export function calibrationReport(options: { seasons?: boolean; samples?: number; budgets?: readonly number[] } = {}) {
  const samples = options.samples ?? DEFAULT_FLEET_CALIBRATION_SAMPLES;
  const matrix = runFleetCalibration({ samples, budgets: options.budgets ?? [50_000, 240_000, 1_000_000] });
  const physical = [];
  for (const scale of [1, 4, 16]) for (const isotope of [0.5, 1, 2]) {
    const wallet: Resources = { alloy: 12_000 * scale, crystal: 4500 * scale, deuterium: 700 * scale * isotope };
    for (const tier of [1, 2, 3]) for (const [lowIndex, low] of packets(tier).entries()) {
      for (const [highIndex, high] of packets(tier + 1).entries()) {
        const lower = fleetAtWallet(low, wallet, 1250), higher = fleetAtWallet(high, wallet, 1250);
        for (const shieldLevel of [0, 6, 10]) for (const reverse of [false, true]) {
          for (const research of ['NONE', 'MAX'] as const) {
            const tech = research === 'NONE' ? {} : MAX_FLEET_TECH;
            physical.push({ tier, scale, isotope, lowIndex, highIndex, wallet, lower, higher,
              lowerBuild: recipe(lower), higherBuild: recipe(higher),
              lowerSpend: economicFleetValue(lower), higherSpend: economicFleetValue(higher),
              lowerFuel: missionFuel(lower, 1250, 2), higherFuel: missionFuel(higher, 1250, 2),
              shieldLevel, research, reverse,
              result: measureFleetBattle(reverse ? lower : higher, reverse ? higher : lower,
                { samples, shield: shieldHp(shieldLevel), attackerTech: tech, defenderTech: tech,
                  raid: { store: wallet, buffer: zero(), protected: zero(), distance: 1250 } }) });
          }
        }
      }
    }
  }
  const specialists = [];
  for (const budget of matrix.budgets) for (const shieldLevel of [0, 3, 6, 10]) {
    for (const defender of ['BASTION', 'THORN', 'LEVIATHAN', 'ATLAS'] as const) {
      for (const attacker of ['BALLISTA', 'NULLIFIER'] as const) {
        specialists.push({ budget, shieldLevel, attacker, defender,
          result: measureFleetBattle(fleetAtEconomicBudget(attacker, budget), fleetAtEconomicBudget(defender, budget),
            { samples, shield: shieldHp(shieldLevel) }) });
      }
    }
  }
  const small = [];
  for (const profile of ['RAIDER', 'STRIKER', 'FORTRESS', 'ESCORT']) for (const tier of [1, 2, 3]) {
    const lower = tierHull(profile, tier), higher = tierHull(profile, tier + 1);
    for (const count of [1, 3, 12]) {
      const budget = count * resourceValue(HULLS[higher]);
      small.push({ lower, higher, count, budget,
        result: measureFleetBattle(fleetAtEconomicBudget(higher, budget), fleetAtEconomicBudget(lower, budget), { samples }) });
    }
  }
  const tech = COMBAT_HULLS.flatMap(attacker => COMBAT_HULLS.map(defender => ({ attacker, defender,
    result: measureFleetBattle(fleetAtEconomicBudget(attacker, 240_000), fleetAtEconomicBudget(defender, 240_000),
      { samples, attackerTech: MAX_FLEET_TECH }) })));
  const seasons = [];
  if (options.seasons ?? true) {
    const configs = [14, 30].flatMap(days => [42, 7, 99, 4242, 1337].map(seed => ({ players: 50, days, seed })))
      .concat([42, 99].map(seed => ({ players: 300, days: 30, seed })));
    for (const config of configs) {
      const r = runSeason({ ...config, activityProfiles: 'by-archetype',
        ...(config.players === 50 ? { neutralLayout: {
          capitalSlots: 50, slotPool: 200, neutralCounts: { 1: 10, 2: 5, 3: 2 },
        } } : {}) });
      const settled = r.days.slice(2);
      const metrics = Object.fromEntries((Object.keys(BANDS) as InvariantKey[]).map(key => [key,
        key === 'RR' ? raidReturn(settled.map(day => day.stats))
          : median(settled.map(day => day.invariants[key]).filter(Number.isFinite)),
      ]));
      seasons.push({ ...config, metrics,
        attacks: r.days.reduce((sum, day) => sum + day.stats.attacks, 0), diagnostics: r.diagnostics,
        peakCore: maxCoreLevel(r.world.players) });
    }
  }
  const sources = ['valuation.ts', 'hulls.ts', 'combat.ts', 'economy.ts', 'economy-profile.ts',
    'constants.ts', 'fuel.ts', 'tech.ts', 'loot.ts', 'salvage.ts', 'score.ts', 'pirates.ts',
    'pirate-admission-prices.ts'];
  const hash = (url: URL): string => createHash('sha256').update(readFileSync(url)).digest('hex');
  const sourceHashes = Object.fromEntries(sources.map(name =>
    [name, hash(new URL(`../packages/rules/src/${name}`, import.meta.url))]));
  sourceHashes['fleet-calibration.ts'] = hash(new URL('../packages/sim/src/fleet-calibration.ts', import.meta.url));
  sourceHashes['fleet-calibration-tool.ts'] = hash(new URL('./fleet-calibration.ts', import.meta.url));
  sourceHashes['season.ts'] = hash(new URL('../packages/sim/src/season.ts', import.meta.url));
  return { resourceValue: RESOURCE_VALUE, merchantRate: TRADE.rate, bands: BANDS, sourceHashes,
    assumptions: {
      economicBudget: 'Marginal hull expense A + 2C + 32D, unused budget retained; unlock investment excluded.',
      physical: 'Five fixed integer packets per tier, all hulls already unlocked; no automatic conversion or fleet ceiling; both fuel legs reserved.',
      raids: '1250-unit stationary target; store equals wallet, no buffer/protection; surviving hold, salvage and fuel included. Mission net is not permanent-loss exchange or Dominion.',
      seasons: 'Real archetype calendar, 10-minute cadence; no merchant, shower or convoy. Fifty-player pinned legacy layout and two full 300-player galaxies.',
      acceptance: 'Counter signs and same-profile mean tier advantage are required at economic budgets; arbitrary compositions, shields and physical wallets are diagnostics, not unconditional upper-tier-win requirements.',
    },
    production: [3, 6, 12, 18].map(level => ({ level, alloy: alloyRate(level), crystal: crystalRate(level), deuterium: deuteriumRate(level) })),
    roster: ALL_HULLS.map(id => ({ ...HULLS[id], economicCost: resourceValue(HULLS[id]),
      combatEfficiency: HULLS[id].atk * HULLS[id].hp / resourceValue(HULLS[id]) ** 2,
      holdEfficiency: HULLS[id].cargo / resourceValue(HULLS[id]), fuelMass: hullFuelMass(id) })),
    matrix, physical, specialists, small, tech, seasons };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.stdout.write(JSON.stringify(calibrationReport({ seasons: !process.argv.includes('--no-seasons') })) + '\n');
}
