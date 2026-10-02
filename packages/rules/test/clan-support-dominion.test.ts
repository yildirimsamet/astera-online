import { describe, expect, it } from 'vitest';
import {
  CLAN_SUPPORT,
  adjustDefendedDominion,
  adjustJointDominion,
  combatValue,
  defendedTransfer,
  factorValue,
  mulberry32,
  supportFactor,
} from '../src/index.js';

/**
 * KLAN SAVUNMA DESTEĞİ — the ladder (`docs/clan-defense-support-plan.md`, P3).
 */

/** The rule as it stood before defence support: scale only when the attackers are the many. */
function oracle(base: number, attackers: number, defenders: number): number {
  if (base === 0 || attackers <= defenders) return base;
  const exact = base > 0
    ? (BigInt(base) * BigInt(defenders)) / BigInt(attackers)
    : (BigInt(base) * BigInt(attackers)) / BigInt(defenders);
  return Number(exact);
}

describe('adjustJointDominion — the head-count rule now works both ways', () => {
  it('moves no existing result: every A ≥ D case is the old rule exactly', () => {
    const random = mulberry32(4242);
    for (let n = 0; n < 2_000; n++) {
      const base = Math.round((random() - 0.5) * 2_000_000);
      const defenders = 1 + Math.floor(random() * 3);
      const attackers = defenders + Math.floor(random() * 8);
      expect(adjustJointDominion(base, attackers, defenders)).toBe(oracle(base, attackers, defenders));
    }
  });

  it('pays a lone raider who beats an outnumbering line more, and discounts the line’s win', () => {
    // 1 attacker against host + 2 supporters.
    expect(adjustJointDominion(900, 1, 3)).toBe(2_700);
    expect(adjustJointDominion(-900, 1, 3)).toBe(-300);
    expect(adjustJointDominion(-1_000, 1, 3)).toBe(-333); // toward zero
    expect(adjustJointDominion(1_000, 2, 3)).toBe(1_500);
    expect(adjustJointDominion(-1_001, 2, 3)).toBe(-667);
    expect(adjustJointDominion(0, 1, 5)).toBe(0);
  });

  it('refuses an amplified transfer that leaves the safe range instead of wrapping', () => {
    expect(() => adjustJointDominion(Number.MAX_SAFE_INTEGER, 1, 5)).toThrow(RangeError);
  });
});

/*
  OWNER DECISION, 2026-10-02 — replaces the quarter share and the supporter head count.
  Only the host’s Dominion moves; the support multiplies it by line power ÷ host power,
  at most ×5: a host who loses loses ×D, a host who wins gains ÷D.
*/
describe('supportFactor — line power over the host’s own, at most ×5', () => {
  const factor = (hostPower: number, supportPower: number) => supportFactor({ hostPower, supportPower });

  it('reads the owner’s three cases off one ratio', () => {
    expect(factorValue(factor(1_000, 200))).toBeCloseTo(1.2);   // a little support
    expect(factorValue(factor(1_000, 1_000))).toBe(2);         // as much as the host
    expect(factorValue(factor(1_000, 3_000))).toBe(4);         // three times the host
  });

  it('leaves the battle unmultiplied when the support brought nothing that fires', () => {
    expect(factorValue(factor(1_000, 0))).toBe(1);
    expect(factorValue(factor(0, 0))).toBe(1);
  });

  it('stops at ×5 — and a host with nothing of its own is at the ceiling', () => {
    expect(factorValue(factor(1_000, 4_000))).toBe(5);
    expect(factorValue(factor(1_000, 40_000))).toBe(5);
    expect(factorValue(factor(0, 1))).toBe(5);
    expect(CLAN_SUPPORT.maxDominionFactor).toBe(5);
  });

  it('never shrinks as the support grows', () => {
    let previous = 1;
    for (let support = 0; support <= 6_000; support += 37) {
      const value = factorValue(factor(1_000, support));
      expect(value).toBeGreaterThanOrEqual(previous);
      previous = value;
    }
  });

  it('refuses powers that are not whole, non-negative units', () => {
    expect(() => factor(-1, 10)).toThrow(RangeError);
    expect(() => factor(10, 0.5)).toThrow(RangeError);
    expect(() => factor(Number.MAX_SAFE_INTEGER + 2, 1)).toThrow(RangeError);
  });
});

describe('adjustDefendedDominion — the host loses ×D and gains ÷D', () => {
  const D = (hostPower: number, supportPower: number) => supportFactor({ hostPower, supportPower });

  it('multiplies the raider’s win — the host’s loss — by D', () => {
    expect(adjustDefendedDominion(1_000, 1, D(1_000, 200))).toBe(1_200);
    expect(adjustDefendedDominion(1_000, 1, D(1_000, 1_000))).toBe(2_000);
    expect(adjustDefendedDominion(1_000, 1, D(0, 500))).toBe(5_000);
  });

  it('divides the line’s win — the host’s gain — by D, toward zero', () => {
    expect(adjustDefendedDominion(-1_000, 1, D(1_000, 200))).toBe(-833);
    expect(adjustDefendedDominion(-1_000, 1, D(1_000, 1_000))).toBe(-500);
    expect(adjustDefendedDominion(-1_000, 1, D(1_000, 9_000))).toBe(-200);
  });

  it('is the ordinary battle with no power in the support', () => {
    expect(adjustDefendedDominion(777, 1, D(1_000, 0))).toBe(777);
    expect(adjustDefendedDominion(-777, 1, D(1_000, 0))).toBe(-777);
    expect(adjustDefendedDominion(0, 1, D(0, 9))).toBe(0);
  });

  it('sets a joint war’s head count against the factor', () => {
    expect(adjustDefendedDominion(900, 3, D(1_000, 1_000))).toBe(600);
    expect(adjustDefendedDominion(-900, 3, D(1_000, 1_000))).toBe(-1_350);
    expect(adjustDefendedDominion(500, 2, D(1_000, 1_000))).toBe(500);
  });

  it('agrees with the head-count rule whenever the factor is a whole number', () => {
    const random = mulberry32(2026);
    for (let n = 0; n < 2_000; n++) {
      const base = Math.round((random() - 0.5) * 2_000_000);
      const attackers = 1 + Math.floor(random() * 5);
      const whole = 1 + Math.floor(random() * 5);
      const factor = D(1_000, (whole - 1) * 1_000);
      expect(adjustDefendedDominion(base, attackers, factor)).toBe(adjustJointDominion(base, attackers, whole));
    }
  });

  it('never gives a host who lost less, nor one who won more, as the support grows', () => {
    const random = mulberry32(7);
    for (let n = 0; n < 500; n++) {
      const base = 1 + Math.floor(random() * 1_000_000);
      const host = 1 + Math.floor(random() * 50_000);
      const less = Math.floor(random() * 50_000);
      const more = less + Math.floor(random() * 50_000);
      expect(adjustDefendedDominion(base, 1, D(host, more))).toBeGreaterThanOrEqual(adjustDefendedDominion(base, 1, D(host, less)));
      expect(adjustDefendedDominion(-base, 1, D(host, more))).toBeGreaterThanOrEqual(adjustDefendedDominion(-base, 1, D(host, less)));
    }
  });

  it('refuses an amplified transfer that leaves the safe range instead of wrapping', () => {
    expect(() => adjustDefendedDominion(Number.MAX_SAFE_INTEGER, 1, D(0, 1))).toThrow(RangeError);
    expect(() => adjustDefendedDominion(0.5, 1, D(1, 1))).toThrow(RangeError);
    expect(() => adjustDefendedDominion(10, 0, D(1, 1))).toThrow(RangeError);
  });

  it('measures power in whole units, so the factor stays exact', () => {
    expect(Number.isInteger(combatValue({ TALON: 3, PIKE: 7, BASTION: 2 }))).toBe(true);
  });
});

/*
  OWNER DECISION (b), 2026-10-02: the factor multiplies only the host's own fight; the
  supporters' lost ships are written at their value, never multiplied and never discounted.
*/
describe('defendedTransfer — the host’s own fight ×D, the supporters’ losses at face value', () => {
  const D = (hostPower: number, supportPower: number) => supportFactor({ hostPower, supportPower });

  it('pays the worked examples the owner approved', () => {
    // A weak host crushed: own fight 15k (10k ships + 5k loot), a 40k wave destroyed, D = 5.
    expect(defendedTransfer(55_000, 40_000, 1, D(0, 1))).toBe(115_000);
    // Equal support, the line broke: own fight 9k, the wave lost 10k, D = 2.
    expect(defendedTransfer(19_000, 10_000, 1, D(1_000, 1_000))).toBe(28_000);
    // The line held: own fight −28k, the wave lost 3k, D = 2 — the host gains 11k.
    expect(defendedTransfer(-25_000, 3_000, 1, D(1_000, 1_000))).toBe(-11_000);
  });

  it('never multiplies a supporter’s loss: each ship lost moves the transfer by its value, once', () => {
    const random = mulberry32(31);
    for (let n = 0; n < 1_000; n++) {
      const own = Math.round((random() - 0.5) * 1_000_000);
      const less = Math.floor(random() * 200_000);
      const more = less + Math.floor(random() * 200_000);
      const factor = D(1 + Math.floor(random() * 50_000), Math.floor(random() * 200_000));
      const attackers = 1 + Math.floor(random() * 4);
      expect(defendedTransfer(own + more, more, attackers, factor) - defendedTransfer(own + less, less, attackers, factor))
        .toBe(more - less);
    }
  });

  it('is the head-count-and-factor rule on the host’s own fight when no supporter lost a ship', () => {
    const factor = D(1_000, 600);
    for (const base of [-77_777, -1, 0, 1, 12_345]) {
      expect(defendedTransfer(base, 0, 1, factor)).toBe(adjustDefendedDominion(base, 1, factor));
      expect(defendedTransfer(base, 0, 3, factor)).toBe(adjustDefendedDominion(base, 3, factor));
    }
  });

  it('is the ordinary battle when the support brought nothing that fires, whatever it lost', () => {
    expect(defendedTransfer(4_000, 2_500, 1, D(1_000, 0))).toBe(4_000);
    expect(defendedTransfer(-4_000, 2_500, 1, D(1_000, 0))).toBe(-4_000);
  });

  it('gives a host less than the old multiplied rule whenever a supporter lost ships in a lost line', () => {
    const factor = D(1_000, 3_000);
    expect(defendedTransfer(55_000, 40_000, 1, factor)).toBeLessThan(adjustDefendedDominion(55_000, 1, factor));
  });

  it('refuses a supporter loss that is not a whole, non-negative value', () => {
    expect(() => defendedTransfer(10, -1, 1, D(1, 1))).toThrow(RangeError);
    expect(() => defendedTransfer(10, 0.5, 1, D(1, 1))).toThrow(RangeError);
  });
});
