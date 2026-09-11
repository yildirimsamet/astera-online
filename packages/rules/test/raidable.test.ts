import { describe, expect, it } from 'vitest';
import {
  COMBAT,
  alloyRate,
  computeLoot,
  crystalRate,
  deuteriumRate,
  protectedHours,
  raidableStock,
  storageCap,
  storageHours,
  vaultProtects,
} from '../src/index.js';

/**
 * WHAT A RAID COULD ACTUALLY TAKE — the figure a probe was never reporting.
 *
 * Owner report: *"gezegende 50k kaynak gözüküyor ama dalıyom 300 alloy alıyorum.
 * Böyle saçmalık olmaz. Yağmalanabilir kaynak aralığını vermeli."*
 *
 * The probe reported `alloy + crystal` — the whole pile — and three separate rules
 * stand between that number and what a fleet flies home with:
 *
 *   · THE VAULT FLOOR is untouchable, and on a modest world it is most of the
 *     pile. A commander reading the total is reading mostly protected ore.
 *   · THE GRADE takes a share, never the remainder: 0.70 on DECISIVE.
 *   · THE UNCOLLECTED WORKS are exposed at only half that again, and the vault
 *     does not cover them at all (D16).
 *
 * So the reported figure and the delivered figure were never the same quantity,
 * and the gap between them is the entire complaint. This function is the one the
 * probe should be reading, and it is defined as `computeLoot` with the raider's
 * hold taken out of the question — a hold is a fact about the ATTACKER and cannot
 * belong to a reading of somebody else's world.
 */

const stock = { alloy: 50_000, crystal: 20_000, deuterium: 0 };
const buffer = { alloy: 4_000, crystal: 1_000, deuterium: 0 };
const floor = vaultProtects(6, 8, 8, 4);

describe('raidableStock', () => {
  it('is what an unlimited hold would carry away', () => {
    const loot = computeLoot(stock, buffer, floor, 'DECISIVE', Number.MAX_SAFE_INTEGER);
    expect(raidableStock(stock, buffer, floor, 'DECISIVE'))
      .toBe(loot.alloy + loot.crystal + loot.deuterium);
  });

  it('is far below the pile a probe used to report', () => {
    const reportedBefore = stock.alloy + stock.crystal;
    expect(raidableStock(stock, buffer, floor, 'DECISIVE')).toBeLessThan(reportedBefore);
  });

  /** The vault floor is untouchable, so a world under its own floor offers nothing. */
  it('is nothing when the vault covers the whole store', () => {
    const small = { alloy: 100, crystal: 100, deuterium: 0 };
    const empty = { alloy: 0, crystal: 0, deuterium: 0 };
    expect(raidableStock(small, empty, floor, 'DECISIVE')).toBe(0);
  });

  /** ...but uncollected ore is never covered by the vault (D16). */
  it('still offers the works even when the store is fully protected', () => {
    const small = { alloy: 100, crystal: 100, deuterium: 0 };
    const works = { alloy: 8_000, crystal: 0, deuterium: 0 };
    expect(raidableStock(small, works, floor, 'DECISIVE')).toBeGreaterThan(0);
  });

  it('scales with the grade, and a repel takes nothing', () => {
    const decisive = raidableStock(stock, buffer, floor, 'DECISIVE');
    const partial = raidableStock(stock, buffer, floor, 'PARTIAL');
    expect(partial).toBeLessThan(decisive);
    expect(partial / decisive).toBeCloseTo(COMBAT.lootPartial / COMBAT.lootDecisive, 2);
    expect(raidableStock(stock, buffer, floor, 'REPELLED')).toBe(0);
  });

  /**
   * THE VAULT COVERS DEUTERIUM TOO, AND IT ALWAYS SAID SO. D187.
   *
   * This test's title used to read "which the vault never covers", written when
   * `vaultProtects` returned a deuterium floor of ZERO — not as a rule about fuel,
   * but because deuterium had no passive rate to take hours of. T5 gave it one and
   * the floor appeared on its own, exactly as that function's own comment says.
   * `computeLoot` was never told: it subtracted the alloy and crystal floors and
   * exposed the whole fuel store.
   *
   * WHAT MADE IT A DEFECT RATHER THAN A CHOICE is that the figure is PUBLISHED.
   * `planetView` sends `vaultProtected.deuterium` and `PlanetHero` draws it under a
   * heading meaning "a raid cannot touch these amounts". A rule the player can SEE
   * that is not real is worse than one they cannot see at all.
   */
  it('covers deuterium by its own production floor, like the other two', () => {
    const floorD = floor.deuterium;
    expect(floorD).toBeGreaterThan(0);

    // Everything under the floor is untouchable.
    const under = { ...stock, deuterium: Math.floor(floorD / 2) };
    expect(computeLoot(under, buffer, floor, 'DECISIVE', Number.MAX_SAFE_INTEGER).deuterium)
      .toBe(0);

    // Only the overflow is exposed, at the grade's share — the alloy rule exactly.
    const over = { ...stock, deuterium: floorD + 1_000 };
    expect(computeLoot(over, buffer, floor, 'DECISIVE', Number.MAX_SAFE_INTEGER).deuterium)
      .toBe(Math.floor(1_000 * COMBAT.lootDecisive));
  });

  /** The works are the other half of D16: the vault never reaches uncollected fuel. */
  it('still exposes uncollected fuel, which the vault cannot reach', () => {
    const works = { ...buffer, deuterium: 2_000 };
    expect(computeLoot(stock, works, floor, 'DECISIVE', Number.MAX_SAFE_INTEGER).deuterium)
      .toBe(Math.floor(2_000 * COMBAT.lootDecisive * COMBAT.lootBufferShare));
  });
});

/**
 * HOW MUCH OF A FULL STORE THE VAULT COVERS. D161 — owner instruction.
 *
 * *"Yağmalanabilir miktar bir şekilde artmalı. Kasa hacmini küçültsek nasıl
 * olur?"* — and the vault is the right dial, because it is the only one that
 * moves what a raid TAKES without moving what a raid destroys. Widening the loot
 * share would have paid the attacker more for the same fight; shrinking the
 * protected floor changes what is at stake for the DEFENDER, which is the side of
 * the trade the complaint is actually about.
 *
 * STATED AS A SHARE OF A FULL STORE, at both ends of the Vault ladder, because
 * that is the quantity a player experiences: "I flew at 50k and came home with
 * 300" is a sentence about the ratio, not about either constant. The old figures
 * covered a sixth of a Vault-0 store and a QUARTER of a developed one — the vault
 * grew faster than the thing it protects, so raiding got worse as a season went on,
 * which is exactly backwards for a game whose late act is supposed to be its most
 * dangerous.
 *
 * THE HALF-A-STORE INVARIANT IS UNCHANGED and still enforced in
 * `invariants.test.ts`; this is a tighter ceiling under it, not a replacement.
 */
describe('what the vault keeps safe', () => {
  const share = (vault: number): number => protectedHours(vault) / storageHours(vault);

  it('covers well under a fifth of a full store, at every Vault level', () => {
    for (let vault = 0; vault <= 16; vault += 1) {
      expect(share(vault), `Vault ${String(vault)}`).toBeLessThan(0.18);
    }
  });

  /**
   * AND IT MAY NOT GROW FASTER THAN THE STORE. A vault that compounds ahead of
   * the stock it sits in eventually covers everything, with no other symptom than
   * raids quietly stopping being worth flying.
   */
  it('never covers more of the store as the Vault rises', () => {
    expect(share(16)).toBeLessThanOrEqual(share(0) + 0.06);
  });

  /** The same statement in ore, on a developed world with a full store. */
  it('leaves most of a developed world store on the table', () => {
    const refinery = 12;
    const vault = 10;
    const full = storageCap(alloyRate(refinery), vault);
    const floor = vaultProtects(vault, refinery, refinery, 0);
    expect(floor.alloy / full).toBeLessThan(0.18);
  });
});

/**
 * A RAID ON AN ABSENT COMMANDER MUST BRING SOMETHING HOME. D193.
 *
 * Measured before this rule existed: against a world with NO defence at all, whose
 * commander had been out of the house for a full working day, a raid carried home
 * NOTHING from Vault 11 onward — and raising the attacker's hold to twenty-four
 * thousand changed nothing, because the vault floor covered the entire absence. A
 * commander learns that in two attempts and never flies a third, which is the
 * quiet death of the whole information layer: nobody scouts for a target that
 * cannot pay.
 *
 * THE MECHANISM WAS THE FLOOR'S SHAPE, not its size. It is a share of STORAGE
 * HOURS, and storage runs from three hours to forty while a working day stays
 * eleven — so protection outgrows the absence it is supposed to leave exposed.
 * `ECON.protectedShare` at 0.15 crossed eleven hours at Vault 11, which is the
 * middle of a season.
 *
 * This is the guard, written as the player's own question: I was at work, somebody
 * came, did they get anything?
 */
describe('a working day is not fully protected', () => {
  /** The audience is out of the house from eight until seven. D188. */
  const WORKDAY = 11;

  it('leaves a working day partly exposed at every Vault level a season reaches', () => {
    for (const vault of [4, 7, 11, 14, 17, 20]) {
      expect(protectedHours(vault), `Vault ${String(vault)}`).toBeLessThan(WORKDAY);
    }
  });

  it('pays a raid on an undefended world at every stage', () => {
    const stages: [level: number, vault: number, plant: number][] = [
      [7, 7, 4], [11, 11, 6], [13, 13, 7], [15, 14, 8],
    ];
    for (const [level, vault, plant] of stages) {
      const stock = {
        alloy: alloyRate(level) * WORKDAY,
        crystal: crystalRate(level) * WORKDAY,
        deuterium: deuteriumRate(plant) * WORKDAY,
      };
      const floor = vaultProtects(vault, level, level, plant);
      const haul = raidableStock(stock, { alloy: 0, crystal: 0, deuterium: 0 }, floor, 'DECISIVE');
      expect(haul, `Core ${String(level)} / Vault ${String(vault)}`).toBeGreaterThan(0);
    }
  });

  /** And the vault still does its job: most of a full store stays out of reach. */
  it('still protects the commander who is merely asleep', () => {
    for (const vault of [7, 11, 14]) {
      expect(protectedHours(vault)).toBeGreaterThan(3);
    }
  });
});
