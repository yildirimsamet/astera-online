/**
 * Single-account adversarial measurements, NOT an acceptance simulator.
 * Uses the shipped tables; does not mutate a season or change owner decisions.
 * The pirate proof deliberately measures the current repeated-purse defect.
 */
import { pathToFileURL } from 'node:url';
import {
  HULLS, MULTI_WORLD, TUTORIAL_EXIT, buildingCost, buildingMinutes,
  alloyRate, crystalRate, deuteriumStorageCap, storageCap, resourceValue,
  findRewardTier, generatePirateSchedule, mulberry32, pirateStats,
  resolveCombat, computeLoot, fleetCargo,
  RESEARCH_PROJECTS, canAttack, hullRequirementsMet,
  type Resources, type Fleet,
} from '../packages/rules/src/index.js';

const empty = (): Resources => ({ alloy: 0, crystal: 0, deuterium: 0 });
const add = (left: Resources, right: Resources): Resources => ({
  alloy: left.alloy + right.alloy, crystal: left.crystal + right.crystal,
  deuterium: left.deuterium + right.deuterium,
});

export function openingRoute() {
  const steps = [2, 3, 4, 5].map((from) => ({ from, to: from + 1,
    cost: buildingCost('CORE', from), minutes: buildingMinutes('CORE', from + 1, {}),
  }));
  const coreCost = steps.reduce((sum, step) => add(sum, step.cost), empty());
  // The Academy exit has already paid the Core 2->3 order.
  const futureCoreCost = steps.slice(1).reduce((sum, step) => add(sum, step.cost), empty());
  const rewards = ['CORE:3', 'CORE:5', 'RAID:1'].reduce((sum, id) => {
    const ref = findRewardTier(id);
    if (!ref) throw new Error(`Missing opening reward ${id}`);
    return add(sum, ref.tier.reward);
  }, empty());
  const secondCourier = { alloy: HULLS.COURIER.alloy, crystal: HULLS.COURIER.crystal,
    deuterium: HULLS.COURIER.deuterium };
  const cash = add(TUTORIAL_EXIT.resources, rewards);
  const commitments = add(add(futureCoreCost, secondCourier), MULTI_WORLD.settlement.charge);
  return { steps, coreCost, futureCoreCost,
    coreMinutes: steps.reduce((sum, step) => sum + step.minutes, 0),
    exitResources: TUTORIAL_EXIT.resources, rewards, secondCourier,
    afterCommitments: { alloy: cash.alloy - commitments.alloy,
      crystal: cash.crystal - commitments.crystal, deuterium: cash.deuterium - commitments.deuterium },
    canFundCoreSixAndFounding: cash.alloy >= commitments.alloy && cash.crystal >= commitments.crystal,
    caveat: 'No solo garrison clear included. A public claim must already exist, and flight fuel/ETA still apply.',
  };
}

export function neutralBank() {
  const tiers = ([1, 2, 3] as const).map((tier) => {
    const template = MULTI_WORLD.neutral[tier];
    const stock = { alloy: storageCap(alloyRate(template.buildings.REFINERY), template.buildings.VAULT),
      crystal: storageCap(crystalRate(template.buildings.EXTRACTOR), template.buildings.VAULT),
      deuterium: deuteriumStorageCap(0, crystalRate(template.buildings.EXTRACTOR), template.buildings.VAULT) };
    const firstDecisive = computeLoot(stock, empty(), empty(), 'DECISIVE', Number.MAX_SAFE_INTEGER);
    return { tier, count: MULTI_WORLD.neutralCounts[tier], stock,
      stockValue: resourceValue(stock), captureStock: template.captureStock,
      captureValue: resourceValue(template.captureStock),
      raidThenCapture: add(firstDecisive, template.captureStock),
      hourly: { alloy: alloyRate(template.buildings.REFINERY), crystal: crystalRate(template.buildings.EXTRACTOR) },
      reinforcementMinutes: template.reinforcementMinutes };
  });
  return { tiers, initialDeuterium: tiers.reduce((sum, tier) => sum + tier.count * tier.stock.deuterium, 0),
    initialValue: tiers.reduce((sum, tier) => sum + tier.count * tier.stockValue, 0) };
}

export function pirateRepeatProof() {
  const pirate = generatePirateSchedule(mulberry32(4242))[1];
  if (!pirate) throw new Error('No deterministic proof pirate');
  const fleets: Fleet[] = [{ DART: 2, COURIER: 1 }, { DART: 2, COURIER: 1 }];
  let crew = pirate.roster;
  const battles = fleets.map((fleet) => {
    const result = resolveCombat(fleet, crew, 0, () => 0.5, {
      attacker: { tech: {} }, defender: { tech: {}, damageMult: pirateStats(pirate.level).damageMult },
    });
    crew = result.defenderSurvivors;
    const loot = computeLoot(pirate.hoard, empty(), empty(), result.grade,
      fleetCargo(result.attackerSurvivors, {}));
    return { fleet, result, loot };
  });
  const totalPaid = battles.reduce((sum, battle) => add(sum, battle.loot), empty());
  const physical = (resources: Resources) => resources.alloy + resources.crystal + resources.deuterium;
  return { pirateIndex: pirate.index, originalCrew: pirate.roster, hoard: pirate.hoard,
    grades: battles.map((battle) => battle.result.grade), losses: battles.map((battle) => battle.result.attackerLosses),
    fleets, loot: battles.map((battle) => battle.loot), totalPaid,
    originalPhysical: physical(pirate.hoard), paidPhysical: physical(totalPaid),
    originalEconomic: resourceValue(pirate.hoard), paidEconomic: resourceValue(totalPaid),
    caveat: 'Purse does not diminish between surviving partial hits; bounded by crew casualties and pirate life, not infinite.',
  };
}

/** Eligibility proof, not a timed route that grants or buys this research. */
export function lowCoreHighTierProof() {
  const capitalCore = 6;
  const hull = 'CATACLYSM' as const;
  const tech = { STARSHIP_ENGINEERING: 2, SHIP_POWER: 4, SHIP_ARMOR: 2 };
  const spec = HULLS[hull];
  const researchGates = spec.requiredResearch.map(({ project, level }) => ({
    project, level, requiredCore: RESEARCH_PROJECTS[project].requiredCore ?? 0,
    availableAtMinutes: RESEARCH_PROJECTS[project].availableAtMinutes,
  }));
  return { capitalCore, hull, requiredYard: spec.minShipyard, tech, researchGates,
    productionAllowed: spec.minShipyard <= capitalCore && hullRequirementsMet(hull, tech),
    attackFromSix: canAttack({ playerId: 'attacker', peakCoreLevel: 6 },
      { playerId: 'victim', peakCoreLevel: 2 }, 0),
    attackFromSeven: canAttack({ playerId: 'attacker', peakCoreLevel: 7 },
      { playerId: 'victim', peakCoreLevel: 2 }, 0),
    caveat: 'Yard six and all research/hulls must be paid for; newcomer shields, fuel/bays and bash still apply. No timed tier-four opening is claimed.',
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  console.log(JSON.stringify({ opening: openingRoute(), neutral: neutralBank(), pirate: pirateRepeatProof(),
    lowCoreHighTier: lowCoreHighTierProof() }, null, 2));
}
