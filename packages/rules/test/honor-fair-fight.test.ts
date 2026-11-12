import { describe, expect, it } from 'vitest';
import { HONOR_ATTACK_NAVY_BAND, honorChallenge, honorSide, type HonorComparison, type HonorSideInput } from '../src/honor.js';
import { honorReferenceAt } from '../src/honorHistory.js';
import { honorMilitaryReturn, honorTeam, type HonorMember, type HonorTeamInput } from '../src/honorTeam.js';

// Owner 2026-11-12, after replaying both seasons: the fight counts as much as the two
// navies allow, for the gain and for the loss alike; a lower tier is weak only beyond
// 3:1; a second raid on a commander far below you is bullying at any tier.
// Frozen at dispatch as weakNavyBand 33; 50, 75 and absent contracts keep their tables.
const compare = (ownNavy: number, enemyNavy: number, enemyTier: number, over: Partial<HonorComparison> = {}) =>
  honorChallenge({ ownTier: 4, enemyTier, ownNavy, enemyNavy, galaxyTopTier: 6, weakNavyBand: 33, ...over });

const FULL = 1_000_000, HALF = 500_000, NONE = 0;
const LOWER = 3, SAME = 4, UPPER = 5;

describe('the 2026-11-12 attack table', () => {
  it('freezes new contracts at the band that names this table', () => {
    expect(HONOR_ATTACK_NAVY_BAND).toBe(33);
  });

  // ratio, own navy, enemy navy, lower tier, same tier, upper tier
  it.each([
    ['1:1', 20_000, 20_000, FULL, FULL, FULL],
    ['1.5:1', 30_000, 20_000, FULL, FULL, FULL],
    ['1.75:1', 35_000, 20_000, HALF, FULL, FULL],
    ['2:1', 40_000, 20_000, HALF, FULL, FULL],
    ['2.5:1', 50_000, 20_000, HALF, HALF, FULL],
    ['3:1', 60_000, 20_000, HALF, HALF, HALF],
    ['4:1', 80_000, 20_000, 'WEAK', NONE, NONE],
  ] as const)('%s', (_ratio, own, enemy, lower, same, upper) => {
    const low = compare(own, enemy, LOWER);
    if (lower === 'WEAK') expect(low.kind).toBe('WEAK');
    else expect(low).toMatchObject({ kind: 'PEER', gainFactor: lower });
    expect(compare(own, enemy, SAME)).toMatchObject({ kind: 'PEER', gainFactor: same });
    expect(compare(own, enemy, UPPER).gainFactor).toBe(upper);
    expect(compare(own, enemy, UPPER).kind).not.toBe('WEAK');
  });

  it('starts the weak sanction just past 3:1, and never at exactly 3:1', () => {
    expect(compare(60_000, 20_000, LOWER)).toMatchObject({ kind: 'PEER', gainFactor: HALF });
    expect(compare(60_000, 19_999, LOWER)).toMatchObject({ kind: 'WEAK', gainFactor: NONE });
  });

  it('keeps an empty lower-tier navy weak and the galaxy leader on the same-tier column', () => {
    expect(compare(20_000, 0, LOWER).kind).toBe('WEAK');
    expect(compare(0, 0, LOWER).kind).toBe('WEAK');
    expect(compare(80_000, 20_000, 5, { ownTier: 6, galaxyTopTier: 6 })).toMatchObject({ kind: 'PEER', gainFactor: NONE });
  });

  it('does not reinterpret a contract frozen at 50', () => {
    const old = (own: number, enemy: number) =>
      honorChallenge({ ownTier: 4, enemyTier: LOWER, ownNavy: own, enemyNavy: enemy, galaxyTopTier: 6, weakNavyBand: 50 });
    expect(old(50_000, 20_000).kind).toBe('WEAK');
    expect(old(40_000, 20_000)).toMatchObject({ kind: 'PEER', gainFactor: HALF });
  });
});

describe('a second raid on a commander far below you', () => {
  it.each([[LOWER], [SAME], [UPPER]] as const)('is bullying beyond 3:1 at tier %s', tier => {
    expect(compare(80_000, 20_000, tier, { repeatRaid: true })).toMatchObject({ kind: 'WEAK', gainFactor: NONE });
  });

  it('is an ordinary fight while the navies still pay a return', () => {
    expect(compare(60_000, 20_000, SAME, { repeatRaid: true })).toMatchObject({ kind: 'PEER', gainFactor: HALF });
    expect(compare(60_000, 19_999, SAME, { repeatRaid: true }).kind).toBe('WEAK');
    expect(compare(20_000, 60_000, UPPER, { repeatRaid: true })).toMatchObject({ kind: 'UPPER', gainFactor: FULL });
  });

  it('counts against an empty navy, never from an empty one', () => {
    expect(compare(20_000, 0, SAME, { repeatRaid: true }).kind).toBe('WEAK');
    expect(compare(0, 0, SAME, { repeatRaid: true }).kind).toBe('PEER');
  });

  it('means nothing to a contract frozen under an older table', () => {
    for (const weakNavyBand of [undefined, 75, 50] as const) {
      expect(compare(80_000, 20_000, SAME, { repeatRaid: true, weakNavyBand }).kind).toBe('PEER');
    }
  });
});

describe('the loss debit follows the return', () => {
  const facts = (over: Partial<HonorSideInput>): HonorSideInput => ({
    ownTier: 4, enemyTier: 4, ownNavy: 40_000, enemyNavy: 20_000, weakNavyBand: 33,
    k: 10_000, enemyLoss: 10_000, l: 5_000, loot: 0, defending: false,
    weakRepeat: 0, related: false, eligible: true, retaliationFifths: 0, ...over,
  });

  it('charges the whole loss on a full-return row', () => {
    expect(honorSide(facts({}))).toMatchObject({ gain: 8_333_333, lossDebit: 500_000, raw: 7_833_333 });
    expect(honorSide(facts({}))).toEqual(honorSide(facts({ weakNavyBand: 50 })));
  });

  it('charges half the loss on a half-return row', () => {
    expect(honorSide(facts({ ownNavy: 60_000 }))).toMatchObject({ gain: 4_166_666, lossDebit: 250_000, raw: 3_916_666 });
  });

  it('charges nothing where the navies are too far apart to pay', () => {
    expect(honorSide(facts({ ownNavy: 80_000 }))).toMatchObject({ gain: 0, lossDebit: 0, raw: 0, bullying: false });
    expect(honorSide(facts({ ownNavy: 80_000, k: 0, enemyLoss: 0, l: 30_000 })).raw).toBe(0);
  });

  it('still charges a lost fight between equals in full', () => {
    expect(honorSide(facts({ ownNavy: 20_000, k: 1_000, enemyLoss: 1_000, l: 20_000 })).lossDebit).toBe(2_000_000);
  });

  it('keeps the whole debit beside a weak-target sanction, first raid or repeat', () => {
    const lower = honorSide(facts({ ownNavy: 80_000, enemyTier: 3 }));
    expect(lower).toMatchObject({ bullying: true, weakDebit: 2_500_000, lossDebit: 500_000, raw: -3_000_000 });
    expect(honorSide(facts({ ownNavy: 80_000, repeatRaid: true }))).toEqual({ ...lower, kind: 'WEAK' });
  });

  it('leaves contracts frozen at 50 on the whole debit', () => {
    expect(honorSide(facts({ ownNavy: 80_000, weakNavyBand: 50 }))).toMatchObject({ gain: 0, lossDebit: 500_000, raw: -500_000 });
  });

  it('leaves defenders alone', () => {
    const defending = facts({ defending: true, weakNavyBand: undefined });
    expect(honorSide({ ...defending, weakNavyBand: 33, repeatRaid: true })).toEqual(honorSide(defending));
  });
});

describe('the table in common-side settlement', () => {
  const member = (id: string, tier: number, over: Partial<HonorMember> = {}): HonorMember => ({
    id, tier, navy: 20_000, weight: 20_000, civilianWeight: 0, loss: 0, combatLoss: 0, lootLost: 0, ...over,
  });
  const battle = (tier: number, attackNavy: number, over: Partial<HonorTeamInput> = {}): HonorTeamInput => ({
    attack: [member('A', 4, { navy: attackNavy, loss: 1_000, combatLoss: 1_000 })],
    defence: [member('D', tier, { loss: 10_000, combatLoss: 10_000 })],
    eligible: true, soloPositiveOnly: true, relations: [], weakNavyBand: 33, ...over,
  });
  const again = [{ a: 'A', b: 'D', related: false, weakRepeat: 0, retaliationFifths: 0, repeatRaid: true }];

  it('scales the common debit with the best return on the field', () => {
    expect(honorTeam(battle(SAME, 40_000)).attack.raw).toBe(9_445_454);
    expect(honorTeam(battle(SAME, 60_000)).attack.raw).toBe(4_722_727);
    expect(honorTeam(battle(SAME, 80_000)).attack.raw).toBe(0);
    expect(honorTeam(battle(SAME, 80_000, { weakNavyBand: 50 })).attack.raw).toBe(-100_000);
  });

  it('charges in full when one opponent on the field still pays in full', () => {
    const mixed = battle(SAME, 80_000);
    const pool = honorTeam({ ...mixed, defence: [...mixed.defence, member('E', SAME, { navy: 80_000 })] });
    expect(pool.attack.raw).toBe(-100_000);
  });

  it('moves the 2.5:1 lower-tier raid out of the weak sanction', () => {
    expect(honorTeam(battle(LOWER, 50_000, { weakNavyBand: 50 })).attack.exposures[0]!.bullying).toBe(true);
    expect(honorTeam(battle(LOWER, 50_000)).attack).toMatchObject({ raw: 4_722_727, exposures: [{ bullying: false }] });
  });

  it('sanctions the second raid and leaves the first one neutral', () => {
    expect(honorTeam(battle(SAME, 80_000)).attack.exposures[0]).toMatchObject({ bullying: false, harmFifths: 50_000 });
    const repeat = honorTeam(battle(SAME, 80_000, { relations: again }));
    expect(repeat.attack).toMatchObject({ raw: -2_600_000, exposures: [{ bullying: true, positive: 0 }] });
    expect(repeat.defence.exposures[0]!.bullying).toBe(false);
  });

  it('never sanctions a repeat on a supporter the attacker did not choose', () => {
    const pool = honorTeam(battle(SAME, 80_000, { relations: again, selectedDefenders: [] }));
    expect(pool.attack).toMatchObject({ raw: 0, exposures: [{ bullying: false }] });
  });

  it('ignores the repeat on older contracts and on paying rows', () => {
    expect(honorTeam(battle(SAME, 80_000, { relations: again, weakNavyBand: 50 })).attack.exposures[0]!.bullying).toBe(false);
    expect(honorTeam(battle(SAME, 60_000, { relations: again })).attack.raw).toBe(4_722_727);
  });

  it('still names the return a receipt reports', () => {
    expect(honorMilitaryReturn(battle(LOWER, 50_000), 'A', 'attack')).toBe('HALF');
    expect(honorMilitaryReturn(battle(SAME, 80_000), 'A', 'attack')).toBe('NONE');
    expect(honorMilitaryReturn(battle(LOWER, 80_000), 'A', 'attack')).toBeUndefined();
  });
});

describe('the 24-hour peak forgets ships destroyed in battle', () => {
  const hour = 3_600_000;
  const before = { at: 0, navy: 1_000, coreTier: 4 };

  it('drops a battle loss from the reference at once', () => {
    expect(honorReferenceAt([before, { at: 10 * hour, navy: 100, coreTier: 4, combatLoss: 900 }], 11 * hour))
      .toEqual({ navy: 100, tier: 4 });
  });

  it('keeps ships that left any other way for the whole day', () => {
    expect(honorReferenceAt([before, { at: 10 * hour, navy: 100, coreTier: 4 }], 11 * hour).navy).toBe(1_000);
    expect(honorReferenceAt([before, { at: 10 * hour, navy: 100, coreTier: 4, combatLoss: 0 }], 11 * hour).navy).toBe(1_000);
  });

  it('nets a mixed drop: only the destroyed part leaves the peak', () => {
    expect(honorReferenceAt([before, { at: 10 * hour, navy: 600, coreTier: 4, combatLoss: 300 }], 11 * hour).navy).toBe(700);
  });

  it('adds up several battles and never falls under the present navy', () => {
    const history = [before, { at: 2 * hour, navy: 700, coreTier: 4, combatLoss: 300 },
      { at: 3 * hour, navy: 900, coreTier: 4 }, { at: 4 * hour, navy: 500, coreTier: 4, combatLoss: 400 },
      { at: 5 * hour, navy: 650, coreTier: 4 }];
    expect(honorReferenceAt(history, 3 * hour).navy).toBe(900);
    expect(honorReferenceAt(history, 4 * hour).navy).toBe(500);
    expect(honorReferenceAt(history, 6 * hour).navy).toBe(650);
  });

  it('reduces the row held from before the window too', () => {
    expect(honorReferenceAt([before, { at: 30 * hour, navy: 100, coreTier: 4, combatLoss: 900 }], 31 * hour).navy).toBe(100);
    expect(honorReferenceAt([before, { at: 30 * hour, navy: 400, coreTier: 4, combatLoss: 5_000 }], 31 * hour).navy).toBe(400);
  });

  it('never lets a later battle rewrite an earlier reference', () => {
    expect(honorReferenceAt([before, { at: 10 * hour, navy: 100, coreTier: 4, combatLoss: 900 }], 9 * hour).navy).toBe(1_000);
  });

  it('rejects a malformed loss', () => {
    expect(() => honorReferenceAt([before, { at: 1, navy: 100, coreTier: 4, combatLoss: -1 }], 2)).toThrow();
    expect(() => honorReferenceAt([before, { at: 1, navy: 100, coreTier: 4, combatLoss: 0.5 }], 2)).toThrow();
  });
});
