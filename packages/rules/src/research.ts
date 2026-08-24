import { DEUTERIUM, SEASON } from './constants.js';
import type { ResearchProjectId, Resources } from './types.js';

export interface ResearchProject {
  id: ResearchProjectId;
  cost: Resources;
  availableAtMinutes: number;
  prerequisite: ResearchProjectId | null;
  requiredCore?: number;
}

/** Three short seasonal projects; each door points back into public play. D93–D95. */
export const RESEARCH_PROJECTS: Record<ResearchProjectId, ResearchProject> = {
  ISOTOPE_SPECTROMETRY: {
    id: 'ISOTOPE_SPECTROMETRY',
    cost: { alloy: 0, crystal: 900, deuterium: 0 },
    availableAtMinutes: DEUTERIUM.frontierStartsAtMinutes,
    prerequisite: null,
  },
  DENSE_FUEL_CELLS: {
    id: 'DENSE_FUEL_CELLS',
    cost: { alloy: 0, crystal: 1400, deuterium: 150 },
    availableAtMinutes: DEUTERIUM.frontierStartsAtMinutes,
    prerequisite: 'ISOTOPE_SPECTROMETRY',
  },
  GRAVITIC_CHARGES: {
    id: 'GRAVITIC_CHARGES',
    cost: { alloy: 0, crystal: 1900, deuterium: 350 },
    availableAtMinutes: DEUTERIUM.frontierStartsAtMinutes,
    prerequisite: 'ISOTOPE_SPECTROMETRY',
  },
  DEATH_STAR_PROTOCOL: {
    id: 'DEATH_STAR_PROTOCOL',
    cost: { alloy: 11_000, crystal: 3600, deuterium: 900 },
    availableAtMinutes:
      SEASON.actBoundaries.find((boundary) => boundary.id === 'war')!.share
      * SEASON.days * 24 * 60,
    prerequisite: 'GRAVITIC_CHARGES',
    requiredCore: 6,
  },
};

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
  return { rich, deuteriumShare: rich ? DEUTERIUM.isotopeShare : 0 };
}
