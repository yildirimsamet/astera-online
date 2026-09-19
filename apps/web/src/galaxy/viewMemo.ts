import type * as THREE from 'three';

/**
 * WHETHER A BILLBOARD PASS HAS ANYTHING NEW TO FACE. 2026-09-19.
 *
 * The worlds, their hitboxes and their markers are camera-facing quads, and each
 * pass re-faced every one and uploaded the lot on every drawn frame — thirty times
 * a second at the ambient floor with the camera perfectly still, for 1,230 worlds
 * in a full thousand-seat galaxy. The answer depends on the view (where the camera
 * is, where it looks, its lens, the viewport it is measured against) and on which
 * worlds there are, so a pass may skip whenever none of those moved.
 *
 * One memo per pass. The first call always answers yes.
 */
export interface ViewMemo {
  world: Float64Array;
  projection: Float64Array;
  subjects: unknown;
  height: number;
  primed: boolean;
}

export const createViewMemo = (): ViewMemo => ({
  world: new Float64Array(16),
  projection: new Float64Array(16),
  subjects: null,
  height: 0,
  primed: false,
});

const same = (kept: Float64Array, now: ArrayLike<number>): boolean => {
  for (let i = 0; i < 16; i += 1) if (kept[i] !== now[i]) return false;
  return true;
};

/** True when this pass has to run again, and remembers the view it is answering for. */
export function viewChanged(
  memo: ViewMemo,
  camera: THREE.Camera,
  subjects: unknown,
  height: number,
): boolean {
  const world = camera.matrixWorld.elements;
  const projection = camera.projectionMatrix.elements;
  if (
    memo.primed
    && memo.subjects === subjects
    && memo.height === height
    && same(memo.world, world)
    && same(memo.projection, projection)
  ) {
    return false;
  }
  memo.world.set(world);
  memo.projection.set(projection);
  memo.subjects = subjects;
  memo.height = height;
  memo.primed = true;
  return true;
}
