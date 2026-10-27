import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { freezeStatic } from '../../src/arena/render/stage.js';

/**
 * Perf study 2026-10-22, CPU profile at Tersane: 7 % of a frame recomputed the matrices of
 * things that never move.
 */
describe('a frozen static object', () => {
  it('keeps its world pose and is skipped by every later matrix update', () => {
    const scene = new THREE.Scene();
    const rock = new THREE.Group(); rock.position.set(5, 6, 7);
    const part = new THREE.Mesh(); part.position.set(1, 0, 0); rock.add(part);
    freezeStatic(rock);
    scene.add(rock);
    const world = new THREE.Vector3().setFromMatrixPosition(part.matrixWorld);
    expect(world.toArray()).toEqual([6, 6, 7]);
    rock.position.set(100, 0, 0);
    scene.updateMatrixWorld();
    expect(new THREE.Vector3().setFromMatrixPosition(part.matrixWorld).toArray()).toEqual([6, 6, 7]);
    expect(rock.matrixWorldAutoUpdate).toBe(false);
  });
});
