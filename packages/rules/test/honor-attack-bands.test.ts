import { describe, expect, it } from 'vitest';
import { honorChallenge, honorSide, type HonorComparison, type HonorSideInput } from '../src/honor.js';
import { honorMilitaryReturn, honorTeam, type HonorMember, type HonorTeamInput } from '../src/honorTeam.js';

// Owner 2026-11-09: a table per tier relation, read as own navy : enemy navy.
// Frozen at dispatch as weakNavyBand 50 until 2026-11-12; those contracts keep this table.
const compare = (ownNavy: number, enemyNavy: number, enemyTier: number, over: Partial<HonorComparison> = {}) =>
  honorChallenge({ ownTier: 4, enemyTier, ownNavy, enemyNavy, galaxyTopTier: 6, weakNavyBand: 50, ...over });

const FULL = 1_000_000, HALF = 500_000, NONE = 0;
const LOWER = 3, SAME = 4, UPPER = 5;

describe('the 2026-11-09 attack table', () => {
  // ratio, own navy, enemy navy, lower tier, same tier, upper tier
  it.each([
    ['1:1', 20_000, 20_000, FULL, FULL, FULL],
    ['1.25:1', 25_000, 20_000, FULL, FULL, FULL],
    ['1.5:1', 30_000, 20_000, FULL, FULL, FULL],
    ['1.75:1', 35_000, 20_000, HALF, FULL, FULL],
    ['2:1', 40_000, 20_000, HALF, FULL, FULL],
    ['2.5:1', 50_000, 20_000, 'WEAK', HALF, FULL],
    ['3:1', 60_000, 20_000, 'WEAK', HALF, HALF],
    ['4:1', 80_000, 20_000, 'WEAK', NONE, NONE],
  ] as const)('%s', (_ratio, own, enemy, lower, same, upper) => {
    const low = compare(own, enemy, LOWER);
    if (lower === 'WEAK') expect(low.kind).toBe('WEAK');
    else expect(low).toMatchObject({ kind: 'PEER', gainFactor: lower });
    expect(compare(own, enemy, SAME)).toMatchObject({ kind: 'PEER', gainFactor: same });
    expect(compare(own, enemy, UPPER).gainFactor).toBe(upper);
    expect(compare(own, enemy, UPPER).kind).not.toBe('WEAK');
  });

  it.each([
    ['lower full ends just past 1.5:1', 30_000, 19_999, LOWER, HALF],
    ['same full ends just past 2:1', 40_000, 19_999, SAME, HALF],
    ['upper full ends just past 2.5:1', 50_000, 19_999, UPPER, HALF],
    ['same half ends just past 3:1', 60_000, 19_999, SAME, NONE],
    ['upper half ends just past 3:1', 60_000, 19_999, UPPER, NONE],
  ] as const)('%s', (_name, own, enemy, tier, factor) => {
    expect(compare(own, enemy, tier).gainFactor).toBe(factor);
  });

  it('starts the weak sanction just past 2:1, and never at exactly 2:1', () => {
    expect(compare(40_000, 20_000, LOWER).kind).toBe('PEER');
    expect(compare(40_000, 19_999, LOWER).kind).toBe('WEAK');
  });

  it('keeps the +25 % only for a stronger or equal upper-tier enemy', () => {
    expect(compare(20_000, 20_000, UPPER)).toMatchObject({ kind: 'UPPER', tierNumerator: 5 });
    expect(compare(25_000, 20_000, UPPER)).toMatchObject({ kind: 'PEER', tierNumerator: 4 });
  });

  it('gives the galaxy leader the same-tier column one tier down', () => {
    const leader = { ownTier: 6, galaxyTopTier: 6 };
    expect(compare(40_000, 20_000, 5, leader)).toMatchObject({ kind: 'PEER', gainFactor: FULL });
    expect(compare(50_000, 20_000, 5, leader)).toMatchObject({ kind: 'PEER', gainFactor: HALF });
    expect(compare(80_000, 20_000, 5, leader)).toMatchObject({ kind: 'PEER', gainFactor: NONE });
  });

  it('treats every tier further away like the neighbouring column', () => {
    expect(compare(35_000, 20_000, 2).gainFactor).toBe(HALF);
    expect(compare(50_000, 20_000, 2).kind).toBe('WEAK');
    expect(compare(50_000, 20_000, 7).gainFactor).toBe(FULL);
  });

  it('pays nothing against an empty navy or from an empty navy', () => {
    expect(compare(20_000, 0, LOWER).kind).toBe('WEAK');
    expect(compare(20_000, 0, SAME).gainFactor).toBe(NONE);
    expect(compare(0, 0, SAME).gainFactor).toBe(NONE);
    expect(compare(0, 20_000, UPPER).gainFactor).toBe(NONE);
    expect(compare(0, 0, LOWER).kind).toBe('WEAK');
  });
});

describe('what the 2026-11-09 table leaves alone', () => {
  const facts = (over: Partial<HonorSideInput>): HonorSideInput => ({
    ownTier: 4, enemyTier: 4, ownNavy: 40_000, enemyNavy: 20_000,
    k: 10_000, enemyLoss: 10_000, l: 5_000, loot: 0, defending: false,
    weakRepeat: 0, related: false, eligible: true, retaliationFifths: 0, ...over,
  });

  it.each([[undefined], [75]] as const)('does not reinterpret a contract frozen at %s', band => {
    const row = (own: number, enemy: number, tier: number) =>
      honorChallenge({ ownTier: 4, enemyTier: tier, ownNavy: own, enemyNavy: enemy, weakNavyBand: band });
    expect(row(30_000, 20_000, SAME).gainFactor).toBe(HALF);
    expect(row(30_000, 20_000, LOWER).kind).toBe('WEAK');
    expect(row(50_000, 20_000, SAME).gainFactor).toBe(NONE);
    expect(row(50_000, 20_000, UPPER).gainFactor).toBe(NONE);
  });

  it('keeps defenders on their existing return', () => {
    const defending = facts({ defending: true });
    expect(honorSide({ ...defending, weakNavyBand: 50 })).toEqual(honorSide(defending));
    expect(honorSide({ ...defending, ownNavy: 60_000, weakNavyBand: 50 }).gain).toBe(0);
  });

  it('still charges the attacker for its own losses on a full-return row', () => {
    const paid = honorSide(facts({ k: 1_000, enemyLoss: 1_000, l: 20_000, weakNavyBand: 50 }));
    expect(paid).toMatchObject({ gainFactor: FULL, lossDebit: 2_000_000 });
    expect(paid.raw).toBeLessThan(0);
  });

  it('turns a 2:1 same-tier win from half into full return', () => {
    const relaxed = honorSide(facts({ weakNavyBand: 50 })), frozen = honorSide(facts({ weakNavyBand: 75 }));
    expect(frozen.gain).toBe(4_166_666);
    expect(relaxed.gain).toBe(8_333_333);
  });
});

describe('the table in common-side settlement', () => {
  const member = (id: string, tier: number, over: Partial<HonorMember> = {}): HonorMember => ({
    id, tier, navy: 20_000, weight: 20_000, civilianWeight: 0, loss: 0, combatLoss: 0, lootLost: 0, ...over,
  });
  const battle = (tier: number, attackNavy: number, band: 50 | 75): HonorTeamInput => ({
    attack: [member('A', 4, { navy: attackNavy, loss: 1_000, combatLoss: 1_000 })],
    defence: [member('D', tier, { loss: 10_000, combatLoss: 10_000 })],
    eligible: true, soloPositiveOnly: true, relations: [], weakNavyBand: band,
  });

  it('names the return a receipt reports', () => {
    expect(honorMilitaryReturn(battle(SAME, 40_000, 50), 'A', 'attack')).toBe('FULL');
    expect(honorMilitaryReturn(battle(SAME, 60_000, 50), 'A', 'attack')).toBe('HALF');
    expect(honorMilitaryReturn(battle(UPPER, 50_000, 50), 'A', 'attack')).toBe('FULL');
    expect(honorMilitaryReturn(battle(SAME, 40_000, 75), 'A', 'attack')).toBe('HALF');
  });

  it('moves the 1.75:1 lower-tier raid out of the weak sanction', () => {
    expect(honorTeam(battle(LOWER, 35_000, 75)).attack.exposures[0]!.bullying).toBe(true);
    expect(honorTeam(battle(LOWER, 35_000, 50)).attack.exposures[0]!.bullying).toBe(false);
    expect(honorTeam(battle(LOWER, 35_000, 50)).attack.raw).toBeGreaterThan(0);
  });

  it('applies the table to tactical effects too', () => {
    const effect = [{ actor: 'A', enemy: 'D', base: 4_000_000, pressureFifths: 0 }];
    const positive = (band: 50 | 75) => honorTeam({ ...battle(SAME, 40_000, band), tactical: effect }).attack.exposures[0]!.positive;
    expect(positive(50)).toBeGreaterThan(positive(75));
  });
});
