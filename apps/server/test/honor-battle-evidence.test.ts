import { describe, expect, it } from 'vitest';
import { createHonorCatalogue, honorFleetValue, resolveRaid, seededFrom, soloStack } from '@astera/rules';
import { honorBattleEvidence, type HonorBattleStack } from '../src/services/honorBattleEvidence.js';
import type { HonorCommitment } from '../src/services/honorCommitment.js';
import { advanceHonor, emptyHonorState } from '../src/services/honorAccounting.js';

const catalogue = createHonorCatalogue();
const zero = { alloy: 0, crystal: 0, deuterium: 0 };
const commitment: HonorCommitment = { version: 1, at: 1000, referenceOrder: 0, eligible: true,
  attack: [{ id: 'A', tier: 3, navy: 100_000 }], defence: [{ id: 'D', tier: 3, navy: 100_000 }],
  relations: [{ a: 'A', b: 'D', related: false }] };
const stack = (id: string, over: Partial<HonorBattleStack> = {}): HonorBattleStack => ({ id,
  sent: { DART: 10 }, active: { DART: 10 }, losses: {}, rebuilt: {}, lootLost: zero, ...over });

describe('Honor uses real battle evidence rather than grades or individual last hits', () => {
  it.each(['victory', 'defeat', 'mutual', 'empty', 'escape', 'ground'] as const)('prices a real %s resolver result', scenario => {
    const attacking = scenario === 'mutual' ? { PIKE: 1 } : { DART: scenario === 'defeat' ? 1 : 100 };
    const defending = scenario === 'mutual' ? { PIKE: 1 } : scenario === 'empty' ? {} : scenario === 'ground' ? { THORN: 30 } : { DART: scenario === 'defeat' ? 100 : 5 };
    const raid = resolveRaid({ stacks: [soloStack(attacking, { tech: {} })], line: defending, shield: 0,
      defender: { tech: {} }, deuterium: 1_000_000, rng: () => seededFrom(scenario),
      escape: scenario === 'escape', minimumCombatShips: 0, preciseDamage: true });
    const host = raid.result.defenders[0]!;
    const evidence = honorBattleEvidence({ catalogue, commitment, source: 'WORLD', id: 'battle', at: 2000,
      attack: [stack('A', { sent: attacking, active: attacking, losses: raid.result.attackerLosses })],
      defence: [stack('D', { sent: host.sent, active: host.sent, losses: host.losses, rebuilt: raid.result.defenceSalvage })] });
    expect(evidence.defence[0]?.loss).toBe(honorFleetValue(catalogue, host.losses) - honorFleetValue(catalogue, raid.result.defenceSalvage));
    const result = advanceHonor(emptyHonorState(), evidence).event;
    expect(result.defence.total).toBeGreaterThanOrEqual(0);
    if (scenario === 'empty' || scenario === 'escape') expect(result.attack.total).toBe(0);
    if (scenario === 'defeat') expect(result.attack.total).toBeLessThan(0);
    if (scenario === 'victory') expect(result.attack.total).toBeGreaterThan(0);
  });

  it('shares a team’s result by initial active participation even if one member tanks all losses', () => {
    const team: HonorCommitment = { ...commitment, attack: [...commitment.attack, { id: 'B', tier: 3, navy: 100_000 }],
      relations: [{ a: 'A', b: 'D', related: false }, { a: 'B', b: 'D', related: false }] };
    const evidence = honorBattleEvidence({ catalogue, commitment: team, source: 'CLAN_WAR', id: 'team', at: 2000,
      attack: [stack('A', { losses: { DART: 10 } }), stack('B')], defence: [stack('D', { losses: { DART: 10 } })] });
    const { event } = advanceHonor(emptyHonorState(), evidence);
    expect(Math.abs(event.attack.shares[0]!.points - event.attack.shares[1]!.points)).toBeLessThanOrEqual(1);
  });

  it('gives host shield protection a capped shared weight without using individual kill attribution', () => {
    const defended: HonorCommitment = { ...commitment, defence: [...commitment.defence, { id: 'S', tier: 3, navy: 100_000 }],
      relations: [{ a: 'A', b: 'D', related: false }, { a: 'A', b: 'S', related: false }] };
    const evidence = honorBattleEvidence({ catalogue, commitment: defended, source: 'WORLD', id: 'shield', at: 2000,
      attack: [stack('A')], defence: [stack('D', { sent: {}, active: {} }), stack('S')],
      shield: { host: 'D', investment: 1000, capacity: 100, normalAbsorbed: 25.9 } });
    expect(evidence.defence[0]?.weight).toBe(250);
    expect(evidence.defence[1]?.weight).toBe(honorFleetValue(catalogue, { DART: 10 }, true));
  });

  it('rejects changed owners, invalid active rosters and battles preceding commitment', () => {
    const input = { catalogue, commitment, source: 'WORLD' as const, id: 'source', at: 2000,
      attack: [stack('A')], defence: [stack('D')] };
    expect(() => honorBattleEvidence({ ...input, defence: [stack('replacement')] })).toThrow('participants');
    expect(() => honorBattleEvidence({ ...input, attack: [stack('A', { active: { DART: 11 } })] })).toThrow('active roster');
    expect(() => honorBattleEvidence({ ...input, at: 999 })).toThrow('commitment');
    expect(() => honorBattleEvidence({ ...input, attack: [stack('A', { lootLost: { ...zero, alloy: 1 } })] })).toThrow('attacker loot');
  });

  it('a fully disabled monument force can lose hulls but cannot buy a positive participation share', () => {
    const evidence = honorBattleEvidence({ catalogue, commitment, source: 'MONUMENT', id: 'disabled', at: 2000,
      attack: [stack('A')], defence: [stack('D', { active: {}, losses: { DART: 10 } })] });
    const result = advanceHonor(emptyHonorState(), evidence).event;
    expect(result.defence.total).toBe(0);
    expect(result.attack.total).toBeGreaterThan(0);
  });
  it('preserves selected identities through the battle adapter and replay, without exempting selected weak victims', () => {
    const expanded = { ...commitment, selectedDefenders: ['D'], defence: [...commitment.defence,
      { id: 'S', tier: 2, navy: 20_000 }], relations: [{ a: 'A', b: 'D', related: false }, { a: 'A', b: 'S', related: false }] };
    const evidence = honorBattleEvidence({ catalogue, commitment: expanded, source: 'WORLD', id: 'support', at: 2000,
      attack: [stack('A')], defence: [stack('D', { losses: { DART: 1 } }), stack('S', { losses: { DART: 10 } })] });
    expect(evidence.selectedDefenders).toEqual(['D']);
    expect(advanceHonor(emptyHonorState(), evidence).event.pool.attack.exposures.find(row => row.enemy === 'S'))
      .toMatchObject({ bullying: false, positive: 0 });
    expect(advanceHonor(emptyHonorState(), { ...evidence, selectedDefenders: ['D', 'S'] }).event.pool.attack.exposures.find(row => row.enemy === 'S')?.bullying).toBe(true);
  });
});
