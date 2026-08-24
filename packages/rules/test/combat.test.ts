import { describe, expect, it } from 'vitest';
import {
  COMBAT,
  GROUND_HULLS,
  HULLS,
  computeLoot,
  counterMult,
  deuteriumOf,
  emptyLedger,
  bookBattle,
  dominion,
  fleetCount,
  fleetCargo,
  fleetPower,
  fleetValue,
  mulberry32,
  resolveCombat,
  type HullId,
  type MobileHullId,
} from '../src/index.js';

const rng = () => mulberry32(12345);
const flat = () => () => 0.5;

describe('counter cycle', () => {
  /**
   * THE ANTI-TURTLE TOOL, AND IT IS NO LONGER FREE. Economy v2 prices both ground
   * guns at 1.6x equal-budget power, because they can never leave, never loot and
   * never take Dominion — so breaking a wall now costs the attacker something.
   *
   * Measured: at budget parity a Wasp swarm only manages PARTIAL. It needs about a
   * third more than the defence is worth to clear it outright, and then it destroys
   * a bit over twice what it loses. That is what "cheaply" has to mean once defence
   * actually works — an exchange the attacker wins, not one they walk.
   */
  it('Wasps break Bastions at a favourable exchange — the anti-turtle tool', () => {
    const parity = resolveCombat({ WASP: 53 }, { BASTION: 4 }, 0, flat());
    expect(parity.grade).toBe('PARTIAL');

    const r = resolveCombat({ WASP: 70 }, { BASTION: 4 }, 0, flat());
    expect(r.grade).toBe('DECISIVE');
    expect(fleetValue(r.attackerLosses)).toBeLessThan(fleetValue(r.defenderLosses) / 2);
  });

  /**
   * A LONE GUN IS OVERWHELMED, AND TAKES A FEW WITH IT.
   *
   * It used to take none: 34 ATK x 0.625 into Skirmishers was 21 damage against a
   * Wasp's 24 HP, so a Bastion facing a swarm was decoration that had been paid
   * for. At 118 ATK it kills five of twenty-six — still hopeless against the
   * counter, but never free. A defence nobody has to respect is not a decision.
   *
   * And one gun is not a wall: the swarm still clears it outright.
   */
  it('is overwhelmed by a Wasp swarm, but never for free', () => {
    const r = resolveCombat({ WASP: 26 }, { BASTION: 1 }, 0, flat());
    expect(r.grade).toBe('DECISIVE');
    expect(fleetCount(r.attackerLosses)).toBeGreaterThan(0);
    expect(fleetCount(r.attackerLosses)).toBeLessThan(10);
  });

  it('Lances lose badly into Bastions', () => {
    const wasps = resolveCombat({ WASP: 60 }, { BASTION: 4 }, 0, flat());
    const lances = resolveCombat({ LANCE: 17 }, { BASTION: 4 }, 0, flat());
    // Roughly equal alloy spent, wildly different outcome.
    expect(fleetValue(lances.attackerLosses)).toBeGreaterThan(
      fleetValue(wasps.attackerLosses),
    );
  });
});

/**
 * TWO GROUND GUNS, IN OPPOSITE CLASSES. D27.
 *
 * The property these protect is not a number, it is a SHAPE: whatever counters one
 * ground hull must not counter the other. With a single ground hull the defender
 * had no composition choice and the attacker had no question to ask, and both
 * branches of the one-hull design were measured and failed — see `docs/balance.md`.
 */
describe('ground defence is a choice, not a quantity', () => {
  const price = (h: HullId) => HULLS[h].alloy + HULLS[h].crystal;

  it('there is more than one ground hull', () => {
    expect(GROUND_HULLS.length).toBeGreaterThan(1);
  });

  it('no single attacking hull counters all of them', () => {
    for (const atk of ['WASP', 'LANCE', 'BULWARK'] as MobileHullId[]) {
      const strongAgainst = GROUND_HULLS.filter(
        (g) => counterMult(HULLS[atk].cls, HULLS[g].cls) === COMBAT.strongMult,
      );
      expect(
        strongAgainst.length,
        `${atk} hard-counters every ground hull, so defence has no shape`,
      ).toBeLessThan(GROUND_HULLS.length);
    }
  });

  it('every ground hull is counterable by something', () => {
    // The other failure mode: a gun nothing beats makes attacking pointless.
    for (const g of GROUND_HULLS) {
      const answers = (['WASP', 'LANCE', 'BULWARK'] as MobileHullId[]).filter(
        (atk) => counterMult(HULLS[atk].cls, HULLS[g].cls) === COMBAT.strongMult,
      );
      expect(answers.length, `nothing counters ${g}`).toBeGreaterThan(0);
    }
  });

  it('the light gun is reachable from a standing start', () => {
    // A beginner with no Shipyard must be able to defend something, or the rank
    // floor is the only thing between them and a developed neighbour.
    const cheapest = [...GROUND_HULLS].sort((x, y) => price(x) - price(y))[0]!;
    expect(HULLS[cheapest].minShipyard).toBe(0);
  });

  it('bringing the wrong counter is punished', () => {
    // The whole point of scouting: guess wrong and the exchange inverts.
    const budget = 40_000;
    const spend = (h: HullId, n = budget) => Math.max(1, Math.floor(n / price(h)));
    for (const g of GROUND_HULLS) {
      const right = (['WASP', 'LANCE', 'BULWARK'] as MobileHullId[]).find(
        (a) => counterMult(HULLS[a].cls, HULLS[g].cls) === COMBAT.strongMult,
      )!;
      const wrong = (['WASP', 'LANCE', 'BULWARK'] as MobileHullId[]).find(
        (a) => counterMult(HULLS[a].cls, HULLS[g].cls) === COMBAT.weakMult,
      )!;
      const hit = (a: MobileHullId) => {
        const r = resolveCombat({ [a]: spend(a) }, { [g]: spend(g) }, 0, flat());
        return fleetValue(r.defenderLosses) / Math.max(1, fleetValue(r.attackerLosses));
      };
      expect(hit(right), `${right} should beat ${g}`).toBeGreaterThan(hit(wrong));
    }
  });
});

describe('grading uses value, not power', () => {
  /**
   * REGRESSION: grading once used Sum(count x ATK x HP). Under that metric a pile
   * of Wasps and one Bastion read as EQUAL while the Wasps annihilate it, so every
   * fight involving a counter was mis-scored.
   *
   * The gap is starker since Economy v2, which is the useful part: the two fleets
   * that `fleetPower` calls equal differ by more than twenty times in what they
   * cost. The count is DERIVED from the metric rather than written down, so this
   * keeps testing the property after the next re-cut of the hull table.
   */
  it('power says these are equal; combat and the price list both say otherwise', () => {
    const wasps = Math.round(fleetPower({ BASTION: 1 }) / fleetPower({ WASP: 1 }));
    expect(fleetPower({ WASP: wasps })).toBeCloseTo(fleetPower({ BASTION: 1 }), 0);

    // Equal by power; nowhere near equal by what they cost.
    expect(fleetValue({ WASP: wasps })).toBeGreaterThan(fleetValue({ BASTION: 1 }) * 10);

    const r = resolveCombat({ WASP: wasps }, { BASTION: 1 }, 0, flat());
    expect(r.grade).toBe('DECISIVE');
  });
});

describe('support hulls', () => {
  /**
   * REGRESSION: Haulers (80 HP, taking 1.6x from everything) died in round one,
   * so attackers arrived with no cargo and raiding could not pay for itself.
   */
  it('survive while escorted', () => {
    const r = resolveCombat({ WASP: 80, HAULER: 10 }, { BASTION: 2 }, 0, flat());
    expect(r.attackerLosses.HAULER ?? 0).toBe(0);
  });

  it('are exposed once the escort is gone', () => {
    const r = resolveCombat({ HAULER: 10 }, { BASTION: 6 }, 0, flat());
    expect(r.attackerLosses.HAULER ?? 0).toBeGreaterThan(0);
  });

  it('contribute no damage', () => {
    const escorted = resolveCombat({ WASP: 30, HAULER: 20 }, { BASTION: 3 }, 0, flat());
    const alone = resolveCombat({ WASP: 30 }, { BASTION: 3 }, 0, flat());
    expect(escorted.defenderLossValue).toBe(alone.defenderLossValue);
  });

  it('keeps Haulers untouched in an escorted round, then exposes them after the escort dies', () => {
    const r = resolveCombat({ WASP: 1, HAULER: 10 }, { BASTION: 20 }, 0, flat());
    expect(r.rounds[0]?.attackerLosses.HAULER ?? 0).toBe(0);
    expect(r.rounds.slice(1).some((round) => (round.attackerLosses.HAULER ?? 0) > 0)).toBe(true);
  });
});

describe('combat cargo', () => {
  it('adds mixed-fleet capacity from every surviving combat hull', () => {
    const fleet = { WASP: 2, LANCE: 3, BULWARK: 4, HAULER: 1 } as const;
    expect(fleetCargo(fleet)).toBe(
      2 * HULLS.WASP.cargo
      + 3 * HULLS.LANCE.cargo
      + 4 * HULLS.BULWARK.cargo
      + HULLS.HAULER.cargo,
    );
  });
});

describe('shields', () => {
  it('absorb the whole assault when large enough', () => {
    const r = resolveCombat({ WASP: 20 }, { BASTION: 2 }, 100_000, flat());
    expect(r.grade).toBe('REPELLED');
    expect(fleetCount(r.defenderLosses)).toBe(0);
    expect(r.shieldLeft).toBeGreaterThan(0);
  });

  describe('Breacher', () => {
    it('records shield-only bonus damage and can break a bare Aegis', () => {
      const r = resolveCombat({ BREACHER: 1 }, {}, 100, flat());
      expect(r.grade).toBe('DECISIVE');
      expect(r.shieldLeft).toBe(0);
      expect(r.rounds.reduce((sum, round) => sum + round.shieldAbsorbed, 0)).toBe(100);
      expect(r.rounds.reduce((sum, round) => sum + round.breacherShieldDamage, 0)).toBeGreaterThan(0);
    });

    it('has no bonus at all when there is no shield', () => {
      const r = resolveCombat({ BREACHER: 4 }, { BASTION: 1 }, 0, flat());
      expect(r.rounds.every((round) => round.breacherShieldDamage === 0)).toBe(true);
    });

    it('never spills bonus overkill into units', () => {
      const withoutShield = resolveCombat({ BREACHER: 4 }, { BASTION: 1 }, 0, flat());
      const almostEmptyShield = resolveCombat({ BREACHER: 4 }, { BASTION: 1 }, 1, flat());
      expect(almostEmptyShield.defenderSurvivors).toEqual(withoutShield.defenderSurvivors);
      expect(almostEmptyShield.defenderLosses).toEqual(withoutShield.defenderLosses);
      expect(almostEmptyShield.rounds[0]?.breacherShieldDamage).toBe(1);
    });
  });
});

describe('defence salvage', () => {
  it('rebuilds 60% of destroyed turrets', () => {
    const r = resolveCombat({ WASP: 200 }, { BASTION: 10 }, 0, flat());
    expect(r.defenderLosses.BASTION).toBe(10);
    expect(r.defenceSalvage.BASTION).toBe(6);
  });

  it('excludes salvaged units from scored value', () => {
    const r = resolveCombat({ WASP: 200 }, { BASTION: 10 }, 0, flat());
    expect(r.defenderLossValue).toBeLessThan(fleetValue(r.defenderLosses));
    expect(r.defenderLossValue).toBeGreaterThanOrEqual(0);
  });

  it('never salvages mobile hulls', () => {
    const r = resolveCombat({ WASP: 200 }, { WASP: 10 }, 0, flat());
    expect(r.defenceSalvage.WASP).toBeUndefined();
  });
});

describe('outcome grades', () => {
  it('produces all three across a spread of matchups', () => {
    const grades = new Set([
      resolveCombat({ WASP: 400 }, { BASTION: 2 }, 0, rng()).grade,
      resolveCombat({ WASP: 46 }, { BASTION: 4 }, 0, rng()).grade,
      resolveCombat({ WASP: 5 }, { BASTION: 10 }, 0, rng()).grade,
    ]);
    expect(grades.has('DECISIVE')).toBe(true);
    expect(grades.has('REPELLED')).toBe(true);
  });

  it('is low-variance — intel must beat luck', () => {
    const results = Array.from({ length: 200 }, (_, i) =>
      resolveCombat({ WASP: 60 }, { BASTION: 3 }, 0, mulberry32(i)),
    );
    const losses = results.map((r) => fleetCount(r.attackerLosses));
    const spread = Math.max(...losses) - Math.min(...losses);
    const mean = losses.reduce((a, b) => a + b, 0) / losses.length;
    expect(spread).toBeLessThan(Math.max(4, mean * 0.6));
  });
});

describe('loot', () => {
  const stock = { alloy: 60_000, crystal: 8_000, deuterium: 0 };
  const empty = { alloy: 0, crystal: 0, deuterium: 0 };
  /**
   * The same floor on both resources. Real play never looks like this — the
   * crystal floor is a fraction of the alloy one (D61) — but a test about the
   * SHARE, the cargo cap or the repeat decay has no business varying two numbers
   * at once, and saying so here is clearer than two literals at every call.
   */
  const both = (n: number) => ({ alloy: n, crystal: n, deuterium: 0 });

  it('normalises pre-Deuterium JSON at the read boundary', () => {
    expect(deuteriumOf({ alloy: 10, crystal: 5 })).toBe(0);
  });

  /**
   * Asserted against the constant, not against a literal. The share was 0.5 for
   * four phases and is 0.65 since D61; what must never change is that the floor is
   * subtracted BEFORE the share is taken, and that is what this pins.
   */
  it('takes its share of what is above the vault floor, and nothing of what is under it', () => {
    const loot = computeLoot(stock, empty, both(10_000), 'DECISIVE', 1_000_000);
    expect(loot.alloy).toBe((stock.alloy - 10_000) * COMBAT.lootDecisive);
  });

  it('never exceeds cargo', () => {
    const loot = computeLoot(stock, empty, both(0), 'DECISIVE', 900);
    expect(loot.alloy + loot.crystal).toBeLessThanOrEqual(900);
  });

  it('cannot touch anything below the vault floor', () => {
    const loot = computeLoot(
      { alloy: 500, crystal: 100, deuterium: 0 },
      empty,
      both(5_000),
      'DECISIVE',
      99_999,
    );
    expect(loot.alloy).toBe(0);
    expect(loot.crystal).toBe(0);
  });

  it('never lets the Vault protect Deuterium', () => {
    const loot = computeLoot(
      { alloy: 0, crystal: 0, deuterium: 1_000 },
      empty,
      { alloy: 1_000_000, crystal: 1_000_000, deuterium: 0 },
      'DECISIVE',
      1_000_000,
    );

    expect(loot.deuterium).toBe(1_000 * COMBAT.lootDecisive);
    expect(loot.fromStock.deuterium).toBe(loot.deuterium);
  });

  it('charges Deuterium against the same cargo hold', () => {
    const loot = computeLoot(
      { alloy: 1_000, crystal: 1_000, deuterium: 1_000 },
      empty,
      both(0),
      'DECISIVE',
      300,
    );
    expect(loot.alloy + loot.crystal + loot.deuterium).toBeLessThanOrEqual(300);
    expect(loot.deuterium).toBeGreaterThan(0);
  });

  /**
   * THE SHARE IS THE REPEAT-RAID DECAY SYSTEM, whatever the share happens to be.
   *
   * Taking a fixed proportion of what is left means the second raid on the same
   * pile is worth `(1 - share)` of the first and the third `(1 - share)²` — so
   * diminishing returns arrive for free, with no cooldown table and no extra
   * state. That relationship is the invariant; 50% was only ever the number it
   * was expressed in, and it is 65% since D61.
   */
  it('the share IS the repeat-raid decay', () => {
    const left = 1 - COMBAT.lootDecisive;
    let alloy = 80_000;
    const taken: number[] = [];
    for (let i = 0; i < 3; i++) {
      const loot = computeLoot(
        { alloy, crystal: 0, deuterium: 0 },
        empty,
        both(0),
        'DECISIVE',
        1_000_000,
      );
      taken.push(loot.alloy);
      alloy -= loot.alloy;
    }
    expect(taken[1]!).toBeCloseTo(taken[0]! * left, 0);
    expect(taken[2]!).toBeCloseTo(taken[0]! * left * left, 0);
  });

  it('a repelled raid takes nothing', () => {
    const loot = computeLoot(
      stock,
      { alloy: 9_000, crystal: 0, deuterium: 0 },
      both(0),
      'REPELLED',
      99_999,
    );
    expect(loot.alloy).toBe(0);
    expect(loot.crystal).toBe(0);
  });

  /* ── the uncollected works, D16 ──────────────────────────── */

  it('takes uncollected ore at half the rate it takes storage', () => {
    const fromStore = computeLoot(
      { alloy: 10_000, crystal: 0, deuterium: 0 }, empty, both(0), 'DECISIVE', 1e9,
    );
    const fromWorks = computeLoot(
      empty, { alloy: 10_000, crystal: 0, deuterium: 0 }, both(0), 'DECISIVE', 1e9,
    );
    expect(fromWorks.alloy).toBe(fromStore.alloy * COMBAT.lootBufferShare);
  });

  /**
   * The vault protects a STORE. Ore still in the works has not reached one, so the
   * floor cannot cover it — otherwise a small player with a big vault would be
   * completely unraidable simply by never pressing collect, which is the exploit
   * D13 already had to be rescued from once.
   */
  it('the vault floor does not cover the works', () => {
    const loot = computeLoot(
      empty,
      { alloy: 4_000, crystal: 0, deuterium: 0 },
      both(50_000),
      'DECISIVE',
      1e9,
    );
    expect(loot.alloy).toBeGreaterThan(0);
    expect(loot.fromStock.alloy).toBe(0);
    expect(loot.fromBuffer.alloy).toBe(loot.alloy);
  });

  it('reports the split so the caller can debit both columns', () => {
    const loot = computeLoot(
      { alloy: 20_000, crystal: 4_000, deuterium: 0 },
      { alloy: 6_000, crystal: 1_000, deuterium: 0 },
      both(0),
      'DECISIVE',
      1e9,
    );
    expect(loot.fromStock.alloy + loot.fromBuffer.alloy).toBe(loot.alloy);
    expect(loot.fromStock.crystal + loot.fromBuffer.crystal).toBe(loot.crystal);
    expect(loot.fromStock.alloy).toBe(20_000 * COMBAT.lootDecisive);
    expect(loot.fromBuffer.alloy).toBe(6_000 * COMBAT.lootDecisive * COMBAT.lootBufferShare);
  });

  /**
   * A cargo shortfall must cost every pile the same proportion. Draining whichever
   * one the code happens to read first would make loot depend on argument order,
   * and a hauler-light raid would come home with a suspiciously tidy answer.
   */
  it('scales all four piles together when cargo runs out', () => {
    const loot = computeLoot(
      { alloy: 40_000, crystal: 40_000, deuterium: 0 },
      { alloy: 40_000, crystal: 40_000, deuterium: 0 },
      both(0),
      'DECISIVE',
      1_000,
    );
    expect(loot.alloy + loot.crystal).toBeLessThanOrEqual(1_000);
    expect(loot.fromBuffer.alloy).toBeGreaterThan(0);
    expect(loot.fromStock.alloy).toBeGreaterThan(0);
    // Storage is exposed at twice the rate, so it should give up twice as much.
    expect(loot.fromStock.alloy / loot.fromBuffer.alloy).toBeCloseTo(2, 1);
  });
});

describe('dominion', () => {
  it('sums to exactly zero across a battle', () => {
    const atk = emptyLedger();
    const def = emptyLedger();
    const r = resolveCombat({ WASP: 90, HAULER: 6 }, { BASTION: 4, WASP: 20 }, 0, rng());
    bookBattle(atk, def, 12_000, r);
    expect(dominion(atk) + dominion(def)).toBe(0);
  });

  it('rewards a defender who repels an attack', () => {
    const atk = emptyLedger();
    const def = emptyLedger();
    const r = resolveCombat({ WASP: 8 }, { BASTION: 12 }, 0, rng());
    bookBattle(atk, def, 0, r);
    expect(dominion(def)).toBeGreaterThan(0);
    expect(dominion(atk)).toBeLessThan(0);
  });

  it('is zero for a player who never fights', () => {
    expect(dominion(emptyLedger())).toBe(0);
  });
});
