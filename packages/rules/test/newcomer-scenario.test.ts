import { describe, expect, it } from 'vitest';
import {
  NEWCOMER_SCENARIO,
  NEWCOMER_SCENARIO_STEPS,
  canAdvanceScenario,
  distance,
  isScenarioActive,
  personalPirateSpec,
  personalRockSpecs,
  pirateActive,
  piratePosition,
} from '../src/index.js';

describe('newcomer scenario rules', () => {
  const capital = { x: 4000, y: 0, z: -2000 };

  it('walks the authentic player-driven steps in strict order', () => {
    expect(NEWCOMER_SCENARIO_STEPS).toEqual([
      'LANDING',
      'MINE',
      'PIRATE',
      'PROBE',
      'WRAP_UP',
      'DONE',
    ]);
    for (let i = 0; i < NEWCOMER_SCENARIO_STEPS.length - 1; i++) {
      expect(canAdvanceScenario(NEWCOMER_SCENARIO_STEPS[i]!, NEWCOMER_SCENARIO_STEPS[i + 1]!)).toBe(true);
    }
    expect(canAdvanceScenario('LANDING', 'PIRATE')).toBe(false);
    expect(canAdvanceScenario('MINE', 'PROBE')).toBe(false);
    expect(canAdvanceScenario('DONE', 'MINE')).toBe(false);
    expect(canAdvanceScenario('DISMISSED', 'MINE')).toBe(false);
  });

  it('treats DONE and DISMISSED as inactive and all earlier steps as active', () => {
    expect(isScenarioActive('LANDING')).toBe(true);
    expect(isScenarioActive('MINE')).toBe(true);
    expect(isScenarioActive('PIRATE')).toBe(true);
    expect(isScenarioActive('PROBE')).toBe(true);
    expect(isScenarioActive('WRAP_UP')).toBe(true);
    expect(isScenarioActive('DONE')).toBe(false);
    expect(isScenarioActive('DISMISSED')).toBe(false);
  });

  it('spawns a real personal pirate on a slow closed orbit beside the capital, clear of personal rocks', () => {
    const spawnedAt = 120;
    const spec = personalPirateSpec(capital, spawnedAt);
    const fullSpec = { ...spec, index: -1 };
    const atSpawn = piratePosition(fullSpec, spawnedAt);

    expect(distance(capital, atSpawn)).toBeCloseTo(NEWCOMER_SCENARIO.pirateDistance, 2);
    expect(atSpawn.y).toBeCloseTo(capital.y, 4);
    expect(spec.level).toBe(1);
    expect(spec.roster).toEqual({ DART: 2 });
    expect(spec.hoard).toEqual({ alloy: 300, crystal: 150, deuterium: 0 });
    expect(spec.speed).toBe(NEWCOMER_SCENARIO.pirateSpeed);
    expect(spec.appearsAt).toBe(spawnedAt);
    expect(spec.expiresAt).toBe(spawnedAt + NEWCOMER_SCENARIO.pirateLifeMinutes);
    expect(pirateActive(fullSpec, spawnedAt)).toBe(true);
    expect(pirateActive(fullSpec, spawnedAt + NEWCOMER_SCENARIO.pirateLifeMinutes)).toBe(false);

    const rocks = personalRockSpecs(capital, spawnedAt, 77);
    for (const rock of rocks) {
      const rockAt = piratePosition({ ...rock, index: -2, level: 1, roster: {}, hoard: { alloy: 0, crystal: 0, deuterium: 0 } }, spawnedAt);
      expect(distance(atSpawn, rockAt)).toBeGreaterThan(200);
    }
  });
});
