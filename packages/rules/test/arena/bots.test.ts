import { describe, expect, it } from 'vitest';
import {
  ARENA_TUNING as T, createInput, createSandboxWorld, stepSandboxWorld, type ArenaWorld, type Pilot,
} from '../../src/arena/index.js';

const rest = createInput();
const alive = (p: Pilot): boolean => p.phase === 'flying' || p.phase === 'fuelOut';
function run(world: ArenaWorld, seconds: number, each?: () => void): void {
  for (let i = 0; i < seconds * T.tickRate; i++) {
    stepSandboxWorld(world, rest);
    each?.();
  }
}

describe('sandbox bots', () => {
  it('fly a minute in the real layout without NaN, leaving the disc or sitting dead in space', () => {
    const world = createSandboxWorld();
    world.pilot.cloak = 99999;
    expect(world.drones.length).toBe(3);
    const moved = new Map<number, number>();
    run(world, 60, () => {
      for (const bot of world.drones) {
        expect(Number.isFinite(bot.p.x + bot.p.y + bot.p.z + bot.q.w)).toBe(true);
        expect(Math.sqrt(bot.p.x * bot.p.x + bot.p.z * bot.p.z)).toBeLessThanOrEqual(T.arenaRadius);
        if (alive(bot)) moved.set(bot.id, (moved.get(bot.id) ?? 0) + bot.s / T.tickRate);
      }
    });
    for (const bot of world.drones) expect(moved.get(bot.id) ?? 0).toBeGreaterThan(300);
  });

  it('include a miner that lands on a crystal and fills its hold', () => {
    const world = createSandboxWorld();
    world.pilot.cloak = 99999;
    const miner = world.drones.find(bot => world.brains.get(bot.id)?.role === 'miner');
    if (!miner) throw new Error('no miner bot');
    let mined = false;
    const start = miner.cargo;
    run(world, 120, () => { if (miner.mining && miner.cargo > start) mined = true; });
    expect(mined).toBe(true);
  });

  it('include a hunter that attacks a visible pilot and leaves a cloaked one alone', () => {
    const visible = createSandboxWorld();
    visible.pilot.shield = 0;
    const hunter = visible.drones.find(bot => visible.brains.get(bot.id)?.role === 'hunter');
    if (!hunter) throw new Error('no hunter bot');
    hunter.p.x = visible.pilot.p.x; hunter.p.y = visible.pilot.p.y; hunter.p.z = visible.pilot.p.z - 500;
    run(visible, 25);
    expect(visible.pilot.hull).toBeLessThan(T.hull);

    const hidden = createSandboxWorld();
    hidden.pilot.shield = 0;
    const stalker = hidden.drones.find(bot => hidden.brains.get(bot.id)?.role === 'hunter');
    if (!stalker) throw new Error('no hunter bot');
    stalker.p.x = hidden.pilot.p.x; stalker.p.y = hidden.pilot.p.y; stalker.p.z = hidden.pilot.p.z - 500;
    run(hidden, 25, () => { hidden.pilot.cloak = 99999; });
    expect(hidden.pilot.hull).toBe(T.hull);
  });
});
