import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { selectPlanetWarmupTargets } from '../src/galaxy/planetLod.js';
import { planetLook } from '../src/ui/assets.js';

const ids: string[] = [];
const looks = new Set<number>();
for (let i = 0; ids.length < 4; i += 1) {
  const id = `warmup-${String(i)}`;
  if (looks.has(planetLook(id))) continue;
  looks.add(planetLook(id)); ids.push(id);
}
const world = (id: string, z = 0) => ({ id, radius: 1, position: [0, 0, z] as const });
const camera = () => {
  const view = new THREE.PerspectiveCamera(45, 1, 0.1, 1000);
  view.position.z = 10; view.lookAt(0, 0, 0); view.updateMatrixWorld();
  return view;
};

describe('full planet preparation is limited to approaching visible looks', () => {
  it('chooses at most two distinct looks, nearest visible size first', () => {
    const nodes = [world(ids[0]!, -1), world(ids[1]!, 3), world(ids[2]!, 5), world(ids[3]!, -2)];
    expect(selectPlanetWarmupTargets(nodes, camera(), 200)).toEqual([ids[2], ids[1]]);
  });

  it('prepares a shared look only once', () => {
    const id = ids[0]!;
    const same = Array.from({ length: 100 }, (_, i) => `same-${String(i)}`).find(value => planetLook(value) === planetLook(id));
    if (!same) throw new Error('Missing shared-look fixture');
    expect(selectPlanetWarmupTargets([world(id, 5), world(same, 4), world(ids[1]!, 3)], camera(), 200))
      .toEqual([id, ids[1]]);
  });

  it('does not duplicate the opening world’s look', () => {
    expect(selectPlanetWarmupTargets([world(ids[0]!, 5), world(ids[1]!, 3)], camera(), 200, ids[0]))
      .toEqual([ids[1]]);
  });

  it('skips far worlds and large offscreen worlds', () => {
    const outside = { id: ids[0]!, radius: 15, position: [100, 0, 0] as const };
    expect(selectPlanetWarmupTargets([outside, world(ids[1]!, -100)], camera(), 200)).toEqual([]);
  });

  it('handles empty data and a viewport that has not been measured yet', () => {
    expect(selectPlanetWarmupTargets([], camera(), 200)).toEqual([]);
    expect(selectPlanetWarmupTargets([world(ids[0]!, 5)], camera(), 0)).toEqual([]);
  });

  it('starts preparing before the full-detail threshold, including a world already at full detail', () => {
    expect(selectPlanetWarmupTargets([world(ids[0]!)], camera(), 200)).toEqual([ids[0]]);
    expect(selectPlanetWarmupTargets([world(ids[0]!, 8)], camera(), 200)).toEqual([ids[0]]);
  });
});
