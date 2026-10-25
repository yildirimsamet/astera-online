import { describe, expect, it } from 'vitest';
import { createBattleRecording, fleetCount, mulberry32, resolveBattle, resolveMonumentCombat, resolveRaid, type Fleet, type JointAttackerStack } from '../src/index.js';

const attack = (fleet: Fleet): JointAttackerStack => ({ contributionId: 'wave', playerId: 'attacker', fleet, tech: { tech: {} } });
const defender = (fleet: Fleet) => ({ stackId: 'host', playerId: 'defender', fleet, tech: { tech: {} } });

describe('record the real settled battle', () => {
  it.each([false, true])('records the actual raid branch when automatic escape is %s, without another solve', escape => {
    const input = { stacks: [attack({ CORSAIR: 30, NULLIFIER: 2 })], line: { DART: 5, BASTION: 2 }, shield: 120,
      defender: { tech: {} }, deuterium: 100000, escape, minimumCombatShips: 5, hostPlayerId: 'defender', preciseDamage: true, maintenance: true };
    let plainCalls = 0, recordedCalls = 0;
    const plain = resolveRaid({ ...input, rng: () => { plainCalls++; return mulberry32(7); } });
    const recording = createBattleRecording();
    const captured = resolveRaid({ ...input, recording, rng: () => { recordedCalls++; return mulberry32(7); } });
    expect(captured).toEqual(plain); expect(recordedCalls).toBe(plainCalls);
    expect(recording.ships.length).toBeGreaterThan(0);
    if (escape) {
      expect(captured.escape?.kind).toBe('ESCAPED');
      expect(recording.ships.some(ship => ship.side === 'DEFENCE' && ship.hull === 'DART')).toBe(false);
    } else expect(recording.ships.filter(ship => ship.hull === 'DART')).toHaveLength(5);
    const final = recording.rounds.at(-1)?.after ?? recording.ships;
    expect(final.filter(ship => ship.status !== 'DESTROYED' && ship.id.startsWith('D')).length).toBe(fleetCount(captured.result.defenderSurvivors));
  });

  it('captures supported defenders and a stranded fleet in the standing branch', () => {
    for (const support of [[], [{ ...defender({ CITADEL: 1 }), stackId: 'ally', playerId: 'ally' }]]) {
      const recording = createBattleRecording();
      const result = resolveRaid({ stacks: [attack({ CORSAIR: 30 })], line: { DART: 5, BASTION: 2 }, shield: 0,
        defender: { tech: {} }, deuterium: 0, escape: support.length === 0, minimumCombatShips: 5,
        hostPlayerId: 'defender', preciseDamage: true, maintenance: true, support, recording, rng: () => mulberry32(7) });
      if (support.length === 0) expect(result.escape?.kind).toBe('STRANDED');
      else expect(recording.ships.some(ship => ship.playerId === 'ally')).toBe(true);
      expect(recording.rounds.length).toBeGreaterThan(0);
    }
  });

  it('captures monument combat while preserving its control and RNG stream', () => {
    const recording = createBattleRecording(), plainRng = mulberry32(8), capturedRng = mulberry32(8);
    const a = [attack({ CORSAIR: 4 })], d = [defender({ CITADEL: 2 })];
    const plain = resolveMonumentCombat(a, d, plainRng, true);
    expect(resolveMonumentCombat(a, d, capturedRng, true, recording)).toEqual(plain);
    expect(capturedRng()).toBe(plainRng()); expect(recording.ships).toHaveLength(6);
  });

  it('bounds a capture without changing the battle or serving a partial trace as complete', () => {
    const recording = createBattleRecording({ hitLimit: 2 });
    const plainRng = mulberry32(4), capturedRng = mulberry32(4);
    const a = [attack({ DART: 20 })], d = [defender({ DART: 20 })];
    const plain = resolveBattle(a, d, 0, plainRng, 'HP_PLANET', true);
    expect(resolveBattle(a, d, 0, capturedRng, 'HP_PLANET', true, recording)).toEqual(plain);
    expect(capturedRng()).toBe(plainRng()); expect(recording.truncated).toBe(true);
    expect(recording.rounds).toEqual([]);
  });

  it('freezes each participating ship class and ground identity at calculation time', () => {
    const recording = createBattleRecording();
    resolveBattle([attack({ DART: 1 })], [defender({ BASTION: 1 })], 0, mulberry32(2), 'HP_PLANET', true, recording);
    expect(recording.ships.find(ship => ship.hull === 'DART')).toMatchObject({ cls: 'SKIRMISHER', ground: false });
    expect(recording.ships.find(ship => ship.hull === 'BASTION')).toMatchObject({ ground: true });
  });
});
