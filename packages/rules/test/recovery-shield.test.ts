import { describe, expect, it } from 'vitest';
import {
  ABUSE,
  COMBAT,
  computeLoot,
  earnsRecoveryShield,
  effectiveAttackProtection,
  extendRecoveryShield,
  newcomerShieldUntil,
  raidableStock,
  recoveryShieldRelativeLoss,
  recoveryShieldUntil,
} from '../src/index.js';

/**
 * THE SHIELD A HEAVY DEFEAT BUYS. Owner instruction, 2026-09-14.
 *
 * *"Ağır bir PvP kaybından sonra 4 saatlik saldırı koruması ver; korunan oyuncu
 * başka bir oyuncuya saldırmayı seçerse korumayı kaldır."* The pure half of that
 * lives here: what counts as heavy, how long the window is, and how it composes
 * with the first-day shield. Everything about launches, locks and who is actually
 * attacking is the server's, and `apps/server/test/recovery-shield.test.ts` holds it.
 */

const HOUR = 3_600_000;
const NOW = Date.UTC(2026, 8, 14, 12, 0, 0);

describe('what counts as a heavy defeat', () => {
  /** A commander whose stores would hold this much in total, across every world. */
  const STORAGE = 200_000;
  /** A twentieth of it — the material floor the relative test sits on top of. */
  const FLOOR = STORAGE / ABUSE.recoveryStorageMultiple;

  it('states the two thresholds as whole multiples, so no boundary is a float', () => {
    expect(ABUSE.recoveryShieldHours).toBe(4);
    expect(ABUSE.recoveryRaidableMultiple).toBe(2);
    expect(ABUSE.recoveryStorageMultiple).toBe(20);
  });

  it('grants at exactly half of what was raidable, and refuses a unit below it', () => {
    const raidableBefore = 40_000;
    const half = raidableBefore / 2;
    expect(half).toBeGreaterThan(FLOOR);
    expect(earnsRecoveryShield({ raidableBefore, lootLost: half, storageCapacity: STORAGE }))
      .toBe(true);
    expect(earnsRecoveryShield({ raidableBefore, lootLost: half - 1, storageCapacity: STORAGE }))
      .toBe(false);
  });

  it('refuses a proportionally huge loss that is materially trivial', () => {
    // A deliberately empty colony: everything it held was taken, and it held nothing.
    expect(earnsRecoveryShield({
      raidableBefore: 2,
      lootLost: 2,
      storageCapacity: STORAGE,
    })).toBe(false);
  });

  it('grants at exactly a twentieth of total storage, and refuses a unit below it', () => {
    // Loss is total, so the relative test is satisfied at any raidable figure.
    expect(earnsRecoveryShield({
      raidableBefore: FLOOR,
      lootLost: FLOOR,
      storageCapacity: STORAGE,
    })).toBe(true);
    expect(earnsRecoveryShield({
      raidableBefore: FLOOR - 1,
      lootLost: FLOOR - 1,
      storageCapacity: STORAGE,
    })).toBe(false);
  });

  it('refuses a battle that took nothing, and one there was nothing to take from', () => {
    expect(earnsRecoveryShield({ raidableBefore: 50_000, lootLost: 0, storageCapacity: STORAGE }))
      .toBe(false);
    expect(earnsRecoveryShield({ raidableBefore: 0, lootLost: 0, storageCapacity: STORAGE }))
      .toBe(false);
    // A commander with no stores at all cannot clear a floor of zero by losing zero.
    expect(earnsRecoveryShield({ raidableBefore: 0, lootLost: 0, storageCapacity: 0 }))
      .toBe(false);
  });

  it('refuses nonsense rather than rounding it into a grant', () => {
    for (const input of [
      { raidableBefore: Number.NaN, lootLost: 10_000, storageCapacity: STORAGE },
      { raidableBefore: 50_000, lootLost: Number.NaN, storageCapacity: STORAGE },
      { raidableBefore: 50_000, lootLost: 40_000, storageCapacity: Number.NaN },
      { raidableBefore: -1, lootLost: 40_000, storageCapacity: STORAGE },
      { raidableBefore: 50_000, lootLost: -1, storageCapacity: STORAGE },
      { raidableBefore: Infinity, lootLost: Infinity, storageCapacity: STORAGE },
    ]) {
      expect(earnsRecoveryShield(input), JSON.stringify(input)).toBe(false);
    }
  });

  /**
   * THE PRE-FILTER MAY NEVER BE MISTAKEN FOR THE RULE.
   *
   * The server asks `recoveryShieldRelativeLoss` on its own before it pays for a
   * storage sweep, so the one thing that must stay true is that passing it is
   * NECESSARY and never SUFFICIENT: anything the full rule grants, the pre-filter
   * also passes, and the pre-filter alone can still be refused by the floor.
   */
  it('gates the full rule without ever standing in for it', () => {
    const cases = [
      { raidableBefore: 40_000, lootLost: 20_000 },
      { raidableBefore: 40_000, lootLost: 19_999 },
      { raidableBefore: 2, lootLost: 2 },
      { raidableBefore: 0, lootLost: 0 },
      { raidableBefore: 50_000, lootLost: 0 },
      { raidableBefore: Number.NaN, lootLost: 10 },
    ];
    for (const probe of cases) {
      const full = earnsRecoveryShield({ ...probe, storageCapacity: STORAGE });
      const gate = recoveryShieldRelativeLoss(probe.raidableBefore, probe.lootLost);
      if (full) expect(gate, JSON.stringify(probe)).toBe(true);
    }
    // And the case that proves it is not sufficient: everything taken, nothing lost.
    expect(recoveryShieldRelativeLoss(2, 2)).toBe(true);
    expect(earnsRecoveryShield({ raidableBefore: 2, lootLost: 2, storageCapacity: STORAGE }))
      .toBe(false);
  });

  /**
   * THE PARTIAL BOUNDARY, PINNED RATHER THAN LEFT TO ARITHMETIC.
   *
   * `raidableBefore` is quoted at DECISIVE — the ceiling a probe shows — and a
   * PARTIAL grade takes half of that share (35% against 70%). So a PARTIAL result
   * with cargo enough for all of it lands on the threshold EXACTLY, and whether
   * that grants a shield is a real design answer rather than an accident of two
   * unrelated constants. It grants: the rule reads what the defender actually lost,
   * never the label the battle was given.
   */
  it('grants on a cargo-sufficient PARTIAL, which sits exactly on the half', () => {
    expect(COMBAT.lootPartial / COMBAT.lootDecisive).toBeCloseTo(0.5, 12);
    const stock = { alloy: 120_000, crystal: 80_000, deuterium: 6_000 };
    const buffer = { alloy: 0, crystal: 0, deuterium: 0 };
    const floor = { alloy: 0, crystal: 0, deuterium: 0 };
    const raidableBefore = raidableStock(stock, buffer, floor, 'DECISIVE');
    const partial = computeLoot(stock, buffer, floor, 'PARTIAL', Number.MAX_SAFE_INTEGER);
    const lootLost = partial.alloy + partial.crystal + partial.deuterium;

    expect(2 * lootLost).toBeGreaterThanOrEqual(raidableBefore);
    expect(earnsRecoveryShield({ raidableBefore, lootLost, storageCapacity: 1_000_000 }))
      .toBe(true);
    // Cargo-limited is decided on the real haul, so half a PARTIAL is not enough.
    const limited = computeLoot(stock, buffer, floor, 'PARTIAL', lootLost / 2);
    expect(earnsRecoveryShield({
      raidableBefore,
      lootLost: limited.alloy + limited.crystal + limited.deuterium,
      storageCapacity: 1_000_000,
    })).toBe(false);
  });
});

describe('the recovery window', () => {
  it('runs four hours from the instant the battle resolved', () => {
    expect(recoveryShieldUntil(NOW)).toBe(NOW + 4 * HOUR);
  });

  it('extends to the later end rather than adding a second window', () => {
    const first = recoveryShieldUntil(NOW);
    // A second heavy defeat an hour later pushes the end out, and only by the gap.
    expect(extendRecoveryShield(first, NOW + HOUR)).toBe(NOW + 5 * HOUR);
    // One three hours after it lands inside a window that already reaches further.
    expect(extendRecoveryShield(NOW + 9 * HOUR, NOW)).toBe(NOW + 9 * HOUR);
    expect(extendRecoveryShield(null, NOW)).toBe(NOW + 4 * HOUR);
    expect(extendRecoveryShield(Number.NaN, NOW)).toBe(NOW + 4 * HOUR);
  });
});

describe('the two protections, read as one', () => {
  const newcomer = newcomerShieldUntil(NOW);
  const recovery = recoveryShieldUntil(NOW);

  it('is nothing at all when neither column holds a future instant', () => {
    expect(effectiveAttackProtection(null, null, NOW)).toBeNull();
    expect(effectiveAttackProtection(NOW - 1, NOW - 1, NOW)).toBeNull();
    expect(effectiveAttackProtection(undefined, undefined, NOW)).toBeNull();
    expect(effectiveAttackProtection(Number.NaN, Number.NaN, NOW)).toBeNull();
    // The boundary belongs to the galaxy: at the instant it expires, it is gone.
    expect(effectiveAttackProtection(NOW, NOW, NOW)).toBeNull();
  });

  it('answers whichever of the two reaches further', () => {
    expect(effectiveAttackProtection(newcomer, null, NOW))
      .toEqual({ kind: 'NEWCOMER', until: newcomer });
    expect(effectiveAttackProtection(null, recovery, NOW))
      .toEqual({ kind: 'RECOVERY', until: recovery });
    // The first day outlasts a four-hour recovery, so it is the one named.
    expect(effectiveAttackProtection(newcomer, recovery, NOW))
      .toEqual({ kind: 'NEWCOMER', until: newcomer });
    // …and a recovery stamped later than a nearly-spent first day wins instead.
    expect(effectiveAttackProtection(NOW + HOUR, recovery, NOW))
      .toEqual({ kind: 'RECOVERY', until: recovery });
  });

  it('ignores an expired column even when the other is live', () => {
    expect(effectiveAttackProtection(NOW - HOUR, recovery, NOW))
      .toEqual({ kind: 'RECOVERY', until: recovery });
    expect(effectiveAttackProtection(newcomer, NOW - HOUR, NOW))
      .toEqual({ kind: 'NEWCOMER', until: newcomer });
  });

  it('names the first-day shield on an exact tie, because it never comes back', () => {
    expect(effectiveAttackProtection(newcomer, newcomer, NOW))
      .toEqual({ kind: 'NEWCOMER', until: newcomer });
  });
});
