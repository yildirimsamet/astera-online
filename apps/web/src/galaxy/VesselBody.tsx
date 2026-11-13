import { useLoader } from '@react-three/fiber';
import { Suspense, useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import type { VesselHull } from '@astera/rules';
import type { DamageSpot } from './mainSky.js';
import { SkinAssetBoundary } from './SkinAssetBoundary.js';
import { VesselBurn } from './VesselBurn.js';

type Hulled = THREE.Mesh<THREE.BufferGeometry, THREE.Material | THREE.Material[]>;
const isMesh = (node: THREE.Object3D): node is Hulled => node instanceof THREE.Mesh;

const meshopt = (loader: GLTFLoader): void => { loader.setMeshoptDecoder(MeshoptDecoder); };

/** Starts the download early, so the ship is there when the scene that shows it opens. */
export const preloadVessel = (file: string): void => { useLoader.preload(GLTFLoader, file, meshopt); };

/** How much of its own texture a hull gives back as light: never a dark smudge, no real light paid for. */
const SELF_LIGHT = 0.24;

/**
 * THE COLONY SHIP'S BODY, AS EVERY SCENE DRAWS IT: its own model for the state it is in, lit from
 * its own texture so it never reads dim, a thin light rim like the ships flying in the galaxy, and
 * its damage burning on it. Model space: nose along +X, about one unit long.
 */
export function VesselBody({ file, hull, damage, rim = '#8fe8ff', rimOpacity = 0.34, rimWidth = 0.006 }: {
  file: string;
  hull: VesselHull;
  /** Smoke, flame and sparks over the bays (`VesselBurn`): a few batched draws and no light. */
  damage: readonly DamageSpot[];
  rim?: string;
  rimOpacity?: number;
  rimWidth?: number;
}) {
  const gltf = useLoader(GLTFLoader, file, meshopt);
  const { body, outline, owned } = useMemo(() => {
    const owned: THREE.Material[] = [];
    const body = gltf.scene.clone(true);
    body.traverse((node) => {
      if (!isMesh(node)) return;
      const source = node.material;
      const list = Array.isArray(source) ? source : [source];
      const lifted = list.map((material) => {
        const copy = material.clone();
        if (copy instanceof THREE.MeshStandardMaterial) {
          copy.emissiveMap = copy.map;
          copy.emissive = new THREE.Color(SELF_LIGHT, SELF_LIGHT, SELF_LIGHT);
          copy.roughness = Math.max(0.35, Math.min(0.85, copy.roughness));
        }
        owned.push(copy);
        return copy;
      });
      node.material = Array.isArray(source) ? lifted : (lifted[0] ?? source);
    });
    const outline = body.clone(true);
    const rimMaterial = new THREE.ShaderMaterial({
      uniforms: { uColour: { value: new THREE.Color(rim) }, uOpacity: { value: rimOpacity }, uWidth: { value: rimWidth } },
      transparent: true,
      depthWrite: false,
      side: THREE.BackSide,
      blending: THREE.AdditiveBlending,
      vertexShader: 'uniform float uWidth; void main() { gl_Position = projectionMatrix * modelViewMatrix * vec4(position + normal * uWidth, 1.0); }',
      fragmentShader: 'uniform vec3 uColour; uniform float uOpacity; void main() { gl_FragColor = vec4(uColour, uOpacity); }',
    });
    rimMaterial.toneMapped = false;
    owned.push(rimMaterial);
    outline.traverse((node) => { if (isMesh(node)) node.material = rimMaterial; });
    return { body, outline, owned };
  }, [gltf.scene, rim, rimOpacity, rimWidth]);
  useEffect(() => () => { owned.forEach((material) => { material.dispose(); }); }, [owned]);
  return (
    <group>
      <primitive object={outline} />
      <primitive object={body} />
      {/* Its own boundary: fire art that fails or is still loading never takes the hull with it. */}
      <SkinAssetBoundary fallback={null}>
        <Suspense fallback={null}><VesselBurn hull={hull} damage={damage} /></Suspense>
      </SkinAssetBoundary>
    </group>
  );
}
