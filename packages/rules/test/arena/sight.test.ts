import { describe, expect, it } from 'vitest';
import {
  createInput, createPilot, createSandboxWorld, pilotInSight, pilotVisible, type ArenaObstacle, type Pilot, type Vec3,
} from '../../src/arena/index.js';
import { thinkBot } from '../../src/arena/bots.js';
import { box, layoutWith, sphere } from './helpers.js';

/**
 * Owner 2026-10-22 (15-yarik-haritasi §6): rock and structures cut the target marker, the lock
 * and the map dot. The server still sends the position (the ship is drawn when it comes out);
 * only seeing *through* stone is gone, so a chase can be lost in a tunnel.
 */
const at = (id: number, p: Vec3): Pilot => { const pilot = createPilot(id); Object.assign(pilot.p, p); return pilot; };
const world = (obstacles: ArenaObstacle[]) => ({ layout: layoutWith(obstacles), smoke: [] });
const a = at(1, { x: 0, y: 0, z: -400 });
const b = at(2, { x: 0, y: 0, z: 400 });

describe('line of sight', () => {
  it('is cut by a rock between two pilots, while the position stays known', () => {
    const rocky = world([sphere(0, 0, 0, 0, 60)]);
    expect(pilotInSight(rocky, a, b)).toBe(false);
    expect(pilotVisible(rocky, a, b)).toBe(true);
  });

  it('is cut by a structure between two pilots', () => {
    expect(pilotInSight(world([box(0, 0, 0, 0, 80, 40, 20)]), a, b)).toBe(false);
  });

  it('stays open past a rock that is beside the line', () => {
    expect(pilotInSight(world([sphere(0, 120, 0, 0, 60)]), a, b)).toBe(true);
    expect(pilotInSight(world([]), a, b)).toBe(true);
  });

  it('is open only when the pilot is visible at all: cloak still hides in the clear', () => {
    const cloaked = at(3, { x: 0, y: 0, z: 400 }); cloaked.cloak = 10;
    expect(pilotInSight(world([]), a, cloaked)).toBe(false);
  });
});

describe('a bot behind rock', () => {
  it('does not pick a pilot it cannot see through stone, and does when the rock is gone', () => {
    const think = (obstacles: ArenaObstacle[]): number => {
      const sandbox = createSandboxWorld({ layout: layoutWith(obstacles) });
      const hunter = sandbox.drones.find(bot => sandbox.brains.get(bot.id)?.role === 'hunter');
      const brain = hunter && sandbox.brains.get(hunter.id);
      if (!hunter || !brain) throw new Error('no hunter');
      for (const bot of sandbox.drones) if (bot !== hunter) bot.phase = 'dead';
      Object.assign(sandbox.pilot.p, { x: 0, y: 0, z: 300 });
      Object.assign(hunter.p, { x: 0, y: 0, z: -300 }); hunter.q = { x: 0, y: 0, z: 0, w: 1 };
      thinkBot(sandbox, hunter, brain, createInput());
      return brain.mode === 'engage' ? brain.target : -1;
    };
    expect(think([])).toBe(0);
    expect(think([sphere(0, 0, 0, 0, 80)])).toBe(-1);
  });
});
