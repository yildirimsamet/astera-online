import { describe, expect, it } from 'vitest';
import {
  ARENA_LAYOUT, ARENA_TUNING as T, createPilot, dustAt, hiddenByDust, pilotInSight, pilotVisible, type Pilot, type Vec3,
} from '../../src/arena/index.js';
import { layoutWith } from './helpers.js';

/**
 * V6f (16-yarik-v6-plani §5): a dust cloud cuts sight like smoke, but by depth. A line that runs
 * more than `dustSight` metres through one cloud is blind: inside, a pilot sees 350 m around;
 * from outside, a pilot a little way in is still seen, one deep in it is not.
 */
const cloud = { p: { x: 0, y: 0, z: 0 }, radius: 600 };
const dusty = { ...layoutWith(), dust: [cloud] };
const world = { layout: dusty, smoke: [] };
const at = (id: number, p: Vec3): Pilot => { const pilot = createPilot(id); Object.assign(pilot.p, p); return pilot; };

describe('dust cloud sight', () => {
  it('lets two pilots inside see each other within the dust sight', () => {
    expect(T.dustSight).toBe(350);
    expect(hiddenByDust(dusty, { x: -150, y: 0, z: 0 }, { x: 150, y: 0, z: 0 })).toBe(false);
    expect(hiddenByDust(dusty, { x: -200, y: 0, z: 0 }, { x: 200, y: 0, z: 0 })).toBe(true);
  });

  it('hides a pilot deep inside from one outside, but not one at the edge', () => {
    const outside = { x: 0, y: 0, z: -1500 };
    expect(hiddenByDust(dusty, outside, { x: 0, y: 0, z: 0 })).toBe(true);
    expect(hiddenByDust(dusty, outside, { x: 0, y: 0, z: -500 })).toBe(false);
  });

  it('does not touch a line that passes beside the cloud or only grazes it', () => {
    expect(hiddenByDust(dusty, { x: -2000, y: 0, z: 700 }, { x: 2000, y: 0, z: 700 })).toBe(false);
    // A chord 560 from the centre of a 600 m cloud is ~430 m long... and blind: depth, not entry, decides.
    expect(hiddenByDust(dusty, { x: -2000, y: 0, z: 560 }, { x: 2000, y: 0, z: 560 })).toBe(true);
    expect(hiddenByDust(dusty, { x: -2000, y: 0, z: 590 }, { x: 2000, y: 0, z: 590 })).toBe(false);
  });

  it('drops the marker and the lock, and the server stops sending the pilot', () => {
    const observer = at(1, { x: 0, y: 0, z: -1500 });
    const deep = at(2, { x: 0, y: 0, z: 0 });
    expect(pilotVisible(world, observer, deep)).toBe(false);
    expect(pilotInSight(world, observer, deep)).toBe(false);
    const edge = at(3, { x: 0, y: 0, z: -500 });
    expect(pilotInSight(world, observer, edge)).toBe(true);
  });

  it('tells which cloud a point is in', () => {
    expect(dustAt(dusty, { x: 100, y: 200, z: 0 })).toBe(cloud);
    expect(dustAt(dusty, { x: 700, y: 0, z: 0 })).toBeUndefined();
  });
});

describe('dust clouds in the v6 Rift', () => {
  const L = ARENA_LAYOUT;
  const planar = (p: Vec3): number => Math.hypot(p.x, p.z);

  it('places two 1–1.5 km clouds wholly in the outer frontier', () => {
    expect(L.dust).toHaveLength(2);
    for (const d of L.dust) {
      expect(d.radius).toBeGreaterThanOrEqual(500);
      expect(d.radius).toBeLessThanOrEqual(750);
      expect(planar(d.p) - d.radius).toBeGreaterThanOrEqual(7000);
      expect(planar(d.p) + d.radius).toBeLessThanOrEqual(12000);
    }
    const [a, b] = L.dust;
    if (!a || !b) throw new Error('no dust');
    expect(Math.hypot(a.p.x - b.p.x, a.p.z - b.p.z)).toBeGreaterThan(8000);
  });

  it('keeps entries, exits and structures out of the dust', () => {
    for (const d of L.dust) {
      for (const p of [...L.entries, ...L.exits]) expect(Math.hypot(p.x - d.p.x, p.y - d.p.y, p.z - d.p.z)).toBeGreaterThan(d.radius + 1000);
      for (const s of L.structures) expect(Math.hypot(s.p.x - d.p.x, s.p.y - d.p.y, s.p.z - d.p.z)).toBeGreaterThan(d.radius + s.scale);
    }
  });

  it('hides some farm: at least three farm spots in each cloud', () => {
    for (const d of L.dust) expect(L.farmSpots.filter(p => dustAt(L, p) === d).length).toBeGreaterThanOrEqual(3);
  });
});
