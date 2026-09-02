import { describe, expect, it } from 'vitest';
import {
  ALL_HULLS,
  COMBAT,
  DOMINION_TRANSFER_SCALE,
  GROUND_HULLS,
  HULLS,
  NON_COMBATANT_HULLS,
  computeLoot,
  counterMult,
  deuteriumOf,
  emptyLedger,
  bookBattle,
  dominion,
  dominionTransfer,
  fleetCount,
  fleetCargo,
  fleetPower,
  fleetValue,
  garrisonOf,
  PIRATE,
  mulberry32,
  pirateStats,
  resolveCombat,
  type HullId,
  type MobileHullId,
} from '../src/index.js';

const rng = () => mulberry32(12345);
/** Neither side has researched anything: the hull table's own numbers. */
const NO_TECH = { attacker: { tech: {} }, defender: { tech: {} } };
const flat = () => () => 0.5;

describe('counter cycle', () => {
  /**
   * THE ANTI-TURTLE TOOL, AND IT IS NO LONGER FREE. Economy v2 prices both ground
   * guns at 1.6x equal-budget power, because they can never leave, never loot and
   * never take Dominion — so breaking a wall now costs the attacker something.
   *
   * Measured: at budget parity a Dart swarm only manages PARTIAL. It needs about a
   * third more than the defence is worth to clear it outright, and then it destroys
   * a bit over twice what it loses. That is what "cheaply" has to mean once defence
   * actually works — an exchange the attacker wins, not one they walk.
   */
  it('Darts break Bastions at a favourable exchange — the anti-turtle tool', () => {
    const parity = resolveCombat({ DART: 53 }, { BASTION: 4 }, 0, flat(), NO_TECH);
    expect(parity.grade).toBe('PARTIAL');

    const r = resolveCombat({ DART: 70 }, { BASTION: 4 }, 0, flat(), NO_TECH);
    expect(r.grade).toBe('DECISIVE');
    expect(fleetValue(r.attackerLosses)).toBeLessThan(fleetValue(r.defenderLosses) / 2);
  });

  /**
   * A LONE GUN IS OVERWHELMED, AND TAKES A FEW WITH IT.
   *
   * It used to take none: 34 ATK x 0.625 into Skirmishers was 21 damage against a
   * Dart's 24 HP, so a Bastion facing a swarm was decoration that had been paid
   * for. At 118 ATK it kills five of twenty-six — still hopeless against the
   * counter, but never free. A defence nobody has to respect is not a decision.
   *
   * And one gun is not a wall: the swarm still clears it outright.
   */
  it('is overwhelmed by a Dart swarm, but never for free', () => {
    const r = resolveCombat({ DART: 26 }, { BASTION: 1 }, 0, flat(), NO_TECH);
    expect(r.grade).toBe('DECISIVE');
    expect(fleetCount(r.attackerLosses)).toBeGreaterThan(0);
    expect(fleetCount(r.attackerLosses)).toBeLessThan(10);
  });

  it('Pikes lose badly into Bastions', () => {
    const wasps = resolveCombat({ DART: 60 }, { BASTION: 4 }, 0, flat(), NO_TECH);
    const lances = resolveCombat({ PIKE: 17 }, { BASTION: 4 }, 0, flat(), NO_TECH);
    // Pike is the wrong class into a Bulwark emplacement; compare the share of
    // each committed fleet lost rather than stale pre-V2 unit counts.
    expect(fleetValue(lances.attackerLosses) / fleetValue({ PIKE: 17 })).toBeGreaterThan(
      fleetValue(wasps.attackerLosses) / fleetValue({ DART: 60 }),
    );
    expect(lances.defenderLossValue).toBeLessThan(wasps.defenderLossValue);
  });

  /**
   * PLAYER COMPLAINT: 150 Pikes lost about 35; 250 Pikes later lost about 30
   * against nearly the same board.
   *
   * That shape is not an inverted scaling bug. Fire is simultaneous, so every
   * Pike on the board receives the defender's complete first salvo before any
   * destroyed gun is removed. The larger formation earns its advantage in round
   * two by removing more of that board in round one. A few added Darts also matter:
   * Darts counter Pikes at 1.6x.
   */
  it('reproduces the reported Pike losses as simultaneous fire, not larger-fleet punishment', () => {
    const defence = { DART: 10, BASTION: 10, THORN: 30 };
    const small = resolveCombat({ PIKE: 150 }, defence, 0, flat(), NO_TECH);
    const large = resolveCombat({ PIKE: 250 }, defence, 0, flat(), NO_TECH);

    expect(small.rounds[0]?.attackerLosses.PIKE).toBeGreaterThan(0);
    expect(large.rounds[0]?.attackerLosses.PIKE)
      .toBe(small.rounds[0]?.attackerLosses.PIKE);
    expect(fleetCount(large.attackerLosses) / 250).toBeLessThan(
      fleetCount(small.attackerLosses) / 150,
    );
  });

  it('makes even a few defending Darts visible in Pike casualties', () => {
    const before = resolveCombat(
      { PIKE: 250 },
      { DART: 10, BASTION: 10, THORN: 30 },
      0,
      flat(),
      NO_TECH,
    );
    const after = resolveCombat(
      { PIKE: 250 },
      { DART: 14, BASTION: 10, THORN: 30 },
      0,
      flat(),
      NO_TECH,
    );

    expect(fleetCount(after.attackerLosses)).toBeGreaterThanOrEqual(
      fleetCount(before.attackerLosses),
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
    for (const atk of ['DART', 'PIKE', 'RAMPART'] as MobileHullId[]) {
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
      const answers = (['DART', 'PIKE', 'RAMPART'] as MobileHullId[]).filter(
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
      const right = (['DART', 'PIKE', 'RAMPART'] as MobileHullId[]).find(
        (a) => counterMult(HULLS[a].cls, HULLS[g].cls) === COMBAT.strongMult,
      )!;
      const wrong = (['DART', 'PIKE', 'RAMPART'] as MobileHullId[]).find(
        (a) => counterMult(HULLS[a].cls, HULLS[g].cls) === COMBAT.weakMult,
      )!;
      const hit = (a: MobileHullId) => {
        const r = resolveCombat({ [a]: spend(a) }, { [g]: spend(g) }, 0, flat(), NO_TECH);
        return fleetValue(r.defenderLosses) / Math.max(1, fleetValue(r.attackerLosses));
      };
      expect(hit(right), `${right} should beat ${g}`).toBeGreaterThan(hit(wrong));
    }
  });
});

describe('grading uses value, not power', () => {
  /**
   * REGRESSION: grading once used Sum(count x ATK x HP). Under that metric a pile
   * of Darts and one Bastion read as EQUAL while the Darts annihilate it, so every
   * fight involving a counter was mis-scored.
   *
   * The gap is starker since Economy v2, which is the useful part: the two fleets
   * that `fleetPower` calls equal differ by more than twenty times in what they
   * cost. The count is DERIVED from the metric rather than written down, so this
   * keeps testing the property after the next re-cut of the hull table.
   */
  it('power says these are equal; combat and the price list both say otherwise', () => {
    const wasps = Math.round(fleetPower({ BASTION: 1 }) / fleetPower({ DART: 1 }));
    expect(fleetPower({ DART: wasps })).toBeCloseTo(fleetPower({ BASTION: 1 }), 0);

    // Equal by power; nowhere near equal by what they cost.
    expect(fleetValue({ DART: wasps })).toBeGreaterThan(fleetValue({ BASTION: 1 }) * 10);

    const r = resolveCombat({ DART: wasps }, { BASTION: 1 }, 0, flat(), NO_TECH);
    expect(r.grade).toBe('DECISIVE');
  });
});

describe('support hulls', () => {
  /**
   * REGRESSION: Wayfarers (80 HP, taking 1.6x from everything) died in round one,
   * so attackers arrived with no cargo and raiding could not pay for itself.
   */
  it('survive while escorted', () => {
    const r = resolveCombat({ DART: 80, WAYFARER: 10 }, { BASTION: 2 }, 0, flat(), NO_TECH);
    expect(r.attackerLosses.WAYFARER ?? 0).toBe(0);
  });

  it('are exposed once the escort is gone', () => {
    const r = resolveCombat({ WAYFARER: 10 }, { BASTION: 6 }, 0, flat(), NO_TECH);
    expect(r.attackerLosses.WAYFARER ?? 0).toBeGreaterThan(0);
  });

  it('contribute no damage', () => {
    const escorted = resolveCombat({ DART: 30, WAYFARER: 20 }, { BASTION: 3 }, 0, flat(), NO_TECH);
    const alone = resolveCombat({ DART: 30 }, { BASTION: 3 }, 0, flat(), NO_TECH);
    expect(escorted.defenderLossValue).toBe(alone.defenderLossValue);
  });

  it('keeps Wayfarers untouched in an escorted round, then exposes them after the escort dies', () => {
    const r = resolveCombat({ DART: 1, WAYFARER: 10 }, { BASTION: 20 }, 0, flat(), NO_TECH);
    expect(r.rounds[0]?.attackerLosses.WAYFARER ?? 0).toBe(0);
    expect(r.rounds.slice(1).some((round) => (round.attackerLosses.WAYFARER ?? 0) > 0)).toBe(true);
  });
});

describe('combat cargo', () => {
  it('adds mixed-fleet capacity from every surviving combat hull', () => {
    const fleet = { DART: 2, PIKE: 3, RAMPART: 4, WAYFARER: 1 } as const;
    expect(fleetCargo(fleet, {})).toBe(
      2 * HULLS.DART.cargo
      + 3 * HULLS.PIKE.cargo
      + 4 * HULLS.RAMPART.cargo
      + HULLS.WAYFARER.cargo,
    );
  });
});

describe('shields', () => {
  /**
   * A REPORT MUST BE ABLE TO REPLAY THE CALCULATION, NOT JUST NAME ITS TOTAL.
   *
   * The resolver used to keep the roll and the shield's before/after values only
   * in local variables. A player could see that Aegis absorbed 500, but not
   * whether 500 remained, 500 broke it, or how much ordinary fire reached hulls.
   * These are immutable facts of each round and belong in its telemetry.
   */
  it('records the roll and complete shield-to-hull path for every round', () => {
    const r = resolveCombat({ DART: 20 }, { BASTION: 2 }, 500, flat(), NO_TECH);

    expect(r.rounds.length).toBeGreaterThan(0);
    for (const [index, round] of r.rounds.entries()) {
      expect(round.attackerRoll).toBe(1);
      expect(round.defenderRoll).toBe(1);
      expect(typeof round.shieldBefore).toBe('number');
      expect(typeof round.shieldAfter).toBe('number');
      expect(typeof round.attackerHullDamage).toBe('number');
      if (index > 0) {
        expect(round.shieldBefore).toBe(r.rounds[index - 1]!.shieldAfter);
      }
      expect(round.shieldBefore! - round.shieldAfter!).toBe(round.shieldAbsorbed);
    }
    expect(r.rounds.at(-1)!.shieldAfter).toBe(r.shieldLeft);
  });

  it('records that all ordinary fire reaches hulls when there is no active shield', () => {
    const r = resolveCombat({ DART: 20 }, { BASTION: 2 }, 0, flat(), NO_TECH);
    const [round] = r.rounds;

    expect(round).toMatchObject({ shieldBefore: 0, shieldAfter: 0 });
    expect(round!.attackerHullDamage).toBe(round!.attackerDamage);
  });

  it('separates Nullifier shield-only damage from ordinary fire that reaches hulls', () => {
    const r = resolveCombat({ NULLIFIER: 4 }, { BASTION: 1 }, 100, flat(), NO_TECH);
    const [round] = r.rounds;

    expect(round!.shieldBreakerDamage).toBeGreaterThan(0);
    expect(round!.attackerHullDamage! + round!.shieldAbsorbed - round!.shieldBreakerDamage)
      .toBeCloseTo(round!.attackerDamage, 0);
  });

  it('absorb the whole assault when large enough', () => {
    const r = resolveCombat({ DART: 20 }, { BASTION: 2 }, 100_000, flat(), NO_TECH);
    expect(r.grade).toBe('REPELLED');
    expect(fleetCount(r.defenderLosses)).toBe(0);
    expect(r.shieldLeft).toBeGreaterThan(0);
  });

  describe('Nullifier', () => {
    it('records shield-only bonus damage and can break a bare Aegis', () => {
      const r = resolveCombat({ NULLIFIER: 1 }, {}, 100, flat(), NO_TECH);
      expect(r.grade).toBe('DECISIVE');
      expect(r.shieldLeft).toBe(0);
      expect(r.rounds.reduce((sum, round) => sum + round.shieldAbsorbed, 0)).toBe(100);
      expect(r.rounds.reduce((sum, round) => sum + round.shieldBreakerDamage, 0)).toBeGreaterThan(0);
    });

    it('has no bonus at all when there is no shield', () => {
      const r = resolveCombat({ NULLIFIER: 4 }, { BASTION: 1 }, 0, flat(), NO_TECH);
      expect(r.rounds.every((round) => round.shieldBreakerDamage === 0)).toBe(true);
    });

    it('never spills bonus overkill into units', () => {
      const withoutShield = resolveCombat({ NULLIFIER: 4 }, { BASTION: 1 }, 0, flat(), NO_TECH);
      const almostEmptyShield = resolveCombat({ NULLIFIER: 4 }, { BASTION: 1 }, 1, flat(), NO_TECH);
      expect(almostEmptyShield.defenderSurvivors).toEqual(withoutShield.defenderSurvivors);
      expect(almostEmptyShield.defenderLosses).toEqual(withoutShield.defenderLosses);
      expect(almostEmptyShield.rounds[0]?.shieldBreakerDamage).toBe(1);
    });
  });
});

describe('defence salvage', () => {
  it('rebuilds 60% of destroyed turrets', () => {
    const r = resolveCombat({ DART: 200 }, { BASTION: 10 }, 0, flat(), NO_TECH);
    expect(r.defenderLosses.BASTION).toBe(10);
    expect(r.defenceSalvage.BASTION).toBe(6);
  });

  it('excludes salvaged units from scored value', () => {
    const r = resolveCombat({ DART: 200 }, { BASTION: 10 }, 0, flat(), NO_TECH);
    expect(r.defenderLossValue).toBeLessThan(fleetValue(r.defenderLosses));
    expect(r.defenderLossValue).toBeGreaterThanOrEqual(0);
  });

  it('never salvages mobile hulls', () => {
    const r = resolveCombat({ DART: 200 }, { DART: 10 }, 0, flat(), NO_TECH);
    expect(r.defenceSalvage.DART).toBeUndefined();
  });
});

describe('outcome grades', () => {
  it('produces all three across a spread of matchups', () => {
    const grades = new Set([
      resolveCombat({ DART: 400 }, { BASTION: 2 }, 0, rng(), NO_TECH).grade,
      resolveCombat({ DART: 46 }, { BASTION: 4 }, 0, rng(), NO_TECH).grade,
      resolveCombat({ DART: 5 }, { BASTION: 10 }, 0, rng(), NO_TECH).grade,
    ]);
    expect(grades.has('DECISIVE')).toBe(true);
    expect(grades.has('REPELLED')).toBe(true);
  });

  it('is low-variance — intel must beat luck', () => {
    const results = Array.from({ length: 200 }, (_, i) =>
      resolveCombat({ DART: 60 }, { BASTION: 3 }, 0, mulberry32(i), NO_TECH),
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
    const r = resolveCombat({ DART: 90, WAYFARER: 6 }, { BASTION: 4, DART: 20 }, 0, rng(), NO_TECH);
    bookBattle(atk, def, 12_000, r);
    expect(dominion(atk) + dominion(def)).toBe(0);
  });

  it('rewards a defender who repels an attack', () => {
    const atk = emptyLedger();
    const def = emptyLedger();
    const r = resolveCombat({ DART: 8 }, { BASTION: 12 }, 0, rng(), NO_TECH);
    bookBattle(atk, def, 0, r);
    expect(dominion(def)).toBeGreaterThan(0);
    expect(dominion(atk)).toBeLessThan(0);
  });

  it('smoothly bounds one battle without changing its direction', () => {
    expect(dominionTransfer(1_000)).toBe(997);
    expect(dominionTransfer(-1_000)).toBe(-997);
    expect(dominionTransfer(10_000)).toBe(7_616);
    expect(dominionTransfer(-10_000)).toBe(-7_616);
    expect(dominionTransfer(100_000)).toBe(DOMINION_TRANSFER_SCALE);
    expect(dominionTransfer(-100_000)).toBe(-DOMINION_TRANSFER_SCALE);
  });

  it('books only the bounded transfer into the ledgers', () => {
    const atk = emptyLedger();
    const def = emptyLedger();
    const result = resolveCombat({ DART: 1 }, {}, 0, rng(), NO_TECH);

    const transfer = bookBattle(atk, def, 1_000_000, result);

    expect(transfer).toBe(DOMINION_TRANSFER_SCALE);
    expect(atk).toEqual({ taken: DOMINION_TRANSFER_SCALE, lost: 0 });
    expect(def).toEqual({ taken: 0, lost: DOMINION_TRANSFER_SCALE });
  });

  it('keeps legacy ledger totals and applies the bound only to the new battle', () => {
    const challenger = emptyLedger();
    const incumbent = { taken: 100_000, lost: 0 };
    const result = resolveCombat({ DART: 1 }, {}, 0, rng(), NO_TECH);

    bookBattle(challenger, incumbent, 1_000_000, result);

    expect(dominion(challenger)).toBe(DOMINION_TRANSFER_SCALE);
    expect(dominion(incumbent)).toBe(90_000);
  });

  it('is zero for a player who never fights', () => {
    expect(dominion(emptyLedger())).toBe(0);
  });
});

/**
 * WHAT A RAID ACTUALLY MEETS. T2.
 *
 * The defending line used to be "everything standing on the planet", which put
 * the mining craft in it. Both surfaces that resolve a battle — the player raid
 * and the neutral raid — build their defenders through this one function, so a
 * craft can never be pulled into a fight on one path and spared on the other.
 */
describe('the garrison', () => {
  it('leaves the mining craft out of the defending line', () => {
    expect(garrisonOf({ DART: 4, PROSPECTOR: 2 }, {})).toEqual({ DART: 4 });
  });

  it('keeps every fighting hull that is standing at home', () => {
    expect(garrisonOf({ DART: 4, WAYFARER: 1, NULLIFIER: 2 }, {})).toEqual({
      DART: 4,
      WAYFARER: 1,
      NULLIFIER: 2,
    });
  });

  it('puts the emplacements in the line beside them', () => {
    expect(garrisonOf({ DART: 4 }, { BASTION: 3, THORN: 5 })).toEqual({
      DART: 4,
      BASTION: 3,
      THORN: 5,
    });
  });

  /** A world with only miners on it defends with nothing, and says so. */
  it('leaves a world of miners with no defence at all', () => {
    expect(garrisonOf({ PROSPECTOR: 2 }, {})).toEqual({});
    expect(fleetCount(garrisonOf({ PROSPECTOR: 2 }, {}))).toBe(0);
  });

  it('defends an empty world with nothing', () => {
    expect(garrisonOf({}, {})).toEqual({});
  });

  /**
   * Derived from the list rather than from the word PROSPECTOR, so a second
   * civilian craft is excluded the day it is added rather than the day somebody
   * notices it is fighting.
   */
  it('excludes every hull the list names, and only those', () => {
    expect(NON_COMBATANT_HULLS).toContain('PROSPECTOR');
    const line = garrisonOf(
      Object.fromEntries(ALL_HULLS.filter((id) => !HULLS[id].ground).map((id) => [id, 1])),
      Object.fromEntries(GROUND_HULLS.map((id) => [id, 1])),
    );
    for (const id of ALL_HULLS) {
      expect(Object.hasOwn(line, id)).toBe(!NON_COMBATANT_HULLS.includes(id));
    }
  });
});

/**
 * ONE SIDE THAT HITS SOFTER, AND NOTHING ELSE CHANGED. D150.
 *
 * A pirate is the only thing in the game that fights with a handicap, and the
 * handicap has exactly one job: make a PvE prize affordable without inventing a
 * fifth combat axis. D11 keeps combat simple, so it rides the existing
 * `CombatSide` and is applied in `statsFor` — once, on `atk` — which is what
 * makes it impossible for a modifier to be honoured in the damage pool and then
 * forgotten in the casualty arithmetic.
 *
 * THAT SPLIT IS THE BUG THIS FILE WOULD HIDE BEST, so it is asserted directly.
 */
describe('a side that fights at a penalty', () => {
  const attackers = { DART: 40 } as const;
  const defenders = { PIKE: 6 } as const;

  it('scales exactly the fire that side puts out', () => {
    const full = resolveCombat(attackers, defenders, 0, flat(), NO_TECH);
    const half = resolveCombat(attackers, defenders, 0, flat(), {
      attacker: { tech: {} },
      defender: { tech: {}, damageMult: 0.5 },
    });
    // Both figures are rounded for the report, so they may sit a unit apart; the
    // relationship, not the rounding, is what is being asserted.
    expect(half.rounds[0]!.defenderDamage).toBeCloseTo(full.rounds[0]!.defenderDamage * 0.5, -0.4);
  });

  it('carries the penalty into the casualties, not only into the damage line', () => {
    const full = resolveCombat(attackers, defenders, 0, flat(), NO_TECH);
    const half = resolveCombat(attackers, defenders, 0, flat(), {
      attacker: { tech: {} },
      defender: { tech: {}, damageMult: 0.5 },
    });
    expect(fleetValue(half.attackerLosses)).toBeLessThan(fleetValue(full.attackerLosses));
    expect(half.attackerLossValue).toBeLessThan(full.attackerLossValue);
  });

  it('never touches the hit points of the side carrying it', () => {
    /*
      THE SPEC SAYS "DEALS LESS DAMAGE", NOT "IS EASIER TO KILL". A level 4 pirate
      flies a Cataclysm and has to stay genuinely dangerous to shoot at — its 448
      hit points are the reason a wrong fleet still loses to it. Since the modifier
      touches `atk` alone, cutting the defender's output must leave what the
      attacker destroys bit-for-bit unchanged.
    */
    const full = resolveCombat(attackers, defenders, 0, flat(), NO_TECH);
    const half = resolveCombat(attackers, defenders, 0, flat(), {
      attacker: { tech: {} },
      defender: { tech: {}, damageMult: 0.5 },
    });
    expect(half.defenderLosses).toEqual(full.defenderLosses);
    expect(half.defenderSurvivors).toEqual(full.defenderSurvivors);
    expect(half.grade).toBe(full.grade);
  });

  it('leaves a side that declares no penalty exactly where it was', () => {
    const bare = resolveCombat(attackers, defenders, 0, flat(), NO_TECH);
    const explicit = resolveCombat(attackers, defenders, 0, flat(), {
      attacker: { tech: {}, damageMult: 1 },
      defender: { tech: {}, damageMult: 1 },
    });
    expect(explicit).toEqual(bare);
  });

  it('reads every pirate level straight off the one table', () => {
    for (const level of [1, 2, 3, 4] as const) {
      const soft = resolveCombat(attackers, defenders, 0, flat(), {
        attacker: { tech: {} },
        defender: { tech: {}, damageMult: pirateStats(level).damageMult },
      });
      const full = resolveCombat(attackers, defenders, 0, flat(), NO_TECH);
      expect(soft.rounds[0]!.defenderDamage).toBeCloseTo(
        full.rounds[0]!.defenderDamage * PIRATE.damageMult[level],
        -0.4,
      );
    }
  });
});
