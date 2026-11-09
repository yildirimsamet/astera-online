import { starterGalaxyCentre, toWorld, type Vec3 } from '@astera/rules';
import { describe, expect, it } from 'vitest';
import { galaxySchema } from '../src/api/schemas.js';
import { VESSEL_LENGTH } from '../src/galaxy/scene.js';
import { landedWorld, pressedWorld } from '../src/starter/jumpWorld.js';

/**
 * THE JUMP FLIES THROUGH THE REAL GALAXIES (owner, 2026-11-09: "sahte bir sahneden değil"). The scene is
 * built from what the client holds: the ship's berth and neighbours in its own galaxy, the main galaxy's
 * worlds, and the new world at the address the server gave. All in the main galaxy's frame.
 */
const planet = (over: Record<string, unknown>) => galaxySchema.shape.planets.element.parse({
  intel: 'UNKNOWN', isSelf: false, isOwned: false, state: { kind: 'NORMAL' }, ...over,
});
const at = (x: number, y: number, z: number): Vec3 => ({ x, y, z });
const shift = (p: Vec3, by: Vec3): Vec3 => ({ x: p.x + by.x, y: p.y + by.y, z: p.z + by.z });

describe('the galaxies the jump crosses', () => {
  const centre = starterGalaxyCentre(2);
  const starter = [
    planet({ id: 'me', body: 'VESSEL', look: 'RENEWED', isSelf: true, position: at(100, 0, 50) }),
    planet({ id: 'neighbour', body: 'VESSEL', look: 'PATCHED', position: at(-200, 10, 0) }),
    planet({ id: 'outpost', body: 'OUTPOST', outpost: true, position: at(300, -20, 40) }),
  ];
  const world = pressedWorld({
    ordinal: 2, berth: at(100, 0, 50), landing: at(1200, 40, -900), planetId: 'new-world',
    starter, main: [at(1000, 0, 0), at(1200, 40, -900), at(-500, 0, 300)],
  });

  it('starts at the berth, moved into the main galaxy\'s frame', () => {
    expect(world.from).toEqual(toWorld(shift(at(100, 0, 50), centre)));
  });

  it('ends at the new world, which is drawn once, under its own id', () => {
    expect(world.planet).toEqual(toWorld(at(1200, 40, -900)));
    const here = world.worlds.filter(node => Math.hypot(node.position[0] - world.planet[0], node.position[1] - world.planet[1], node.position[2] - world.planet[2]) < 0.01);
    expect(here.map(node => node.id)).toEqual(['new-world']);
    expect(world.radius).toBeGreaterThan(0);
    expect(world.ship).toBe(VESSEL_LENGTH);
  });

  it('keeps the other main worlds where they are', () => {
    expect(world.worlds.some(node => node.position[0] === toWorld(at(-500, 0, 300))[0])).toBe(true);
  });

  it('draws the neighbours as ships and the outposts as worlds, in their galaxy, and not the ship itself', () => {
    expect(world.ships.map(ship => ship.id)).toEqual(['neighbour']);
    expect(world.ships[0]!.position).toEqual(toWorld(shift(at(-200, 10, 0), centre)));
    const outpost = world.worlds.find(node => node.id === 'outpost');
    expect(outpost?.position).toEqual(toWorld(shift(at(300, -20, 40), centre)));
    expect(world.worlds.some(node => node.id === 'me' || node.id === 'neighbour')).toBe(false);
  });
});

describe('the jump seen again from the new world', () => {
  const main = [planet({ id: 'home', isSelf: true, isOwned: true, position: at(800, 0, 100) }), planet({ id: 'other', position: at(-400, 0, 0) })];

  it('flies in from the first galaxy to the commander\'s world', () => {
    const world = landedWorld(main, 3);
    expect(world?.planet).toEqual(toWorld(at(800, 0, 100)));
    expect(world?.from).toEqual(toWorld(starterGalaxyCentre(3)));
    expect(world?.worlds.map(node => node.id).sort()).toEqual(['home', 'other']);
  });

  it('has nothing to show before the commander\'s world is known', () => {
    expect(landedWorld(main.slice(1), 1)).toBeNull();
  });
});
