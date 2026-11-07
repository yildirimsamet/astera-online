import { interceptAsteroid } from '@astera/rules';
import { describe, expect, it } from 'vitest';
import type { AsteroidView } from '../src/api/schemas.js';
import { asteroidVisualSeed } from '../src/galaxy/scene.js';
import { rockReachMinutes } from '../src/lib/rockReach.js';

const rock: AsteroidView = {
  id: 'AAAAAAAAAAAAAAAAAAAAAA', level: 1, ore: 800, oreRemaining: 629, crystalShare: 0.3, radius: 900, period: 600,
  phase: 0.2, inclination: 0, ascendingNode: 0, speed: 1, appearsAt: 0, expiresAt: 100_000, active: true,
  isotopeRich: false, deuteriumShare: null,
};

/** The list's time is the focus card's time: one solver, the server's (player test D-05). */
describe('how far away a rock is', () => {
  it('is the interception the launch would fly', () => {
    const home = { x: 0, y: 0, z: 0 };
    const expected = interceptAsteroid(home, 120, { ...rock, index: asteroidVisualSeed(rock.id), deuteriumShare: 0 }, 50)?.flightMinutes ?? null;
    expect(rockReachMinutes(home, 120, rock, 50)).toBe(expected);
  });

  it('is unknown without a home or a craft that moves', () => {
    expect(rockReachMinutes(undefined, 120, rock, 50)).toBeNull();
    expect(rockReachMinutes({ x: 0, y: 0, z: 0 }, 0, rock, 50)).toBeNull();
  });
});

/** Rocks were compared by ore alone; what they yield and how far they are took a tap each (D-05). */
describe('a rock in the target list', () => {
  it('says its ore, its crystal share and how far it is', async () => {
    const { rockLine } = await import('../src/lib/rockReach.js');
    expect(rockLine(rock, 12)).toBe('629 ore · 30% crystal · 12m away');
  });

  it('leaves the distance out where nothing can reach it', async () => {
    const { rockLine } = await import('../src/lib/rockReach.js');
    expect(rockLine(rock, null)).toBe('629 ore · 30% crystal');
  });
});
