import { profileHull } from '../packages/rules/src/economy-profile.js';
/** Target-derived offline design candidate. No live rule mutation and no merchant valuation. */
import { HULLS, RESEARCH_PROJECTS, fleetEntries } from '../packages/rules/src/index.js';
import type { BuildingId, Fleet, Hull, HullId, ResearchProjectId, Resources } from '../packages/rules/src/types.js';
import type { TechLevels } from '../packages/rules/src/tech.js';

const keys = ['alloy', 'crystal', 'deuterium'] as const;
const zero = (): Resources => ({ alloy: 0, crystal: 0, deuterium: 0 });
const finite = (n: number) => Number.isFinite(n) && n >= 0;
const rung = (n: number) => {
  if (!Number.isInteger(n) || n < 1 || n > 30) throw new Error('Invalid design level');
};

export function designSeason(days: number) {
  if (!Number.isInteger(days) || days < 7 || days > 60) throw new Error('Invalid design season');
  return { days, firstFleetMinutes: [5, 30], worksHours: 12, maxResearchSpeed: 1.5,
    colonyReadinessDays: [2, 3], t3Days: [3 * days / 14, 4 * days / 14],
    t4Days: [7 * days / 14, 8 * days / 14], developmentScale: days / 14 };
}

/** Design reference income at a producer level. Not granted income at a calendar day. */
export function designIncome(level: number): Resources {
  if (!Number.isInteger(level) || level < 0 || level > 30) throw new Error('Invalid income level');
  return { alloy: 100 * level ** 1.3, crystal: 50 * level ** 1.3, deuterium: 4 * level ** 1.2 };
}

/** Each component consumes its own reference production-hours; there is no automatic conversion. */
export function designInvoice(income: Resources, hours: Resources): Resources {
  if (keys.some(k => !finite(income[k]) || !finite(hours[k]))) throw new Error('Invalid invoice input');
  return { alloy: Math.ceil(income.alloy * hours.alloy), crystal: Math.ceil(income.crystal * hours.crystal),
    deuterium: Math.ceil(income.deuterium * hours.deuterium) };
}

const stretch = (level: number, days: number) => level <= 3 ? 1 : designSeason(days).developmentScale;

/** Prices follow marginal production and increasing repayment horizons; timers are separately authored work. */
export function designBuilding(id: BuildingId, level: number, days: number) {
  rung(level); designSeason(days);
  const income = designIncome(level), previous = designIncome(level - 1);
  const delta = { alloy: income.alloy - previous.alloy, crystal: income.crystal - previous.crystal,
    deuterium: income.deuterium - previous.deuterium };
  const horizon = 0.5 * 1.5 ** (level - 1) * stretch(level, days);
  const labor = Math.min(480, 2 * 1.36 ** (level - 1));
  const shares: Record<BuildingId, Resources> = {
    REFINERY: { alloy: 0.8, crystal: 0.2, deuterium: 0 },
    EXTRACTOR: { alloy: 0.4, crystal: 0.6, deuterium: 0 },
    CORE: { alloy: 0.65, crystal: 0.35, deuterium: 0 },
    VAULT: { alloy: 0.8, crystal: 0.8, deuterium: 0 },
    SHIPYARD: { alloy: 1.3, crystal: 1, deuterium: 0 },
    DEUTERIUM_PLANT: { alloy: 0.6, crystal: 1.2, deuterium: 0 },
  };
  // Yard/Hangar have fewer rungs: their prices use the economic stage they support.
  const referenceLevel = id === 'SHIPYARD' ? Math.min(30, level * 2) : level;
  const reference = designIncome(referenceLevel), before = designIncome(referenceLevel - 1);
  const effectiveDelta = id === 'SHIPYARD'
    ? { alloy: reference.alloy - before.alloy, crystal: reference.crystal - before.crystal, deuterium: 0 } : delta;
  const h = id === 'SHIPYARD'
    ? 0.5 * 1.5 ** (referenceLevel - 1) * stretch(referenceLevel, days) : horizon;
  const hours = { alloy: h * shares[id].alloy, crystal: h * shares[id].crystal, deuterium: 0 };
  return { cost: designInvoice(effectiveDelta, hours), minutes: labor,
    referenceLevel, repaymentHours: h, recipeHours: hours };
}

/** Permission and specialisation efforts; each has an economic reference stage, not an old price multiplier. */
const researchWork: Record<ResearchProjectId, { stage: number; hours: number; growth: number; fuel: number }> = {
  ISOTOPE_SPECTROMETRY: { stage: 4, hours: 3, growth: 1, fuel: 0 },
  DENSE_FUEL_CELLS: { stage: 5, hours: 4, growth: 1, fuel: 2 },
  GRAVITIC_CHARGES: { stage: 6, hours: 5, growth: 1, fuel: 3 },
  DEATH_STAR_PROTOCOL: { stage: 10, hours: 12, growth: 1, fuel: 12 },
  DEUTERIUM_SYNTHESIS: { stage: 1, hours: 2, growth: 3, fuel: 0 },
  YARD_AUTOMATION: { stage: 6, hours: 3, growth: 1.8, fuel: 0 },
  AI_ROBOTS: { stage: 6, hours: 3.5, growth: 1.8, fuel: 0 },
  PROSPECTOR_HOLDS: { stage: 5, hours: 3, growth: 1.8, fuel: 0 },
  CARGO_HOLDS: { stage: 5, hours: 3, growth: 1.8, fuel: 0 },
  STARSHIP_ENGINEERING: { stage: 4, hours: 7.5, growth: 5.5, fuel: 0 },
  SHIP_POWER: { stage: 4, hours: 3, growth: 2.3, fuel: 0.5 },
  SHIP_ARMOR: { stage: 4, hours: 3, growth: 2.3, fuel: 0.5 },
  SHIP_PROPULSION: { stage: 4, hours: 2.5, growth: 2.1, fuel: 1 },
  EMPLACEMENT_DOCTRINE: { stage: 4, hours: 2, growth: 2.1, fuel: 0.5 },
  INTERCEPTION_GRID: { stage: 9, hours: 8, growth: 1, fuel: 8 },
  STRATEGIC_STOCKPILE: { stage: 11, hours: 12, growth: 1, fuel: 12 },
};

export function designResearch(id: ResearchProjectId, level: number, days: number) {
  rung(level); const season = designSeason(days), p = RESEARCH_PROJECTS[id];
  if (level > p.maxLevel) throw new Error('Research beyond effect table');
  // Income grows during the longer season: linear invoices alone compress milestone fractions.
  // Calibrated separately for the first permission and later specialisation; timers stay physical.
  const early = (id === 'STARSHIP_ENGINEERING' && level === 1) || (id === 'SHIP_POWER' && level <= 2);
  const work = researchWork[id], scale = id === 'DEUTERIUM_SYNTHESIS' && level === 1 ? 1
    : season.developmentScale ** (early ? 2.3 : 1.8);
  const growth = work.growth ** (level - 1), h = work.hours * growth * scale;
  const hours = { alloy: h * 0.65, crystal: h, deuterium: work.fuel * growth * scale };
  const reference = designIncome(work.stage);
  return { cost: designInvoice(reference, hours), minutes: Math.min(480, 15 * work.hours * growth ** 0.6),
    referenceLevel: work.stage, recipeHours: hours };
}

export function designRoundTrip(distance: number, unresearchedMinutes: number, propulsionLevel: number) {
  if (!finite(distance) || !finite(propulsionLevel) || !Number.isInteger(propulsionLevel)
    || !Number.isFinite(unresearchedMinutes) || unresearchedMinutes <= 1 / 6) throw new Error('Invalid flight');
  return (unresearchedMinutes - 1 / 6) * distance / 1250 / (1 + Math.min(4, propulsionLevel) * 0.125) + 1 / 6;
}

export function designSpeed(tech: TechLevels) {
  const level = tech.SHIP_PROPULSION ?? 0;
  if (!finite(level) || !Number.isInteger(level)) throw new Error('Invalid propulsion');
  return 1 + Math.min(4, level) * 0.125;
}

/** Fixed reference resource-hours for reporting losses only. Never a payment or conversion rule. */
export function designEffort(cost: Resources) {
  const reference = designIncome(6);
  if (keys.some(k => !finite(cost[k]))) throw new Error('Invalid effort');
  return keys.reduce((sum, k) => sum + cost[k] / reference[k], 0);
}

export interface DesignHull extends Hull { bulk: number; workMinutes: number; referenceRoundTrip: number | null }

/** Full real roster: keep identities, requirements and roles. No cargo hull is borrowed as a combat slot. */
export function designHull(id: HullId): DesignHull {
  return profileHull(HULLS[id]);
}

export function designRenewal(recipe: Resources, income: Resources, trips: number, loss: number,
  fuelPerTrip: number, allocation: number) {
  if (![trips, loss, fuelPerTrip, allocation, ...keys.map(k => recipe[k]), ...keys.map(k => income[k])].every(finite)
    || loss > 1 || allocation > 1 || !Number.isInteger(trips)) throw new Error('Invalid renewal budget');
  const replacement = zero(), required = zero(), requiredShare = zero(), fuel = trips * fuelPerTrip;
  for (const k of keys) {
    replacement[k] = recipe[k] * trips * loss; required[k] = replacement[k] + (k === 'deuterium' ? fuel : 0);
    requiredShare[k] = income[k] > 0 ? required[k] / (income[k] * 24) : required[k] > 0 ? Infinity : 0;
  }
  const limitingResource = keys.reduce((a, b) => requiredShare[a] >= requiredShare[b] ? a : b);
  return { replacement, fuel, required, requiredShare, limitingResource,
    fits: keys.every(k => requiredShare[k] <= allocation) };
}

/** Desired military holdings, not a grant. Off-policy hulls stay owned and consume real hangar room. */
/**
 * WHAT THIS COMMANDER IS TRYING TO OWN, BOUNDED BY PRODUCTION ALONE.
 *
 * IT TOOK A `capacity` UNTIL D195, AND THAT ARGUMENT WAS A WALL THAT NO LONGER
 * EXISTS. D184 removed the Hangar and the fleet ceiling with it — *"there is no
 * fleet ceiling; a fleet is braked by price, fuel and loss"* — so `worldStats`
 * stopped publishing the figure and every caller was reading `undefined` into an
 * arithmetic bound. Removing the parameter is the fix rather than passing a large
 * number, because a large number is still a wall and would still need choosing.
 *
 * `owned` is read to keep hulls the commander already has out of the order, and
 * never mutated.
 */
export function designFleetTarget(income: Resources, owned: Fleet, tier: number, hours: number): Fleet {
  if (!Number.isInteger(tier) || tier < 1 || tier > 4 || !finite(hours)
    || keys.some(k => !finite(income[k])) || fleetEntries(owned).some(([, n]) => !Number.isInteger(n) || n < 0)) {
    throw new Error('Invalid fleet target');
  }
  if (tier === 1) return { DART: 2 };
  if (tier === 2) return { DART: 2, VIPER: 8 };
  const group: Fleet = tier === 3 ? { TEMPEST: 2, VIPER: 4 } : { CATACLYSM: 1, TEMPEST: 2 };
  const recipe = zero();
  for (const [h, n] of fleetEntries(group)) {
    const hull = designHull(h); for (const k of keys) recipe[k] += hull[k] * n;
  }
  let repetitions = Number.MAX_SAFE_INTEGER;
  for (const k of keys) if (recipe[k] > 0) repetitions = Math.min(repetitions, Math.floor(income[k] * hours / recipe[k]));
  return repetitions > 0 && repetitions < Number.MAX_SAFE_INTEGER
    ? Object.fromEntries(fleetEntries(group).map(([h, n]) => [h, n * repetitions])) : {};
}
