import { Children, isValidElement, type ReactNode, type RefObject } from 'react';
import { renderHook } from '@testing-library/react';
import { useFrame, useThree, type RootState } from '@react-three/fiber';
import * as THREE from 'three';
import { expect, it, vi } from 'vitest';
import { Shields, shieldInstances } from '../src/galaxy/Satellites.js';
import type { PlanetNode } from '../src/galaxy/scene.js';
vi.mock('@react-three/fiber', () => ({ useFrame: vi.fn(), useThree: vi.fn() }));

it('moves every shield attribute with its instance and avoids unchanged uploads', () => {
  const nodes = [
    { id: 'off', position: [100, 0, -10], radius: 1, shielded: true, intel: 'REMEMBERED' },
    { id: 'own', position: [0, 0, -10], radius: 1, shielded: true, intel: 'RESOLVED' },
  ] as PlanetNode[];
  vi.mocked(useThree).mockImplementation((selector) => selector?.({ size: { width: 800, height: 800 } } as RootState));
  const { result } = renderHook(() => Shields({ nodes, ownLevel: 5, ownId: 'own' }));
  interface Draw { args: [THREE.BufferGeometry, THREE.Material, number]; ref: RefObject<THREE.InstancedMesh | null> }
  const fragment = result.current;
  if (!isValidElement<{ children: ReactNode }>(fragment)) throw new Error('Missing shield draws');
  // Near domes first, then the lighter sphere a dome under a dozen pixels is drawn from.
  const [mesh, far] = Children.toArray(fragment.props.children).map((element) => {
    if (!isValidElement<Draw>(element)) throw new Error('Missing shield draw');
    const node = new THREE.InstancedMesh(...element.props.args);
    element.props.ref.current = node;
    return node;
  });
  if (!mesh || !far) throw new Error('Missing near or far domes');
  const camera = new THREE.PerspectiveCamera(60, 1, 1, 100);
  const state = { camera, clock: { elapsedTime: 1 } } as RootState;
  const frame = vi.mocked(useFrame).mock.lastCall![0];
  frame(state, 0);
  const domes = shieldInstances(nodes, 5, 'own');
  const check = (index: number) => {
    const dome = domes[index]!;
    expect(mesh.count).toBe(1);
    expect(mesh.visible).toBe(true);
    const colour = mesh.geometry.getAttribute('aColour');
    expect(colour.getX(0)).toBeCloseTo(dome.colour[0]);
    expect(colour.getY(0)).toBeCloseTo(dome.colour[1]);
    expect(colour.getZ(0)).toBeCloseTo(dome.colour[2]);
    expect(mesh.geometry.getAttribute('aOpacity').getX(0)).toBeCloseTo(dome.opacity);
    expect(mesh.geometry.getAttribute('aBreath').getX(0)).toBe(dome.breathes ? 1 : 0);
    expect(mesh.geometry.getAttribute('aPhase').getX(0)).toBe(dome.phase);
    const transform = new THREE.Matrix4(); mesh.getMatrixAt(0, transform);
    expect(new THREE.Vector3().setFromMatrixPosition(transform).toArray()).toEqual(dome.position);
  };
  check(1);
  const version = mesh.instanceMatrix.version;
  state.clock.elapsedTime = 5;
  frame(state, 0);
  expect(mesh.instanceMatrix.version).toBe(version);
  expect((mesh.material as THREE.ShaderMaterial).uniforms.uTime?.value).toBe(5);
  camera.position.x = 100;
  frame(state, 0);
  check(0);
  camera.position.x = 200;
  frame(state, 0);
  expect(mesh.count).toBe(0);
  // An empty bucket leaves the render list rather than walking it with nothing to draw.
  expect(mesh.visible).toBe(false);
  camera.position.x = 0;
  frame(state, 0);
  check(1);
  expect(far.count).toBe(0);
  // Backed far off, the same dome moves to the light sphere with its look intact.
  camera.position.z = 85;
  frame(state, 0);
  expect(mesh.count).toBe(0);
  expect(far.count).toBe(1);
  expect(far.visible).toBe(true);
  expect(far.geometry.getAttribute('aOpacity').getX(0)).toBeCloseTo(domes[1]!.opacity);
  const transform = new THREE.Matrix4(); far.getMatrixAt(0, transform);
  expect(new THREE.Vector3().setFromMatrixPosition(transform).toArray()).toEqual(domes[1]!.position);
});
