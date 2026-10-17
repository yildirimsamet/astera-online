import { describe, expect, it } from 'vitest';
import { honorTeam, honorTeamCredit, type HonorMember, type HonorTeamInput } from '../src/honorTeam.js';
import { honorSide } from '../src/honor.js';

const member = (id: string, over: Partial<HonorMember> = {}): HonorMember => ({
  id, tier: 3, navy: 100_000, weight: 10_000, civilianWeight: 0, loss: 0, combatLoss: 0, lootLost: 0, ...over,
});
const battle = (over: Partial<HonorTeamInput> = {}): HonorTeamInput => ({
  attack: [member('A', { loss: 10_000, combatLoss: 10_000 })],
  defence: [member('D', { loss: 50_000, combatLoss: 50_000 })],
  eligible: true, relations: [], ...over,
});

describe('Honor common-side settlement', () => {
  it('can recognise a genuine new defensive force when its committed navy was zero', () => {
    const facts = battle({ defence: [member('D', { navy: 0, loss: 50_000, combatLoss: 50_000 })] });
    expect(honorTeam(facts).defence.raw).toBe(0);
    expect(honorTeam({ ...facts, defendingZeroNavyFloor: true }).defence.raw).toBe(5_833_333);
    expect(honorTeam({ ...facts, defendingZeroNavyFloor: true }).attack).toEqual(honorTeam(facts).attack);
  });

  it('the defensive zero-reference fallback cannot promote a civilian, inactive or related participant', () => {
    const passive = battle({ defence: [member('D', { navy: 0, weight: 0, civilianWeight: 100, loss: 100 })] });
    expect(honorTeam({ ...passive, defendingZeroNavyFloor: true }).defence.raw).toBe(0);
    const related = battle({ defence: [member('D', { navy: 0, loss: 50_000, combatLoss: 50_000 })],
      relations: [{ a: 'A', b: 'D', related: true, weakRepeat: 0, retaliationFifths: 0 }] });
    expect(honorTeam({ ...related, defendingZeroNavyFloor: true }).defence.raw).toBe(0);
    expect(honorTeam({ ...related, eligible: false, defendingZeroNavyFloor: true }).defence.raw).toBe(0);
  });

  it('the fallback preserves nonzero historical comparisons and cannot give a huge new navy full gain', () => {
    const known = battle({ defence: [member('D', { navy: 200_000, loss: 50_000, combatLoss: 50_000 })] });
    expect(honorTeam({ ...known, defendingZeroNavyFloor: true })).toEqual(honorTeam(known));
    const huge = battle({ defence: [member('D', { navy: 0, weight: 300_000, loss: 50_000, combatLoss: 50_000 })] });
    expect(honorTeam({ ...huge, defendingZeroNavyFloor: true }).defence.raw).toBe(0);
  });

  it('matches solo arithmetic and uses the same pair ceiling for both sides', () => {
    const r = honorTeam(battle());
    expect(r.attack.raw).toBe(44_833_333);
    expect(r.defence.raw).toBe(5_833_333);
    const credit = honorTeamCredit(r, []);
    expect(credit.attack.shares[0]?.points).toBe(credit.attack.total);
    expect(credit.attack.total + credit.defence.total).toBe(40_425_531);
    expect(credit.pairs).toHaveLength(1);
  });

  it('shares common efficiency even when one ally tanks every casualty', () => {
    const r = honorTeam(battle({ attack: [member('A', { loss: 10_000 }), member('B')] }));
    const shares = honorTeamCredit(r, []).attack.shares;
    expect(Math.abs((shares[0]?.points ?? 0) - (shares[1]?.points ?? 0))).toBeLessThanOrEqual(1);
    expect(r.attack.raw).toBe(44_833_333);
  });

  it('merges same-owner waves before rounding and is invariant to input order', () => {
    const split = battle({ attack: [member('A', { weight: 5_000, loss: 5_000, combatLoss: 5_000 }), member('A', { weight: 5_000, loss: 5_000, combatLoss: 5_000 })] });
    expect(honorTeam(split)).toEqual(honorTeam(battle()));
    expect(honorTeam({ ...split, attack: [...split.attack].reverse() })).toEqual(honorTeam(split));
  });

  it('one upper-tier decoy does not reclassify all weaker victims', () => {
    const r = honorTeam(battle({ attack: [member('A', { tier: 4, navy: 200_000 })], defence: [
      member('D', { tier: 3, loss: 50_000, combatLoss: 50_000 }),
      member('decoy', { tier: 5, navy: 300_000, weight: 1, loss: 1, combatLoss: 1 }),
    ] }));
    expect(r.attack.raw).toBeLessThan(0);
  });
  it('a weak unselected supporter neither earns military credit nor imposes a bullying debit', () => {
    const r = honorTeam({ ...battle({ attack: [member('A')], defence: [member('D', { weight: 1, loss: 1, combatLoss: 1 }),
      member('S', { tier: 2, navy: 50_000, weight: 50_000, loss: 50_000, combatLoss: 50_000 })] }), selectedDefenders: ['D'] });
    expect(r.attack.raw).toBe(1000);
    expect(r.attack.exposures.find(row => row.enemy === 'S')).toMatchObject({ bullying: false, positive: 0, retaliationSpentFifths: 0 });
  });
  it('keeps the selected weak host debit even with an unselected strong decoy', () => {
    const facts = battle({ attack: [member('A', { tier: 4, navy: 200_000 })], defence: [
      member('D', { loss: 50_000, combatLoss: 50_000 }), member('S', { tier: 5, navy: 300_000, weight: 1, loss: 1, combatLoss: 1 }),
    ] });
    expect(honorTeam({ ...facts, selectedDefenders: ['D'] })).toEqual(honorTeam(facts));
  });

  it('a token low-tier ally cannot launder the large ally’s bullying', () => {
    const r = honorTeam(battle({ attack: [member('A', { tier: 4, navy: 200_000 }), member('B', { tier: 2, weight: 1 })] }));
    expect(r.attack.raw).toBeLessThan(0);
  });

  it('cargo-only attacks cannot bypass losses or weak-target loot penalties', () => {
    const r = honorTeam(battle({ attack: [member('A', { tier: 4, weight: 0, civilianWeight: 100, loss: 100 })],
      defence: [member('D', { navy: 0, weight: 0, lootLost: 1000 })] }));
    expect(r.attack.raw).toBe(-60_000);
    expect(honorTeamCredit(r, []).attack.shares[0]?.points).toBe(-60_000);
  });

  it('fallback civilian allocation never buys a positive combat share', () => {
    const r = honorTeam(battle({ attack: [member('A', { weight: 0, civilianWeight: 100 })] }));
    expect(r.attack.raw).toBe(0);
  });

  it('a recent ally earns no positive pair exposure while attack losses remain', () => {
    const r = honorTeam(battle({ relations: [{ a: 'A', b: 'D', related: true, weakRepeat: 0, retaliationFifths: 0 }] }));
    expect(r.attack.raw).toBe(-1_000_000);
    expect(r.defence.raw).toBe(0);
  });

  it('retaliation and weak repeat match 1v1 including fractional resource exposure', () => {
    const r = honorTeam(battle({ attack: [member('A', { tier: 4, loss: 10_000 })],
      defence: [member('D', { navy: 50_000, loss: 1000, combatLoss: 1000, lootLost: 3 })],
      relations: [{ a: 'A', b: 'D', related: false, weakRepeat: 1, retaliationFifths: 5001 }] }));
    const scalar = honorSide({ k: 1000, enemyLoss: 1000, l: 10_000, loot: 3, ownTier: 4, enemyTier: 3,
      ownNavy: 100_000, enemyNavy: 50_000, defending: false, weakRepeat: 1, retaliationFifths: 5001, related: false, eligible: true });
    expect(r.attack.raw).toBe(scalar.raw);
    expect(r.attack.exposures[0]?.retaliationSpentFifths).toBe(5001);
  });

  it('distributes weak harm before consuming per-pair retaliation, never consumes it twice', () => {
    const r = honorTeam(battle({ attack: [member('A', { tier: 4 }), member('B', { tier: 4 })],
      defence: [member('D', { navy: 50_000, loss: 1000, combatLoss: 1000 })],
      relations: ['A', 'B'].map(a => ({ a, b: 'D', related: false, weakRepeat: 0, retaliationFifths: 5000 })) }));
    expect(r.attack.raw).toBe(0);
    expect(r.attack.exposures.reduce((n, e) => n + e.retaliationSpentFifths, 0)).toBe(5000);
  });

  it.each([20, 40] as const)('matches solo loot weighting and conserves %s%% harm across shared attackers', retaliationLootPercent => {
    const facts = battle({ attack: [member('A', { tier: 4 })],
      defence: [member('D', { navy: 50_000, loss: 1000, combatLoss: 1000, lootLost: 3 })] });
    const r = honorTeam({ ...facts, retaliationLootPercent });
    expect(r.attack.exposures[0]?.harmFifths).toBe(5000 + 3 * retaliationLootPercent / 20);
    expect(r.attack.raw).toBe(honorSide({ k: 1000, enemyLoss: 1000, l: 0, loot: 3,
      ownTier: 4, enemyTier: 3, ownNavy: 100_000, enemyNavy: 50_000,
      defending: false, related: false, eligible: true, weakRepeat: 0, retaliationFifths: 0,
      retaliationLootPercent }).raw);
    const shared = honorTeam({ ...facts, retaliationLootPercent,
      attack: [member('A', { tier: 4 }), member('B', { tier: 4 })] });
    expect(shared.attack.exposures.reduce((sum, row) => sum + row.harmFifths, 0))
      .toBe(r.attack.exposures[0]?.harmFifths);
    expect(shared.attack.raw).toBe(r.attack.raw);
  });

  it('exhausted pair credit reduces the common pool; participants still share the result together', () => {
    const r = honorTeam(battle({ attack: [member('A'), member('B')] }));
    const fresh = honorTeamCredit(r, []), exhausted = honorTeamCredit(r, [{ a: 'A', b: 'D', raw: 1_000_000_000 }]);
    expect(exhausted.attack.total).toBeLessThan(fresh.attack.total);
    expect(exhausted.attack.total).toBeGreaterThan(0);
    expect(Math.abs((exhausted.attack.shares[0]?.points ?? 0) - (exhausted.attack.shares[1]?.points ?? 0))).toBeLessThanOrEqual(1);
    expect(exhausted.attack.shares.reduce((n, s) => n + s.points, 0)).toBe(exhausted.attack.total);
  });

  it('2v2 conserves all signed side totals and writes one reservation per unordered pair', () => {
    const r = honorTeamCredit(honorTeam(battle({ attack: [member('A', { loss: 100 }), member('B', { loss: 200 })],
      defence: [member('C', { loss: 500, combatLoss: 500 }), member('D', { loss: 1000, combatLoss: 1000 })] })), []);
    expect(r.pairs).toHaveLength(4);
    for (const side of [r.attack, r.defence]) expect(side.shares.reduce((n, s) => n + s.points, 0)).toBe(side.total);
  });

  it('empty monument capture earns no score and no invented opposing identity', () => {
    const r = honorTeamCredit(honorTeam(battle({ attack: [member('A')], defence: [] })), []);
    expect(r.attack.total).toBe(0);
    expect(r.pairs).toEqual([]);
  });

  it('rejects impossible ownership, waves, loss evidence and duplicate relationship states', () => {
    expect(() => honorTeam(battle({ defence: [member('A')] }))).toThrow();
    expect(() => honorTeam(battle({ attack: [member('A'), member('A', { tier: 4 })] }))).toThrow();
    expect(() => honorTeam(battle({ defence: [member('D', { combatLoss: 1, loss: 0 })] }))).toThrow();
    const relation = { a: 'A', b: 'D', related: false, weakRepeat: 0, retaliationFifths: 0 };
    expect(() => honorTeam(battle({ relations: [relation, relation] }))).toThrow();
    expect(() => honorTeamCredit(honorTeam(battle()), [{ a: 'A', b: 'D', raw: 1 }, { a: 'D', b: 'A', raw: 1 }])).toThrow();
  });
});
