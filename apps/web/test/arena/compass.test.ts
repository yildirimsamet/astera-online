import { describe, expect, it } from 'vitest';
import { createMesh, type ArenaLayout, type ArenaObstacle } from '@astera/rules/arena';
import { nearestDeposit } from '../../src/arena/compass.js';

/** A 2 m cube centred on the origin, wound outwards. */
const cube = createMesh([-1, -1, -1, 1, -1, -1, -1, 1, -1, 1, 1, -1, -1, -1, 1, 1, -1, 1, -1, 1, 1, 1, 1, 1],
  [1, 3, 7, 1, 7, 5, 0, 4, 6, 0, 6, 2, 2, 6, 7, 2, 7, 3, 0, 1, 5, 0, 5, 4, 4, 5, 7, 4, 7, 6, 0, 2, 3, 0, 3, 1]);

const rock = (id: number, x: number, scale: number): ArenaObstacle => ({ id, kind: 'rock', shape: 'mesh', mesh: 0,
  p: { x, y: 0, z: 0 }, q: { x: 0, y: 0, z: 0, w: 1 }, scale, radius: cube.radius * scale });

const world = (obstacles: ArenaObstacle[], kinds: number[]) => ({
  layout: {
    version: 0, radius: 3000, halfHeight: 3000, entries: [], exits: [], structures: [], fields: [], dust: [], farmSpots: [],
    obstacles, meshes: [cube], deposits: obstacles.map(o => o.id), depositKinds: kinds,
  } satisfies ArenaLayout,
  minerals: obstacles.map(() => 100), dry: obstacles.map(() => false),
});

/** Y2: the farmer's compass measures to the face the pilot sees, not to a bounding ball. */
describe('deposit compass', () => {
  it('points at the deposit whose real surface is nearest', () => {
    // A: corners 104 m out, face 60 m out, centre 120 m away → bounding gap 16 m, face 60 m.
    // B: corners 35 m out, face 20 m out, centre 60 m away → bounding gap 25 m, face 40 m.
    const w = world([rock(0, 120, 60), rock(1, -60, 20)], [0, 2]);
    const found = nearestDeposit(w, { x: 0, y: 0, z: 0 });
    expect(found).toMatchObject({ index: 1, kind: 2 });
    expect(found?.distance).toBeCloseTo(40, 9);
  });

  it('skips a dry deposit, one almost mined out, and anything past its reach', () => {
    const w = world([rock(0, 100, 20), rock(1, -100, 20)], [0, 1]);
    w.dry[0] = true; w.minerals[1] = 5;
    expect(nearestDeposit(w, { x: 0, y: 0, z: 0 })).toBeNull();
    w.minerals[1] = 6;
    expect(nearestDeposit(w, { x: 0, y: 0, z: 0 }, 79)).toBeNull();
    expect(nearestDeposit(w, { x: 0, y: 0, z: 0 }, 81)?.index).toBe(1);
  });
});
