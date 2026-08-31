#!/usr/bin/env -S pnpm exec tsx
/**
 * Economy calibration laboratory.
 *
 * This is intentionally smaller and stricter than `economy-v2-model.mjs`:
 * it reads the shipped rules as its baseline, compares a candidate profile with
 * that baseline, searches the construction curve around the target, and runs a
 * deterministic no-PvP progression route at several login cadences.
 *
 * It does NOT claim to replace the full season simulator. Raids, mining, clans,
 * neutral worlds and bot policy stay in `packages/sim`; this tool answers the
 * narrower question that has to be settled first: are income, affordability and
 * queue time internally coherent before player behaviour is added?
 *
 *   pnpm balance:economy
 */

import {
  BUILD,
  CLAN,
  DEATH_STAR,
  ECON,
  ECONOMY_TEMPO,
  HULLS,
  INSTRUMENT_COST_MULT,
  INSTRUMENT_LEVEL_WORTH,
  MULTI_WORLD,
  PLANET_START,
  RESEARCH_PROJECTS,
  researchCostMix,
  SATELLITES,
  START_BUILDINGS,
  type BuildingId,
  type HullId,
  type InstrumentId,
  type ResearchProjectId,
  type Resources,
  type SatelliteId,
} from '../packages/rules/src/index.js';

interface EconomyProfile {
  readonly id: string;
  readonly alloyBase: number;
  readonly alloyMult: number;
  readonly crystalBase: number;
  readonly crystalMult: number;
  readonly costBase: number;
  readonly costMult: number;
  readonly crystalCostBase: number;
  readonly crystalCostMult: number;
  readonly collectorHours: number;
  readonly capHours: number;
  readonly capHoursPerVault: number;
  readonly constructionBase: number;
  readonly constructionPerCore: number;
  readonly yardBase: number;
  readonly yardPerLevel: number;
  readonly defenceBase: number;
  readonly defencePerLevel: number;
  readonly researchTimeMult: number;
  readonly buildCapMinutes: number;
  readonly hullPriceScale: number;
  readonly hullCrystalPriceScale: number;
  readonly flatPriceScale: number;
  readonly gatewayPriceScale: number;
  readonly deuteriumPriceScale: number;
}

const BASELINE: EconomyProfile = {
  id: 'baseline',
  alloyBase: 132,
  alloyMult: 1.10,
  crystalBase: 48,
  crystalMult: 1.09,
  costBase: 52,
  costMult: 1.56,
  crystalCostBase: 52 * 0.2895,
  crystalCostMult: 1.56 * (1.09 / 1.10),
  collectorHours: 10,
  capHours: 12,
  capHoursPerVault: 0.8,
  constructionBase: 240,
  constructionPerCore: 0.22,
  yardBase: 312,
  yardPerLevel: 0.35,
  defenceBase: 1200,
  defencePerLevel: 0.35,
  researchTimeMult: 4,
  buildCapMinutes: 360,
  hullPriceScale: 1,
  hullCrystalPriceScale: 1,
  flatPriceScale: 1,
  gatewayPriceScale: 1,
  deuteriumPriceScale: 1,
};

const BASE_HULL_COSTS: Record<HullId, Resources> = {
  WASP: { alloy: 240, crystal: 0, deuterium: 0 },
  LANCE: { alloy: 820, crystal: 260, deuterium: 0 },
  BULWARK: { alloy: 2150, crystal: 730, deuterium: 0 },
  HAULER: { alloy: 1100, crystal: 200, deuterium: 0 },
  RUNNER: { alloy: 560, crystal: 250, deuterium: 90 },
  BREACHER: { alloy: 1250, crystal: 550, deuterium: 200 },
  BASTION: { alloy: 2400, crystal: 800, deuterium: 0 },
  THORN: { alloy: 700, crystal: 200, deuterium: 0 },
  PROSPECTOR: { alloy: 650, crystal: 200, deuterium: 0 },
};

const BASE_SATELLITE_COSTS: Record<SatelliteId, Resources> = {
  UPLINK: { alloy: 900, crystal: 300, deuterium: 0 },
  FOUNDRY: { alloy: 2000, crystal: 700, deuterium: 0 },
  DERRICK: { alloy: 2200, crystal: 800, deuterium: 0 },
  BEACON: { alloy: 3000, crystal: 1000, deuterium: 0 },
};

const BASE_RESEARCH_COSTS: Record<ResearchProjectId, Resources> = {
  ISOTOPE_SPECTROMETRY: { alloy: 0, crystal: 900, deuterium: 0 },
  DENSE_FUEL_CELLS: { alloy: 0, crystal: 1400, deuterium: 150 },
  GRAVITIC_CHARGES: { alloy: 0, crystal: 1900, deuterium: 350 },
  DEATH_STAR_PROTOCOL: { alloy: 11_000, crystal: 3600, deuterium: 900 },
};

const BASE_SETTLEMENT_COST: Resources = { alloy: 2000, crystal: 1000, deuterium: 0 };
const BASE_DEATH_STAR_COST: Resources = { alloy: 15_000, crystal: 15_000, deuterium: 3000 };
const BASE_PLANET_START: Resources = { alloy: 1303, crystal: 279, deuterium: 40 };

/**
 * The active working profile is deliberately explicit. Search results below show
 * why its construction figures belong in `packages/rules`; the rest encode the
 * owner's requested direction:
 * 30% less passive income with a disciplined price curve keeps the first payback
 * inside one hour while making later development progressively slower.
 */
const CANDIDATE: EconomyProfile = {
  ...BASELINE,
  id: 'candidate',
  alloyBase: BASELINE.alloyBase * 0.7,
  crystalBase: BASELINE.crystalBase * 0.7,
  costBase: BASELINE.costBase * 1.05,
  costMult: 1.54,
  crystalCostBase: BASELINE.crystalCostBase * 1.05,
  crystalCostMult: 1.54 * (BASELINE.crystalMult / BASELINE.alloyMult),
  // Enough room for every legal upgrade without suppressing raidable stock.
  capHours: BASELINE.capHours * 1.10,
  capHoursPerVault: BASELINE.capHoursPerVault * 1.10,
  // Both L11 -> L12 and L12 -> L13 land inside the owner's 1-2 hour band.
  constructionBase: 40,
  constructionPerCore: 0.20,
  // Ship prices rise 25%; returning the yard to its pre-speedup throughput makes
  // craft time 1.50x at every yard level. Fleet movement speed is untouched.
  yardBase: 260,
  // Panic defence must still fit inside the first timed Radar warning.
  defenceBase: 1320,
  // Research stays independent from the separately calibrated construction line.
  researchTimeMult: 0.62,
  buildCapMinutes: 8 * 60,
  hullPriceScale: 1.25,
  // Crystal-bearing hulls carry an additional contested-resource premium.
  hullCrystalPriceScale: 1.15,
  flatPriceScale: 1.7,
  // The seeing layer's door remains affordable inside the opening grant.
  gatewayPriceScale: 1.25,
  // The planned Deuterium refinery gets its own calibration pass.
  deuteriumPriceScale: 1.3,
};

function candidateProfile(
  id: string,
  incomeScale: number,
  costBaseScale: number,
  costMult: number,
): EconomyProfile {
  const storageScale = costBaseScale / incomeScale;
  return {
    ...CANDIDATE,
    id,
    alloyBase: BASELINE.alloyBase * incomeScale,
    crystalBase: BASELINE.crystalBase * incomeScale,
    costBase: BASELINE.costBase * costBaseScale,
    costMult,
    crystalCostBase: BASELINE.crystalCostBase * costBaseScale,
    crystalCostMult: costMult * (BASELINE.crystalMult / BASELINE.alloyMult),
    capHours: BASELINE.capHours * storageScale,
    capHoursPerVault: BASELINE.capHoursPerVault * storageScale,
    hullPriceScale: costBaseScale,
    flatPriceScale: costBaseScale,
  };
}

/** Profiles worth comparing before touching shipped config. */
const PROFILE_SWEEP: readonly EconomyProfile[] = [
  CANDIDATE,
  candidateProfile('flat-44', 0.90, 1.30, BASELINE.costMult),
  candidateProfile('flat-53', 0.85, 1.30, BASELINE.costMult),
  candidateProfile('curve-160', 0.90, 1.20, 1.60),
  candidateProfile('curve-162', 0.90, 1.20, 1.62),
  candidateProfile('curve-164', 0.90, 1.20, 1.64),
];

const round = (value: number): number => Math.round(value);
const total = (cost: Resources): number => cost.alloy + cost.crystal + cost.deuterium;
const format = (value: number): string => Math.round(value).toLocaleString('en-US');
const duration = (minutes: number): string => {
  if (minutes < 1) return `${String(Math.round(minutes * 60))}s`;
  if (minutes < 60) return `${minutes.toFixed(1)}m`;
  return `${(minutes / 60).toFixed(2)}h`;
};
const ratio = (next: number, old: number): string => `${(next / old).toFixed(2)}x`;

function alloyRate(profile: EconomyProfile, level: number): number {
  return profile.alloyBase * level * profile.alloyMult ** level;
}

function crystalRate(profile: EconomyProfile, level: number): number {
  return profile.crystalBase * level * profile.crystalMult ** level;
}

/** Cost to move from `level` to `level + 1`. */
function upgradeCost(profile: EconomyProfile, level: number): Resources {
  return {
    alloy: round(profile.costBase * profile.costMult ** level),
    crystal: round(profile.crystalCostBase * profile.crystalCostMult ** level),
    deuterium: 0,
  };
}

function constructionThroughput(profile: EconomyProfile, core: number): number {
  return profile.constructionBase * (1 + profile.constructionPerCore * Math.max(0, core));
}

function buildMinutes(profile: EconomyProfile, cost: Resources, core: number): number {
  return Math.min(profile.buildCapMinutes, total(cost) / constructionThroughput(profile, core));
}

function hullCost(profile: EconomyProfile, id: HullId): Resources {
  const base = BASE_HULL_COSTS[id];
  return {
    alloy: round(base.alloy * profile.hullPriceScale),
    crystal: round(base.crystal * profile.hullPriceScale * profile.hullCrystalPriceScale),
    deuterium: round(base.deuterium * profile.hullPriceScale),
  };
}

function scaledCost(cost: Resources, scale: number): Resources {
  return {
    alloy: round(cost.alloy * scale),
    crystal: round(cost.crystal * scale),
    deuterium: round(cost.deuterium * scale),
  };
}

function instrumentCost(
  profile: EconomyProfile,
  id: InstrumentId,
  level: number,
): Resources {
  const base = upgradeCost(profile, level * INSTRUMENT_LEVEL_WORTH);
  const multiplier = INSTRUMENT_COST_MULT[id];
  return {
    alloy: round(base.alloy * multiplier),
    crystal: round(base.crystal * multiplier),
    deuterium: 0,
  };
}

function satelliteCost(profile: EconomyProfile, id: SatelliteId): Resources {
  return scaledCost(
    BASE_SATELLITE_COSTS[id],
    id === 'UPLINK' ? profile.gatewayPriceScale : profile.flatPriceScale,
  );
}

function researchCost(profile: EconomyProfile, id: ResearchProjectId): Resources {
  const base = BASE_RESEARCH_COSTS[id];
  return researchCostMix(id, {
    alloy: round(base.alloy * profile.flatPriceScale),
    crystal: round(base.crystal * profile.flatPriceScale),
    deuterium: round(base.deuterium * profile.deuteriumPriceScale),
  });
}

function strategicCost(profile: EconomyProfile, cost: Resources): Resources {
  return {
    alloy: round(cost.alloy * profile.flatPriceScale),
    crystal: round(cost.crystal * profile.flatPriceScale),
    deuterium: round(cost.deuterium * profile.deuteriumPriceScale),
  };
}

function researchMinutes(profile: EconomyProfile, cost: Resources, core: number): number {
  return Math.min(
    profile.buildCapMinutes,
    (profile.researchTimeMult * total(cost)) / constructionThroughput(profile, core),
  );
}

function yardMinutes(profile: EconomyProfile, id: HullId, yard: number): number {
  const throughput = profile.yardBase * (1 + profile.yardPerLevel * Math.max(0, yard));
  return Math.min(profile.buildCapMinutes, total(hullCost(profile, id)) / throughput);
}

function defenceMinutes(profile: EconomyProfile, id: HullId, yard: number): number {
  const throughput = profile.defenceBase * (1 + profile.defencePerLevel * Math.max(0, yard));
  return Math.min(profile.buildCapMinutes, total(hullCost(profile, id)) / throughput);
}

function storageCap(profile: EconomyProfile, rate: number, vault: number): number {
  return round(
    rate * (profile.capHours + profile.capHoursPerVault * Math.max(0, vault)),
  );
}

function collectorCap(profile: EconomyProfile, rate: number): number {
  return round(rate * profile.collectorHours);
}

function opening(profile: EconomyProfile): Resources {
  const mandatory = upgradeCost(profile, 1);
  const wasps = hullCost(profile, 'WASP');
  return {
    alloy: 3 * mandatory.alloy + 2 * wasps.alloy + round(4 * alloyRate(profile, 1)),
    crystal: 3 * mandatory.crystal + 2 * wasps.crystal + round(4 * crystalRate(profile, 1)),
    deuterium: 40,
  };
}

interface SearchResult {
  readonly base: number;
  readonly perCore: number;
  readonly score: number;
  readonly reachL2: number;
  readonly reachL8: number;
  readonly reachL12: number;
  readonly leaveL12: number;
}

const miss = (value: number, low: number, high: number): number => {
  if (value < low) return (low - value) / low;
  if (value > high) return (value - high) / high;
  const middle = (low + high) / 2;
  return Math.abs(value - middle) / (high - low) / 4;
};

/** Search only the queue curve; income and prices are fixed by the chosen tempo. */
function searchConstructionCurve(candidate: EconomyProfile = CANDIDATE): SearchResult[] {
  const results: SearchResult[] = [];
  for (let base = 20; base <= 96; base += 4) {
    for (let perCore = 0.06; perCore <= 0.2 + Number.EPSILON; perCore += 0.01) {
      const profile = { ...candidate, constructionBase: base, constructionPerCore: perCore };
      const to = (level: number): number =>
        buildMinutes(profile, upgradeCost(profile, level - 1), Math.max(1, level - 1));
      const reachL2 = to(2);
      const reachL8 = to(8);
      const reachL12 = to(12);
      const leaveL12 = to(13);
      // Early orders must remain minutes, not seconds or an onboarding wall. Both
      // meanings of "L12" must fit the explicit 60-120 minute owner target.
      const outsideL12 = reachL12 < 60 || reachL12 > 120 || leaveL12 < 60 || leaveL12 > 120;
      const score =
        miss(reachL2, 1.3, 2.3) * 1.5
        + miss(reachL8, 14, 24)
        + miss(reachL12, 70, 95) * 3
        + miss(leaveL12, 100, 120) * 3
        + (outsideL12 ? 10 : 0);
      results.push({
        base,
        perCore: Number(perCore.toFixed(2)),
        score,
        reachL2,
        reachL8,
        reachL12,
        leaveL12,
      });
    }
  }
  return results.sort((a, b) => a.score - b.score);
}

type LadderBuilding = Extract<BuildingId, 'CORE' | 'REFINERY' | 'EXTRACTOR' | 'VAULT' | 'SHIPYARD'>;

interface PlannedUpgrade {
  readonly building: LadderBuilding;
  readonly from: number;
  readonly to: number;
}

/**
 * A transparent, fixed route. It raises the three economy pillars every tier,
 * buys one Vault rung from tier 4 onward and one Yard rung every two tiers. It is
 * not an "optimal bot"; using the same route for both profiles isolates tempo.
 */
function progressionRoute(maxTier = 18): PlannedUpgrade[] {
  const levels: Record<LadderBuilding, number> = {
    CORE: START_BUILDINGS.CORE,
    REFINERY: START_BUILDINGS.REFINERY,
    EXTRACTOR: START_BUILDINGS.EXTRACTOR,
    VAULT: START_BUILDINGS.VAULT,
    SHIPYARD: START_BUILDINGS.SHIPYARD,
  };
  const route: PlannedUpgrade[] = [];
  const add = (building: LadderBuilding): void => {
    const from = levels[building];
    route.push({ building, from, to: from + 1 });
    levels[building] = from + 1;
  };
  for (let tier = 2; tier <= maxTier; tier += 1) {
    add('CORE');
    add('REFINERY');
    add('EXTRACTOR');
    if (tier >= 4) add('VAULT');
    if (tier % 2 === 0 && levels.SHIPYARD < 8) add('SHIPYARD');
  }
  return route;
}

interface PendingUpgrade extends PlannedUpgrade {
  readonly cost: Resources;
  readonly minutes: number;
  readyAt: number;
}

interface Milestone {
  readonly tier: number;
  readonly atMinutes: number;
}

interface ProgressionResult {
  readonly profile: string;
  readonly sessionsPerDay: number;
  readonly economyShare: number;
  readonly milestones: readonly Milestone[];
  readonly finalLevels: Readonly<Record<LadderBuilding, number>>;
  readonly spent: number;
  readonly produced: number;
  readonly wasted: number;
}

function sessionSchedule(days: number, sessionsPerDay: number): Set<number> {
  const sessions = new Set<number>([0]);
  for (let day = 0; day < days; day += 1) {
    for (let session = 0; session < sessionsPerDay; session += 1) {
      // Sessions span a 16-hour waking window; the overnight gap remains real.
      sessions.add(day * 1440 + 480 + round((session * 960) / sessionsPerDay));
    }
  }
  return sessions;
}

function simulateProgression(
  profile: EconomyProfile,
  sessionsPerDay: number,
  economyShare = 1,
  days = 14,
): ProgressionResult {
  const levels: Record<LadderBuilding, number> = {
    CORE: START_BUILDINGS.CORE,
    REFINERY: START_BUILDINGS.REFINERY,
    EXTRACTOR: START_BUILDINGS.EXTRACTOR,
    VAULT: START_BUILDINGS.VAULT,
    SHIPYARD: START_BUILDINGS.SHIPYARD,
  };
  const projected = { ...levels };
  const route = progressionRoute();
  const sessions = sessionSchedule(days, sessionsPerDay);
  const queue: PendingUpgrade[] = [];
  const milestones: Milestone[] = [{ tier: 1, atMinutes: 0 }];
  const purse = opening(profile);
  let alloy = purse.alloy;
  let crystal = purse.crystal;
  let bufferAlloy = 0;
  let bufferCrystal = 0;
  let routeIndex = 0;
  let spent = 0;
  let produced = 0;
  let wasted = 0;

  const complete = (now: number): void => {
    while (queue.length > 0 && queue[0]!.readyAt <= now) {
      const done = queue.shift()!;
      levels[done.building] = done.to;
      const tier = Math.min(levels.CORE, levels.REFINERY, levels.EXTRACTOR);
      if (milestones.every((entry) => entry.tier !== tier)) {
        milestones.push({ tier, atMinutes: now });
      }
      if (queue.length > 0) queue[0]!.readyAt = now + queue[0]!.minutes;
    }
  };

  for (let now = 0; now <= days * 1440; now += 1) {
    complete(now);

    if (now > 0) {
      const hourlyAlloy = alloyRate(profile, levels.REFINERY);
      const hourlyCrystal = crystalRate(profile, levels.EXTRACTOR);
      const alloyGain = hourlyAlloy / 60;
      const crystalGain = hourlyCrystal / 60;
      const nextAlloy = Math.min(collectorCap(profile, hourlyAlloy), bufferAlloy + alloyGain);
      const nextCrystal = Math.min(
        collectorCap(profile, hourlyCrystal),
        bufferCrystal + crystalGain,
      );
      wasted += alloyGain - (nextAlloy - bufferAlloy);
      wasted += crystalGain - (nextCrystal - bufferCrystal);
      produced += alloyGain + crystalGain;
      bufferAlloy = nextAlloy;
      bufferCrystal = nextCrystal;
    }

    if (!sessions.has(now)) continue;

    const alloyRoom = Math.max(
      0,
      storageCap(profile, alloyRate(profile, levels.REFINERY), levels.VAULT) - alloy,
    );
    const crystalRoom = Math.max(
      0,
      storageCap(profile, crystalRate(profile, levels.EXTRACTOR), levels.VAULT) - crystal,
    );
    const takeAlloy = Math.min(bufferAlloy, alloyRoom);
    const takeCrystal = Math.min(bufferCrystal, crystalRoom);
    // The remainder represents ships, hardware, research and ordinary losses.
    // It is deliberately spent immediately: this model is about the budget left
    // for the fixed building route, not about simulating those other systems.
    alloy += takeAlloy * economyShare;
    crystal += takeCrystal * economyShare;
    bufferAlloy -= takeAlloy;
    bufferCrystal -= takeCrystal;

    while (queue.length < BUILD.queueDepth && routeIndex < route.length) {
      const next = route[routeIndex]!;
      const cost = upgradeCost(profile, next.from);
      if (alloy < cost.alloy || crystal < cost.crystal) break;
      alloy -= cost.alloy;
      crystal -= cost.crystal;
      spent += total(cost);
      const minutes = buildMinutes(profile, cost, projected.CORE);
      const readyAt = queue.length === 0 ? now + minutes : Number.POSITIVE_INFINITY;
      queue.push({ ...next, cost, minutes, readyAt });
      projected[next.building] = next.to;
      routeIndex += 1;
    }
  }

  return {
    profile: profile.id,
    sessionsPerDay,
    economyShare,
    milestones,
    finalLevels: levels,
    spent: round(spent),
    produced: round(produced),
    wasted: round(wasted),
  };
}

function printCurveSearch(): void {
  const best = searchConstructionCurve().slice(0, 8);
  console.log('\nCONSTRUCTION CURVE SEARCH');
  console.log('base  perCore  L1->2  L7->8  L11->12  L12->13  score');
  for (const row of best) {
    console.log(
      `${String(row.base).padStart(4)}  ${row.perCore.toFixed(2).padStart(7)}`
      + `  ${duration(row.reachL2).padStart(6)}`
      + `  ${duration(row.reachL8).padStart(6)}`
      + `  ${duration(row.reachL12).padStart(8)}`
      + `  ${duration(row.leaveL12).padStart(8)}`
      + `  ${row.score.toFixed(3)}`,
    );
  }
}

function tunedConstruction(profile: EconomyProfile): EconomyProfile {
  const best = searchConstructionCurve(profile)[0]!;
  return {
    ...profile,
    constructionBase: best.base,
    constructionPerCore: best.perCore,
  };
}

function maxCostToStorage(profile: EconomyProfile): number {
  let worst = 0;
  for (let level = 1; level <= 20; level += 1) {
    const vault = Math.max(0, Math.min(16, level - 3));
    const share = upgradeCost(profile, level).alloy
      / storageCap(profile, alloyRate(profile, level), vault);
    worst = Math.max(worst, share);
  }
  return worst;
}

function printProfileSweep(): void {
  console.log('\nECONOMY PROFILE SWEEP');
  console.log(
    'profile      afford L1  afford L12  L11->12  L12->13  curve       active tier8/tier12  cap risk',
  );
  const oldL1 = total(upgradeCost(BASELINE, 1))
    / (alloyRate(BASELINE, 1) + crystalRate(BASELINE, 1));
  const oldL12 = total(upgradeCost(BASELINE, 12))
    / (alloyRate(BASELINE, 12) + crystalRate(BASELINE, 12));
  const oldProgress = simulateProgression(BASELINE, 5, 0.65);
  const oldTier8 = oldProgress.milestones.find((entry) => entry.tier === 8)?.atMinutes ?? Infinity;
  const oldTier12 = oldProgress.milestones.find((entry) => entry.tier === 12)?.atMinutes ?? Infinity;
  for (const raw of PROFILE_SWEEP) {
    const profile = raw.id === CANDIDATE.id ? raw : tunedConstruction(raw);
    const nextL1 = total(upgradeCost(profile, 1))
      / (alloyRate(profile, 1) + crystalRate(profile, 1));
    const nextL12 = total(upgradeCost(profile, 12))
      / (alloyRate(profile, 12) + crystalRate(profile, 12));
    const reachL12 = buildMinutes(profile, upgradeCost(profile, 11), 11);
    const leaveL12 = buildMinutes(profile, upgradeCost(profile, 12), 12);
    const progress = simulateProgression(profile, 5, 0.65);
    const tier8 = progress.milestones.find((entry) => entry.tier === 8)?.atMinutes ?? Infinity;
    const tier12 = progress.milestones.find((entry) => entry.tier === 12)?.atMinutes ?? Infinity;
    const capRisk = maxCostToStorage(profile);
    console.log(
      profile.id.padEnd(12)
      + ` ${ratio(nextL1, oldL1).padStart(9)}`
      + `  ${ratio(nextL12, oldL12).padStart(10)}`
      + `  ${duration(reachL12).padStart(8)}`
      + `  ${duration(leaveL12).padStart(8)}`
      + `  ${`${String(profile.constructionBase)}/${profile.constructionPerCore.toFixed(2)}`.padStart(10)}`
      + `  ${`${ratio(tier8, oldTier8)}/${ratio(tier12, oldTier12)}`.padStart(20)}`
      + `  ${capRisk.toFixed(2).padStart(8)}${capRisk > 1 ? ' BLOCK' : ''}`,
    );
  }
}

function printBuildingLadder(): void {
  console.log('\nBUILDING LADDER — cost/time to reach the named level');
  console.log('level  old cost  new cost  price   old time  new time  timer');
  for (const level of [2, 3, 5, 8, 10, 12, 13, 15, 18, 20]) {
    const oldCost = upgradeCost(BASELINE, level - 1);
    const newCost = upgradeCost(CANDIDATE, level - 1);
    const oldTime = buildMinutes(BASELINE, oldCost, Math.max(1, level - 1));
    const newTime = buildMinutes(CANDIDATE, newCost, Math.max(1, level - 1));
    console.log(
      `${String(level).padStart(5)}  ${format(total(oldCost)).padStart(8)}`
      + `  ${format(total(newCost)).padStart(8)}  ${ratio(total(newCost), total(oldCost)).padStart(6)}`
      + `  ${duration(oldTime).padStart(8)}  ${duration(newTime).padStart(8)}`
      + `  ${ratio(newTime, oldTime).padStart(6)}`,
    );
  }
}

function printIncomeAndStorage(): void {
  console.log('\nINCOME / AFFORDABILITY / STORAGE');
  console.log('level  old A/h  new A/h  old C/h  new C/h  next-price/income  cost/store');
  for (const level of [1, 5, 8, 12, 16, 20]) {
    const oldA = alloyRate(BASELINE, level);
    const newA = alloyRate(CANDIDATE, level);
    const oldC = crystalRate(BASELINE, level);
    const newC = crystalRate(CANDIDATE, level);
    const oldCost = upgradeCost(BASELINE, level);
    const newCost = upgradeCost(CANDIDATE, level);
    const vault = Math.max(0, Math.min(16, level - 3));
    const oldAfford = total(oldCost) / (oldA + oldC);
    const newAfford = total(newCost) / (newA + newC);
    const storeRatio = newCost.alloy / storageCap(CANDIDATE, newA, vault);
    console.log(
      `${String(level).padStart(5)}  ${format(oldA).padStart(7)}  ${format(newA).padStart(7)}`
      + `  ${format(oldC).padStart(7)}  ${format(newC).padStart(7)}`
      + `  ${ratio(newAfford, oldAfford).padStart(17)}  ${storeRatio.toFixed(2).padStart(10)}`,
    );
  }
}

function printShips(): void {
  console.log('\nHULL PRICE / CRAFT TIME');
  console.log('hull         price   yard  old time  new time  timer');
  const samples: readonly [HullId, number][] = [
    ['WASP', 0],
    ['LANCE', 2],
    ['BULWARK', 4],
    ['HAULER', 1],
    ['RUNNER', 2],
    ['BREACHER', 3],
    ['THORN', 0],
    ['BASTION', 1],
    ['PROSPECTOR', 1],
  ];
  for (const [id, yard] of samples) {
    const oldTime = HULLS[id].ground
      ? defenceMinutes(BASELINE, id, yard)
      : yardMinutes(BASELINE, id, yard);
    const newTime = HULLS[id].ground
      ? defenceMinutes(CANDIDATE, id, yard)
      : yardMinutes(CANDIDATE, id, yard);
    console.log(
      `${id.padEnd(12)} ${ratio(total(hullCost(CANDIDATE, id)), total(hullCost(BASELINE, id))).padStart(6)}`
      + `  ${String(yard).padStart(4)}  ${duration(oldTime).padStart(8)}`
      + `  ${duration(newTime).padStart(8)}  ${ratio(newTime, oldTime).padStart(6)}`,
    );
  }
}

function printHardwareAndResearch(): void {
  console.log('\nINSTRUMENTS — price/time to reach the named level');
  console.log('instrument   level  old price  new price  old time  new time');
  for (const id of ['TELESCOPE', 'RADAR', 'AEGIS', 'VEIL'] as const) {
    for (const level of [1, 3, 5]) {
      const oldCost = instrumentCost(BASELINE, id, level - 1);
      const newCost = instrumentCost(CANDIDATE, id, level - 1);
      const core = Math.max(1, 2 * (level - 1));
      console.log(
        `${id.padEnd(12)} ${String(level).padStart(5)}`
        + `  ${format(total(oldCost)).padStart(9)}`
        + `  ${format(total(newCost)).padStart(9)}`
        + `  ${duration(buildMinutes(BASELINE, oldCost, core)).padStart(8)}`
        + `  ${duration(buildMinutes(CANDIDATE, newCost, core)).padStart(8)}`,
      );
    }
  }

  console.log('\nSATELLITES');
  console.log('satellite     core  old price  new price  old time  new time');
  const satelliteCores: Record<SatelliteId, number> = {
    UPLINK: 1,
    FOUNDRY: 3,
    DERRICK: 5,
    BEACON: 9,
  };
  for (const id of ['UPLINK', 'FOUNDRY', 'DERRICK', 'BEACON'] as const) {
    const core = satelliteCores[id];
    const oldCost = satelliteCost(BASELINE, id);
    const newCost = satelliteCost(CANDIDATE, id);
    console.log(
      `${id.padEnd(12)} ${String(core).padStart(4)}`
      + `  ${format(total(oldCost)).padStart(9)}`
      + `  ${format(total(newCost)).padStart(9)}`
      + `  ${duration(buildMinutes(BASELINE, oldCost, core)).padStart(8)}`
      + `  ${duration(buildMinutes(CANDIDATE, newCost, core)).padStart(8)}`,
    );
  }

  console.log('\nRESEARCH');
  console.log('project                  core  old price  new price  old time  new time');
  const researchCore: Record<ResearchProjectId, number> = {
    ISOTOPE_SPECTROMETRY: 6,
    DENSE_FUEL_CELLS: 6,
    GRAVITIC_CHARGES: 6,
    DEATH_STAR_PROTOCOL: DEATH_STAR.requiredCore,
  };
  for (const id of [
    'ISOTOPE_SPECTROMETRY',
    'DENSE_FUEL_CELLS',
    'GRAVITIC_CHARGES',
    'DEATH_STAR_PROTOCOL',
  ] as const) {
    const core = researchCore[id];
    const oldCost = researchCost(BASELINE, id);
    const newCost = researchCost(CANDIDATE, id);
    console.log(
      `${id.padEnd(24)} ${String(core).padStart(4)}`
      + `  ${format(total(oldCost)).padStart(9)}`
      + `  ${format(total(newCost)).padStart(9)}`
      + `  ${duration(researchMinutes(BASELINE, oldCost, core)).padStart(8)}`
      + `  ${duration(researchMinutes(CANDIDATE, newCost, core)).padStart(8)}`,
    );
  }

  const settlementOld = BASE_SETTLEMENT_COST;
  const settlementNew = scaledCost(settlementOld, CANDIDATE.flatPriceScale);
  const deathStarNew = strategicCost(CANDIDATE, BASE_DEATH_STAR_COST);
  console.log('\nSTRATEGIC PRICE CHECK (fixed Death Star timer is deliberately not auto-scaled)');
  console.log(
    `settlement ${format(total(settlementOld))} -> ${format(total(settlementNew))}`
    + ` · Death Star ${format(total(BASE_DEATH_STAR_COST))} -> ${format(total(deathStarNew))}`
    + ` · timer remains ${String(DEATH_STAR.buildMinutes)}m pending recovery-window simulation`,
  );
}

function milestoneAt(result: ProgressionResult, tier: number): string {
  const hit = result.milestones.find((entry) => entry.tier === tier);
  if (!hit) return '—';
  return `${(hit.atMinutes / 1440).toFixed(2)}d`;
}

function printProgression(): void {
  console.log('\nDETERMINISTIC ECONOMY ROUTE — no raids, mining or rewards');
  console.log('budget      profile     logins  tier3  tier5  tier8  tier10  tier12  day14 C/R/X/V/Y  wasted');
  const budgets = [
    { id: 'econ-only', share: 1 },
    { id: 'balanced', share: 0.65 },
    { id: 'military', share: 0.45 },
  ] as const;
  for (const budget of budgets) {
    for (const sessionsPerDay of [2, 5, 10]) {
      for (const profile of [BASELINE, CANDIDATE]) {
        const result = simulateProgression(profile, sessionsPerDay, budget.share);
      const levels = result.finalLevels;
      console.log(
          `${budget.id.padEnd(11)} ${result.profile.padEnd(11)} ${String(sessionsPerDay).padStart(6)}`
        + `  ${milestoneAt(result, 3).padStart(5)}`
        + `  ${milestoneAt(result, 5).padStart(5)}`
        + `  ${milestoneAt(result, 8).padStart(5)}`
        + `  ${milestoneAt(result, 10).padStart(6)}`
        + `  ${milestoneAt(result, 12).padStart(6)}`
        + `  ${`${String(levels.CORE)}/${String(levels.REFINERY)}/${String(levels.EXTRACTOR)}/${String(levels.VAULT)}/${String(levels.SHIPYARD)}`.padStart(18)}`
        + `  ${(100 * result.wasted / Math.max(1, result.produced)).toFixed(1)}%`,
      );
      }
    }
  }
}

function sameResources(left: Resources, right: Resources): boolean {
  return left.alloy === right.alloy
    && left.crystal === right.crystal
    && left.deuterium === right.deuterium;
}

function assertShippedCandidate(): void {
  const mismatches: string[] = [];
  if (ECON.alloyBase !== CANDIDATE.alloyBase) mismatches.push('alloyBase');
  if (ECON.crystalBase !== CANDIDATE.crystalBase) mismatches.push('crystalBase');
  if (ECON.costBase !== CANDIDATE.costBase) mismatches.push('costBase');
  if (ECON.costMult !== CANDIDATE.costMult) mismatches.push('costMult');
  if (ECON.crystalCostBase !== CANDIDATE.crystalCostBase) mismatches.push('crystalCostBase');
  if (ECON.crystalCostMult !== CANDIDATE.crystalCostMult) mismatches.push('crystalCostMult');
  if (ECON.capHours !== CANDIDATE.capHours) mismatches.push('capHours');
  if (ECON.capHoursPerVault !== CANDIDATE.capHoursPerVault) mismatches.push('capHoursPerVault');
  if (BUILD.conBase !== CANDIDATE.constructionBase) mismatches.push('constructionBase');
  if (BUILD.conPerCore !== CANDIDATE.constructionPerCore) mismatches.push('constructionPerCore');
  if (BUILD.yardBase !== CANDIDATE.yardBase) mismatches.push('yardBase');
  if (BUILD.defBase !== CANDIDATE.defenceBase) mismatches.push('defenceBase');
  if (BUILD.researchTimeMult !== CANDIDATE.researchTimeMult) mismatches.push('researchTimeMult');
  if (BUILD.capMinutes !== CANDIDATE.buildCapMinutes) mismatches.push('buildCapMinutes');
  if (ECONOMY_TEMPO.hullCrystalPrice
    !== CANDIDATE.hullPriceScale * CANDIDATE.hullCrystalPriceScale) {
    mismatches.push('hullCrystalPrice');
  }
  if (!sameResources(PLANET_START, opening(CANDIDATE))) mismatches.push('openingGrant');
  for (const id of Object.keys(BASE_HULL_COSTS) as HullId[]) {
    if (!sameResources(HULLS[id], hullCost(CANDIDATE, id))) mismatches.push(`hull:${id}`);
  }
  for (const id of Object.keys(BASE_SATELLITE_COSTS) as SatelliteId[]) {
    const satellite = SATELLITES[id];
    if (!sameResources(
      { alloy: satellite.alloy, crystal: satellite.crystal, deuterium: 0 },
      satelliteCost(CANDIDATE, id),
    )) {
      mismatches.push(`satellite:${id}`);
    }
  }
  for (const id of Object.keys(BASE_RESEARCH_COSTS) as ResearchProjectId[]) {
    if (!sameResources(RESEARCH_PROJECTS[id].costAt(1), researchCost(CANDIDATE, id))) {
      mismatches.push(`research:${id}`);
    }
  }
  if (!sameResources(MULTI_WORLD.settlement.cost, scaledCost(
    BASE_SETTLEMENT_COST,
    ECONOMY_TEMPO.fixedPrice,
  ))) mismatches.push('settlement');
  if (!sameResources(DEATH_STAR.cost, strategicCost(
    CANDIDATE,
    BASE_DEATH_STAR_COST,
  ))) mismatches.push('deathStar');
  if (!sameResources(CLAN.creationCost, scaledCost(
    { alloy: 5000, crystal: 3000, deuterium: 0 },
    CANDIDATE.flatPriceScale,
  ))) mismatches.push('clanCreation');
  if (mismatches.length > 0) {
    throw new Error(`Calibration candidate drifted from shipped rules: ${mismatches.join(', ')}`);
  }
}

assertShippedCandidate();

console.log('ASTERA ECONOMY CALIBRATION');
console.log(
  `candidate: income ${ratio(CANDIDATE.alloyBase, BASELINE.alloyBase)}`
  + ` · upgrade base ${ratio(CANDIDATE.costBase, BASELINE.costBase)}`
  + ` · growth ${CANDIDATE.costMult.toFixed(2)}`
  + ` · hull price ${CANDIDATE.hullPriceScale.toFixed(2)}x`
  + ` · hull Crystal ${CANDIDATE.hullCrystalPriceScale.toFixed(2)}x extra`,
);
console.log(
  `opening grant: ${format(BASE_PLANET_START.alloy)}/${format(BASE_PLANET_START.crystal)}`
  + ` -> ${format(opening(CANDIDATE).alloy)}/${format(opening(CANDIDATE).crystal)}`,
);

printCurveSearch();
printProfileSweep();
printBuildingLadder();
printIncomeAndStorage();
printShips();
printHardwareAndResearch();
printProgression();
