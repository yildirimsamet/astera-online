import { describe, expect, it } from 'vitest';
import { honorChallenge, honorSide, type HonorSideInput } from '../src/honor.js';
import { honorTeam, type HonorTeamInput, type HonorMember } from '../src/honorTeam.js';
import { honorTacticalSide, type HonorTacticalInput } from '../src/honorTactical.js';

const facts = (over: Partial<HonorSideInput> = {}) => ({
  ownTier: 8, enemyTier: 7, ownNavy: 100_000, enemyNavy: 99_000,
  k: 50_000, enemyLoss: 50_000, l: 10_000, loot: 0, defending: false,
  weakRepeat: 0, related: false, eligible: true, retaliationFifths: 0,
  ...over,
});
const member = (id: string, tier: number, over: Partial<HonorMember> = {}): HonorMember => ({
  id, tier, navy: 100_000, weight: 100_000, civilianWeight: 0, loss: 0,
  combatLoss: 0, lootLost: 0, ...over,
});
const battle = (over: Partial<HonorTeamInput> = {}) => ({
  attack: [member('A', 8, { loss: 10_000, combatLoss: 10_000 })],
  defence: [member('D', 7, { navy: 99_000, loss: 50_000, combatLoss: 50_000 })],
  eligible: true, soloPositiveOnly: true, relations: [], ...over,
});

describe('the galaxy leader may challenge the adjacent tier as a peer', () => {
  it('changes only the downward tier classification, not military return or the tier bonus', () => {
    expect(honorChallenge(facts({ galaxyTopTier: 8 })))
      .toEqual(honorChallenge(facts({ ownTier: 7 })));
    expect(honorSide(facts({ galaxyTopTier: 8 }))).toEqual(honorSide(facts({ ownTier: 7 })));
    expect(honorSide(facts({ galaxyTopTier: 8 })).raw).toBe(44_833_333);
  });

  it.each([
    { ownTier: 7, enemyTier: 6, galaxyTopTier: 8 },
    { ownTier: 8, enemyTier: 7, galaxyTopTier: 9 },
    { ownTier: 8, enemyTier: 6, galaxyTopTier: 8 },
  ])('keeps ordinary weak sanctions outside the exact exception: %j', over => {
    expect(honorChallenge(facts(over)).kind).toBe('WEAK');
    expect(honorSide(facts(over)).raw).toBe(-13_500_000);
  });

  it('does not reinterpret a historical contract without a frozen galaxy top', () => {
    expect(honorSide(facts()).raw).toBe(-13_500_000);
  });

  it.each([0, 49_999, 50_000, 74_999, 75_000, 99_000, 100_000, 200_000])(
    'preserves equal-tier arithmetic at enemy military value %s', enemyNavy => {
      expect(honorSide(facts({ enemyNavy, galaxyTopTier: 8 })))
        .toEqual(honorSide(facts({ enemyNavy, enemyTier: 8 })));
    });

  it('preserves the upward bonus for both attacking and defending lower-tier commanders', () => {
    for (const defending of [false, true]) {
      const upward = facts({ ownTier: 7, enemyTier: 8, ownNavy: 99_000, enemyNavy: 100_000, defending });
      expect(honorSide({ ...upward, galaxyTopTier: 8 })).toEqual(honorSide(upward));
      expect(honorSide({ ...upward, galaxyTopTier: 8 }).tierNumerator).toBe(5);
    }
  });

  it.each([{ related: true }, { eligible: false }, { k: 0 }, { retaliationFifths: 1_000_000 }, { weakRepeat: 2 }])(
    'retains other equal-tier constraints: %j', over => {
      expect(honorSide(facts({ ...over, galaxyTopTier: 8 })))
        .toEqual(honorSide(facts({ ...over, enemyTier: 8 })));
    });

  it.each([0, -1, 1.5, Infinity, NaN, Number.MAX_SAFE_INTEGER + 1])('rejects invalid galaxy top %s', galaxyTopTier => {
    expect(() => honorChallenge(facts({ galaxyTopTier }))).toThrow();
  });

  it('uses the same exception in common-side military and tactical settlement', () => {
    const original = battle();
    const equal = battle({ attack: [{ ...original.attack[0]!, tier: 7 }] });
    const top = battle({ galaxyTopTier: 8 });
    expect(honorTeam(top).attack).toEqual(honorTeam(equal).attack);
    expect(honorTeam(top).defence).toEqual(honorTeam(original).defence);
    const effect = [{ actor: 'A', enemy: 'D', base: 4_000_000, pressureFifths: 160_000 }];
    expect(honorTeam({ ...top, tactical: effect }).attack)
      .toEqual(honorTeam({ ...equal, tactical: effect }).attack);
  });

  it('does not allow shared attackers to earn positive Honor', () => {
    const shared = battle({ galaxyTopTier: 8, attack: [...battle().attack, member('B', 8)] });
    expect(honorTeam(shared).attack.raw).toBe(-1_000_000);
    expect(honorTeam(shared).attack.exposures.every(row => !row.bullying && row.positive === 0)).toBe(true);
  });

  it('classifies each attacker separately in a mixed-tier joint operation', () => {
    const mixed = battle({ galaxyTopTier: 8, attack: [member('A', 8), member('B', 7)],
      defence: [member('D', 6, { navy: 99_000, loss: 1000, combatLoss: 1000 })] });
    expect(honorTeam(mixed).attack.exposures.every(row => row.bullying)).toBe(true);
  });

  it('also applies to the standalone tactical evaluator', () => {
    const tactical: HonorTacticalInput = { ...facts(), shieldDestroyed: 500, groundValue: 25_000,
      groundWasOnline: true, addedBlackoutPpm: 1_000_000, loyaltyLost: 0 };
    expect(honorTacticalSide({ ...tactical, galaxyTopTier: 8 }))
      .toEqual(honorTacticalSide({ ...tactical, enemyTier: 8 }));
  });
});
