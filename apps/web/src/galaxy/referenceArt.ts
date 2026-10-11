import { MOBILE_HULLS, type HullId } from '@astera/rules';
import * as THREE from 'three';
import manifest from './referenceArtManifest.json';
import { useSyncExternalStore } from 'react';

/** Local review pack. Production builds always use Astera's owned assets. */
export const LOCAL_REFERENCE_ART = import.meta.env.DEV && import.meta.env.VITE_ASTERA_REFERENCE_ART === 'true';

export const REFERENCE_ASTEROIDS = ['rock-s', 'rock-m', 'rock-l']
  .map(name => `/__ref/dist/selected/${name}.glb`);
/** Distinct reviewed hulls; cosmetic equipment still takes precedence. */
const shipArt: Partial<Record<HullId, { source: string; nozzles: number[][] }>> = manifest;
export const REFERENCE_SHIPS: Partial<Record<HullId, string>> = LOCAL_REFERENCE_ART
  ? Object.fromEntries(MOBILE_HULLS.filter(hull => shipArt[hull]).map(hull => [hull, `/__ref/prepared/ships/${hull.toLowerCase()}.glb`]))
  : {};

export const referenceShipLod = (url: string): string => url.replace(/\.glb$/, '_lod.glb');

/** Coordinates in the normalised, +Z-facing model before its vertical pose lift. */
export function referenceShipNozzles(url: string): readonly THREE.Vector3[] | undefined {
  if (failedShips.has(url)) return undefined;
  const hull = referenceHullId(url);
  return hull ? shipArt[hull]?.nozzles.map(at => new THREE.Vector3(at[0], at[1], at[2])) : undefined;
}

export const isReferenceShip = (url: string): boolean => LOCAL_REFERENCE_ART && url.startsWith('/__ref/prepared/ships/');

export const referenceHullId = (url: string): HullId | undefined => MOBILE_HULLS.find(hull => REFERENCE_SHIPS[hull] === url);

const PREPARED = new WeakMap<THREE.Object3D, THREE.Object3D>();
const failedShips = new Set<string>();
const listeners = new Set<() => void>();
const subscribeFailures = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
};
const failureVersion = (): number => failedShips.size;

/** Keep exhaust positions aligned when an optional hull falls back after a failed request. */
export function markReferenceShipFailed(url: string): void {
  if (!isReferenceShip(url) || failedShips.has(url)) return;
  failedShips.add(url);
  listeners.forEach(listener => { listener(); });
}

export function useReferenceShipFailures(): number {
  return useSyncExternalStore(subscribeFailures, failureVersion, failureVersion);
}

function isMesh(node: THREE.Object3D): node is THREE.Mesh {
  return (node as { isMesh?: boolean }).isMesh === true;
}

/** Correct UVs once without changing the GLTF cache or duplicating textures per craft. */
export function referenceShipScene(scene: THREE.Object3D, url: string): THREE.Object3D {
  if (!isReferenceShip(url)) return scene;
  const cached = PREPARED.get(scene);
  if (cached) return cached;
  const prepared = scene.clone(true);
  prepared.traverse(node => {
    if (!isMesh(node)) return;
    node.geometry = node.geometry.clone();
    const uv = node.geometry.getAttribute('uv');
    // Both prepared tiers retain UVs; an invalid mesh falls back at its asset boundary.
    for (let i = 0; i < uv.count; i++) uv.setY(i, 1 - uv.getY(i));
    uv.needsUpdate = true;
    const sources = Array.isArray(node.material) ? node.material : [node.material];
    const materials = sources.map((source: THREE.Material) => {
      const material = source.clone();
      if (material instanceof THREE.MeshStandardMaterial) {
        material.metalness = 0.5;
        material.roughness = 0.48;
        material.normalScale.y *= -1;
        material.side = THREE.DoubleSide;
      }
      return material;
    });
    node.material = Array.isArray(node.material) ? materials : materials[0]!;
  });
  PREPARED.set(scene, prepared);
  return prepared;
}
