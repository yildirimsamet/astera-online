import { describe, expect, it } from 'vitest';
import { HULLS, MULTI_WORLD, type HullId, type TechLevels } from '@astera/rules';
import { advanceStrategicLayer, buildWorld, freshStats, resolveMission, type Mission, type SimPlayer } from '../src/season.js';

/**
 * KALICI GEMİ HASARI IN THE SIMULATOR. `plan.md` F7.
 *
 * `fleet-calibration` measured the Repair Station's bill against a fight's permanent
 * loss: under 1% at the calibration budgets, but 54% at 2k and 17% at 10k — the
 * early game's small fleets, where one damaged ship is a large share of a wing. So
 * the simulator pays it rather than noting it away.
 *
 * It has no dock: a survivor over the line is repaired where it stands and its bill —
 * the damaged share of its price, less Industrial — leaves that commander's store at
 * once, never below zero. The dock's time is not modelled; the season sim ships with
 * the ruleset a new galaxy is created at, and until that ruleset deals the rule it
 * pays nothing.
 */

const store = (p: SimPlayer): number => p.alloy + p.crystal + p.deuterium;
const price = (hull: HullId): number => HULLS[hull].alloy + HULLS[hull].crystal + HULLS[hull].deuterium;

/** Two Darts on one Stronghold: every seed leaves a damaged survivor on both sides. */
function raid(rulesetVersion: number, defenderTech: TechLevels = {}, defenderStore = 50_000) {
  const world = buildWorld({ players: 4, days: 14, seed: 4242, rulesetVersion });
  const raider = world.players[0]!;
  const target = world.players[1]!;
  const t = target.lastTick;
  target.fleet = { STRONGHOLD: 1 };
  target.ground = {};
  target.shield = 0;
  target.tech = defenderTech;
  target.alloy = defenderStore;
  target.crystal = defenderStore;
  target.deuterium = defenderStore;
  target.bufferAlloy = 0;
  target.bufferCrystal = 0;
  target.bufferDeuterium = 0;
  raider.alloy = 50_000;
  raider.crystal = 50_000;
  raider.deuterium = 50_000;
  const mission: Mission = {
    from: raider.id, to: target.id, fleet: { DART: 2 }, arriveAt: t, distance: 100, scouted: true, returning: false,
  };
  const stats = freshStats();
  resolveMission(mission, t, world, stats);
  return { raider, target, stats };
}

describe('the simulator pays the Repair Station', () => {
  it('pays nothing in a ruleset that has no Repair Station', () => {
    expect(raid(13).stats.repairValue).toBe(0);
  });

  it('bills both sides of a raid for what came out over the line', () => {
    const before = raid(13);
    const after = raid(MULTI_WORLD.shipDamageRulesetVersion);
    const defenderBill = store(before.target) - store(after.target);
    const raiderBill = store(before.raider) - store(after.raider);
    // Positive, and never more than the one damaged ship a side keeps per hull.
    expect(defenderBill).toBeGreaterThan(0);
    expect(defenderBill).toBeLessThan(price('STRONGHOLD'));
    expect(raiderBill).toBeGreaterThan(0);
    expect(raiderBill).toBeLessThan(price('DART'));
    expect(after.stats.repairValue).toBe(defenderBill + raiderBill);
  });

  it('charges half with Industrial 2', () => {
    const base = raid(13);
    const full = store(base.target) - store(raid(MULTI_WORLD.shipDamageRulesetVersion).target);
    const halfBase = raid(13, { INDUSTRIAL: 2 });
    const half = store(halfBase.target) - store(raid(MULTI_WORLD.shipDamageRulesetVersion, { INDUSTRIAL: 2 }).target);
    expect(half).toBeGreaterThan(0);
    // Each of three resources rounds up on its own.
    expect(Math.abs(full - 2 * half)).toBeLessThanOrEqual(6);
  });

  it('never takes a store below zero', () => {
    const { target } = raid(MULTI_WORLD.shipDamageRulesetVersion, {}, 0);
    expect(target.alloy).toBeGreaterThanOrEqual(0);
    expect(target.crystal).toBeGreaterThanOrEqual(0);
    expect(target.deuterium).toBeGreaterThanOrEqual(0);
  });

  it('bills a raider for what a neutral caretaker left damaged', () => {
    const run = (rulesetVersion: number) => {
      const world = buildWorld({ players: 2, days: 1, seed: 5151, rulesetVersion });
      const attacker = world.players[0]!;
      attacker.alloy = 50_000;
      attacker.crystal = 50_000;
      attacker.deuterium = 50_000;
      const target = world.neutrals.find((neutral) => neutral.tier === 1)!;
      target.fleet = { STRONGHOLD: 1 };
      target.aegis = 0;
      target.shield = 0;
      target.lastTick = 0;
      target.nextReinforcement = null;
      world.neutrals = [target];
      world.strategicMissions = [{ id: 931, kind: 'neutral_attack', ownerId: attacker.id,
        targetId: target.id, arriveAt: 0, fleet: { DART: 2 }, returning: false }];
      advanceStrategicLayer(world, 0);
      return store(attacker);
    };
    const bill = run(13) - run(MULTI_WORLD.shipDamageRulesetVersion);
    expect(bill).toBeGreaterThan(0);
    expect(bill).toBeLessThan(price('DART'));
  });
});
