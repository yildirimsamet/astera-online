import { describe, expect, it } from 'vitest';
import { ARENA_PROTOCOL, ARENA_TUNING as T, SHIP_CLASSES, TACTICS, abilityStats, createInput, createSandboxWorld, flightRanks, packPilot,
  stepSandboxWorld, unpackPilot } from '../../src/arena/index.js';
import { layoutWith } from './helpers.js';

describe('two flight tactics', () => {
  it('supports every distinct pair in either slot on every ship, preserving each purchased rank', () => {
    for (const ship of SHIP_CLASSES) for (const first of TACTICS) for (const second of TACTICS) {
      if (first === second) continue;
      const world = createSandboxWorld({ bots: 0, layout: layoutWith([]), ship, tactic: first, tactic2: second });
      const p = world.pilot;
      p.ranks = flightRanks(ship, first, { [first]: 1, [second]: 2 }, second);
      stepSandboxWorld(world, { ...createInput(), [first]: true, [second]: true });
      const wait = (tactic: typeof first) => tactic === 'smoke' ? p.smokeCooldown : tactic === 'cloak' ? p.cloakCooldown : tactic === first ? p.tacticCooldown : p.tactic2Cooldown;
      expect(wait(first)).toBe(Math.round(abilityStats(ship, first, p.ranks.tactic).cooldown * T.tickRate));
      expect(wait(second)).toBe(Math.round(abilityStats(ship, second, p.ranks.tactic2).cooldown * T.tickRate));
    }
  });
  it('casts both selected tactics with their own ranks and independent waits', () => {
    const world = createSandboxWorld({ bots: 0, layout: layoutWith([]), ship: 'akinci', tactic: 'illusion', tactic2: 'radar' });
    world.pilot.ranks = flightRanks('akinci', 'illusion', { radar: 2 }, 'radar');
    stepSandboxWorld(world, { ...createInput(), illusion: true });
    expect(world.pilot.decoy).toBeGreaterThan(0);
    expect(world.pilot.tacticCooldown).toBe(Math.round(abilityStats('akinci', 'illusion', 2).cooldown * T.tickRate));
    stepSandboxWorld(world, { ...createInput(), radar: true });
    expect(world.pilot.scan).toBeGreaterThan(0);
    expect(world.pilot.tactic2Cooldown).toBe(Math.round(abilityStats('akinci', 'radar', 3).cooldown * T.tickRate));
    const wait = world.pilot.tactic2Cooldown;
    stepSandboxWorld(world, { ...createInput(), radar: true, smoke: true, cloak: true });
    expect(world.pilot.tactic2Cooldown).toBe(wait - 1);
    expect([world.pilot.smokeEmit, world.pilot.cloak]).toEqual([0, 0]);
  });

  it('allows smoke and cloak together and preserves their independent cooldowns', () => {
    const world = createSandboxWorld({ bots: 0, layout: layoutWith([]), tactic: 'smoke', tactic2: 'cloak' });
    stepSandboxWorld(world, { ...createInput(), smoke: true });
    stepSandboxWorld(world, { ...createInput(), cloak: true });
    expect(world.pilot.smokeEmit).toBeGreaterThan(0);
    expect(world.pilot.cloak).toBeGreaterThan(0);
    expect(world.pilot.smokeCooldown).toBeGreaterThan(0);
    expect(world.pilot.cloakCooldown).toBeGreaterThan(0);
  });

  it('round trips both slots, ranks and waits in a new protocol', () => {
    const world = createSandboxWorld({ bots: 0, tactic: 'radar', tactic2: 'illusion' });
    world.pilot.ranks = flightRanks('kilavuz', 'radar', { illusion: 2 }, 'illusion');
    world.pilot.tacticCooldown = 180; world.pilot.tactic2Cooldown = 240;
    expect(unpackPilot(packPilot(world.pilot))).toMatchObject({ tactic: 'radar', tactic2: 'illusion',
      tacticCooldown: 180, tactic2Cooldown: 240, ranks: { tactic: 2, tactic2: 3 } });
    expect(ARENA_PROTOCOL).toBeGreaterThan(15);
  });
});
