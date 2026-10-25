import { describe, expect, it } from 'vitest';
import { combatValue, mulberry32, resolveBattle, type DefenderStack, type Fleet, type JointAttackerStack } from '@astera/rules';
import { buildBattleReplay, prepareBattleReplay } from '../src/services/battleReplay.js';

const a = (fleet: Fleet, id = 'secret-wave'): JointAttackerStack => ({ contributionId: id, playerId: 'secret-attacker', fleet, tech: { tech: {} } });
const d = (fleet: Fleet, id = 'secret-host'): DefenderStack => ({ stackId: id, playerId: 'secret-defender', fleet, tech: { tech: {} } });
const meta = { environment: 'PLANET' as const, aegisCapacity: 1000, defenceOffline: false, escape: null, control: null };

describe('real battle capture and frozen access policy', () => {
  it('admits exactly half the defending armed power and rejects a weaker attacker', () => {
    expect(prepareBattleReplay([a({ DART: 1 })], [d({ DART: 2 })]).attackerVisible).toBe(true);
    expect(prepareBattleReplay([a({ DART: 1 })], [d({ DART: 3 })]).attackerVisible).toBe(false);
    expect(prepareBattleReplay([a({ DART: 1, ARGOSY: 200 })], [d({ DART: 3 })]).attackerVisible).toBe(false);
    expect(prepareBattleReplay([a({ DART: 1 })], [d({})]).attackerVisible).toBe(true);
    // Owner explicitly accepts the cargo exception of the existing combatValue ratio.
    expect(prepareBattleReplay([a({ DART: 1 })], [d({ DART: 1, ARGOSY: 100 })]).attackerVisible).toBe(true);
  });

  it('uses the whole pool and online ground/support line, excluding ships unable to fight', () => {
    expect(prepareBattleReplay([a({ DART: 1 }, 'w1'), a({ DART: 1 }, 'w2')], [d({ DART: 4 })]).attackerVisible).toBe(true);
    expect(prepareBattleReplay([a({ DART: 1 })], [d({ DART: 1 }), d({ DART: 2 }, 'support')]).attackerVisible).toBe(false);
    const wounded = { ...a({ DART: 21 }), damage: [{ hull: 'DART' as const, count: 20, damageBp: 9500 }] };
    expect(prepareBattleReplay([wounded], [d({ DART: 3 })]).attackerVisible).toBe(false);
    const withGuns = prepareBattleReplay([a({ DART: 1 })], [d({ DART: 1, BASTION: 3 })]);
    expect(withGuns.attackerVisible).toBe(combatValue({ DART: 1 }) * 2 >= combatValue({ DART: 1, BASTION: 3 }));
  });

  it('preserves per-stack research and wing ownership while removing private IDs and noncombat research', () => {
    const attackers = [a({ CORSAIR: 2 }, 'secret-wave-1'), { ...a({ CORSAIR: 1 }, 'secret-wave-2'), tech: { tech: { SHIP_SHIELDS: 3, ENERGY_TECH: 7 } } }];
    const defenders = [d({ DART: 4 })];
    const capture = prepareBattleReplay(attackers, defenders, { wingIds: new Map([['secret-wave-1', 'one-wing'], ['secret-wave-2', 'one-wing']]) });
    const result = resolveBattle(attackers, defenders, 100, mulberry32(9), 'HP_PLANET', true, capture.recording);
    const payload = buildBattleReplay(capture, result, meta)!;
    expect(payload.owners.filter(owner => owner.side === 'ATTACK').map(owner => owner.wing)).toEqual([1, 1]);
    const sources = payload.recording.ships.filter(ship => ship.side === 'ATTACK');
    for (const ship of sources) expect(payload.owners.some(owner => owner.stackId === ship.stackId && owner.playerId === ship.playerId)).toBe(true);
    expect(payload.owners.some(owner => owner.research.SHIP_SHIELDS === 3)).toBe(true);
    expect(JSON.stringify(payload)).not.toContain('secret-');
    expect(JSON.stringify(payload)).not.toContain('ENERGY_TECH');
    expect(payload.recording.hitLimit).toBeUndefined();
    attackers[1]!.tech.tech.SHIP_SHIELDS = 0;
    expect(payload.owners.some(owner => owner.research.SHIP_SHIELDS === 3)).toBe(true);
  });

  it('does not turn the local 400-ship editor ceiling into a real battle ceiling', () => {
    const capture = prepareBattleReplay([a({ DART: 450 })], [d({ DART: 450 })]);
    expect(capture.recording).toBeDefined();
    const tooLarge = prepareBattleReplay([a({ DART: 100000 })], [d({ DART: 100000 })]);
    expect(tooLarge.recording).toBeUndefined(); expect(tooLarge.reason).toBe('TOO_LARGE');
  });

  it.each(['PIRATE_OVERRUN', 'CARGO_WITHDRAWAL'] as const)('captures %s after combat without fabricating shots', kind => {
    const attackers = [a({ DART: 1 })], defenders = [d({ COURIER: 2 })];
    const capture = prepareBattleReplay(attackers, defenders);
    const result = resolveBattle(attackers, defenders, 1000000, mulberry32(2), 'HP_PLANET', true, capture.recording);
    const original = JSON.stringify(capture.recording!.rounds);
    const payload = buildBattleReplay(capture, result, { ...meta, aftermath: kind })!;
    const ids = payload.recording.ships.filter(ship => ship.side === 'DEFENCE').map(ship => ship.id);
    expect(payload.recording.aftermath).toEqual([{ kind, shipIds: ids }]);
    expect(payload.recording.finalState!.filter(ship => ids.includes(ship.id)).every(ship => ship.status === (kind === 'PIRATE_OVERRUN' ? 'DESTROYED' : 'RETREATED'))).toBe(true);
    expect(JSON.stringify(capture.recording!.rounds)).toBe(original);
    expect(payload.recording.rounds).toEqual(capture.recording!.rounds);
  });

  it('never serialises a truncated trace or stranded defenders’ fuel stock', () => {
    const attackers = [a({ DART: 2 })], defenders = [d({ DART: 2 })];
    const capture = prepareBattleReplay(attackers, defenders);
    const result = resolveBattle(attackers, defenders, 0, mulberry32(2), 'HP_PLANET', true, capture.recording);
    const payload = buildBattleReplay(capture, result, { ...meta, escape: { kind: 'STRANDED', ships: { DART: 2 }, fuel: 200, available: 123 } })!;
    expect(payload.escape).toEqual({ kind: 'STRANDED', ships: { DART: 2 } });
    capture.recording!.truncated = true;
    expect(buildBattleReplay(capture, result, meta)).toBeNull();
  });
});
