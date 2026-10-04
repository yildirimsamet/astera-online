import { describe, expect, it } from 'vitest';
import { MONUMENT_SEASON_DEFAULTS, MULTI_WORLD } from '@astera/rules';
import { buildWorld } from '../src/season.js';

describe('monument season deal', () => {
  it('uses the approved monument deal for a ruleset-16 simulation', () => {
    const world = buildWorld({ players: 4, days: 1, seed: 20261004, rulesetVersion: 16 });

    expect(world.monuments).toHaveLength(MONUMENT_SEASON_DEFAULTS.count);
    expect(world.monuments.map((monument) => ({
      ordinal: monument.ordinal,
      x: monument.x,
      y: monument.y,
      z: monument.z,
    }))).toEqual(MONUMENT_SEASON_DEFAULTS.positions.map((position, index) => ({
      ordinal: index + 1,
      ...position,
    })));
    expect(world.monuments.every((monument) =>
      monument.capacity === MONUMENT_SEASON_DEFAULTS.capacity
      && monument.cloudRadius === MONUMENT_SEASON_DEFAULTS.cloudRadius
      && monument.intensityHpPerMinute === MONUMENT_SEASON_DEFAULTS.intensityHpPerMinute
      && monument.productionPerMinute === MONUMENT_SEASON_DEFAULTS.productionPerMinute
      && monument.garrison.LEVIATHAN === MONUMENT_SEASON_DEFAULTS.garrison.LEVIATHAN
      && JSON.stringify(monument.garrisonTech) === JSON.stringify(MONUMENT_SEASON_DEFAULTS.garrisonTech),
    )).toBe(true);
  });

  it('does not put monuments into pre-monument rulesets', () => {
    const world = buildWorld({
      players: 4,
      days: 1,
      seed: 20261004,
      rulesetVersion: MULTI_WORLD.monumentRulesetVersion - 1,
    });

    expect(world.monuments).toEqual([]);
  });
});
