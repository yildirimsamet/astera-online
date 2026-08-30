import { DEATH_STAR, DEUTERIUM, RESEARCH_TECH, SEASON } from './constants.js';
import { ECONOMY_TEMPO, scalePrice } from './tempo.js';
import { cargoMult, hullTech, prospectorHoldMult, yardSpeedMult } from './tech.js';
import { RESEARCH_PROJECT_IDS, type ResearchProjectId, type Resources } from './types.js';

export interface ResearchProject {
  id: ResearchProjectId;
  /**
   * ONE FOR A PERMISSION, MORE FOR A LADDER. T7.
   *
   * The four seasonal projects are permissions — you hold Dense Fuel Cells or you
   * do not, and a second purchase would buy nothing. What comes after them are
   * multipliers, and those have levels. The model carries the ceiling now so that
   * adding a ladder is a table entry rather than a schema migration.
   */
  maxLevel: number;
  /**
   * What it costs to REACH `level`, one-based: level 1 is what an unowned project
   * costs. A function rather than a figure so a ladder can price its own rungs
   * without a second table for prices, and `flat` keeps a permission honest — it
   * quotes the same number at every level it has, which is one.
   */
  costAt: (level: number) => Resources;
  availableAtMinutes: number;
  prerequisite: ResearchProjectId | null;
  requiredCore?: number;
}

/*
  THE TWO EFFECTS THAT ARE NOT IN `tech.ts`, HOISTED ABOVE THEIR READER.

  Both belong beside the project rather than with the multipliers — one limits a
  building, one counts weapons on a pad — and both are read by the ceiling walk
  below, which runs at module evaluation. A `const` arrow declared after it is in
  the temporal dead zone at exactly that moment, so the order here is load-bearing
  rather than tidy.
*/
/**
 * HOW MANY STRATEGIC WEAPONS ONE WORLD MAY HOLD AT ONCE. T11.
 *
 * The research removes the CHORE — being at the keyboard the minute the first
 * finishes — and never the COST: the second is built after the first, for its own
 * full hour. Two is the ceiling because D113 already turns two hits inside a
 * recovery window into a colony changing hands, and a third would make that route
 * a formality rather than a campaign.
 */
export const strategicStockpile = (stockpileLevel: number): number =>
  stockpileLevel > 0 ? 2 : 1;

/**
 * THE HIGHEST DEUTERIUM PLANT A COMMANDER MAY STAND, from their research rung.
 *
 * Lives beside the project rather than in `economy.ts` because it is a property of
 * the RESEARCH: the plant is the thing being limited, and the limit is the rung.
 *
 * CLAMPED AT THE LADDER'S OWN TOP, and it was not — T12 found it. `costAt` stopped
 * charging at rung five while this went on granting three more plant levels
 * forever, which is D36's bug written the other way round: an effect that outruns
 * the price it is sold at. Nothing could reach rung six through the queue, so it
 * never paid out — but the ceiling walk in `RESEARCH_MAX_LEVEL` reads this
 * function to decide where the ladder ENDS, and an unclamped effect told it the
 * ladder was thirty-two rungs long.
 */
export const plantCeiling = (researchLevel: number): number =>
  Math.max(0, Math.min(RESEARCH_TECH.economyMaxLevel, Math.floor(researchLevel)))
    * DEUTERIUM.plantLevelsPerResearch;

/**
 * WHAT ONE RUNG OF A PROJECT BUYS, AS A SINGLE NUMBER. T12.
 *
 * Every project has an effect and every effect already lives in exactly one
 * exported function. This is the index of them, and it exists so the CEILING can
 * be found rather than typed — see `RESEARCH_MAX_LEVEL` below for why that
 * distinction has already cost this code base a wrong number on screen.
 *
 * A PERMISSION IS NOT A SPECIAL CASE HERE. It reports 1 when held and 0 when not,
 * which is exactly what "held or not held" means as a number, and it is what makes
 * a permission fall out of the same walk as a five-rung ladder instead of needing
 * a flag that says which kind it is.
 *
 * The doctrines each report through the hull they teach; the general project
 * reports through any hull, because it lifts all of them. Only the FACTOR matters,
 * not which hull is asked.
 */
export function researchEffectAt(id: ResearchProjectId, level: number): number {
  const rung = Math.max(0, Math.floor(level));
  switch (id) {
    case 'DEUTERIUM_SYNTHESIS':
      return plantCeiling(rung);
    case 'YARD_AUTOMATION':
      return yardSpeedMult({ YARD_AUTOMATION: rung });
    case 'PROSPECTOR_HOLDS':
      return prospectorHoldMult({ PROSPECTOR_HOLDS: rung });
    case 'CARGO_HOLDS':
      return cargoMult({ CARGO_HOLDS: rung });
    case 'WASP_DOCTRINE':
      return hullTech({ WASP_DOCTRINE: rung }, 'WASP').atk;
    case 'LANCE_DOCTRINE':
      return hullTech({ LANCE_DOCTRINE: rung }, 'LANCE').atk;
    case 'BULWARK_DOCTRINE':
      return hullTech({ BULWARK_DOCTRINE: rung }, 'BULWARK').atk;
    case 'EMPLACEMENT_DOCTRINE':
      return hullTech({ EMPLACEMENT_DOCTRINE: rung }, 'BASTION').atk;
    case 'WEAPONS_GENERAL':
      return hullTech({ WEAPONS_GENERAL: rung }, 'WASP').atk;
    case 'STRATEGIC_STOCKPILE':
      return strategicStockpile(rung);
    /*
      THE PERMISSIONS. Each opens a door and opening it twice opens nothing: the
      isotope reveals the rocks, dense cells and gravitic charges each unlock a
      hull, the protocol authorises the weapon, the grid authorises the charge.
    */
    case 'ISOTOPE_SPECTROMETRY':
    case 'DENSE_FUEL_CELLS':
    case 'GRAVITIC_CHARGES':
    case 'DEATH_STAR_PROTOCOL':
    case 'INTERCEPTION_GRID':
      return rung > 0 ? 1 : 0;
  }
}

/**
 * Far above any ceiling the game has. Every effect above clamps its own rung, so
 * the walk below is looking for where the number stops moving, and this only has
 * to be past that point.
 */
const CEILING_SEARCH = 32;

/**
 * WHERE EACH PROJECT STOPS SELLING ANYTHING. T12, and it is D36's rule again.
 *
 * D36 recorded what a typed ceiling costs: the Telescope's range table ended at L5
 * while the interface went on offering L6 and CHARGING for it, reporting
 * "500 -> 500" as it took the money. `INSTRUMENT_MAX_LEVEL` fixed that by reading
 * the table's length instead of restating it, and this is the same fix for
 * research — with the one difference that an instrument's effect is a lookup table
 * whose length IS the answer, while a research effect is a function. So the
 * ceiling is WALKED: the last rung that changes the number is the last rung worth
 * selling.
 *
 * Every project reads its `maxLevel` from here, so the cost ladder and the effect
 * cannot part company — extend one without the other and `test/research-ceiling`
 * goes red rather than the screen quoting a price for nothing.
 */
export const RESEARCH_MAX_LEVEL: Readonly<Record<ResearchProjectId, number>> =
  Object.fromEntries(RESEARCH_PROJECT_IDS.map((id) => {
    let top = 1;
    for (let level = 1; level <= CEILING_SEARCH; level++) {
      if (researchEffectAt(id, level) !== researchEffectAt(id, level - 1)) top = level;
    }
    return [id, top];
  })) as Record<ResearchProjectId, number>;

/** Whether this project has nothing left to sell at `level`. */
export const researchMaxed = (id: ResearchProjectId, level: number): boolean =>
  level >= RESEARCH_MAX_LEVEL[id];

/** The instant the war act opens, shared by every project that belongs to it. */
const RESEARCH_PROJECTS_WAR_OPENS =
  SEASON.actBoundaries.find((boundary) => boundary.id === 'war')!.share
  * SEASON.days * 24 * 60;

/** A project with one rung: the same price whatever level it is asked about. */
const flat = (cost: Resources) => (): Resources => cost;

/**
 * An economy ladder: five rungs, each 2.2x the last, open from the first minute.
 *
 * One helper rather than three hand-written tables, because the three differ only
 * in their opening price — and a shape written out three times is three places for
 * a rung to go missing.
 */
/**
 * A weapon ladder: five rungs, each 2.0x the last, and deuterium from the second.
 *
 * TWO, NOT MORE, AND THE CLAMP IS WHY. At 2.4 the top rung priced out at a build
 * time of exactly `BUILD.capMinutes` even for a Core-14 commander — and at the
 * clamp, further cost stops being felt as time, which makes the last rung partly
 * free in the one currency a queue actually charges.
 *
 * `weight` prices the general project above a single doctrine, because it lifts
 * every hull a commander owns rather than one of them.
 */
const weaponLadder = (id: ResearchProjectId, weight = 1): ResearchProject => ({
  id,
  maxLevel: RESEARCH_MAX_LEVEL[id],
  costAt: (level: number) => {
    const rung = Math.max(1, Math.min(RESEARCH_TECH.weaponMaxLevel, level));
    const step = Math.pow(2, rung - 1) * weight;
    return {
      alloy: scalePrice(2200 * step, ECONOMY_TEMPO.fixedPrice),
      crystal: scalePrice(1300 * step, ECONOMY_TEMPO.fixedPrice),
      deuterium: rung === 1 ? 0 : scalePrice(180 * Math.pow(2, rung - 2) * weight,
        ECONOMY_TEMPO.deuteriumPrice),
    };
  },
  availableAtMinutes: 0,
  prerequisite: null,
});

const economyLadder = (
  id: ResearchProjectId,
  alloy: number,
  crystal: number,
): ResearchProject => ({
  id,
  maxLevel: RESEARCH_MAX_LEVEL[id],
  costAt: (level: number) => {
    const step = Math.pow(2.2, Math.max(1, Math.min(RESEARCH_TECH.economyMaxLevel, level)) - 1);
    return {
      alloy: scalePrice(alloy * step, ECONOMY_TEMPO.fixedPrice),
      crystal: scalePrice(crystal * step, ECONOMY_TEMPO.fixedPrice),
      deuterium: 0,
    };
  },
  availableAtMinutes: 0,
  prerequisite: null,
});

/** These three economy projects keep their original Alloy/Crystal distribution. */
const RESEARCH_COST_MIX_EXEMPTIONS = new Set<ResearchProjectId>([
  'YARD_AUTOMATION',
  'PROSPECTOR_HOLDS',
  'CARGO_HOLDS',
]);

/**
 * Bias a research price toward Crystal without changing its Deuterium component.
 * Applied after tempo scaling so the requested percentages hold for every quoted
 * rung and the public price remains an integer resource amount.
 */
export function researchCostMix(id: ResearchProjectId, cost: Resources): Resources {
  if (RESEARCH_COST_MIX_EXEMPTIONS.has(id)) return cost;
  return {
    alloy: Math.round(cost.alloy * 0.75),
    crystal: Math.round(cost.crystal * 1.25),
    deuterium: cost.deuterium,
  };
}

const withResearchCostMix = (
  projects: Record<ResearchProjectId, ResearchProject>,
): Record<ResearchProjectId, ResearchProject> => {
  for (const id of RESEARCH_PROJECT_IDS) {
    const project = projects[id];
    const baseCostAt = project.costAt;
    projects[id] = {
      ...project,
      costAt: (level: number) => researchCostMix(id, baseCostAt(level)),
    };
  }
  return projects;
};

/** Three short seasonal projects; each door points back into public play. D93–D95. */
export const RESEARCH_PROJECTS: Record<ResearchProjectId, ResearchProject> = withResearchCostMix({
  ISOTOPE_SPECTROMETRY: {
    id: 'ISOTOPE_SPECTROMETRY',
    maxLevel: RESEARCH_MAX_LEVEL.ISOTOPE_SPECTROMETRY,
    costAt: flat({ alloy: 0, crystal: scalePrice(900, ECONOMY_TEMPO.fixedPrice), deuterium: 0 }),
    availableAtMinutes: DEUTERIUM.frontierStartsAtMinutes,
    prerequisite: null,
  },
  DENSE_FUEL_CELLS: {
    id: 'DENSE_FUEL_CELLS',
    maxLevel: RESEARCH_MAX_LEVEL.DENSE_FUEL_CELLS,
    costAt: flat({
      alloy: 0,
      crystal: scalePrice(1400, ECONOMY_TEMPO.fixedPrice),
      deuterium: scalePrice(150, ECONOMY_TEMPO.deuteriumPrice),
    }),
    availableAtMinutes: DEUTERIUM.frontierStartsAtMinutes,
    prerequisite: 'ISOTOPE_SPECTROMETRY',
  },
  GRAVITIC_CHARGES: {
    id: 'GRAVITIC_CHARGES',
    maxLevel: RESEARCH_MAX_LEVEL.GRAVITIC_CHARGES,
    costAt: flat({
      alloy: 0,
      crystal: scalePrice(1900, ECONOMY_TEMPO.fixedPrice),
      deuterium: scalePrice(350, ECONOMY_TEMPO.deuteriumPrice),
    }),
    availableAtMinutes: DEUTERIUM.frontierStartsAtMinutes,
    prerequisite: 'ISOTOPE_SPECTROMETRY',
  },
  DEATH_STAR_PROTOCOL: {
    id: 'DEATH_STAR_PROTOCOL',
    maxLevel: RESEARCH_MAX_LEVEL.DEATH_STAR_PROTOCOL,
    costAt: flat({
      alloy: scalePrice(11_000, ECONOMY_TEMPO.fixedPrice),
      crystal: scalePrice(3600, ECONOMY_TEMPO.fixedPrice),
      deuterium: scalePrice(900, ECONOMY_TEMPO.deuteriumPrice),
    }),
    availableAtMinutes: RESEARCH_PROJECTS_WAR_OPENS,
    prerequisite: 'GRAVITIC_CHARGES',
    /**
     * ONE FIGURE, READ FROM THE WEAPON IT AUTHORISES (D113). Permission and
     * capability moved together on the owner's instruction; typed twice they
     * would drift the first time only one of them was edited.
     */
    requiredCore: DEATH_STAR.requiredCore,
  },
  /**
   * THE FUEL CHAIN'S FIRST LINK, AND THE FIRST LADDER IN THE GAME. T5.
   *
   * OPEN FROM THE FIRST MINUTE, with no prerequisite, and that is not a softening.
   * The other four projects belong to the Frontier act and are DISCOVERED — by the
   * season clock, by a cargo-limited raid, by a shield that held. This one is the
   * only way to make deuterium at all, and from T6 every launch spends it: gate it
   * behind an act break and a commander who ran their tank dry in hour three has
   * nothing to do until hour thirty-five.
   *
   * LEVEL ONE COSTS NO DEUTERIUM, and that is a deadlock guard rather than a price.
   * The only source of deuterium is the plant and the only door to the plant is
   * this rung; charging deuterium for it would seal the door from the inside.
   *
   * IT CLIMBS STEEPLY ON PURPOSE. Each rung roughly triples, so rung one is an
   * opening decision a new commander can actually make and rung five is a season's
   * project. `DEUTERIUM.plantLevelsPerResearch` turns each rung into three plant
   * levels, and the plant is Core-bound on top of that — so the ceiling is always
   * the smaller of what you researched and how far you built.
   */
  DEUTERIUM_SYNTHESIS: {
    id: 'DEUTERIUM_SYNTHESIS',
    maxLevel: RESEARCH_MAX_LEVEL.DEUTERIUM_SYNTHESIS,
    costAt: (level: number) => {
      const rung = Math.max(1, Math.min(RESEARCH_TECH.economyMaxLevel, Math.floor(level)));
      /*
        2.6 PER RUNG, AND THE CEILING IS WHY IT IS NOT 3.

        At ×3 the top rung priced out at a build time of exactly `BUILD.capMinutes`
        — and at the cap, further cost stops being felt as time at all, which makes
        the last rung partly free in the one currency a queue actually charges.
        2.6 still more than doubles every rung and leaves the top one comfortably
        under the clamp.
      */
      const step = Math.pow(2.6, rung - 1);
      return {
        alloy: scalePrice(400 * step, ECONOMY_TEMPO.fixedPrice),
        crystal: scalePrice(700 * step, ECONOMY_TEMPO.fixedPrice),
        // Nothing on the first rung — see above. After it, a plant already exists.
        deuterium: rung === 1
          ? 0
          : scalePrice(120 * Math.pow(2.6, rung - 2), ECONOMY_TEMPO.deuteriumPrice),
      };
    },
    availableAtMinutes: 0,
    prerequisite: null,
  },

  /**
   * THE THREE ECONOMY LADDERS. T8.
   *
   * Each is a plain multiplier on one number a commander already reads, and each
   * effect lives in exactly one exported function in `tech.ts`. Open from the
   * first minute like the refinery: they are not Frontier content, they are the
   * things a player improves while they play.
   *
   * PRICED AS PAID ONCE. Research belongs to the commander since T7, so a ladder
   * bought at the capital is a ladder every colony has — these cost what a
   * three-world commander should feel, not what one world can shrug off.
   */
  YARD_AUTOMATION: economyLadder('YARD_AUTOMATION', 900, 500),
  PROSPECTOR_HOLDS: economyLadder('PROSPECTOR_HOLDS', 700, 900),
  /**
   * Dearest of the three, because it is the only one that moves ARR: `fleetCargo`
   * is what caps a raid's loot. A player buying raid income should feel it.
   */
  CARGO_HOLDS: economyLadder('CARGO_HOLDS', 1400, 1100),

  /**
   * THE FIVE WEAPON LADDERS. T9.
   *
   * Dearer than the economy ones and dearest at the top, because what they buy is
   * bounded by design: 25% of equal-budget power against the counter cycle's 156%.
   * A commander who pours a season into these is buying a quarter of what one
   * good scouting report buys, and that ordering is the game's central claim
   * rather than a tuning accident.
   */
  WASP_DOCTRINE: weaponLadder('WASP_DOCTRINE'),
  LANCE_DOCTRINE: weaponLadder('LANCE_DOCTRINE'),
  BULWARK_DOCTRINE: weaponLadder('BULWARK_DOCTRINE'),
  EMPLACEMENT_DOCTRINE: weaponLadder('EMPLACEMENT_DOCTRINE'),
  /**
   * Touches every hull, so it is priced above a single doctrine — but only by
   * 1.25x, because above that its top rung ran into the build-time clamp and stopped
   * being felt as time at all.
   */
  WEAPONS_GENERAL: weaponLadder('WEAPONS_GENERAL', 1.25),

  /**
   * THE TWO STRATEGIC PROJECTS, AND THEY ARE EACH OTHER'S ANSWER. T10 · T11.
   *
   * Both are permissions rather than ladders: you can stop a weapon or you cannot,
   * and you keep a second on the pad or you do not. Both sit in the war act with
   * the weapon itself, because a defence that arrived before the thing it defends
   * against would be a solution looking for its problem.
   */
  INTERCEPTION_GRID: {
    id: 'INTERCEPTION_GRID',
    maxLevel: RESEARCH_MAX_LEVEL.INTERCEPTION_GRID,
    costAt: flat({
      alloy: scalePrice(9000, ECONOMY_TEMPO.fixedPrice),
      crystal: scalePrice(5000, ECONOMY_TEMPO.fixedPrice),
      deuterium: scalePrice(700, ECONOMY_TEMPO.deuteriumPrice),
    }),
    availableAtMinutes: RESEARCH_PROJECTS_WAR_OPENS,
    /* Learning to break a shield is what teaches you to break a hull at range. */
    prerequisite: 'GRAVITIC_CHARGES',
  },
  /**
   * Behind the weapon it stockpiles: there is nothing to keep a second of until
   * you can build the first.
   */
  STRATEGIC_STOCKPILE: {
    id: 'STRATEGIC_STOCKPILE',
    maxLevel: RESEARCH_MAX_LEVEL.STRATEGIC_STOCKPILE,
    costAt: flat({
      alloy: scalePrice(14_000, ECONOMY_TEMPO.fixedPrice),
      crystal: scalePrice(6000, ECONOMY_TEMPO.fixedPrice),
      deuterium: scalePrice(1400, ECONOMY_TEMPO.deuteriumPrice),
    }),
    availableAtMinutes: RESEARCH_PROJECTS_WAR_OPENS,
    prerequisite: 'DEATH_STAR_PROTOCOL',
    requiredCore: DEATH_STAR.requiredCore,
  },
});

export const researchAvailable = (id: ResearchProjectId, nowMinutes: number): boolean =>
  nowMinutes >= RESEARCH_PROJECTS[id].availableAtMinutes;

/**
 * A separate integer hash, not another draw from the asteroid RNG. D93.
 *
 * Adding an isotope cannot move any existing rock's orbit, level, lifetime or
 * crystal share. The avalanche is deliberately made only from unsigned integer
 * operations so server, simulator and browser agree bit-for-bit.
 */
const isotopeHash = (seed: number, index: number): number => {
  let value = (seed ^ Math.imul(index + 1, 0x9e3779b1) ^ 0x6d2b79f5) >>> 0;
  value = Math.imul(value ^ (value >>> 16), 0x85ebca6b) >>> 0;
  value = Math.imul(value ^ (value >>> 13), 0xc2b2ae35) >>> 0;
  return (value ^ (value >>> 16)) >>> 0;
};

export interface IsotopeProfile {
  rich: boolean;
  deuteriumShare: number;
}

export function isotopeProfile(
  seed: number,
  asteroidIndex: number,
  appearsAtMinutes: number,
): IsotopeProfile {
  const eligible = appearsAtMinutes >= DEUTERIUM.frontierStartsAtMinutes;
  // The primary lane preserves the bounded one-in-nine field. One seed-shifted
  // bonus seam every ten lanes raises spawn supply without remapping the whole
  // galaxy or creating an unlucky drought. The index keeps this stateless.
  const lane = isotopeHash(seed, 0) % DEUTERIUM.isotopeCadence;
  const primary = asteroidIndex % DEUTERIUM.isotopeCadence === lane;
  const bonusCycle = isotopeHash(seed, 1) % DEUTERIUM.isotopeBonusCadence;
  const bonusSlot = (lane + Math.floor(DEUTERIUM.isotopeCadence / 2))
    % DEUTERIUM.isotopeCadence;
  const bonus = asteroidIndex % (
    DEUTERIUM.isotopeCadence * DEUTERIUM.isotopeBonusCadence
  ) === bonusCycle * DEUTERIUM.isotopeCadence + bonusSlot;
  const rich = eligible && (primary || bonus);
  const minPercent = Math.round(DEUTERIUM.isotopeShareMin * 100);
  const maxPercent = Math.round(DEUTERIUM.isotopeShareMax * 100);
  const concentration = minPercent
    + isotopeHash(seed ^ 0xa341316c, asteroidIndex) % (maxPercent - minPercent + 1);
  return { rich, deuteriumShare: rich ? concentration / 100 : 0 };
}
