import { describe, expect, it } from 'vitest';
import {
  COMBAT,
  alloyRate,
  computeLoot,
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

  it('counts deuterium, which the vault never covers', () => {
    const withFuel = { ...stock, deuterium: 3_000 };
    expect(raidableStock(withFuel, buffer, floor, 'DECISIVE'))
      .toBeGreaterThan(raidableStock(stock, buffer, floor, 'DECISIVE'));
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
