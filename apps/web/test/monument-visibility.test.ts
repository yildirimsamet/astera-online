import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { createMonumentVisibility } from '../src/galaxy/monumentVisibility.js';

const camera = () => {
  const result = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
  result.position.set(0, 0, 10);
  result.lookAt(0, 0, 0);
  result.updateMatrixWorld();
  return result;
};
const captions = [{ id: 'monument', position: [0, 0, -10] as const }];
const planets = [{ position: [0, 0, 0] as const, radius: 1 }];

describe('monument captions depend on opaque planet bodies and the view', () => {
  it('hides a caption behind a planet and keeps one in front of it visible', () => {
    const visibility = createMonumentVisibility();
    expect(visibility.update(camera(), captions, planets).has('monument')).toBe(true);
    expect(visibility.update(camera(), [{ id: 'near', position: [0, 0, 5] }], planets).size).toBe(0);
  });

  it('does not let a planet behind the caption or outside its sight line hide it', () => {
    const visibility = createMonumentVisibility();
    const view = camera();
    expect(visibility.update(view, captions, [{ position: [0, 0, -20], radius: 1 }]).size).toBe(0);
    expect(visibility.update(view, captions, [{ position: [3, 0, 0], radius: 1 }]).size).toBe(0);
  });

  it('uses the visible body radius, so touch-target padding does not hide a caption beside its limb', () => {
    const visibility = createMonumentVisibility(); const view = camera();
    expect(visibility.update(view, captions, [{ position: [0.95, 0, 0], radius: 1 }]).has('monument')).toBe(true);
    expect(visibility.update(view, captions, [{ position: [0.97, 0, 0], radius: 1 }]).size).toBe(0);
  });

  it('does no further sphere intersections in a stationary unchanged view', () => {
    const visibility = createMonumentVisibility(); const view = camera();
    const intersect = vi.spyOn(THREE.Ray.prototype, 'intersectSphere');
    const first = visibility.update(view, captions, planets);
    const calls = intersect.mock.calls.length;
    expect(calls).toBeGreaterThan(0);
    for (let i = 0; i < 20; i += 1) expect(visibility.update(view, captions, planets)).toBe(first);
    expect(intersect).toHaveBeenCalledTimes(calls);
  });

  it('rechecks after camera movement or projection changes and retains a result if its membership stays the same', () => {
    const visibility = createMonumentVisibility(); const view = camera();
    const intersect = vi.spyOn(THREE.Ray.prototype, 'intersectSphere');
    const first = visibility.update(view, captions, planets);
    const calls = intersect.mock.calls.length;
    view.zoom = 2; view.updateProjectionMatrix();
    expect(visibility.update(view, captions, planets)).toBe(first);
    expect(intersect.mock.calls.length).toBeGreaterThan(calls);
    view.position.x = 10;
    expect(visibility.update(view, captions, planets).size).toBe(0);
  });

  it('invalidates on planet membership, position and radius changes even if the camera stays still', () => {
    const visibility = createMonumentVisibility(); const view = camera();
    expect(visibility.update(view, captions, planets).size).toBe(1);
    expect(visibility.update(view, captions, []).size).toBe(0);
    expect(visibility.update(view, captions, [{ position: [2, 0, 0], radius: 3 }]).size).toBe(1);
    expect(visibility.update(view, captions, [{ position: [2, 0, 0], radius: 1 }]).size).toBe(0);
  });

  it('updates when a caption moves and clears removed monuments', () => {
    const visibility = createMonumentVisibility(); const view = camera();
    expect(visibility.update(view, captions, planets).has('monument')).toBe(true);
    expect(visibility.update(view, [{ id: 'monument', position: [0, 0, 5] }], planets).size).toBe(0);
    expect(visibility.update(view, [], planets).size).toBe(0);
  });

  it('handles an empty scene without invalidating unchanged results', () => {
    const visibility = createMonumentVisibility(); const view = camera();
    const empty: typeof planets = [];
    const first = visibility.update(view, captions, empty);
    expect(first.size).toBe(0);
    expect(visibility.update(view, captions, empty)).toBe(first);
  });

  it('keeps orthographic rays parallel rather than aiming from the camera position', () => {
    const view = new THREE.OrthographicCamera(-5, 5, 5, -5, 0.1, 100);
    view.position.z = 10; view.lookAt(0, 0, 0);
    expect(createMonumentVisibility().update(view,
      [{ id: 'offset', position: [2, 0, -10] }],
      [{ position: [2, 0, 0], radius: 0.1 }]).has('offset')).toBe(true);
  });
});
