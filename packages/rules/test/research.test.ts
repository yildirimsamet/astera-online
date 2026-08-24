import { describe, expect, it } from 'vitest';
import {
  DEUTERIUM,
  RESEARCH_PROJECTS,
  claimOre,
  isotopeProfile,
  researchAvailable,
} from '../src/index.js';

describe('the two-project frontier', () => {
  it('ships the Economy v2 research prices as one table', () => {
    expect(RESEARCH_PROJECTS.ISOTOPE_SPECTROMETRY.cost)
      .toEqual({ alloy: 0, crystal: 900, deuterium: 0 });
    expect(RESEARCH_PROJECTS.DENSE_FUEL_CELLS.cost)
      .toEqual({ alloy: 0, crystal: 1400, deuterium: 150 });
    expect(RESEARCH_PROJECTS.GRAVITIC_CHARGES.cost)
      .toEqual({ alloy: 0, crystal: 1900, deuterium: 350 });
    expect(RESEARCH_PROJECTS.DEATH_STAR_PROTOCOL.cost)
      .toEqual({ alloy: 11_000, crystal: 3600, deuterium: 900 });
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

  it('replaces the calibrated share of ordinary ore with Deuterium instead of creating value', () => {
    const claim = claimOre(10_000, 2_000, 0.25, DEUTERIUM.isotopeShare);
    expect(claim.deuterium).toBe(Math.round(2_000 * DEUTERIUM.isotopeShare));
    expect(claim.alloy + claim.crystal + claim.deuterium).toBe(claim.taken);
  });
});
