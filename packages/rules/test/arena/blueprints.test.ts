import { describe, expect, it } from 'vitest';
import { blueprintPorts, blueprintPoses, openPorts, quarter, type Blueprint, type StructureMark } from '../../src/arena/index.js';

/**
 * V6d (16-yarik-v6-plani §7): a building is kit pieces put together port to port on the 20 m
 * grid. A plan only turns pieces by quarter turns, so every peer places them exactly.
 */
const port = (p: [number, number, number], d: [number, number, number]): StructureMark => ({ p, d });
const kit = [
  { key: 'corridor', ports: [port([0, 0, 40], [0, 0, 1]), port([0, 0, -40], [0, 0, -1])] },
  { key: 'cap', ports: [port([0, 0, -10], [0, 0, -1])] },
  { key: 'tee', ports: [port([0, 0, 60], [0, 0, 1]), port([60, 0, 0], [1, 0, 0]), port([0, 0, -60], [0, 0, -1])] },
];
// cap · corridor · cap, along X: the corridor turned a quarter, its ports on ±X.
const closed: Blueprint = { key: 'closed', pieces: [
  { key: 'corridor', at: [0, 0, 0], turn: 1 },
  { key: 'cap', at: [50, 0, 0], turn: 1 },
  { key: 'cap', at: [-50, 0, 0], turn: 3 },
] };

describe('quarter turns', () => {
  it('turns local +Z onto +X, −Z, −X in steps, about +Y', () => {
    expect(quarter(0, [0, 5, 1])).toEqual([0, 5, 1]);
    expect(quarter(1, [0, 5, 1])).toEqual([1, 5, 0]);
    expect(quarter(2, [0, 5, 1])).toEqual([0, 5, -1]);
    expect(quarter(3, [0, 5, 1])).toEqual([-1, 5, 0]);
    expect(quarter(1, [1, 0, 0])).toEqual([0, 0, -1]);
  });
});

describe('plan ports', () => {
  it('places every port in the plan frame, turned with its piece', () => {
    const ports = blueprintPorts(closed, kit);
    expect(ports).toHaveLength(4);
    expect(ports[0]).toEqual({ piece: 0, p: [40, 0, 0], d: [1, 0, 0] });
    expect(ports[2]).toEqual({ piece: 1, p: [40, 0, 0], d: [-1, 0, 0] });
  });

  it('finds no open port when every port meets one facing it', () => {
    expect(openPorts(closed, kit)).toEqual([]);
  });

  it('reports a port left open, a port met by a piece facing the same way, and a doubled piece', () => {
    const missing: Blueprint = { key: 'missing', pieces: closed.pieces.slice(0, 2) };
    expect(openPorts(missing, kit).map(p => p.p)).toEqual([[-40, 0, 0]]);
    const backwards: Blueprint = { key: 'backwards', pieces: [
      { key: 'corridor', at: [0, 0, 0], turn: 1 }, { key: 'cap', at: [30, 0, 0], turn: 3 }, { key: 'cap', at: [-50, 0, 0], turn: 3 },
    ] };
    expect(openPorts(backwards, kit)).toHaveLength(2);
    const doubled: Blueprint = { key: 'doubled', pieces: [...closed.pieces, { key: 'cap', at: [50, 0, 0], turn: 1 }] };
    expect(openPorts(doubled, kit).length).toBeGreaterThan(0);
  });

  it('refuses a piece the kit does not have', () => {
    expect(() => blueprintPorts({ key: 'x', pieces: [{ key: 'nope', at: [0, 0, 0], turn: 0 }] }, kit)).toThrow(/nope/);
  });
});

describe('plan poses in the level', () => {
  it('turns the whole plan to face (fx, fz) and moves it to p, without trig', () => {
    // The plan's +Z onto world +X: the corridor (its +Z along plan +X) now runs along world −Z.
    const poses = blueprintPoses(closed, { x: 1000, y: 50, z: -200 }, 1, 0);
    expect(poses[0]).toEqual({ key: 'corridor', p: { x: 1000, y: 50, z: -200 }, fx: 0, fz: -1 });
    expect(poses[1]).toEqual({ key: 'cap', p: { x: 1000, y: 50, z: -250 }, fx: 0, fz: -1 });
  });

  it('keeps the plan as it is when it faces +Z', () => {
    const poses = blueprintPoses(closed, { x: 0, y: 0, z: 0 }, 0, 1);
    expect(poses.map(p => [p.p.x, p.p.z, p.fx, p.fz])).toEqual([[0, 0, 1, 0], [50, 0, 1, 0], [-50, 0, -1, 0]]);
  });
});
