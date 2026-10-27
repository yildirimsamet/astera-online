import { describe, expect, it } from 'vitest';
import { ABILITIES, abilityRank, abilityStats, flightRanks, pointsLeft } from '../../src/arena/ranks.js';
import { ARENA_TUNING as T, createInput, createSandboxWorld, packPilot, predictPilot, stepSandboxWorld, unpackPilot } from '../../src/arena/index.js';
import { layoutWith } from './helpers.js';
import { castSignature } from '../../src/arena/signatures.js';

describe('separate ability ranks (owner 2026-10-24)', () => {
  it('earns one point per level after the first and counts every ability separately', () => {
    expect(pointsLeft(1, {})).toBe(0);
    expect(pointsLeft(20, {})).toBe(19);
    expect(pointsLeft(5, { smoke: 2, radar: 1 })).toBe(1);
    expect(abilityRank('akinci', 'smoke', { smoke: 2 })).toBe(3);
    expect(abilityRank('akinci', 'radar', { smoke: 2 })).toBe(1);
    expect(ABILITIES).toEqual(['signature', 'turbo', 'smoke', 'cloak', 'illusion', 'radar']);
  });

  it('gives the class affinity one free rank, within the same five-rank cap', () => {
    expect(abilityRank('akinci', 'illusion', {})).toBe(2);
    expect(abilityRank('muhafiz', 'smoke', {})).toBe(2);
    expect(abilityRank('kilavuz', 'radar', {})).toBe(2);
    expect(abilityRank('akinci', 'illusion', { illusion: 4 })).toBe(5);
    expect(pointsLeft(1, {})).toBe(0);
    expect(flightRanks('kilavuz', 'radar', { signature: 2, smoke: 3, turbo: 1 })).toEqual({ signature: 3, tactic: 2, turbo: 2 });
  });

  it('grows the effect or duration by 10% per rank and shortens cooldown 5%, without changing ship speed', () => {
    expect(abilityStats('akinci', 'signature', 1)).toMatchObject({ power: T.missileDamage, cooldown: 14 });
    expect(abilityStats('akinci', 'signature', 5).power).toBeCloseTo(T.missileDamage * 1.4);
    expect(abilityStats('muhafiz', 'signature', 5).power).toBeCloseTo(T.wardHp * 1.4);
    expect(abilityStats('kilavuz', 'signature', 5).power).toBeCloseTo(T.mendHp * 1.4);
    for (const ability of ['smoke', 'cloak', 'illusion', 'radar', 'turbo'] as const) {
      const base = abilityStats('akinci', ability, 1); const top = abilityStats('akinci', ability, 5);
      expect(top.duration).toBeCloseTo(base.duration * 1.4);
      expect(top.cooldown).toBeCloseTo(base.cooldown * 0.8);
    }
  });

  it('carries the effective ranks in the own snapshot for prediction', () => {
    const world = createSandboxWorld({ bots: 0, layout: layoutWith() });
    world.pilot.ranks = { signature: 4, tactic: 5, turbo: 3 };
    expect(unpackPilot(packPilot(world.pilot)).ranks).toEqual(world.pilot.ranks);
  });

  it('applies signature power to a shield, actual repaired hull and the missile fixed at launch', () => {
    const shield = createSandboxWorld({ bots: 0, ship: 'muhafiz', layout: layoutWith() });
    shield.pilot.ranks.signature = 5;
    castSignature(shield, shield.pilot, { ...createInput(), signature: true, signatureTarget: shield.pilot.id });
    expect(shield.pilot.shieldHp).toBeCloseTo(112);
    expect(shield.pilot.signatureCooldown).toBe(528);
    const heal = createSandboxWorld({ bots: 0, ship: 'kilavuz', layout: layoutWith() });
    heal.pilot.ranks.signature = 5; heal.pilot.hull = 100;
    castSignature(heal, heal.pilot, { ...createInput(), signature: true, signatureTarget: heal.pilot.id });
    for (let i = 0; i < T.mendDuration * T.tickRate; i++) stepSandboxWorld(heal, createInput());
    expect(heal.pilot.hull).toBeCloseTo(268, 6);
    const missile = createSandboxWorld({ bots: 0, ship: 'akinci', layout: layoutWith() });
    missile.pilot.ranks.signature = 5; missile.pilot.lockTarget = 12; missile.pilot.lockTicks = T.lockTime * T.tickRate;
    castSignature(missile, missile.pilot, { ...createInput(), signature: true });
    expect(missile.missiles.find(m => m.life > 0)?.damage).toBeCloseTo(112);
    missile.pilot.ranks.signature = 1;
    expect(missile.missiles.find(m => m.life > 0)?.damage).toBeCloseTo(112);
  });

  it('uses the same grown cloak and turbo on the authoritative and predicted ship', () => {
    const server = createSandboxWorld({ bots: 0, layout: layoutWith() });
    const client = createSandboxWorld({ bots: 0, layout: layoutWith() });
    for (const world of [server, client]) {
      world.pilot.ranks = { signature: 1, tactic: 5, turbo: 5 }; world.pilot.tactic = 'cloak';
    }
    const input = { ...createInput(), cloak: true, turbo: true };
    stepSandboxWorld(server, { ...input });
    predictPilot(client, { ...input });
    expect(client.pilot.cloak).toBe(Math.round(T.cloakDuration * 1.4 * T.tickRate));
    expect(packPilot(client.pilot)).toEqual(packPilot(server.pilot));
    expect(client.pilot.cloakCooldown).toBe(Math.round(T.cloakCooldown * 0.8 * T.tickRate));
  });
});
