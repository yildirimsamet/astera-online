import { describe, expect, it } from 'vitest';
import { honorChallenge, honorSide, type HonorSideInput } from '../src/honor.js';
import { honorMilitaryReturn, honorTeam, type HonorTeamInput, type HonorMember } from '../src/honorTeam.js';
import { honorTacticalSide, type HonorTacticalInput } from '../src/honorTactical.js';

// Owner 2026-10-30: a lower-tier target is a weak target only below the same
// 75 % military band that already defines full return. Frozen at dispatch.
const facts = (over: Partial<HonorSideInput> = {}) => ({
  ownTier: 4, enemyTier: 3, ownNavy: 20_000, enemyNavy: 19_000,
  k: 10_000, enemyLoss: 10_000, l: 5_000, loot: 0, defending: false,
  weakRepeat: 0, related: false, eligible: true, retaliationFifths: 0,
  ...over,
});
const member = (id: string, tier: number, over: Partial<HonorMember> = {}): HonorMember => ({
  id, tier, navy: 20_000, weight: 20_000, civilianWeight: 0, loss: 0,
  combatLoss: 0, lootLost: 0, ...over,
});
const battle = (over: Partial<HonorTeamInput> = {}) => ({
  attack: [member('A', 4, { loss: 5_000, combatLoss: 5_000 })],
  defence: [member('D', 3, { navy: 19_000, loss: 10_000, combatLoss: 10_000 })],
  eligible: true, soloPositiveOnly: true, relations: [], ...over,
});

describe('a near-equal lower-tier navy is not a weak target', () => {
  it('scores a lower-tier target at or above 75 % like an equal-tier one', () => {
    expect(honorChallenge(facts({ weakNavyBand: 75 }))).toEqual(honorChallenge(facts({ enemyTier: 4 })));
    expect(honorSide(facts({ weakNavyBand: 75 }))).toEqual(honorSide(facts({ enemyTier: 4 })));
    expect(honorSide(facts({ weakNavyBand: 75 })).raw).toBe(7_833_333);
  });

  it.each([
    [15_000, 'PEER'], [14_999, 'WEAK'], [0, 'WEAK'], [19_999, 'PEER'],
  ] as const)('places the boundary at exactly 75 %% (enemy navy %s → %s)', (enemyNavy, kind) => {
    expect(honorChallenge(facts({ enemyNavy, weakNavyBand: 75 })).kind).toBe(kind);
  });

  it('keeps a commander with no navy against an empty lower tier weak', () => {
    expect(honorChallenge(facts({ ownNavy: 0, enemyNavy: 0, weakNavyBand: 75 })).kind).toBe('WEAK');
  });

  it('keeps the weak sanction below the band', () => {
    const below = facts({ enemyNavy: 14_999, weakNavyBand: 75 });
    expect(honorSide(below)).toEqual(honorSide(facts({ enemyNavy: 14_999 })));
    expect(honorSide(below).bullying).toBe(true);
  });

  it('does not reinterpret a historical contract without the frozen band', () => {
    expect(honorChallenge(facts()).kind).toBe('WEAK');
    expect(honorSide(facts()).raw).toBe(-3_000_000);
  });

  it.each([
    { enemyTier: 4 }, { enemyTier: 5 }, { enemyTier: 5, enemyNavy: 25_000 },
    { enemyNavy: 9_000, enemyTier: 4 }, { galaxyTopTier: 4 }, { defending: true },
  ])('changes nothing outside the lower-tier classification: %j', over => {
    expect(honorSide(facts({ ...over, weakNavyBand: 75 }))).toEqual(honorSide(facts(over)));
  });

  it('uses the band in common-side military and tactical settlement', () => {
    const peer = battle({ defence: [{ ...battle().defence[0]!, tier: 4 }] });
    const banded = battle({ weakNavyBand: 75 });
    expect(honorTeam(banded).attack).toEqual(honorTeam(peer).attack);
    expect(honorTeam(banded).defence).toEqual(honorTeam(battle()).defence);
    expect(honorTeam(battle()).attack.exposures[0]!.bullying).toBe(true);
    const effect = [{ actor: 'A', enemy: 'D', base: 4_000_000, pressureFifths: 160_000 }];
    expect(honorTeam({ ...banded, tactical: effect }).attack)
      .toEqual(honorTeam({ ...peer, tactical: effect }).attack);
  });

  it('also applies to the standalone tactical evaluator', () => {
    const tactical: HonorTacticalInput = { ...facts(), shieldDestroyed: 500, groundValue: 25_000,
      groundWasOnline: true, addedBlackoutPpm: 1_000_000, loyaltyLost: 0 };
    expect(honorTacticalSide({ ...tactical, weakNavyBand: 75 }))
      .toEqual(honorTacticalSide({ ...tactical, enemyTier: 4 }));
  });
});

describe('the military band behind a receipt', () => {
  const raid = (defenceNavy: number, over: Partial<HonorTeamInput> = {}): HonorTeamInput => battle({
    attack: [member('A', 3, { navy: 37_097, weight: 29_321 })],
    defence: [member('D', 4, { navy: defenceNavy, weight: 7_044, loss: 1_800, combatLoss: 1_800, lootLost: 7_174 })],
    weakNavyBand: 75, ...over,
  });

  it.each([[8_052, 'NONE'], [18_549, 'HALF'], [27_823, 'FULL']] as const)(
    'names the band the attacker earned against enemy navy %s', (navy, band) => {
      expect(honorMilitaryReturn(raid(navy), 'A', 'attack')).toBe(band);
    });

  it('agrees with settlement: the zero band is why a destroyed defence paid nothing', () => {
    expect(honorTeam(raid(8_052)).attack.raw).toBe(0);
    expect(honorTeam(raid(18_549)).attack.raw).toBeGreaterThan(0);
  });

  it('is absent when nothing armed of the enemy was destroyed', () => {
    const empty = raid(8_052, { defence: [member('D', 4, { navy: 8_052, lootLost: 7_174 })] });
    expect(honorMilitaryReturn(empty, 'A', 'attack')).toBeUndefined();
  });

  it('judges a defender by its current navy, like settlement does', () => {
    const input = battle({
      attack: [member('A', 3, { navy: 10_000, loss: 4_000, combatLoss: 4_000 })],
      defence: [member('D', 3, { navy: 1_000, defenceNavy: 30_000 })],
    });
    expect(honorMilitaryReturn(input, 'D', 'defence')).toBe('FULL');
    expect(honorMilitaryReturn({ ...input, defendingCurrentNavy: true }, 'D', 'defence')).toBe('NONE');
    expect(honorTeam({ ...input, defendingCurrentNavy: true }).defence.raw).toBe(0);
  });

  it('never names a band for a weak-target pair, which can only lose Honor', () => {
    const weak = raid(20_000, { attack: [member('A', 5, { navy: 30_000, weight: 29_321 })] });
    expect(honorTeam(weak).attack.exposures[0]!.bullying).toBe(true);
    expect(honorMilitaryReturn(weak, 'A', 'attack')).toBeUndefined();
  });

  it('is absent for a commander who did not fight on that side', () => {
    expect(honorMilitaryReturn(raid(8_052), 'X', 'attack')).toBeUndefined();
  });
});
