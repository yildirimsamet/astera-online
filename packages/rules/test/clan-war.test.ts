import { describe, expect, it } from 'vitest';
import {
  COMBAT,
  HANGAR,
  HULLS,
  MULTI_WORLD,
  adjustJointDominion,
  allocateJointDominion,
  allocateJointDefenderLoss,
  allocateJointLoot,
  allocateJointSalvage,
  buildingCost,
  clanHangarCapacity,
  clanLevelUpgradeCost,
  counterMult,
  fleetCargo,
  fleetValue,
  hangarCapacity,
  jointWarFuel,
  jointWarFuelLegs,
  missionFuel,
  missionFuelForDistances,
  mulberry32,
  resolveCombat,
  resolveJointCombat,
  type Fleet,
  type JointAttackerStack,
  type JointCargoShare,
  type Resources,
} from '../src/index.js';

const NO_TECH = { tech: {} };
const flat = () => () => 0.5;
const seeded = () => mulberry32(24680);

const resources = (alloy: number, crystal: number, deuterium: number): Resources =>
  ({ alloy, crystal, deuterium });

const totalOf = (list: readonly { resources: Resources }[]): Resources => list.reduce(
  (sum, row) => ({
    alloy: sum.alloy + row.resources.alloy,
    crystal: sum.crystal + row.resources.crystal,
    deuterium: sum.deuterium + row.resources.deuterium,
  }),
  resources(0, 0, 0),
);

const unitsOf = (r: Resources): number => r.alloy + r.crystal + r.deuterium;

/* ── clan level, Klan Hangarı and its price ─────────────────────── */

describe('the clan hangar ladder', () => {
  /**
   * The owner's decision in one line: capacity is exactly TWICE the personal
   * Hangar's at the same rung, and the price is the personal rung's own price —
   * doubled room does not mean a doubled invoice.
   */
  it('stands exactly twice the personal Hangar at every rung', () => {
    const authored = [160, 360, 940, 1620, 3100, 4580, 6500, 8800, 11480, 14540];
    for (let level = 1; level <= 10; level++) {
      expect(clanHangarCapacity(level)).toBe(2 * hangarCapacity(level));
      expect(clanHangarCapacity(level)).toBe(authored[level - 1]);
    }
    expect(HANGAR.maxLevel).toBe(10);
  });

  it('refuses a level outside the authored ladder rather than clamping it', () => {
    for (const bad of [0, -1, 11, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => clanHangarCapacity(bad)).toThrow(RangeError);
    }
  });

  /**
   * TWICE THE ROOM, TWICE THE INVOICE. Owner decision, 2026-09-22, reversing "never doubled".
   *
   * The old rule bought double room at the personal price, which made every cut to the personal
   * ladder a free cut to the clan's price per unit of room. Plan 2B.3 cut the late personal rungs
   * by 35–75%; unchanged, this would have handed clans that cut twice over. Doubling keeps the
   * coupling and closes the multiplier — see `hangar-price.test.ts` for the per-unit equality.
   */
  it('prices a rung at twice the personal Hangar rung it mirrors', () => {
    for (let level = 1; level <= 9; level++) {
      const personal = buildingCost('HANGAR', level);
      expect(clanLevelUpgradeCost(level)).toEqual({
        alloy: personal.alloy * 2,
        crystal: personal.crystal * 2,
        deuterium: personal.deuterium * 2,
      });
    }
  });

  it('has no next cost at the top rung, which is what closes donation', () => {
    expect(() => clanLevelUpgradeCost(10)).toThrow(RangeError);
    expect(() => clanLevelUpgradeCost(0)).toThrow(RangeError);
  });

  it('opens the joint war only at its own ruleset boundary', () => {
    expect(MULTI_WORLD.clanJointWarRulesetVersion).toBe(10);
    expect(MULTI_WORLD.rulesetVersion).toBeGreaterThanOrEqual(
      MULTI_WORLD.clanJointWarRulesetVersion,
    );
    // Clan state itself is older; the joint war is a strictly later boundary.
    expect(MULTI_WORLD.clanJointWarRulesetVersion)
      .toBeGreaterThan(MULTI_WORLD.clanRulesetVersion);
  });
});

/* ── fuel: three legs for a member, two for the leader's capital ── */

describe('joint war fuel', () => {
  const wing: Fleet = { VIPER: 12, WAYFARER: 3 };

  it('charges each leg on its own distance and rounds each one up', () => {
    const quote = jointWarFuelLegs(wing, [
      { leg: 'ORIGIN_TO_STAGING', distance: 17 },
      { leg: 'STAGING_TO_TARGET', distance: 41 },
      { leg: 'TARGET_TO_ORIGIN', distance: 23 },
    ]);
    expect(quote.legs.map((l) => l.fuel)).toEqual([
      missionFuel(wing, 17, 1),
      missionFuel(wing, 41, 1),
      missionFuel(wing, 23, 1),
    ]);
    expect(quote.total).toBe(missionFuelForDistances(wing, [17, 41, 23]));
    expect(quote.legs.reduce((sum, l) => sum + l.fuel, 0)).toBe(quote.total);
  });

  it('is the existing mission formula and never a second one', () => {
    expect(jointWarFuel(wing, [17, 41, 23])).toBe(missionFuelForDistances(wing, [17, 41, 23]));
    expect(jointWarFuel(wing, [9, 9])).toBe(missionFuel(wing, 9, 2));
  });

  it('charges the leader capital only the two combat legs', () => {
    const quote = jointWarFuelLegs(wing, [
      { leg: 'STAGING_TO_TARGET', distance: 41 },
      { leg: 'TARGET_TO_STAGING', distance: 41 },
    ]);
    expect(quote.total).toBe(missionFuel(wing, 41, 2));
    expect(quote.legs).toHaveLength(2);
  });

  it('asymmetric legs cost more than doubling the shorter one', () => {
    expect(jointWarFuel(wing, [10, 90])).toBeGreaterThan(jointWarFuel(wing, [10, 10]));
    expect(jointWarFuel({}, [10, 90])).toBe(0);
  });

  it('refuses a negative or non-finite leg', () => {
    expect(() => jointWarFuel(wing, [-1])).toThrow(RangeError);
    expect(() => jointWarFuel(wing, [Number.NaN])).toThrow(RangeError);
  });
});

/* ── loot: max-min fairness across owners, waves inside an owner ── */

describe('joint loot allocation', () => {
  const share = (
    playerId: string,
    contributionId: string,
    cargo: number,
  ): JointCargoShare => ({ playerId, contributionId, cargo });

  it('splits equally between two owners who can both carry their half', () => {
    const out = allocateJointLoot(resources(300, 150, 60), [
      share('p1', 'c1', 5_000),
      share('p2', 'c2', 5_000),
    ]);
    expect(out).toHaveLength(2);
    expect(unitsOf(out[0]!.resources)).toBe(255);
    expect(unitsOf(out[1]!.resources)).toBe(255);
    // Composition is preserved: each bundle mirrors the 300:150:60 pile.
    expect(out[0]!.resources).toEqual(resources(150, 75, 30));
    expect(out[1]!.resources).toEqual(resources(150, 75, 30));
  });

  it('fills the small hold and hands the rest to whoever still has room', () => {
    const out = allocateJointLoot(resources(900, 0, 0), [
      share('small', 'c1', 100),
      share('big', 'c2', 5_000),
    ]);
    const bySmall = out.find((row) => row.playerId === 'small')!;
    const byBig = out.find((row) => row.playerId === 'big')!;
    expect(unitsOf(bySmall.resources)).toBe(100);
    expect(unitsOf(byBig.resources)).toBe(800);
    expect(totalOf(out)).toEqual(resources(900, 0, 0));
  });

  it('never gives an owner more than their own surviving hold', () => {
    const shares = [
      share('a', 'c1', 40),
      share('b', 'c2', 41),
      share('c', 'c3', 4_000),
    ];
    const out = allocateJointLoot(resources(777, 333, 111), shares);
    const byPlayer = new Map<string, number>();
    for (const row of out) {
      byPlayer.set(row.playerId, (byPlayer.get(row.playerId) ?? 0) + unitsOf(row.resources));
    }
    expect(byPlayer.get('a')).toBeLessThanOrEqual(40);
    expect(byPlayer.get('b')).toBeLessThanOrEqual(41);
    expect(byPlayer.get('c')).toBeLessThanOrEqual(4_000);
    expect(totalOf(out)).toEqual(resources(777, 333, 111));
  });

  it('splits one owner share across their own waves by hold, and conserves', () => {
    const out = allocateJointLoot(resources(300, 150, 100), [
      share('solo', 'wave-a', 300),
      share('solo', 'wave-b', 900),
    ]);
    const a = out.find((row) => row.contributionId === 'wave-a')!;
    const b = out.find((row) => row.contributionId === 'wave-b')!;
    expect(unitsOf(a.resources)).toBeLessThanOrEqual(300);
    expect(unitsOf(b.resources)).toBeLessThanOrEqual(900);
    expect(unitsOf(a.resources) + unitsOf(b.resources)).toBe(550);
    // A deeper hold carries the larger part of the same haul.
    expect(unitsOf(b.resources)).toBeGreaterThan(unitsOf(a.resources));
    expect(totalOf(out)).toEqual(resources(300, 150, 100));
  });

  it('mints and burns nothing on an awkward remainder', () => {
    const out = allocateJointLoot(resources(101, 7, 3), [
      share('p1', 'c1', 1_000),
      share('p2', 'c2', 1_000),
      share('p3', 'c3', 1_000),
    ]);
    expect(totalOf(out)).toEqual(resources(101, 7, 3));
    expect(out.every((row) => unitsOf(row.resources) >= 0)).toBe(true);
  });

  it('is deterministic whatever order the waves arrive in', () => {
    const shares = [
      share('zeta', 'c9', 700),
      share('alpha', 'c1', 120),
      share('alpha', 'c4', 380),
      share('mid', 'c5', 900),
    ];
    const first = allocateJointLoot(resources(613, 211, 97), shares);
    const second = allocateJointLoot(resources(613, 211, 97), [...shares].reverse());
    const key = (row: { contributionId: string }) => row.contributionId;
    expect([...first].sort((x, y) => key(x).localeCompare(key(y))))
      .toEqual([...second].sort((x, y) => key(x).localeCompare(key(y))));
  });

  it('gives nothing to an owner with no surviving hold', () => {
    const out = allocateJointLoot(resources(500, 0, 0), [
      share('carrier', 'c1', 5_000),
      share('escort', 'c2', 0),
    ]);
    expect(out.some((row) => row.playerId === 'escort')).toBe(false);
    expect(totalOf(out)).toEqual(resources(500, 0, 0));
  });

  it('allocates nothing at all when nobody survived with a hold', () => {
    expect(allocateJointLoot(resources(500, 10, 1), [])).toEqual([]);
    expect(allocateJointLoot(resources(0, 0, 0), [share('p1', 'c1', 900)])).toEqual([]);
  });

  it('refuses a haul larger than the holds that were quoted for it', () => {
    expect(() => allocateJointLoot(resources(500, 0, 0), [share('p1', 'c1', 100)]))
      .toThrow(RangeError);
  });

  it('honours the real cargo figures a mixed wing would report', () => {
    const wingA: Fleet = { WAYFARER: 2 };
    const wingB: Fleet = { COURIER: 1 };
    const capA = fleetCargo(wingA, {});
    const capB = fleetCargo(wingB, {});
    const out = allocateJointLoot(resources(capA + capB, 0, 0), [
      share('a', 'ca', capA),
      share('b', 'cb', capB),
    ]);
    expect(totalOf(out).alloy).toBe(capA + capB);
    expect(out.find((r) => r.playerId === 'b')!.resources.alloy).toBe(capB);
  });
});

/**
 * THE TWO INVARIANTS THAT MATTER MORE THAN ANY SINGLE CASE, walked over a
 * thousand random boards: nothing is minted or burned, and nobody is handed cargo
 * they cannot physically carry. The rounding here settles rows and columns
 * together, and a hand-picked example cannot prove that it always can.
 */
describe('joint loot allocation, over random boards', () => {
  it('conserves the haul and respects every hold', () => {
    const rng = mulberry32(90210);
    const pick = (max: number) => 1 + Math.floor(rng() * max);
    for (let trial = 0; trial < 1_000; trial++) {
      const owners = pick(5);
      const shares: JointCargoShare[] = [];
      for (let owner = 0; owner < owners; owner++) {
        for (let wave = 0; wave < pick(3); wave++) {
          shares.push({
            playerId: `p${owner}`,
            contributionId: `p${owner}-w${wave}-${pick(1_000)}`,
            cargo: pick(4_000),
          });
        }
      }
      const room = shares.reduce((sum, share) => sum + share.cargo, 0);
      const units = Math.floor(rng() * (room + 1));
      const alloy = Math.floor(rng() * (units + 1));
      const crystal = Math.floor(rng() * (units - alloy + 1));
      const haul = resources(alloy, crystal, units - alloy - crystal);

      const out = allocateJointLoot(haul, shares);
      expect(totalOf(out)).toEqual(haul);

      const carried = new Map<string, number>();
      for (const row of out) {
        expect(row.resources.alloy).toBeGreaterThanOrEqual(0);
        expect(row.resources.crystal).toBeGreaterThanOrEqual(0);
        expect(row.resources.deuterium).toBeGreaterThanOrEqual(0);
        const hold = shares.find((s) => s.contributionId === row.contributionId)!.cargo;
        expect(unitsOf(row.resources)).toBeLessThanOrEqual(hold);
        carried.set(row.playerId, (carried.get(row.playerId) ?? 0) + unitsOf(row.resources));
      }
      for (const [playerId, taken] of carried) {
        const hold = shares
          .filter((s) => s.playerId === playerId)
          .reduce((sum, s) => sum + s.cargo, 0);
        expect(taken).toBeLessThanOrEqual(hold);
      }
    }
  });
});

describe('joint salvage allocation', () => {
  it('splits a lift in proportion to surviving collector room, and conserves', () => {
    const out = allocateJointSalvage(resources(900, 300, 0), [
      { playerId: 'p1', contributionId: 'c1', cargo: 3_000 },
      { playerId: 'p2', contributionId: 'c2', cargo: 1_000 },
    ]);
    expect(totalOf(out)).toEqual(resources(900, 300, 0));
    expect(unitsOf(out.find((r) => r.contributionId === 'c1')!.resources)).toBe(900);
    expect(unitsOf(out.find((r) => r.contributionId === 'c2')!.resources)).toBe(300);
  });

  it('gives nothing when no collector came home', () => {
    expect(allocateJointSalvage(resources(500, 0, 0), [])).toEqual([]);
  });
});

/* ── Dominion: the ratio correction and the per-player split ────── */

describe('the joint Dominion ratio', () => {
  it('leaves an even fight untouched', () => {
    expect(adjustJointDominion(5_000, 1, 1)).toBe(5_000);
    expect(adjustJointDominion(-5_000, 1, 1)).toBe(-5_000);
    expect(adjustJointDominion(5_000, 3, 3)).toBe(5_000);
  });

  it('divides a win by the attacker advantage and multiplies a loss by it', () => {
    expect(adjustJointDominion(9_000, 3, 1)).toBe(3_000);
    expect(adjustJointDominion(-9_000, 3, 1)).toBe(-27_000);
  });

  it('truncates toward zero rather than rounding a transfer into existence', () => {
    expect(adjustJointDominion(10, 3, 1)).toBe(3);
    expect(adjustJointDominion(-10, 3, 1)).toBe(-30);
    expect(adjustJointDominion(2, 3, 1)).toBe(0);
    expect(adjustJointDominion(0, 3, 1)).toBe(0);
  });

  it('prices the defenders’ head-count too, since Klan Savunma Desteği', () => {
    // Owner K5, 2026-10-01: the rule works both ways. One raider beating a line of three
    // takes three times the transfer; the three repelling one take a third.
    expect(adjustJointDominion(9_000, 1, 3)).toBe(27_000);
    expect(adjustJointDominion(-9_000, 1, 3)).toBe(-3_000);
    // Equal heads: nothing to correct.
    expect(adjustJointDominion(9_000, 3, 3)).toBe(9_000);
  });

  it('refuses nonsense counts and unsafe bases', () => {
    expect(() => adjustJointDominion(100, 0, 1)).toThrow(RangeError);
    expect(() => adjustJointDominion(100, 1, 0)).toThrow(RangeError);
    expect(() => adjustJointDominion(1.5, 1, 1)).toThrow(RangeError);
    // A discount can never leave the safe range; an amplification can, and is refused.
    expect(() => adjustJointDominion(Number.MAX_SAFE_INTEGER, 3, 1)).not.toThrow();
    expect(() => adjustJointDominion(-Number.MAX_SAFE_INTEGER, 1, 3)).not.toThrow();
    expect(() => adjustJointDominion(Number.MAX_SAFE_INTEGER, 1, 3)).toThrow(RangeError);
  });
});

describe('the joint Dominion split', () => {
  it('pays each participant their own share and sums to the adjusted transfer', () => {
    const out = allocateJointDominion(3_000, [
      { playerId: 'a', raw: 6_000 },
      { playerId: 'b', raw: 3_000 },
    ]);
    expect(out.reduce((sum, row) => sum + row.delta, 0)).toBe(3_000);
    expect(out.find((r) => r.playerId === 'a')!.delta).toBe(2_000);
    expect(out.find((r) => r.playerId === 'b')!.delta).toBe(1_000);
  });

  it('keeps the sign of a participant who came out behind', () => {
    const out = allocateJointDominion(1_000, [
      { playerId: 'winner', raw: 3_000 },
      { playerId: 'loser', raw: -1_000 },
    ]);
    expect(out.reduce((sum, row) => sum + row.delta, 0)).toBe(1_000);
    expect(out.find((r) => r.playerId === 'loser')!.delta).toBeLessThan(0);
  });

  it('settles the remainder deterministically by player id', () => {
    const weights = [
      { playerId: 'bbb', raw: 1 },
      { playerId: 'aaa', raw: 1 },
      { playerId: 'ccc', raw: 1 },
    ];
    const out = allocateJointDominion(100, weights);
    expect(out.reduce((sum, row) => sum + row.delta, 0)).toBe(100);
    expect(allocateJointDominion(100, [...weights].reverse())).toEqual(out);
    // 33 / 33 / 34: the extra point goes to the first id in canonical order.
    expect(out.find((r) => r.playerId === 'aaa')!.delta).toBe(34);
  });

  it('pays nobody when the team exchange was exactly nothing', () => {
    const out = allocateJointDominion(0, [
      { playerId: 'a', raw: 500 },
      { playerId: 'b', raw: -500 },
    ]);
    expect(out.every((row) => row.delta === 0)).toBe(true);
  });

  it('excludes an owner who is not in the weight list at all', () => {
    const out = allocateJointDominion(900, [{ playerId: 'only', raw: 900 }]);
    expect(out).toEqual([{ playerId: 'only', delta: 900 }]);
  });

  it('stays inside the safe integer range', () => {
    expect(() => allocateJointDominion(Number.MAX_SAFE_INTEGER, [
      { playerId: 'a', raw: Number.MAX_SAFE_INTEGER },
      { playerId: 'b', raw: 1 },
    ])).not.toThrow();
    expect(() => allocateJointDominion(1.5, [{ playerId: 'a', raw: 1 }])).toThrow(RangeError);
  });
});

describe('defender permanent loss attribution', () => {
  it('splits the defender loss by credited hull damage and conserves it exactly', () => {
    const out = allocateJointDefenderLoss(1_000, [
      { playerId: 'a', damage: 750 },
      { playerId: 'b', damage: 250 },
    ]);
    expect(out.reduce((sum, row) => sum + row.value, 0)).toBe(1_000);
    expect(out.find((r) => r.playerId === 'a')!.value).toBe(750);
  });

  it('gives nobody anything when nothing got through', () => {
    const out = allocateJointDefenderLoss(0, [{ playerId: 'a', damage: 0 }]);
    expect(out).toEqual([{ playerId: 'a', value: 0 }]);
  });

  it('is deterministic on a tie', () => {
    const rows = [
      { playerId: 'bbb', damage: 1 },
      { playerId: 'aaa', damage: 1 },
    ];
    const out = allocateJointDefenderLoss(3, rows);
    expect(out.reduce((sum, row) => sum + row.value, 0)).toBe(3);
    expect(allocateJointDefenderLoss(3, [...rows].reverse())).toEqual(out);
    expect(out.find((r) => r.playerId === 'aaa')!.value).toBe(2);
  });
});

/* ── the combined board ─────────────────────────────────────────── */

describe('the combined attacking board', () => {
  const stack = (
    id: string,
    playerId: string,
    fleet: Fleet,
    tech: Record<string, number> = {},
  ): JointAttackerStack => ({ contributionId: id, playerId, fleet, tech: { tech } });

  const defence: Fleet = { BASTION: 4, THORN: 6 };

  it('resolves one stack exactly as the ordinary resolver does', () => {
    const fleet: Fleet = { DART: 44, COURIER: 2 };
    const single = resolveCombat(fleet, defence, 900, seeded(), {
      attacker: NO_TECH,
      defender: NO_TECH,
    });
    const joint = resolveJointCombat(
      [stack('c1', 'p1', fleet)],
      defence,
      900,
      seeded(),
      NO_TECH,
    );
    expect(joint.grade).toBe(single.grade);
    expect(joint.lossRatio).toBe(single.lossRatio);
    expect(joint.shieldLeft).toBe(single.shieldLeft);
    expect(joint.attackerSurvivors).toEqual(single.attackerSurvivors);
    expect(joint.defenderSurvivors).toEqual(single.defenderSurvivors);
    expect(joint.attackerLosses).toEqual(single.attackerLosses);
    expect(joint.defenderLosses).toEqual(single.defenderLosses);
    expect(joint.attackerLossValue).toBe(single.attackerLossValue);
    expect(joint.defenderLossValue).toBe(single.defenderLossValue);
    expect(joint.defenceSalvage).toEqual(single.defenceSalvage);
    expect(joint.rounds).toEqual(single.rounds);
  });

  it('spends the same number of rolls however many owners are in the pool', () => {
    // A board neither side can wipe inside three rounds, so the loop always runs
    // its full length and the count is about the POOL rather than about the fight.
    const wall: Fleet = { CITADEL: 100 };
    const count = (stacks: readonly JointAttackerStack[]): number => {
      let calls = 0;
      const source = seeded();
      resolveJointCombat(stacks, wall, 0, () => { calls++; return source(); }, NO_TECH);
      return calls;
    };
    const one = count([stack('c1', 'p1', { CORSAIR: 100 })]);
    const four = count([
      stack('c1', 'p1', { CORSAIR: 25 }),
      stack('c2', 'p2', { CORSAIR: 25 }),
      stack('c3', 'p3', { CORSAIR: 25 }),
      stack('c4', 'p4', { CORSAIR: 25 }),
    ]);
    expect(one).toBe(COMBAT.rounds * 2);
    expect(four).toBe(one);
  });

  /**
   * Splitting one wing between two commanders is very nearly a no-op, and the
   * residue is deliberate: each owner's casualties are floored against THEIR OWN
   * hit points, because their research is their own. Two part-damaged hulls can
   * survive where one whole one would have died, so the two boards converge
   * rather than matching to the unit.
   */
  it('gives nearly the same board when one wing is split between two owners', () => {
    const wall: Fleet = { CITADEL: 30 };
    const whole = resolveJointCombat(
      [stack('c1', 'p1', { DART: 1_000 })],
      wall,
      0,
      seeded(),
      NO_TECH,
    );
    const split = resolveJointCombat(
      [stack('c1', 'p1', { DART: 500 }), stack('c2', 'p2', { DART: 500 })],
      wall,
      0,
      seeded(),
      NO_TECH,
    );
    expect(whole.attackerLosses.DART).toBeGreaterThan(0);
    expect(whole.defenderLosses.CITADEL).toBeGreaterThan(0);
    expect(split.grade).toBe(whole.grade);
    expect(split.contributions).toHaveLength(2);
    const near = (a: number, b: number, tolerance: number) =>
      Math.abs(a - b) / Math.max(1, b) < tolerance;
    expect(near(split.attackerLosses.DART ?? 0, whole.attackerLosses.DART ?? 0, 0.02)).toBe(true);
    expect(near(
      split.defenderLosses.CITADEL ?? 0,
      whole.defenderLosses.CITADEL ?? 0,
      0.1,
    )).toBe(true);
    // Whatever the residue, the parts still account for the whole exactly.
    const sent = split.contributions.reduce((sum, c) => sum + (c.sent.DART ?? 0), 0);
    const lost = split.contributions.reduce((sum, c) => sum + (c.losses.DART ?? 0), 0);
    expect(sent).toBe(1_000);
    expect(lost).toBe(split.attackerLosses.DART);
  });

  it('cannot avoid casualties by splitting one owner’s identical wing into tiny waves', () => {
    const compare = (total: number, wall: number) => {
      const whole = resolveJointCombat(
        [stack('whole', 'p1', { DART: total })],
        { BASTION: wall }, 0, seeded(), NO_TECH,
      );
      const split = resolveJointCombat(
        Array.from({ length: total }, (_, index) =>
          stack(`wave-${String(index).padStart(3, '0')}`, 'p1', { DART: 1 })),
        { BASTION: wall }, 0, seeded(), NO_TECH,
      );
      expect(split.attackerLosses).toEqual(whole.attackerLosses);
      expect(split.attackerSurvivors).toEqual(whole.attackerSurvivors);
      expect(split.grade).toBe(whole.grade);
      expect(split.contributions.reduce((sum, row) => sum + (row.losses.DART ?? 0), 0))
        .toBe(whole.attackerLosses.DART);
    };
    compare(100, 4);
    compare(50, 8);
  });

  it('fires each owner with their own research and no one elses', () => {
    const plain = resolveJointCombat(
      [stack('c1', 'p1', { DART: 20 }), stack('c2', 'p2', { DART: 20 })],
      defence,
      0,
      seeded(),
      NO_TECH,
    );
    const oneResearched = resolveJointCombat(
      [
        stack('c1', 'p1', { DART: 20 }, { SHIP_POWER: 10 }),
        stack('c2', 'p2', { DART: 20 }),
      ],
      defence,
      0,
      seeded(),
      NO_TECH,
    );
    const damage = (r: typeof plain, id: string) =>
      r.contributions.find((c) => c.contributionId === id)!.hullDamage;
    // Identical wings with identical research land identically...
    expect(damage(plain, 'c1')).toBeCloseTo(damage(plain, 'c2'), 6);
    // ...and one commander's Ship Power lifts THEIR wing and nobody else's.
    expect(damage(oneResearched, 'c1')).toBeGreaterThan(damage(oneResearched, 'c2'));
    expect(damage(oneResearched, 'c1')).toBeGreaterThan(damage(plain, 'c1'));
  });

  it('keeps every casualty with the owner who sent it', () => {
    const out = resolveJointCombat(
      [
        stack('c1', 'p1', { DART: 30 }),
        stack('c2', 'p2', { PIKE: 12 }),
      ],
      { BASTION: 8 },
      0,
      seeded(),
      NO_TECH,
    );
    const first = out.contributions.find((c) => c.contributionId === 'c1')!;
    const second = out.contributions.find((c) => c.contributionId === 'c2')!;
    expect(first.playerId).toBe('p1');
    expect(Object.keys(first.losses).every((id) => id === 'DART')).toBe(true);
    expect(Object.keys(second.losses).every((id) => id === 'PIKE')).toBe(true);
    for (const row of out.contributions) {
      for (const id of Object.keys(row.sent) as (keyof Fleet)[]) {
        expect((row.survivors[id] ?? 0) + (row.losses[id] ?? 0)).toBe(row.sent[id]);
      }
    }
    const sumLoss = out.contributions.reduce((s, c) => s + fleetValue(c.losses), 0);
    expect(sumLoss).toBe(out.attackerLossValue);
  });

  it('covers an unescorted owner behind allied guns', () => {
    const out = resolveJointCombat(
      [
        stack('guns', 'p1', { SENTINEL: 30 }),
        stack('hold', 'p2', { WAYFARER: 3 }),
      ],
      { THORN: 2 },
      0,
      seeded(),
      NO_TECH,
    );
    const support = out.contributions.find((c) => c.contributionId === 'hold')!;
    expect(support.losses).toEqual({});
    expect(support.hullDamage).toBe(0);
  });

  it('exposes every hold once the whole allied line is gone', () => {
    const out = resolveJointCombat(
      [
        stack('guns', 'p1', { DART: 1 }),
        stack('hold', 'p2', { COURIER: 4 }),
      ],
      { BASTION: 12 },
      0,
      seeded(),
      NO_TECH,
    );
    const support = out.contributions.find((c) => c.contributionId === 'hold')!;
    expect(fleetValue(support.losses)).toBeGreaterThan(0);
  });

  it('credits no more hull damage than the line could actually absorb', () => {
    const out = resolveJointCombat(
      [
        stack('c1', 'p1', { CATACLYSM: 200 }),
        stack('c2', 'p2', { CATACLYSM: 200 }),
      ],
      { THORN: 1 },
      0,
      flat(),
      NO_TECH,
    );
    const credited = out.contributions.reduce((sum, c) => sum + c.hullDamage, 0);
    expect(credited).toBeLessThanOrEqual(HULLS.THORN.hp * 1 + 1e-6);
    expect(credited).toBeGreaterThan(0);
  });

  it('caps each defender hull before assigning mixed-class damage credit', () => {
    const stacks = [
      stack('darts', 'p1', { DART: 100 }),
      stack('pikes', 'p2', { PIKE: 10 }),
    ];
    const defenders: Fleet = { THORN: 1, BASTION: 1 };
    const out = resolveJointCombat(stacks, defenders, 0, flat(), NO_TECH);
    const defenderHp = Object.entries(defenders).reduce(
      (sum, [hull, count]) => sum + HULLS[hull as keyof Fleet].hp * count,
      0,
    );
    const expected = stacks.map(() => 0);
    for (const [defender, count] of Object.entries(defenders) as [keyof Fleet, number][]) {
      const hp = HULLS[defender].hp * count;
      const perStack = stacks.map((attacker) => Object.entries(attacker.fleet).reduce(
        (sum, [hull, amount]) => sum
          + HULLS[hull as keyof Fleet].atk * amount
          * counterMult(HULLS[hull as keyof Fleet].cls, HULLS[defender].cls)
          * hp / defenderHp,
        0,
      ));
      const incoming = perStack.reduce((sum, damage) => sum + damage, 0);
      const cap = incoming > hp ? hp / incoming : 1;
      for (let index = 0; index < perStack.length; index += 1) {
        expected[index]! += perStack[index]! * cap;
      }
    }

    expect(out.contributions.find((row) => row.contributionId === 'darts')!.hullDamage)
      .toBeCloseTo(expected[0]!, 6);
    expect(out.contributions.find((row) => row.contributionId === 'pikes')!.hullDamage)
      .toBeCloseTo(expected[1]!, 6);
  });

  it('spends the Aegis once for the whole allied side', () => {
    const out = resolveJointCombat(
      [
        stack('c1', 'p1', { NULLIFIER: 6 }),
        stack('c2', 'p2', { DART: 20 }),
      ],
      defence,
      4_000,
      seeded(),
      NO_TECH,
    );
    const absorbed = out.rounds.reduce((sum, r) => sum + r.shieldAbsorbed, 0);
    expect(absorbed).toBeGreaterThan(0);
    expect(out.shieldLeft).toBeLessThan(4_000);
    expect(out.rounds.some((r) => r.shieldBreakerDamage > 0)).toBe(true);
  });

  it('repeats exactly under the same seed', () => {
    const stacks = [
      stack('c1', 'p1', { DART: 18, COURIER: 1 }, { SHIP_POWER: 4 }),
      stack('c2', 'p2', { PIKE: 9 }, { SHIP_ARMOR: 3 }),
    ];
    const a = resolveJointCombat(stacks, defence, 700, seeded(), NO_TECH);
    const b = resolveJointCombat(stacks, defence, 700, seeded(), NO_TECH);
    expect(a).toEqual(b);
  });

  it('does not let a resolved board mutate the fleets it was handed', () => {
    const fleet: Fleet = { DART: 30 };
    resolveJointCombat([stack('c1', 'p1', fleet)], defence, 0, seeded(), NO_TECH);
    expect(fleet).toEqual({ DART: 30 });
  });

  it('refuses an empty pool rather than inventing a walkover', () => {
    expect(() => resolveJointCombat([], defence, 0, seeded(), NO_TECH)).toThrow(RangeError);
  });
});
