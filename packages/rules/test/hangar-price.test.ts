import { describe, expect, it } from 'vitest';
import {
  BANKABILITY_MARGIN,
  HANGAR,
  HULLS,
  alloyRate,
  buildingCost,
  clanHangarCapacity,
  clanLevelUpgradeCost,
  fleetPathReference,
  hangarBankability,
  referenceFormation,
  resourceValue,
} from '../src/index.js';

/**
 * WHAT A HANGAR RUNG COSTS, AND WHY IT IS THAT. Plan §15.5b, items 2B.3–2B.5. Owner decision,
 * 2026-09-22.
 *
 * THE DEFECT, MEASURED: a rung's price as a share of the fleet it makes room for ran
 * 5% · 4% · 13% · 14% · 51% · 60% · 77% · 100% · 133%. The last rung cost a THIRD MORE than every
 * ship it could hold — and a commander's whole alloy store at that Core is 50,252 against a price
 * of 931,263, eighteen full stores. Production past a store's ceiling overflows and is lost, so
 * those rungs were not expensive. They could not be bought at all.
 *
 * THE RULE: the opening rungs keep their price — a new commander must not pay for this — and from
 * the sixth up a rung costs ONE THIRD of the formation that fills the room it adds, in that
 * formation's own resource mix.
 *
 * THE PRICE IS AUTHORED, NOT COMPUTED AT RUNTIME. 2B.3 is explicit: *"bir gövde dengesi
 * değişikliği altyapıyı sessizce yeniden fiyatlandırmasın."* A live derivation would let a hull
 * rebalance silently move every infrastructure price in the game. So the third is worked out once
 * and written down, and the test below holds the authored figure against the rule — a rebalance
 * turns it RED, which is loud, instead of quietly moving the economy.
 */
describe('what a Hangar rung costs', () => {
  const formationCost = (rung: number) => {
    const f = referenceFormation(rung);
    const id = Object.keys(f)[0] as keyof typeof HULLS;
    const n = f[id]!;
    return {
      alloy: HULLS[id].alloy * n,
      crystal: HULLS[id].crystal * n,
      deuterium: HULLS[id].deuterium * n,
    };
  };
  const share = (rung: number): number =>
    resourceValue(buildingCost('HANGAR', rung - 1)) / resourceValue(formationCost(rung));

  /** The opening is untouched: a commander learning the game pays exactly what they did. */
  it('leaves the opening rungs alone', () => {
    for (let rung = 2; rung <= HANGAR.seedTop - 1; rung++) {
      expect(share(rung), `rung ${String(rung)}`).toBeLessThan(0.2);
    }
  });

  /**
   * A THIRD, TO THE ROUNDING. Held per resource rather than in alloy-equivalent, because the
   * authored figure is meant to be the formation's own mix and a single AE total would let alloy
   * and crystal drift apart inside it.
   */
  it('prices every late rung at a third of the fleet it holds', () => {
    const top: number = HANGAR.maxLevel;
    for (let rung: number = HANGAR.seedTop; rung <= top; rung++) {
      const cost = buildingCost('HANGAR', rung - 1);
      const formation = formationCost(rung);
      for (const key of ['alloy', 'crystal'] as const) {
        expect(cost[key], `rung ${String(rung)} ${key}`)
          .toBeCloseTo(formation[key] / 3, -1);
      }
    }
  });

  /** And no rung anywhere costs more than the fleet it exists to hold. */
  it('never costs more than what it makes room for', () => {
    for (let rung = 2; rung <= HANGAR.maxLevel; rung++) {
      expect(share(rung), `rung ${String(rung)}`).toBeLessThan(1);
    }
  });

  /**
   * THE POINT OF THE EXERCISE: a commander who built the store can now buy the whole ladder.
   * Without a Vault the late rungs stay out of reach, and that is the rule this pricing states —
   * *if you have somewhere to put the ships, you need somewhere to put the ore*.
   */
  it('brings every rung inside the store of a commander who built the Vault', () => {
    for (let rung = 2; rung <= HANGAR.maxLevel; rung++) {
      const core = HANGAR.coreGate[rung]!;
      expect(hangarBankability(rung, fleetPathReference(core, core)).bankable, `rung ${String(rung)}`)
        .toBe(true);
    }
  });

  it('still leaves the late rungs out of reach without one', () => {
    const walled: number[] = [];
    for (let rung = 2; rung <= HANGAR.maxLevel; rung++) {
      if (!hangarBankability(rung, fleetPathReference(HANGAR.coreGate[rung]!)).bankable) {
        walled.push(rung);
      }
    }
    expect(walled).toEqual([6, 7, 8, 9, 10]);
  });

  it('states its margin rather than hiding one inline', () => {
    expect(BANKABILITY_MARGIN).toBe(1);
  });
});

/**
 * THE CORE-16 CLIFF STILL HAS TO BE PACED BY SOMETHING. Plan §15.5b item 2B.4.
 *
 * Five rungs — 6 through 10 — open behind ONE Core gate, tripling a world's room from 2,290 to
 * 7,270. Before this repricing they were paced only by prices so extreme that most of them could
 * not be bought; cutting those prices by 35–75% risked replacing an impossible cliff with a free
 * one. The plan's two allowed answers are to spread the gates over later Cores or to leave a
 * meaningful ramp inside the Core, and the measurement chose the second: the cluster costs 781,121
 * alloy, which is **ten days of production** at Core 16 in a thirty-day season — before a single
 * ship is built to fill the room.
 *
 * THE CLOCK PACES NOTHING HERE and that is not an oversight: `buildMinutes` is capped at
 * `BUILD.capMinutes`, so all five rungs sit at the ceiling. The ore is the pace.
 */
describe('the Core 16 cluster is still paced', () => {
  const cluster = (): number[] => {
    const rungs: number[] = [];
    for (let rung = 2; rung <= HANGAR.maxLevel; rung++) {
      if (HANGAR.coreGate[rung] === 16) rungs.push(rung);
    }
    return rungs;
  };

  it('opens five rungs behind one gate, which is the thing being paced', () => {
    expect(cluster()).toEqual([6, 7, 8, 9, 10]);
  });

  it('charges more for each rung than the one before it', () => {
    const rungs = cluster();
    for (let i = 1; i < rungs.length; i++) {
      expect(
        resourceValue(buildingCost('HANGAR', rungs[i]! - 1)),
        `rung ${String(rungs[i]!)}`,
      ).toBeGreaterThan(resourceValue(buildingCost('HANGAR', rungs[i - 1]! - 1)));
    }
  });

  /** A third of a season's alloy, at the Core that opens them. Not a free cliff. */
  it('costs a real share of the season to climb', () => {
    const alloy = cluster().reduce((sum, rung) => sum + buildingCost('HANGAR', rung - 1).alloy, 0);
    const days = alloy / alloyRate(16) / 24;
    expect(days).toBeGreaterThan(7);
    expect(days).toBeLessThan(20);
  });
});

/**
 * THE CLAN HANGAR DOES NOT RIDE THE DISCOUNT FOR FREE. Plan 2B.5, owner decision 2026-09-22.
 *
 * A clan rung buys TWICE the room and used to charge the personal invoice unchanged, so every cut
 * to the personal ladder halved the clan's price per unit of room without anybody choosing that.
 * The clan now pays twice the personal price for twice the room: the coupling is kept, the free
 * multiplier is closed, and a clan rung costs exactly what the same room costs at home.
 */
describe('what a clan Hangar rung costs', () => {
  it('charges twice the personal invoice for twice the room', () => {
    for (let level = 1; level < HANGAR.maxLevel; level++) {
      const personal = buildingCost('HANGAR', level);
      const clan = clanLevelUpgradeCost(level);
      expect(clan.alloy, `level ${String(level)}`).toBe(personal.alloy * 2);
      expect(clan.crystal, `level ${String(level)}`).toBe(personal.crystal * 2);
    }
  });

  it('leaves the room a clan rung buys exactly double, as it was', () => {
    for (let level = 1; level <= HANGAR.maxLevel; level++) {
      expect(clanHangarCapacity(level)).toBe(2 * (HANGAR.capacity[level] ?? 0));
    }
  });

  /** So a unit of clan room costs the same as a unit of personal room, at every rung. */
  it('prices a unit of clan room the same as a unit of personal room', () => {
    for (let level = 2; level < HANGAR.maxLevel; level++) {
      const personalRoom = (HANGAR.capacity[level] ?? 0) - (HANGAR.capacity[level - 1] ?? 0);
      const clanRoom = clanHangarCapacity(level) - clanHangarCapacity(level - 1);
      const personalPer = resourceValue(buildingCost('HANGAR', level - 1)) / personalRoom;
      const clanPer = resourceValue(clanLevelUpgradeCost(level - 1)) / clanRoom;
      expect(clanPer, `level ${String(level)}`).toBeCloseTo(personalPer, 6);
    }
  });
});
