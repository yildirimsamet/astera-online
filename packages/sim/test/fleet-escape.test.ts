import { describe, expect, it } from 'vitest';
import { MULTI_WORLD, escapeFuel, fleetEscapeApplies, type Fleet } from '@astera/rules';
import { buildWorld, freshStats, resolveMission, type Mission } from '../src/season.js';

/**
 * TAKTİK GERİ ÇEKİLME IN THE SIMULATOR. Owner decision, 2026-09-23.
 *
 * The simulator models the season a new galaxy is created at, and that season is dealt
 * the fleet escape. A bot raid that still annihilated a line which would have lifted
 * off would be measuring a different game — the standing rule in
 * `docs/engineering-standards.md` and the reason this file exists. The rule itself is
 * `packages/rules/test/escape.test.ts`; this holds only that the simulator reads it.
 */

const LINE: Fleet = { DART: 20 };

function arranged(deuterium: number) {
  const world = buildWorld({ players: 4, days: 14, seed: 4242 });
  const raider = world.players[0]!;
  const target = world.players[1]!;
  // At the target's own last tick, so nothing produces between the setup and the fight.
  const t = target.lastTick;
  target.fleet = { ...LINE, PROSPECTOR: 2 };
  target.ground = {};
  target.shield = 0;
  target.deuterium = deuterium;
  target.bufferDeuterium = 0;
  const mission: Mission = {
    from: raider.id,
    to: target.id,
    fleet: { DART: 60, COURIER: 20 },
    arriveAt: t,
    distance: 100,
    scouted: true,
    returning: false,
  };
  return { world, target, mission, t };
}

describe('the simulator and the fleet escape', () => {
  it('simulates the ruleset a new season is created at, which is dealt the rule', () => {
    expect(fleetEscapeApplies(MULTI_WORLD.rulesetVersion)).toBe(true);
  });

  it('leaves the ships home when a three-to-one raid lands on a tank that can lift them', () => {
    const { world, target, mission, t } = arranged(1_000);
    const before = target.deuterium;
    resolveMission(mission, t, world, freshStats());
    expect(target.fleet).toEqual({ ...LINE, PROSPECTOR: 2 });
    expect(target.deuterium).toBeLessThanOrEqual(before - escapeFuel(LINE));
  });

  it('loses them when the tank cannot pay for the lift', () => {
    const { world, target, mission, t } = arranged(0);
    resolveMission(mission, t, world, freshStats());
    expect(target.fleet.DART ?? 0).toBe(0);
    expect(target.fleet.PROSPECTOR).toBe(2);
  });
});
