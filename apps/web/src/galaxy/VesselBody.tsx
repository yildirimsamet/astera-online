import { useFrame, useLoader } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import type { VesselHull, VesselLook, VesselSystem } from '@astera/rules';
import { softGlow } from './Environment.js';
import { VESSEL_BAYS } from './mainSky.js';

type Hulled = THREE.Mesh<THREE.BufferGeometry, THREE.Material | THREE.Material[]>;
const isMesh = (node: THREE.Object3D): node is Hulled => node instanceof THREE.Mesh;

const meshopt = (loader: GLTFLoader): void => { loader.setMeshoptDecoder(MeshoptDecoder); };

/** Starts the download early, so the ship is there when the scene that shows it opens. */
export const preloadVessel = (file: string): void => { useLoader.preload(GLTFLoader, file, meshopt); };

/** How much of its own texture a hull gives back as light: never a dark smudge, no real light paid for. */
const SELF_LIGHT = 0.24;

interface Spot { at: VesselSystem; kind: 'fire' | 'ember' | 'sparks'; strength: number }

/**
 * WHAT THE DAMAGE LOOKS LIKE (owner 2026-11-06: "hasar durumuna göre alevler, duman, parlayan
 * parçalar"). Wrecked burns in several places and throws sparks; patched only smoulders; renewed is
 * clean. Drawn with sprites over the bays, so it costs a few quads and no light.
 */
export const DAMAGE: Record<VesselLook, readonly Spot[]> = {
  WRECKED: [
    { at: 'DRIVE', kind: 'fire', strength: 1 },
    { at: 'REFINERY', kind: 'fire', strength: 0.7 },
    { at: 'DEFENCE', kind: 'fire', strength: 0.55 },
    { at: 'CARGO', kind: 'sparks', strength: 1 },
    { at: 'SURVEY', kind: 'sparks', strength: 0.7 },
  ],
  PATCHED: [
    { at: 'DRIVE', kind: 'ember', strength: 0.8 },
    { at: 'DEFENCE', kind: 'ember', strength: 0.5 },
    { at: 'CARGO', kind: 'sparks', strength: 0.4 },
  ],
  RENEWED: [],
};

function glowMaterial(color: string, opacity: number, additive = true): THREE.SpriteMaterial {
  const material = new THREE.SpriteMaterial({
    map: softGlow(), color, opacity, transparent: true, depthWrite: false,
    blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
  });
  material.toneMapped = false;
  return material;
}

/** Flames and the smoke off them, or the dull glow of an ember. Flicker and drift run on the clock. */
function Blaze({ at, strength, ember, seed }: { at: readonly [number, number, number]; strength: number; ember: boolean; seed: number }) {
  const flame = useRef<THREE.Sprite>(null);
  const core = useRef<THREE.Sprite>(null);
  const halo = useRef<THREE.Sprite>(null);
  const smoke = useRef<(THREE.Sprite | null)[]>([]);
  const materials = useMemo(() => ({
    core: glowMaterial('#fff1c4', ember ? 0 : 0.95),
    flame: glowMaterial(ember ? '#ff5a1a' : '#ff8a2a', ember ? 0.55 : 0.9),
    halo: glowMaterial('#ff4a10', ember ? 0.14 : 0.22),
    smoke: Array.from({ length: 4 }, () => glowMaterial('#2c3036', 0.3, false)),
  }), [ember]);
  useEffect(() => () => {
    [materials.core, materials.flame, materials.halo, ...materials.smoke].forEach((material) => { material.dispose(); });
  }, [materials]);
  const size = 0.07 * (0.6 + 0.4 * strength);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime + seed * 7.3;
    const flicker = ember
      ? 0.7 + 0.3 * Math.sin(t * 2.1)
      : 0.78 + 0.14 * Math.sin(t * 13.7) + 0.08 * Math.sin(t * 29.3 + 1.7);
    flame.current?.scale.set(size * flicker * 1.1, size * flicker * 1.5, 1);
    core.current?.scale.setScalar(size * 0.45 * flicker);
    halo.current?.scale.setScalar(size * 2.2 * (0.85 + 0.15 * flicker));
    smoke.current.forEach((puff, index) => {
      if (!puff) return;
      const phase = (t * (ember ? 0.12 : 0.22) + index / 4) % 1;
      puff.position.set(at[0] - phase * 0.05, at[1] + phase * (ember ? 0.12 : 0.22), at[2]);
      puff.scale.setScalar(size * (1.2 + phase * (ember ? 3 : 5)));
      const material = materials.smoke[index];
      if (material) material.opacity = Math.min(1, phase * 5) * (1 - phase) * (ember ? 0.22 : 0.42);
    });
  });
  return (
    <>
      <sprite ref={halo} position={at} material={materials.halo} raycast={() => null} />
      <sprite ref={flame} position={[at[0], at[1] + size * 0.3, at[2]]} material={materials.flame} raycast={() => null} />
      <sprite ref={core} position={at} material={materials.core} raycast={() => null} />
      {materials.smoke.map((material, index) => (
        <sprite key={index} ref={(node) => { smoke.current[index] = node; }} material={material} raycast={() => null} />
      ))}
    </>
  );
}

/** A shorted line: bright points thrown off in short bursts, then quiet. */
function Sparks({ at, strength, seed }: { at: readonly [number, number, number]; strength: number; seed: number }) {
  const sparks = useRef<(THREE.Sprite | null)[]>([]);
  const material = useMemo(() => Array.from({ length: 6 }, () => glowMaterial('#ffe7a8', 0)), []);
  useEffect(() => () => { material.forEach((each) => { each.dispose(); }); }, [material]);
  const directions = useMemo(() => Array.from({ length: 6 }, (_, index) => {
    const angle = index * 2.4 + seed;
    return [Math.cos(angle), 0.6 + 0.5 * Math.sin(angle * 1.7), Math.sin(angle)] as const;
  }), [seed]);
  useFrame(({ clock }) => {
    const cycle = 1.9 - 0.6 * strength;
    const phase = ((clock.elapsedTime + seed * 3.1) % cycle) / 0.45;
    sparks.current.forEach((spark, index) => {
      const each = material[index];
      const direction = directions[index];
      if (!spark || !each || !direction) return;
      const live = phase < 1;
      each.opacity = live ? (1 - phase) * strength : 0;
      const reach = phase * 0.09;
      spark.position.set(at[0] + direction[0] * reach, at[1] + direction[1] * reach - phase * phase * 0.04, at[2] + direction[2] * reach);
      spark.scale.setScalar(0.012 + 0.01 * (1 - phase));
    });
  });
  return <>{material.map((each, index) => <sprite key={index} ref={(node) => { sparks.current[index] = node; }} material={each} raycast={() => null} />)}</>;
}

/**
 * THE COLONY SHIP'S BODY, AS EVERY SCENE DRAWS IT: its own model for the state it is in, lit from
 * its own texture so it never reads dim, a thin light rim like the ships flying in the galaxy, and
 * its damage burning on it. Model space: nose along +X, about one unit long.
 */
export function VesselBody({ file, hull, look, rim = '#8fe8ff', rimOpacity = 0.34, rimWidth = 0.006 }: {
  file: string;
  hull: VesselHull;
  look: VesselLook;
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
      {DAMAGE[look].map((spot, index) => {
        const at = VESSEL_BAYS[hull][spot.at];
        return spot.kind === 'sparks'
          ? <Sparks key={`${spot.at}:${spot.kind}`} at={at} strength={spot.strength} seed={index} />
          : <Blaze key={`${spot.at}:${spot.kind}`} at={at} strength={spot.strength} ember={spot.kind === 'ember'} seed={index} />;
      })}
    </group>
  );
}
