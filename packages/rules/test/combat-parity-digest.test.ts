import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  ALL_HULLS,
  MOBILE_HULLS,
  mulberry32,
  resolveCombat,
  resolveJointCombat,
  type CombatResult,
  type Fleet,
  type HullId,
  type JointAttackerStack,
  type JointCombatResult,
  type TechLevels,
} from '../src/index.js';

/**
 * THE BATTLE ARITHMETIC, PINNED BIT FOR BIT. Kalıcı gemi hasarı, `plan.md` F1.
 *
 * Persistent damage added outputs to the resolver and a pre-damage path for attackers.
 * The owner's decision (K1) is that nothing a battle already decided may move: kills,
 * rolls, grades, loot inputs and Dominion credit stay exactly as they were. This digest
 * was captured from the resolver BEFORE that change, over a few hundred seeded battles —
 * solo and joint, every hull, research on both sides, shields and ground guns — and
 * every field that existed then is hashed. A single differing bit changes it.
 *
 * If this fails, the combat arithmetic changed. Do not re-capture the digest to make it
 * pass: find the change.
 */

const DIGEST = 'f5beee616802f7a476b17739e3e9bdb630aa388605ab0da67c20f43c80511ae3';

const random = mulberry32(20_260_930);
const int = (lo: number, hi: number): number => lo + Math.floor(random() * (hi - lo + 1));
const pick = <T>(items: readonly T[]): T => items[Math.floor(random() * items.length)] as T;

function fleetFrom(pool: readonly HullId[], types: number, max: number): Fleet {
  const out: Fleet = {};
  for (let i = 0; i < types; i++) {
    const hull = pick(pool);
    out[hull] = (out[hull] ?? 0) + int(1, max);
  }
  return out;
}

const techFor = (): TechLevels => ({
  SHIP_POWER: int(0, 5),
  SHIP_ARMOR: int(0, 5),
  EMPLACEMENT_DOCTRINE: int(0, 5),
});

/** Only the fields that existed before persistent damage. */
const legacy = (result: CombatResult) => ({
  grade: result.grade,
  lossRatio: result.lossRatio,
  rounds: result.rounds,
  shieldLeft: result.shieldLeft,
  attackerSurvivors: result.attackerSurvivors,
  defenderSurvivors: result.defenderSurvivors,
  attackerLosses: result.attackerLosses,
  defenderLosses: result.defenderLosses,
  attackerLossValue: result.attackerLossValue,
  defenderLossValue: result.defenderLossValue,
  defenceSalvage: result.defenceSalvage,
});

const legacyJoint = (result: JointCombatResult) => ({
  ...legacy(result),
  contributions: result.contributions.map((row) => ({
    contributionId: row.contributionId,
    playerId: row.playerId,
    sent: row.sent,
    survivors: row.survivors,
    losses: row.losses,
    lossValue: row.lossValue,
    hullDamage: row.hullDamage,
  })),
});

function battles(): unknown[] {
  const out: unknown[] = [];
  for (let i = 0; i < 260; i++) {
    const attacker = fleetFrom(MOBILE_HULLS, int(1, 4), int(1, 300));
    const defender = random() < 0.15 ? {} : fleetFrom(ALL_HULLS, int(1, 4), int(1, 300));
    const shield = random() < 0.5 ? 0 : int(0, 60_000);
    const result = resolveCombat(attacker, defender, shield, mulberry32(int(1, 1_000_000)), {
      attacker: { tech: techFor() },
      defender: { tech: techFor(), ...(random() < 0.2 ? { damageMult: 0.6 } : {}) },
    });
    out.push(legacy(result));
  }
  for (let i = 0; i < 90; i++) {
    const stacks: JointAttackerStack[] = [];
    // A shared hull across waves forms one casualty cohort; that path must be pinned too.
    const shared = pick(MOBILE_HULLS);
    for (let s = 0, n = int(2, 3); s < n; s++) {
      const fleet = fleetFrom(MOBILE_HULLS, int(1, 3), int(1, 200));
      fleet[shared] = (fleet[shared] ?? 0) + int(1, 50);
      stacks.push({
        contributionId: `c${String(s)}`,
        playerId: `p${String(s % 2)}`,
        fleet,
        tech: { tech: random() < 0.5 ? {} : techFor() },
      });
    }
    const defender = fleetFrom(ALL_HULLS, int(1, 4), int(1, 400));
    const shield = random() < 0.5 ? 0 : int(0, 80_000);
    out.push(legacyJoint(resolveJointCombat(stacks, defender, shield, mulberry32(int(1, 1_000_000)), {
      tech: techFor(),
    })));
  }
  return out;
}

describe('combat parity across persistent damage', () => {
  it('resolves every seeded battle exactly as the resolver did before the change', () => {
    const digest = createHash('sha256').update(JSON.stringify(battles())).digest('hex');
    expect(digest).toBe(DIGEST);
  });
});
