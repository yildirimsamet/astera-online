import { describe, expect, it } from 'vitest';
import {
  DEUTERIUM,
  ECONOMY_TEMPO,
  RESEARCH_PROJECTS,
  RESEARCH_PROJECT_IDS,
  claimOre,
  isotopeProfile,
  researchAvailable,
  researchCostMix,
  scalePrice,
  type ResearchProjectId,
} from '../src/index.js';

const researchPrice = (base: { alloy: number; crystal: number; deuterium: number }) => ({
  alloy: scalePrice(base.alloy, ECONOMY_TEMPO.fixedPrice),
  crystal: scalePrice(base.crystal, ECONOMY_TEMPO.fixedPrice),
  deuterium: scalePrice(base.deuterium, ECONOMY_TEMPO.deuteriumPrice),
});
const mixedResearchPrice = (
  id: ResearchProjectId,
  base: { alloy: number; crystal: number; deuterium: number },
) => researchCostMix(id, researchPrice(base));

describe('research resource mix', () => {
  const unchanged = new Set([
    'YARD_AUTOMATION',
    'PROSPECTOR_HOLDS',
    'CARGO_HOLDS',
  ]);

  it('moves every level of every non-exempt project toward Crystal', () => {
    for (const id of RESEARCH_PROJECT_IDS) {
      for (let level = 1; level <= RESEARCH_PROJECTS[id].maxLevel; level += 1) {
        const base = { alloy: 401 + level, crystal: 203 + level, deuterium: 17 + level };
        const mixed = researchCostMix(id, base);

        if (unchanged.has(id)) {
          expect(mixed, `${id} L${String(level)}`).toEqual(base);
          continue;
        }

        expect(mixed, `${id} L${String(level)}`).toEqual({
          alloy: Math.round(base.alloy * 0.75),
          crystal: Math.round(base.crystal * 1.25),
          deuterium: base.deuterium,
        });
      }
    }
  });
});

describe('the two-project frontier', () => {
  it('ships the Crystal-weighted frontier research prices as one table', () => {
    expect(RESEARCH_PROJECTS.ISOTOPE_SPECTROMETRY.costAt(1))
      .toEqual(mixedResearchPrice('ISOTOPE_SPECTROMETRY', {
        alloy: 0, crystal: 900, deuterium: 0,
      }));
    expect(RESEARCH_PROJECTS.DENSE_FUEL_CELLS.costAt(1))
      .toEqual(mixedResearchPrice('DENSE_FUEL_CELLS', {
        alloy: 0, crystal: 1400, deuterium: 150,
      }));
    expect(RESEARCH_PROJECTS.GRAVITIC_CHARGES.costAt(1))
      .toEqual(mixedResearchPrice('GRAVITIC_CHARGES', {
        alloy: 0, crystal: 1900, deuterium: 350,
      }));
    expect(RESEARCH_PROJECTS.DEATH_STAR_PROTOCOL.costAt(1))
      .toEqual(mixedResearchPrice('DEATH_STAR_PROTOCOL', {
        alloy: 11_000, crystal: 3600, deuterium: 900,
      }));
  });

  it('opens spectroscopy on the shared season clock, never on a private timer', () => {
    const opens = RESEARCH_PROJECTS.ISOTOPE_SPECTROMETRY.availableAtMinutes;
    expect(researchAvailable('ISOTOPE_SPECTROMETRY', opens - 0.001)).toBe(false);
    expect(researchAvailable('ISOTOPE_SPECTROMETRY', opens)).toBe(true);
  });

  it('never marks a pre-frontier asteroid as isotope rich', () => {
    for (let index = 0; index < 10_000; index++) {
      expect(
        isotopeProfile(4242, index, DEUTERIUM.frontierStartsAtMinutes - 0.001).rich,
      ).toBe(false);
    }
  });

  it('is deterministic, seed-shifted and has the configured bounded cadence', () => {
    const sample = Array.from({ length: 100_000 }, (_, index) =>
      isotopeProfile(4242, index, DEUTERIUM.frontierStartsAtMinutes + index));
    expect(sample).toEqual(
      Array.from({ length: 100_000 }, (_, index) =>
        isotopeProfile(4242, index, DEUTERIUM.frontierStartsAtMinutes + index)),
    );
    const rich = sample.filter((profile) => profile.rich).length / sample.length;
    expect(rich).toBeGreaterThan(DEUTERIUM.isotopeRate - 0.01);
    expect(rich).toBeLessThan(DEUTERIUM.isotopeRate + 0.01);

    const richIndexes = sample.flatMap((profile, index) => profile.rich ? [index] : []);
    expect(Math.max(...richIndexes.slice(1).map((index, i) => index - richIndexes[i]!)))
      .toBeLessThanOrEqual(DEUTERIUM.isotopeCadence);
    const seedLanes = new Set(Array.from({ length: 32 }, (_, seedOffset) =>
      Array.from({ length: DEUTERIUM.isotopeCadence }, (_, index) =>
        isotopeProfile(4242 + seedOffset, index, DEUTERIUM.frontierStartsAtMinutes).rich)
        .findIndex(Boolean)));
    expect(seedLanes.size).toBeGreaterThan(1);
  });

  it('rolls each rich rock deterministically across the inclusive 10–25% range', () => {
    const shares: number[] = [];
    for (let seed = 1; seed <= 50; seed += 1) {
      for (let index = 0; index < 200; index += 1) {
        const profile = isotopeProfile(seed, index, DEUTERIUM.frontierStartsAtMinutes);
        if (!profile.rich) continue;
        expect(profile.deuteriumShare).toBeGreaterThanOrEqual(DEUTERIUM.isotopeShareMin);
        expect(profile.deuteriumShare).toBeLessThanOrEqual(DEUTERIUM.isotopeShareMax);
        expect(profile.deuteriumShare * 100)
          .toBeCloseTo(Math.round(profile.deuteriumShare * 100), 10);
        shares.push(profile.deuteriumShare);
      }
    }
    expect(new Set(shares).size).toBe(16);
    expect(shares.reduce((sum, share) => sum + share, 0) / shares.length)
      .toBeGreaterThanOrEqual(0.16);
    expect(shares.reduce((sum, share) => sum + share, 0) / shares.length)
      .toBeLessThanOrEqual(0.19);
  });

  it('replaces the rolled share of ordinary ore with Deuterium instead of creating value', () => {
    const share = isotopeProfile(4242, 7, DEUTERIUM.frontierStartsAtMinutes).deuteriumShare || 0.25;
    const claim = claimOre(10_000, 2_000, 0.25, share);
    expect(claim.deuterium).toBe(Math.round(2_000 * share));
    expect(claim.crystal).toBe(500);
    expect(claim.alloy + claim.crystal + claim.deuterium).toBe(claim.taken);
  });

  it('keeps Alloy non-negative at the richest legal Crystal and isotope shares', () => {
    expect(claimOre(10_000, 2_000, 0.65, 0.25)).toMatchObject({
      alloy: 200,
      crystal: 1300,
      deuterium: 500,
      taken: 2000,
    });
  });

  it('never creates ore even if a malformed caller supplies overlapping shares', () => {
    const claim = claimOre(1000, 400, 0.9, 0.9);
    expect(claim).toMatchObject({ alloy: 0, crystal: 360, deuterium: 40, taken: 400 });
    expect(claim.alloy + claim.crystal + claim.deuterium).toBe(claim.taken);
  });
});

/**
 * A LADDER THE EXISTING PROJECTS DO NOT CLIMB. T7.
 *
 * The four seasonal projects are PERMISSIONS: you have Dense Fuel Cells or you do
 * not, and a second purchase would mean nothing. What is coming after this are
 * MULTIPLIERS — refinery ceilings, doctrines, capacities — and those have levels.
 *
 * The model carries levels now so that adding one is a table entry rather than a
 * migration, and `maxLevel: 1` is what keeps every existing project behaving
 * exactly as it did. These tests are the proof that nothing moved: this task is a
 * refactor and a schema move, and a single changed figure in it would be a balance
 * change nobody asked for.
 */
describe('the levelled research model', () => {
  it('gives every project a real ceiling', () => {
    for (const id of RESEARCH_PROJECT_IDS) {
      expect(RESEARCH_PROJECTS[id].maxLevel).toBeGreaterThanOrEqual(1);
    }
  });

  /**
   * The FRONTIER four, named rather than swept up by iteration. They are
   * permissions and must stay permissions: a second purchase of Dense Fuel Cells
   * would buy nothing, and giving one a ladder is a design change, not a tuning.
   * `DEUTERIUM_SYNTHESIS` is deliberately not in this list — it is the ladder.
   */
  it('leaves the four seasonal projects as one-off permissions', () => {
    for (const id of [
      'ISOTOPE_SPECTROMETRY', 'DENSE_FUEL_CELLS', 'GRAVITIC_CHARGES', 'DEATH_STAR_PROTOCOL',
    ] as const) {
      expect(RESEARCH_PROJECTS[id].maxLevel, id).toBe(1);
    }
  });

  it('applies the Crystal-weighted mix to first-level permissions', () => {
    expect(RESEARCH_PROJECTS.ISOTOPE_SPECTROMETRY.costAt(1))
      .toEqual(mixedResearchPrice('ISOTOPE_SPECTROMETRY', {
        alloy: 0, crystal: 900, deuterium: 0,
      }));
    expect(RESEARCH_PROJECTS.DEATH_STAR_PROTOCOL.costAt(1))
      .toEqual(mixedResearchPrice('DEATH_STAR_PROTOCOL', {
        alloy: 11_000, crystal: 3600, deuterium: 900,
      }));
  });

  /** A price is asked for by TARGET level, so level one is what an unowned project costs. */
  it('quotes a flat project the same figure at every level it has', () => {
    for (const id of RESEARCH_PROJECT_IDS) {
      const project = RESEARCH_PROJECTS[id];
      if (project.maxLevel > 1) continue;
      expect(project.costAt(project.maxLevel), id).toEqual(project.costAt(1));
    }
  });

  /** A ladder charges more for every rung, or it is not a ladder. */
  it('makes a levelled project dearer at every rung', () => {
    for (const id of RESEARCH_PROJECT_IDS) {
      const project = RESEARCH_PROJECTS[id];
      if (project.maxLevel === 1) continue;
      for (let level = 2; level <= project.maxLevel; level++) {
        const now = project.costAt(level);
        const before = project.costAt(level - 1);
        expect(now.alloy + now.crystal, `${id} L${String(level)}`)
          .toBeGreaterThan(before.alloy + before.crystal);
      }
    }
  });

  it('never quotes a negative or fractional price', () => {
    for (const id of RESEARCH_PROJECT_IDS) {
      for (const key of ['alloy', 'crystal', 'deuterium'] as const) {
        const amount = RESEARCH_PROJECTS[id].costAt(1)[key];
        expect(Number.isInteger(amount)).toBe(true);
        expect(amount).toBeGreaterThanOrEqual(0);
      }
    }
  });
});
