import { describe, expect, it } from 'vitest';
import {
  RESEARCH_MAX_LEVEL,
  RESEARCH_PROJECTS,
  RESEARCH_PROJECT_IDS,
  repairPct,
  researchEffectAt,
  researchPrerequisiteMet,
  type ResearchProjectId,
} from '../src/index.js';

/**
 * INDUSTRIAL — THE REPAIR STATION'S RESEARCH. Owner decision K6, 2026-09-29 (`plan.md` F5).
 *
 * Two rungs, each a quarter off both the repair bill and the repair time, behind
 * Shipyard Automation 2. Priced like Yard Automation's own first two rungs: repair is a
 * light load while combat leaves at most one damaged ship per hull, and the price is
 * re-tuned when Monuments make it heavy.
 */

describe('Industrial', () => {
  it('is appended to the project list, never inserted', () => {
    expect(RESEARCH_PROJECT_IDS.at(-1)).toBe('INDUSTRIAL');
  });

  it('has two rungs, found by walking its own effect', () => {
    expect(RESEARCH_MAX_LEVEL.INDUSTRIAL).toBe(2);
    expect(RESEARCH_PROJECTS.INDUSTRIAL.maxLevel).toBe(2);
  });

  it('leaves 100, 75 and 50 percent of every repair', () => {
    expect(repairPct({})).toBe(100);
    expect(repairPct({ INDUSTRIAL: 1 })).toBe(75);
    expect(repairPct({ INDUSTRIAL: 2 })).toBe(50);
    expect(repairPct({ INDUSTRIAL: 9 })).toBe(50);
    expect(researchEffectAt('INDUSTRIAL', 0)).toBe(100);
    expect(researchEffectAt('INDUSTRIAL', 2)).toBe(50);
  });

  it('costs what Yard Automation\'s first two rungs cost', () => {
    expect(RESEARCH_PROJECTS.INDUSTRIAL.costAt(1)).toEqual(RESEARCH_PROJECTS.YARD_AUTOMATION.costAt(1));
    expect(RESEARCH_PROJECTS.INDUSTRIAL.costAt(2)).toEqual(RESEARCH_PROJECTS.YARD_AUTOMATION.costAt(2));
  });

  it('opens from the first minute behind Shipyard Automation 2', () => {
    expect(RESEARCH_PROJECTS.INDUSTRIAL).toMatchObject({
      availableAtMinutes: 0,
      prerequisite: 'YARD_AUTOMATION',
      prerequisiteLevel: 2,
    });
  });
});

describe('researchPrerequisiteMet — the one reading of a prerequisite', () => {
  const levels = (entries: Partial<Record<ResearchProjectId, number>>) =>
    (id: ResearchProjectId): number => entries[id] ?? 0;

  it('asks for the declared rung', () => {
    const industrial = RESEARCH_PROJECTS.INDUSTRIAL;
    expect(researchPrerequisiteMet(industrial, levels({}))).toBe(false);
    expect(researchPrerequisiteMet(industrial, levels({ YARD_AUTOMATION: 1 }))).toBe(false);
    expect(researchPrerequisiteMet(industrial, levels({ YARD_AUTOMATION: 2 }))).toBe(true);
    expect(researchPrerequisiteMet(industrial, levels({ YARD_AUTOMATION: 5 }))).toBe(true);
  });

  it('keeps every older project on "any rung at all"', () => {
    const power = RESEARCH_PROJECTS.SHIP_POWER;
    expect(researchPrerequisiteMet(power, levels({}))).toBe(false);
    expect(researchPrerequisiteMet(power, levels({ STARSHIP_ENGINEERING: 1 }))).toBe(true);
    expect(researchPrerequisiteMet(RESEARCH_PROJECTS.YARD_AUTOMATION, levels({}))).toBe(true);
  });
});
