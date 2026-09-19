import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { createViewMemo, viewChanged } from '../src/galaxy/viewMemo.js';

/**
 * A STILL CAMERA DOES NOT NEED THE BILLBOARDS FACED AGAIN. 2026-09-19.
 *
 * Every drawn frame re-faced every world, hitbox and marker at the camera — 1,230
 * worlds in a full thousand-seat galaxy — and uploaded the lot, thirty times a
 * second at the ambient floor with the camera not moving at all. The answer only
 * changes when the view does, or the worlds do.
 */

const camera = (): THREE.PerspectiveCamera => {
  const c = new THREE.PerspectiveCamera(45, 1, 0.1, 600);
  c.position.set(0, 0, 10);
  c.updateMatrixWorld();
  return c;
};

describe('whether the view has changed', () => {
  it('answers yes the first time, so the first frame is always faced', () => {
    const memo = createViewMemo();
    expect(viewChanged(memo, camera(), [], 800)).toBe(true);
  });

  it('answers no while nothing moves', () => {
    const memo = createViewMemo();
    const c = camera();
    const nodes: unknown[] = [];
    viewChanged(memo, c, nodes, 800);
    expect(viewChanged(memo, c, nodes, 800)).toBe(false);
    expect(viewChanged(memo, c, nodes, 800)).toBe(false);
  });

  it('answers yes when the camera moves or turns', () => {
    const memo = createViewMemo();
    const c = camera();
    const nodes: unknown[] = [];
    viewChanged(memo, c, nodes, 800);
    c.position.x += 0.001;
    c.updateMatrixWorld();
    expect(viewChanged(memo, c, nodes, 800)).toBe(true);
    c.rotation.y += 0.001;
    c.updateMatrixWorld();
    expect(viewChanged(memo, c, nodes, 800)).toBe(true);
    expect(viewChanged(memo, c, nodes, 800)).toBe(false);
  });

  it('answers yes when the lens changes', () => {
    const memo = createViewMemo();
    const c = camera();
    const nodes: unknown[] = [];
    viewChanged(memo, c, nodes, 800);
    c.fov = 50;
    c.updateProjectionMatrix();
    expect(viewChanged(memo, c, nodes, 800)).toBe(true);
  });

  it('answers yes when the worlds or the viewport change', () => {
    const memo = createViewMemo();
    const c = camera();
    const nodes: unknown[] = [];
    viewChanged(memo, c, nodes, 800);
    expect(viewChanged(memo, c, [], 800)).toBe(true);
    const same: unknown[] = [];
    viewChanged(memo, c, same, 800);
    expect(viewChanged(memo, c, same, 640)).toBe(true);
  });
});
