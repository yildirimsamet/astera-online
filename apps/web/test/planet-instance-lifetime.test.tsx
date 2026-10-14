import { act } from '@testing-library/react';
import { createRoot, extend } from '@react-three/fiber';
import * as THREE from 'three';
import { expect, it, vi } from 'vitest';
import { DefaultPlanetModel } from '../src/galaxy/PlanetSkinModel.js';

const assets = vi.hoisted(() => ({ read: vi.fn<() => { scene: THREE.Group }>() }));
vi.mock('@react-three/drei', () => ({
  useGLTF: Object.assign(() => assets.read(), { preload: vi.fn() }),
}));

extend({ InstancedMesh: THREE.InstancedMesh });

function isPlanetBody(mesh: THREE.Object3D | undefined): mesh is THREE.InstancedMesh<THREE.BufferGeometry, THREE.Material> {
  return mesh instanceof THREE.InstancedMesh
    && mesh.geometry instanceof THREE.BufferGeometry && mesh.material instanceof THREE.Material;
}

it.each(['full', 'far'] as const)('releases %s instance buffers on removal while retaining shared cached assets', async lod => {
  const source = new THREE.Group();
  source.add(new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), new THREE.MeshStandardMaterial()));
  assets.read.mockReturnValue({ scene: source });
  const canvas = document.createElement('canvas');
  const scene = new THREE.Scene();
  const root = createRoot(canvas);
  // Exercise Fiber's real reconciler and Three's real disposal without creating WebGL.
  await root.configure({
    scene,
    gl: () => ({ render: vi.fn(), setSize: vi.fn(), setPixelRatio: vi.fn(), domElement: canvas }),
    frameloop: 'never',
    size: { width: 100, height: 100, top: 0, left: 0 },
  });
  const worlds = [{ id: 'lifetime-world', position: [0, 0, -10] as [number, number, number], radius: 1, stance: 'self' as const, intel: 'RESOLVED' as const }];
  const body = (capacity: number) => <DefaultPlanetModel url={`lifetime-${lod}.glb`} lod={lod} nodes={worlds} capacity={capacity} />;
  const current = () => {
    const mesh = scene.getObjectByName(`planet-models-${lod}`);
    if (!isPlanetBody(mesh)) throw new Error('Missing planet instance');
    return mesh;
  };
  try {
    await act(async () => { root.render(body(4)); await Promise.resolve(); });
    const first = current();
    const geometry = first.geometry;
    const material = first.material;
    const disposeGeometry = vi.spyOn(geometry, 'dispose');
    const disposeMaterial = vi.spyOn(material, 'dispose');
    const disposeFirst = vi.spyOn(first, 'dispose');
    await act(async () => { root.render(null); await Promise.resolve(); });
    expect(disposeFirst).toHaveBeenCalledOnce();
    expect(disposeGeometry).not.toHaveBeenCalled();
    expect(disposeMaterial).not.toHaveBeenCalled();

    await act(async () => { root.render(body(4)); await Promise.resolve(); });
    const second = current();
    expect(second).not.toBe(first);
    expect(second.geometry).toBe(geometry);
    expect(second.material).toBe(material);
    const disposeSecond = vi.spyOn(second, 'dispose');
    await act(async () => { root.render(body(8)); await Promise.resolve(); });
    expect(disposeSecond).toHaveBeenCalledOnce();
    expect(current().instanceMatrix.count).toBe(8);
    expect(current().geometry).toBe(geometry);
    expect(current().material).toBe(material);
    expect(disposeGeometry).not.toHaveBeenCalled();
    expect(disposeMaterial).not.toHaveBeenCalled();
  } finally {
    await act(async () => { root.unmount(); await Promise.resolve(); });
  }
});
