import { describe, expect, it } from 'vitest';
import { ARENA_TUNING as T, createFlightState, createMesh, type ArenaLayout, type ArenaObstacle } from '@astera/rules/arena';
import { findLandingTarget } from '../../src/arena/landing.js';

const layout = (obstacles: ArenaObstacle[], meshes: ArenaLayout['meshes'] = []): ArenaLayout => ({
  version: 0, radius: 3000, halfHeight: 3000, entries: [], exits: [], structures: [], fields: [], dust: [], farmSpots: [],
  obstacles, meshes, deposits: [], depositKinds: [],
});

/** A 2 m cube centred on the origin, wound outwards. */
const cube = createMesh([-1, -1, -1, 1, -1, -1, -1, 1, -1, 1, 1, -1, -1, -1, 1, 1, -1, 1, -1, 1, 1, 1, 1, 1],
  [1, 3, 7, 1, 7, 5, 0, 4, 6, 0, 6, 2, 2, 6, 7, 2, 7, 3, 0, 1, 5, 0, 5, 4, 4, 5, 7, 4, 7, 6, 0, 2, 3, 0, 3, 1]);

/** Y2: the touchdown point is on the surface the pilot sees, lifted by the hull's belly. */
describe('landing target', () => {
  it('sits on a round rock, the belly\'s height off it', () => {
    const target = findLandingTarget(layout([{ id: 0, kind: 'rock', shape: 'sphere', p: { x: 0, y: 0, z: 200 }, radius: 50 }]), createFlightState());
    expect(target?.point.z).toBeCloseTo(200 - 50 - T.bodyRadius, 9);
    expect(target?.normal.z).toBeCloseTo(-1, 9);
  });

  it('sits on a mesh rock\'s real face, not on its bounding ball', () => {
    const rock: ArenaObstacle = { id: 0, kind: 'rock', shape: 'mesh', mesh: 0, p: { x: 0, y: 0, z: 200 }, q: { x: 0, y: 0, z: 0, w: 1 },
      scale: 40, radius: cube.radius * 40 };
    const target = findLandingTarget(layout([rock], [cube]), createFlightState());
    expect(target?.point.x).toBeCloseTo(0, 9);
    expect(target?.point.z).toBeCloseTo(200 - 40 - T.bodyRadius, 9);
    expect(target?.normal.z).toBeCloseTo(-1, 9);
  });

  // The cube's corners reach √3 × 40 ≈ 69 m: its bounding ball is 25 m off a ship 94 m from
  // its centre, its nearest face 54 m. Only a surface within 30 m counts as already beside the hull.
  const beside = (x: number): ArenaObstacle => ({ id: 0, kind: 'rock', shape: 'mesh', mesh: 0, p: { x, y: 0, z: 0 },
    q: { x: 0, y: 0, z: 0, w: 1 }, scale: 40, radius: cube.radius * 40 });

  it('measures how near a rock beside the hull is to its real face, not to its bounding ball', () => {
    expect(findLandingTarget(layout([beside(94.3)], [cube]), createFlightState())).toBeNull();
    const target = findLandingTarget(layout([beside(60)], [cube]), createFlightState());
    expect(target?.point.x).toBeCloseTo(20 - T.bodyRadius, 9);
    expect(target?.normal.x).toBeCloseTo(-1, 9);
  });
});
